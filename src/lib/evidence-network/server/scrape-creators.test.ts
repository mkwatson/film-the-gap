import { describe, expect, it, vi } from 'vitest';

import type { ProductQuestionInput } from '../model';
import { buildEvidenceSearchQuery, searchScrapeCreatorsEvidence } from './scrape-creators';

const question: ProductQuestionInput = {
  productName: 'Trail Flask 24 oz',
  question: 'Does it stay leak-free while upside down for ten seconds?',
};

function json(body: object, status = 200): Response {
  return Response.json(body, { status });
}

describe('ScrapeCreators evidence discovery', () => {
  it('builds one claim-aware query from the public product and question', () => {
    expect(buildEvidenceSearchQuery(question)).toBe(
      'Trail Flask 24 oz Does it stay leak-free while upside down for ten seconds',
    );
  });

  it('bounds multilingual queries without splitting a Unicode code point', () => {
    const query = buildEvidenceSearchQuery({
      productName: 'Portable speaker',
      question: `Does it keep playing? ${'🎵'.repeat(280)}`,
    });

    expect(query.length).toBeLessThanOrEqual(420);
    expect(query).not.toContain('\uFFFD');
    expect(query.endsWith('\uD83C')).toBe(false);
  });

  it('returns an honest unavailable result without an API key', async () => {
    const fetchImpl = vi.fn();

    await expect(
      searchScrapeCreatorsEvidence(question, { apiKey: undefined, fetchImpl }),
    ).resolves.toMatchObject({
      provider: 'scrapecreators',
      status: 'unavailable',
      leads: [],
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('searches three platforms concurrently and returns link-only candidate metadata', async () => {
    const fetchImpl = vi.fn(async (url: string): Promise<Response> => {
      if (url.includes('/tiktok/')) {
        return json({
          search_item_list: [
            {
              desc: 'Ten second upside-down Trail Flask test',
              url: 'https://www.tiktok.com/@tester/video/123?lang=en',
              author: { unique_id: 'tester' },
              is_ad: false,
            },
            {
              desc: 'Paid placement',
              url: 'https://www.tiktok.com/@ad/video/456',
              is_ad: true,
            },
          ],
        });
      }
      if (url.includes('/instagram/')) {
        return json({
          reels: [
            {
              shortcode: 'ABC123',
              caption: 'Trail Flask leak check',
              owner: { username: 'flask_owner' },
              is_paid_partnership: false,
            },
          ],
        });
      }
      return json({
        videos: [
          {
            id: 'video-id',
            url: 'https://www.youtube.com/watch?v=video-id',
            title: 'Trail Flask inversion review',
            channel: { title: 'Gear Lab' },
          },
        ],
        shorts: [
          {
            id: 'video-id',
            url: 'https://www.youtube.com/watch?v=video-id',
            title: 'Duplicate result',
          },
        ],
      });
    });

    const result = await searchScrapeCreatorsEvidence(question, {
      apiKey: 'test-key',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({
      status: 'complete',
      searchedPlatforms: ['tiktok', 'instagram', 'youtube'],
    });
    expect(result.leads).toHaveLength(3);
    expect(result.leads.map(({ platform }) => platform)).toEqual([
      'tiktok',
      'instagram',
      'youtube',
    ]);
    expect(result.leads[0]).toMatchObject({
      url: 'https://www.tiktok.com/@tester/video/123',
      creatorLabel: 'TikTok · @tester',
    });
    expect(result.leads.every(({ summary }) => summary.includes('not been reviewed'))).toBe(true);
  });

  it('keeps successful platforms when another provider endpoint fails', async () => {
    const fetchImpl = vi.fn(async (url: string): Promise<Response> =>
      url.includes('/instagram/') ? json({}, 503) : json({}),
    );

    const result = await searchScrapeCreatorsEvidence(question, {
      apiKey: 'test-key',
      fetchImpl,
    });

    expect(result.status).toBe('partial');
    expect(result.searchedPlatforms).toEqual(['tiktok', 'youtube']);
    expect(result.warnings).toEqual(['instagram search returned HTTP 503.']);
  });
});
