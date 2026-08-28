import { z } from 'zod';

import { evidenceConfidences, evidenceResults } from './model';

export const videoEvidencePrimaryModel = 'google/gemini-3.7-flash' as const;
export const videoEvidenceFallbackModels = ['google/gemini-3.6-flash'] as const;
export const maximumAnalyzableVideoBytes = 95 * 1024 * 1024;

export const videoEvidenceContinuities = ['continuous', 'edited', 'unknown'] as const;
export type VideoEvidenceContinuity = (typeof videoEvidenceContinuities)[number];

export const captureChallengeStatuses = ['verified', 'not_detected', 'unclear'] as const;
export type CaptureChallengeStatus = (typeof captureChallengeStatuses)[number];

export const videoEvidenceSegmentRoles = [
  'setup',
  'claim_evidence',
  'context',
  'unrelated',
] as const;
export type VideoEvidenceSegmentRole = (typeof videoEvidenceSegmentRoles)[number];

export const videoEvidenceSegmentTransitions = [
  'video_start',
  'continuous',
  'visible_cut',
  'unclear',
] as const;
export type VideoEvidenceSegmentTransition = (typeof videoEvidenceSegmentTransitions)[number];

export const videoEvidenceSegmentSchema = z.strictObject({
  startSeconds: z.number().int().nonnegative(),
  endSeconds: z.number().int().positive(),
  role: z.enum(videoEvidenceSegmentRoles),
  transitionIn: z.enum(videoEvidenceSegmentTransitions),
  summary: z
    .string()
    .trim()
    .min(4)
    .max(180)
    .describe('A neutral description of only what is visible or audible in this interval.'),
});

export type VideoEvidenceSegment = z.infer<typeof videoEvidenceSegmentSchema>;

const videoEvidenceSegmentsSchema = z
  .array(videoEvidenceSegmentSchema)
  .min(1)
  .max(12)
  .describe(
    'A chronological map of the entire recording. Each transition states whether the footage visibly continues or cuts.',
  );

const videoEvidenceFindingShape = {
  result: z
    .enum(evidenceResults)
    .describe('Whether the visible recording supports, contradicts, or cannot answer the claim.'),
  confidence: z
    .enum(evidenceConfidences)
    .describe('Confidence in the bounded visual observation, not in product identity or history.'),
  observation: z
    .string()
    .trim()
    .min(4)
    .max(360)
    .describe('One neutral sentence grounded only in visible or audible evidence.'),
  startSeconds: z.number().int().nonnegative(),
  endSeconds: z.number().int().positive(),
  continuity: z.enum(videoEvidenceContinuities),
  captureChallenge: z.strictObject({
    status: z.enum(captureChallengeStatuses),
    observation: z
      .string()
      .trim()
      .min(4)
      .max(180)
      .describe('Whether the exact mission phrase is visibly shown or audibly spoken.'),
  }),
  visibleDetails: z
    .array(z.string().trim().min(1).max(160))
    .max(5)
    .describe('Short details that can actually be seen or heard in the cited interval.'),
  limitations: z
    .array(z.string().trim().min(1).max(180))
    .max(4)
    .describe('What the recording does not establish or what remains unclear.'),
} as const;

export const generatedVideoEvidenceFindingSchema = z.strictObject({
  ...videoEvidenceFindingShape,
  segments: videoEvidenceSegmentsSchema,
});

export const videoEvidenceFindingSchema = z.strictObject({
  ...videoEvidenceFindingShape,
  // Optional only so in-flight, short-lived Durable Object records from the previous release
  // remain readable. Every newly generated proposal uses the required schema above.
  segments: videoEvidenceSegmentsSchema.optional(),
});

export type VideoEvidenceFinding = z.infer<typeof videoEvidenceFindingSchema>;

export interface VideoEvidenceProposal {
  readonly modelId: string;
  readonly finding: VideoEvidenceFinding;
}

export const videoEvidenceProposalSchema: z.ZodType<VideoEvidenceProposal> = z.strictObject({
  modelId: z.string().min(1).max(160),
  finding: videoEvidenceFindingSchema,
});

const uploadIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/);

export const videoEvidenceAnalysisResponseSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('processing'),
    uploadId: uploadIdSchema,
    stage: z.enum(['stream-processing', 'mp4-preparing', 'model-review']),
    message: z.string().min(1).max(280),
  }),
  z.strictObject({
    kind: z.literal('proposal'),
    uploadId: uploadIdSchema,
    modelId: z.string().min(1).max(160),
    finding: videoEvidenceFindingSchema,
  }),
  z.strictObject({
    kind: z.literal('manual-review-required'),
    uploadId: uploadIdSchema,
    reason: z.enum([
      'gateway-unconfigured',
      'gateway-unavailable',
      'video-too-large',
      'stream-unavailable',
    ]),
    message: z.string().min(1).max(280),
  }),
]);

export type VideoEvidenceAnalysisResponse = z.infer<typeof videoEvidenceAnalysisResponseSchema>;

export interface AuthorizedVideoAnalysisInput {
  readonly uploadId: string;
  readonly videoUrl: string;
  readonly productName: string;
  readonly question: string;
  readonly instruction: string;
  readonly successCriterion: string;
  readonly captureChallengePhrase: string;
  readonly durationSeconds: number;
  readonly continuousTakeRequired: boolean;
}

export function findingFitsVideo(
  finding: VideoEvidenceFinding,
  durationSeconds: number,
  continuousTakeRequired: boolean,
): boolean {
  const roundedDuration = Math.ceil(durationSeconds);
  if (
    finding.startSeconds >= finding.endSeconds ||
    finding.endSeconds > roundedDuration ||
    !segmentsFitVideo(finding, roundedDuration)
  ) {
    return false;
  }
  return !(
    continuousTakeRequired &&
    finding.result !== 'inconclusive' &&
    finding.continuity !== 'continuous'
  );
}

function segmentsFitVideo(finding: VideoEvidenceFinding, durationSeconds: number): boolean {
  const segments = finding.segments;
  if (segments === undefined) {
    return true;
  }
  if (
    segments.length === 0 ||
    segments[0]?.startSeconds !== 0 ||
    segments[0]?.transitionIn !== 'video_start' ||
    segments.at(-1)?.endSeconds !== durationSeconds
  ) {
    return false;
  }

  for (const [index, segment] of segments.entries()) {
    if (
      segment.startSeconds >= segment.endSeconds ||
      segment.endSeconds > durationSeconds ||
      (index > 0 &&
        (segment.startSeconds !== segments[index - 1]?.endSeconds ||
          segment.transitionIn === 'video_start'))
    ) {
      return false;
    }
  }

  const citedSegments = segments.filter(
    ({ startSeconds, endSeconds }) =>
      startSeconds < finding.endSeconds && endSeconds > finding.startSeconds,
  );
  if (
    finding.result !== 'inconclusive' &&
    !citedSegments.some(({ role }) => role === 'claim_evidence')
  ) {
    return false;
  }
  if (finding.continuity !== 'continuous') {
    return true;
  }
  return citedSegments.every(
    ({ startSeconds, transitionIn }) =>
      startSeconds <= finding.startSeconds || transitionIn === 'continuous',
  );
}

export function formatEvidenceTimestamp(seconds: number): string {
  const bounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(bounded / 60);
  const remainingSeconds = bounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
