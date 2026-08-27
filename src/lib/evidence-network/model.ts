import { z } from 'zod';

export const evidenceAnswerStatuses = [
  'insufficient',
  'supported',
  'contradicted',
  'mixed',
] as const;
export type EvidenceAnswerStatus = (typeof evidenceAnswerStatuses)[number];

export const evidenceResults = ['supports', 'contradicts', 'inconclusive'] as const;
export type EvidenceResult = (typeof evidenceResults)[number];

export const evidenceConfidences = ['low', 'medium', 'high'] as const;
export type EvidenceConfidence = (typeof evidenceConfidences)[number];

export const sourceRights = ['owned', 'authorized', 'link_only', 'unknown'] as const;
export type SourceRights = (typeof sourceRights)[number];

export const sourceProvenanceKinds = [
  'live_capture',
  'authorized_import',
  'demo_replay',
  'external_link',
] as const;
export type SourceProvenanceKind = (typeof sourceProvenanceKinds)[number];

export const sourceContinuityKinds = ['continuous', 'edited', 'still', 'unknown'] as const;
export type SourceContinuityKind = (typeof sourceContinuityKinds)[number];

export const evidenceActors = ['human', 'agent', 'contributor', 'system'] as const;
export type EvidenceActor = (typeof evidenceActors)[number];

const httpUrlSchema = z
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'Use an HTTP or HTTPS URL.',
  });

export const productQuestionInputSchema = z.strictObject({
  productName: z.string().trim().min(2).max(120),
  productUrl: httpUrlSchema.optional(),
  question: z.string().trim().min(8).max(280),
});

export type ProductQuestionInput = z.infer<typeof productQuestionInputSchema>;

export const filmingMissionInputSchema = z.strictObject({
  instruction: z.string().trim().min(8).max(280),
  successCriterion: z.string().trim().min(8).max(280),
  minimumSeconds: z.number().int().min(2).max(60),
  continuousTakeRequired: z.boolean(),
});

export type FilmingMissionInput = z.infer<typeof filmingMissionInputSchema>;

export const reviewedEvidenceInputSchema = z
  .strictObject({
    result: z.enum(evidenceResults),
    observation: z.string().trim().min(4).max(360),
    contributorLabel: z.string().trim().min(2).max(80),
    durationSeconds: z.number().int().min(1).max(300),
    confidence: z.enum(evidenceConfidences),
    rights: z.enum(['owned', 'authorized']),
    provenance: z.enum(['live_capture', 'authorized_import', 'demo_replay']),
    capturedAt: z.iso.datetime(),
    videoUrl: httpUrlSchema.optional(),
    streamUid: z
      .string()
      .regex(/^[a-zA-Z0-9_-]{16,128}$/)
      .optional(),
    sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.provenance === 'live_capture' && value.streamUid === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['streamUid'],
        message: 'A live capture must reference its reserved video upload.',
      });
    }
  });

export type ReviewedEvidenceInput = z.infer<typeof reviewedEvidenceInputSchema>;

export interface ProductReference {
  readonly id: string;
  readonly name: string;
  readonly suppliedUrl: string | null;
}

export interface ProductQuestion {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
}

export interface EvidenceSource {
  readonly id: string;
  readonly title: string;
  readonly url: string | null;
  readonly mediaType: 'web_page' | 'video' | 'image';
  readonly rights: SourceRights;
  readonly provenance: SourceProvenanceKind;
  readonly continuity: SourceContinuityKind;
  readonly contributorLabel: string;
  readonly createdAt: string;
  readonly streamUid: string | null;
  readonly sha256: string | null;
}

export interface EvidenceCitation {
  readonly sourceId: string;
  readonly startSeconds: number | null;
  readonly endSeconds: number | null;
  readonly label: string;
}

export interface EvidenceObservation {
  readonly id: string;
  readonly claim: string;
  readonly result: EvidenceResult;
  readonly confidence: EvidenceConfidence;
  readonly text: string;
  readonly citation: EvidenceCitation;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
}

export interface FilmingMission {
  readonly id: string;
  readonly status: 'open' | 'fulfilled';
  readonly instruction: string;
  readonly successCriterion: string;
  readonly minimumSeconds: number;
  readonly continuousTakeRequired: boolean;
  readonly createdAt: string;
  readonly fulfilledAt: string | null;
}

export interface EvidenceAnswer {
  readonly id: string;
  readonly status: EvidenceAnswerStatus;
  readonly summary: string;
  readonly decisiveObservationIds: readonly string[];
  readonly revision: number;
  readonly createdAt: string;
}

export interface ProductEvidenceCase {
  readonly id: string;
  readonly product: ProductReference;
  readonly question: ProductQuestion;
  readonly sources: readonly EvidenceSource[];
  readonly observations: readonly EvidenceObservation[];
  readonly mission: FilmingMission | null;
  readonly answers: readonly EvidenceAnswer[];
}

export interface EvidenceActivity {
  readonly id: string;
  readonly actor: EvidenceActor;
  readonly action: string;
  readonly summary: string;
  readonly createdAt: string;
}

export interface EvidenceNetworkState {
  readonly revision: number;
  readonly activeCase: ProductEvidenceCase | null;
  readonly activity: readonly EvidenceActivity[];
}

export type EvidenceNetworkCommand =
  | {
      readonly kind: 'ask-product-question';
      readonly actor: Extract<EvidenceActor, 'human' | 'agent'>;
      readonly input: ProductQuestionInput;
    }
  | {
      readonly kind: 'create-filming-mission';
      readonly actor: Extract<EvidenceActor, 'human' | 'agent'>;
      readonly input: FilmingMissionInput;
    }
  | {
      readonly kind: 'publish-reviewed-evidence';
      readonly actor: 'contributor';
      readonly input: ReviewedEvidenceInput;
    };

export interface EvidenceNetworkTransition {
  readonly ok: boolean;
  readonly state: EvidenceNetworkState;
  readonly message: string;
}

const demoTimestamp = '2026-08-27T12:00:00.000Z';

function nextId(prefix: string, revision: number): string {
  return `${prefix}-${revision}`;
}

function insufficientAnswer(revision: number, createdAt: string): EvidenceAnswer {
  return {
    id: nextId('answer', revision),
    status: 'insufficient',
    summary: 'Not enough reviewed, claim-specific evidence yet.',
    decisiveObservationIds: [],
    revision,
    createdAt,
  };
}

function activity(
  revision: number,
  actor: EvidenceActor,
  action: string,
  summary: string,
  createdAt: string,
): EvidenceActivity {
  return {
    id: nextId('activity', revision),
    actor,
    action,
    summary,
    createdAt,
  };
}

function sourceForObservation(
  evidenceCase: ProductEvidenceCase,
  observation: EvidenceObservation,
): EvidenceSource | null {
  return evidenceCase.sources.find(({ id }) => id === observation.citation.sourceId) ?? null;
}

function isDecisionGrade(
  evidenceCase: ProductEvidenceCase,
  observation: EvidenceObservation,
): boolean {
  const source = sourceForObservation(evidenceCase, observation);
  return (
    source !== null &&
    ['owned', 'authorized'].includes(source.rights) &&
    observation.confidence !== 'low' &&
    observation.result !== 'inconclusive'
  );
}

export function deriveEvidenceAnswer(
  evidenceCase: ProductEvidenceCase,
  revision: number,
  createdAt: string,
): EvidenceAnswer {
  const decisive = evidenceCase.observations.filter((observation) =>
    isDecisionGrade(evidenceCase, observation),
  );
  const supports = decisive.filter(({ result }) => result === 'supports');
  const contradicts = decisive.filter(({ result }) => result === 'contradicts');

  if (supports.length > 0 && contradicts.length > 0) {
    return {
      id: nextId('answer', revision),
      status: 'mixed',
      summary: 'Reviewed evidence conflicts; another targeted observation is needed.',
      decisiveObservationIds: decisive.map(({ id }) => id),
      revision,
      createdAt,
    };
  }

  if (supports.length > 0) {
    return {
      id: nextId('answer', revision),
      status: 'supported',
      summary: 'Supported by reviewed, claim-specific video evidence.',
      decisiveObservationIds: supports.map(({ id }) => id),
      revision,
      createdAt,
    };
  }

  if (contradicts.length > 0) {
    return {
      id: nextId('answer', revision),
      status: 'contradicted',
      summary: 'Contradicted by reviewed, claim-specific video evidence.',
      decisiveObservationIds: contradicts.map(({ id }) => id),
      revision,
      createdAt,
    };
  }

  return insufficientAnswer(revision, createdAt);
}

export function createEmptyEvidenceNetworkState(): EvidenceNetworkState {
  return {
    revision: 0,
    activeCase: null,
    activity: [],
  };
}

export function createDemoEvidenceNetworkState(): EvidenceNetworkState {
  const source: EvidenceSource = {
    id: 'source-1',
    title: 'Rights-cleared demo product page',
    url: null,
    mediaType: 'web_page',
    rights: 'owned',
    provenance: 'demo_replay',
    continuity: 'unknown',
    contributorLabel: 'Demo catalog',
    createdAt: demoTimestamp,
    streamUid: null,
    sha256: null,
  };
  const observation: EvidenceObservation = {
    id: 'observation-1',
    claim: 'The filled bottle stays leak-free while inverted for ten seconds.',
    result: 'inconclusive',
    confidence: 'high',
    text: 'The page says “leak resistant” but contains no continuous inverted test.',
    citation: {
      sourceId: source.id,
      startSeconds: null,
      endSeconds: null,
      label: 'Product-page copy',
    },
    reviewedBy: 'Pilot source scan',
    reviewedAt: demoTimestamp,
  };
  const evidenceCase: ProductEvidenceCase = {
    id: 'case-1',
    product: {
      id: 'product-1',
      name: 'Everyday insulated travel bottle',
      suppliedUrl: null,
    },
    question: {
      id: 'question-1',
      text: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
      createdAt: demoTimestamp,
    },
    sources: [source],
    observations: [observation],
    mission: null,
    answers: [insufficientAnswer(1, demoTimestamp)],
  };
  return {
    revision: 1,
    activeCase: evidenceCase,
    activity: [
      activity(
        1,
        'system',
        'source_scan',
        'The supplied source was indexed, but it did not contain decisive observable proof.',
        demoTimestamp,
      ),
    ],
  };
}

export function currentEvidenceAnswer(state: EvidenceNetworkState): EvidenceAnswer | null {
  return state.activeCase?.answers.at(-1) ?? null;
}

export function initialEvidenceAnswer(state: EvidenceNetworkState): EvidenceAnswer | null {
  return state.activeCase?.answers[0] ?? null;
}

export function getEvidenceNetworkToolNames(state: EvidenceNetworkState): readonly string[] {
  const names = ['inspect_product_evidence', 'ask_product_question'];
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return names;
  }
  const answer = currentEvidenceAnswer(state);
  if (
    answer?.status === 'insufficient' &&
    (evidenceCase.mission === null || evidenceCase.mission.status === 'fulfilled')
  ) {
    names.push('create_filming_mission');
  }
  if (evidenceCase.answers.length > 1) {
    names.push('inspect_answer_change');
  }
  return names;
}

function askProductQuestion(
  state: EvidenceNetworkState,
  input: ProductQuestionInput,
  actor: Extract<EvidenceActor, 'human' | 'agent'>,
  now: string,
): EvidenceNetworkTransition {
  const parsed = productQuestionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, state, message: parsed.error.issues[0]?.message ?? 'Invalid question.' };
  }
  const revision = state.revision + 1;
  const suppliedSource: EvidenceSource | null =
    parsed.data.productUrl === undefined
      ? null
      : {
          id: nextId('source', revision),
          title: 'Shopper-supplied product page',
          url: parsed.data.productUrl,
          mediaType: 'web_page',
          rights: 'link_only',
          provenance: 'external_link',
          continuity: 'unknown',
          contributorLabel: 'External publisher',
          createdAt: now,
          streamUid: null,
          sha256: null,
        };
  const evidenceCase: ProductEvidenceCase = {
    id: nextId('case', revision),
    product: {
      id: nextId('product', revision),
      name: parsed.data.productName,
      suppliedUrl: parsed.data.productUrl ?? null,
    },
    question: {
      id: nextId('question', revision),
      text: parsed.data.question,
      createdAt: now,
    },
    sources: suppliedSource === null ? [] : [suppliedSource],
    observations: [],
    mission: null,
    answers: [insufficientAnswer(revision, now)],
  };
  return {
    ok: true,
    state: {
      revision,
      activeCase: evidenceCase,
      activity: [
        ...state.activity,
        activity(
          revision,
          actor,
          'ask_product_question',
          `Opened a product-evidence case for “${parsed.data.productName}”.`,
          now,
        ),
      ],
    },
    message: 'Product question opened. Private shopping context was not collected.',
  };
}

function createFilmingMission(
  state: EvidenceNetworkState,
  input: FilmingMissionInput,
  actor: Extract<EvidenceActor, 'human' | 'agent'>,
  now: string,
): EvidenceNetworkTransition {
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return { ok: false, state, message: 'Ask a product question before creating a mission.' };
  }
  const parsed = filmingMissionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, state, message: parsed.error.issues[0]?.message ?? 'Invalid mission.' };
  }
  if (evidenceCase.mission?.status === 'open') {
    return { ok: false, state, message: 'This case already has an open filming mission.' };
  }
  const answer = currentEvidenceAnswer(state);
  if (answer !== null && !['insufficient', 'mixed'].includes(answer.status)) {
    return {
      ok: false,
      state,
      message:
        'The current answer is already decisive; inspect it before requesting more evidence.',
    };
  }
  const revision = state.revision + 1;
  const mission: FilmingMission = {
    id: nextId('mission', revision),
    status: 'open',
    ...parsed.data,
    createdAt: now,
    fulfilledAt: null,
  };
  return {
    ok: true,
    state: {
      revision,
      activeCase: { ...evidenceCase, mission },
      activity: [
        ...state.activity,
        activity(
          revision,
          actor,
          'create_filming_mission',
          'Created one bounded, claim-specific filming request.',
          now,
        ),
      ],
    },
    message: 'Filming mission ready for a person who has the product.',
  };
}

function publishReviewedEvidence(
  state: EvidenceNetworkState,
  input: ReviewedEvidenceInput,
  now: string,
): EvidenceNetworkTransition {
  const evidenceCase = state.activeCase;
  if (evidenceCase?.mission?.status !== 'open') {
    return { ok: false, state, message: 'There is no open filming mission to fulfill.' };
  }
  const parsed = reviewedEvidenceInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, state, message: parsed.error.issues[0]?.message ?? 'Invalid evidence.' };
  }
  if (parsed.data.durationSeconds < evidenceCase.mission.minimumSeconds) {
    return {
      ok: false,
      state,
      message: `The reviewed video must show at least ${evidenceCase.mission.minimumSeconds} continuous seconds.`,
    };
  }
  const revision = state.revision + 1;
  const sourceId = nextId('source', revision);
  const source: EvidenceSource = {
    id: sourceId,
    title:
      parsed.data.provenance === 'demo_replay'
        ? 'Clearly labeled mission replay'
        : 'Contributor-recorded mission video',
    url: parsed.data.videoUrl ?? null,
    mediaType: 'video',
    rights: parsed.data.rights,
    provenance: parsed.data.provenance,
    continuity: evidenceCase.mission.continuousTakeRequired ? 'continuous' : 'unknown',
    contributorLabel: parsed.data.contributorLabel,
    createdAt: parsed.data.capturedAt,
    streamUid: parsed.data.streamUid ?? null,
    sha256: parsed.data.sha256 ?? null,
  };
  const observation: EvidenceObservation = {
    id: nextId('observation', revision),
    claim: evidenceCase.question.text,
    result: parsed.data.result,
    confidence: parsed.data.confidence,
    text: parsed.data.observation,
    citation: {
      sourceId,
      startSeconds: 0,
      endSeconds: parsed.data.durationSeconds,
      label: `00:00–00:${String(parsed.data.durationSeconds).padStart(2, '0')}`,
    },
    reviewedBy: parsed.data.contributorLabel,
    reviewedAt: now,
  };
  const nextCaseWithoutAnswer: ProductEvidenceCase = {
    ...evidenceCase,
    sources: [...evidenceCase.sources, source],
    observations: [...evidenceCase.observations, observation],
    mission: {
      ...evidenceCase.mission,
      status: 'fulfilled',
      fulfilledAt: now,
    },
  };
  const answer = deriveEvidenceAnswer(nextCaseWithoutAnswer, revision, now);
  const nextCase = {
    ...nextCaseWithoutAnswer,
    answers: [...evidenceCase.answers, answer],
  };
  return {
    ok: true,
    state: {
      revision,
      activeCase: nextCase,
      activity: [
        ...state.activity,
        activity(
          revision,
          'contributor',
          'publish_reviewed_evidence',
          `Published a reviewed ${source.provenance.replaceAll('_', ' ')} observation.`,
          now,
        ),
      ],
    },
    message: `Reviewed evidence published. The answer is now ${answer.status}.`,
  };
}

export function applyEvidenceNetworkCommand(
  state: EvidenceNetworkState,
  command: EvidenceNetworkCommand,
  now = new Date().toISOString(),
): EvidenceNetworkTransition {
  if (command.kind === 'ask-product-question') {
    return askProductQuestion(state, command.input, command.actor, now);
  }
  if (command.kind === 'create-filming-mission') {
    return createFilmingMission(state, command.input, command.actor, now);
  }
  return publishReviewedEvidence(state, command.input, now);
}
