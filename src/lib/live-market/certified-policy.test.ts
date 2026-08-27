import { describe, expect, it } from 'vitest';

import { decideReservePolicy, holdPolicyProof } from './certified-policy';

const outcomes = ['no-requirements', 'unresolved', 'ready', 'incompatible'] as const;

describe('certified reserve policy adapter', () => {
  it('exposes the hold only for a live, ready, unheld state', () => {
    const decisions = [false, true].flatMap((showLive) =>
      outcomes.flatMap((evidenceOutcome) =>
        [false, true].map((hasHold) => decideReservePolicy({ showLive, evidenceOutcome, hasHold })),
      ),
    );

    expect(decisions.filter(({ reserveToolAvailable }) => reserveToolAvailable)).toEqual([
      {
        showLive: true,
        evidenceOutcome: 'ready',
        hasHold: false,
        reserveToolAvailable: true,
      },
    ]);
  });

  it('publishes a bounded receipt without empirical truth claims', () => {
    expect(holdPolicyProof).toMatchObject({
      checker: 'Lean 4.33.1',
      theorem: 'WebMCPPolicy.reserveToolAvailable_sound',
    });
    expect(holdPolicyProof.receipt).toMatch(/^[a-f0-9]{12}$/);
    expect(holdPolicyProof.limitation).toContain('not camera truth');
  });
});
