import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  maximumUploadsPerEvidenceCase,
  remoteEvidenceCaseCredentialsSchema,
  remoteEvidenceProtocolVersion,
} from '../../src/lib/evidence-network/remote-protocol';

const appOrigin = 'http://localhost:3000';

describe('standalone evidence Worker', () => {
  it('attests the deployable evidence services and cost controls', async () => {
    const response = await SELF.fetch('https://evidence.example/healthz');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      service: 'webmcp-product-evidence',
      protocolVersion: remoteEvidenceProtocolVersion,
      abuseControls: {
        perClientCaseCreation: true,
        globalCaseCreation: true,
        maximumUploadsPerEvidenceCase,
      },
      evidenceServices: {
        stream: true,
        videoAnalysis: true,
        missionBoundCapture: true,
        reusableEvidence: true,
        reusableEvidenceRetentionDays: 30,
        expiredEvidencePurge: 'daily',
        publicMissionBoard: true,
        publicMissionRetentionHours: 24,
        productPageReader: true,
      },
    });
  });

  it('exposes only the evidence API and rejects untrusted browser origins', async () => {
    const legacy = await SELF.fetch('https://evidence.example/rooms', {
      method: 'POST',
      headers: { Origin: appOrigin },
    });
    expect(legacy.status).toBe(404);

    const hostile = await SELF.fetch('https://evidence.example/evidence-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' },
      body: JSON.stringify({ seed: 'travel_bottle' }),
    });
    expect(hostile.status).toBe(403);
  });

  it('creates a durable generic case through the trusted browser boundary', async () => {
    const response = await SELF.fetch('https://evidence.example/evidence-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({ seed: 'travel_bottle' }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(appOrigin);
    expect(remoteEvidenceCaseCredentialsSchema.safeParse(await response.json()).success).toBe(true);
  });
});
