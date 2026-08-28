import { z } from 'zod';

import {
  currentEvidenceAnswer,
  filmingMissionInputSchema,
  getEvidenceNetworkToolNames,
  initialEvidenceAnswer,
  productQuestionInputSchema,
  type EvidenceNetworkCommand,
  type EvidenceNetworkState,
  type EvidenceNetworkTransition,
} from './model';
import type { EvidencePhoneCaptureReceipt } from './phone-session';

export type { EvidencePhoneCaptureReceipt } from './phone-session';

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const productQuestionJsonSchema = {
  type: 'object',
  properties: {
    productName: {
      type: 'string',
      minLength: 2,
      maxLength: 120,
      description: 'Public product name or model label; do not include buyer context.',
    },
    productUrl: {
      type: 'string',
      format: 'uri',
      description: 'Optional public HTTP or HTTPS product-page URL.',
    },
    question: {
      type: 'string',
      minLength: 8,
      maxLength: 280,
      description: 'One concrete product question that observable evidence could answer.',
    },
  },
  required: ['productName', 'question'],
  additionalProperties: false,
} as const;

const filmingMissionJsonSchema = {
  type: 'object',
  properties: {
    instruction: {
      type: 'string',
      minLength: 8,
      maxLength: 280,
      description: 'Exactly what a person with the product should record.',
    },
    successCriterion: {
      type: 'string',
      minLength: 8,
      maxLength: 280,
      description: 'What must stay visible or audible for the result to be useful.',
    },
    minimumSeconds: {
      type: 'integer',
      minimum: 2,
      maximum: 60,
      description: 'Minimum continuous observation length in seconds.',
    },
    continuousTakeRequired: {
      type: 'boolean',
      description: 'Whether cuts would weaken what this evidence can establish.',
    },
  },
  required: ['instruction', 'successCriterion', 'minimumSeconds', 'continuousTakeRequired'],
  additionalProperties: false,
} as const;

const emptyObjectSchema = z.strictObject({});

export interface EvidenceSiteToolRuntime {
  readonly readState: () => EvidenceNetworkState;
  readonly dispatch: (command: EvidenceNetworkCommand) => Promise<EvidenceNetworkTransition>;
  readonly evidenceSearch?: EvidenceSearchRuntime;
  readonly phoneCapture?: EvidencePhoneCaptureRuntime;
}

export interface EvidenceSearchRuntime {
  readonly run: (signal?: AbortSignal) => Promise<EvidenceNetworkTransition>;
}

export interface EvidencePhoneCaptureRuntime {
  readonly available: boolean;
  readonly current: () => EvidencePhoneCaptureReceipt | null;
  readonly create: () => Promise<EvidencePhoneCaptureReceipt>;
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

function checkAbort(options?: WebMCP.ToolExecuteCallbackOptions): void {
  options?.signal?.throwIfAborted();
}

function sourceSnapshot(state: EvidenceNetworkState): readonly object[] {
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return [];
  }
  return evidenceCase.sources.map((source) => ({
    id: source.id,
    title: source.title,
    mediaType: source.mediaType,
    rights: source.rights,
    provenance: source.provenance,
    continuity: source.continuity,
    ...(source.url === null ? {} : { url: source.url }),
    ...(source.streamUid === null ? {} : { streamUid: source.streamUid }),
    ...(source.sha256 === null ? {} : { sha256: source.sha256 }),
    observations: evidenceCase.observations
      .filter(({ citation }) => citation.sourceId === source.id)
      .map(({ result, confidence, text, citation }) => ({
        result,
        confidence,
        text,
        citation: citation.label,
      })),
  }));
}

function availableToolNames(runtime: EvidenceSiteToolRuntime): readonly string[] {
  const names = [...getEvidenceNetworkToolNames(runtime.readState())];
  const mission = runtime.readState().activeCase?.mission;
  if (
    runtime.phoneCapture?.available === true &&
    runtime.phoneCapture.current() === null &&
    mission?.status === 'open'
  ) {
    names.push('create_phone_capture_link');
  }
  return names;
}

export function evidenceCaseSnapshot(
  state: EvidenceNetworkState,
  phoneCapture?: EvidencePhoneCaptureRuntime,
): object {
  const runtime = {
    readState: () => state,
    dispatch: async (): Promise<EvidenceNetworkTransition> => ({
      ok: false,
      state,
      message: 'Snapshot-only runtime.',
    }),
    ...(phoneCapture === undefined ? {} : { phoneCapture }),
  } satisfies EvidenceSiteToolRuntime;
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return {
      case: null,
      next: 'Ask one concrete question about any product.',
      availableTools: availableToolNames(runtime),
      privacyReceipt: {
        accepted: ['product name', 'optional public product URL', 'product question'],
        notCollected: ['identity', 'budget', 'purchase history', 'private preferences'],
      },
    };
  }
  const answer = currentEvidenceAnswer(state);
  return {
    case: {
      id: evidenceCase.id,
      product: evidenceCase.product,
      question: evidenceCase.question.text,
      answer,
      discovery: evidenceCase.discovery,
      sources: sourceSnapshot(state),
      mission: evidenceCase.mission,
    },
    next:
      evidenceCase.discovery === null
        ? 'Search existing public product evidence before requesting new video.'
        : answer?.status === 'insufficient' && evidenceCase.mission === null
          ? 'Create a claim-specific filming mission.'
          : evidenceCase.mission?.status === 'open'
            ? 'Wait for a product owner to publish reviewed evidence.'
            : 'Inspect how the evidence changed the answer.',
    availableTools: availableToolNames(runtime),
    phoneCapture:
      phoneCapture === undefined
        ? { available: false, connected: false }
        : {
            available: phoneCapture.available,
            connected: phoneCapture.current() !== null,
            ...(phoneCapture.current() === null ? {} : phoneCapture.current()),
          },
    privacyReceipt: {
      accepted: ['product name', 'optional public product URL', 'product question'],
      notCollected: ['identity', 'budget', 'purchase history', 'private preferences'],
    },
  };
}

export function answerChangeSnapshot(state: EvidenceNetworkState): object {
  const evidenceCase = state.activeCase;
  if (evidenceCase === null || evidenceCase.answers.length < 2) {
    return {
      changed: false,
      message: 'No reviewed evidence has changed this answer yet.',
    };
  }
  const before = initialEvidenceAnswer(state);
  const after = currentEvidenceAnswer(state);
  return {
    changed: before?.status !== after?.status,
    question: evidenceCase.question.text,
    before,
    after,
    decisiveEvidence: evidenceCase.observations
      .filter(({ id }) => after?.decisiveObservationIds.includes(id) ?? false)
      .map(({ result, confidence, text, citation }) => ({
        result,
        confidence,
        text,
        sourceId: citation.sourceId,
        timestamp: citation.label,
      })),
  };
}

function transitionSnapshot(result: EvidenceNetworkTransition): object {
  const answer = currentEvidenceAnswer(result.state);
  return {
    ok: result.ok,
    message: result.message,
    revision: result.state.revision,
    answerStatus: answer?.status ?? null,
    missionStatus: result.state.activeCase?.mission?.status ?? null,
    availableTools: getEvidenceNetworkToolNames(result.state),
    privateShopperContext: 'not collected',
  };
}

function allEvidenceSiteTools(
  runtime: EvidenceSiteToolRuntime,
): readonly WebMCP.ModelContextTool[] {
  return [
    {
      name: 'inspect_product_evidence',
      title: 'Inspect product evidence',
      description:
        'Read the active product question, claim-specific sources, citations, rights, answer, open filming mission, privacy receipt, and valid next action. Use on arrival and after evidence changes.',
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
        return evidenceCaseSnapshot(runtime.readState(), runtime.phoneCapture);
      },
    },
    {
      name: 'ask_product_question',
      title: 'Ask a product evidence question',
      description:
        'Open or replace the active case with one public product name, optional product-page URL, and observable question. The schema cannot receive identity, budget, history, or private preferences.',
      inputSchema: productQuestionJsonSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = productQuestionInputSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        return transitionSnapshot(
          await runtime.dispatch({
            kind: 'ask-product-question',
            actor: 'agent',
            input: parsed.data,
          }),
        );
      },
    },
    {
      name: 'search_product_evidence',
      title: 'Search existing product evidence',
      description:
        'Search supplied product pages, public social video, and the open web for the active product and observable question. Results are stored only as link-only discovery leads and never treated as proof merely because they are public or relevant-looking.',
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
        if (runtime.evidenceSearch === undefined) {
          return {
            ok: false,
            error: 'evidence_search_unavailable',
            message: 'Public evidence search is not configured on this page.',
          };
        }
        return transitionSnapshot(await runtime.evidenceSearch.run(options?.signal));
      },
    },
    {
      name: 'create_filming_mission',
      title: 'Create a filming mission',
      description:
        'Turn the unresolved product question into one bounded recording instruction and acceptance criterion for a person who has the product. This creates no review, recommendation, purchase, or message to an unknown person.',
      inputSchema: filmingMissionJsonSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = filmingMissionInputSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        return transitionSnapshot(
          await runtime.dispatch({
            kind: 'create-filming-mission',
            actor: 'agent',
            input: parsed.data,
          }),
        );
      },
    },
    {
      name: 'create_phone_capture_link',
      title: 'Create a phone capture link',
      description:
        'Persist the open filming mission and create one bounded no-login contributor link. The capability permits only a reserved video upload and reviewed evidence publication for this case; it does not contact anyone.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: false,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = emptyObjectSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const phoneCapture = runtime.phoneCapture;
        if (phoneCapture === undefined || !phoneCapture.available) {
          return {
            ok: false,
            error: 'phone_capture_unavailable',
            message: 'The shared evidence service is not configured on this deployment.',
          };
        }
        const current = phoneCapture.current();
        const receipt = current ?? (await phoneCapture.create());
        return {
          ok: true,
          ...receipt,
          message:
            'The page now shows a QR code and bounded contributor link. Wait for reviewed evidence; do not infer the result.',
          privateShopperContext: 'not collected',
        };
      },
    },
    {
      name: 'inspect_answer_change',
      title: 'Inspect evidence-caused answer change',
      description:
        'Compare the original answer with the current answer and return only the reviewed observations and timestamp citations that caused the change.',
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
        return answerChangeSnapshot(runtime.readState());
      },
    },
  ];
}

export function createEvidenceSiteTools(
  runtime: EvidenceSiteToolRuntime,
): readonly WebMCP.ModelContextTool[] {
  const available = new Set(availableToolNames(runtime));
  return allEvidenceSiteTools(runtime).filter(({ name }) => available.has(name));
}
