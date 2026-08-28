import { describe, expect, it, vi } from 'vitest';

import type {
  EvidenceDiscoveryInput,
  EvidenceDiscoveryProvider,
  ProductQuestionInput,
} from '../model';
import { searchPublicProductEvidence, type EvidenceDiscoveryCache } from './public-evidence-search';

const question: ProductQuestionInput = {
  productName: 'Trail Flask 24 oz',
  productUrl: 'https://shop.example/products/trail-flask?utm_source=shopper#details',
  question: 'Does it stay leak-free while upside down for ten seconds?',
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
      searchedPlatforms: ['tiktok', 'instagram', 'youtube', 'web'],
    });
    expect(result.leads.map(({ url }) => url)).toEqual([
      'https://shop.example/products/trail-flask?utm_source=shopper#details',
      'https://www.youtube.com/watch?v=abc123',
      'https://review.example/trail-flask',
    ]);
    expect(result.leads[0]).toMatchObject({
      platform: 'web',
      creatorLabel: 'Supplied page · shop.example',
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
    const dependencies = {
      scrapeCreatorsApiKey: 'social-key',
      gatewayApiKey: 'gateway-key',
      cache,
      searchSocial,
      searchWeb,
    } as const;

    const first = await searchPublicProductEvidence(question, dependencies);
    const second = await searchPublicProductEvidence(question, dependencies);

    expect(second).toEqual(first);
    expect(get).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.stringMatching(/^search:[a-f0-9]{64}$/),
      first,
      expect.objectContaining({ ttl: 900, tags: ['product-evidence-discovery'] }),
    );
    expect(searchSocial).toHaveBeenCalledTimes(1);
    expect(searchWeb).toHaveBeenCalledTimes(1);
  });

  it('does not cache transient partial provider failures', async () => {
    const { cache, set } = recordingCache();
    const result = await searchPublicProductEvidence(question, {
      scrapeCreatorsApiKey: 'social-key',
      gatewayApiKey: 'gateway-key',
      cache,
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
    expect(result.warnings).toHaveLength(2);
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
