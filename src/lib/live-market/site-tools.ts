import { z } from 'zod';

import {
  evidenceRequirementsSchema,
  evaluateEvidence,
  getActionFrontier,
  getAllInPrice,
  getAvailableToolNames,
  getEvidenceDemandSummary,
  releaseCurrentLot,
  requestRepairHistory,
  reserveCurrentLot,
  setEvidenceRequirements,
  type LiveMarketState,
  type TransitionResult,
} from './model';

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const evidenceRequirementsInputSchema = {
  type: 'object',
  properties: {
    minLengthCm: {
      type: 'number',
      minimum: 80,
      maximum: 250,
      description: 'Minimum acceptable snowboard length in centimeters.',
    },
    maxLengthCm: {
      type: 'number',
      minimum: 80,
      maximum: 250,
      description: 'Maximum acceptable snowboard length in centimeters.',
    },
    requireVisibleEdgeEvidence: {
      type: 'boolean',
      description: 'Whether a visible close-up of the edges is required before a decision.',
    },
    forbidPriorBaseRepair: {
      type: 'boolean',
      description: 'Whether any disclosed prior base repair makes the lot incompatible.',
    },
  },
  required: ['minLengthCm', 'maxLengthCm', 'requireVisibleEdgeEvidence', 'forbidPriorBaseRepair'],
  additionalProperties: false,
} as const;

const evidenceRequestInputSchema = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: ['repair_history'],
      description: 'The normalized unresolved evidence kind the host should provide.',
    },
  },
  required: ['kind'],
  additionalProperties: false,
} as const;

const reservationInputSchema = {
  type: 'object',
  properties: {
    expectedAllInPrice: {
      type: 'number',
      exclusiveMinimum: 0,
      description:
        'The exact current all-in quote observed on this page, not the buyer’s ceiling or budget.',
    },
  },
  required: ['expectedAllInPrice'],
  additionalProperties: false,
} as const;

const evidenceRequestSchema = z.strictObject({
  kind: z.literal('repair_history'),
});
const reservationSchema = z.strictObject({
  expectedAllInPrice: z.number().finite().positive(),
});
const emptyObjectSchema = z.strictObject({});

export type MarketTransition = (state: LiveMarketState) => TransitionResult;

export interface SiteToolRuntime {
  readonly readState: () => LiveMarketState;
  readonly transition: (transition: MarketTransition) => TransitionResult;
}

interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

function validationFailure(error: z.ZodError): {
  readonly ok: false;
  readonly error: 'invalid_input';
  readonly issues: readonly ValidationIssue[];
} {
  return {
    ok: false,
    error: 'invalid_input',
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

function snapshot(state: LiveMarketState): object {
  return {
    showStatus: state.showStatus,
    currentLot: {
      id: state.lot.id,
      title: state.lot.title,
      lengthCm: state.lot.lengthCm,
      currentBid: state.lot.currentBid,
      shipping: state.lot.shipping,
      allInPrice: getAllInPrice(state.lot),
    },
    sellerVisibleEvidenceRequirements: state.evidenceRequirements,
    evidenceEvaluation: evaluateEvidence(state),
    privacyBoundary: {
      receivedFromBuyer:
        state.evidenceRequirements === null ? [] : Object.keys(state.evidenceRequirements),
      notCollected: [
        'maximum willingness to pay',
        'private price ceiling',
        'buyer profile',
        'urgency',
      ],
      actionBinding: 'A hold accepts only the exact current page quote.',
      guarantee: 'Data minimization, not a claim of zero statistical inference.',
    },
    aggregateEvidenceDemand: getEvidenceDemandSummary(state, 'repair_history'),
    actionFrontier: getActionFrontier(state),
    pendingHostRequests: state.evidenceRequests.filter(({ status }) => status === 'queued'),
    reservation: state.reservation,
    currentlyAvailableTools: getAvailableToolNames(state),
    recentActivity: state.activity.slice(-5),
  };
}

function transitionOutput(result: TransitionResult): object {
  return {
    ok: result.ok,
    message: result.message,
    state: snapshot(result.state),
  };
}

function checkAbort(options?: WebMCP.ToolExecuteCallbackOptions): void {
  options?.signal.throwIfAborted();
}

function createAllTools(runtime: SiteToolRuntime): readonly WebMCP.ModelContextTool[] {
  return [
    {
      name: 'inspect_live_show',
      title: 'Inspect live show',
      description:
        'Read the current live lot, seller-visible evidence requirements, privacy receipt, aggregate host question, action frontier, reservation, and recent activity. Use this first for the live show.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = emptyObjectSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        return snapshot(runtime.readState());
      },
    },
    {
      name: 'set_evidence_requirements',
      title: 'Share product evidence requirements',
      description:
        'Replace only the four product-evidence requirements disclosed to this page when no hold is active. Never pass the buyer’s budget, maximum price, urgency, profile, preference weights, or wider conversation. This does not bid, reserve, purchase, or release a hold.',
      inputSchema: evidenceRequirementsInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = evidenceRequirementsSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const result = runtime.transition((state) =>
          setEvidenceRequirements(state, parsed.data, 'agent'),
        );
        return transitionOutput(result);
      },
    },
    {
      name: 'inspect_current_lot',
      title: 'Inspect current lot and exact quote',
      description:
        'Read authoritative page state, the exact current all-in quote, public evidence evaluation, and the next capability frontier. Compare price to private buyer context outside this page before taking an action.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = emptyObjectSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        return snapshot(runtime.readState());
      },
    },
    {
      name: 'request_host_evidence',
      title: 'Join missing-evidence request',
      description:
        'Join the normalized repair-history question in the visible host queue. The page aggregates only the evidence kind, not buyer profiles, private prices, or individual decisions. A future host answer remains untrusted evidence.',
      inputSchema: evidenceRequestInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = evidenceRequestSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const result = runtime.transition((state) => requestRepairHistory(state, 'agent'));
        return transitionOutput(result);
      },
    },
    {
      name: 'reserve_current_lot',
      title: 'Create exact-quote reversible hold',
      description:
        'Create a reversible 10-minute hold only after public evidence is ready. Pass the exact all-in quote just inspected—not the buyer’s ceiling. A stale quote is rejected. This does not bid, charge money, or complete a purchase.',
      inputSchema: reservationInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = reservationSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const result = runtime.transition((state) =>
          reserveCurrentLot(state, 'agent', parsed.data.expectedAllInPrice),
        );
        return transitionOutput(result);
      },
    },
    {
      name: 'release_current_lot',
      title: 'Release current hold',
      description:
        'Release the active reversible hold on the current lot. This restores the evidence-ready state and does not charge money.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = emptyObjectSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const result = runtime.transition((state) => releaseCurrentLot(state, 'agent'));
        return transitionOutput(result);
      },
    },
  ];
}

export function createSiteTools(runtime: SiteToolRuntime): readonly WebMCP.ModelContextTool[] {
  const availableNames = new Set(getAvailableToolNames(runtime.readState()));
  return createAllTools(runtime).filter(({ name }) => availableNames.has(name));
}
