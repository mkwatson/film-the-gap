import { z } from 'zod';

import { createCaptureChallenge, type CaptureChallenge } from './capture-challenge';
import { canonicalizePublicDiscoveryUrl, publicHttpUrlSchema } from './url-policy';

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
  'authored_fixture',
  'demo_replay',
  'external_link',
] as const;
export type SourceProvenanceKind = (typeof sourceProvenanceKinds)[number];

export const sourceContinuityKinds = ['continuous', 'edited', 'still', 'unknown'] as const;
export type SourceContinuityKind = (typeof sourceContinuityKinds)[number];

export const sourceCaptureTimings = [
  'mission_challenge_verified',
  'contributor_attested',
  'preexisting',
  'unknown',
] as const;
export type SourceCaptureTiming = (typeof sourceCaptureTimings)[number];

export const evidenceReuseScopes = ['not_eligible', 'case_only', 'public_network'] as const;
export type EvidenceReuseScope = (typeof evidenceReuseScopes)[number];
export const publicNetworkEvidenceRetentionDays = 30;

export interface ReusableEvidenceQualificationInput {
  readonly result: EvidenceResult;
  readonly confidence: EvidenceConfidence;
  readonly continuity: Extract<SourceContinuityKind, 'continuous' | 'edited' | 'unknown'>;
}

export function qualifiesForPublicNetworkReuse(input: ReusableEvidenceQualificationInput): boolean {
  return (
    input.result !== 'inconclusive' &&
    input.confidence !== 'low' &&
    input.continuity === 'continuous'
  );
}

export const evidenceActors = ['human', 'agent', 'contributor', 'system'] as const;
export type EvidenceActor = (typeof evidenceActors)[number];

export const evidenceDiscoveryPlatforms = ['tiktok', 'instagram', 'youtube', 'web'] as const;
export type EvidenceDiscoveryPlatform = (typeof evidenceDiscoveryPlatforms)[number];

export const evidenceDiscoveryStatuses = ['complete', 'partial', 'unavailable'] as const;
export type EvidenceDiscoveryStatus = (typeof evidenceDiscoveryStatuses)[number];

export const evidenceDiscoveryProviders = [
  'evidence_network',
  'scrapecreators',
  'vercel_ai_gateway',
  'rights_clean_demo',
] as const;
export type EvidenceDiscoveryProvider = (typeof evidenceDiscoveryProviders)[number];

export const productQuestionInputSchema = z.strictObject({
  productName: z.string().trim().min(2).max(120),
  productUrl: publicHttpUrlSchema.optional(),
  question: z.string().trim().min(8).max(280),
});

export type ProductQuestionInput = z.infer<typeof productQuestionInputSchema>;

export const reusableEvidenceRecordSchema = z
  .strictObject({
    id: z.string().regex(/^[a-zA-Z0-9:_-]{4,320}$/),
    productName: z.string().trim().min(2).max(120),
    productUrl: publicHttpUrlSchema.nullable(),
    question: z.string().trim().min(8).max(280),
    source: z.strictObject({
      title: z.string().trim().min(1).max(240),
      videoUrl: publicHttpUrlSchema,
      rights: z.enum(['owned', 'authorized']),
      provenance: z.enum(['live_capture', 'authorized_import']),
      continuity: z.enum(['continuous', 'edited', 'unknown']),
      captureTiming: z.enum(sourceCaptureTimings),
      contributorLabel: z.string().trim().min(2).max(80),
      capturedAt: z.iso.datetime(),
      streamUid: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      durationSeconds: z.number().int().min(1).max(300),
    }),
    observation: z.strictObject({
      result: z.enum(evidenceResults),
      confidence: z.enum(evidenceConfidences),
      text: z.string().trim().min(4).max(360),
      citationStartSeconds: z.number().int().nonnegative(),
      citationEndSeconds: z.number().int().positive(),
      reviewedAt: z.iso.datetime(),
    }),
    indexedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    if (
      value.source.provenance === 'live_capture' &&
      !['mission_challenge_verified', 'contributor_attested'].includes(value.source.captureTiming)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['source', 'captureTiming'],
        message: 'Reusable live capture timing must be attested or mission-challenge verified.',
      });
    }
    if (
      value.source.provenance === 'authorized_import' &&
      value.source.captureTiming !== 'preexisting'
    ) {
      context.addIssue({
        code: 'custom',
        path: ['source', 'captureTiming'],
        message: 'Reusable imported video must be labeled preexisting.',
      });
    }
    if (
      !qualifiesForPublicNetworkReuse({
        result: value.observation.result,
        confidence: value.observation.confidence,
        continuity: value.source.continuity,
      })
    ) {
      context.addIssue({
        code: 'custom',
        path: ['observation'],
        message:
          'Reusable network evidence must be conclusive, medium-or-high confidence, and continuous.',
      });
    }
    if (
      value.observation.citationStartSeconds >= value.observation.citationEndSeconds ||
      value.observation.citationEndSeconds > value.source.durationSeconds
    ) {
      context.addIssue({
        code: 'custom',
        path: ['observation', 'citationEndSeconds'],
        message: 'The reusable citation must be ordered and fit inside the recording.',
      });
    }
    if (Date.parse(value.indexedAt) >= Date.parse(value.expiresAt)) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Reusable evidence must expire after it is indexed.',
      });
    }
  });

export type ReusableEvidenceRecord = z.infer<typeof reusableEvidenceRecordSchema>;

export const reusableEvidenceSearchResponseSchema = z.strictObject({
  status: z.enum(['complete', 'unavailable']),
  records: z.array(reusableEvidenceRecordSchema).max(4),
  warnings: z.array(z.string().trim().min(1).max(240)).max(4),
});

export type ReusableEvidenceSearchResponse = z.infer<typeof reusableEvidenceSearchResponseSchema>;

export const evidenceDiscoveryInputSchema = z.strictObject({
  provider: z.enum(evidenceDiscoveryProviders),
  status: z.enum(evidenceDiscoveryStatuses),
  query: z.string().trim().min(2).max(420),
  searchedPlatforms: z.array(z.enum(evidenceDiscoveryPlatforms)).max(4),
  warnings: z.array(z.string().trim().min(1).max(240)).max(8),
  leads: z
    .array(
      z.strictObject({
        platform: z.enum(evidenceDiscoveryPlatforms),
        title: z.string().trim().min(1).max(240),
        url: publicHttpUrlSchema,
        summary: z.string().trim().min(1).max(360),
        creatorLabel: z.string().trim().min(1).max(120),
      }),
    )
    .max(12),
  reviewedEvidence: z.array(reusableEvidenceRecordSchema).max(4).optional(),
});

export type EvidenceDiscoveryInput = z.infer<typeof evidenceDiscoveryInputSchema>;

export const filmingMissionInputSchema = z.strictObject({
  instruction: z.string().trim().min(8).max(280),
  successCriterion: z.string().trim().min(8).max(280),
  minimumSeconds: z.number().int().min(2).max(60),
  continuousTakeRequired: z.boolean(),
});

export type FilmingMissionInput = z.infer<typeof filmingMissionInputSchema>;

export const captureChallengeSchema: z.ZodType<CaptureChallenge> = z.strictObject({
  kind: z.literal('spoken_or_shown_phrase'),
  phrase: z.string().regex(/^[A-Z]+ [A-Z]+ [1-9][0-9]$/),
});

export const reviewedEvidenceInputSchema = z
  .strictObject({
    result: z.enum(evidenceResults),
    observation: z.string().trim().min(4).max(360),
    contributorLabel: z.string().trim().min(2).max(80),
    durationSeconds: z.number().int().min(1).max(300),
    citationStartSeconds: z.number().int().nonnegative(),
    citationEndSeconds: z.number().int().positive(),
    confidence: z.enum(evidenceConfidences),
    continuity: z.enum(['continuous', 'edited', 'unknown']),
    captureTiming: z.enum(sourceCaptureTimings),
    rights: z.enum(['owned', 'authorized']),
    reuseScope: z.enum(['case_only', 'public_network']),
    provenance: z.enum(['live_capture', 'authorized_import', 'demo_replay']),
    capturedAt: z.iso.datetime(),
    videoUrl: publicHttpUrlSchema.optional(),
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
    if (
      value.provenance === 'live_capture' &&
      !['mission_challenge_verified', 'contributor_attested'].includes(value.captureTiming)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['captureTiming'],
        message: 'A live capture must be contributor-attested or mission-challenge verified.',
      });
    }
    if (value.provenance !== 'live_capture' && value.captureTiming !== 'preexisting') {
      context.addIssue({
        code: 'custom',
        path: ['captureTiming'],
        message: 'An imported or replayed clip must be labeled preexisting.',
      });
    }
    if (
      value.citationStartSeconds >= value.citationEndSeconds ||
      value.citationEndSeconds > value.durationSeconds
    ) {
      context.addIssue({
        code: 'custom',
        path: ['citationEndSeconds'],
        message: 'The cited interval must be ordered and fit inside the recording.',
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
  readonly captureTiming: SourceCaptureTiming;
  readonly reuseScope: EvidenceReuseScope;
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
  readonly captureChallenge: CaptureChallenge;
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

export interface EvidenceDiscovery {
  readonly provider: EvidenceDiscoveryProvider;
  readonly status: EvidenceDiscoveryStatus;
  readonly query: string;
  readonly searchedPlatforms: readonly EvidenceDiscoveryPlatform[];
  readonly warnings: readonly string[];
  readonly sourceIds: readonly string[];
  readonly searchedAt: string;
}

export interface ProductEvidenceCase {
  readonly id: string;
  readonly product: ProductReference;
  readonly question: ProductQuestion;
  readonly sources: readonly EvidenceSource[];
  readonly observations: readonly EvidenceObservation[];
  readonly discovery: EvidenceDiscovery | null;
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
      readonly kind: 'record-evidence-discovery';
      readonly actor: Extract<EvidenceActor, 'human' | 'agent' | 'system'>;
      readonly input: EvidenceDiscoveryInput;
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
    (evidenceCase.mission?.continuousTakeRequired !== true || source.continuity === 'continuous') &&
    observation.confidence !== 'low' &&
    observation.result !== 'inconclusive'
  );
}

function evidenceTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
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

export function createDemoEvidenceQuestionState(): EvidenceNetworkState {
  const source: EvidenceSource = {
    id: 'source-1',
    title: 'Rights-cleared demo product page',
    url: null,
    mediaType: 'web_page',
    rights: 'owned',
    provenance: 'authored_fixture',
    continuity: 'unknown',
    captureTiming: 'preexisting',
    reuseScope: 'case_only',
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
    discovery: null,
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

export function createDemoEvidenceNetworkState(): EvidenceNetworkState {
  const state = createDemoEvidenceQuestionState();
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    throw new Error('The rights-clean demo question must contain an active case.');
  }
  return {
    ...state,
    activeCase: {
      ...evidenceCase,
      discovery: {
        provider: 'rights_clean_demo',
        status: 'complete',
        query: 'travel bottle continuous upside-down leak test',
        searchedPlatforms: ['web'],
        warnings: [],
        sourceIds: [evidenceCase.sources[0]?.id ?? 'source-1'],
        searchedAt: demoTimestamp,
      },
    },
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
  if (evidenceCase.discovery === null && evidenceCase.mission === null) {
    names.push('search_product_evidence');
  }
  if (
    answer?.status === 'insufficient' &&
    evidenceCase.discovery !== null &&
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
          captureTiming: 'unknown',
          reuseScope: 'not_eligible',
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
    discovery: null,
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

function recordEvidenceDiscovery(
  state: EvidenceNetworkState,
  input: EvidenceDiscoveryInput,
  actor: Extract<EvidenceActor, 'human' | 'agent' | 'system'>,
  now: string,
): EvidenceNetworkTransition {
  const evidenceCase = state.activeCase;
  if (evidenceCase === null) {
    return { ok: false, state, message: 'Ask a product question before searching for evidence.' };
  }
  if (evidenceCase.discovery !== null) {
    return { ok: false, state, message: 'Existing public evidence was already searched.' };
  }
  if (evidenceCase.mission !== null) {
    return { ok: false, state, message: 'Search for existing evidence before creating a mission.' };
  }
  const parsed = evidenceDiscoveryInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      state,
      message: parsed.error.issues[0]?.message ?? 'Invalid evidence discovery result.',
    };
  }

  const revision = state.revision + 1;
  const reusableRecords = parsed.data.reviewedEvidence ?? [];
  const knownStreamUids = new Set(
    evidenceCase.sources.flatMap(({ streamUid }) => (streamUid === null ? [] : [streamUid])),
  );
  const uniqueReusableRecords = reusableRecords.filter(({ source }) => {
    if (knownStreamUids.has(source.streamUid)) {
      return false;
    }
    knownStreamUids.add(source.streamUid);
    return true;
  });
  const reusableSources: EvidenceSource[] = uniqueReusableRecords.map((record, index) => ({
    id: `source-${revision}-network-${index + 1}`,
    title: record.source.title,
    url: record.source.videoUrl,
    mediaType: 'video',
    rights: record.source.rights,
    provenance: record.source.provenance,
    continuity: record.source.continuity,
    captureTiming: record.source.captureTiming,
    reuseScope: 'public_network',
    contributorLabel: record.source.contributorLabel,
    createdAt: record.source.capturedAt,
    streamUid: record.source.streamUid,
    sha256: record.source.sha256,
  }));
  const reusableObservations: EvidenceObservation[] = uniqueReusableRecords.map(
    (record, index) => ({
      id: `observation-${revision}-network-${index + 1}`,
      claim: evidenceCase.question.text,
      result: record.observation.result,
      confidence: record.observation.confidence,
      text: record.observation.text,
      citation: {
        sourceId: `source-${revision}-network-${index + 1}`,
        startSeconds: record.observation.citationStartSeconds,
        endSeconds: record.observation.citationEndSeconds,
        label: `${evidenceTimestamp(record.observation.citationStartSeconds)}–${evidenceTimestamp(record.observation.citationEndSeconds)}`,
      },
      reviewedBy: record.source.contributorLabel,
      reviewedAt: record.observation.reviewedAt,
    }),
  );
  const existingSourcesByUrl = new Map(
    evidenceCase.sources.flatMap((source) => {
      const key = source.url === null ? null : canonicalizePublicDiscoveryUrl(source.url);
      return key === null ? [] : [[key, source] as const];
    }),
  );
  const existingSourceIdsWithObservations = new Set(
    evidenceCase.observations.map(({ citation }) => citation.sourceId),
  );
  const matchedExistingSourceIds = new Set<string>();
  const existingLeadObservations: EvidenceObservation[] = [];
  const knownUrls = new Set([
    ...existingSourcesByUrl.keys(),
    ...reusableSources.flatMap(({ url }) => {
      const key = url === null ? null : canonicalizePublicDiscoveryUrl(url);
      return key === null ? [] : [key];
    }),
  ]);
  const uniqueLeads = parsed.data.leads.filter((lead, index) => {
    const key = canonicalizePublicDiscoveryUrl(lead.url);
    if (key === null) {
      return false;
    }
    const existingSource = existingSourcesByUrl.get(key);
    if (existingSource !== undefined) {
      matchedExistingSourceIds.add(existingSource.id);
      if (!existingSourceIdsWithObservations.has(existingSource.id)) {
        existingSourceIdsWithObservations.add(existingSource.id);
        existingLeadObservations.push({
          id: `observation-${revision}-existing-${index + 1}`,
          claim: evidenceCase.question.text,
          result: 'inconclusive',
          confidence: 'low',
          text: lead.summary,
          citation: {
            sourceId: existingSource.id,
            startSeconds: null,
            endSeconds: null,
            label: 'Discovery lead · not claim-reviewed',
          },
          reviewedBy: lead.creatorLabel,
          reviewedAt: now,
        });
      }
      return false;
    }
    if (knownUrls.has(key)) {
      return false;
    }
    knownUrls.add(key);
    return true;
  });
  const sources: EvidenceSource[] = uniqueLeads.map((lead, index) => ({
    id: `source-${revision}-${index + 1}`,
    title: lead.title,
    url: lead.url,
    mediaType: lead.platform === 'web' ? 'web_page' : 'video',
    rights: 'link_only',
    provenance: 'external_link',
    continuity: 'unknown',
    captureTiming: 'unknown',
    reuseScope: 'not_eligible',
    contributorLabel: lead.creatorLabel,
    createdAt: now,
    streamUid: null,
    sha256: null,
  }));
  const observations: EvidenceObservation[] = sources.map((source, index) => ({
    id: `observation-${revision}-${index + 1}`,
    claim: evidenceCase.question.text,
    result: 'inconclusive',
    confidence: 'low',
    text:
      uniqueLeads[index]?.summary ??
      'This public link is a discovery lead and has not been reviewed for the claim.',
    citation: {
      sourceId: source.id,
      startSeconds: null,
      endSeconds: null,
      label: 'Discovery lead · not claim-reviewed',
    },
    reviewedBy: 'Automated discovery metadata only',
    reviewedAt: now,
  }));
  const discovery: EvidenceDiscovery = {
    provider: parsed.data.provider,
    status: parsed.data.status,
    query: parsed.data.query,
    searchedPlatforms: parsed.data.searchedPlatforms,
    warnings: parsed.data.warnings,
    sourceIds: [
      ...matchedExistingSourceIds,
      ...reusableSources.map(({ id }) => id),
      ...sources.map(({ id }) => id),
    ],
    searchedAt: now,
  };
  const nextCaseWithoutAnswer: ProductEvidenceCase = {
    ...evidenceCase,
    sources: [...evidenceCase.sources, ...reusableSources, ...sources],
    observations: [
      ...evidenceCase.observations,
      ...existingLeadObservations,
      ...reusableObservations,
      ...observations,
    ],
    discovery,
  };
  const networkAnswer = deriveEvidenceAnswer(nextCaseWithoutAnswer, revision, now);
  const reusableObservationIds = new Set(reusableObservations.map(({ id }) => id));
  const reusableEvidenceChangedAnswer = networkAnswer.decisiveObservationIds.some((id) =>
    reusableObservationIds.has(id),
  );
  const nextCase: ProductEvidenceCase = reusableEvidenceChangedAnswer
    ? {
        ...nextCaseWithoutAnswer,
        answers: [...evidenceCase.answers, networkAnswer],
      }
    : nextCaseWithoutAnswer;

  return {
    ok: true,
    state: {
      revision,
      activeCase: nextCase,
      activity: [
        ...state.activity,
        activity(
          revision,
          actor,
          'search_product_evidence',
          uniqueReusableRecords.length > 0
            ? `Reused ${uniqueReusableRecords.length} rights-cleared, claim-reviewed recording${uniqueReusableRecords.length === 1 ? '' : 's'} from the evidence network.`
            : parsed.data.status === 'unavailable'
              ? 'The live public-source provider was unavailable; no result was treated as evidence.'
              : matchedExistingSourceIds.size + sources.length === 0
                ? 'Searched available public sources but found no claim-ready evidence leads.'
                : `Indexed ${matchedExistingSourceIds.size + sources.length} public discovery lead${matchedExistingSourceIds.size + sources.length === 1 ? '' : 's'} without treating them as proof.`,
          now,
        ),
      ],
    },
    message:
      uniqueReusableRecords.length > 0
        ? `Reused ${uniqueReusableRecords.length} reviewed network recording${uniqueReusableRecords.length === 1 ? '' : 's'}. The answer is now ${networkAnswer.status}.`
        : parsed.data.status === 'unavailable'
          ? 'Live public-source search was unavailable. A filming mission can still fill the gap.'
          : matchedExistingSourceIds.size + sources.length === 0
            ? 'Public-source search finished without a usable lead. A filming mission can fill the gap.'
            : `Indexed ${matchedExistingSourceIds.size + sources.length} public lead${matchedExistingSourceIds.size + sources.length === 1 ? '' : 's'}. None is treated as proof until reviewed.`,
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
  if (evidenceCase.discovery === null) {
    return {
      ok: false,
      state,
      message: 'Search existing public evidence before asking someone to film.',
    };
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
    captureChallenge: createCaptureChallenge(),
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
        : parsed.data.provenance === 'authorized_import'
          ? 'Contributor-authorized existing video'
          : 'Contributor-recorded mission video',
    url: parsed.data.videoUrl ?? null,
    mediaType: 'video',
    rights: parsed.data.rights,
    provenance: parsed.data.provenance,
    continuity: parsed.data.continuity,
    captureTiming: parsed.data.captureTiming,
    reuseScope: parsed.data.reuseScope,
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
      startSeconds: parsed.data.citationStartSeconds,
      endSeconds: parsed.data.citationEndSeconds,
      label: `${evidenceTimestamp(parsed.data.citationStartSeconds)}–${evidenceTimestamp(parsed.data.citationEndSeconds)}`,
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
  if (command.kind === 'record-evidence-discovery') {
    return recordEvidenceDiscovery(state, command.input, command.actor, now);
  }
  if (command.kind === 'create-filming-mission') {
    return createFilmingMission(state, command.input, command.actor, now);
  }
  return publishReviewedEvidence(state, command.input, now);
}
