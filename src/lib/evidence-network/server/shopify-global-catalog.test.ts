import { describe, expect, it, vi } from 'vitest';

import {
  shopifyCatalogDevelopmentProfile,
  shopifyGlobalCatalogEndpoint,
  type ShopifyCatalogSearchInput,
} from '../ucp-catalog';
import { searchShopifyGlobalCatalog, type ShopifyCatalogFetcher } from './shopify-global-catalog';

const input: ShopifyCatalogSearchInput = {
  query: 'plain insulated travel bottle',
  country: 'US',
};

function catalogResponse(products: readonly unknown[]): Response {
  return Response.json({
    jsonrpc: '2.0',
    id: 1,
    result: {
      structuredContent: {
        ucp: {
          version: '2026-04-08',
          status: 'success',
          capabilities: {
            'dev.ucp.shopping.catalog.search': [{ version: '2026-04-08' }],
            'dev.ucp.shopping.catalog.lookup': [{ version: '2026-04-08' }],
            'dev.shopify.catalog.global': [{ version: '2026-04-08' }],
          },
        },
        products,
      },
    },
  });
}

const validProduct = {
  id: 'gid://shopify/p/product-1',
  title: 'Everyday insulated travel bottle',
  description: {
    plain: '  Keeps drinks cold and resists spills.  ',
    html: '<strong>Ignored</strong>',
  },
  metadata: {
    unique_selling_points: ['Leak-resistant lid.'],
    top_features: 'Double-wall insulation.\nLeak-resistant lid.',
  },
  media: [{ type: 'image', url: 'https://cdn.example/bottle.jpg' }],
  variants: [
    {
      id: 'gid://shopify/ProductVariant/variant-1',
      title: 'Bottle · Forest green',
      url: 'https://merchant.example/products/bottle?variant=1&_gsid=secret&utm_source=shopify#buy',
      checkout_url: 'https://merchant.example/cart/1:1?token=not-returned',
      price: { amount: 4_499, currency: 'USD' },
      condition: ['new'],
      seller: {
        name: 'Example merchant',
        domain: 'merchant.example',
        url: 'https://merchant.example',
      },
    },
  ],
};

describe('Shopify Global Catalog over UCP', () => {
  it('sends the exact bounded UCP request and maps catalog context without treating it as proof', async () => {
    const fetcher = vi.fn<ShopifyCatalogFetcher>(async () =>
      catalogResponse([validProduct, { malformed: true }]),
    );

    const result = await searchShopifyGlobalCatalog(input, {
      agentProfileUrl: shopifyCatalogDevelopmentProfile,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledOnce();
    const [endpoint, init] = fetcher.mock.calls[0] ?? [];
    expect(endpoint).toBe(shopifyGlobalCatalogEndpoint);
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as unknown;
    expect(body).toEqual({
      jsonrpc: '2.0',
      method: 'tools/call',
      id: 1,
      params: {
        name: 'search_catalog',
        arguments: {
          meta: { 'ucp-agent': { profile: shopifyCatalogDevelopmentProfile } },
          catalog: {
            query: input.query,
            context: { address_country: 'US' },
            pagination: { limit: 4 },
          },
        },
      },
    });
    expect(result).toMatchObject({
      status: 'complete',
      protocolVersion: '2026-04-08',
      warnings: [],
      products: [
        {
          productId: 'gid://shopify/p/product-1',
          variantId: 'gid://shopify/ProductVariant/variant-1',
          productUrl: 'https://merchant.example/products/bottle?variant=1',
          condition: ['new'],
          price: { amount: 4_499, currency: 'USD' },
        },
      ],
    });
    expect(result.products[0]?.catalogClaims).toEqual([
      {
        text: 'Keeps drinks cold and resists spills.',
        provenance: 'shopify_inferred',
        evidenceStatus: 'unverified_catalog_context',
      },
      {
        text: 'Leak-resistant lid.',
        provenance: 'shopify_inferred',
        evidenceStatus: 'unverified_catalog_context',
      },
      {
        text: 'Double-wall insulation.',
        provenance: 'shopify_inferred',
        evidenceStatus: 'unverified_catalog_context',
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('checkout_url');
    expect(JSON.stringify(result)).not.toContain('not-returned');
    expect(JSON.stringify(result)).not.toContain('<strong>');
  });

  it('does not call Shopify without a public HTTPS agent profile', async () => {
    const fetcher = vi.fn<ShopifyCatalogFetcher>();

    await expect(
      searchShopifyGlobalCatalog(input, {
        agentProfileUrl: 'http://127.0.0.1/agent-profile',
        fetcher,
      }),
    ).resolves.toMatchObject({
      status: 'unavailable',
      products: [],
      warnings: [expect.stringContaining('valid public agent profile')],
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fails honestly on protocol drift, missing negotiation, and provider errors', async () => {
    const wrongVersion = await searchShopifyGlobalCatalog(input, {
      agentProfileUrl: shopifyCatalogDevelopmentProfile,
      fetcher: async () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: {
            structuredContent: {
              ucp: { version: '2026-08-25', status: 'success', capabilities: {} },
              products: [],
            },
          },
        }),
    });
    expect(wrongVersion).toMatchObject({ status: 'unavailable', products: [] });

    const missingCapability = await searchShopifyGlobalCatalog(input, {
      agentProfileUrl: shopifyCatalogDevelopmentProfile,
      fetcher: async () =>
        Response.json({
          jsonrpc: '2.0',
          id: 1,
          result: {
            structuredContent: {
              ucp: {
                version: '2026-04-08',
                status: 'success',
                capabilities: {
                  'dev.ucp.shopping.catalog.search': [{ version: '2026-04-08' }],
                },
              },
              products: [],
            },
          },
        }),
    });
    expect(missingCapability).toMatchObject({ status: 'unavailable', products: [] });

    const providerError = await searchShopifyGlobalCatalog(input, {
      agentProfileUrl: shopifyCatalogDevelopmentProfile,
      fetcher: async () => new Response('rate limited', { status: 429 }),
    });
    expect(providerError).toMatchObject({
      status: 'unavailable',
      warnings: [expect.stringContaining('temporarily unavailable')],
    });
  });

  it('rejects non-JSON and oversized responses before parsing them', async () => {
    const nonJson = await searchShopifyGlobalCatalog(input, {
      agentProfileUrl: shopifyCatalogDevelopmentProfile,
      fetcher: async () => new Response('<html>error</html>', { status: 200 }),
    });
    expect(nonJson.status).toBe('unavailable');

    const oversized = await searchShopifyGlobalCatalog(input, {
      agentProfileUrl: shopifyCatalogDevelopmentProfile,
      fetcher: async () =>
        new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Content-Length': '600000' },
        }),
    });
    expect(oversized.status).toBe('unavailable');
  });

  it('propagates caller cancellation instead of converting it into provider failure', async () => {
    const controller = new AbortController();
    const cancellation = new Error('caller cancelled');
    controller.abort(cancellation);

    await expect(
      searchShopifyGlobalCatalog(
        input,
        {
          agentProfileUrl: shopifyCatalogDevelopmentProfile,
          fetcher: async (_input, init) => {
            if (init?.signal?.aborted === true) {
              throw init.signal.reason;
            }
            return catalogResponse([]);
          },
        },
        controller.signal,
      ),
    ).rejects.toBe(cancellation);
  });
});
