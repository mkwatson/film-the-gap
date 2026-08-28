'use client';

import type { FormEvent } from 'react';

import type {
  ShopifyCatalogProduct,
  ShopifyCatalogSearchResponse,
} from '@/lib/evidence-network/ucp-catalog';

export type CatalogSearchPhase = 'idle' | 'searching' | 'complete' | 'error';

export interface ProductCatalogDiscoveryProps {
  readonly country: string;
  readonly error: string | null;
  readonly evidenceQuestion: string;
  readonly phase: CatalogSearchPhase;
  readonly query: string;
  readonly result: ShopifyCatalogSearchResponse | null;
  readonly onCountryChange: (value: string) => void;
  readonly onEvidenceQuestionChange: (value: string) => void;
  readonly onOpenQuestion: (product: ShopifyCatalogProduct) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onSearch: () => void;
}

export function formatCatalogPrice(product: ShopifyCatalogProduct): string {
  try {
    const formatter = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: product.price.currency,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(product.price.amount / 10 ** fractionDigits);
  } catch {
    return `${product.price.amount} ${product.price.currency}`;
  }
}

export function ProductCatalogDiscovery({
  country,
  error,
  evidenceQuestion,
  phase,
  query,
  result,
  onCountryChange,
  onEvidenceQuestionChange,
  onOpenQuestion,
  onQueryChange,
  onSearch,
}: ProductCatalogDiscoveryProps): React.JSX.Element {
  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSearch();
  }

  const products = result?.products ?? [];
  const canOpenQuestion = evidenceQuestion.trim().length >= 8;

  return (
    <section className="evidence-catalog-panel evidence-panel" aria-labelledby="catalog-title">
      <div className="evidence-catalog-intro">
        <div>
          <p className="evidence-eyebrow">No store integration required</p>
          <h2 id="catalog-title">Start with a real product from the open commerce web.</h2>
          <p>
            UCP finds products across participating merchants. Film the Gap then separates what a
            listing says from what authentic video actually proves.
          </p>
        </div>
        <span className="evidence-catalog-protocol">
          Shopify Global Catalog <b>×</b> UCP 2026-04-08
        </span>
      </div>

      <form className="evidence-catalog-search" onSubmit={submit}>
        <label>
          What kind of product?
          <input
            required
            minLength={3}
            maxLength={160}
            placeholder="plain stainless insulated bottle"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
          />
        </label>
        <label className="evidence-catalog-country">
          Country
          <input
            required
            minLength={2}
            maxLength={2}
            pattern="[A-Za-z]{2}"
            aria-describedby="catalog-privacy-note"
            value={country}
            onChange={(event) => onCountryChange(event.currentTarget.value.toUpperCase())}
          />
        </label>
        <button
          className="evidence-secondary-button"
          type="submit"
          disabled={phase === 'searching'}
        >
          {phase === 'searching' ? 'Searching UCP…' : 'Find real products'}
        </button>
        <small id="catalog-privacy-note">
          Sent to the catalog: this query and country only. No identity, budget, history, or chat.
        </small>
      </form>

      {result === null && error === null ? (
        <div className="evidence-catalog-empty" role="group" aria-label="Catalog evidence boundary">
          <span>
            <b>1</b>
            <strong>Discover</strong>
            Real products and offers
          </span>
          <span>
            <b>2</b>
            <strong>Challenge</strong>
            Claims are not evidence
          </span>
          <span>
            <b>3</b>
            <strong>Prove</strong>
            Ask for the missing shot
          </span>
        </div>
      ) : null}

      {error === null ? null : <p role="alert">{error}</p>}
      {result?.warnings.map((warning, index) => (
        <p className="evidence-catalog-warning" key={`${index}:${warning}`}>
          {warning}
        </p>
      ))}

      {result !== null && products.length === 0 ? (
        <p className="evidence-catalog-no-results" role="status">
          No products were returned. Try a broader public description.
        </p>
      ) : null}

      {products.length > 0 ? (
        <div className="evidence-catalog-results">
          <div className="evidence-catalog-question">
            <label>
              What should authentic video prove about one of these products?
              <textarea
                required
                minLength={8}
                maxLength={280}
                placeholder="Does the filled bottle stay leak-free upside down for ten seconds?"
                value={evidenceQuestion}
                onChange={(event) => onEvidenceQuestionChange(event.currentTarget.value)}
              />
            </label>
            <p>
              Catalog text remains unverified context. This question starts the same evidence loop
              for whichever product you choose.
            </p>
          </div>
          <ul aria-label="Products discovered through UCP">
            {products.map((product) => (
              <li key={product.variantId}>
                <div className="evidence-catalog-product-head">
                  <p>
                    <small>{product.seller.name}</small>
                    <strong>{product.title}</strong>
                    {product.variantTitle.trim().toLowerCase() ===
                    product.title.trim().toLowerCase() ? null : (
                      <span>{product.variantTitle}</span>
                    )}
                  </p>
                  <b>{formatCatalogPrice(product)}</b>
                </div>
                <div className="evidence-catalog-claims">
                  <small>Catalog context · not proof</small>
                  {product.catalogClaims.length === 0 ? (
                    <p>No catalog claim was retained.</p>
                  ) : (
                    <ul>
                      {product.catalogClaims.slice(0, 2).map(({ text }) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="evidence-catalog-product-actions">
                  {product.productUrl === undefined ? (
                    <span>Merchant page unavailable</span>
                  ) : (
                    <a href={product.productUrl} target="_blank" rel="noreferrer">
                      Merchant page ↗
                    </a>
                  )}
                  <button
                    className="evidence-secondary-button"
                    type="button"
                    disabled={!canOpenQuestion}
                    onClick={() => onOpenQuestion(product)}
                  >
                    Ask what this page cannot prove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="evidence-catalog-receipt" role="status">
            {products.length} product{products.length === 1 ? '' : 's'} found through Shopify Global
            Catalog · mutually supported UCP {result?.protocolVersion}
          </p>
        </div>
      ) : null}
    </section>
  );
}
