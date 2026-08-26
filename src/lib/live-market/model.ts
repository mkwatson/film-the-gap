import { z } from 'zod';

export const showStatuses = ['preview', 'live', 'closed'] as const;
export type ShowStatus = (typeof showStatuses)[number];

export const evidenceStatuses = ['supported', 'unresolved', 'violated'] as const;
export type EvidenceStatus = (typeof evidenceStatuses)[number];

export const evaluationOutcomes = ['no-mandate', 'unresolved', 'eligible', 'ineligible'] as const;
export type EvaluationOutcome = (typeof evaluationOutcomes)[number];

export const activityActors = ['system', 'buyer', 'agent', 'host'] as const;
export type ActivityActor = (typeof activityActors)[number];

export const repairHistoryValues = ['unknown', 'none', 'repaired'] as const;
export type RepairHistory = (typeof repairHistoryValues)[number];

export const evidenceRequestKinds = ['repair_history'] as const;
export type EvidenceRequestKind = (typeof evidenceRequestKinds)[number];

export interface BuyerMandate {
  readonly maxAllInPrice: number;
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  readonly requireVisibleEdgeEvidence: boolean;
  readonly forbidPriorBaseRepair: boolean;
}

export const buyerMandateSchema = z
  .strictObject({
    maxAllInPrice: z.number().finite().min(1).max(10_000),
    minLengthCm: z.number().finite().min(80).max(250),
    maxLengthCm: z.number().finite().min(80).max(250),
    requireVisibleEdgeEvidence: z.boolean(),
    forbidPriorBaseRepair: z.boolean(),
  })
  .refine(({ minLengthCm, maxLengthCm }) => minLengthCm <= maxLengthCm, {
    message: 'minLengthCm must be less than or equal to maxLengthCm',
    path: ['minLengthCm'],
  });

export const defaultBuyerMandate = {
  maxAllInPrice: 450,
  minLengthCm: 154,
  maxLengthCm: 158,
  requireVisibleEdgeEvidence: true,
  forbidPriorBaseRepair: true,
} as const satisfies BuyerMandate;

export interface LotEvidence {
  readonly edgeCondition: 'visible-closeup';
  readonly edgeEvidenceSource: string;
  readonly repairHistory: RepairHistory;
  readonly repairEvidenceSource: string | null;
}

export interface LiveLot {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly lengthCm: number;
  readonly currentBid: number;
  readonly shipping: number;
  readonly closesInSeconds: number;
  readonly evidence: LotEvidence;
}

export interface EvidenceRequest {
  readonly id: string;
  readonly kind: EvidenceRequestKind;
  readonly status: 'queued' | 'answered';
  readonly requestedBy: 'agent' | 'buyer';
}

export interface Reservation {
  readonly id: string;
  readonly lotId: string;
  readonly heldBy: 'agent' | 'buyer';
}

export interface ActivityEvent {
  readonly id: number;
  readonly actor: ActivityActor;
  readonly action: string;
  readonly outcome: 'accepted' | 'refused' | 'observed';
  readonly summary: string;
}

export interface LiveMarketState {
  readonly showStatus: ShowStatus;
  readonly lot: LiveLot;
  readonly mandate: BuyerMandate | null;
  readonly evidenceRequests: readonly EvidenceRequest[];
  readonly reservation: Reservation | null;
  readonly activity: readonly ActivityEvent[];
  readonly nextActivityId: number;
}

export interface ConditionEvaluation {
  readonly id: 'price' | 'length' | 'edge_evidence' | 'repair_history';
  readonly label: string;
  readonly status: EvidenceStatus;
  readonly detail: string;
  readonly source: string;
}

export interface MandateEvaluation {
  readonly outcome: EvaluationOutcome;
  readonly conditions: readonly ConditionEvaluation[];
  readonly unresolved: readonly string[];
  readonly violated: readonly string[];
}

export interface TransitionResult {
  readonly ok: boolean;
  readonly state: LiveMarketState;
  readonly message: string;
}

const initialLot: LiveLot = {
  id: 'lot-snowboard-156',
  title: 'All-mountain 156',
  subtitle: 'Pre-owned · one live lot',
  lengthCm: 156,
  currentBid: 375,
  shipping: 48,
  closesInSeconds: 72,
  evidence: {
    edgeCondition: 'visible-closeup',
    edgeEvidenceSource: 'Host clip · edge close-up at 00:08',
    repairHistory: 'unknown',
    repairEvidenceSource: null,
  },
};

export function createInitialState(): LiveMarketState {
  return {
    showStatus: 'live',
    lot: initialLot,
    mandate: null,
    evidenceRequests: [],
    reservation: null,
    activity: [
      {
        id: 1,
        actor: 'system',
        action: 'lot_opened',
        outcome: 'observed',
        summary: 'Lot 07 opened with repair history unresolved.',
      },
    ],
    nextActivityId: 2,
  };
}

export function getAllInPrice(lot: LiveLot): number {
  return lot.currentBid + lot.shipping;
}

export function evaluateMandate(state: LiveMarketState): MandateEvaluation {
  const { mandate } = state;

  if (mandate === null) {
    return {
      outcome: 'no-mandate',
      conditions: [],
      unresolved: [],
      violated: [],
    };
  }

  const allInPrice = getAllInPrice(state.lot);
  const priceStatus: EvidenceStatus =
    allInPrice <= mandate.maxAllInPrice ? 'supported' : 'violated';
  const lengthStatus: EvidenceStatus =
    state.lot.lengthCm >= mandate.minLengthCm && state.lot.lengthCm <= mandate.maxLengthCm
      ? 'supported'
      : 'violated';
  const edgeStatus: EvidenceStatus =
    !mandate.requireVisibleEdgeEvidence || state.lot.evidence.edgeCondition === 'visible-closeup'
      ? 'supported'
      : 'unresolved';

  let repairStatus: EvidenceStatus = 'supported';
  let repairDetail = 'Prior repair is allowed by this mandate.';
  let repairSource = 'Buyer mandate';

  if (mandate.forbidPriorBaseRepair) {
    if (state.lot.evidence.repairHistory === 'unknown') {
      repairStatus = 'unresolved';
      repairDetail = 'The host has not established whether the base was repaired.';
      repairSource = 'No supporting evidence yet';
    } else if (state.lot.evidence.repairHistory === 'repaired') {
      repairStatus = 'violated';
      repairDetail = 'The host reported a prior base repair.';
      repairSource = state.lot.evidence.repairEvidenceSource ?? 'Host answer';
    } else {
      repairDetail = 'The host reported no prior base repair.';
      repairSource = state.lot.evidence.repairEvidenceSource ?? 'Host answer';
    }
  }

  const conditions: readonly ConditionEvaluation[] = [
    {
      id: 'price',
      label: 'All-in price',
      status: priceStatus,
      detail: `$${allInPrice} against a $${mandate.maxAllInPrice} ceiling.`,
      source: 'Live bid + displayed shipping',
    },
    {
      id: 'length',
      label: 'Length',
      status: lengthStatus,
      detail: `${state.lot.lengthCm} cm against ${mandate.minLengthCm}-${mandate.maxLengthCm} cm.`,
      source: 'Lot specification',
    },
    {
      id: 'edge_evidence',
      label: 'Visible edge evidence',
      status: edgeStatus,
      detail:
        edgeStatus === 'supported'
          ? 'A close-up of both edges is available.'
          : 'A visible close-up is still required.',
      source: state.lot.evidence.edgeEvidenceSource,
    },
    {
      id: 'repair_history',
      label: 'No prior base repair',
      status: repairStatus,
      detail: repairDetail,
      source: repairSource,
    },
  ];

  const unresolved = conditions
    .filter(({ status }) => status === 'unresolved')
    .map(({ label }) => label);
  const violated = conditions
    .filter(({ status }) => status === 'violated')
    .map(({ label }) => label);

  const outcome: EvaluationOutcome =
    violated.length > 0 ? 'ineligible' : unresolved.length > 0 ? 'unresolved' : 'eligible';

  return { outcome, conditions, unresolved, violated };
}

function addActivity(state: LiveMarketState, event: Omit<ActivityEvent, 'id'>): LiveMarketState {
  return {
    ...state,
    activity: [...state.activity, { ...event, id: state.nextActivityId }],
    nextActivityId: state.nextActivityId + 1,
  };
}

function refuse(
  state: LiveMarketState,
  actor: ActivityActor,
  action: string,
  message: string,
): TransitionResult {
  return {
    ok: false,
    message,
    state: addActivity(state, {
      actor,
      action,
      outcome: 'refused',
      summary: message,
    }),
  };
}

export function setBuyingMandate(
  state: LiveMarketState,
  mandate: BuyerMandate,
  actor: 'agent' | 'buyer',
): TransitionResult {
  if (state.reservation !== null) {
    return refuse(
      state,
      actor,
      'mandate_set',
      'Release the active hold before changing the buying mandate.',
    );
  }

  const nextState = addActivity(
    {
      ...state,
      mandate,
    },
    {
      actor,
      action: 'mandate_set',
      outcome: 'accepted',
      summary: `Shared five bounded constraints with the live page.`,
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Buying mandate recorded and evaluated against the current lot.',
  };
}

export function requestRepairHistory(
  state: LiveMarketState,
  actor: 'agent' | 'buyer',
): TransitionResult {
  if (state.showStatus !== 'live') {
    return refuse(
      state,
      actor,
      'evidence_requested',
      'Evidence can only be requested while the lot is live.',
    );
  }

  if (state.mandate === null) {
    return refuse(
      state,
      actor,
      'evidence_requested',
      'Set a buying mandate before requesting evidence.',
    );
  }

  if (state.lot.evidence.repairHistory !== 'unknown') {
    return refuse(state, actor, 'evidence_requested', 'Repair history is already resolved.');
  }

  if (
    state.evidenceRequests.some(
      ({ kind, status }) => kind === 'repair_history' && status === 'queued',
    )
  ) {
    return refuse(
      state,
      actor,
      'evidence_requested',
      'A repair-history request is already queued for the host.',
    );
  }

  const request: EvidenceRequest = {
    id: `request-${state.nextActivityId}`,
    kind: 'repair_history',
    status: 'queued',
    requestedBy: actor,
  };
  const nextState = addActivity(
    {
      ...state,
      evidenceRequests: [...state.evidenceRequests, request],
    },
    {
      actor,
      action: 'evidence_requested',
      outcome: 'accepted',
      summary: 'Asked the host to show and disclose any prior base repair.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Repair-history evidence request added to the host queue.',
  };
}

export function answerRepairHistory(
  state: LiveMarketState,
  repairHistory: Exclude<RepairHistory, 'unknown'>,
): TransitionResult {
  if (state.showStatus !== 'live') {
    return refuse(
      state,
      'host',
      'evidence_answered',
      'The host cannot answer after the lot closes.',
    );
  }

  const source =
    repairHistory === 'none'
      ? 'Host live disclosure · source frame 00:31'
      : 'Host live disclosure · repaired area at 00:31';
  const nextState = addActivity(
    {
      ...state,
      lot: {
        ...state.lot,
        evidence: {
          ...state.lot.evidence,
          repairHistory,
          repairEvidenceSource: source,
        },
      },
      evidenceRequests: state.evidenceRequests.map((request) =>
        request.kind === 'repair_history' ? { ...request, status: 'answered' } : request,
      ),
      reservation: null,
    },
    {
      actor: 'host',
      action: 'evidence_answered',
      outcome: 'accepted',
      summary:
        repairHistory === 'none'
          ? 'Host disclosed no prior base repair and supplied a source frame.'
          : 'Host disclosed a prior base repair and supplied a source frame.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Repair-history evidence updated.',
  };
}

export function reserveCurrentLot(
  state: LiveMarketState,
  actor: 'agent' | 'buyer',
): TransitionResult {
  if (state.showStatus !== 'live') {
    return refuse(state, actor, 'reservation_created', 'The lot is not live.');
  }

  if (state.reservation !== null) {
    return refuse(state, actor, 'reservation_created', 'This lot is already reserved.');
  }

  const evaluation = evaluateMandate(state);
  if (evaluation.outcome !== 'eligible') {
    const blockers = [...evaluation.violated, ...evaluation.unresolved];
    const reason =
      evaluation.outcome === 'no-mandate'
        ? 'A buying mandate is required before reservation.'
        : `Reservation is unavailable until these conditions resolve: ${blockers.join(', ')}.`;
    return refuse(state, actor, 'reservation_created', reason);
  }

  const reservation: Reservation = {
    id: `hold-${state.nextActivityId}`,
    lotId: state.lot.id,
    heldBy: actor,
  };
  const nextState = addActivity(
    { ...state, reservation },
    {
      actor,
      action: 'reservation_created',
      outcome: 'accepted',
      summary: 'Created a reversible 10-minute hold. No payment was taken.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Current lot reserved with a reversible hold.',
  };
}

export function releaseCurrentLot(
  state: LiveMarketState,
  actor: 'agent' | 'buyer',
): TransitionResult {
  if (state.reservation === null) {
    return refuse(
      state,
      actor,
      'reservation_released',
      'There is no active reservation to release.',
    );
  }

  const nextState = addActivity(
    { ...state, reservation: null },
    {
      actor,
      action: 'reservation_released',
      outcome: 'accepted',
      summary: 'Released the hold and restored the eligible action state.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Reservation released.',
  };
}

export function getAvailableToolNames(state: LiveMarketState): readonly string[] {
  const names = ['inspect_live_show', 'set_buying_mandate'];
  const evaluation = evaluateMandate(state);

  if (state.showStatus === 'live') {
    names.push('inspect_current_lot');
  }

  const repairRequestIsQueued = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );
  if (
    state.showStatus === 'live' &&
    state.mandate !== null &&
    evaluation.outcome === 'unresolved' &&
    state.mandate.forbidPriorBaseRepair &&
    state.lot.evidence.repairHistory === 'unknown' &&
    !repairRequestIsQueued
  ) {
    names.push('request_host_evidence');
  }

  if (evaluation.outcome === 'eligible' && state.reservation === null) {
    names.push('reserve_current_lot');
  }

  if (state.reservation !== null) {
    names.push('release_current_lot');
  }

  return names;
}
