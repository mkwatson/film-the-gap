import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.evidence.jsonc' },
        miniflare: {
          bindings: {
            AI_GATEWAY_API_KEY: 'test-only-budgeted-key',
            TEST_EVIDENCE_LIBRARY_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      include: ['test/evidence-index.test.ts', 'test/evidence-library.test.ts'],
      setupFiles: ['./test/apply-evidence-library-migrations.ts'],
    },
  };
});
