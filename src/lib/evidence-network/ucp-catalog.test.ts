import { describe, expect, it } from 'vitest';

import {
  filmTheGapUcpPlatformProfile,
  shopifyCatalogProductSchema,
  shopifyCatalogProtocolVersion,
  shopifyCatalogSearchInputSchema,
} from './ucp-catalog';

describe('UCP catalog contracts', () => {
  it('normalizes a bounded shopper search and defaults to the US catalog', () => {
    expect(shopifyCatalogSearchInputSchema.parse({ query: '  insulated travel bottle  ' })).toEqual(
      { query: 'insulated travel bottle', country: 'US' },
    );
    expect(
      shopifyCatalogSearchInputSchema.parse({
        query: 'insulated travel bottle',
        country: 'ca',
      }),
    ).toEqual({ query: 'insulated travel bottle', country: 'CA' });
  });

  it('rejects extra or private buyer fields at the public boundary', () => {
    expect(
      shopifyCatalogSearchInputSchema.safeParse({
        query: 'insulated travel bottle',
        country: 'US',
        maximumPrice: 50,
      }).success,
    ).toBe(false);
  });

  it('advertises only the mutually supported read-only catalog capabilities', () => {
    expect(filmTheGapUcpPlatformProfile.ucp.version).toBe(shopifyCatalogProtocolVersion);
    expect(Object.keys(filmTheGapUcpPlatformProfile.ucp.capabilities).sort()).toEqual([
      'dev.shopify.catalog.global',
      'dev.ucp.shopping.catalog.lookup',
      'dev.ucp.shopping.catalog.search',
    ]);
    expect(filmTheGapUcpPlatformProfile.ucp.payment_handlers).toEqual({});
  });

  it('will not expose local product targets through a catalog result', () => {
    const product = {
      productId: 'gid://shopify/p/1',
      variantId: 'gid://shopify/ProductVariant/1',
      title: 'Bottle',
      variantTitle: 'Green',
      productUrl: 'http://127.0.0.1/private',
      seller: { name: 'Merchant', domain: 'merchant.example' },
      price: { amount: 2_500, currency: 'USD' },
      condition: ['new'],
      catalogClaims: [],
    };

    expect(shopifyCatalogProductSchema.safeParse(product).success).toBe(false);
  });
});
