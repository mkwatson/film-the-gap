import { z } from 'zod';

import {
  captureChallengeSchema,
  evidenceActors,
  evidenceAnswerStatuses,
  evidenceConfidences,
  evidenceDiscoveryPlatforms,
  evidenceDiscoveryProviders,
  evidenceDiscoveryStatuses,
  evidenceDiscoveryInputSchema,
  evidenceResults,
  filmingMissionInputSchema,
  productQuestionInputSchema,
  sourceContinuityKinds,
  sourceCaptureTimings,
  sourceProvenanceKinds,
  sourceRights,
  type EvidenceDiscoveryInput,
  type EvidenceNetworkState,
  type FilmingMissionInput,
  type ProductQuestionInput,
  type ReviewedEvidenceInput,
  type SourceCaptureTiming,
} from './model';
import { maximumAnalyzableVideoBytes } from './video-analysis';
import { publicHttpUrlSchema } from './url-policy';

export const remoteEvidenceProtocolVersion = '1' as const;
export const remoteEvidenceCaseIdPattern = /^[A-Z2-9]{8}$/;
export const publicEvidenceMissionIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const maximumDirectUploadBytes = maximumAnalyzableVideoBytes;
export const maximumUploadsPerEvidenceCase = 2;

const idSchema = z.string().min(1).max(160);
const tokenSchema = z.string().min(32).max(256);
const timestampSchema = z.iso.datetime();
const publicEvidenceMissionIdSchema = z.string().regex(publicEvidenceMissionIdPattern);
const evidenceSourceSchema = z.strictObject({
  id: idSchema,
  title: z.string().min(1).max(240),
  url: publicHttpUrlSchema.nullable(),
  mediaType: z.enum(['web_page', 'video', 'image']),
  rights: z.enum(sourceRights),
  provenance: z.enum(sourceProvenanceKinds),
  continuity: z.enum(sourceContinuityKinds),
  captureTiming: z.enum(sourceCaptureTimings),
  reuseScope: z.enum(['not_eligible', 'case_only', 'public_network']),
  contributorLabel: z.string().min(1).max(120),
  createdAt: timestampSchema,
  streamUid: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{16,128}$/)
    .nullable(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});

const evidenceObservationSchema = z.strictObject({
  id: idSchema,
  claim: z.string().min(1).max(360),
  result: z.enum(evidenceResults),
  confidence: z.enum(evidenceConfidences),
  text: z.string().min(1).max(500),
  citation: z.strictObject({
    sourceId: idSchema,
    startSeconds: z.number().int().nonnegative().nullable(),
    endSeconds: z.number().int().positive().nullable(),
    label: z.string().min(1).max(120),
  }),
  reviewedBy: z.string().min(1).max(120),
  reviewedAt: timestampSchema,
});

const filmingMissionSchema = z.strictObject({
  id: idSchema,
  status: z.enum(['open', 'fulfilled']),
  instruction: filmingMissionInputSchema.shape.instruction,
  successCriterion: filmingMissionInputSchema.shape.successCriterion,
  minimumSeconds: filmingMissionInputSchema.shape.minimumSeconds,
  continuousTakeRequired: filmingMissionInputSchema.shape.continuousTakeRequired,
  captureChallenge: captureChallengeSchema,
  createdAt: timestampSchema,
  fulfilledAt: timestampSchema.nullable(),
});

const evidenceAnswerSchema = z.strictObject({
  id: idSchema,
  status: z.enum(evidenceAnswerStatuses),
  summary: z.string().min(1).max(500),
  decisiveObservationIds: z.array(idSchema).max(64),
  revision: z.number().int().nonnegative(),
  createdAt: timestampSchema,
});

const evidenceDiscoverySchema = z.strictObject({
  provider: z.enum(evidenceDiscoveryProviders),
  status: z.enum(evidenceDiscoveryStatuses),
  query: z.string().min(2).max(420),
  searchedPlatforms: z.array(z.enum(evidenceDiscoveryPlatforms)).max(4),
  warnings: z.array(z.string().min(1).max(240)).max(8),
  sourceIds: z.array(idSchema).max(12),
  searchedAt: timestampSchema,
});

const productEvidenceCaseSchema = z.strictObject({
  id: idSchema,
  product: z.strictObject({
    id: idSchema,
    name: z.string().min(2).max(120),
    suppliedUrl: publicHttpUrlSchema.nullable(),
  }),
  question: z.strictObject({
    id: idSchema,
    text: z.string().min(8).max(280),
    createdAt: timestampSchema,
  }),
  sources: z.array(evidenceSourceSchema).max(128),
  observations: z.array(evidenceObservationSchema).max(256),
  discovery: evidenceDiscoverySchema.nullable(),
  mission: filmingMissionSchema.nullable(),
  answers: z.array(evidenceAnswerSchema).min(1).max(128),
});

const evidenceActivitySchema = z.strictObject({
  id: idSchema,
  actor: z.enum(evidenceActors),
  action: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  createdAt: timestampSchema,
});

export const evidenceNetworkStateSchema: z.ZodType<EvidenceNetworkState> = z.strictObject({
  revision: z.number().int().nonnegative(),
  activeCase: productEvidenceCaseSchema.nullable(),
  activity: z.array(evidenceActivitySchema).max(512),
});

const createFromDemoSchema = z.strictObject({
  seed: z.literal('travel_bottle'),
  mission: filmingMissionInputSchema.optional(),
});

const createFromQuestionSchema = z.strictObject({
  seed: z.literal('empty'),
  question: productQuestionInputSchema,
  discovery: evidenceDiscoveryInputSchema.optional(),
  mission: filmingMissionInputSchema.optional(),
});

export const createRemoteEvidenceCaseRequestSchema = z.discriminatedUnion('seed', [
  createFromDemoSchema,
  createFromQuestionSchema,
]);
export type CreateRemoteEvidenceCaseRequest = z.infer<typeof createRemoteEvidenceCaseRequestSchema>;

export const publicEvidenceMissionStatuses = ['open', 'fulfilled', 'removed'] as const;
export type PublicEvidenceMissionStatus = (typeof publicEvidenceMissionStatuses)[number];

export interface PublicEvidenceMission {
  readonly id: string;
  readonly caseId: string;
  readonly productName: string;
  readonly productUrl: string | null;
  readonly question: string;
  readonly instruction: string;
  readonly successCriterion: string;
  readonly minimumSeconds: number;
  readonly continuousTakeRequired: boolean;
  readonly status: PublicEvidenceMissionStatus;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly fulfilledAt: string | null;
}

export const publicEvidenceMissionSchema: z.ZodType<PublicEvidenceMission> = z
  .strictObject({
    id: publicEvidenceMissionIdSchema,
    caseId: z.string().regex(remoteEvidenceCaseIdPattern),
    productName: productQuestionInputSchema.shape.productName,
    productUrl: publicHttpUrlSchema.nullable(),
    question: productQuestionInputSchema.shape.question,
    instruction: filmingMissionInputSchema.shape.instruction,
    successCriterion: filmingMissionInputSchema.shape.successCriterion,
    minimumSeconds: filmingMissionInputSchema.shape.minimumSeconds,
    continuousTakeRequired: filmingMissionInputSchema.shape.continuousTakeRequired,
    status: z.enum(publicEvidenceMissionStatuses),
    createdAt: timestampSchema,
    expiresAt: timestampSchema,
    fulfilledAt: timestampSchema.nullable(),
  })
  .superRefine((mission, context) => {
    if (Date.parse(mission.expiresAt) <= Date.parse(mission.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'A public mission must expire after it is created.',
      });
    }
    if ((mission.status === 'fulfilled') !== (mission.fulfilledAt !== null)) {
      context.addIssue({
        code: 'custom',
        path: ['fulfilledAt'],
        message: 'Only a fulfilled public mission may carry a fulfillment timestamp.',
      });
    }
  });

export const publicEvidenceMissionListSchema = z.strictObject({
  missions: z.array(publicEvidenceMissionSchema).max(24),
});
export type PublicEvidenceMissionList = z.infer<typeof publicEvidenceMissionListSchema>;

export const publishPublicEvidenceMissionRequestSchema = z.strictObject({
  missionId: publicEvidenceMissionIdSchema,
  caseId: z.string().regex(remoteEvidenceCaseIdPattern),
  ownerToken: tokenSchema,
  contributorToken: tokenSchema,
  confirmPublicListing: z.literal(true),
});
export type PublishPublicEvidenceMissionRequest = z.infer<
  typeof publishPublicEvidenceMissionRequestSchema
>;

export const removePublicEvidenceMissionRequestSchema = z.strictObject({
  ownerToken: tokenSchema,
  confirmRemoval: z.literal(true),
});
export type RemovePublicEvidenceMissionRequest = z.infer<
  typeof removePublicEvidenceMissionRequestSchema
>;

export const publicEvidenceMissionClaimSchema = z.strictObject({
  mission: publicEvidenceMissionSchema,
  contributorToken: tokenSchema,
});
export type PublicEvidenceMissionClaim = z.infer<typeof publicEvidenceMissionClaimSchema>;

export interface RemoteEvidenceCaseCredentials {
  readonly protocolVersion: typeof remoteEvidenceProtocolVersion;
  readonly caseId: string;
  readonly ownerToken: string;
  readonly contributorToken: string;
  readonly expiresAt: number;
  readonly state: EvidenceNetworkState;
}

export const remoteEvidenceCaseCredentialsSchema: z.ZodType<RemoteEvidenceCaseCredentials> =
  z.strictObject({
    protocolVersion: z.literal(remoteEvidenceProtocolVersion),
    caseId: z.string().regex(remoteEvidenceCaseIdPattern),
    ownerToken: tokenSchema,
    contributorToken: tokenSchema,
    expiresAt: z.number().int().positive(),
    state: evidenceNetworkStateSchema,
  });

export const ownerEvidenceCommandRequestSchema = z.strictObject({
  token: tokenSchema,
  commandId: idSchema,
  expectedRevision: z.number().int().nonnegative(),
  command: z.strictObject({
    kind: z.literal('create-filming-mission'),
    actor: z.enum(['human', 'agent']),
    input: filmingMissionInputSchema,
  }),
});
export type OwnerEvidenceCommandRequest = z.infer<typeof ownerEvidenceCommandRequestSchema>;

export const reserveEvidenceUploadRequestSchema = z.strictObject({
  token: tokenSchema,
  fileSizeBytes: z.number().int().positive().max(maximumDirectUploadBytes),
  maxDurationSeconds: z.number().int().min(2).max(90),
  mimeType: z.string().trim().min(3).max(120),
});
export type ReserveEvidenceUploadRequest = z.infer<typeof reserveEvidenceUploadRequestSchema>;

export const analyzeEvidenceVideoRequestSchema = z.strictObject({
  token: tokenSchema,
});
export type AnalyzeEvidenceVideoRequest = z.infer<typeof analyzeEvidenceVideoRequestSchema>;

export interface ReservedEvidenceUpload {
  readonly provider: 'cloudflare_stream';
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly maxDurationSeconds: number;
  readonly expiresAt: string;
}

export const reservedEvidenceUploadSchema: z.ZodType<ReservedEvidenceUpload> = z.strictObject({
  provider: z.literal('cloudflare_stream'),
  uploadId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  uploadUrl: publicHttpUrlSchema,
  maxDurationSeconds: z.number().int().min(2).max(90),
  expiresAt: timestampSchema,
});

export const publishRemoteEvidenceRequestSchema = z
  .strictObject({
    token: tokenSchema,
    commandId: idSchema,
    expectedRevision: z.number().int().nonnegative(),
    uploadId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
    review: z.strictObject({
      result: z.enum(evidenceResults),
      observation: z.string().trim().min(4).max(360),
      contributorLabel: z.string().trim().min(2).max(80),
      durationSeconds: z.number().int().min(1).max(90),
      citationStartSeconds: z.number().int().nonnegative(),
      citationEndSeconds: z.number().int().positive(),
      confidence: z.enum(evidenceConfidences),
      continuity: z.enum(['continuous', 'edited', 'unknown']),
      provenance: z.enum(['live_capture', 'authorized_import']),
      rights: z.enum(['owned', 'authorized']),
      reuseScope: z.enum(['case_only', 'public_network']),
      capturedAt: timestampSchema,
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  })
  .superRefine((value, context) => {
    if (
      value.review.citationStartSeconds >= value.review.citationEndSeconds ||
      value.review.citationEndSeconds > value.review.durationSeconds
    ) {
      context.addIssue({
        code: 'custom',
        path: ['review', 'citationEndSeconds'],
        message: 'The cited interval must be ordered and fit inside the recording.',
      });
    }
  });
export type PublishRemoteEvidenceRequest = z.infer<typeof publishRemoteEvidenceRequestSchema>;

export interface RemoteEvidenceCaseSnapshot {
  readonly protocolVersion: typeof remoteEvidenceProtocolVersion;
  readonly caseId: string;
  readonly expiresAt: number;
  readonly state: EvidenceNetworkState;
  readonly lastMessage: string;
}

const remoteEvidenceCaseSnapshotObjectSchema = z.strictObject({
  protocolVersion: z.literal(remoteEvidenceProtocolVersion),
  caseId: z.string().regex(remoteEvidenceCaseIdPattern),
  expiresAt: z.number().int().positive(),
  state: evidenceNetworkStateSchema,
  lastMessage: z.string().min(1).max(500),
});

export const remoteEvidenceCaseSnapshotSchema: z.ZodType<RemoteEvidenceCaseSnapshot> =
  remoteEvidenceCaseSnapshotObjectSchema;

export type RemoteEvidenceServerMessage =
  | ({ readonly type: 'case-snapshot' } & RemoteEvidenceCaseSnapshot)
  | {
      readonly type: 'case-expired';
      readonly message: string;
    };

export const remoteEvidenceServerMessageSchema: z.ZodType<RemoteEvidenceServerMessage> =
  z.discriminatedUnion('type', [
    remoteEvidenceCaseSnapshotObjectSchema.extend({ type: z.literal('case-snapshot') }),
    z.strictObject({
      type: z.literal('case-expired'),
      message: z.string().min(1).max(500),
    }),
  ]);

export function parseRemoteEvidenceServerMessage(
  value: unknown,
): RemoteEvidenceServerMessage | null {
  const parsed = remoteEvidenceServerMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function toReviewedEvidenceInput(
  request: PublishRemoteEvidenceRequest,
  captureTiming: SourceCaptureTiming,
): ReviewedEvidenceInput {
  return {
    ...request.review,
    captureTiming,
    streamUid: request.uploadId,
  };
}

export function requestQuestion(
  request: CreateRemoteEvidenceCaseRequest,
): ProductQuestionInput | null {
  return request.seed === 'empty' ? request.question : null;
}

export function requestMission(
  request: CreateRemoteEvidenceCaseRequest,
): FilmingMissionInput | null {
  return request.mission ?? null;
}

export function requestDiscovery(
  request: CreateRemoteEvidenceCaseRequest,
): EvidenceDiscoveryInput | null {
  return request.seed === 'empty' ? (request.discovery ?? null) : null;
}
