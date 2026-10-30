import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('create a new authoritative domain zone using natural language agent', async ({ app, agent, screen }) => {
  const dynamicZone = `test-zone-${Date.now()}.dev`;

  // 1. Open app
  await app.open('/');

  // 2. Authenticate
  await agent.act('Log in with username {username} and password {password}', {
    params: { username: 'admin', password: 'admin123' },
  });

  // 3. Navigate to Zones tab
  await agent.act('navigate to Domains & Records tab');

  // 4. Open Zone modal and create zone
  await agent.act('click Zone button to open create zone dialog, enter {zone} as zone name and submit', {
    params: { zone: dynamicZone },
  });

  // 5. Verify the new zone appears in the zones list and is active
  await agent.assert(`the zone ${dynamicZone} is displayed in the view`);
});
