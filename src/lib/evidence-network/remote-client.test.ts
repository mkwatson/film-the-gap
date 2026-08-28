import { describe, expect, it, vi } from 'vitest';

import { createDemoEvidenceNetworkState } from './model';
import {
  RemoteEvidenceError,
  analyzeRemoteEvidenceVideo,
  claimPublicEvidenceMission,
  contributorPath,
  createRemoteEvidenceCase,
  listPublicEvidenceMissions,
  publishPublicEvidenceMission,
  remoteEvidenceWebSocketUrl,
  removePublicEvidenceMission,
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
      { token: 'c'.repeat(43), confirmRightsForAnalysis: true },
      evidenceFetch,
    );

    expect(result).toMatchObject({ kind: 'processing', stage: 'mp4-preparing' });
    expect(evidenceFetch).toHaveBeenCalledWith(
      'https://rooms.example/evidence-cases/BCDF2345/videos/0123456789abcdef0123456789abcdef/analysis',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'c'.repeat(43), confirmRightsForAnalysis: true }),
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

  it('publishes, lists, claims, and removes only through the board endpoints', async () => {
    const publicContributorToken = 'p'.repeat(43);
    const mission = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      caseId: 'BCDF2345',
      productName: 'Desk lamp',
      productUrl: null,
      question: 'Does it remember its brightness after losing power?',
      instruction: 'Record one complete power cycle with the brightness visible.',
      successCriterion: 'Keep the lamp and power control visible throughout.',
      minimumSeconds: 10,
      continuousTakeRequired: true,
      status: 'open',
      createdAt: '2026-08-27T16:00:00.000Z',
      expiresAt: '2026-08-28T16:00:00.000Z',
      fulfilledAt: null,
    } as const;
    const evidenceFetch = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith('/claim')) {
        return Response.json({ mission, contributorToken: publicContributorToken });
      }
      if (url.pathname.endsWith('/remove')) {
        return Response.json({ ...mission, status: 'removed' });
      }
      if (url.pathname === '/public-missions' && evidenceFetch.mock.calls.length === 2) {
        return Response.json({ missions: [mission] });
      }
      return Response.json(mission, { status: 201 });
    });

    await expect(
      publishPublicEvidenceMission(
        'https://rooms.example/path',
        {
          missionId: mission.id,
          caseId: mission.caseId,
          ownerToken: 'o'.repeat(43),
          contributorToken: 'c'.repeat(43),
          confirmPublicListing: true,
        },
        evidenceFetch,
      ),
    ).resolves.toEqual(mission);
    await expect(
      listPublicEvidenceMissions('https://rooms.example', evidenceFetch),
    ).resolves.toEqual({ missions: [mission] });
    await expect(
      claimPublicEvidenceMission('https://rooms.example', mission.id, evidenceFetch),
    ).resolves.toMatchObject({ contributorToken: publicContributorToken });
    await expect(
      removePublicEvidenceMission(
        'https://rooms.example',
        mission.id,
        { ownerToken: 'o'.repeat(43), confirmRemoval: true },
        evidenceFetch,
      ),
    ).resolves.toMatchObject({ status: 'removed' });

    expect(evidenceFetch.mock.calls.map(([input]) => new URL(String(input)).pathname)).toEqual([
      '/public-missions',
      '/public-missions',
      `/public-missions/${mission.id}/claim`,
      `/public-missions/${mission.id}/remove`,
    ]);
  });
});
