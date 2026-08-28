import { z } from 'zod';

import {
  applyEvidenceNetworkCommand,
  createEmptyEvidenceNetworkState,
  productQuestionInputSchema,
  type EvidenceNetworkState,
  type ProductQuestionInput,
} from './model';

export const evidenceCaseHandoffVersion = '1' as const;
export const evidenceCaseHandoffSource = 'demo_product' as const;

const evidenceCaseHandoffSchema = z.strictObject({
  version: z.literal(evidenceCaseHandoffVersion),
  source: z.literal(evidenceCaseHandoffSource),
  question: productQuestionInputSchema,
});

export type EvidenceCaseHandoff = z.infer<typeof evidenceCaseHandoffSchema>;

export interface EvidenceCaseHandoffSearchParams {
  readonly [key: string]: string | readonly string[] | undefined;
}

const handoffQueryKeys = ['v', 'source', 'product', 'question', 'url'] as const;
const handoffQueryKeySet = new Set<string>(handoffQueryKeys);

function singleValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function buildEvidenceCaseHandoffPath(input: EvidenceCaseHandoff): string {
  const handoff = evidenceCaseHandoffSchema.parse(input);
  const query = new URLSearchParams({
    v: handoff.version,
    source: handoff.source,
    product: handoff.question.productName,
    question: handoff.question.question,
  });
  if (handoff.question.productUrl !== undefined) {
    query.set('url', handoff.question.productUrl);
  }
  return `/case?${query.toString()}`;
}

export function parseEvidenceCaseHandoffSearchParams(
  input: EvidenceCaseHandoffSearchParams,
): EvidenceCaseHandoff | null {
  if (Object.keys(input).some((key) => !handoffQueryKeySet.has(key))) {
    return null;
  }
  const version = singleValue(input.v);
  const source = singleValue(input.source);
  const productName = singleValue(input.product);
  const question = singleValue(input.question);
  const productUrl = singleValue(input.url);
  const parsed = evidenceCaseHandoffSchema.safeParse({
    version,
    source,
    question: {
      productName,
      question,
      ...(productUrl === undefined ? {} : { productUrl }),
    },
  });
  return parsed.success ? parsed.data : null;
}

export function createEvidenceNetworkStateFromHandoff(
  input: EvidenceCaseHandoff,
): EvidenceNetworkState {
  const handoff = evidenceCaseHandoffSchema.parse(input);
  const transition = applyEvidenceNetworkCommand(createEmptyEvidenceNetworkState(), {
    kind: 'ask-product-question',
    actor: 'agent',
    input: handoff.question,
  });
  if (!transition.ok) {
    throw new Error(transition.message);
  }
  return transition.state;
}

export function evidenceCaseHandoffQuestion(input: EvidenceCaseHandoff): ProductQuestionInput {
  return evidenceCaseHandoffSchema.parse(input).question;
}
