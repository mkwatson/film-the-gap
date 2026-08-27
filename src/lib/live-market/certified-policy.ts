import { z } from 'zod';

import receiptJson from '../../generated/hold-policy-receipt.json';

const evidenceOutcomes = ['no-requirements', 'unresolved', 'ready', 'incompatible'] as const;

const receiptSchema = z.strictObject({
  schemaVersion: z.literal(1),
  policy: z.literal('reserve_current_lot'),
  leanToolchain: z.literal('leanprover/lean4:v4.33.1'),
  theorems: z.tuple([
    z.literal('WebMCPPolicy.reserveToolAvailable_sound'),
    z.literal('WebMCPPolicy.sellerEnvelope_privateCeiling_noninterference'),
    z.literal('WebMCPPolicy.acceptedHold_sound'),
    z.literal('WebMCPPolicy.staleRevision_refused'),
  ]),
  cases: z.array(
    z.strictObject({
      showLive: z.boolean(),
      evidenceOutcome: z.enum(evidenceOutcomes),
      hasHold: z.boolean(),
      reserveToolAvailable: z.boolean(),
    }),
  ),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  limitations: z.tuple([z.string().min(1), z.string().min(1), z.string().min(1)]),
});

const receipt = receiptSchema.parse(receiptJson);

export interface ReservePolicyInput {
  readonly showLive: boolean;
  readonly evidenceOutcome: (typeof evidenceOutcomes)[number];
  readonly hasHold: boolean;
}

export interface ReservePolicyDecision extends ReservePolicyInput {
  readonly reserveToolAvailable: boolean;
}

export const holdPolicyProof = {
  checker: 'Lean 4.33.1',
  rule: 'Hold only when live + evidence ready + no existing hold',
  theorem: receipt.theorems[0],
  receipt: receipt.sourceSha256.slice(0, 12),
  limitation: 'Abstract policy only—not camera truth.',
} as const;

export function decideReservePolicy(input: ReservePolicyInput): ReservePolicyDecision {
  const matchingCase = receipt.cases.find(
    (candidate) =>
      candidate.showLive === input.showLive &&
      candidate.evidenceOutcome === input.evidenceOutcome &&
      candidate.hasHold === input.hasHold,
  );
  if (matchingCase === undefined) {
    throw new Error('The Lean capability receipt does not cover the current public state.');
  }
  return matchingCase;
}
