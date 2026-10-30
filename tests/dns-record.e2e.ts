import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import dnsPacket from 'dns-packet';

function queryDns(port: number, name: string, type: 'A' | 'AAAA' | 'TXT' | 'CNAME' = 'A', timeoutMs = 2500): Promise<dnsPacket.Packet> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const query = dnsPacket.encode({
      type: 'query',
      id: crypto.randomInt(1, 65535),
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: type as any, name }],
    });

    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`DNS query for ${name} timed out on port ${port}`));
    }, timeoutMs);

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

test('dynamically configure DNS record with e2e agent and verify via DNS UDP query', async ({ app, agent, screen }) => {
  const dynamicDomain = `tester-army-${Date.now()}.local.dev`;
  const dynamicIp = '127.0.0.1';

  // 1. Open DNSer Web App
  await app.open('/');

  // 2. Log in using agent.act
  await agent.act('Log in with username {username} and password {password}', {
    params: { username: 'admin', password: 'admin123' },
  });

  // 3. Configure DNS record dynamically in Quick Route
  await agent.act('under Quick Route, type {domain} into the input and tap Add Route', {
    params: { domain: dynamicDomain },
  });

  // 4. Verify on-screen confirmation
  await expect(screen.getByText(new RegExp(dynamicDomain))).toBeVisible();

  // 5. Query the DNS Server over UDP to ensure resolution is active
  const dnsPort = process.env.DNS_PORT ? parseInt(process.env.DNS_PORT, 10) : 5353;
  const packet = await queryDns(dnsPort, dynamicDomain, 'A');

  expect(packet.rcode).toBe('NOERROR');
  expect(packet.answers).toBeDefined();
  expect(packet.answers?.length).toBeGreaterThanOrEqual(1);
  const firstAnswer = packet.answers?.[0] as any;
  expect(firstAnswer.data).toBe(dynamicIp);
});
