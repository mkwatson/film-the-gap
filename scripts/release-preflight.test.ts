// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createDemoEvidenceNetworkState } from '../src/lib/evidence-network/model.ts';
import {
  maximumUploadsPerEvidenceCase,
  remoteEvidenceProtocolVersion,
} from '../src/lib/evidence-network/remote-protocol.ts';
import { buildAppSecurityHeaders } from '../src/lib/security-headers.ts';
import {
  readReleaseConfig,
  sanitizeReleaseFailure,
  verifyPublicRelease,
  type ReleaseConfig,
  type ReleaseFetch,
} from './release-preflight.ts';

const commit = 'a'.repeat(40);
const caseId = 'BCDF2345';
const ownerToken = 'O'.repeat(43);
const contributorToken = 'C'.repeat(43);
const expiresAt = Date.now() + 60_000;
const state = createDemoEvidenceNetworkState();

const config: ReleaseConfig = {
  appOrigin: 'https://app.example',
  roomOrigin: 'https://evidence.example',
  expectedCommit: commit,
  timeoutMs: 5_000,
};

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function page(marker: string, headers: HeadersInit): Response {
  return new Response(`<!doctype html><title>${marker}</title><main>${marker}</main>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers },
  });
}

interface AppPageOptions {
  readonly allowCamera: boolean;
  readonly allowCreatorUpload: boolean;
  readonly allowStreamPlayback: boolean;
}

function appPage(marker: string, options: AppPageOptions): Response {
  return page(
    marker,
    Object.fromEntries(
      buildAppSecurityHeaders({
        ...options,
        development: false,
        evidenceRoomUrl: config.roomOrigin,
      }).map(({ key, value }) => [key, value]),
    ),
  );
}

interface ReleaseFetchOptions {
  readonly workerTag?: string;
  readonly contributorCameraAllowed?: boolean;
  readonly globalRateLimitConfigured?: boolean;
  readonly reusableIndexAvailable?: boolean;
}

function releaseFetch(options: ReleaseFetchOptions = {}): ReleaseFetch {
  const workerTag = options.workerTag ?? commit;
  return async (input, init): Promise<Response> => {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
    const origin = new Headers(init?.headers).get('Origin');
    if (url.href === `${config.appOrigin}/api/health`) {
      return json({
        ok: true,
        service: 'webmcp-challenge-app',
        commit,
        evidenceRoomOrigin: config.roomOrigin,
        evidenceRoomConfigured: true,
      });
    }
    if (url.href === `${config.roomOrigin}/healthz`) {
      return json({
        ok: true,
        service: 'webmcp-product-evidence',
        protocolVersion: remoteEvidenceProtocolVersion,
        abuseControls: {
          perClientCaseCreation: true,
          globalCaseCreation: options.globalRateLimitConfigured ?? true,
          maximumUploadsPerEvidenceCase,
        },
        evidenceServices: {
          stream: true,
          videoAnalysis: true,
          reusableEvidence: true,
          reusableEvidenceRetentionDays: 30,
          expiredEvidencePurge: 'daily',
          publicMissionBoard: true,
          publicMissionRetentionHours: 24,
        },
        workerVersion: { id: 'room-version', tag: workerTag, timestamp: '2026-08-27T12:00:00Z' },
      });
    }
    if (url.href === `${config.roomOrigin}/evidence-library/search` && method === 'POST') {
      return json(
        {
          status: options.reusableIndexAvailable === false ? 'unavailable' : 'complete',
          records: [],
          warnings: options.reusableIndexAvailable === false ? ['D1 migration unavailable.'] : [],
        },
        200,
        { 'Access-Control-Allow-Origin': config.appOrigin },
      );
    }
    if (url.href === `${config.roomOrigin}/public-missions` && method === 'GET') {
      return json({ missions: [] }, 200, { 'Access-Control-Allow-Origin': config.appOrigin });
    }
    if (url.href === `${config.appOrigin}/`) {
      return appPage('If the web cannot prove it, ask someone with the product to film it.', {
        allowCamera: false,
        allowCreatorUpload: false,
        allowStreamPlayback: true,
      });
    }
    if (url.href === `${config.appOrigin}/missions`) {
      return appPage('Turn unanswered product questions into tiny public filming jobs.', {
        allowCamera: false,
        allowCreatorUpload: false,
        allowStreamPlayback: false,
      });
    }
    if (url.href === `${config.appOrigin}/contribute/${caseId}`) {
      return appPage('Product evidence network', {
        allowCamera: options.contributorCameraAllowed ?? true,
        allowCreatorUpload: true,
        allowStreamPlayback: true,
      });
    }
    if (url.href === `${config.roomOrigin}/evidence-cases` && method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': config.appOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          Vary: 'Origin',
        },
      });
    }
    if (
      url.href === `${config.roomOrigin}/evidence-cases` &&
      method === 'POST' &&
      origin === 'https://untrusted.invalid'
    ) {
      return json({ error: 'origin_not_allowed' }, 403);
    }
    if (url.href === `${config.roomOrigin}/evidence-cases` && method === 'POST') {
      return json(
        {
          protocolVersion: remoteEvidenceProtocolVersion,
          caseId,
          ownerToken,
          contributorToken,
          expiresAt,
          state,
        },
        201,
        { 'Access-Control-Allow-Origin': config.appOrigin },
      );
    }
    if (url.href === `${config.roomOrigin}/evidence-cases/${caseId}/snapshot`) {
      return json(
        {
          protocolVersion: remoteEvidenceProtocolVersion,
          caseId,
          expiresAt,
          state,
          lastMessage: 'Shared evidence case created.',
        },
        200,
        { 'Access-Control-Allow-Origin': config.appOrigin },
      );
    }
    return json({ error: 'not_found' }, 404);
  };
}

describe('public release preflight', () => {
  it('requires distinct, credential-free HTTPS origins and an exact commit', () => {
    const parsed = readReleaseConfig({
      EVIDENCE_ACCEPTANCE_APP_URL: `${config.appOrigin}/`,
      EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: config.roomOrigin,
      EVIDENCE_RELEASE_COMMIT_SHA: commit.toUpperCase(),
      EVIDENCE_RELEASE_TIMEOUT_MS: '9000',
    });
    expect(parsed).toEqual({ ...config, timeoutMs: 9_000 });

    expect(() =>
      readReleaseConfig({
        EVIDENCE_ACCEPTANCE_APP_URL: 'http://app.example',
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: config.roomOrigin,
        EVIDENCE_RELEASE_COMMIT_SHA: commit,
      }),
    ).toThrow(/HTTPS origin/i);
    expect(() =>
      readReleaseConfig({
        EVIDENCE_ACCEPTANCE_APP_URL: config.appOrigin,
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: config.appOrigin,
        EVIDENCE_RELEASE_COMMIT_SHA: commit,
      }),
    ).toThrow(/distinct/i);
  });

  it('verifies the flagship release without retaining disposable capabilities', async () => {
    const report = await verifyPublicRelease(config, releaseFetch());
    const serialized = JSON.stringify(report);

    expect(report).toMatchObject({
      ok: true,
      commit,
      workerVersion: { id: 'room-version', tag: commit },
    });
    expect(report.steps.map((step) => step.name)).toEqual([
      'app health and commit',
      'evidence service health, commit, and cost controls',
      'reusable evidence index',
      'public filming mission board',
      'buyer, mission board, and contributor pages',
      'evidence service browser boundary and durable case',
    ]);
    expect(serialized).not.toContain(ownerToken);
    expect(serialized).not.toContain(contributorToken);
  });

  it('fails closed when the evidence service is not the reviewed commit', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ workerTag: 'b'.repeat(40) })),
    ).rejects.toThrow(/worker tag does not match commit/i);
  });

  it('fails closed when a required public rate limit is absent', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ globalRateLimitConfigured: false })),
    ).rejects.toThrow(/invalid response contract/i);
  });

  it('fails closed when the reusable evidence schema is unavailable', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ reusableIndexAvailable: false })),
    ).rejects.toThrow(/D1 schema or binding unavailable/i);
  });

  it('fails closed when the contributor page cannot request its camera', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ contributorCameraAllowed: false })),
    ).rejects.toThrow(/contributor page.*Permissions-Policy mismatch/i);
  });

  it('suppresses origins and credential-shaped strings from failures', () => {
    expect(
      sanitizeReleaseFailure(
        new Error(`failed https://evidence.example/private with token ${ownerToken}`),
      ),
    ).toBe('failed [origin suppressed] with token [credential suppressed]');
  });
});
