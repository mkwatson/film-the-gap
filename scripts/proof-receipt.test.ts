import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import generatedReceipt from '../src/generated/hold-policy-receipt.json';
import {
  createProofReceipt,
  parseEmittedPolicy,
  proofSourceSha256,
  type EmittedPolicy,
} from './proof-receipt';

const outcomes = ['no-requirements', 'unresolved', 'ready', 'incompatible'] as const;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const trackedProofSources = [
  'CapabilityPolicy.lean',
  'Main.lean',
  'lakefile.toml',
  'lean-toolchain',
] as const;

function emittedPolicy(): EmittedPolicy {
  return {
    schemaVersion: 1,
    policy: 'reserve_current_lot',
    leanToolchain: 'leanprover/lean4:v4.33.1',
    theorems: [
      'WebMCPPolicy.reserveToolAvailable_sound',
      'WebMCPPolicy.sellerEnvelope_privateCeiling_noninterference',
      'WebMCPPolicy.acceptedHold_sound',
      'WebMCPPolicy.staleRevision_refused',
    ],
    cases: [false, true].flatMap((showLive) =>
      outcomes.flatMap((evidenceOutcome) =>
        [false, true].map((hasHold) => ({
          showLive,
          evidenceOutcome,
          hasHold,
          reserveToolAvailable: showLive && evidenceOutcome === 'ready' && !hasHold,
        })),
      ),
    ),
  };
}

describe('Lean policy receipt', () => {
  it('accepts the complete table and only its intended capability case', () => {
    const parsed = parseEmittedPolicy(JSON.stringify(emittedPolicy()));
    expect(parsed.cases.filter(({ reserveToolAvailable }) => reserveToolAvailable)).toEqual([
      {
        showLive: true,
        evidenceOutcome: 'ready',
        hasHold: false,
        reserveToolAvailable: true,
      },
    ]);
  });

  it('rejects a table that broadens hold authority', () => {
    const policy = emittedPolicy();
    policy.cases[8] = { ...policy.cases[8]!, reserveToolAvailable: true };
    expect(() => parseEmittedPolicy(JSON.stringify(policy))).toThrow(
      'Lean policy must allow only the live, evidence-ready, no-hold case.',
    );
  });

  it('hashes named sources deterministically and binds them into the receipt', () => {
    const sources = [
      { path: 'b', content: 'second' },
      { path: 'a', content: 'first' },
    ];
    expect(proofSourceSha256(sources)).toBe(proofSourceSha256([...sources].reverse()));
    expect(createProofReceipt(emittedPolicy(), sources).sourceSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the committed receipt bound to the tracked Lean sources', () => {
    const sources = trackedProofSources.map((path) => ({
      path,
      content: readFileSync(resolve(repositoryRoot, 'proof', path), 'utf8'),
    }));
    expect(generatedReceipt.sourceSha256).toBe(proofSourceSha256(sources));
  });
});
