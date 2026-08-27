import { z } from 'zod';

import {
  evidenceRequirementsSchema,
  evaluateEvidence,
  getActionFrontier,
  getAllInPrice,
  getAvailableToolNames,
  getEvidenceDemandSummary,
  type LiveMarketState,
  type TransitionResult,
} from './model';
import type { RoomCommand } from './room-command';

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

export interface SiteToolRuntime {
  readonly readState: () => LiveMarketState;
  readonly dispatch: (command: RoomCommand) => Promise<TransitionResult>;
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
  const demand = getEvidenceDemandSummary(state, 'repair_history');
  const evidenceFrame = state.lot.evidence.repairEvidenceFrame;
  const visualReview = state.lot.evidence.visualReview;
  const held = state.reservation !== null;

  return {
    show: {
      status: state.showStatus,
    },
    lot: {
      id: state.lot.id,
      title: state.lot.title,
      lengthCm: state.lot.lengthCm,
      exactAllInQuote: getAllInPrice(state.lot),
    },
    decisionEvidence: {
      requirements: state.evidenceRequirements,
      outcome: evaluation.outcome,
      ...(evaluation.unresolved.length === 0 ? {} : { unresolved: evaluation.unresolved }),
      ...(evaluation.violated.length === 0 ? {} : { violated: evaluation.violated }),
    },
    publishedEvidence: {
      edge: {
        condition: state.lot.evidence.edgeCondition,
        ...(held ? {} : { source: state.lot.evidence.edgeEvidenceSource }),
      },
      repairHistory: state.lot.evidence.repairHistory,
      ...(held || state.lot.evidence.repairEvidenceSource === null
        ? {}
        : { repairHistorySource: state.lot.evidence.repairEvidenceSource }),
      ...(held || evidenceFrame === null
        ? {}
        : {
            selectedFrame: {
              kind: evidenceFrame.kind,
              frameId: evidenceFrame.frameId,
              capturedAt: evidenceFrame.capturedAt,
              sha256: evidenceFrame.sha256,
              widthPx: evidenceFrame.widthPx,
              heightPx: evidenceFrame.heightPx,
            },
          }),
      selectedFramePubliclyVisible: state.lot.evidence.repairEvidenceImage !== null,
      ...(held || visualReview === null
        ? {}
        : {
            reviewedObservation: {
              source: visualReview.source,
              modelId: visualReview.modelId,
              hostDecision: visualReview.hostDecision,
              baseVisibility: visualReview.reviewedFinding.baseVisibility,
              surfaceFinding: visualReview.reviewedFinding.surfaceFinding,
            },
          }),
      ...(held
        ? {}
        : { repairHistoryProof: 'Host attestation; a frame proves only visible surface.' }),
    },
    hostRequest: {
      kind: demand.kind,
      totalAgentCount: demand.totalAgentCount,
      status: demand.status,
    },
    hold:
      state.reservation === null
        ? null
        : {
            heldBy: state.reservation.heldBy,
            acceptedAllInPrice: state.reservation.acceptedAllInPrice,
          },
    commerce: {
      protocol: state.commerce.available ? 'UCP' : null,
      protocolVersion: state.commerce.protocolVersion,
      merchantOrigin: state.commerce.merchantOrigin,
      cartStatus: state.commerce.cartStatus,
      ...(state.commerce.receipt === null
        ? {}
        : {
            receipt: {
              currency: state.commerce.receipt.currency,
              lineItems: state.commerce.receipt.lineItems,
              totals: state.commerce.receipt.totals.map(({ type, amount }) => ({ type, amount })),
              messages: state.commerce.receipt.messages.map(({ content }) => ({ content })),
              continuationAvailable: state.commerce.receipt.continuationAvailable,
            },
          }),
      ...(state.commerce.lastError === null ? {} : { lastError: state.commerce.lastError }),
      privateCredential: 'withheld',
    },
    next: {
      actor: frontier.next.actor,
      action: frontier.next.action,
      availableTools: getAvailableToolNames(state),
    },
    privacyReceipt: {
      sharedFields:
        state.evidenceRequirements === null ? [] : Object.keys(state.evidenceRequirements),
      withheldFields: [
        'maximum price',
        'identity',
        'address',
        'payment',
        'merchant cart credential',
      ],
      holdBinding: 'exactAllInQuote only',
    },
  };
}

function transitionOutput(result: TransitionResult): object {
  const evaluation = evaluateEvidence(result.state);
  const demand = getEvidenceDemandSummary(result.state, 'repair_history');
  const frontier = getActionFrontier(result.state);
  return {
    ok: result.ok,
    message: result.message,
    state: {
      evidenceOutcome: evaluation.outcome,
      hostRequest: {
        totalAgentCount: demand.totalAgentCount,
        status: demand.status,
      },
      hold:
        result.state.reservation === null
          ? null
          : {
              heldBy: result.state.reservation.heldBy,
              acceptedAllInPrice: result.state.reservation.acceptedAllInPrice,
            },
      commerce: {
        cartStatus: result.state.commerce.cartStatus,
        ...(result.state.commerce.receipt === null
          ? {}
          : {
              receipt: {
                currency: result.state.commerce.receipt.currency,
                totals: result.state.commerce.receipt.totals.map(({ type, amount }) => ({
                  type,
                  amount,
                })),
                continuationAvailable: result.state.commerce.receipt.continuationAvailable,
              },
            }),
      },
      next: {
        action: frontier.next.action,
        availableTools: getAvailableToolNames(result.state),
      },
      privateBuyerContext: 'withheld',
    },
    ...(result.privateResult === undefined ? {} : { privateAction: result.privateResult }),
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
        const result = await runtime.dispatch({
          kind: 'set-evidence-requirements',
          actor: 'agent',
          requirements: parsed.data,
        });
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
        const result = await runtime.dispatch({
          kind: 'request-repair-history',
          actor: 'agent',
        });
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
        const result = await runtime.dispatch({
          kind: 'reserve-current-lot',
          actor: 'agent',
          expectedAllInPrice: parsed.data.expectedAllInPrice,
        });
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
        const result = await runtime.dispatch({
          kind: 'release-current-lot',
          actor: 'agent',
        });
        return transitionOutput(result);
      },
    },
    {
      name: 'prepare_merchant_cart',
      title: 'Prepare authoritative merchant cart',
      description:
        'After public evidence and an exact-quote hold are ready, create a reversible anonymous UCP cart from the merchant’s current terms. Sends product/context only—never buyer identity, private ceiling, address, or payment—and stops before checkout.',
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
        const result = await runtime.dispatch({
          kind: 'prepare-merchant-cart',
          actor: 'agent',
        });
        return transitionOutput(result);
      },
    },
    {
      name: 'cancel_merchant_cart',
      title: 'Cancel authoritative merchant cart',
      description:
        'Cancel the active anonymous UCP merchant cart and discard its private server-held credential. This does not start checkout or take payment.',
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
        const result = await runtime.dispatch({
          kind: 'cancel-merchant-cart',
          actor: 'agent',
        });
        return transitionOutput(result);
      },
    },
  ];
}

export function createSiteTools(runtime: SiteToolRuntime): readonly WebMCP.ModelContextTool[] {
  const availableNames = new Set(getAvailableToolNames(runtime.readState()));
  return createAllTools(runtime).filter(({ name }) => availableNames.has(name));
}
