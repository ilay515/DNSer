import assert from 'node:assert';
import dgram from 'node:dgram';
import dnsPacket from 'dns-packet';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseService } from '../src/server/db.js';
import { DnsEngine } from '../src/server/dns-engine.js';
import { hashPassword, verifyPassword } from '../src/server/auth.js';

function queryDns(port: number, name: string, type: 'A' | 'TXT' | 'CNAME' = 'A'): Promise<dnsPacket.Packet> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const query = dnsPacket.encode({
      type: 'query',
      id: Math.floor(Math.random() * 65000),
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type, name }],
    });

    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`DNS query for ${name} timed out`));
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
  console.log('🧪 Running DNSer Tests...');
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

    // 5. Resolve wildcard record
    console.log('-> Testing wildcard query: random-sub.local.dev');
    const res2 = await queryDns(5354, 'random-sub.local.dev');
    assert.strictEqual(res2.rcode, 'NOERROR');
    assert.strictEqual(res2.answers?.length, 1);
    assert.strictEqual((res2.answers?.[0] as any).data, '127.0.0.1');

    // 6. Test NXDOMAIN
    console.log('-> Testing NXDOMAIN on nonexistent.zone');
    const res3 = await queryDns(5354, 'nonexistent.zone');
    assert.strictEqual(res3.rcode, 'NXDOMAIN');

    // 7. Dynamic record creation & lookup
    console.log('-> Testing dynamic domain & record addition');
    const newDomain = db.createDomain('custom-dev.test', 'Test domain', users[0].id);
    db.createRecord({
      domain_id: newDomain.id,
      name: 'service.custom-dev.test',
      type: 'A',
      value: '192.168.1.100',
      ttl: 120,
    });
    dnsEngine.refreshRecords();

    const res4 = await queryDns(5354, 'service.custom-dev.test');
    assert.strictEqual(res4.rcode, 'NOERROR');
    assert.strictEqual((res4.answers?.[0] as any).data, '192.168.1.100');

    // 8. Wait for query log flush and check logs
    console.log('-> Testing query logging buffer');
    await new Promise((r) => setTimeout(r, 2200));
    const logs = db.getLogs({ limit: 10 });
    assert.strictEqual(logs.total >= 3, true);
    console.log(`✅ Logged ${logs.total} queries successfully.`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
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
