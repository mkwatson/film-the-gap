import { z } from 'zod';

import {
  buyerMandateSchema,
  evaluateMandate,
  getAllInPrice,
  getAvailableToolNames,
  releaseCurrentLot,
  requestRepairHistory,
  reserveCurrentLot,
  setBuyingMandate,
  type LiveMarketState,
  type TransitionResult,
} from './model';

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const buyingMandateInputSchema = {
  type: 'object',
  properties: {
    maxAllInPrice: {
      type: 'number',
      minimum: 1,
      maximum: 10_000,
      description: 'Maximum total in US dollars, including the live price and displayed shipping.',
    },
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
      description: 'Whether a visible close-up of the edges is required before reservation.',
    },
    forbidPriorBaseRepair: {
      type: 'boolean',
      description: 'Whether any disclosed prior base repair makes the lot ineligible.',
    },
  },
  required: [
    'maxAllInPrice',
    'minLengthCm',
    'maxLengthCm',
    'requireVisibleEdgeEvidence',
    'forbidPriorBaseRepair',
  ],
  additionalProperties: false,
} as const;

const evidenceRequestInputSchema = {
  type: 'object',
  properties: {
    kind: {
      type: 'string',
      enum: ['repair_history'],
      description: 'The currently unresolved evidence the host should provide.',
    },
  },
  required: ['kind'],
  additionalProperties: false,
} as const;

const evidenceRequestSchema = z.strictObject({
  kind: z.literal('repair_history'),
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
  const evaluation = evaluateMandate(state);

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
    disclosedMandate: state.mandate,
    evaluation,
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
        'Read the current live lot, the constraints disclosed to this page, evidence status, pending host requests, reservation, and recent attributed activity. Use this first when the user asks about the live show.',
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
      name: 'set_buying_mandate',
      title: 'Share buying constraints',
      description:
        'Replace the bounded buying constraints disclosed to this page for the current live lot when no hold is active. Share only the five requested fields, not the user’s wider profile or conversation. This does not bid, reserve, purchase, or release a hold.',
      inputSchema: buyingMandateInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = buyerMandateSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const result = runtime.transition((state) => setBuyingMandate(state, parsed.data, 'agent'));
        return transitionOutput(result);
      },
    },
    {
      name: 'inspect_current_lot',
      title: 'Inspect current lot evidence',
      description:
        'Read authoritative page state for the current lot and evaluate every disclosed buying constraint against its cited evidence. Use this before requesting evidence or taking an action.',
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
      title: 'Request missing evidence',
      description:
        'Add the currently unresolved repair-history question to the visible host queue. This asks the host for a disclosure and source view; it does not treat the future answer as verified automatically.',
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
      title: 'Create reversible hold',
      description:
        'Create a reversible 10-minute hold only when every disclosed constraint is currently supported. This does not place a bid, charge money, or complete a purchase.',
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
        const result = runtime.transition((state) => reserveCurrentLot(state, 'agent'));
        return transitionOutput(result);
      },
    },
    {
      name: 'release_current_lot',
      title: 'Release current hold',
      description:
        'Release the active reversible hold on the current lot. This restores the eligible action state and does not charge money.',
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
