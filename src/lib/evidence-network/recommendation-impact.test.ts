import { describe, expect, it } from 'vitest';

import { evidenceAnswerStatuses } from './model';
import { recommendationImpactForAnswer } from './recommendation-impact';

describe('question-scoped recommendation impact', () => {
  it('maps every evidence answer to a bounded shopping decision', () => {
    expect(evidenceAnswerStatuses.map(recommendationImpactForAnswer)).toEqual([
      expect.objectContaining({ state: 'blocked', headline: 'Recommendation blocked' }),
      expect.objectContaining({ state: 'eligible', headline: 'Requirement verified' }),
      expect.objectContaining({ state: 'excluded', headline: 'Exclude for this requirement' }),
      expect.objectContaining({ state: 'caveat', headline: 'Recommendation needs a caveat' }),
    ]);
  });

  it('keeps every decision scoped to the shopper requirement', () => {
    for (const status of evidenceAnswerStatuses) {
      expect(recommendationImpactForAnswer(status).guidance).toMatch(/this requirement/i);
    }
  });
});
