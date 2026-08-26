import { describe, expect, it } from 'vitest';

import {
  answerRepairHistory,
  createInitialState,
  defaultBuyerMandate,
  evaluateMandate,
  getAvailableToolNames,
  releaseCurrentLot,
  requestRepairHistory,
  reserveCurrentLot,
  setBuyingMandate,
} from './model';

describe('live market state machine', () => {
  it('publishes only tools that are meaningful in the current state', () => {
    const initial = createInitialState();
    expect(evaluateMandate(initial).outcome).toBe('no-mandate');
    expect(getAvailableToolNames(initial)).toEqual([
      'inspect_live_show',
      'set_buying_mandate',
      'inspect_current_lot',
    ]);

    const mandated = setBuyingMandate(initial, defaultBuyerMandate, 'agent').state;
    expect(evaluateMandate(mandated).outcome).toBe('unresolved');
    expect(getAvailableToolNames(mandated)).toContain('request_host_evidence');
    expect(getAvailableToolNames(mandated)).not.toContain('reserve_current_lot');

    const requested = requestRepairHistory(mandated, 'agent').state;
    expect(getAvailableToolNames(requested)).not.toContain('request_host_evidence');

    const supported = answerRepairHistory(requested, 'none').state;
    expect(evaluateMandate(supported).outcome).toBe('eligible');
    expect(getAvailableToolNames(supported)).toContain('reserve_current_lot');

    const reserved = reserveCurrentLot(supported, 'agent').state;
    expect(getAvailableToolNames(reserved)).not.toContain('reserve_current_lot');
    expect(getAvailableToolNames(reserved)).toContain('release_current_lot');

    const released = releaseCurrentLot(reserved, 'agent').state;
    expect(getAvailableToolNames(released)).toContain('reserve_current_lot');
    expect(getAvailableToolNames(released)).not.toContain('release_current_lot');
  });

  it('refuses a reservation while required evidence is unresolved', () => {
    const mandated = setBuyingMandate(createInitialState(), defaultBuyerMandate, 'agent').state;

    const result = reserveCurrentLot(mandated, 'agent');

    expect(result.ok).toBe(false);
    expect(result.message).toContain('No prior base repair');
    expect(result.state.reservation).toBeNull();
    expect(result.state.activity.at(-1)).toMatchObject({
      actor: 'agent',
      action: 'reservation_created',
      outcome: 'refused',
    });
  });

  it('refuses duplicate evidence requests', () => {
    const mandated = setBuyingMandate(createInitialState(), defaultBuyerMandate, 'buyer').state;
    const requested = requestRepairHistory(mandated, 'buyer').state;

    const duplicate = requestRepairHistory(requested, 'agent');

    expect(duplicate.ok).toBe(false);
    expect(duplicate.message).toBe('A repair-history request is already queued for the host.');
    expect(duplicate.state.evidenceRequests).toHaveLength(1);
  });

  it('keeps a disclosed repair from unlocking the reservation tool', () => {
    const mandated = setBuyingMandate(createInitialState(), defaultBuyerMandate, 'agent').state;
    const requested = requestRepairHistory(mandated, 'agent').state;
    const repaired = answerRepairHistory(requested, 'repaired').state;

    expect(evaluateMandate(repaired)).toMatchObject({
      outcome: 'ineligible',
      violated: ['No prior base repair'],
    });
    expect(getAvailableToolNames(repaired)).not.toContain('reserve_current_lot');
    expect(reserveCurrentLot(repaired, 'agent').ok).toBe(false);
  });

  it('does not request evidence that cannot change the decision', () => {
    const permissiveMandate = {
      ...defaultBuyerMandate,
      forbidPriorBaseRepair: false,
    };
    const permissive = setBuyingMandate(createInitialState(), permissiveMandate, 'buyer').state;
    expect(evaluateMandate(permissive).outcome).toBe('eligible');
    expect(getAvailableToolNames(permissive)).not.toContain('request_host_evidence');

    const overBudgetMandate = {
      ...defaultBuyerMandate,
      maxAllInPrice: 400,
    };
    const overBudget = setBuyingMandate(createInitialState(), overBudgetMandate, 'buyer').state;
    expect(evaluateMandate(overBudget).outcome).toBe('ineligible');
    expect(getAvailableToolNames(overBudget)).not.toContain('request_host_evidence');
  });

  it('requires an explicit release before changing a mandate with an active hold', () => {
    const mandated = setBuyingMandate(createInitialState(), defaultBuyerMandate, 'agent').state;
    const supported = answerRepairHistory(mandated, 'none').state;
    const reserved = reserveCurrentLot(supported, 'agent').state;

    const changed = setBuyingMandate(
      reserved,
      { ...defaultBuyerMandate, maxAllInPrice: 500 },
      'agent',
    );

    expect(changed.ok).toBe(false);
    expect(changed.message).toBe('Release the active hold before changing the buying mandate.');
    expect(changed.state.reservation).toEqual(reserved.reservation);
    expect(changed.state.mandate).toEqual(defaultBuyerMandate);
  });
});
