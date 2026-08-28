import { z } from 'zod';

import {
  currentEvidenceAnswer,
  filmingMissionInputSchema,
  filmingMissionRefinementInputSchema,
  getEvidenceNetworkToolNames,
  initialEvidenceAnswer,
  productQuestionInputSchema,
  type EvidenceNetworkCommand,
  type EvidenceNetworkState,
  type EvidenceNetworkTransition,
} from './model';
import type { EvidencePhoneCaptureReceipt } from './phone-session';
import type { PublicEvidenceMission } from './remote-protocol';

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

const filmingMissionRefinementJsonSchema = {
  type: 'object',
  properties: {
    ...filmingMissionJsonSchema.properties,
    expectedRevision: {
      type: 'integer',
      minimum: 0,
      description:
        'Exact revision returned by inspect_product_evidence; prevents replacing a mission that changed after inspection.',
    },
  },
  required: [...filmingMissionJsonSchema.required, 'expectedRevision'],
  additionalProperties: false,
} as const;

const emptyObjectSchema = z.strictObject({});
const confirmPublicListingSchema = z.strictObject({ confirmPublicListing: z.literal(true) });
const confirmPublicRemovalSchema = z.strictObject({ confirmRemoval: z.literal(true) });

const confirmPublicListingJsonSchema = {
  type: 'object',
  properties: {
    confirmPublicListing: {
      type: 'boolean',
      const: true,
      description:
        'Must be true only after the user explicitly asks to publish the product question and filming instructions on the public mission board.',
    },
  },
  required: ['confirmPublicListing'],
  additionalProperties: false,
} as const;

const confirmPublicRemovalJsonSchema = {
  type: 'object',
  properties: {
    confirmRemoval: {
      type: 'boolean',
      const: true,
      description: 'Must be true to remove this filming request from the public mission board.',
    },
  },
  required: ['confirmRemoval'],
  additionalProperties: false,
} as const;

export interface EvidenceSiteToolRuntime {
  readonly readState: () => EvidenceNetworkState;
  readonly dispatch: (command: EvidenceNetworkCommand) => Promise<EvidenceNetworkTransition>;
  readonly evidenceSearch?: EvidenceSearchRuntime;
  readonly phoneCapture?: EvidencePhoneCaptureRuntime;
  readonly missionBoard?: EvidenceMissionBoardRuntime;
}

export interface EvidenceSearchRuntime {
  readonly run: (signal?: AbortSignal) => Promise<EvidenceNetworkTransition>;
}

export interface EvidencePhoneCaptureRuntime {
  readonly available: boolean;
  readonly current: () => EvidencePhoneCaptureReceipt | null;
  readonly create: () => Promise<EvidencePhoneCaptureReceipt>;
}

export interface EvidenceMissionBoardRuntime {
  readonly available: boolean;
  readonly current: () => PublicEvidenceMission | null;
  readonly publish: () => Promise<PublicEvidenceMission>;
  readonly remove: () => Promise<PublicEvidenceMission>;
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

function compactText(value: string, maximumCharacters: number): string {
  if (value.length <= maximumCharacters) {
    return value;
  }
  return `${value.slice(0, maximumCharacters - 1).trimEnd()}…`;
}

function sourceSnapshot(state: EvidenceNetworkState): {
  readonly total: number;
  readonly shown: readonly object[];
  readonly moreVisibleOnPage: boolean;
} {
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return { total: 0, shown: [], moreVisibleOnPage: false };
  }
  const decisiveObservationIds = new Set(
    currentEvidenceAnswer(state)?.decisiveObservationIds ?? [],
  );
  const ranked = evidenceCase.sources
    .map((source, index) => {
      const observations = evidenceCase.observations.filter(
        ({ citation }) => citation.sourceId === source.id,
      );
      const decisive = observations.find(({ id }) => decisiveObservationIds.has(id));
      const finding = decisive ?? observations[0] ?? null;
      const score =
        (decisive === undefined ? 0 : 100) +
        (['owned', 'authorized'].includes(source.rights) ? 20 : 0) +
        (source.mediaType === 'video' ? 10 : 0) +
        (finding !== null && finding.result !== 'inconclusive' ? 5 : 0);
      return { source, finding, score, index };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const shown = ranked.slice(0, 1).map(({ source, finding }) => ({
    id: source.id,
    title: compactText(source.title, 100),
    medium: source.mediaType,
    rights: source.rights,
    provenance: source.provenance,
    continuity: source.continuity,
    captureTiming: source.captureTiming,
    reuseScope: source.reuseScope,
    ...(source.url === null ? {} : { url: compactText(source.url, 220) }),
    ...(finding === null
      ? {}
      : {
          finding: {
            result: finding.result,
            confidence: finding.confidence,
            observation: compactText(finding.text, 180),
            citation: finding.citation.label,
          },
        }),
  }));
  return {
    total: evidenceCase.sources.length,
    shown,
    moreVisibleOnPage: evidenceCase.sources.length > shown.length,
  };
}

function availableToolNames(runtime: EvidenceSiteToolRuntime): readonly string[] {
  const names = [...getEvidenceNetworkToolNames(runtime.readState())];
  const mission = runtime.readState().activeCase?.mission;
  if ((runtime.phoneCapture?.current() ?? null) === null && mission?.status === 'open') {
    names.push('refine_filming_mission');
  }
  if (
    runtime.phoneCapture?.available === true &&
    runtime.phoneCapture.current() === null &&
    mission?.status === 'open'
  ) {
    names.push('create_phone_capture_link');
  }
  if (
    runtime.missionBoard?.available === true &&
    runtime.phoneCapture?.current() !== null &&
    mission?.status === 'open'
  ) {
    if (runtime.missionBoard.current() === null) {
      names.push('publish_filming_mission');
    } else if (runtime.missionBoard.current()?.status === 'open') {
      names.push('remove_public_filming_mission');
    }
  }
  return names;
}

export function evidenceCaseSnapshot(
  state: EvidenceNetworkState,
  phoneCapture?: EvidencePhoneCaptureRuntime,
  missionBoard?: EvidenceMissionBoardRuntime,
): object {
  const runtime = {
    readState: () => state,
    dispatch: async (): Promise<EvidenceNetworkTransition> => ({
      ok: false,
      state,
      message: 'Snapshot-only runtime.',
    }),
    ...(phoneCapture === undefined ? {} : { phoneCapture }),
    ...(missionBoard === undefined ? {} : { missionBoard }),
  } satisfies EvidenceSiteToolRuntime;
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return {
      state: 'empty',
      revision: state.revision,
      next: 'Ask one concrete question about any product.',
      availableTools: availableToolNames(runtime),
      privacyReceipt: {
        accepted: 'product name, optional public URL, observable question only',
        excluded: 'identity, budget, history, preferences, conversation',
      },
    };
  }
  const answer = currentEvidenceAnswer(state);
  const currentPhoneCapture = phoneCapture?.current() ?? null;
  const currentPublicMission = missionBoard?.current() ?? null;
  return {
    revision: state.revision,
    case: {
      product: {
        name: evidenceCase.product.name,
        ...(evidenceCase.product.suppliedUrl === null
          ? {}
          : { url: evidenceCase.product.suppliedUrl }),
      },
      question: evidenceCase.question.text,
      answer: answer === null ? null : { status: answer.status, summary: answer.summary },
      discovery:
        evidenceCase.discovery === null
          ? null
          : {
              provider: evidenceCase.discovery.provider,
              status: evidenceCase.discovery.status,
              warnings: evidenceCase.discovery.warnings.slice(0, 2),
            },
      evidence: sourceSnapshot(state),
      mission:
        evidenceCase.mission === null
          ? null
          : {
              status: evidenceCase.mission.status,
              instruction: evidenceCase.mission.instruction,
              successCriterion: evidenceCase.mission.successCriterion,
              minimumSeconds: evidenceCase.mission.minimumSeconds,
              continuousTakeRequired: evidenceCase.mission.continuousTakeRequired,
              freshCapturePhrase: evidenceCase.mission.captureChallenge.phrase,
            },
    },
    next:
      evidenceCase.discovery === null
        ? 'Search existing public product evidence before requesting new video.'
        : answer?.status === 'insufficient' && evidenceCase.mission === null
          ? 'Create a claim-specific filming mission.'
          : evidenceCase.mission?.status === 'open'
            ? currentPhoneCapture === null
              ? 'Refine if needed; then create the phone link.'
              : 'Wait for reviewed evidence from a contributor.'
            : 'Inspect how the evidence changed the answer.',
    availableTools: availableToolNames(runtime),
    phoneCapture:
      phoneCapture === undefined
        ? { available: false, connected: false }
        : {
            available: phoneCapture.available,
            connected: currentPhoneCapture !== null,
            ...(currentPhoneCapture === null ? {} : { expiresAt: currentPhoneCapture.expiresAt }),
          },
    publicMission:
      currentPublicMission === null
        ? null
        : {
            status: currentPublicMission.status,
            expiresAt: currentPublicMission.expiresAt,
          },
    privacyReceipt: {
      accepted:
        evidenceCase.product.suppliedUrl === null
          ? 'product name and observable question only'
          : 'product name, public URL, observable question only',
      excluded: 'identity, budget, history, preferences, conversation',
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
      .map(({ result, confidence, text, citation }) => {
        const source = evidenceCase.sources.find(({ id }) => id === citation.sourceId);
        return {
          result,
          confidence,
          text,
          sourceId: citation.sourceId,
          timestamp: citation.label,
          captureTiming: source?.captureTiming ?? 'unknown',
        };
      }),
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
        return evidenceCaseSnapshot(
          runtime.readState(),
          runtime.phoneCapture,
          runtime.missionBoard,
        );
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
        'Search the rights-cleared evidence network, supplied product pages, public social video, and the open web for the active product and observable question. Only previously reviewed network recordings can affect the answer; ordinary public results remain link-only leads.',
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
      name: 'refine_filming_mission',
      title: 'Refine the filming mission',
      description:
        'Replace the open mission’s recording instruction and acceptance boundary before any contributor link exists. Preserve the question and fresh-capture challenge; use the exact inspected revision so stale agent state cannot overwrite a newer mission.',
      inputSchema: filmingMissionRefinementJsonSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = filmingMissionRefinementInputSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        if ((runtime.phoneCapture?.current() ?? null) !== null) {
          return {
            ok: false,
            error: 'mission_handoff_locked',
            message:
              'A contributor link already exists. The filming target is locked for this handoff.',
            revision: runtime.readState().revision,
          };
        }
        return transitionSnapshot(
          await runtime.dispatch({
            kind: 'refine-filming-mission',
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
        untrustedContentHint: true,
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
    {
      name: 'publish_filming_mission',
      title: 'Publish filming mission to the open board',
      description:
        'Only after the user explicitly requests public recruitment, publish the active product name, optional public URL, question, filming instruction, acceptance criterion, duration, and continuity requirement for up to 24 hours. Never publishes shopper identity, preferences, history, or budget.',
      inputSchema: confirmPublicListingJsonSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = confirmPublicListingSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const board = runtime.missionBoard;
        if (board === undefined || !board.available || runtime.phoneCapture?.current() === null) {
          return {
            ok: false,
            error: 'public_mission_board_unavailable',
            message: 'Create the bounded phone case before publishing its mission.',
          };
        }
        const existing = board.current();
        const mission = existing ?? (await board.publish());
        return {
          ok: true,
          mission,
          message:
            'The mission is public for up to 24 hours. Anyone with the product can open its bounded contributor path; no shopper context was published.',
          privateShopperContext: 'not collected',
        };
      },
    },
    {
      name: 'remove_public_filming_mission',
      title: 'Remove public filming mission',
      description:
        'Remove the active filming request from the open mission board and revoke its public contributor capability. The separate private contributor link and evidence case remain available until their normal expiry.',
      inputSchema: confirmPublicRemovalJsonSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = confirmPublicRemovalSchema.safeParse(input);
        if (!parsed.success) {
          return validationFailure(parsed.error);
        }
        const board = runtime.missionBoard;
        if (board === undefined || !board.available || board.current() === null) {
          return {
            ok: false,
            error: 'public_mission_not_active',
            message: 'There is no active public mission to remove.',
          };
        }
        const mission = await board.remove();
        return {
          ok: true,
          mission,
          message: 'The filming request was removed from the public board.',
        };
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
