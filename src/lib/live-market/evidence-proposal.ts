import { z } from 'zod';

import {
  baseVisibilityValues,
  hostReviewDecisions,
  surfaceFindingValues,
  visualConfidenceValues,
  type CameraEvidenceFrameProvenance,
  type VisualEvidenceFinding,
  type VisualEvidenceReview,
} from './model';

export const evidenceVisionPrimaryModel = 'openai/gpt-5.6-sol';
export const evidenceVisionFallbackModels = [
  'openai/gpt-5.6-terra',
  'openai/gpt-5.6-luna',
] as const;

export const historicalEvidenceLimitation =
  'A frame can show visible surface evidence; it cannot establish whether a board was repaired in the past. Repair history always requires a separate host attestation.';

export const visualEvidenceFindingSchema = z.strictObject({
  baseVisibility: z
    .enum(baseVisibilityValues)
    .describe('Whether the snowboard base is clearly and sufficiently visible in this frame.'),
  surfaceFinding: z
    .enum(surfaceFindingValues)
    .describe('Only the visible surface signal in this frame, never a claim about repair history.'),
  confidence: z.enum(visualConfidenceValues),
  visibleDetails: z
    .array(z.string().trim().min(1).max(160))
    .max(4)
    .describe('Short observations grounded only in visible pixels.'),
  summary: z.string().trim().min(1).max(280),
  suggestedNextView: z.string().trim().min(1).max(200).nullable(),
});

const responseBindingSchema = {
  frameId: z.string().regex(/^camera-[a-f0-9]{12}$/),
  frameSha256: z.string().regex(/^[a-f0-9]{64}$/),
} as const;

export const evidenceProposalResponseSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('proposal'),
    ...responseBindingSchema,
    modelId: z.string().min(1).max(160),
    finding: visualEvidenceFindingSchema,
  }),
  z.strictObject({
    kind: z.literal('manual-review-required'),
    ...responseBindingSchema,
    reason: z.enum(['gateway-unconfigured', 'gateway-unavailable', 'host-chosen']),
    message: z.string().min(1).max(280),
  }),
]);

interface EvidenceProposalBinding {
  readonly frameId: string;
  readonly frameSha256: string;
}

export interface EvidenceProposal extends EvidenceProposalBinding {
  readonly kind: 'proposal';
  readonly modelId: string;
  readonly finding: VisualEvidenceFinding;
}

export interface ManualReviewRequired extends EvidenceProposalBinding {
  readonly kind: 'manual-review-required';
  readonly reason: 'gateway-unconfigured' | 'gateway-unavailable' | 'host-chosen';
  readonly message: string;
}

export type EvidenceProposalResponse = EvidenceProposal | ManualReviewRequired;

export function createManualFinding(): VisualEvidenceFinding {
  return {
    baseVisibility: 'unclear',
    surfaceFinding: 'unclear',
    confidence: 'low',
    visibleDetails: [],
    summary: 'The host must review the selected frame manually.',
    suggestedNextView: 'Show the entire base close enough to inspect its surface.',
  };
}

export function applyHostSelections(
  finding: VisualEvidenceFinding,
  baseVisibility: VisualEvidenceFinding['baseVisibility'],
  surfaceFinding: VisualEvidenceFinding['surfaceFinding'],
): VisualEvidenceFinding {
  if (finding.baseVisibility === baseVisibility && finding.surfaceFinding === surfaceFinding) {
    return finding;
  }

  const clearEnough = baseVisibility === 'clear' && surfaceFinding !== 'unclear';
  return {
    ...finding,
    baseVisibility,
    surfaceFinding,
    confidence: clearEnough ? 'medium' : 'low',
    summary: `Host review: base visibility is ${baseVisibility}; visible surface finding is ${surfaceFinding}.`,
    suggestedNextView: clearEnough
      ? null
      : 'Retake a close, evenly lit frame that shows the entire base.',
  };
}

function findingsEqual(left: VisualEvidenceFinding, right: VisualEvidenceFinding): boolean {
  return (
    left.baseVisibility === right.baseVisibility &&
    left.surfaceFinding === right.surfaceFinding &&
    left.confidence === right.confidence &&
    left.summary === right.summary &&
    left.suggestedNextView === right.suggestedNextView &&
    left.visibleDetails.length === right.visibleDetails.length &&
    left.visibleDetails.every((detail, index) => detail === right.visibleDetails[index])
  );
}

export function createVisualEvidenceReview(
  provenance: CameraEvidenceFrameProvenance,
  response: EvidenceProposalResponse,
  reviewedFinding: VisualEvidenceFinding,
): VisualEvidenceReview {
  if (response.frameId !== provenance.frameId || response.frameSha256 !== provenance.sha256) {
    throw new Error('The proposal is not bound to the selected camera frame.');
  }

  if (response.kind === 'manual-review-required') {
    return {
      source: 'manual-review',
      modelId: null,
      frameId: provenance.frameId,
      frameSha256: provenance.sha256,
      proposal: null,
      reviewedFinding,
      hostDecision: 'manual',
    };
  }

  const hostDecision: (typeof hostReviewDecisions)[number] = findingsEqual(
    response.finding,
    reviewedFinding,
  )
    ? 'accepted'
    : 'corrected';

  return {
    source: 'ai-gateway',
    modelId: response.modelId,
    frameId: provenance.frameId,
    frameSha256: provenance.sha256,
    proposal: response.finding,
    reviewedFinding,
    hostDecision,
  };
}

export function findingCanSupportAttestation(finding: VisualEvidenceFinding): boolean {
  return finding.baseVisibility === 'clear' && finding.surfaceFinding !== 'unclear';
}
