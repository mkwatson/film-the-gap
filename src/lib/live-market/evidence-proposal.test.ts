import { describe, expect, it } from 'vitest';

import {
  applyHostSelections,
  createManualFinding,
  createVisualEvidenceReview,
  evidenceProposalResponseSchema,
  findingCanSupportAttestation,
} from './evidence-proposal';

const provenance = {
  kind: 'camera-keyframe',
  frameId: 'camera-9dff50df08c6',
  label: 'Host camera keyframe · camera-9dff50df08c6',
  capturedAt: '2026-08-26T19:22:31.000Z',
  showOffsetSeconds: null,
  sha256: '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e',
  widthPx: 960,
  heightPx: 540,
} as const;

const proposal = {
  kind: 'proposal',
  frameId: provenance.frameId,
  frameSha256: provenance.sha256,
  modelId: 'openai/gpt-5.6-sol',
  finding: {
    baseVisibility: 'clear',
    surfaceFinding: 'no-obvious-repair',
    confidence: 'medium',
    visibleDetails: ['The full base is visible.'],
    summary: 'The full base is visible with no obvious repair marker.',
    suggestedNextView: null,
  },
} as const;

describe('visual evidence proposal contract', () => {
  it('records whether the host accepted or corrected an AI proposal', () => {
    const accepted = createVisualEvidenceReview(provenance, proposal, proposal.finding);
    expect(accepted).toMatchObject({
      source: 'ai-gateway',
      modelId: 'openai/gpt-5.6-sol',
      hostDecision: 'accepted',
      frameSha256: provenance.sha256,
    });

    const correctedFinding = applyHostSelections(proposal.finding, 'partial', 'no-obvious-repair');
    const corrected = createVisualEvidenceReview(provenance, proposal, correctedFinding);
    expect(corrected).toMatchObject({
      hostDecision: 'corrected',
      reviewedFinding: { baseVisibility: 'partial' },
    });
    expect(findingCanSupportAttestation(correctedFinding)).toBe(false);
  });

  it('creates an explicit manual-review record without a model claim', () => {
    const response = {
      kind: 'manual-review-required',
      frameId: provenance.frameId,
      frameSha256: provenance.sha256,
      reason: 'gateway-unconfigured',
      message: 'Review manually.',
    } as const;
    const reviewedFinding = applyHostSelections(
      createManualFinding(),
      'clear',
      'no-obvious-repair',
    );

    expect(createVisualEvidenceReview(provenance, response, reviewedFinding)).toMatchObject({
      source: 'manual-review',
      modelId: null,
      proposal: null,
      hostDecision: 'manual',
    });
    expect(findingCanSupportAttestation(reviewedFinding)).toBe(true);
  });

  it('rejects malformed or cross-frame proposals', () => {
    expect(
      evidenceProposalResponseSchema.safeParse({
        ...proposal,
        finding: { ...proposal.finding, repairHistory: 'none' },
      }).success,
    ).toBe(false);
    expect(() =>
      createVisualEvidenceReview(
        provenance,
        { ...proposal, frameId: 'camera-000000000000' },
        proposal.finding,
      ),
    ).toThrow('not bound to the selected camera frame');
  });
});
