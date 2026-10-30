import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('use the interactive test resolver in the dashboard', async ({ app, agent, screen }) => {
  // 1. Open app
  await app.open('/');

  // 2. Authenticate
  await agent.act('Log in with username {username} and password {password}', {
    params: { username: 'admin', password: 'admin123' },
  });

  // 3. Resolve the default local.dev host via the in-browser widget
  await agent.act('in Test Resolver section, type {domain} into domain input and tap Resolve', {
    params: { domain: 'local.dev' },
  });

  // 4. Assert NOERROR badge and answer are displayed
  await expect(screen.getByText('NOERROR')).toBeVisible();
  await expect(screen.getByText('A 127.0.0.1').first()).toBeVisible();
});
