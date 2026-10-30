import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { google } from '@ai-sdk/google';

export default {
  timeout: 60_000,
  agents: {
    default: {
      model: google('gemini-3.5-flash-lite'),
      system: 'You are a fast, concise QA agent.',
    },
  },
  targets: [{
    engine: web(),
    app: {
      url: process.env.APP_URL ?? 'http://localhost:3000',
    },
  }],
} satisfies E2EConfig;
