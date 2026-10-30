import dgram from 'node:dgram';
import dnsPacket from 'dns-packet';
import type { DatabaseService } from './db.js';
import type { DnsRecord, QueryLogEntry } from './types.js';

export type LogListener = (entry: QueryLogEntry) => void;

export class DnsEngine {
  private socket: dgram.Socket | null = null;
  private db: DatabaseService;
  private port: number;
  private host: string;
  private activeRecords: DnsRecord[] = [];
  private logListeners: Set<LogListener> = new Set();
  private isRunning: boolean = false;
  private logBatch: QueryLogEntry[] = [];
  private logFlushInterval: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService, port: number = 5353, host: string = '0.0.0.0') {
    this.db = db;
    this.port = port;
    this.host = host;
    this.refreshRecords();

    // Flush logs every 2 seconds or on 100 entries
    this.logFlushInterval = setInterval(() => this.flushLogs(), 2000);
  }

  public refreshRecords(): void {
    this.activeRecords = this.db.listActiveRecords();
  }

  public subscribeLogs(listener: LogListener): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  private emitLog(entry: QueryLogEntry): void {
    for (const listener of this.logListeners) {
      try {
        listener(entry);
      } catch (err) {
        console.error('Error delivering log to listener:', err);
      }
    }
    this.logBatch.push(entry);
    if (this.logBatch.length >= 100) {
      this.flushLogs();
    }
  }

  private flushLogs(): void {
    if (this.logBatch.length === 0) return;
    const toInsert = [...this.logBatch];
    this.logBatch = [];
    try {
      this.db.insertLogsBatch(toInsert);
      const settings = this.db.getSettings();
      if (settings.query_log_retention > 0) {
        this.db.pruneLogs(settings.query_log_retention);
      }
    } catch (err) {
      console.error('Failed to flush DNS query logs:', err);
    }
  }

  public async start(): Promise<void> {
    if (this.isRunning) return;

    return new Promise((resolve, reject) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      socket.on('error', (err) => {
        console.error('DNS Server socket error:', err);
        if (!this.isRunning) {
          reject(err);
        }
      });

      socket.on('message', async (msg, rinfo) => {
        const startTime = Date.now();
        await this.handleMessage(socket, msg, rinfo, startTime);
      });

      socket.bind(this.port, this.host, () => {
        this.socket = socket;
        this.isRunning = true;
        console.log(`[DNS Engine] Listening on udp://${this.host}:${this.port}`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.logFlushInterval) {
      clearInterval(this.logFlushInterval);
      this.logFlushInterval = null;
    }
    this.flushLogs();

    if (this.socket) {
      return new Promise((resolve) => {
        this.socket?.close(() => {
          this.socket = null;
          this.isRunning = false;
          console.log('[DNS Engine] Stopped.');
          resolve();
        });
      });
    }
  }

  public getStatus(): { isRunning: boolean; port: number; host: string; activeRecordsCount: number } {
    return {
      isRunning: this.isRunning,
      port: this.port,
      host: this.host,
      activeRecordsCount: this.activeRecords.length,
    };
  }

  private async handleMessage(socket: dgram.Socket, msg: Buffer, rinfo: dgram.RemoteInfo, startTime: number): Promise<void> {
    let queryPacket: dnsPacket.Packet;
    try {
      queryPacket = dnsPacket.decode(msg);
    } catch (err) {
      return;
    }

    if (!queryPacket.questions || queryPacket.questions.length === 0) {
      return;
    }

    const question = queryPacket.questions[0];
    const qName = (question.name || '').trim().toLowerCase().replace(/\.+$/, '');
    const qType = (question.type || 'A').toUpperCase();

    // 1. Try local records
    const matchedRecords = this.findMatchingRecords(qName, qType);

    if (matchedRecords.length > 0) {
      const answers: dnsPacket.Answer[] = [];
      const answerSummaryList: string[] = [];

      for (const rec of matchedRecords) {
        answerSummaryList.push(`${rec.type} ${rec.value}`);
        switch (rec.type) {
          case 'A':
            answers.push({
              type: 'A',
              name: question.name,
              ttl: rec.ttl || 60,
              data: rec.value,
            });
            break;
          case 'AAAA':
            answers.push({
              type: 'AAAA',
              name: question.name,
              ttl: rec.ttl || 60,
              data: rec.value,
            });
            break;
          case 'CNAME':
            answers.push({
              type: 'CNAME',
              name: question.name,
              ttl: rec.ttl || 60,
              data: rec.value,
            });
            break;
          case 'TXT':
            answers.push({
              type: 'TXT',
              name: question.name,
              ttl: rec.ttl || 60,
              data: [rec.value],
            });
            break;
          case 'MX':
            answers.push({
              type: 'MX',
              name: question.name,
              ttl: rec.ttl || 60,
              data: {
                preference: rec.priority || 10,
                exchange: rec.value,
              },
            });
            break;
          case 'PTR':
            answers.push({
              type: 'PTR',
              name: question.name,
              ttl: rec.ttl || 60,
              data: rec.value,
            });
            break;
        }
      }

      const responseBuffer = dnsPacket.encode({
        type: 'response',
        id: queryPacket.id,
        flags: dnsPacket.AUTHORITATIVE_ANSWER | dnsPacket.RECURSION_AVAILABLE,
        questions: queryPacket.questions,
        answers,
      });

      socket.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address);

      const latencyMs = Math.max(1, Date.now() - startTime);
      this.emitLog({
        timestamp: new Date().toISOString(),
        client_ip: rinfo.address,
        query_name: qName,
        query_type: qType,
        status: 'NOERROR',
        answer: answerSummaryList.join(', '),
        latency_ms: latencyMs,
      });
      return;
    }

    // 2. Check if upstream relay is enabled
    const settings = this.db.getSettings();
    if (settings.upstream_enabled && settings.upstream_server) {
      try {
        const upstreamResponse = await this.forwardQuery(msg, settings.upstream_server);
        socket.send(upstreamResponse.buffer, 0, upstreamResponse.buffer.length, rinfo.port, rinfo.address);

        let answerSummary = 'Relayed';
        try {
          const decodedUpstream = dnsPacket.decode(upstreamResponse.buffer);
          if (decodedUpstream.answers && decodedUpstream.answers.length > 0) {
            answerSummary = decodedUpstream.answers.map(a => `${a.type} ${(a as any).data || ''}`).join(', ');
          }
        } catch {
          // Keep default summary
        }

        const latencyMs = Math.max(1, Date.now() - startTime);
        this.emitLog({
          timestamp: new Date().toISOString(),
          client_ip: rinfo.address,
          query_name: qName,
          query_type: qType,
          status: 'FORWARDED',
          answer: answerSummary,
          latency_ms: latencyMs,
        });
        return;
      } catch (upstreamErr) {
        // Fallback to NXDOMAIN if upstream timed out or unreachable
      }
    }

    // 3. Return NXDOMAIN
    const nxdomainBuffer = dnsPacket.encode({
      type: 'response',
      id: queryPacket.id,
      // 3 = NXDOMAIN
      flags: dnsPacket.AUTHORITATIVE_ANSWER | dnsPacket.RECURSION_AVAILABLE | 3,
      questions: queryPacket.questions,
      answers: [],
    });

    socket.send(nxdomainBuffer, 0, nxdomainBuffer.length, rinfo.port, rinfo.address);

    const latencyMs = Math.max(1, Date.now() - startTime);
    this.emitLog({
      timestamp: new Date().toISOString(),
      client_ip: rinfo.address,
      query_name: qName,
      query_type: qType,
      status: 'NXDOMAIN',
      answer: '',
      latency_ms: latencyMs,
    });
  }

  private findMatchingRecords(qName: string, qType: string): DnsRecord[] {
    const directMatches = this.activeRecords.filter(r => {
      const recName = r.name.toLowerCase().replace(/\.+$/, '');
      if (recName !== qName) return false;
      return r.type === qType || r.type === 'CNAME';
    });

    if (directMatches.length > 0) {
      return directMatches;
    }

    // Wildcard matching: e.g. record "*.local.dev" matches "app.local.dev" or "api.test.local.dev"
    const wildcardMatches = this.activeRecords.filter(r => {
      const recName = r.name.toLowerCase().replace(/\.+$/, '');
      if (!recName.startsWith('*.')) return false;
      if (r.type !== qType && r.type !== 'CNAME') return false;

      const baseDomain = recName.slice(2); // e.g. "local.dev"
      // qName must end with .<baseDomain>
      if (qName === baseDomain || qName.endsWith('.' + baseDomain)) {
        return true;
      }
      return false;
    });

    return wildcardMatches;
  }

  private forwardQuery(queryBuffer: Buffer, upstream: string): Promise<{ buffer: Buffer }> {
    return new Promise((resolve, reject) => {
      const [host, portStr] = upstream.split(':');
      const port = portStr ? parseInt(portStr, 10) : 53;
      const client = dgram.createSocket('udp4');

      const timer = setTimeout(() => {
        try { client.close(); } catch {}
        reject(new Error('Upstream DNS query timed out'));
      }, 2000);

      client.on('message', (msg) => {
        clearTimeout(timer);
        try { client.close(); } catch {}
        resolve({ buffer: msg });
      });

      client.on('error', (err) => {
        clearTimeout(timer);
        try { client.close(); } catch {}
        reject(err);
      });

      client.send(queryBuffer, 0, queryBuffer.length, port, host, (err) => {
        if (err) {
          clearTimeout(timer);
          try { client.close(); } catch {}
          reject(err);
        }
      });
    });
  }
}
