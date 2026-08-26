import { z } from 'zod';

export const showStatuses = ['preview', 'live', 'closed'] as const;
export type ShowStatus = (typeof showStatuses)[number];

export const evidenceStatuses = ['supported', 'unresolved', 'violated'] as const;
export type EvidenceStatus = (typeof evidenceStatuses)[number];

export const evidenceOutcomes = ['no-requirements', 'unresolved', 'ready', 'incompatible'] as const;
export type EvidenceOutcome = (typeof evidenceOutcomes)[number];

export const activityActors = ['system', 'buyer', 'agent', 'host'] as const;
export type ActivityActor = (typeof activityActors)[number];

export const repairHistoryValues = ['unknown', 'none', 'repaired'] as const;
export type RepairHistory = (typeof repairHistoryValues)[number];

export const evidenceRequestKinds = ['repair_history'] as const;
export type EvidenceRequestKind = (typeof evidenceRequestKinds)[number];

export interface EvidenceRequirements {
  readonly minLengthCm: number;
  readonly maxLengthCm: number;
  readonly requireVisibleEdgeEvidence: boolean;
  readonly forbidPriorBaseRepair: boolean;
}

export const evidenceRequirementsSchema = z
  .strictObject({
    minLengthCm: z.number().finite().min(80).max(250),
    maxLengthCm: z.number().finite().min(80).max(250),
    requireVisibleEdgeEvidence: z.boolean(),
    forbidPriorBaseRepair: z.boolean(),
  })
  .refine(({ minLengthCm, maxLengthCm }) => minLengthCm <= maxLengthCm, {
    message: 'minLengthCm must be less than or equal to maxLengthCm',
    path: ['minLengthCm'],
  });

export const defaultEvidenceRequirements = {
  minLengthCm: 154,
  maxLengthCm: 158,
  requireVisibleEdgeEvidence: true,
  forbidPriorBaseRepair: true,
} as const satisfies EvidenceRequirements;

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

export interface AnonymousEvidenceDemand {
  readonly kind: EvidenceRequestKind;
  readonly agentCount: number;
  readonly status: 'open' | 'resolved';
}

export interface Reservation {
  readonly id: string;
  readonly lotId: string;
  readonly heldBy: 'agent' | 'buyer';
  readonly acceptedAllInPrice: number;
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
  readonly evidenceRequirements: EvidenceRequirements | null;
  readonly evidenceRequests: readonly EvidenceRequest[];
  readonly anonymousEvidenceDemand: readonly AnonymousEvidenceDemand[];
  readonly reservation: Reservation | null;
  readonly activity: readonly ActivityEvent[];
  readonly nextActivityId: number;
}

export interface ConditionEvaluation {
  readonly id: 'length' | 'edge_evidence' | 'repair_history';
  readonly label: string;
  readonly status: EvidenceStatus;
  readonly detail: string;
  readonly source: string;
}

export interface EvidenceEvaluation {
  readonly outcome: EvidenceOutcome;
  readonly conditions: readonly ConditionEvaluation[];
  readonly unresolved: readonly string[];
  readonly violated: readonly string[];
}

export interface EvidenceDemandSummary {
  readonly kind: EvidenceRequestKind;
  readonly fixture: 'deterministic-demo-room';
  readonly anonymousAgentCount: number;
  readonly currentSessionAgentCount: number;
  readonly totalAgentCount: number;
  readonly status: 'open' | 'queued' | 'resolved';
}

export interface ActionFrontierStep {
  readonly actor: 'agent-or-buyer' | 'host';
  readonly action: string;
  readonly instruction: string;
}

export interface BlockedCapability {
  readonly name: 'request_host_evidence' | 'reserve_current_lot';
  readonly reason: string;
  readonly recovery: string;
}

export interface ActionFrontier {
  readonly next: ActionFrontierStep;
  readonly blocked: readonly BlockedCapability[];
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
    evidenceRequirements: null,
    evidenceRequests: [],
    anonymousEvidenceDemand: [
      {
        kind: 'repair_history',
        agentCount: 7,
        status: 'open',
      },
    ],
    reservation: null,
    activity: [
      {
        id: 1,
        actor: 'system',
        action: 'lot_opened',
        outcome: 'observed',
        summary: 'Lot 07 opened with seven anonymous repair-history signals.',
      },
    ],
    nextActivityId: 2,
  };
}

export function getAllInPrice(lot: LiveLot): number {
  return lot.currentBid + lot.shipping;
}

export function evaluateEvidence(state: LiveMarketState): EvidenceEvaluation {
  const { evidenceRequirements } = state;

  if (evidenceRequirements === null) {
    return {
      outcome: 'no-requirements',
      conditions: [],
      unresolved: [],
      violated: [],
    };
  }

  const lengthStatus: EvidenceStatus =
    state.lot.lengthCm >= evidenceRequirements.minLengthCm &&
    state.lot.lengthCm <= evidenceRequirements.maxLengthCm
      ? 'supported'
      : 'violated';
  const edgeStatus: EvidenceStatus =
    !evidenceRequirements.requireVisibleEdgeEvidence ||
    state.lot.evidence.edgeCondition === 'visible-closeup'
      ? 'supported'
      : 'unresolved';

  let repairStatus: EvidenceStatus = 'supported';
  let repairDetail = 'Prior repair is allowed by the shared evidence requirements.';
  let repairSource = 'Buyer evidence requirements';

  if (evidenceRequirements.forbidPriorBaseRepair) {
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
      id: 'length',
      label: 'Length',
      status: lengthStatus,
      detail: `${state.lot.lengthCm} cm against ${evidenceRequirements.minLengthCm}-${evidenceRequirements.maxLengthCm} cm.`,
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

  const outcome: EvidenceOutcome =
    violated.length > 0 ? 'incompatible' : unresolved.length > 0 ? 'unresolved' : 'ready';

  return { outcome, conditions, unresolved, violated };
}

export function getEvidenceDemandSummary(
  state: LiveMarketState,
  kind: EvidenceRequestKind,
): EvidenceDemandSummary {
  const anonymousDemand = state.anonymousEvidenceDemand.find(
    (candidate) => candidate.kind === kind,
  );
  const currentSessionRequested = state.evidenceRequests.some((request) => request.kind === kind);
  const currentSessionQueued = state.evidenceRequests.some(
    (request) => request.kind === kind && request.status === 'queued',
  );
  const anonymousAgentCount = anonymousDemand?.agentCount ?? 0;
  const currentSessionAgentCount = currentSessionRequested ? 1 : 0;
  const resolved = anonymousDemand?.status === 'resolved';

  return {
    kind,
    fixture: 'deterministic-demo-room',
    anonymousAgentCount,
    currentSessionAgentCount,
    totalAgentCount: anonymousAgentCount + currentSessionAgentCount,
    status: resolved ? 'resolved' : currentSessionQueued ? 'queued' : 'open',
  };
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

export function setEvidenceRequirements(
  state: LiveMarketState,
  evidenceRequirements: EvidenceRequirements,
  actor: 'agent' | 'buyer',
): TransitionResult {
  if (state.reservation !== null) {
    return refuse(
      state,
      actor,
      'evidence_requirements_set',
      'Release the active hold before changing evidence requirements.',
    );
  }

  const nextState = addActivity(
    {
      ...state,
      evidenceRequirements,
    },
    {
      actor,
      action: 'evidence_requirements_set',
      outcome: 'accepted',
      summary: 'Shared four product-evidence requirements. No private price was disclosed.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Evidence requirements recorded. Price and wider buyer context stayed private.',
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

  if (state.evidenceRequirements === null) {
    return refuse(
      state,
      actor,
      'evidence_requested',
      'Share product-evidence requirements before requesting evidence.',
    );
  }

  const evaluation = evaluateEvidence(state);
  if (evaluation.outcome !== 'unresolved' || !state.evidenceRequirements.forbidPriorBaseRepair) {
    return refuse(
      state,
      actor,
      'evidence_requested',
      'Repair history cannot change the current public evidence decision.',
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
      summary: 'Joined seven anonymous agents asking for the same repair-history fact.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'One normalized question now represents eight private agent decisions.',
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

  if (state.lot.evidence.repairHistory !== 'unknown') {
    return refuse(state, 'host', 'evidence_answered', 'Repair history is already resolved.');
  }

  const resolvedAgentCount = getEvidenceDemandSummary(state, 'repair_history').totalAgentCount;
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
      anonymousEvidenceDemand: state.anonymousEvidenceDemand.map((demand) =>
        demand.kind === 'repair_history' ? { ...demand, status: 'resolved' } : demand,
      ),
      reservation: null,
    },
    {
      actor: 'host',
      action: 'evidence_answered',
      outcome: 'accepted',
      summary:
        repairHistory === 'none'
          ? `One host answer supplied no-repair evidence to ${resolvedAgentCount} private agents.`
          : `One host answer disclosed a repair to ${resolvedAgentCount} private agents.`,
    },
  );

  return {
    ok: true,
    state: nextState,
    message: `One camera answer resolved ${resolvedAgentCount} private agent decisions.`,
  };
}

export function reserveCurrentLot(
  state: LiveMarketState,
  actor: 'agent' | 'buyer',
  expectedAllInPrice: number,
): TransitionResult {
  if (state.showStatus !== 'live') {
    return refuse(state, actor, 'reservation_created', 'The lot is not live.');
  }

  if (state.reservation !== null) {
    return refuse(state, actor, 'reservation_created', 'This lot is already reserved.');
  }

  if (!Number.isFinite(expectedAllInPrice) || expectedAllInPrice <= 0) {
    return refuse(
      state,
      actor,
      'reservation_created',
      'An exact positive all-in quote is required for a hold.',
    );
  }

  const currentAllInPrice = getAllInPrice(state.lot);
  if (expectedAllInPrice !== currentAllInPrice) {
    return refuse(
      state,
      actor,
      'reservation_created',
      `The live quote changed: expected $${expectedAllInPrice}, current all-in is $${currentAllInPrice}. Inspect the lot and decide again privately.`,
    );
  }

  const evaluation = evaluateEvidence(state);
  if (evaluation.outcome !== 'ready') {
    const blockers = [...evaluation.violated, ...evaluation.unresolved];
    const reason =
      evaluation.outcome === 'no-requirements'
        ? 'Evidence requirements are needed before reservation.'
        : `Reservation is unavailable until these public evidence conditions resolve: ${blockers.join(', ')}.`;
    return refuse(state, actor, 'reservation_created', reason);
  }

  const reservation: Reservation = {
    id: `hold-${state.nextActivityId}`,
    lotId: state.lot.id,
    heldBy: actor,
    acceptedAllInPrice: currentAllInPrice,
  };
  const nextState = addActivity(
    { ...state, reservation },
    {
      actor,
      action: 'reservation_created',
      outcome: 'accepted',
      summary: `Created a reversible hold at the exact $${currentAllInPrice} quote. No ceiling or payment was shared.`,
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Current lot held at the exact inspected quote. No payment was taken.',
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
      summary: 'Released the hold and restored the evidence-ready action state.',
    },
  );

  return {
    ok: true,
    state: nextState,
    message: 'Reservation released.',
  };
}

export function getAvailableToolNames(state: LiveMarketState): readonly string[] {
  const names = ['inspect_live_show'];
  const evaluation = evaluateEvidence(state);

  if (state.reservation === null) {
    names.push('set_evidence_requirements');
  }

  if (state.showStatus === 'live') {
    names.push('inspect_current_lot');
  }

  const repairRequestIsQueued = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );
  if (
    state.showStatus === 'live' &&
    state.evidenceRequirements !== null &&
    evaluation.outcome === 'unresolved' &&
    state.evidenceRequirements.forbidPriorBaseRepair &&
    state.lot.evidence.repairHistory === 'unknown' &&
    !repairRequestIsQueued
  ) {
    names.push('request_host_evidence');
  }

  if (evaluation.outcome === 'ready' && state.reservation === null) {
    names.push('reserve_current_lot');
  }

  if (state.reservation !== null) {
    names.push('release_current_lot');
  }

  return names;
}

export function getActionFrontier(state: LiveMarketState): ActionFrontier {
  const evaluation = evaluateEvidence(state);
  const repairRequestIsQueued = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );
  const blocked: BlockedCapability[] = [];
  let next: ActionFrontierStep;

  if (state.reservation !== null) {
    next = {
      actor: 'agent-or-buyer',
      action: 'release_current_lot',
      instruction: 'Keep the hold, or release it to restore the evidence-ready state.',
    };
    blocked.push({
      name: 'request_host_evidence',
      reason: 'The decision already has an active hold.',
      recovery: 'Release the hold before starting a different evidence path.',
    });
    blocked.push({
      name: 'reserve_current_lot',
      reason: 'The lot is already held.',
      recovery: 'No second reservation is needed.',
    });
    return { next, blocked };
  }

  if (state.evidenceRequirements === null) {
    next = {
      actor: 'agent-or-buyer',
      action: 'set_evidence_requirements',
      instruction: 'Share only the product evidence this decision requires; keep price private.',
    };
    blocked.push({
      name: 'request_host_evidence',
      reason: 'The page does not yet know which physical facts matter.',
      recovery: 'Share bounded product-evidence requirements.',
    });
    blocked.push({
      name: 'reserve_current_lot',
      reason: 'No public evidence envelope has been evaluated.',
      recovery: 'Share evidence requirements, then resolve only the missing facts.',
    });
    return { next, blocked };
  }

  if (evaluation.outcome === 'unresolved' && !repairRequestIsQueued) {
    next = {
      actor: 'agent-or-buyer',
      action: 'request_host_evidence',
      instruction: 'Join the normalized repair-history request without sharing private context.',
    };
    blocked.push({
      name: 'reserve_current_lot',
      reason: `Public evidence is unresolved: ${evaluation.unresolved.join(', ')}.`,
      recovery: 'Ask the host for the missing repair-history demonstration.',
    });
    return { next, blocked };
  }

  if (evaluation.outcome === 'unresolved') {
    next = {
      actor: 'host',
      action: 'answer_repair_history',
      instruction: 'Show the base and disclose repair history once for the aggregated question.',
    };
    blocked.push({
      name: 'request_host_evidence',
      reason: 'An identical request is already queued.',
      recovery: 'Wait for the host answer instead of duplicating the question.',
    });
    blocked.push({
      name: 'reserve_current_lot',
      reason: `Public evidence is unresolved: ${evaluation.unresolved.join(', ')}.`,
      recovery: 'Wait for the host to answer the queued question.',
    });
    return { next, blocked };
  }

  if (evaluation.outcome === 'incompatible') {
    next = {
      actor: 'agent-or-buyer',
      action: 'skip_or_change_requirements',
      instruction: `Skip this lot, or change requirements only if the buyer explicitly changes them: ${evaluation.violated.join(', ')}.`,
    };
    blocked.push({
      name: 'reserve_current_lot',
      reason: `Public evidence violates: ${evaluation.violated.join(', ')}.`,
      recovery: 'Do not relax the requirement automatically; ask the buyer or skip the lot.',
    });
    return { next, blocked };
  }

  next = {
    actor: 'agent-or-buyer',
    action: 'reserve_current_lot',
    instruction: `Privately compare the current $${getAllInPrice(state.lot)} quote, then pass that exact quote only if a hold is wanted.`,
  };
  return { next, blocked };
}
