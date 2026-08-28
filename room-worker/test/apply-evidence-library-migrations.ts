import { env } from 'cloudflare:workers';
import { applyD1Migrations, type D1Migration } from 'cloudflare:test';

interface EvidenceLibraryTestEnv {
  readonly EVIDENCE_LIBRARY: D1Database;
  readonly TEST_EVIDENCE_LIBRARY_MIGRATIONS: readonly D1Migration[];
}

const testEnv = env as unknown as EvidenceLibraryTestEnv;

await applyD1Migrations(testEnv.EVIDENCE_LIBRARY, [...testEnv.TEST_EVIDENCE_LIBRARY_MIGRATIONS]);
