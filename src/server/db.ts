import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { hashPassword } from './auth.js';
import type { User, UserPublic, Domain, DnsRecord, QueryLogEntry, ServerSettings } from './types.js';

export class DatabaseService {
  private db: DatabaseSync;

  constructor(dbFilePath?: string) {
    const dataDir = dbFilePath ? path.dirname(dbFilePath) : path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const targetFile = dbFilePath || path.join(dataDir, 'dns.db');
    this.db = new DatabaseSync(targetFile);
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'developer',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS domains (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        ttl INTEGER NOT NULL DEFAULT 60,
        priority INTEGER DEFAULT 10,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_records_name ON records(name);
      CREATE INDEX IF NOT EXISTS idx_records_domain_id ON records(domain_id);

      CREATE TABLE IF NOT EXISTS query_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        client_ip TEXT NOT NULL,
        query_name TEXT NOT NULL,
        query_type TEXT NOT NULL,
        status TEXT NOT NULL,
        answer TEXT,
        latency_ms REAL NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON query_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_logs_query_name ON query_logs(query_name);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    this.seedDefaults();
  }

  private seedDefaults(): void {
    // Check if admin user exists
    const adminCheck = this.db.prepare('SELECT id FROM users LIMIT 1').get();
    if (!adminCheck) {
      const adminId = crypto.randomUUID();
      const defaultHash = hashPassword('admin123');
      const insertUser = this.db.prepare(`
        INSERT INTO users (id, username, password_hash, role, is_active)
        VALUES (?, ?, ?, 'admin', 1)
      `);
      insertUser.run(adminId, 'admin', defaultHash);

      // Create initial sample domain and records for immediate local dev productivity
      const domainId = crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO domains (id, name, description, created_by)
        VALUES (?, 'local.dev', 'Default local development domain', ?)
      `).run(domainId, adminId);

      const insertRecord = this.db.prepare(`
        INSERT INTO records (id, domain_id, name, type, value, ttl)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insertRecord.run(crypto.randomUUID(), domainId, 'local.dev', 'A', '127.0.0.1', 60);
      insertRecord.run(crypto.randomUUID(), domainId, '*.local.dev', 'A', '127.0.0.1', 60);
      insertRecord.run(crypto.randomUUID(), domainId, 'api.local.dev', 'A', '127.0.0.1', 60);
      insertRecord.run(crypto.randomUUID(), domainId, 'web.local.dev', 'A', '127.0.0.1', 60);
    }

    // Default settings
    const defaultSettings: Record<string, string> = {
      upstream_enabled: 'false',
      upstream_server: '1.1.1.1:53',
      dns_port: '5353',
      http_port: '3000',
      query_log_retention: '5000',
    };

    const getSetting = this.db.prepare('SELECT value FROM settings WHERE key = ?');
    const setSetting = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');

    for (const [key, val] of Object.entries(defaultSettings)) {
      if (!getSetting.get(key)) {
        setSetting.run(key, val);
      }
    }
  }

  // --- Users ---
  public listUsers(): UserPublic[] {
    const rows = this.db.prepare(`
      SELECT id, username, role, is_active, created_at, updated_at
      FROM users
      ORDER BY username ASC
    `).all() as unknown as UserPublic[];
    return rows;
  }

  public getUserById(id: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as User | undefined;
  }

  public getUserByUsername(username: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as unknown as User | undefined;
  }

  public createUser(username: string, passwordHash: string, role: string): UserPublic {
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO users (id, username, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(id, username, passwordHash, role);

    const user = this.getUserById(id)!;
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  public updateUser(id: string, updates: { role?: string; is_active?: number; password_hash?: string }): boolean {
    const user = this.getUserById(id);
    if (!user) return false;

    const fields: string[] = ["updated_at = datetime('now')"];
    const values: any[] = [];

    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(updates.password_hash);
    }

    values.push(id);
    this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return true;
  }

  public deleteUser(id: string): boolean {
    // Prevent deleting last admin
    const admins = this.db.prepare("SELECT count(*) as count FROM users WHERE role = 'admin' AND is_active = 1").get() as any;
    const target = this.getUserById(id);
    if (target?.role === 'admin' && admins.count <= 1) {
      throw new Error('Cannot delete the last active administrator.');
    }
    const res = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Domains ---
  public listDomains(): Domain[] {
    const rows = this.db.prepare(`
      SELECT d.*, COUNT(r.id) as record_count
      FROM domains d
      LEFT JOIN records r ON d.id = r.domain_id
      GROUP BY d.id
      ORDER BY d.name ASC
    `).all() as unknown as Domain[];
    return rows;
  }

  public getDomainById(id: string): Domain | undefined {
    return this.db.prepare('SELECT * FROM domains WHERE id = ?').get(id) as unknown as Domain | undefined;
  }

  public getDomainByName(name: string): Domain | undefined {
    return this.db.prepare('SELECT * FROM domains WHERE lower(name) = lower(?)').get(name) as unknown as Domain | undefined;
  }

  public createDomain(name: string, description: string | null, createdBy: string | null): Domain {
    const cleanName = name.trim().toLowerCase().replace(/\.+$/, '');
    const id = crypto.randomUUID();
    this.db.prepare(`
      INSERT INTO domains (id, name, description, created_by)
      VALUES (?, ?, ?, ?)
    `).run(id, cleanName, description, createdBy);

    return {
      id,
      name: cleanName,
      description,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      record_count: 0,
    };
  }

  public updateDomain(id: string, name: string, description: string | null): boolean {
    const cleanName = name.trim().toLowerCase().replace(/\.+$/, '');
    const res = this.db.prepare(`
      UPDATE domains SET name = ?, description = ? WHERE id = ?
    `).run(cleanName, description, id);
    return res.changes > 0;
  }

  public deleteDomain(id: string): boolean {
    const res = this.db.prepare('DELETE FROM domains WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Records ---
  public listAllRecords(): DnsRecord[] {
    const rows = this.db.prepare(`
      SELECT r.*, d.name as domain_name
      FROM records r
      JOIN domains d ON r.domain_id = d.id
      ORDER BY r.name ASC, r.type ASC
    `).all() as unknown as DnsRecord[];
    return rows;
  }

  public listActiveRecords(): DnsRecord[] {
    const rows = this.db.prepare(`
      SELECT r.*, d.name as domain_name
      FROM records r
      JOIN domains d ON r.domain_id = d.id
      WHERE r.is_active = 1
      ORDER BY r.name ASC
    `).all() as unknown as DnsRecord[];
    return rows;
  }

  public listRecordsByDomain(domainId: string): DnsRecord[] {
    const rows = this.db.prepare(`
      SELECT r.*, d.name as domain_name
      FROM records r
      JOIN domains d ON r.domain_id = d.id
      WHERE r.domain_id = ?
      ORDER BY r.name ASC, r.type ASC
    `).all(domainId) as unknown as DnsRecord[];
    return rows;
  }

  public getRecordById(id: string): DnsRecord | undefined {
    return this.db.prepare(`
      SELECT r.*, d.name as domain_name
      FROM records r
      JOIN domains d ON r.domain_id = d.id
      WHERE r.id = ?
    `).get(id) as unknown as DnsRecord | undefined;
  }

  public createRecord(record: {
    domain_id: string;
    name: string;
    type: string;
    value: string;
    ttl?: number;
    priority?: number;
    is_active?: number;
  }): DnsRecord {
    const id = crypto.randomUUID();
    const cleanName = record.name.trim().toLowerCase().replace(/\.+$/, '');
    const ttl = record.ttl && record.ttl > 0 ? record.ttl : 60;
    const priority = record.priority ?? 10;
    const isActive = record.is_active ?? 1;

    this.db.prepare(`
      INSERT INTO records (id, domain_id, name, type, value, ttl, priority, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, record.domain_id, cleanName, record.type.toUpperCase(), record.value.trim(), ttl, priority, isActive);

    return this.getRecordById(id)!;
  }

  public updateRecord(id: string, updates: {
    name?: string;
    type?: string;
    value?: string;
    ttl?: number;
    priority?: number;
    is_active?: number;
  }): boolean {
    const existing = this.getRecordById(id);
    if (!existing) return false;

    const fields: string[] = ["updated_at = datetime('now')"];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name.trim().toLowerCase().replace(/\.+$/, ''));
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type.toUpperCase());
    }
    if (updates.value !== undefined) {
      fields.push('value = ?');
      values.push(updates.value.trim());
    }
    if (updates.ttl !== undefined) {
      fields.push('ttl = ?');
      values.push(updates.ttl > 0 ? updates.ttl : 60);
    }
    if (updates.priority !== undefined) {
      fields.push('priority = ?');
      values.push(updates.priority);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active);
    }

    values.push(id);
    this.db.prepare(`UPDATE records SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return true;
  }

  public deleteRecord(id: string): boolean {
    const res = this.db.prepare('DELETE FROM records WHERE id = ?').run(id);
    return res.changes > 0;
  }

  // --- Query Logs ---
  public insertLog(log: QueryLogEntry): void {
    this.db.prepare(`
      INSERT INTO query_logs (timestamp, client_ip, query_name, query_type, status, answer, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      log.timestamp || new Date().toISOString(),
      log.client_ip,
      log.query_name,
      log.query_type,
      log.status,
      log.answer || '',
      log.latency_ms
    );
  }

  public insertLogsBatch(logs: QueryLogEntry[]): void {
    if (!logs.length) return;
    const stmt = this.db.prepare(`
      INSERT INTO query_logs (timestamp, client_ip, query_name, query_type, status, answer, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const log of logs) {
      stmt.run(
        log.timestamp || new Date().toISOString(),
        log.client_ip,
        log.query_name,
        log.query_type,
        log.status,
        log.answer || '',
        log.latency_ms
      );
    }
  }

  public getLogs(options: {
    limit?: number;
    offset?: number;
    query?: string;
    status?: string;
    type?: string;
  }): { logs: QueryLogEntry[]; total: number } {
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    const conditions: string[] = [];
    const params: any[] = [];

    if (options.query) {
      conditions.push('(query_name LIKE ? OR client_ip LIKE ?)');
      params.push(`%${options.query}%`, `%${options.query}%`);
    }
    if (options.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }
    if (options.type) {
      conditions.push('query_type = ?');
      params.push(options.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = this.db.prepare(`SELECT count(*) as total FROM query_logs ${whereClause}`).get(...params) as any;
    const total = countRow ? Number(countRow.total) : 0;

    const queryParams = [...params, limit, offset];
    const logs = this.db.prepare(`
      SELECT id, timestamp, client_ip, query_name, query_type, status, answer, latency_ms
      FROM query_logs
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...queryParams) as unknown as QueryLogEntry[];

    return { logs, total };
  }

  public clearLogs(): void {
    this.db.exec('DELETE FROM query_logs');
  }

  public pruneLogs(maxRetention: number): void {
    this.db.prepare(`
      DELETE FROM query_logs
      WHERE id NOT IN (
        SELECT id FROM query_logs ORDER BY id DESC LIMIT ?
      )
    `).run(maxRetention);
  }

  // --- Settings ---
  public getSettings(): ServerSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as unknown as { key: string; value: string }[];
    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, r.value);
    }

    return {
      upstream_enabled: map.get('upstream_enabled') === 'true',
      upstream_server: map.get('upstream_server') || '1.1.1.1:53',
      dns_port: parseInt(map.get('dns_port') || '5353', 10),
      http_port: parseInt(map.get('http_port') || '3000', 10),
      query_log_retention: parseInt(map.get('query_log_retention') || '5000', 10),
    };
  }

  public updateSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  // --- Overview Stats ---
  public getStats(): {
    domainCount: number;
    recordCount: number;
    userCount: number;
    totalQueries: number;
    queriesToday: number;
  } {
    const domainCount = (this.db.prepare('SELECT count(*) as c FROM domains').get() as any)?.c || 0;
    const recordCount = (this.db.prepare('SELECT count(*) as c FROM records WHERE is_active = 1').get() as any)?.c || 0;
    const userCount = (this.db.prepare('SELECT count(*) as c FROM users WHERE is_active = 1').get() as any)?.c || 0;
    const totalQueries = (this.db.prepare('SELECT count(*) as c FROM query_logs').get() as any)?.c || 0;
    const queriesToday = (this.db.prepare("SELECT count(*) as c FROM query_logs WHERE timestamp >= date('now', 'start of day')").get() as any)?.c || 0;

    return {
      domainCount: Number(domainCount),
      recordCount: Number(recordCount),
      userCount: Number(userCount),
      totalQueries: Number(totalQueries),
      queriesToday: Number(queriesToday),
    };
  }
}
