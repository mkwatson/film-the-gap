import type { EvidenceAnswerStatus } from './model';

export const recommendationImpactStates = ['blocked', 'eligible', 'excluded', 'caveat'] as const;
export type RecommendationImpactState = (typeof recommendationImpactStates)[number];

export interface RecommendationImpact {
  readonly state: RecommendationImpactState;
  readonly headline: string;
  readonly guidance: string;
}

const recommendationImpactByAnswer: Readonly<Record<EvidenceAnswerStatus, RecommendationImpact>> = {
  insufficient: {
    state: 'blocked',
    headline: 'Recommendation blocked',
    guidance: 'Do not recommend this product for this requirement until reviewed video proves it.',
  },
  supported: {
    state: 'eligible',
    headline: 'Requirement verified',
    guidance:
      'This product is now eligible to recommend for this requirement, backed by reviewed video.',
  },
  contradicted: {
    state: 'excluded',
    headline: 'Exclude for this requirement',
    guidance: 'Do not recommend this product for this requirement; reviewed video contradicts it.',
  },
  mixed: {
    state: 'caveat',
    headline: 'Recommendation needs a caveat',
    guidance:
      'Do not rank this product confidently for this requirement; show the conflicting evidence.',
  },
};

export function recommendationImpactForAnswer(
  answerStatus: EvidenceAnswerStatus,
): RecommendationImpact {
  return recommendationImpactByAnswer[answerStatus];
}
