import { describe, expect, it } from 'vitest';

import { createDemoEvidenceNetworkState } from './model';
import {
  createRemoteEvidenceCaseRequestSchema,
  evidenceNetworkStateSchema,
  publishRemoteEvidenceRequestSchema,
  remoteEvidenceCaseCredentialsSchema,
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
      review: {
        result: 'supports',
        observation: 'No water reached the paper during the continuous inversion.',
        contributorLabel: 'Bottle owner',
        durationSeconds: 10,
        confidence: 'high',
        rights: 'owned',
        capturedAt: '2026-08-27T16:00:00.000Z',
      },
    } as const;

    expect(publishRemoteEvidenceRequestSchema.safeParse(base).success).toBe(false);
    expect(
      publishRemoteEvidenceRequestSchema.safeParse({
        ...base,
        review: { ...base.review, sha256: 'a'.repeat(64) },
      }).success,
    ).toBe(true);
  });
});
