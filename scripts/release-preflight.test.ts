// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  buildEvidenceCaseHandoffPath,
  evidenceCaseHandoffSource,
  evidenceCaseHandoffVersion,
} from '../src/lib/evidence-network/case-handoff.ts';
import { demoProduct } from '../src/lib/evidence-network/demo-product.ts';
import { createDemoEvidenceNetworkState } from '../src/lib/evidence-network/model.ts';
import {
  maximumUploadsPerEvidenceCase,
  remoteEvidenceProtocolVersion,
} from '../src/lib/evidence-network/remote-protocol.ts';
import {
  filmTheGapUcpPlatformProfile,
  shopifyCatalogProtocolVersion,
} from '../src/lib/evidence-network/ucp-catalog.ts';
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
const demoProductCasePath = buildEvidenceCaseHandoffPath({
  version: evidenceCaseHandoffVersion,
  source: evidenceCaseHandoffSource,
  question: {
    productName: demoProduct.name,
    productUrl: `${config.appOrigin}${demoProduct.path}`,
    question: demoProduct.question,
  },
});

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
  readonly allowMicrophone: boolean;
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
  readonly catalogAvailable?: boolean;
  readonly catalogHasProducts?: boolean;
  readonly catalogProtocolVersion?: string;
  readonly workerTag?: string;
  readonly publicEvidenceOrigin?: string;
  readonly contributorCameraAllowed?: boolean;
  readonly contributorMicrophoneAllowed?: boolean;
  readonly globalRateLimitConfigured?: boolean;
  readonly missionBoundCapture?: boolean;
  readonly reusableIndexAvailable?: boolean;
  readonly demoProductContentSignal?: string;
  readonly productCaseStreamPlaybackAllowed?: boolean;
  readonly ucpProfile?: unknown;
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
    if (url.href === `${config.appOrigin}/ucp/agent-profile`) {
      return json(options.ucpProfile ?? filmTheGapUcpPlatformProfile, 200, {
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
        'X-Content-Type-Options': 'nosniff',
      });
    }
    if (url.href === `${config.appOrigin}/api/catalog/search` && method === 'POST') {
      const products =
        options.catalogHasProducts === false
          ? []
          : [
              {
                productId: 'gid://shopify/Product/123',
                variantId: 'gid://shopify/ProductVariant/456',
                title: 'Plain stainless insulated bottle',
                variantTitle: '32 ounce',
                productUrl: 'https://merchant.example/products/plain-bottle',
                seller: { name: 'Example merchant', domain: 'merchant.example' },
                price: { amount: 4_500, currency: 'USD' },
                condition: ['new'],
                catalogClaims: [
                  {
                    text: 'Leak-resistant lid',
                    provenance: 'shopify_inferred',
                    evidenceStatus: 'unverified_catalog_context',
                  },
                ],
              },
            ];
      return json({
        provider: 'shopify_global_catalog',
        protocolVersion: options.catalogProtocolVersion ?? shopifyCatalogProtocolVersion,
        status: options.catalogAvailable === false ? 'unavailable' : 'complete',
        query: 'plain stainless insulated bottle',
        products,
        warnings: options.catalogAvailable === false ? ['Catalog unavailable.'] : [],
      });
    }
    if (url.href === `${config.roomOrigin}/healthz`) {
      return json({
        ok: true,
        service: 'webmcp-product-evidence',
        protocolVersion: remoteEvidenceProtocolVersion,
        publicEvidenceOrigin: options.publicEvidenceOrigin ?? config.roomOrigin,
        abuseControls: {
          perClientCaseCreation: true,
          globalCaseCreation: options.globalRateLimitConfigured ?? true,
          maximumUploadsPerEvidenceCase,
        },
        evidenceServices: {
          stream: true,
          signedStreamPlayback: true,
          streamPlaybackDailyTokenLimit: 60,
          videoAnalysis: true,
          missionBoundCapture: options.missionBoundCapture ?? true,
          reusableEvidence: true,
          reusableEvidenceRetentionDays: 30,
          expiredEvidencePurge: 'daily',
          publicMissionBoard: true,
          publicMissionRetentionHours: 24,
          productPageReader: true,
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
        allowMicrophone: false,
        allowCreatorUpload: false,
        allowStreamPlayback: true,
      });
    }
    if (url.href === `${config.appOrigin}/demo-product`) {
      const response = appPage('Everyday insulated travel bottle', {
        allowCamera: false,
        allowMicrophone: false,
        allowCreatorUpload: false,
        allowStreamPlayback: false,
      });
      response.headers.set(
        'Content-Signal',
        options.demoProductContentSignal ?? 'search=yes, ai-input=yes, ai-train=no',
      );
      return response;
    }
    if (url.href === `${config.appOrigin}${demoProductCasePath}`) {
      return appPage(demoProduct.question, {
        allowCamera: false,
        allowMicrophone: false,
        allowCreatorUpload: false,
        allowStreamPlayback: options.productCaseStreamPlaybackAllowed ?? true,
      });
    }
    if (url.href === `${config.appOrigin}/missions`) {
      return appPage('Turn unanswered product questions into tiny public filming jobs.', {
        allowCamera: false,
        allowMicrophone: false,
        allowCreatorUpload: false,
        allowStreamPlayback: false,
      });
    }
    if (url.href === `${config.appOrigin}/contribute/${caseId}`) {
      return appPage('Film the Gap', {
        allowCamera: options.contributorCameraAllowed ?? true,
        allowMicrophone: options.contributorMicrophoneAllowed ?? true,
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
      'UCP profile and live catalog discovery',
      'evidence service health, commit, and cost controls',
      'reusable evidence index',
      'public filming mission board',
      'buyer, product handoff, mission board, and contributor pages',
      'evidence service browser boundary and durable case',
    ]);
    expect(serialized).not.toContain(ownerToken);
    expect(serialized).not.toContain(contributorToken);
  });

  it('fails closed when the deployed UCP profile differs from the reviewed contract', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ ucpProfile: { ucp: { version: 'unknown' } } })),
    ).rejects.toThrow(/UCP agent profile.*unexpected capability contract/i);
  });

  it('fails closed when live UCP catalog discovery is unavailable or empty', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ catalogAvailable: false })),
    ).rejects.toThrow(/catalog unavailable or empty/i);
    await expect(
      verifyPublicRelease(config, releaseFetch({ catalogHasProducts: false })),
    ).rejects.toThrow(/catalog unavailable or empty/i);
  });

  it('fails closed when live catalog discovery negotiates an unexpected UCP version', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ catalogProtocolVersion: '2026-08-25' })),
    ).rejects.toThrow(/invalid response contract/i);
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

  it('fails closed when signed playback points at a different Worker origin', async () => {
    await expect(
      verifyPublicRelease(
        config,
        releaseFetch({ publicEvidenceOrigin: 'https://different.example' }),
      ),
    ).rejects.toThrow(/signed playback origin does not match/i);
  });

  it('fails closed when mission-bound capture is not deployed', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ missionBoundCapture: false })),
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

  it('fails closed when the owned demo page does not publish its reviewed Content Signal', async () => {
    await expect(
      verifyPublicRelease(
        config,
        releaseFetch({ demoProductContentSignal: 'search=no, ai-input=no, ai-train=no' }),
      ),
    ).rejects.toThrow(/demo product page.*Content-Signal mismatch/i);
  });

  it('fails closed when the strict handoff page cannot render reviewed evidence', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ productCaseStreamPlaybackAllowed: false })),
    ).rejects.toThrow(/product evidence handoff page.*Content-Security-Policy mismatch/i);
  });

  it('fails closed when the contributor page cannot record a spoken mission phrase', async () => {
    await expect(
      verifyPublicRelease(config, releaseFetch({ contributorMicrophoneAllowed: false })),
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
