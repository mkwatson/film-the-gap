import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  globalIgnores([
    '.vercel/**',
    '.next/**',
    'coverage/**',
    'node_modules/**',
    'out/**',
    'room-worker/dist/**',
    'room-worker/.wrangler/**',
    'room-worker/test/fixtures/.wrangler/**',
    'tmp/**',
    'next-env.d.ts',
  ]),
]);
