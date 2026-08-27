// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { merchantServerName, merchantServerVersion } from '../merchant-worker/src/protocol.ts';
import { remoteRoomProtocolVersion } from '../src/lib/live-market/remote-room-protocol.ts';
import { ucpProtocolVersion, ucpShoppingServiceName } from '../src/lib/ucp/profile.ts';
import {
  readReleaseConfig,
  sanitizeReleaseFailure,
  verifyPublicRelease,
  type ReleaseConfig,
  type ReleaseFetch,
} from './release-preflight.ts';

const commit = 'a'.repeat(40);
const roomToken = 'R'.repeat(43);
const hostToken = 'H'.repeat(43);

const config: ReleaseConfig = {
  appOrigin: 'https://app.example',
  roomOrigin: 'https://rooms.example',
  merchantOrigin: 'https://merchant.example',
  expectedCommit: commit,
  timeoutMs: 5_000,
};

function json(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function page(marker: string): Response {
  return new Response(`<!doctype html><title>${marker}</title><main>${marker}</main>`, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; script-src 'nonce-test'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function ucpProfile(endpoint?: string): object {
  return {
    ucp: {
      version: ucpProtocolVersion,
      services: {
        [ucpShoppingServiceName]: [
          {
            version: ucpProtocolVersion,
            transport: 'mcp',
            ...(endpoint === undefined ? {} : { endpoint }),
          },
        ],
      },
      capabilities: {},
    },
  };
}

function releaseFetch(workerTag = commit): ReleaseFetch {
  return async (input, init): Promise<Response> => {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
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
        protocolVersion: remoteRoomProtocolVersion,
        ucpCommerceConfigured: true,
        workerVersion: { id: 'room-version', tag: workerTag, timestamp: '2026-08-27T12:00:00Z' },
      });
    }
    if (url.href === `${config.merchantOrigin}/health`) {
      return json({
        ok: true,
        service: merchantServerName,
        version: merchantServerVersion,
        workerVersion: {
          id: 'merchant-version',
          tag: workerTag,
          timestamp: '2026-08-27T12:00:00Z',
        },
      });
    }
    if (url.href === `${config.appOrigin}/.well-known/ucp`) {
      return json(ucpProfile());
    }
    if (url.href === `${config.merchantOrigin}/.well-known/ucp`) {
      return json(ucpProfile(`${config.merchantOrigin}/api/ucp/mcp`));
    }
    if (url.href === `${config.appOrigin}/`) {
      return page('Agent-attended market');
    }
    if (url.href === `${config.appOrigin}/host`) {
      return page('Host evidence console');
    }
    if (url.href === `${config.merchantOrigin}/products/live-inspected-board`) {
      return page('Evidence Market');
    }
    if (url.href === `${config.roomOrigin}/rooms` && method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': config.appOrigin,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          Vary: 'Origin',
        },
      });
    }
    if (url.href === `${config.roomOrigin}/rooms` && method === 'POST') {
      return json(
        {
          protocolVersion: remoteRoomProtocolVersion,
          roomId: 'ABC234',
          buyerToken: roomToken,
          hostToken,
          expiresAt: Date.now() + 60_000,
        },
        201,
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
      EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: config.merchantOrigin,
      EVIDENCE_RELEASE_COMMIT_SHA: commit.toUpperCase(),
      EVIDENCE_RELEASE_TIMEOUT_MS: '9000',
    });
    expect(parsed).toEqual({ ...config, timeoutMs: 9_000 });

    expect(() =>
      readReleaseConfig({
        EVIDENCE_ACCEPTANCE_APP_URL: 'http://app.example',
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: config.roomOrigin,
        EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: config.merchantOrigin,
        EVIDENCE_RELEASE_COMMIT_SHA: commit,
      }),
    ).toThrow(/HTTPS origin/i);
    expect(() =>
      readReleaseConfig({
        EVIDENCE_ACCEPTANCE_APP_URL: config.appOrigin,
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: config.appOrigin,
        EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: config.merchantOrigin,
        EVIDENCE_RELEASE_COMMIT_SHA: commit,
      }),
    ).toThrow(/distinct/i);
  });

  it('verifies the public release without retaining disposable room credentials', async () => {
    const report = await verifyPublicRelease(config, releaseFetch());
    const serialized = JSON.stringify(report);

    expect(report).toMatchObject({
      ok: true,
      commit,
      workerVersions: {
        room: { id: 'room-version', tag: commit },
        merchant: { id: 'merchant-version', tag: commit },
      },
    });
    expect(report.steps.map((step) => step.name)).toEqual([
      'app health and commit',
      'room health and commit',
      'merchant health and commit',
      'UCP discovery alignment',
      'judge pages and merchant policy',
      'room browser boundary',
    ]);
    expect(serialized).not.toContain(roomToken);
    expect(serialized).not.toContain(hostToken);
  });

  it('fails closed when a worker is not the reviewed commit', async () => {
    await expect(verifyPublicRelease(config, releaseFetch('b'.repeat(40)))).rejects.toThrow(
      /worker tag does not match commit/i,
    );
  });

  it('suppresses origins and credential-shaped strings from failures', () => {
    expect(
      sanitizeReleaseFailure(
        new Error(`failed https://rooms.example/private with token ${roomToken}`),
      ),
    ).toBe('failed [origin suppressed] with token [credential suppressed]');
  });
});
