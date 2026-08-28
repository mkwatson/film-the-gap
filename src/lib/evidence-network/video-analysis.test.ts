import { describe, expect, it } from 'vitest';

import {
  findingFitsVideo,
  formatEvidenceTimestamp,
  videoEvidenceAnalysisResponseSchema,
  type VideoEvidenceFinding,
} from './video-analysis';

const finding: VideoEvidenceFinding = {
  result: 'supports',
  confidence: 'high',
  observation: 'The charging indicator stayed visible while audio recording continued.',
  startSeconds: 2,
  endSeconds: 11,
  continuity: 'continuous',
  captureChallenge: {
    status: 'verified',
    observation: 'The exact mission phrase is audible at the start.',
  },
  visibleDetails: ['The charging icon remained on.', 'The recording timer advanced.'],
  limitations: ['The clip does not establish long-term battery behavior.'],
  segments: [
    {
      startSeconds: 0,
      endSeconds: 2,
      role: 'setup',
      transitionIn: 'video_start',
      summary: 'The receiver and charging indicator enter view.',
    },
    {
      startSeconds: 2,
      endSeconds: 11,
      role: 'claim_evidence',
      transitionIn: 'continuous',
      summary: 'The recording timer advances while the charging icon remains visible.',
    },
    {
      startSeconds: 11,
      endSeconds: 12,
      role: 'context',
      transitionIn: 'continuous',
      summary: 'The same phone remains visible after the cited interval.',
    },
  ],
};

describe('claim-scoped video analysis contracts', () => {
  it('accepts only timestamp ranges inside the uploaded recording', () => {
    expect(findingFitsVideo(finding, 12, true)).toBe(true);
    expect(findingFitsVideo({ ...finding, endSeconds: 13 }, 12, true)).toBe(false);
    expect(findingFitsVideo({ ...finding, startSeconds: 11 }, 12, true)).toBe(false);
  });

  it('refuses a conclusive proposal when a continuous take was required but not observed', () => {
    expect(findingFitsVideo({ ...finding, continuity: 'edited' }, 12, true)).toBe(false);
    expect(
      findingFitsVideo(
        { ...finding, result: 'inconclusive', confidence: 'low', continuity: 'unknown' },
        12,
        true,
      ),
    ).toBe(true);
  });

  it('rejects a cut hidden inside an interval labeled continuous', () => {
    expect(
      findingFitsVideo(
        {
          ...finding,
          segments: [
            {
              startSeconds: 0,
              endSeconds: 2,
              role: 'setup',
              transitionIn: 'video_start',
              summary: 'The receiver and charging indicator enter view.',
            },
            {
              startSeconds: 2,
              endSeconds: 6,
              role: 'claim_evidence',
              transitionIn: 'continuous',
              summary: 'The timer starts while the charging icon remains visible.',
            },
            {
              startSeconds: 6,
              endSeconds: 11,
              role: 'claim_evidence',
              transitionIn: 'visible_cut',
              summary: 'The timer and charging icon appear again after a cut.',
            },
            {
              startSeconds: 11,
              endSeconds: 12,
              role: 'context',
              transitionIn: 'continuous',
              summary: 'The same phone remains visible after the cited interval.',
            },
          ],
        },
        12,
        true,
      ),
    ).toBe(false);
  });

  it('rejects a segment map with a gap or a missing claim-evidence interval', () => {
    expect(
      findingFitsVideo(
        {
          ...finding,
          segments: finding.segments?.map((segment, index) =>
            index === 1 ? { ...segment, startSeconds: 3 } : segment,
          ),
        },
        12,
        true,
      ),
    ).toBe(false);
    expect(
      findingFitsVideo(
        {
          ...finding,
          segments: finding.segments?.map((segment) => ({ ...segment, role: 'context' })),
        },
        12,
        true,
      ),
    ).toBe(false);
  });

  it('parses a model proposal without treating processing as evidence', () => {
    expect(
      videoEvidenceAnalysisResponseSchema.parse({
        kind: 'proposal',
        uploadId: '0123456789abcdef0123456789abcdef',
        modelId: 'google/gemini-3.7-flash',
        finding,
      }),
    ).toMatchObject({ kind: 'proposal', finding: { startSeconds: 2, endSeconds: 11 } });
    expect(
      videoEvidenceAnalysisResponseSchema.parse({
        kind: 'processing',
        uploadId: '0123456789abcdef0123456789abcdef',
        stage: 'mp4-preparing',
        message: 'Preparing the exact uploaded clip.',
      }),
    ).toMatchObject({ kind: 'processing' });
  });

  it('keeps a previous-release proposal readable while requiring segments from new models', () => {
    const legacyFinding: Partial<VideoEvidenceFinding> = structuredClone(finding);
    delete legacyFinding.segments;
    expect(
      videoEvidenceAnalysisResponseSchema.parse({
        kind: 'proposal',
        uploadId: '0123456789abcdef0123456789abcdef',
        modelId: 'google/gemini-3.6-flash',
        finding: legacyFinding,
      }),
    ).toMatchObject({ kind: 'proposal', finding: { observation: finding.observation } });
  });

  it('formats citations across the one-minute boundary', () => {
    expect(formatEvidenceTimestamp(7)).toBe('00:07');
    expect(formatEvidenceTimestamp(67)).toBe('01:07');
  });
});
