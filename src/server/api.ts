import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import os from 'node:os';
import type { DatabaseService } from './db.js';
import type { DnsEngine } from './dns-engine.js';
import { hashPassword, verifyPassword } from './auth.js';
import type { UserRole, UserPublic } from './types.js';

interface AuthenticatedUser {
  id: string;
  username: string;
  role: UserRole;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthenticatedUser;
  }
}

export function registerRoutes(app: FastifyInstance, db: DatabaseService, dns: DnsEngine): void {
  // Authentication Middleware
  const authenticate = async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      let token = req.cookies.token;
      if (!token && req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        return reply.status(401).send({ error: 'Unauthorized: No token provided' });
      }

      const decoded = app.jwt.verify<AuthenticatedUser>(token);
      const user = db.getUserById(decoded.id);
      if (!user || !user.is_active) {
        return reply.status(401).send({ error: 'Unauthorized: User is inactive or removed' });
      }

      req.user = {
        id: user.id,
        username: user.username,
        role: user.role,
      };
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized: Invalid or expired token' });
    }
  };

  const requireRole = (...allowedRoles: UserRole[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      await authenticate(req, reply);
      if (reply.sent) return;

      if (!req.user || !allowedRoles.includes(req.user.role)) {
        return reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
      }
    };
  };

  // --- Auth Endpoints ---
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = (req.body as any) || {};
    if (!username || !password) {
      return reply.status(400).send({ error: 'Username and password are required' });
    }

    const user = db.getUserByUsername(String(username).trim());
    if (!user || !user.is_active) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    const valid = verifyPassword(String(password), user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: '7d' }
    );

    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  });

  app.get('/api/auth/me', { preHandler: authenticate }, async (req) => {
    const user = db.getUserById(req.user!.id);
    if (!user) throw new Error('User not found');
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_active: user.is_active,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  });

  app.post('/api/auth/logout', async (_req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { success: true };
  });

  // --- Stats & System Info ---
  app.get('/api/stats', { preHandler: authenticate }, async () => {
    const stats = db.getStats();
    const dnsStatus = dns.getStatus();

    // Collect local host IP addresses for developer presets
    const interfaces = os.networkInterfaces();
    const localIps: { name: string; address: string }[] = [];
    for (const [ifaceName, addrs] of Object.entries(interfaces)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family === 'IPv4' && !addr.internal) {
          localIps.push({ name: ifaceName, address: addr.address });
        }
      }
    }

    return {
      ...stats,
      dns: dnsStatus,
      hostIps: localIps,
    };
  });

  // --- Settings ---
  app.get('/api/settings', { preHandler: authenticate }, async () => {
    return db.getSettings();
  });

  app.put('/api/settings', { preHandler: requireRole('admin') }, async (req) => {
    const body = (req.body as any) || {};
    if (body.upstream_enabled !== undefined) {
      db.updateSetting('upstream_enabled', body.upstream_enabled ? 'true' : 'false');
    }
    if (body.upstream_server !== undefined) {
      db.updateSetting('upstream_server', String(body.upstream_server).trim());
    }
    if (body.query_log_retention !== undefined) {
      db.updateSetting('query_log_retention', String(body.query_log_retention));
    }
    return db.getSettings();
  });

  // --- Domains ---
  app.get('/api/domains', { preHandler: authenticate }, async () => {
    return db.listDomains();
  });

  app.post('/api/domains', { preHandler: requireRole('admin', 'developer') }, async (req, reply) => {
    const { name, description } = (req.body as any) || {};
    if (!name || !String(name).trim()) {
      return reply.status(400).send({ error: 'Domain name is required' });
    }

    const cleanName = String(name).trim().toLowerCase().replace(/\.+$/, '');
    const existing = db.getDomainByName(cleanName);
    if (existing) {
      return reply.status(409).send({ error: `Domain "${cleanName}" already exists` });
    }

    const domain = db.createDomain(cleanName, description ? String(description) : null, req.user!.id);
    return domain;
  });

  app.put('/api/domains/:id', { preHandler: requireRole('admin', 'developer') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { name, description } = (req.body as any) || {};
    if (!name || !String(name).trim()) {
      return reply.status(400).send({ error: 'Domain name is required' });
    }

    const cleanName = String(name).trim().toLowerCase().replace(/\.+$/, '');
    const existing = db.getDomainByName(cleanName);
    if (existing && existing.id !== id) {
      return reply.status(409).send({ error: `Domain name "${cleanName}" is already taken` });
    }

    const success = db.updateDomain(id, cleanName, description ? String(description) : null);
    if (!success) {
      return reply.status(404).send({ error: 'Domain not found' });
    }
    dns.refreshRecords();
    return db.getDomainById(id);
  });

  app.delete('/api/domains/:id', { preHandler: requireRole('admin', 'developer') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const success = db.deleteDomain(id);
    if (!success) {
      return reply.status(404).send({ error: 'Domain not found' });
    }
    dns.refreshRecords();
    return { success: true };
  });

  // --- Records ---
  app.get('/api/records', { preHandler: authenticate }, async (req) => {
    const { domain_id } = (req.query as any) || {};
    if (domain_id) {
      return db.listRecordsByDomain(String(domain_id));
    }
    return db.listAllRecords();
  });

  app.post('/api/records', { preHandler: requireRole('admin', 'developer') }, async (req, reply) => {
    const { domain_id, name, type, value, ttl, priority, is_active } = (req.body as any) || {};
    if (!domain_id || !name || !type || !value) {
      return reply.status(400).send({ error: 'domain_id, name, type, and value are required' });
    }

    const domain = db.getDomainById(String(domain_id));
    if (!domain) {
      return reply.status(404).send({ error: 'Domain not found' });
    }

    const allowedTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'PTR'];
    const cleanType = String(type).trim().toUpperCase();
    if (!allowedTypes.includes(cleanType)) {
      return reply.status(400).send({ error: `Invalid record type. Allowed: ${allowedTypes.join(', ')}` });
    }

    const created = db.createRecord({
      domain_id: String(domain_id),
      name: String(name),
      type: cleanType,
      value: String(value),
      ttl: Number(ttl) || 60,
      priority: priority !== undefined ? Number(priority) : 10,
      is_active: is_active !== undefined ? Number(is_active) : 1,
    });

    dns.refreshRecords();
    return created;
  });

  app.put('/api/records/:id', { preHandler: requireRole('admin', 'developer') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body as any) || {};

    if (body.type) {
      const allowedTypes = ['A', 'AAAA', 'CNAME', 'TXT', 'MX', 'PTR'];
      const cleanType = String(body.type).trim().toUpperCase();
      if (!allowedTypes.includes(cleanType)) {
        return reply.status(400).send({ error: `Invalid record type. Allowed: ${allowedTypes.join(', ')}` });
      }
      body.type = cleanType;
    }

    const success = db.updateRecord(id, body);
    if (!success) {
      return reply.status(404).send({ error: 'Record not found' });
    }

    dns.refreshRecords();
    return db.getRecordById(id);
  });

  app.delete('/api/records/:id', { preHandler: requireRole('admin', 'developer') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const success = db.deleteRecord(id);
    if (!success) {
      return reply.status(404).send({ error: 'Record not found' });
    }
    dns.refreshRecords();
    return { success: true };
  });

  // --- Users Control (Admin only) ---
  app.get('/api/users', { preHandler: requireRole('admin') }, async () => {
    return db.listUsers();
  });

  app.post('/api/users', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { username, password, role } = (req.body as any) || {};
    if (!username || !password || !role) {
      return reply.status(400).send({ error: 'Username, password, and role are required' });
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const existing = db.getUserByUsername(cleanUsername);
    if (existing) {
      return reply.status(409).send({ error: `Username "${cleanUsername}" is already taken` });
    }

    const allowedRoles: UserRole[] = ['admin', 'developer', 'viewer'];
    if (!allowedRoles.includes(role)) {
      return reply.status(400).send({ error: 'Invalid role. Must be admin, developer, or viewer.' });
    }

    const hash = hashPassword(String(password));
    const newUser = db.createUser(cleanUsername, hash, role);
    return newUser;
  });

  app.put('/api/users/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { role, is_active, password } = (req.body as any) || {};

    const updates: { role?: string; is_active?: number; password_hash?: string } = {};
    if (role !== undefined) {
      const allowedRoles: UserRole[] = ['admin', 'developer', 'viewer'];
      if (!allowedRoles.includes(role)) {
        return reply.status(400).send({ error: 'Invalid role.' });
      }
      updates.role = role;
    }
    if (is_active !== undefined) {
      updates.is_active = is_active ? 1 : 0;
    }
    if (password && String(password).trim().length > 0) {
      updates.password_hash = hashPassword(String(password).trim());
    }

    try {
      const success = db.updateUser(id, updates);
      if (!success) {
        return reply.status(404).send({ error: 'User not found' });
      }
      const user = db.getUserById(id)!;
      const userPublic: UserPublic = {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      };
      return userPublic;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (req.user!.id === id) {
      return reply.status(400).send({ error: 'You cannot delete your own account.' });
    }

    try {
      const success = db.deleteUser(id);
      if (!success) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return { success: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Failed to delete user' });
    }
  });

  // --- Query Logs ---
  app.get('/api/logs', { preHandler: authenticate }, async (req) => {
    const q = (req.query as any) || {};
    const limit = q.limit ? parseInt(q.limit, 10) : 50;
    const offset = q.offset ? parseInt(q.offset, 10) : 0;
    return db.getLogs({
      limit,
      offset,
      query: q.query,
      status: q.status,
      type: q.type,
    });
  });

  app.delete('/api/logs', { preHandler: requireRole('admin', 'developer') }, async () => {
    db.clearLogs();
    return { success: true };
  });

  // --- Live Log SSE Stream ---
  app.get('/api/logs/stream', async (req, reply) => {
    let token = req.cookies.token;
    if (!token && (req.query as any)?.token) {
      token = (req.query as any).token;
    }
    if (!token && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized for log stream' });
    }

    try {
      app.jwt.verify(token);
    } catch {
      return reply.status(401).send({ error: 'Invalid stream token' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    reply.raw.write(': connected\n\n');

    const unsubscribe = dns.subscribeLogs((entry) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`);
      } catch {
        unsubscribe();
      }
    });

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
        unsubscribe();
      }
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
