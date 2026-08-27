import { z } from 'zod';

import { historicalEvidenceLimitation } from './evidence-proposal';
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
  const evaluation = evaluateEvidence(state);
  const frontier = getActionFrontier(state);
  const evidenceFrame = state.lot.evidence.repairEvidenceFrame;
  const visualReview = state.lot.evidence.visualReview;

  return {
    show: {
      status: state.showStatus,
    },
    lot: {
      id: state.lot.id,
      title: state.lot.title,
      lengthCm: state.lot.lengthCm,
      exactAllInQuote: getAllInPrice(state.lot),
      closesInSeconds: state.lot.closesInSeconds,
    },
    decisionEvidence: {
      requirements: state.evidenceRequirements,
      outcome: evaluation.outcome,
      conditions: evaluation.conditions.map(({ id, status, detail, source }) => ({
        id,
        status,
        detail,
        source,
      })),
      unresolved: evaluation.unresolved,
      violated: evaluation.violated,
    },
    publishedEvidence: {
      edge: {
        condition: state.lot.evidence.edgeCondition,
        source: state.lot.evidence.edgeEvidenceSource,
      },
      repairHistory: state.lot.evidence.repairHistory,
      repairHistorySource: state.lot.evidence.repairEvidenceSource,
      selectedFrame:
        evidenceFrame === null
          ? null
          : {
              kind: evidenceFrame.kind,
              frameId: evidenceFrame.frameId,
              capturedAt: evidenceFrame.capturedAt,
              showOffsetSeconds: evidenceFrame.showOffsetSeconds,
              sha256: evidenceFrame.sha256,
              widthPx: evidenceFrame.widthPx,
              heightPx: evidenceFrame.heightPx,
            },
      selectedFramePubliclyVisible: state.lot.evidence.repairEvidenceImage !== null,
      reviewedObservation:
        visualReview === null
          ? null
          : {
              source: visualReview.source,
              modelId: visualReview.modelId,
              hostDecision: visualReview.hostDecision,
              baseVisibility: visualReview.reviewedFinding.baseVisibility,
              surfaceFinding: visualReview.reviewedFinding.surfaceFinding,
              confidence: visualReview.reviewedFinding.confidence,
              summary: visualReview.reviewedFinding.summary,
            },
      limitation: historicalEvidenceLimitation,
    },
    hostRequest: getEvidenceDemandSummary(state, 'repair_history'),
    hold: state.reservation,
    next: {
      actor: frontier.next.actor,
      action: frontier.next.action,
      instruction: frontier.next.instruction,
      availableTools: getAvailableToolNames(state),
    },
    privacyReceipt: {
      sharedFields:
        state.evidenceRequirements === null ? [] : Object.keys(state.evidenceRequirements),
      withheldFields: ['maximum price', 'buyer identity', 'urgency', 'preference weights'],
      holdBinding: 'exact current page quote only',
    },
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
  options?.signal?.throwIfAborted();
}

function createAllTools(runtime: SiteToolRuntime): readonly WebMCP.ModelContextTool[] {
  return [
    {
      name: 'inspect_live_show',
      title: 'Inspect live show',
      description:
        'Read the current lot, exact all-in quote, public evidence, privacy receipt, aggregate host request, hold, and next available action. Use when arriving or after the page changes.',
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
        'Publish the four product-evidence requirements this seller can act on: length range, visible-edge requirement, and repair-history policy. The schema accepts only those fields and changes no quote or hold.',
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
      name: 'request_host_evidence',
      title: 'Join missing-evidence request',
      description:
        'Add this page’s repair-history need to the host’s anonymous aggregate queue. The host receives one normalized product question and the resulting answer remains reviewable public evidence.',
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
        'Create a reversible 10-minute hold after public evidence is ready, using the exact current all-in quote from inspect_live_show. Changed quotes are rejected. This takes no payment.',
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
