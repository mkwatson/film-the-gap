import { describe, expect, it, vi } from 'vitest';

import type {
  EvidenceDiscoveryInput,
  EvidenceDiscoveryProvider,
  ProductQuestionInput,
  ReusableEvidenceRecord,
} from '../model';
import type { KnownPageReadResponse } from '../known-page-reader';
import { searchPublicProductEvidence, type EvidenceDiscoveryCache } from './public-evidence-search';

const question: ProductQuestionInput = {
  productName: 'Trail Flask 24 oz',
  productUrl: 'https://shop.example/products/trail-flask?utm_source=shopper#details',
  question: 'Does it stay leak-free while upside down for ten seconds?',
};

const reusableRecord: ReusableEvidenceRecord = {
  id: 'prior-case:networkvideo00000001',
  productName: question.productName,
  productUrl: 'https://shop.example/products/trail-flask',
  question: question.question,
  source: {
    title: 'Contributor-recorded mission video',
    videoUrl: 'https://customer-demo.cloudflarestream.com/networkvideo00000001/watch',
    rights: 'owned',
    provenance: 'live_capture',
    continuity: 'continuous',
    captureTiming: 'mission_challenge_verified',
    contributorLabel: 'Product owner',
    capturedAt: '2026-08-27T19:00:00.000Z',
    streamUid: 'networkvideo00000001',
    sha256: 'a'.repeat(64),
    durationSeconds: 12,
  },
  observation: {
    result: 'supports',
    confidence: 'high',
    text: 'No liquid reached the paper during the continuous inversion.',
    citationStartSeconds: 1,
    citationEndSeconds: 11,
    reviewedAt: '2026-08-27T19:01:00.000Z',
  },
  indexedAt: '2026-08-27T19:01:00.000Z',
  expiresAt: '2026-09-26T19:01:00.000Z',
};

function discovery(
  provider: EvidenceDiscoveryProvider,
  input: Partial<EvidenceDiscoveryInput>,
): EvidenceDiscoveryInput {
  return {
    provider,
    status: 'complete',
    query: 'Trail Flask leak-free upside down ten seconds',
    searchedPlatforms: [],
    warnings: [],
    leads: [],
    ...input,
  };
}

function pageRead(url: string): KnownPageReadResponse {
  return {
    reader: 'cloudflare_browser_run',
    status: 'complete',
    requestedUrl: url,
    finalUrl: url,
    title: 'Trail Flask 24 oz',
    excerpt: 'The product page claims a leak-resistant lid.',
    contentSignal: 'ai-train=no, search=yes, ai-input=yes',
    browserMilliseconds: 824,
  };
}

function recordingCache(): {
  readonly cache: EvidenceDiscoveryCache;
  readonly get: ReturnType<typeof vi.fn<EvidenceDiscoveryCache['get']>>;
  readonly set: ReturnType<typeof vi.fn<EvidenceDiscoveryCache['set']>>;
} {
  let stored: unknown = null;
  const get = vi.fn<EvidenceDiscoveryCache['get']>(async () => stored);
  const set = vi.fn<EvidenceDiscoveryCache['set']>(async (_key, value) => {
    stored = value;
  });
  return { cache: { get, set }, get, set };
}

describe('public product evidence orchestration', () => {
  it('merges a supplied page, direct social search, and broad web search without duplicates', async () => {
    const result = await searchPublicProductEvidence(question, {
      scrapeCreatorsApiKey: 'social-key',
      gatewayApiKey: 'gateway-key',
      readKnownPage: async (url) => pageRead(url),
      searchSocial: async () =>
        discovery('scrapecreators', {
          searchedPlatforms: ['tiktok', 'instagram', 'youtube'],
          leads: [
            {
              platform: 'youtube',
              title: 'Trail Flask inversion test',
              url: 'https://www.youtube.com/watch?v=abc123',
              summary: 'Candidate only; this video has not been reviewed.',
              creatorLabel: 'YouTube · Test Lab',
            },
          ],
        }),
      searchWeb: async () =>
        discovery('vercel_ai_gateway', {
          searchedPlatforms: ['web'],
          leads: [
            {
              platform: 'web',
              title: 'Duplicate supplied page',
              url: 'https://shop.example/products/trail-flask',
              summary: 'Search excerpt only.',
              creatorLabel: 'Open web · Exa via Vercel AI Gateway',
            },
            {
              platform: 'web',
              title: 'Independent review',
              url: 'https://review.example/trail-flask',
              summary: 'Candidate review; not claim-reviewed.',
              creatorLabel: 'Open web · Exa via Vercel AI Gateway',
            },
          ],
        }),
    });

    expect(result).toMatchObject({
      provider: 'evidence_network',
      status: 'complete',
      searchedPlatforms: ['web', 'tiktok', 'instagram', 'youtube'],
    });
    expect(result.leads.map(({ url }) => url)).toEqual([
      'https://shop.example/products/trail-flask?utm_source=shopper#details',
      'https://www.youtube.com/watch?v=abc123',
      'https://review.example/trail-flask',
    ]);
    expect(result.leads[0]).toMatchObject({
      platform: 'web',
      creatorLabel: 'Product page · Cloudflare Browser Run',
      summary: expect.stringContaining('never proof'),
    });
  });

  it('uses Vercel Runtime Cache receipts for repeated configured searches', async () => {
    const { cache, get, set } = recordingCache();
    const searchSocial = vi.fn(async () =>
      discovery('scrapecreators', { searchedPlatforms: ['youtube'] }),
    );
    const searchWeb = vi.fn(async () =>
      discovery('vercel_ai_gateway', { searchedPlatforms: ['web'] }),
    );
    const readKnownPage = vi.fn(async (url: string) => pageRead(url));
    const dependencies = {
      scrapeCreatorsApiKey: 'social-key',
      gatewayApiKey: 'gateway-key',
      cache,
      searchSocial,
      searchWeb,
      readKnownPage,
    } as const;

    const first = await searchPublicProductEvidence(question, dependencies);
    const second = await searchPublicProductEvidence(question, dependencies);

    expect(second).toEqual(first);
    expect(get).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.stringMatching(/^search:[a-f0-9]{64}$/),
      expect.not.objectContaining({ reviewedEvidence: expect.anything() }),
      expect.objectContaining({ ttl: 900, tags: ['product-evidence-discovery'] }),
    );
    expect(searchSocial).toHaveBeenCalledTimes(1);
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(readKnownPage).toHaveBeenCalledTimes(1);
  });

  it('checks reusable evidence fresh even when public discovery comes from cache', async () => {
    const { cache } = recordingCache();
    const searchSocial = vi.fn(async () =>
      discovery('scrapecreators', { searchedPlatforms: ['youtube'] }),
    );
    const searchWeb = vi.fn(async () =>
      discovery('vercel_ai_gateway', { searchedPlatforms: ['web'] }),
    );
    const readKnownPage = vi.fn(async (url: string) => pageRead(url));
    const searchNetwork = vi
      .fn()
      .mockResolvedValueOnce({ status: 'complete', records: [], warnings: [] })
      .mockResolvedValueOnce({ status: 'complete', records: [reusableRecord], warnings: [] });
    const dependencies = {
      scrapeCreatorsApiKey: 'social-key',
      gatewayApiKey: 'gateway-key',
      cache,
      searchSocial,
      searchWeb,
      readKnownPage,
      searchNetwork,
    } as const;

    const before = await searchPublicProductEvidence(question, dependencies);
    const after = await searchPublicProductEvidence(question, dependencies);

    expect(before.reviewedEvidence).toEqual([]);
    expect(after.reviewedEvidence).toEqual([reusableRecord]);
    expect(after.leads).toEqual([]);
    expect(searchNetwork).toHaveBeenCalledTimes(2);
    expect(searchSocial).toHaveBeenCalledTimes(1);
    expect(searchWeb).toHaveBeenCalledTimes(1);
    expect(readKnownPage).toHaveBeenCalledTimes(1);
  });

  it('does not cache transient partial provider failures', async () => {
    const { cache, set } = recordingCache();
    const result = await searchPublicProductEvidence(question, {
      scrapeCreatorsApiKey: 'social-key',
      gatewayApiKey: 'gateway-key',
      cache,
      readKnownPage: async (url) => pageRead(url),
      searchSocial: async () => discovery('scrapecreators', { searchedPlatforms: ['youtube'] }),
      searchWeb: async () =>
        discovery('vercel_ai_gateway', {
          status: 'unavailable',
          warnings: ['Gateway timeout.'],
        }),
    });

    expect(result).toMatchObject({ status: 'partial', warnings: ['Gateway timeout.'] });
    expect(set).not.toHaveBeenCalled();
  });

  it('keeps the supplied page as an unreviewed lead when all live providers are absent', async () => {
    const result = await searchPublicProductEvidence(question, {
      scrapeCreatorsApiKey: undefined,
      gatewayApiKey: undefined,
    });

    expect(result).toMatchObject({
      provider: 'evidence_network',
      status: 'partial',
      searchedPlatforms: [],
      leads: [
        expect.objectContaining({
          url: 'https://shop.example/products/trail-flask?utm_source=shopper#details',
          summary: expect.stringContaining('not treated as proof'),
        }),
      ],
    });
    expect(result.warnings).toEqual([
      'Live product-page reading is not configured on this deployment.',
      'Live social search is not configured on this deployment.',
      'Broad web search through Vercel AI Gateway is not configured.',
    ]);
  });

  it('is honestly unavailable when no source or provider is available', async () => {
    const result = await searchPublicProductEvidence(
      {
        productName: question.productName,
        question: question.question,
      },
      {
        scrapeCreatorsApiKey: undefined,
        gatewayApiKey: undefined,
      },
    );

    expect(result).toMatchObject({
      provider: 'evidence_network',
      status: 'unavailable',
      searchedPlatforms: [],
      leads: [],
    });
  });
});
