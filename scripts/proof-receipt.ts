import { createHash } from 'node:crypto';

import { z } from 'zod';

const evidenceOutcomes = ['no-requirements', 'unresolved', 'ready', 'incompatible'] as const;

const policyCaseSchema = z.strictObject({
  showLive: z.boolean(),
  evidenceOutcome: z.enum(evidenceOutcomes),
  hasHold: z.boolean(),
  reserveToolAvailable: z.boolean(),
});

const emittedPolicySchema = z.strictObject({
  schemaVersion: z.literal(1),
  policy: z.literal('reserve_current_lot'),
  leanToolchain: z.literal('leanprover/lean4:v4.33.1'),
  theorems: z.tuple([
    z.literal('WebMCPPolicy.reserveToolAvailable_sound'),
    z.literal('WebMCPPolicy.sellerEnvelope_privateCeiling_noninterference'),
    z.literal('WebMCPPolicy.acceptedHold_sound'),
    z.literal('WebMCPPolicy.staleRevision_refused'),
  ]),
  cases: z.array(policyCaseSchema).length(16),
});

export type EvidenceOutcome = (typeof evidenceOutcomes)[number];
export type EmittedPolicy = z.infer<typeof emittedPolicySchema>;

export interface ProofSource {
  readonly path: string;
  readonly content: string;
}

export interface ProofReceipt extends EmittedPolicy {
  readonly sourceSha256: string;
  readonly limitations: readonly [string, string, string];
}

function policyCaseKey(policyCase: z.infer<typeof policyCaseSchema>): string {
  return [policyCase.showLive, policyCase.evidenceOutcome, policyCase.hasHold].join('|');
}

export function parseEmittedPolicy(value: string): EmittedPolicy {
  const parsed: unknown = JSON.parse(value);
  const policy = emittedPolicySchema.parse(parsed);
  const keys = new Set(policy.cases.map(policyCaseKey));

  if (keys.size !== policy.cases.length) {
    throw new Error('Lean policy output contains duplicate capability cases.');
  }

  const allowedCases = policy.cases.filter(({ reserveToolAvailable }) => reserveToolAvailable);
  if (
    allowedCases.length !== 1 ||
    allowedCases[0]?.showLive !== true ||
    allowedCases[0].evidenceOutcome !== 'ready' ||
    allowedCases[0].hasHold !== false
  ) {
    throw new Error('Lean policy must allow only the live, evidence-ready, no-hold case.');
  }

  return policy;
}

export function proofSourceSha256(sources: readonly ProofSource[]): string {
  const hash = createHash('sha256');
  for (const source of [...sources].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(source.path);
    hash.update('\0');
    hash.update(source.content);
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function createProofReceipt(
  policy: EmittedPolicy,
  sources: readonly ProofSource[],
): ProofReceipt {
  return {
    ...policy,
    sourceSha256: proofSourceSha256(sources),
    limitations: [
      'Proves the abstract capability policy, not that an image or seller statement is true.',
      'Proves private-ceiling noninterference for the modeled projection, not every browser or network implementation.',
      'Runtime TypeScript tests separately verify the adapter and generated table used by the page.',
    ],
  };
}

export function serializeProofReceipt(receipt: ProofReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
