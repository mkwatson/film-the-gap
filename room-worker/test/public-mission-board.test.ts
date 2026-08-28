import { env } from 'cloudflare:workers';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  publicEvidenceMissionClaimSchema,
  publicEvidenceMissionListSchema,
  publicEvidenceMissionSchema,
  remoteEvidenceCaseCredentialsSchema,
} from '../../src/lib/evidence-network/remote-protocol';
import {
  deleteExpiredPublicMissions,
  insertPublicMission,
  listOpenPublicMissions,
} from '../src/public-mission-board';

const appOrigin = 'http://localhost:3000';
const evidenceLibrary = (env as unknown as { readonly EVIDENCE_LIBRARY: D1Database })
  .EVIDENCE_LIBRARY;

describe('public product filming mission board', () => {
  it('publishes public-only fields, issues a revocable public capability, and preserves the private path', async () => {
    const createResponse = await SELF.fetch('https://evidence.example/evidence-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({
        seed: 'travel_bottle',
        mission: {
          instruction: 'Fill the bottle, close the lid, and hold it upside down over dry paper.',
          successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
          minimumSeconds: 10,
          continuousTakeRequired: true,
        },
      }),
    });
    const credentials = remoteEvidenceCaseCredentialsSchema.parse(await createResponse.json());
    const missionId = crypto.randomUUID();

    const publishResponse = await SELF.fetch('https://evidence.example/public-missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({
        missionId,
        caseId: credentials.caseId,
        ownerToken: credentials.ownerToken,
        contributorToken: credentials.contributorToken,
        confirmPublicListing: true,
      }),
    });
    const publishBody: unknown = await publishResponse.json();
    if (!publishResponse.ok) {
      throw new Error(`Public mission publication failed: ${JSON.stringify(publishBody)}`);
    }
    const published = publicEvidenceMissionSchema.parse(publishBody);

    expect(publishResponse.status).toBe(201);
    expect(published.id).toBe(missionId);
    expect(published.caseId).toBe(credentials.caseId);
    expect(Date.parse(published.expiresAt)).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1_000);

    const listResponse = await SELF.fetch('https://evidence.example/public-missions', {
      headers: { Origin: appOrigin },
    });
    const listText = await listResponse.text();
    const listed = publicEvidenceMissionListSchema.parse(JSON.parse(listText) as unknown);
    expect(listed.missions).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: missionId })]),
    );
    expect(listText).not.toContain(credentials.ownerToken);
    expect(listText).not.toContain(credentials.contributorToken);
    expect(listText).not.toMatch(/ownerToken|contributorToken|budget|shopper/i);

    const stored = await evidenceLibrary
      .prepare('SELECT contributor_token FROM public_evidence_missions WHERE mission_id = ?')
      .bind(missionId)
      .first<{ readonly contributor_token: string }>();
    expect(stored?.contributor_token).not.toBe(missionId);
    expect(stored?.contributor_token).not.toBe(credentials.contributorToken);
    expect(stored?.contributor_token).toMatch(/^[a-f0-9]{64}$/);

    const lostResponseRetry = await SELF.fetch('https://evidence.example/public-missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({
        missionId: crypto.randomUUID(),
        caseId: credentials.caseId,
        ownerToken: credentials.ownerToken,
        contributorToken: credentials.contributorToken,
        confirmPublicListing: true,
      }),
    });
    expect(lostResponseRetry.status).toBe(201);
    expect(await lostResponseRetry.json()).toMatchObject({ id: missionId, status: 'open' });
    const rowCount = await evidenceLibrary
      .prepare('SELECT COUNT(*) AS count FROM public_evidence_missions WHERE case_id = ?')
      .bind(credentials.caseId)
      .first<{ readonly count: number }>();
    expect(rowCount?.count).toBe(1);

    const claimResponse = await SELF.fetch(
      `https://evidence.example/public-missions/${missionId}/claim`,
      { method: 'POST', headers: { Origin: appOrigin } },
    );
    const claim = publicEvidenceMissionClaimSchema.parse(await claimResponse.json());
    expect(claim.contributorToken).toBe(stored?.contributor_token);
    expect(claim.contributorToken).not.toBe(missionId);
    expect(claim.contributorToken).not.toBe(credentials.contributorToken);

    const wrongRemoval = await SELF.fetch(
      `https://evidence.example/public-missions/${missionId}/remove`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: appOrigin },
        body: JSON.stringify({ ownerToken: 'x'.repeat(43), confirmRemoval: true }),
      },
    );
    expect(wrongRemoval.status).toBe(403);

    const removeResponse = await SELF.fetch(
      `https://evidence.example/public-missions/${missionId}/remove`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: appOrigin },
        body: JSON.stringify({
          ownerToken: credentials.ownerToken,
          confirmRemoval: true,
        }),
      },
    );
    expect(removeResponse.status).toBe(200);
    expect(await removeResponse.json()).toMatchObject({ id: missionId, status: 'removed' });

    const closedClaim = await SELF.fetch(
      `https://evidence.example/public-missions/${missionId}/claim`,
      { method: 'POST', headers: { Origin: appOrigin } },
    );
    expect(closedClaim.status).toBe(409);

    const revokedUpload = await SELF.fetch(
      `https://evidence.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: appOrigin },
        body: JSON.stringify({
          token: claim.contributorToken,
          confirmRightsForUpload: true,
          fileSizeBytes: 1_000_000,
          maxDurationSeconds: 20,
          mimeType: 'video/mp4',
        }),
      },
    );
    expect(revokedUpload.status).toBe(403);

    const replacementId = crypto.randomUUID();
    const republishResponse = await SELF.fetch('https://evidence.example/public-missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({
        missionId: replacementId,
        caseId: credentials.caseId,
        ownerToken: credentials.ownerToken,
        contributorToken: credentials.contributorToken,
        confirmPublicListing: true,
      }),
    });
    expect(republishResponse.status).toBe(201);
    expect(await republishResponse.json()).toMatchObject({ id: replacementId, status: 'open' });
  });

  it('hides expired requests immediately and physically purges them', async () => {
    const missionId = crypto.randomUUID();
    await insertPublicMission(
      evidenceLibrary,
      publicEvidenceMissionSchema.parse({
        id: missionId,
        caseId: 'CDFG3456',
        productName: 'Desk lamp',
        productUrl: null,
        question: 'Does it remember its brightness after losing power?',
        instruction: 'Record one full power cycle with the brightness visible.',
        successCriterion: 'Keep the lamp and power control visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
        status: 'open',
        createdAt: '2026-08-26T16:00:00.000Z',
        expiresAt: '2026-08-27T16:00:00.000Z',
        fulfilledAt: null,
      }),
      'p'.repeat(43),
    );

    const openMissions = await listOpenPublicMissions(evidenceLibrary, '2026-08-27T16:00:00.000Z');
    expect(openMissions.some((mission) => mission.id === missionId)).toBe(false);
    const deleted = await deleteExpiredPublicMissions(evidenceLibrary, '2026-08-27T16:00:00.000Z');
    expect(deleted).toBeGreaterThanOrEqual(1);
    await expect(
      evidenceLibrary
        .prepare('SELECT mission_id FROM public_evidence_missions WHERE mission_id = ?')
        .bind(missionId)
        .first(),
    ).resolves.toBeNull();
  });
});
