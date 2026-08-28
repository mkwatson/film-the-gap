import { describe, expect, it, vi } from 'vitest';

import type { ProductQuestionInput } from '../model';
import { searchGatewayWebEvidence, type GatewaySearchRunner } from './gateway-web-search';
import { buildEvidenceSearchQuery } from './scrape-creators';

const question: ProductQuestionInput = {
  productName: 'Trail Flask 24 oz',
  productUrl: 'https://shop.example/products/trail-flask',
  question: 'Does it stay leak-free while upside down for ten seconds?',
};

describe('Vercel AI Gateway web evidence discovery', () => {
  it('makes no model or search call without an API key or Vercel OIDC', async () => {
    const runSearch = vi.fn<GatewaySearchRunner>();

    await expect(
      searchGatewayWebEvidence(question, { apiKey: undefined, runSearch }),
    ).resolves.toMatchObject({
      provider: 'vercel_ai_gateway',
      status: 'unavailable',
      searchedPlatforms: [],
      leads: [],
    });
    expect(runSearch).not.toHaveBeenCalled();
  });

  it('uses the bounded search path with Vercel OIDC and no stored key', async () => {
    const query = buildEvidenceSearchQuery(question);
    const runSearch = vi.fn<GatewaySearchRunner>(async () => ({
      input: { query },
      output: { requestId: 'exa-oidc-request', results: [] },
    }));

    await expect(
      searchGatewayWebEvidence(question, {
        apiKey: undefined,
        oidcAvailable: true,
        runSearch,
      }),
    ).resolves.toMatchObject({
      provider: 'vercel_ai_gateway',
      status: 'complete',
      searchedPlatforms: ['web'],
    });
    expect(runSearch).toHaveBeenCalledWith(query, expect.any(AbortSignal));
  });

  it('maps bounded Exa receipts into deduplicated link-only web leads', async () => {
    const query = buildEvidenceSearchQuery(question);
    const runSearch = vi.fn<GatewaySearchRunner>(async () => ({
      input: { query },
      output: {
        requestId: 'exa-request-1',
        results: [
          {
            title: 'Independent Trail Flask leak test',
            url: 'https://reviews.example/trail-flask?utm_source=test#result',
            highlights: ['The reviewer inverted the filled bottle over a towel for ten seconds.'],
          },
          {
            title: 'Duplicate canonical result',
            url: 'https://reviews.example/trail-flask',
            summary: 'Duplicate result.',
          },
          {
            title: 'Social result belongs to direct discovery',
            url: 'https://www.youtube.com/watch?v=abc123',
          },
          {
            title: 'Unsafe scheme',
            url: 'javascript:alert(1)',
          },
          {
            title: 'Local network target',
            url: 'http://127.0.0.1/private-product',
          },
        ],
      },
    }));

    const result = await searchGatewayWebEvidence(question, {
      apiKey: 'budgeted-test-key',
      runSearch,
    });

    expect(runSearch).toHaveBeenCalledWith(query, expect.any(AbortSignal));
    expect(result).toMatchObject({
      provider: 'vercel_ai_gateway',
      status: 'complete',
      searchedPlatforms: ['web'],
    });
    expect(result.leads).toEqual([
      expect.objectContaining({
        platform: 'web',
        url: 'https://reviews.example/trail-flask',
        creatorLabel: 'Open web · Exa via Vercel AI Gateway',
      }),
    ]);
    expect(result.leads[0]?.summary).toContain('Candidate only');
  });

  it('rejects results when the model does not preserve the exact bounded query', async () => {
    const runSearch = vi.fn<GatewaySearchRunner>(async () => ({
      input: { query: 'different query selected by model' },
      output: { requestId: 'exa-request-2', results: [] },
    }));

    await expect(
      searchGatewayWebEvidence(question, {
        apiKey: 'budgeted-test-key',
        runSearch,
      }),
    ).resolves.toMatchObject({
      status: 'unavailable',
      leads: [],
      warnings: [expect.stringContaining('exact bounded query')],
    });
  });

  it('fails closed on malformed and provider-error receipts', async () => {
    const malformed = await searchGatewayWebEvidence(question, {
      apiKey: 'budgeted-test-key',
      runSearch: async (query) => ({ input: { query }, output: { results: 'many' } }),
    });
    expect(malformed).toMatchObject({
      status: 'unavailable',
      warnings: [expect.stringContaining('invalid Exa search receipt')],
    });

    const providerError = await searchGatewayWebEvidence(question, {
      apiKey: 'budgeted-test-key',
      runSearch: async (query) => ({
        input: { query },
        output: { error: 'rate_limit', message: 'Try again later.' },
      }),
    });
    expect(providerError).toMatchObject({
      status: 'unavailable',
      warnings: ['Broad web search failed: Try again later.'],
    });
  });

  it('turns transport failures into an honest retryable result', async () => {
    const result = await searchGatewayWebEvidence(question, {
      apiKey: 'budgeted-test-key',
      runSearch: async () => {
        throw new Error('offline');
      },
    });

    expect(result).toMatchObject({
      status: 'unavailable',
      leads: [],
      warnings: [expect.stringContaining('temporarily unreachable')],
    });
  });
});
