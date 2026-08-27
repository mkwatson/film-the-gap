import { describe, expect, it } from 'vitest';

import {
  answerRepairHistory,
  createInitialState,
  defaultEvidenceRequirements,
  evaluateEvidence,
  getActionFrontier,
  getAllInPrice,
  getAvailableToolNames,
  getEvidenceDemandSummary,
  joinAuthenticatedEvidenceDemand,
  recordCancelledMerchantCart,
  recordPreparedMerchantCart,
  releaseCurrentLot,
  requestRepairHistory,
  reserveCurrentLot,
  setEvidenceRequirements,
} from './model';

const cameraFrame = {
  kind: 'camera-keyframe',
  frameId: 'camera-9dff50df08c6',
  label: 'Host camera keyframe · camera-9dff50df08c6',
  capturedAt: '2026-08-26T19:22:31.000Z',
  showOffsetSeconds: null,
  sha256: '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e',
  widthPx: 960,
  heightPx: 540,
} as const;

const cameraVisualReview = {
  source: 'ai-gateway',
  modelId: 'openai/gpt-5.6-sol',
  frameId: cameraFrame.frameId,
  frameSha256: cameraFrame.sha256,
  proposal: {
    baseVisibility: 'clear',
    surfaceFinding: 'no-obvious-repair',
    confidence: 'medium',
    visibleDetails: ['The full base is visible in even light.'],
    summary: 'The full base is visible with no obvious repair marker.',
    suggestedNextView: null,
  },
  reviewedFinding: {
    baseVisibility: 'clear',
    surfaceFinding: 'no-obvious-repair',
    confidence: 'medium',
    visibleDetails: ['The full base is visible in even light.'],
    summary: 'The full base is visible with no obvious repair marker.',
    suggestedNextView: null,
  },
  hostDecision: 'accepted',
} as const;

const publicEvidenceImage = 'data:image/jpeg;base64,ZnJhbWU=';

describe('live market state machine', () => {
  it('publishes only tools that are meaningful in the current state', () => {
    const initial = createInitialState();
    expect(evaluateEvidence(initial).outcome).toBe('no-requirements');
    expect(getAvailableToolNames(initial)).toEqual([
      'inspect_live_show',
      'set_evidence_requirements',
    ]);

    const scoped = setEvidenceRequirements(initial, defaultEvidenceRequirements, 'agent').state;
    expect(evaluateEvidence(scoped).outcome).toBe('unresolved');
    expect(getAvailableToolNames(scoped)).toContain('request_host_evidence');
    expect(getAvailableToolNames(scoped)).not.toContain('reserve_current_lot');

    const requested = requestRepairHistory(scoped, 'agent').state;
    expect(getAvailableToolNames(requested)).not.toContain('request_host_evidence');

    const supported = answerRepairHistory(requested, 'none').state;
    expect(evaluateEvidence(supported).outcome).toBe('ready');
    expect(getAvailableToolNames(supported)).toContain('reserve_current_lot');

    const reserved = reserveCurrentLot(supported, 'agent', getAllInPrice(supported.lot)).state;
    expect(getAvailableToolNames(reserved)).not.toContain('set_evidence_requirements');
    expect(getAvailableToolNames(reserved)).not.toContain('reserve_current_lot');
    expect(getAvailableToolNames(reserved)).toContain('release_current_lot');

    const released = releaseCurrentLot(reserved, 'agent').state;
    expect(getAvailableToolNames(released)).toContain('set_evidence_requirements');
    expect(getAvailableToolNames(released)).toContain('reserve_current_lot');
    expect(getAvailableToolNames(released)).not.toContain('release_current_lot');
  });

  it('refuses a reservation while required public evidence is unresolved', () => {
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;

    const result = reserveCurrentLot(scoped, 'agent', getAllInPrice(scoped.lot));

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
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'buyer',
    ).state;
    const requested = requestRepairHistory(scoped, 'buyer').state;

    const duplicate = requestRepairHistory(requested, 'agent');

    expect(duplicate.ok).toBe(false);
    expect(duplicate.message).toBe('A repair-history request is already queued for the host.');
    expect(duplicate.state.evidenceRequests).toHaveLength(1);
  });

  it('keeps a disclosed repair from unlocking the hold tool', () => {
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;
    const requested = requestRepairHistory(scoped, 'agent').state;
    const repaired = answerRepairHistory(requested, 'repaired').state;

    expect(evaluateEvidence(repaired)).toMatchObject({
      outcome: 'incompatible',
      violated: ['No prior base repair'],
    });
    expect(getAvailableToolNames(repaired)).not.toContain('reserve_current_lot');
    expect(reserveCurrentLot(repaired, 'agent', getAllInPrice(repaired.lot)).ok).toBe(false);
  });

  it('does not request evidence that cannot change the public evaluation', () => {
    const permissiveRequirements = {
      ...defaultEvidenceRequirements,
      forbidPriorBaseRepair: false,
    };
    const permissive = setEvidenceRequirements(
      createInitialState(),
      permissiveRequirements,
      'buyer',
    ).state;
    expect(evaluateEvidence(permissive).outcome).toBe('ready');
    expect(getAvailableToolNames(permissive)).not.toContain('request_host_evidence');
    expect(requestRepairHistory(permissive, 'agent')).toMatchObject({
      ok: false,
      message: 'Repair history cannot change the current public evidence decision.',
    });

    const incompatibleRequirements = {
      ...defaultEvidenceRequirements,
      minLengthCm: 160,
      maxLengthCm: 164,
    };
    const incompatible = setEvidenceRequirements(
      createInitialState(),
      incompatibleRequirements,
      'buyer',
    ).state;
    expect(evaluateEvidence(incompatible).outcome).toBe('incompatible');
    expect(getAvailableToolNames(incompatible)).not.toContain('request_host_evidence');
    expect(requestRepairHistory(incompatible, 'agent')).toMatchObject({
      ok: false,
      message: 'Repair history cannot change the current public evidence decision.',
    });
  });

  it('requires an explicit release before changing evidence requirements', () => {
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;
    const supported = answerRepairHistory(scoped, 'none').state;
    const reserved = reserveCurrentLot(supported, 'agent', getAllInPrice(supported.lot)).state;

    const changed = setEvidenceRequirements(
      reserved,
      { ...defaultEvidenceRequirements, minLengthCm: 152 },
      'agent',
    );

    expect(changed.ok).toBe(false);
    expect(changed.message).toBe('Release the active hold before changing evidence requirements.');
    expect(changed.state.reservation).toEqual(reserved.reservation);
    expect(changed.state.evidenceRequirements).toEqual(defaultEvidenceRequirements);
  });

  it('rejects a stale quote without learning the buyer ceiling', () => {
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;
    const supported = answerRepairHistory(scoped, 'none').state;
    const changedQuote = {
      ...supported,
      lot: {
        ...supported.lot,
        currentBid: supported.lot.currentBid + 10,
      },
    };

    const result = reserveCurrentLot(supported, 'agent', getAllInPrice(changedQuote.lot));

    expect(result.ok).toBe(false);
    expect(result.message).toContain('The live quote changed');
    expect(result.message).toContain('decide again privately');
    expect(result.state.reservation).toBeNull();
  });

  it('multicasts one answer to an aggregate without storing individual profiles', () => {
    const initial = createInitialState();
    expect(getEvidenceDemandSummary(initial, 'repair_history')).toMatchObject({
      fixtureAgentCount: 7,
      authenticatedAttendeeCount: 0,
      currentSessionAgentCount: 0,
      liveAgentCount: 0,
      totalAgentCount: 7,
      status: 'open',
    });

    const scoped = setEvidenceRequirements(initial, defaultEvidenceRequirements, 'agent').state;
    const requested = requestRepairHistory(scoped, 'agent').state;
    expect(getEvidenceDemandSummary(requested, 'repair_history')).toMatchObject({
      fixtureAgentCount: 7,
      authenticatedAttendeeCount: 0,
      currentSessionAgentCount: 1,
      liveAgentCount: 1,
      totalAgentCount: 8,
      status: 'queued',
    });

    const answered = answerRepairHistory(requested, 'none');
    expect(answered.message).toBe('One camera answer resolved 8 private agent decisions.');
    expect(getEvidenceDemandSummary(answered.state, 'repair_history')).toMatchObject({
      totalAgentCount: 8,
      status: 'resolved',
    });
    expect(Object.keys(answered.state.anonymousEvidenceDemand[0] ?? {})).toEqual([
      'kind',
      'agentCount',
      'status',
    ]);
  });

  it('progressively replaces every crowd fixture with authenticated attendee sessions', () => {
    const refused = joinAuthenticatedEvidenceDemand(createInitialState());
    expect(refused).toMatchObject({
      ok: false,
      message: 'There is no open normalized repair-history request to join.',
    });

    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;
    let state = requestRepairHistory(scoped, 'agent').state;

    for (let attendee = 1; attendee <= 7; attendee += 1) {
      const joined = joinAuthenticatedEvidenceDemand(state);
      expect(joined).toMatchObject({
        ok: true,
        message: `${attendee + 1} live agents now share one normalized evidence request.`,
      });
      state = joined.state;
    }

    expect(getEvidenceDemandSummary(state, 'repair_history')).toMatchObject({
      fixtureAgentCount: 0,
      authenticatedAttendeeCount: 7,
      currentSessionAgentCount: 1,
      liveAgentCount: 8,
      totalAgentCount: 8,
      status: 'queued',
    });
    expect(state).not.toHaveProperty('attendeeCredentials');
    expect(JSON.stringify(state)).not.toMatch(/attendee-[1-7]/);

    const overflow = joinAuthenticatedEvidenceDemand(state);
    expect(overflow).toMatchObject({
      ok: false,
      message: 'Every deterministic crowd slot already has an authenticated attendee.',
    });

    const answered = answerRepairHistory(state, 'none');
    expect(answered.message).toBe('One camera answer resolved 8 private agent decisions.');
  });

  it('binds a camera attestation to structured public frame provenance', () => {
    const initial = createInitialState();
    const scoped = setEvidenceRequirements(initial, defaultEvidenceRequirements, 'agent').state;
    const requested = requestRepairHistory(scoped, 'agent').state;
    const answered = answerRepairHistory(
      requested,
      'none',
      cameraFrame,
      cameraVisualReview,
      publicEvidenceImage,
    );

    expect(answered.ok).toBe(true);
    expect(answered.state.lot.evidence).toMatchObject({
      repairHistory: 'none',
      repairEvidenceSource: cameraFrame.label,
      repairEvidenceFrame: cameraFrame,
      repairEvidenceImage: publicEvidenceImage,
      visualReview: cameraVisualReview,
    });
    expect(answered.state.activity.at(-1)?.summary).toContain('camera-keyframe');
  });

  it('refuses unreviewed, mismatched, or visually conflicting camera attestations', () => {
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;
    const requested = requestRepairHistory(scoped, 'agent').state;

    expect(answerRepairHistory(requested, 'none', cameraFrame)).toMatchObject({
      ok: false,
      message: expect.stringContaining('Review the selected camera frame'),
    });
    expect(
      answerRepairHistory(
        requested,
        'none',
        cameraFrame,
        { ...cameraVisualReview, frameId: 'camera-000000000000' },
        publicEvidenceImage,
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('exact selected evidence frame'),
    });
    expect(
      answerRepairHistory(
        requested,
        'none',
        cameraFrame,
        {
          ...cameraVisualReview,
          reviewedFinding: {
            ...cameraVisualReview.reviewedFinding,
            surfaceFinding: 'possible-repair',
          },
          hostDecision: 'corrected',
        },
        publicEvidenceImage,
      ),
    ).toMatchObject({
      ok: false,
      message: expect.stringContaining('possible visible repair signal'),
    });
  });

  it('keeps the next capability frontier consistent through the hero flow', () => {
    const initial = createInitialState();
    expect(getActionFrontier(initial).next.action).toBe('set_evidence_requirements');

    const scoped = setEvidenceRequirements(initial, defaultEvidenceRequirements, 'agent').state;
    expect(getActionFrontier(scoped).next.action).toBe('request_host_evidence');

    const requested = requestRepairHistory(scoped, 'agent').state;
    expect(getActionFrontier(requested).next).toMatchObject({
      actor: 'host',
      action: 'answer_repair_history',
    });

    const answered = answerRepairHistory(requested, 'none').state;
    expect(getActionFrontier(answered).next.action).toBe('reserve_current_lot');

    const reserved = reserveCurrentLot(answered, 'agent', getAllInPrice(answered.lot)).state;
    expect(getActionFrontier(reserved).next.action).toBe('release_current_lot');
  });

  it('exposes UCP cart authority only after evidence and an exact-quote hold', () => {
    const initial = createInitialState({ ucpMerchantOrigin: 'https://merchant.example' });
    expect(initial.commerce).toMatchObject({
      available: true,
      protocolVersion: '2026-08-25',
      cartStatus: 'none',
    });
    expect(getAvailableToolNames(initial)).not.toContain('prepare_merchant_cart');

    const scoped = setEvidenceRequirements(initial, defaultEvidenceRequirements, 'agent').state;
    const supported = answerRepairHistory(scoped, 'none').state;
    const reserved = reserveCurrentLot(supported, 'agent', getAllInPrice(supported.lot)).state;
    expect(getAvailableToolNames(reserved)).toEqual(
      expect.arrayContaining(['release_current_lot', 'prepare_merchant_cart']),
    );
    expect(getActionFrontier(reserved).next.action).toBe('prepare_merchant_cart');

    const prepared = recordPreparedMerchantCart(reserved, 'agent', {
      protocolVersion: '2026-08-25',
      currency: 'USD',
      lineItems: [
        {
          title: 'Rights-cleared 156 cm demo board',
          unitPrice: 37500,
          quantity: 1,
          subtotal: 37500,
        },
      ],
      totals: [
        { type: 'subtotal', displayText: 'Subtotal', amount: 37500 },
        { type: 'fulfillment', displayText: 'Flat shipping', amount: 4800 },
        { type: 'total', displayText: 'Exact total', amount: 42300 },
      ],
      messages: [],
      continuationAvailable: true,
      createdAt: 1_787_787_200_000,
    }).state;
    expect(getAvailableToolNames(prepared)).toContain('cancel_merchant_cart');
    expect(getAvailableToolNames(prepared)).not.toContain('release_current_lot');
    expect(releaseCurrentLot(prepared, 'agent')).toMatchObject({
      ok: false,
      message: expect.stringContaining('Cancel the active merchant cart'),
    });

    const cancelled = recordCancelledMerchantCart(prepared, 'agent').state;
    expect(cancelled.commerce.cartStatus).toBe('cancelled');
    expect(getAvailableToolNames(cancelled)).toContain('release_current_lot');
    expect(getAvailableToolNames(cancelled)).not.toContain('prepare_merchant_cart');

    const released = releaseCurrentLot(cancelled, 'agent').state;
    expect(released.commerce).toMatchObject({ cartStatus: 'none', receipt: null });
    expect(released.reservation).toBeNull();
  });

  it('keeps the activity audit inside the synchronized room bound', () => {
    let state = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'buyer',
    ).state;
    state = requestRepairHistory(state, 'buyer').state;

    for (let index = 0; index < 150; index += 1) {
      state = requestRepairHistory(state, 'agent').state;
    }

    expect(state.activity).toHaveLength(100);
    expect(state.activity[0]?.id).toBeGreaterThan(1);
    expect(state.activity.at(-1)).toMatchObject({
      actor: 'agent',
      action: 'evidence_requested',
      outcome: 'refused',
    });
  });
});
