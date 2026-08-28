// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { verifyReleaseTarget, type ReleaseTargetGuardInput } from './release-target-guard.ts';

const commit = 'a'.repeat(40);
const d1DatabaseId = '12345678-1234-4567-89ab-1234567890ab';

function workerConfig(
  databaseId = d1DatabaseId,
  previewDatabaseId = databaseId,
  publicEvidenceOrigin = 'https://webmcp-product-evidence.example.workers.dev',
): string {
  return `{
    "name": "webmcp-product-evidence",
    "vars": {"PUBLIC_EVIDENCE_ORIGIN": "${publicEvidenceOrigin}"},
    "limits": {"cpu_ms": 100},
    "d1_databases": [{
      "database_id": "${databaseId}",
      "preview_database_id": "${previewDatabaseId}"
    }]
  }`;
}

function guardInput(overrides: Partial<ReleaseTargetGuardInput> = {}): ReleaseTargetGuardInput {
  return {
    expectedVercelScope: 'standalone-team',
    expectedVercelProject: 'film-the-gap',
    appOrigin: 'https://film-the-gap.vercel.app',
    roomOrigin: 'https://webmcp-product-evidence.example.workers.dev',
    expectedCommit: commit,
    actualCommit: commit,
    gitStatus: '',
    vercelProjectLink: {
      orgId: 'team_opaque',
      projectId: 'prj_opaque',
      projectName: 'film-the-gap',
    },
    workerConfigText: workerConfig(),
    ...overrides,
  };
}

describe('release target guard', () => {
  it('reports only the reviewed standalone targets and no opaque account identifiers', () => {
    const report = verifyReleaseTarget(guardInput());
    const serialized = JSON.stringify(report);

    expect(report).toEqual({
      ok: true,
      commit,
      vercel: {
        scope: 'standalone-team',
        project: 'film-the-gap',
        appOrigin: 'https://film-the-gap.vercel.app',
      },
      cloudflare: {
        worker: 'webmcp-product-evidence',
        roomOrigin: 'https://webmcp-product-evidence.example.workers.dev',
        d1Configured: true,
        signedPlaybackOriginConfigured: true,
        cpuLimitMilliseconds: 100,
      },
    });
    expect(serialized).not.toContain('team_opaque');
    expect(serialized).not.toContain('prj_opaque');
    expect(serialized).not.toContain(d1DatabaseId);
  });

  it('rejects the retired Vercel project even when the local link matches it', () => {
    expect(() =>
      verifyReleaseTarget(
        guardInput({
          expectedVercelProject: 'webmcp-evidence-market',
          vercelProjectLink: {
            orgId: 'team_opaque',
            projectId: 'prj_opaque',
            projectName: 'webmcp-evidence-market',
          },
        }),
      ),
    ).toThrow(/new standalone release project/i);
  });

  it('rejects a mismatched link, commit, or dirty worktree', () => {
    expect(() =>
      verifyReleaseTarget(
        guardInput({
          vercelProjectLink: {
            orgId: 'team_opaque',
            projectId: 'prj_opaque',
            projectName: 'different-project',
          },
        }),
      ),
    ).toThrow(/links different-project/i);
    expect(() => verifyReleaseTarget(guardInput({ expectedCommit: 'b'.repeat(40) }))).toThrow(
      /does not match/i,
    );
    expect(() => verifyReleaseTarget(guardInput({ gitStatus: ' M README.md' }))).toThrow(
      /must be clean/i,
    );
  });

  it('rejects placeholder, malformed, and mismatched D1 identifiers', () => {
    expect(() =>
      verifyReleaseTarget(
        guardInput({
          workerConfigText: workerConfig('00000000-0000-0000-0000-000000000000'),
        }),
      ),
    ).toThrow(/non-placeholder D1 database UUID/i);
    expect(() =>
      verifyReleaseTarget(guardInput({ workerConfigText: workerConfig('not-a-uuid') })),
    ).toThrow(/non-placeholder D1 database UUID/i);
    expect(() =>
      verifyReleaseTarget(
        guardInput({
          workerConfigText: workerConfig(d1DatabaseId, 'abcdefab-cdef-4abc-8def-abcdefabcdef'),
        }),
      ),
    ).toThrow(/same dedicated D1 database/i);
  });

  it('rejects a missing or loosened Worker CPU ceiling', () => {
    expect(() =>
      verifyReleaseTarget(
        guardInput({ workerConfigText: workerConfig().replace('"cpu_ms": 100', '"cpu_ms": 101') }),
      ),
    ).toThrow(/100 ms CPU ceiling/i);
    expect(() =>
      verifyReleaseTarget(
        guardInput({ workerConfigText: workerConfig().replace('"limits": {"cpu_ms": 100},', '') }),
      ),
    ).toThrow(/declare numeric cpu_ms/i);
  });

  it('rejects credentialed, path-bearing, shared, or branded origins', () => {
    expect(() =>
      verifyReleaseTarget(guardInput({ appOrigin: 'https://user:pass@app.example' })),
    ).toThrow(/credential-free HTTPS origin/i);
    expect(() =>
      verifyReleaseTarget(guardInput({ roomOrigin: 'https://worker.example/private' })),
    ).toThrow(/credential-free HTTPS origin/i);
    expect(() =>
      verifyReleaseTarget(
        guardInput({
          appOrigin: 'https://same.example',
          roomOrigin: 'https://same.example',
        }),
      ),
    ).toThrow(/must be distinct/i);
    expect(() =>
      verifyReleaseTarget(guardInput({ appOrigin: 'https://vidably-demo.example' })),
    ).toThrow(/unrelated Vidably branding/i);
    expect(() =>
      verifyReleaseTarget(
        guardInput({
          workerConfigText: workerConfig(d1DatabaseId, d1DatabaseId, 'https://wrong.example'),
        }),
      ),
    ).toThrow(/PUBLIC_EVIDENCE_ORIGIN.*match WEBMCP_ROOM_ORIGIN/i);
  });
});
