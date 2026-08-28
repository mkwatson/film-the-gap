import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoverProductEvidence } from './discovery-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('product evidence discovery client', () => {
  it('returns only a validated discovery contract', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({
          provider: 'scrapecreators',
          status: 'complete',
          query: 'Desk lamp brightness memory',
          searchedPlatforms: ['youtube'],
          warnings: [],
          leads: [
            {
              platform: 'youtube',
              title: 'Desk lamp power test',
              url: 'https://www.youtube.com/watch?v=abc123',
              summary: 'Candidate only; the video has not been reviewed against the question.',
              creatorLabel: 'YouTube · Test Lab',
            },
          ],
        }),
      ),
    );

    await expect(
      discoverProductEvidence({
        productName: 'Desk lamp',
        question: 'Does it remember brightness after losing power?',
      }),
    ).resolves.toMatchObject({ status: 'complete', leads: [{ platform: 'youtube' }] });
  });

  it('fails closed on malformed provider output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => Response.json({ leads: 'many' })),
    );

    await expect(
      discoverProductEvidence({
        productName: 'Desk lamp',
        question: 'Does it remember brightness after losing power?',
      }),
    ).rejects.toThrow();
  });
});
