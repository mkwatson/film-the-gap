import { afterEach, describe, expect, it, vi } from 'vitest';

import { discoverCatalogProducts } from './catalog-client';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UCP catalog discovery client', () => {
  it('sends only the normalized public catalog query and validates the response', async () => {
    const fetcher = vi.fn(async (): Promise<Response> =>
      Response.json({
        provider: 'shopify_global_catalog',
        protocolVersion: '2026-04-08',
        status: 'complete',
        query: 'insulated travel bottle',
        products: [],
        warnings: [],
      }),
    );
    vi.stubGlobal('fetch', fetcher);

    await expect(
      discoverCatalogProducts({ query: '  insulated travel bottle ', country: 'us' }),
    ).resolves.toMatchObject({ status: 'complete', products: [] });

    expect(fetcher).toHaveBeenCalledWith('/api/catalog/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'insulated travel bottle', country: 'US' }),
    });
  });

  it('fails closed on malformed provider output and HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => Response.json({ products: 'many' })),
    );
    await expect(
      discoverCatalogProducts({ query: 'insulated travel bottle', country: 'US' }),
    ).rejects.toThrow();

    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> => new Response('unavailable', { status: 503 })),
    );
    await expect(
      discoverCatalogProducts({ query: 'insulated travel bottle', country: 'US' }),
    ).rejects.toThrow('HTTP 503');
  });
});
