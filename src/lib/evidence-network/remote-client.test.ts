import { describe, expect, it, vi } from 'vitest';

import { createDemoEvidenceNetworkState } from './model';
import {
  RemoteEvidenceError,
  analyzeRemoteEvidenceVideo,
  contributorPath,
  createRemoteEvidenceCase,
  remoteEvidenceWebSocketUrl,
  uploadEvidenceVideo,
} from './remote-client';

describe('remote evidence client', () => {
  it('creates a case and keeps contributor authority in a URL fragment', async () => {
    const evidenceFetch = vi.fn(async (): Promise<Response> =>
      Response.json(
        {
          protocolVersion: '1',
          caseId: 'BCDF2345',
          ownerToken: 'o'.repeat(43),
          contributorToken: 'c'.repeat(43),
          expiresAt: Date.now() + 60_000,
          state: createDemoEvidenceNetworkState(),
        },
        { status: 201 },
      ),
    );
    const credentials = await createRemoteEvidenceCase(
      'https://rooms.example/path',
      { seed: 'travel_bottle' },
      evidenceFetch,
    );

    expect(credentials.caseId).toBe('BCDF2345');
    expect(evidenceFetch).toHaveBeenCalledWith(
      'https://rooms.example/evidence-cases',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(contributorPath(credentials.caseId, credentials.contributorToken)).toBe(
      `/contribute/BCDF2345#token=${credentials.contributorToken}`,
    );
    expect(remoteEvidenceWebSocketUrl('https://rooms.example', credentials.caseId)).toBe(
      'wss://rooms.example/evidence-cases/BCDF2345/ws',
    );
  });

  it('refuses to send a selected video to any non-Stream destination', async () => {
    const file = new File(['video'], 'proof.mp4', { type: 'video/mp4' });
    await expect(uploadEvidenceVideo('https://uploads.example/proof', file)).rejects.toThrow(
      'outside Cloudflare Stream',
    );
  });

  it('requests analysis only for one reserved upload and parses processing state', async () => {
    const evidenceFetch = vi.fn(async (): Promise<Response> =>
      Response.json(
        {
          kind: 'processing',
          uploadId: '0123456789abcdef0123456789abcdef',
          stage: 'mp4-preparing',
          message: 'Preparing the exact uploaded clip.',
        },
        { status: 202 },
      ),
    );

    const result = await analyzeRemoteEvidenceVideo(
      'https://rooms.example/path',
      'BCDF2345',
      '0123456789abcdef0123456789abcdef',
      { token: 'c'.repeat(43) },
      evidenceFetch,
    );

    expect(result).toMatchObject({ kind: 'processing', stage: 'mp4-preparing' });
    expect(evidenceFetch).toHaveBeenCalledWith(
      'https://rooms.example/evidence-cases/BCDF2345/videos/0123456789abcdef0123456789abcdef/analysis',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'c'.repeat(43) }),
      }),
    );
  });

  it('preserves structured remote errors for useful recovery', async () => {
    const evidenceFetch = vi.fn(async (): Promise<Response> =>
      Response.json({ error: 'origin_not_allowed' }, { status: 403 }),
    );

    await expect(
      createRemoteEvidenceCase('https://rooms.example', { seed: 'travel_bottle' }, evidenceFetch),
    ).rejects.toMatchObject({
      status: 403,
      code: 'origin_not_allowed',
    } satisfies Partial<RemoteEvidenceError>);
  });
});
