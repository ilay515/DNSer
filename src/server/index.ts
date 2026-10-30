import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { DatabaseService } from './db.js';
import { DnsEngine } from './dns-engine.js';
import { registerRoutes } from './api.js';

// Parse command line arguments or environment variables
function parseArgs(): { httpPort: number; dnsPort: number } {
  let httpPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  let dnsPort = process.env.DNS_PORT ? parseInt(process.env.DNS_PORT, 10) : 5353;

  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      httpPort = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--dns-port' && args[i + 1]) {
      dnsPort = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { httpPort, dnsPort };
}

async function bootstrap() {
  const { httpPort, dnsPort } = parseArgs();

  const db = new DatabaseService();
  const dnsEngine = new DnsEngine(db, dnsPort, '0.0.0.0');

  // Start DNS Server
  try {
    await dnsEngine.start();
  } catch (err: any) {
    console.error(`[DNS Engine] Failed to bind to UDP port ${dnsPort}:`, err.message);
    if (dnsPort === 53) {
      console.error('[DNS Engine] Note: Port 53 requires elevated privileges. Try running with sudo or setcap.');
    }
  }

  // Fastify Web & API Server
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'dev-dns-local-cookie-secret-key-9988',
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-dns-local-jwt-secret-key-3344',
  });

  // Register API routes
  registerRoutes(app, db, dnsEngine);

  // Serve static UI if dist/client exists
  const clientDistPath = path.join(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDistPath)) {
    await app.register(fastifyStatic, {
      root: clientDistPath,
      prefix: '/',
    });

    // SPA fallback: any non-API route serves index.html
    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url && req.raw.url.startsWith('/api')) {
        return reply.status(404).send({ error: 'Endpoint not found' });
      }
      return reply.sendFile('index.html');
    });
  }

  // Start HTTP Server
  try {
    await app.listen({ port: httpPort, host: '0.0.0.0' });
    console.log(`\n=================================================`);
    console.log(`🚀 DevDNS Web Dashboard:  http://localhost:${httpPort}`);
    console.log(`🛰️  DevDNS Server Daemon:   udp://0.0.0.0:${dnsPort}`);
    console.log(`🔑 Default Admin Login:    admin / admin123`);
    console.log(`=================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down DevDNS...');
    await dnsEngine.stop();
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
