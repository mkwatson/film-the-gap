import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ShopifyCatalogSearchResponse } from '@/lib/evidence-network/ucp-catalog';

import { formatCatalogPrice, ProductCatalogDiscovery } from './product-catalog-discovery';

const result: ShopifyCatalogSearchResponse = {
  provider: 'shopify_global_catalog',
  protocolVersion: '2026-04-08',
  status: 'complete',
  query: 'insulated bottle',
  products: [
    {
      productId: 'gid://shopify/p/bottle',
      variantId: 'gid://shopify/ProductVariant/green',
      title: 'Everyday insulated bottle',
      variantTitle: 'Forest green',
      productUrl: 'https://merchant.example/products/bottle',
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

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ProductCatalogDiscovery>> = {},
) {
  const props: React.ComponentProps<typeof ProductCatalogDiscovery> = {
    country: 'US',
    error: null,
    evidenceQuestion: '',
    phase: 'idle',
    query: 'insulated bottle',
    result: null,
    onCountryChange: vi.fn(),
    onEvidenceQuestionChange: vi.fn(),
    onOpenQuestion: vi.fn(),
    onQueryChange: vi.fn(),
    onSearch: vi.fn(),
    ...overrides,
  };
  render(<ProductCatalogDiscovery {...props} />);
  return props;
}

describe('ProductCatalogDiscovery', () => {
  it('makes the no-partner UCP path and privacy boundary obvious before search', () => {
    renderPanel();
    expect(screen.getByText('No store integration required')).toBeTruthy();
    expect(screen.getByText(/Sent to the catalog: this query and country only/)).toBeTruthy();
    expect(screen.getByText('Claims are not evidence')).toBeTruthy();
  });

  it('shows catalog claims as non-proof and opens only with an observable question', () => {
    const props = renderPanel({
      result,
      evidenceQuestion: 'Does it stay leak-free upside down for ten seconds?',
    });
    expect(screen.getByText('Catalog context · not proof')).toBeTruthy();
    expect(screen.getByText('Leak-resistant lid.')).toBeTruthy();
    expect(screen.getByText('$44.99')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ask what this page cannot prove' }));
    expect(props.onOpenQuestion).toHaveBeenCalledWith(result.products[0]);
  });

  it('submits through the human fallback and disables selection without a question', () => {
    const props = renderPanel({ result });
    fireEvent.click(screen.getByRole('button', { name: 'Find real products' }));
    expect(props.onSearch).toHaveBeenCalledOnce();
    expect(
      screen
        .getByRole('button', { name: 'Ask what this page cannot prove' })
        .hasAttribute('disabled'),
    ).toBe(true);
  });

  it('formats zero-decimal currencies without assuming cents', () => {
    expect(
      formatCatalogPrice({
        ...result.products[0]!,
        price: { amount: 4_499, currency: 'JPY' },
      }),
    ).toContain('4,499');
  });
});
