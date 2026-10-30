import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { DatabaseService } from '../src/server/db.js';
import { DnsEngine } from '../src/server/dns-engine.js';
import { registerRoutes } from '../src/server/api.js';

async function runApiTests() {
  console.log('🧪 Running DNSer REST API & Auth Tests...');
  const testDbPath = path.join(process.cwd(), 'data', 'test-api.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const db = new DatabaseService(testDbPath);
  const dnsEngine = new DnsEngine(db, 5357, '127.0.0.1');

  const app = Fastify();
  await app.register(cors);
  await app.register(cookie, { secret: 'test-cookie-secret' });
  await app.register(jwt, { secret: 'test-jwt-secret' });
  registerRoutes(app, db, dnsEngine);

  try {
    // 1. Login with bad credentials
    console.log('-> Testing login with invalid credentials');
    const badLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'wrongpassword' },
    });
    assert.strictEqual(badLogin.statusCode, 401);

    // 2. Login with correct default credentials
    console.log('-> Testing admin login');
    const goodLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'admin123' },
    });
    assert.strictEqual(goodLogin.statusCode, 200);
    const authData = JSON.parse(goodLogin.payload);
    assert.ok(authData.token);
    assert.strictEqual(authData.user.username, 'admin');
    assert.strictEqual(authData.user.role, 'admin');

    const adminToken = authData.token;
    const adminHeaders = { authorization: `Bearer ${adminToken}` };

    // 3. GET /api/auth/me
    console.log('-> Testing /api/auth/me authentication');
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: adminHeaders,
    });
    assert.strictEqual(meRes.statusCode, 200);
    const meData = JSON.parse(meRes.payload);
    assert.strictEqual(meData.username, 'admin');

    // 4. Test unauthorized request
    console.log('-> Testing unauthenticated request rejection');
    const unauthRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    });
    assert.strictEqual(unauthRes.statusCode, 401);

    // 5. Create Domain Zone
    console.log('-> Testing domain creation');
    const createDom = await app.inject({
      method: 'POST',
      url: '/api/domains',
      headers: adminHeaders,
      payload: { name: 'staging.test', description: 'Staging environment zone' },
    });
    assert.strictEqual(createDom.statusCode, 200);
    const domData = JSON.parse(createDom.payload);
    assert.strictEqual(domData.name, 'staging.test');
    const stagingDomainId = domData.id;

    // 6. Test duplicate domain rejection
    console.log('-> Testing duplicate domain conflict');
    const dupDom = await app.inject({
      method: 'POST',
      url: '/api/domains',
      headers: adminHeaders,
      payload: { name: 'staging.test' },
    });
    assert.strictEqual(dupDom.statusCode, 409);

    // 7. Create Records (A, CNAME, TXT)
    console.log('-> Testing record creation (A, CNAME, TXT)');
    const aRec = await app.inject({
      method: 'POST',
      url: '/api/records',
      headers: adminHeaders,
      payload: {
        domain_id: stagingDomainId,
        name: 'api.staging.test',
        type: 'A',
        value: '10.0.0.5',
        ttl: 120,
      },
    });
    assert.strictEqual(aRec.statusCode, 200);

    const txtRec = await app.inject({
      method: 'POST',
      url: '/api/records',
      headers: adminHeaders,
      payload: {
        domain_id: stagingDomainId,
        name: 'staging.test',
        type: 'TXT',
        value: 'v=spf1 ~all',
        ttl: 300,
      },
    });
    assert.strictEqual(txtRec.statusCode, 200);

    // 8. Test invalid record type rejection
    console.log('-> Testing invalid DNS record type rejection');
    const badRec = await app.inject({
      method: 'POST',
      url: '/api/records',
      headers: adminHeaders,
      payload: {
        domain_id: stagingDomainId,
        name: 'bad.staging.test',
        type: 'INVALID_TYPE',
        value: '1.2.3.4',
      },
    });
    assert.strictEqual(badRec.statusCode, 400);

    // 9. Update record value
    console.log('-> Testing record update');
    const aRecData = JSON.parse(aRec.payload);
    const updateRec = await app.inject({
      method: 'PUT',
      url: `/api/records/${aRecData.id}`,
      headers: adminHeaders,
      payload: { value: '10.0.0.99', is_active: 1 },
    });
    assert.strictEqual(updateRec.statusCode, 200);
    const updatedData = JSON.parse(updateRec.payload);
    assert.strictEqual(updatedData.value, '10.0.0.99');

    // 10. Role-Based Access Control: Create Viewer user
    console.log('-> Testing User creation and RBAC permissions');
    const createViewer = await app.inject({
      method: 'POST',
      url: '/api/users',
      headers: adminHeaders,
      payload: { username: 'auditor', password: 'password123', role: 'viewer' },
    });
    assert.strictEqual(createViewer.statusCode, 200);

    // Login as viewer
    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'auditor', password: 'password123' },
    });
    assert.strictEqual(viewerLogin.statusCode, 200);
    const viewerHeaders = { authorization: `Bearer ${JSON.parse(viewerLogin.payload).token}` };

    // Viewer trying to create a domain -> should be 403 Forbidden
    const viewerForbidden = await app.inject({
      method: 'POST',
      url: '/api/domains',
      headers: viewerHeaders,
      payload: { name: 'viewer-forbidden.test' },
    });
    assert.strictEqual(viewerForbidden.statusCode, 403);

    // Viewer reading records -> should be 200 OK
    const viewerRead = await app.inject({
      method: 'GET',
      url: '/api/records',
      headers: viewerHeaders,
    });
    assert.strictEqual(viewerRead.statusCode, 200);

    // 11. System Settings API
    console.log('-> Testing settings retrieval and update');
    const updateSettings = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      headers: adminHeaders,
      payload: { upstream_enabled: true, upstream_server: '8.8.8.8:53', query_log_retention: 2500 },
    });
    assert.strictEqual(updateSettings.statusCode, 200);
    const settingsData = JSON.parse(updateSettings.payload);
    assert.strictEqual(settingsData.upstream_enabled, true);
    assert.strictEqual(settingsData.upstream_server, '8.8.8.8:53');
    assert.strictEqual(settingsData.query_log_retention, 2500);

    // 12. Stats API
    console.log('-> Testing /api/stats endpoint');
    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/stats',
      headers: adminHeaders,
    });
    assert.strictEqual(statsRes.statusCode, 200);
    const statsData = JSON.parse(statsRes.payload);
    assert.strictEqual(statsData.domainCount >= 2, true);

    // 13. Query Logs API & Clear
    console.log('-> Testing query logs pagination and clear');
    const logsRes = await app.inject({
      method: 'GET',
      url: '/api/logs?limit=10',
      headers: adminHeaders,
    });
    assert.strictEqual(logsRes.statusCode, 200);

    const clearLogsRes = await app.inject({
      method: 'DELETE',
      url: '/api/logs',
      headers: adminHeaders,
    });
    assert.strictEqual(clearLogsRes.statusCode, 200);

    console.log('\n🎉 ALL REST API & RBAC TESTS PASSED SUCCESSFULLY!');
  } finally {
    await app.close();
    await dnsEngine.stop();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runApiTests().catch((err) => {
  console.error('❌ API Test failed:', err);
  process.exit(1);
});
