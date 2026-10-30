import { test } from '@e2e-dev/web';
import { expect } from 'e2e';
import dgram from 'node:dgram';
import crypto from 'node:crypto';
import dnsPacket from 'dns-packet';

function sendDnsQuery(port: number, name: string): Promise<dnsPacket.Packet> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const query = dnsPacket.encode({
      type: 'query',
      id: crypto.randomInt(1, 65535),
      flags: dnsPacket.RECURSION_DESIRED,
      questions: [{ type: 'A', name }],
    });

    const timer = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error(`DNS query timed out for ${name}`));
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

test('live query logs reflect DNS traffic in real-time', async ({ app, agent, screen }) => {
  const dnsPort = process.env.DNS_PORT ? parseInt(process.env.DNS_PORT, 10) : 5353;
  const loggedDomain = `metric-${Date.now()}.local.dev`;

  // 1. Send UDP DNS query to generate traffic
  await sendDnsQuery(dnsPort, loggedDomain);

  // 2. Open dashboard and authenticate
  await app.open('/');
  await agent.act('Log in with username {username} and password {password}', {
    params: { username: 'admin', password: 'admin123' },
  });

  // 3. Navigate to Query Logs tab
  await agent.act('navigate to Query Logs tab');

  // 4. Assert the queried domain appears in the real-time activity table
  await expect(screen.getByText(loggedDomain).first()).toBeVisible();
});
