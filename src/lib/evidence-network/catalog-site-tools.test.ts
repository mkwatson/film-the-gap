import { describe, expect, it, vi } from 'vitest';

import {
  catalogSearchSnapshot,
  createCatalogSiteTools,
  getCatalogToolNames,
  type CatalogSiteToolRuntime,
} from './catalog-site-tools';
import { createEmptyEvidenceNetworkState, type EvidenceNetworkTransition } from './model';
import type { ShopifyCatalogSearchResponse } from './ucp-catalog';

const catalogResult: ShopifyCatalogSearchResponse = {
  provider: 'shopify_global_catalog',
  protocolVersion: '2026-04-08',
  status: 'complete',
  query: 'insulated travel bottle',
  products: [
    {
      productId: 'gid://shopify/p/bottle',
      variantId: 'gid://shopify/ProductVariant/green',
      title: 'Everyday insulated bottle',
      variantTitle: 'Forest green',
      productUrl: 'https://merchant.example/products/bottle?variant=green',
      seller: { name: 'Example merchant', domain: 'merchant.example' },
      price: { amount: 4_499, currency: 'USD' },
      condition: ['new'],
      catalogClaims: [
        {
          text: 'Leak-resistant lid.',
          provenance: 'shopify_inferred',
          evidenceStatus: 'unverified_catalog_context',
        },
      ],
    },
  ],
  warnings: [],
};

function successfulTransition(): EvidenceNetworkTransition {
  return {
    ok: true,
    state: { ...createEmptyEvidenceNetworkState(), revision: 1 },
    message: 'Product question opened. Private shopping context was not collected.',
  };
}

function runtime(result: ShopifyCatalogSearchResponse | null): CatalogSiteToolRuntime {
  return {
    readResult: () => result,
    search: vi.fn(async () => catalogResult),
    openQuestion: vi.fn(async () => successfulTransition()),
  };
}

function tool(value: CatalogSiteToolRuntime, name: string): WebMCP.ModelContextTool {
  const match = createCatalogSiteTools(value).find((candidate) => candidate.name === name);
  if (match === undefined) {
    throw new Error(`Expected ${name}.`);
  }
  return match;
}

describe('UCP catalog Site Tools', () => {
  it('exposes selection only when a current result exists', () => {
    expect(getCatalogToolNames(null)).toEqual(['search_product_catalog']);
    expect(getCatalogToolNames(catalogResult)).toEqual([
      'search_product_catalog',
      'open_catalog_product_question',
    ]);
  });

  it('searches with only the bounded public query and returns a compact honesty receipt', async () => {
    const value = runtime(null);
    const signal = new AbortController().signal;
    const output = await tool(value, 'search_product_catalog').execute(
      { query: '  insulated travel bottle ', country: 'us' },
      { signal },
    );

    expect(value.search).toHaveBeenCalledWith(
      { query: 'insulated travel bottle', country: 'US' },
      signal,
    );
    expect(output).toMatchObject({
      ok: true,
      protocol: 'UCP 2026-04-08',
      privacyReceipt: { sent: 'catalog query and country only' },
      products: [{ variantId: 'gid://shopify/ProductVariant/green' }],
    });
    expect(JSON.stringify(output).length).toBeLessThan(1_500);
  });

  it('opens the exact current product without transmitting catalog copy as evidence', async () => {
    const value = runtime(catalogResult);
    const output = await tool(value, 'open_catalog_product_question').execute(
      {
        variantId: 'gid://shopify/ProductVariant/green',
        question: 'Does it stay leak-free upside down for ten seconds?',
      },
      { signal: new AbortController().signal },
    );

    expect(value.openQuestion).toHaveBeenCalledWith({
      productName: 'Everyday insulated bottle · Forest green',
      productUrl: 'https://merchant.example/products/bottle?variant=green',
      question: 'Does it stay leak-free upside down for ten seconds?',
    });
    expect(output).toMatchObject({
      ok: true,
      selected: { productId: 'gid://shopify/p/bottle' },
      privateShopperContext: 'not collected or transmitted',
    });
    expect(JSON.stringify(output)).not.toContain('Leak-resistant lid');
  });

  it('rejects stale variants and unexpected private fields', async () => {
    const value = runtime(catalogResult);
    await expect(
      tool(value, 'open_catalog_product_question').execute(
        {
          variantId: 'gid://shopify/ProductVariant/old',
          question: 'Does it stay leak-free upside down for ten seconds?',
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({ error: 'stale_catalog_selection' });

    await expect(
      tool(value, 'search_product_catalog').execute(
        {
          query: 'insulated travel bottle',
          country: 'US',
          maximumBudget: 50,
        },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({ error: 'invalid_input' });
    expect(value.search).not.toHaveBeenCalled();
  });

  it('keeps snapshots compact even when provider text is long', () => {
    const longResult: ShopifyCatalogSearchResponse = {
      ...catalogResult,
      products: Array.from({ length: 4 }, (_, index) => ({
        ...catalogResult.products[0]!,
        productId: `gid://shopify/p/${index}`,
        variantId: `gid://shopify/ProductVariant/${index}`,
        catalogClaims: [
          {
            text: 'A'.repeat(360),
            provenance: 'shopify_inferred' as const,
            evidenceStatus: 'unverified_catalog_context' as const,
          },
        ],
      })),
    };
    const output = catalogSearchSnapshot(longResult);
    expect(JSON.stringify(output).length).toBeLessThan(1_500);
    expect(output).toMatchObject({ moreVisibleOnPage: true });
  });
});
