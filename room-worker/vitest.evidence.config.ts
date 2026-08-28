import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.evidence.jsonc' },
      miniflare: {
        bindings: { AI_GATEWAY_API_KEY: 'test-only-budgeted-key' },
      },
    }),
  ],
  test: {
    include: ['test/evidence-index.test.ts'],
  },
});
