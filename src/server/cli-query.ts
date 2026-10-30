import dgram from 'node:dgram';
import dnsPacket from 'dns-packet';

function parseArgs(): { domain: string; type: string; port: number; host: string } {
  const args = process.argv.slice(2);
  let domain = 'local.dev';
  let type = 'A';
  let port = 5353;
  let host = '127.0.0.1';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--type' && args[i + 1]) {
      type = args[i + 1].toUpperCase();
      i++;
    } else if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (!args[i].startsWith('-')) {
      domain = args[i];
    }
  }

  return { domain, type, port, host };
}

async function runQuery() {
  const { domain, type, port, host } = parseArgs();

  console.log(`\n🔍 Querying DNSer at udp://${host}:${port}`);
  console.log(`🌐 Question: ${domain} (Type: ${type})\n`);

  const socket = dgram.createSocket('udp4');
  const startTime = Date.now();

  const queryBuf = dnsPacket.encode({
    type: 'query',
    id: Math.floor(Math.random() * 65000),
    flags: dnsPacket.RECURSION_DESIRED,
    questions: [{ type: type as any, name: domain }],
  });

  const timer = setTimeout(() => {
    try { socket.close(); } catch {}
    console.error(`❌ Query timed out (no response received from ${host}:${port} within 2.5s)`);
    process.exit(1);
  }, 2500);

  socket.on('message', (msg) => {
    clearTimeout(timer);
    const latency = Date.now() - startTime;
    try {
      const response = dnsPacket.decode(msg);
      socket.close();

      const rcode = (response as any).rcode || 'UNKNOWN';
      console.log(`⏱️  Latency: ${latency}ms`);
      console.log(`📊 Status:  ${rcode}`);

      if (response.answers && response.answers.length > 0) {
        console.log(`\n✅ Answers (${response.answers.length}):`);
        for (const ans of response.answers) {
          const ttl = (ans as any).ttl !== undefined ? (ans as any).ttl : 60;
          console.log(`   • ${ans.name}  [${ans.type}]  ${(ans as any).data || ''}  (TTL: ${ttl}s)`);
        }
      } else {
        console.log(`\n⚠️  No answer records returned (${rcode}).`);
      }
      console.log('');
      process.exit(0);
    } catch (err: any) {
      console.error('Failed to parse DNS response packet:', err.message);
      process.exit(1);
    }
  });

  socket.on('error', (err) => {
    clearTimeout(timer);
    try { socket.close(); } catch {}
    console.error('Socket error:', err.message);
    process.exit(1);
  });

  socket.send(queryBuf, 0, queryBuf.length, port, host);
}

runQuery();
