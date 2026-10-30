import assert from 'node:assert';
import dgram from 'node:dgram';
import dnsPacket from 'dns-packet';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseService } from '../src/server/db.js';
import { DnsEngine } from '../src/server/dns-engine.js';
import { hashPassword, verifyPassword } from '../src/server/auth.js';

function queryDns(port: number, name: string, type: 'A' | 'AAAA' | 'TXT' | 'MX' | 'CNAME' = 'A'): Promise<dnsPacket.Packet> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const query = dnsPacket.encode({
      type: 'query',
      id: Math.floor(Math.random() * 65000),
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: type as any, name }],
    });

    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`DNS query for ${name} [${type}] timed out`));
    }, 2000);

    socket.on('message', (msg) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(dnsPacket.decode(msg));
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      try { socket.close(); } catch {}
      reject(err);
    });

    socket.send(query, 0, query.length, port, '127.0.0.1');
  });
}

async function runTests() {
  console.log('🧪 Running DNSer Engine Tests...');
  const testDbPath = path.join(process.cwd(), 'data', 'test-dns.db');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // 1. Auth test
  console.log('-> Testing Password Hashing & Verification');
  const hash = hashPassword('secret123');
  assert.strictEqual(verifyPassword('secret123', hash), true);
  assert.strictEqual(verifyPassword('wrong', hash), false);

  // 2. DB Init
  console.log('-> Testing Database Initialization & Defaults');
  const db = new DatabaseService(testDbPath);
  const users = db.listUsers();
  assert.strictEqual(users.length >= 1, true);
  assert.strictEqual(users[0].username, 'admin');

  const domains = db.listDomains();
  assert.strictEqual(domains.length >= 1, true);
  assert.strictEqual(domains[0].name, 'local.dev');

  // 3. DNS Engine start
  console.log('-> Testing DNS Engine on port 5354');
  const dnsEngine = new DnsEngine(db, 5354, '127.0.0.1');
  await dnsEngine.start();

  try {
    // 4. Resolve default A record
    console.log('-> Testing query: local.dev');
    const res1 = await queryDns(5354, 'local.dev');
    assert.strictEqual(res1.rcode, 'NOERROR');
    assert.strictEqual(res1.answers?.length, 1);
    assert.strictEqual((res1.answers?.[0] as any).data, '127.0.0.1');

    // 5. Case-insensitivity & trailing dot
    console.log('-> Testing case-insensitivity & trailing dot: LoCaL.DeV.');
    const resCase = await queryDns(5354, 'LoCaL.DeV.');
    assert.strictEqual(resCase.rcode, 'NOERROR');
    assert.strictEqual((resCase.answers?.[0] as any).data, '127.0.0.1');

    // 6. Resolve wildcard record
    console.log('-> Testing wildcard query: random-sub.local.dev');
    const res2 = await queryDns(5354, 'random-sub.local.dev');
    assert.strictEqual(res2.rcode, 'NOERROR');
    assert.strictEqual(res2.answers?.length, 1);
    assert.strictEqual((res2.answers?.[0] as any).data, '127.0.0.1');

    // 7. Test NXDOMAIN
    console.log('-> Testing NXDOMAIN on nonexistent.zone');
    const res3 = await queryDns(5354, 'nonexistent.zone');
    assert.strictEqual(res3.rcode, 'NXDOMAIN');

    // 8. Dynamic records: AAAA, TXT, MX, CNAME
    console.log('-> Testing dynamic AAAA, TXT, MX, and CNAME records');
    const newDomain = db.createDomain('custom-dev.test', 'Test domain', users[0].id);

    // AAAA IPv6
    db.createRecord({
      domain_id: newDomain.id,
      name: 'ipv6.custom-dev.test',
      type: 'AAAA',
      value: '::1',
      ttl: 60,
    });

    // TXT
    db.createRecord({
      domain_id: newDomain.id,
      name: 'verify.custom-dev.test',
      type: 'TXT',
      value: 'dev-token-abc123xyz',
      ttl: 60,
    });

    // MX
    db.createRecord({
      domain_id: newDomain.id,
      name: 'mail.custom-dev.test',
      type: 'MX',
      value: 'mailhost.local',
      ttl: 60,
      priority: 5,
    });

    // CNAME
    db.createRecord({
      domain_id: newDomain.id,
      name: 'alias.custom-dev.test',
      type: 'CNAME',
      value: 'target.custom-dev.test',
      ttl: 60,
    });

    dnsEngine.refreshRecords();

    // Query AAAA
    const aaaaRes = await queryDns(5354, 'ipv6.custom-dev.test', 'AAAA');
    assert.strictEqual(aaaaRes.rcode, 'NOERROR');
    assert.strictEqual((aaaaRes.answers?.[0] as any).data, '::1');

    // Query TXT
    const txtRes = await queryDns(5354, 'verify.custom-dev.test', 'TXT');
    assert.strictEqual(txtRes.rcode, 'NOERROR');
    const txtData = (txtRes.answers?.[0] as any).data;
    const txtStrings = (Array.isArray(txtData) ? txtData : [txtData]).map((b: any) => Buffer.isBuffer(b) ? b.toString() : String(b));
    assert.ok(txtStrings.includes('dev-token-abc123xyz'));

    // Query MX
    const mxRes = await queryDns(5354, 'mail.custom-dev.test', 'MX');
    assert.strictEqual(mxRes.rcode, 'NOERROR');
    assert.strictEqual((mxRes.answers?.[0] as any).data.exchange, 'mailhost.local');
    assert.strictEqual((mxRes.answers?.[0] as any).data.preference, 5);

    // Query CNAME
    const cnameRes = await queryDns(5354, 'alias.custom-dev.test', 'CNAME');
    assert.strictEqual(cnameRes.rcode, 'NOERROR');
    assert.strictEqual((cnameRes.answers?.[0] as any).data, 'target.custom-dev.test');

    // 9. Paused/Disabled Record (is_active: 0)
    console.log('-> Testing paused record (is_active: 0)');
    const pausedRec = db.createRecord({
      domain_id: newDomain.id,
      name: 'paused.custom-dev.test',
      type: 'A',
      value: '1.2.3.4',
      is_active: 0,
    });
    dnsEngine.refreshRecords();

    const pausedRes = await queryDns(5354, 'paused.custom-dev.test');
    assert.strictEqual(pausedRes.rcode, 'NXDOMAIN');

    // 10. Domain Cascade Delete
    console.log('-> Testing domain cascade deletion');
    db.deleteDomain(newDomain.id);
    dnsEngine.refreshRecords();
    const afterDeleteRes = await queryDns(5354, 'ipv6.custom-dev.test', 'AAAA');
    assert.strictEqual(afterDeleteRes.rcode, 'NXDOMAIN');

    // 11. Wait for query log flush and check logs
    console.log('-> Testing query logging buffer');
    await new Promise((r) => setTimeout(r, 2200));
    const logs = db.getLogs({ limit: 20 });
    assert.strictEqual(logs.total >= 6, true);
    console.log(`✅ Logged ${logs.total} queries successfully.`);

    console.log('\n🎉 ALL DNS ENGINE TESTS PASSED SUCCESSFULLY!');
  } finally {
    await dnsEngine.stop();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
