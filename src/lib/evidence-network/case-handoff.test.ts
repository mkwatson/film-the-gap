import { describe, expect, it } from 'vitest';

import {
  buildEvidenceCaseHandoffPath,
  createEvidenceNetworkStateFromHandoff,
  evidenceCaseHandoffSource,
  evidenceCaseHandoffVersion,
  parseEvidenceCaseHandoffSearchParams,
  type EvidenceCaseHandoff,
} from './case-handoff';
import { demoProduct } from './demo-product';

const handoff: EvidenceCaseHandoff = {
  version: evidenceCaseHandoffVersion,
  source: evidenceCaseHandoffSource,
  question: {
    productName: demoProduct.name,
    productUrl: 'https://catalog.example/demo-product?utm_source=agent',
    question: demoProduct.question,
  },
};

function searchParamsRecord(path: string): Readonly<Record<string, string>> {
  return Object.fromEntries(new URL(path, 'https://film-the-gap.example').searchParams);
}

describe('product-page evidence case handoff', () => {
  it('round-trips the exact public product question through a compact URL', () => {
    const path = buildEvidenceCaseHandoffPath(handoff);

    expect(path).toMatch(/^\/case\?/);
    expect(parseEvidenceCaseHandoffSearchParams(searchParamsRecord(path))).toEqual(handoff);
  });

  it('rejects unknown fields, duplicate values, invalid versions, and private URLs', () => {
    const valid = searchParamsRecord(buildEvidenceCaseHandoffPath(handoff));

    expect(parseEvidenceCaseHandoffSearchParams({ ...valid, privateBudget: '$450' })).toBeNull();
    expect(parseEvidenceCaseHandoffSearchParams({ ...valid, question: ['one', 'two'] })).toBeNull();
    expect(parseEvidenceCaseHandoffSearchParams({ ...valid, v: '2' })).toBeNull();
    expect(
      parseEvidenceCaseHandoffSearchParams({ ...valid, url: 'http://localhost:3000/product' }),
    ).toBeNull();
  });

  it('creates a generic evidence case rather than smuggling in the demo answer', () => {
    const state = createEvidenceNetworkStateFromHandoff(handoff);

    expect(state.activeCase).toMatchObject({
      product: {
        name: demoProduct.name,
        suppliedUrl: handoff.question.productUrl,
      },
      question: { text: demoProduct.question },
      discovery: null,
      mission: null,
      answers: [{ status: 'insufficient' }],
    });
    expect(state.activeCase?.sources).toEqual([
      expect.objectContaining({
        title: 'Shopper-supplied product page',
        rights: 'link_only',
        provenance: 'external_link',
      }),
    ]);
    expect(state.activeCase?.observations).toEqual([]);
  });
});
