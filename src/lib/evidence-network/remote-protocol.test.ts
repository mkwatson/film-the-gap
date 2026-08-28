import { describe, expect, it } from 'vitest';

import { createDemoEvidenceNetworkState } from './model';
import {
  analyzeEvidenceVideoRequestSchema,
  createRemoteEvidenceCaseRequestSchema,
  evidenceNetworkStateSchema,
  publicEvidenceMissionClaimSchema,
  publicEvidenceMissionListSchema,
  publishRemoteEvidenceRequestSchema,
  remoteEvidenceCaseCredentialsSchema,
  reserveEvidenceUploadRequestSchema,
  toReviewedEvidenceInput,
} from './remote-protocol';

describe('remote product evidence protocol', () => {
  it('round-trips the generic evidence state without private capability tokens', () => {
    const state = evidenceNetworkStateSchema.parse(createDemoEvidenceNetworkState());
    const serialized = JSON.stringify(state);

    expect(serialized).toContain('Everyday insulated travel bottle');
    expect(serialized).not.toMatch(/ownerToken|contributorToken|budget|purchaseHistory/i);
  });

  it('supports either the rights-clean fixture or an arbitrary product question', () => {
    expect(createRemoteEvidenceCaseRequestSchema.safeParse({ seed: 'travel_bottle' }).success).toBe(
      true,
    );
    expect(
      createRemoteEvidenceCaseRequestSchema.safeParse({
        seed: 'travel_bottle',
        discovery: {
          provider: 'evidence_network',
          status: 'complete',
          query: 'travel bottle continuous upside-down leak test',
          searchedPlatforms: ['web'],
          warnings: [],
          leads: [],
        },
      }).success,
    ).toBe(true);
    expect(
      createRemoteEvidenceCaseRequestSchema.safeParse({
        seed: 'empty',
        question: {
          productName: 'USB-C lavalier microphone',
          question: 'Can the phone charge while the receiver is recording?',
        },
        discovery: {
          provider: 'scrapecreators',
          status: 'complete',
          query: 'USB-C lavalier microphone charge while recording',
          searchedPlatforms: ['youtube'],
          warnings: [],
          leads: [
            {
              platform: 'youtube',
              title: 'Receiver passthrough test',
              url: 'https://www.youtube.com/watch?v=abc123',
              summary: 'Candidate link; the video has not been claim-reviewed.',
              creatorLabel: 'YouTube · Audio Lab',
            },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it('keeps owner and contributor credentials out of public snapshots', () => {
    const result = remoteEvidenceCaseCredentialsSchema.parse({
      protocolVersion: '1',
      caseId: 'BCDF2345',
      ownerToken: 'o'.repeat(43),
      contributorToken: 'c'.repeat(43),
      expiresAt: Date.now() + 60_000,
      state: createDemoEvidenceNetworkState(),
    });

    expect(result.ownerToken).not.toBe(result.contributorToken);
    expect(result.state).not.toHaveProperty('ownerToken');
    expect(result.state).not.toHaveProperty('contributorToken');
  });

  it('requires an immutable upload reference and file digest for remote publication', () => {
    const base = {
      token: 'c'.repeat(43),
      commandId: 'publish-1',
      expectedRevision: 2,
      uploadId: '0123456789abcdef0123456789abcdef',
      confirmReviewedEvidence: true,
      review: {
        result: 'supports',
        observation: 'No water reached the paper during the continuous inversion.',
        contributorLabel: 'Bottle owner',
        durationSeconds: 10,
        citationStartSeconds: 0,
        citationEndSeconds: 10,
        confidence: 'high',
        continuity: 'continuous',
        provenance: 'authorized_import',
        rights: 'owned',
        reuseScope: 'case_only',
        capturedAt: '2026-08-27T16:00:00.000Z',
      },
    } as const;

    expect(publishRemoteEvidenceRequestSchema.safeParse(base).success).toBe(false);
    expect(
      publishRemoteEvidenceRequestSchema.safeParse({
        ...base,
        confirmReviewedEvidence: undefined,
        review: { ...base.review, sha256: 'a'.repeat(64) },
      }).success,
    ).toBe(false);
    expect(
      publishRemoteEvidenceRequestSchema.safeParse({
        ...base,
        confirmReviewedEvidence: false,
        review: { ...base.review, sha256: 'a'.repeat(64) },
      }).success,
    ).toBe(false);
    expect(
      publishRemoteEvidenceRequestSchema.safeParse({
        ...base,
        review: { ...base.review, sha256: 'a'.repeat(64) },
      }).success,
    ).toBe(true);
    expect(
      publishRemoteEvidenceRequestSchema.safeParse({
        ...base,
        review: {
          ...base.review,
          sha256: 'a'.repeat(64),
          captureTiming: 'mission_challenge_verified',
        },
      }).success,
    ).toBe(false);
    expect(
      toReviewedEvidenceInput(
        {
          ...base,
          review: { ...base.review, sha256: 'a'.repeat(64) },
        },
        'preexisting',
      ),
    ).toMatchObject({
      provenance: 'authorized_import',
      captureTiming: 'preexisting',
      streamUid: base.uploadId,
    });
  });

  it('requires literal rights confirmations before upload and model analysis', () => {
    const token = 'c'.repeat(43);
    const upload = {
      token,
      fileSizeBytes: 2_000_000,
      maxDurationSeconds: 30,
      mimeType: 'video/mp4',
    };
    expect(reserveEvidenceUploadRequestSchema.safeParse(upload).success).toBe(false);
    expect(
      reserveEvidenceUploadRequestSchema.safeParse({
        ...upload,
        confirmRightsForUpload: false,
      }).success,
    ).toBe(false);
    expect(
      reserveEvidenceUploadRequestSchema.safeParse({
        ...upload,
        confirmRightsForUpload: true,
      }).success,
    ).toBe(true);
    expect(analyzeEvidenceVideoRequestSchema.safeParse({ token }).success).toBe(false);
    expect(
      analyzeEvidenceVideoRequestSchema.safeParse({
        token,
        confirmRightsForAnalysis: false,
      }).success,
    ).toBe(false);
    expect(
      analyzeEvidenceVideoRequestSchema.safeParse({
        token,
        confirmRightsForAnalysis: true,
      }).success,
    ).toBe(true);
  });

  it('keeps public board listings capability-free while claims stay case-scoped', () => {
    const mission = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      caseId: 'BCDF2345',
      productName: 'Desk lamp',
      productUrl: null,
      question: 'Does it remember its brightness after losing power?',
      instruction: 'Record one complete power cycle with the brightness visible.',
      successCriterion: 'Keep the lamp and power control visible throughout.',
      minimumSeconds: 10,
      continuousTakeRequired: true,
      status: 'open',
      createdAt: '2026-08-27T16:00:00.000Z',
      expiresAt: '2026-08-28T16:00:00.000Z',
      fulfilledAt: null,
    } as const;

    expect(publicEvidenceMissionListSchema.safeParse({ missions: [mission] }).success).toBe(true);
    expect(
      publicEvidenceMissionListSchema.safeParse({
        missions: [{ ...mission, contributorToken: 'c'.repeat(43) }],
      }).success,
    ).toBe(false);
    expect(
      publicEvidenceMissionClaimSchema.safeParse({
        mission,
        contributorToken: 'p'.repeat(43),
      }).success,
    ).toBe(true);
    expect(
      publicEvidenceMissionListSchema.safeParse({
        missions: [
          {
            ...mission,
            status: 'fulfilled',
            fulfilledAt: null,
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      publicEvidenceMissionListSchema.safeParse({
        missions: [{ ...mission, expiresAt: mission.createdAt }],
      }).success,
    ).toBe(false);
  });
});
