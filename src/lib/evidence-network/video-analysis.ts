import { z } from 'zod';

import { evidenceConfidences, evidenceResults } from './model';

export const videoEvidencePrimaryModel = 'google/gemini-3.7-flash' as const;
export const videoEvidenceFallbackModels = ['google/gemini-3.6-flash'] as const;
export const maximumAnalyzableVideoBytes = 95 * 1024 * 1024;

export const videoEvidenceContinuities = ['continuous', 'edited', 'unknown'] as const;
export type VideoEvidenceContinuity = (typeof videoEvidenceContinuities)[number];

export const videoEvidenceFindingSchema = z.strictObject({
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
  visibleDetails: z
    .array(z.string().trim().min(1).max(160))
    .max(5)
    .describe('Short details that can actually be seen or heard in the cited interval.'),
  limitations: z
    .array(z.string().trim().min(1).max(180))
    .max(4)
    .describe('What the recording does not establish or what remains unclear.'),
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
  readonly durationSeconds: number;
  readonly continuousTakeRequired: boolean;
}

export function findingFitsVideo(
  finding: VideoEvidenceFinding,
  durationSeconds: number,
  continuousTakeRequired: boolean,
): boolean {
  if (
    finding.startSeconds >= finding.endSeconds ||
    finding.endSeconds > Math.ceil(durationSeconds)
  ) {
    return false;
  }
  return !(
    continuousTakeRequired &&
    finding.result !== 'inconclusive' &&
    finding.continuity !== 'continuous'
  );
}

export function formatEvidenceTimestamp(seconds: number): string {
  const bounded = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(bounded / 60);
  const remainingSeconds = bounded % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
