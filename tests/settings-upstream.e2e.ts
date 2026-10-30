import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

test('navigate to settings and update daemon configuration using natural language agent', async ({ app, agent, screen }) => {
  // 1. Open app
  await app.open('/');

  // 2. Authenticate
  await agent.act('Log in with username {username} and password {password}', {
    params: { username: 'admin', password: 'admin123' },
  });

  // 3. Navigate to Settings tab
  await agent.act('navigate to Settings tab');

  // 4. Update the log retention limit and save
  await agent.act('change Log Retention Limit to {retention} and tap Save Settings', {
    params: { retention: '7500' },
  });

  // 5. Assert success notification is shown
  await expect(screen.getByText('Settings saved')).toBeVisible();
});
