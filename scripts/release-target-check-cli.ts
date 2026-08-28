import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import { verifyReleaseTarget } from './release-target-guard.ts';

function environmentValue(key: string): string {
  return process.env[key] ?? '';
}

function git(...args: readonly string[]): string {
  return execFileSync('git', [...args], { encoding: 'utf8' }).trim();
}

try {
  const [vercelProjectLinkText, workerConfigText] = await Promise.all([
    readFile('.vercel/project.json', 'utf8'),
    readFile('room-worker/wrangler.evidence.jsonc', 'utf8'),
  ]);
  const report = verifyReleaseTarget({
    expectedVercelScope: environmentValue('WEBMCP_VERCEL_SCOPE'),
    expectedVercelProject: environmentValue('WEBMCP_VERCEL_PROJECT'),
    appOrigin: environmentValue('WEBMCP_APP_ORIGIN'),
    roomOrigin: environmentValue('WEBMCP_ROOM_ORIGIN'),
    expectedCommit: environmentValue('WEBMCP_RELEASE_COMMIT_SHA'),
    actualCommit: git('rev-parse', 'HEAD'),
    gitStatus: git('status', '--porcelain'),
    vercelProjectLink: JSON.parse(vercelProjectLinkText) as unknown,
    workerConfigText,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown release target error.';
  process.stderr.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
  process.exitCode = 1;
}
