import { env } from 'cloudflare:workers';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  maximumDirectUploadBytes,
  parseRemoteEvidenceServerMessage,
  publicEvidenceMissionSchema,
  remoteEvidenceCaseCredentialsSchema,
  remoteEvidenceCaseSnapshotSchema,
  reservedEvidenceUploadSchema,
  type RemoteEvidenceServerMessage,
} from '../../src/lib/evidence-network/remote-protocol';
import {
  enforceCaseCreationRateLimit,
  maximumUploadsPerEvidenceCase,
  streamAllowedOriginDomains,
} from '../src/product-evidence';
import { searchReusableEvidence } from '../src/evidence-library';
import { insertPublicMission } from '../src/public-mission-board';

const origin = 'http://localhost:3000';
const evidenceLibrary = (env as unknown as { readonly EVIDENCE_LIBRARY: D1Database })
  .EVIDENCE_LIBRARY;
const mission = {
  instruction: 'Fill the bottle, close the lid, and hold it upside down over dry paper.',
  successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
  minimumSeconds: 10,
  continuousTakeRequired: true,
} as const;

async function createCase(includeMission = true) {
  const response = await SELF.fetch('https://rooms.example/evidence-cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({
      seed: 'travel_bottle',
      ...(includeMission ? { mission } : {}),
    }),
  });
  const body: unknown = await response.json();
  return {
    response,
    credentials: remoteEvidenceCaseCredentialsSchema.parse(body),
  };
}

function createMessageReader(socket: WebSocket): {
  readonly next: (
    type: RemoteEvidenceServerMessage['type'],
  ) => Promise<RemoteEvidenceServerMessage>;
} {
  const buffered: RemoteEvidenceServerMessage[] = [];
  const waiters: Array<(message: RemoteEvidenceServerMessage) => void> = [];
  socket.addEventListener('message', (event: MessageEvent) => {
    const raw: unknown = typeof event.data === 'string' ? JSON.parse(event.data) : null;
    const message = parseRemoteEvidenceServerMessage(raw);
    if (message === null) {
      return;
    }
    const waiter = waiters.shift();
    if (waiter === undefined) {
      buffered.push(message);
    } else {
      waiter(message);
    }
  });
  return {
    next: async (type): Promise<RemoteEvidenceServerMessage> => {
      const deadline = Date.now() + 2_000;
      while (Date.now() < deadline) {
        const index = buffered.findIndex((message) => message.type === type);
        if (index >= 0) {
          const [message] = buffered.splice(index, 1);
          if (message !== undefined) {
            return message;
          }
        }
        const message = await Promise.race([
          new Promise<RemoteEvidenceServerMessage>((resolve) => waiters.push(resolve)),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 50)),
        ]);
        if (message !== null) {
          if (message.type === type) {
            return message;
          }
          buffered.push(message);
        }
      }
      throw new Error(`Timed out waiting for ${type}.`);
    },
  };
}

describe('generic product evidence cases', () => {
  it('rate limits a client without retaining its address or consuming shared capacity', async () => {
    const globalKeys: string[] = [];
    const clientKeys: string[] = [];
    const allowGlobal = {
      limit: async ({ key }: RateLimitOptions): Promise<RateLimitOutcome> => {
        globalKeys.push(key);
        return { success: true };
      },
    } satisfies RateLimit;
    const denyClient = {
      limit: async ({ key }: RateLimitOptions): Promise<RateLimitOutcome> => {
        clientKeys.push(key);
        return { success: false };
      },
    } satisfies RateLimit;

    const response = await enforceCaseCreationRateLimit(
      new Request('https://rooms.example/evidence-cases', {
        headers: {
          'CF-Connecting-IP': '203.0.113.42',
          'User-Agent': 'Judge Browser',
        },
      }),
      { global: allowGlobal, perClient: denyClient },
      { 'Access-Control-Allow-Origin': origin },
    );

    expect(response?.status).toBe(429);
    expect(response?.headers.get('Retry-After')).toBe('60');
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(globalKeys).toEqual([]);
    expect(clientKeys).toHaveLength(1);
    expect(clientKeys[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(clientKeys[0]).not.toContain('203.0.113.42');
  });

  it('checks shared capacity after a client passes its own limit', async () => {
    const calls: string[] = [];
    const allowClient = {
      limit: async ({ key }: RateLimitOptions): Promise<RateLimitOutcome> => {
        calls.push(`client:${key}`);
        return { success: true };
      },
    } satisfies RateLimit;
    const denyGlobal = {
      limit: async ({ key }: RateLimitOptions): Promise<RateLimitOutcome> => {
        calls.push(`global:${key}`);
        return { success: false };
      },
    } satisfies RateLimit;

    const response = await enforceCaseCreationRateLimit(
      new Request('https://rooms.example/evidence-cases', {
        headers: { 'CF-Connecting-IP': '203.0.113.43', 'User-Agent': 'Judge Browser' },
      }),
      { global: denyGlobal, perClient: allowClient },
    );

    expect(response?.status).toBe(429);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatch(/^client:[a-f0-9]{64}$/);
    expect(calls[1]).toBe('global:all-case-creation');
  });

  it('converts configured app origins to the domain allowlist Stream expects', () => {
    expect(
      streamAllowedOriginDomains(
        'https://app.example, http://localhost:3000, https://app.example, invalid',
      ),
    ).toEqual(['app.example', 'localhost']);
  });

  it('creates a durable case with separate owner and contributor capabilities', async () => {
    const { response, credentials } = await createCase();

    expect(response.status).toBe(201);
    expect(credentials.ownerToken).not.toBe(credentials.contributorToken);
    expect(credentials.state.activeCase?.mission?.status).toBe('open');
    expect(credentials.state.activeCase?.product.name).toBe('Everyday insulated travel bottle');

    const snapshotResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/snapshot`,
      { headers: { Origin: origin } },
    );
    const text = await snapshotResponse.text();
    const snapshot = remoteEvidenceCaseSnapshotSchema.parse(JSON.parse(text) as unknown);
    expect(snapshot.state.revision).toBe(credentials.state.revision);
    expect(text).not.toContain(credentials.ownerToken);
    expect(text).not.toContain(credentials.contributorToken);
  });

  it('persists arbitrary-product discovery leads before the filming mission', async () => {
    const response = await SELF.fetch('https://rooms.example/evidence-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        seed: 'empty',
        question: {
          productName: 'USB-C lavalier microphone',
          question: 'Can the phone charge while the receiver is connected and recording?',
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
        mission: {
          instruction: 'Record the receiver while the phone charges and captures audio.',
          successCriterion: 'Keep the charging indicator and recording state visible.',
          minimumSeconds: 10,
          continuousTakeRequired: true,
        },
      }),
    });
    const credentials = remoteEvidenceCaseCredentialsSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(credentials.state.activeCase).toMatchObject({
      product: { name: 'USB-C lavalier microphone' },
      discovery: { provider: 'scrapecreators', sourceIds: ['source-2-1'] },
      sources: [{ rights: 'link_only', provenance: 'external_link' }],
      mission: { status: 'open' },
    });
    expect(credentials.state.activeCase?.answers.at(-1)?.status).toBe('insufficient');
  });

  it('persists live search results for the bottle case instead of restoring a canned search', async () => {
    const response = await SELF.fetch('https://rooms.example/evidence-cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({
        seed: 'travel_bottle',
        discovery: {
          provider: 'evidence_network',
          status: 'complete',
          query: 'travel bottle continuous upside-down leak test',
          searchedPlatforms: ['youtube', 'web'],
          warnings: [],
          leads: [
            {
              platform: 'youtube',
              title: 'Public bottle test lead',
              url: 'https://www.youtube.com/watch?v=bottle123',
              summary: 'Public lead only; this video has not been claim-reviewed.',
              creatorLabel: 'YouTube · Bottle Lab',
            },
          ],
        },
        mission,
      }),
    });
    const credentials = remoteEvidenceCaseCredentialsSchema.parse(await response.json());

    expect(response.status).toBe(201);
    expect(credentials.state.activeCase).toMatchObject({
      discovery: { provider: 'evidence_network', searchedPlatforms: ['youtube', 'web'] },
      mission: { status: 'open' },
    });
    expect(credentials.state.activeCase?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Rights-cleared demo product page', rights: 'owned' }),
        expect.objectContaining({ title: 'Public bottle test lead', rights: 'link_only' }),
      ]),
    );
  });

  it('lets the owner create a mission but rejects stale or unauthorized mutations', async () => {
    const { credentials } = await createCase(false);
    const command = {
      token: credentials.ownerToken,
      commandId: crypto.randomUUID(),
      expectedRevision: credentials.state.revision,
      command: {
        kind: 'create-filming-mission',
        actor: 'agent',
        input: mission,
      },
    } as const;
    const response = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/commands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(command),
      },
    );
    const body = (await response.json()) as {
      readonly snapshot: { readonly state: { readonly revision: number } };
      readonly duplicate: boolean;
    };
    expect(response.status).toBe(200);
    expect(body.snapshot.state.revision).toBe(credentials.state.revision + 1);
    expect(body.duplicate).toBe(false);

    const duplicate = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/commands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify(command),
      },
    );
    expect(await duplicate.json()).toMatchObject({ duplicate: true, ok: true });

    const stale = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/commands`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          ...command,
          commandId: crypto.randomUUID(),
        }),
      },
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: 'stale_revision' });
  });

  it('turns one direct phone upload into reviewed evidence and a changed answer', async () => {
    const { credentials } = await createCase();
    const wsResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/ws`,
      { headers: { Origin: origin, Upgrade: 'websocket' } },
    );
    const socket = wsResponse.webSocket;
    if (socket === null) {
      throw new Error('Expected a public evidence WebSocket.');
    }
    const reader = createMessageReader(socket);
    socket.accept();
    const initialMessage = await reader.next('case-snapshot');
    expect(initialMessage).toMatchObject({
      type: 'case-snapshot',
      state: { revision: credentials.state.revision },
    });

    const uploadResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          fileSizeBytes: 2_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    const upload = reservedEvidenceUploadSchema.parse(await uploadResponse.json());
    expect(uploadResponse.status).toBe(201);
    expect(upload.provider).toBe('cloudflare_stream');

    const analysisResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/videos/${upload.uploadId}/analysis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          confirmRightsForAnalysis: true,
        }),
      },
    );
    expect(analysisResponse.status).toBe(200);
    expect(await analysisResponse.json()).toMatchObject({
      kind: 'proposal',
      modelId: 'google/gemini-3.7-flash',
      finding: {
        result: 'supports',
        startSeconds: 1,
        endSeconds: 10,
        continuity: 'continuous',
        captureChallenge: { status: 'verified' },
      },
    });

    const review = {
      result: 'supports',
      observation: 'No water reached the paper during the continuous inversion.',
      contributorLabel: 'Bottle owner',
      durationSeconds: 10,
      citationStartSeconds: 1,
      citationEndSeconds: 10,
      confidence: 'high',
      continuity: 'continuous',
      provenance: 'live_capture',
      rights: 'owned',
      reuseScope: 'public_network',
      capturedAt: new Date().toISOString(),
      sha256: 'a'.repeat(64),
    } as const;
    const unconfirmedResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/evidence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          commandId: crypto.randomUUID(),
          expectedRevision: credentials.state.revision,
          uploadId: upload.uploadId,
          review,
        }),
      },
    );
    expect(unconfirmedResponse.status).toBe(400);
    expect(await unconfirmedResponse.json()).toMatchObject({ error: 'invalid_evidence_review' });

    const publishResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/evidence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          commandId: crypto.randomUUID(),
          expectedRevision: credentials.state.revision,
          uploadId: upload.uploadId,
          confirmReviewedEvidence: true,
          review,
        }),
      },
    );
    expect(publishResponse.status).toBe(200);
    const published = (await publishResponse.json()) as {
      readonly snapshot: {
        readonly state: {
          readonly activeCase: {
            readonly answers: readonly [{ readonly status: string }, { readonly status: string }];
            readonly sources: readonly { readonly streamUid: string | null }[];
          };
        };
      };
    };
    expect(published.snapshot.state.activeCase.answers.at(-1)?.status).toBe('supported');
    expect(published.snapshot.state.activeCase.sources.at(-1)?.streamUid).toBe(upload.uploadId);
    expect(
      await searchReusableEvidence(evidenceLibrary, {
        productName: 'EVERYDAY insulated travel bottle',
        question: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
      }),
    ).toMatchObject([
      {
        source: {
          streamUid: upload.uploadId,
          rights: 'owned',
          provenance: 'live_capture',
          captureTiming: 'mission_challenge_verified',
        },
        observation: { result: 'supports', citationStartSeconds: 1, citationEndSeconds: 10 },
      },
    ]);

    const updatedMessage = await reader.next('case-snapshot');
    expect(updatedMessage).toMatchObject({
      type: 'case-snapshot',
      state: {
        activeCase: {
          mission: { status: 'fulfilled' },
          answers: [{ status: 'insufficient' }, { status: 'supported' }],
        },
      },
    });

    const videoResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/videos/${upload.uploadId}`,
      { headers: { Origin: origin } },
    );
    expect(await videoResponse.json()).toMatchObject({
      provider: 'cloudflare_stream',
      uploadId: upload.uploadId,
      uploaded: true,
      readyToStream: true,
    });
    socket.close(1000, 'Test complete');
  });

  it('lets a public-board capability fulfill its case and closes the listing', async () => {
    const { credentials } = await createCase();
    const missionId = crypto.randomUUID();
    const publicContributorToken = 'p'.repeat(43);
    const cases = (
      env as unknown as {
        readonly CASES: DurableObjectNamespace;
      }
    ).CASES;
    const stub = cases.get(cases.idFromName(credentials.caseId));
    const boardResponse = await stub.fetch('https://evidence.internal/publish-public-mission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        missionId,
        caseId: credentials.caseId,
        ownerToken: credentials.ownerToken,
        contributorToken: credentials.contributorToken,
        publicContributorToken,
        confirmPublicListing: true,
      }),
    });
    const publicMission = publicEvidenceMissionSchema.parse(await boardResponse.json());
    await insertPublicMission(evidenceLibrary, publicMission, publicContributorToken);

    const uploadResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: publicContributorToken,
          fileSizeBytes: 2_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    const upload = reservedEvidenceUploadSchema.parse(await uploadResponse.json());
    expect(uploadResponse.status).toBe(201);

    const publishResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/evidence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: publicContributorToken,
          commandId: crypto.randomUUID(),
          expectedRevision: credentials.state.revision,
          uploadId: upload.uploadId,
          confirmReviewedEvidence: true,
          review: {
            result: 'supports',
            observation: 'No water reached the paper during the continuous inversion.',
            contributorLabel: 'Public mission contributor',
            durationSeconds: 10,
            citationStartSeconds: 1,
            citationEndSeconds: 10,
            confidence: 'high',
            continuity: 'continuous',
            provenance: 'authorized_import',
            rights: 'owned',
            reuseScope: 'case_only',
            capturedAt: new Date().toISOString(),
            sha256: 'c'.repeat(64),
          },
        }),
      },
    );
    expect(publishResponse.status).toBe(200);
    expect(await publishResponse.json()).toMatchObject({
      ok: true,
      snapshot: {
        state: {
          activeCase: {
            mission: { status: 'fulfilled' },
            sources: expect.arrayContaining([
              expect.objectContaining({ provenance: 'authorized_import' }),
            ]),
          },
        },
      },
    });

    await expect(
      evidenceLibrary
        .prepare('SELECT status FROM public_evidence_missions WHERE mission_id = ?')
        .bind(missionId)
        .first<{ readonly status: string }>(),
    ).resolves.toEqual({ status: 'fulfilled' });
  });

  it('keeps weak evidence case-only instead of poisoning the reusable index', async () => {
    const { credentials } = await createCase();
    const uploadResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          fileSizeBytes: 2_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    const upload = reservedEvidenceUploadSchema.parse(await uploadResponse.json());

    const publishResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/evidence`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          commandId: crypto.randomUUID(),
          expectedRevision: credentials.state.revision,
          uploadId: upload.uploadId,
          confirmReviewedEvidence: true,
          review: {
            result: 'inconclusive',
            observation: 'The lid moved out of frame during the test.',
            contributorLabel: 'Bottle owner',
            durationSeconds: 10,
            citationStartSeconds: 1,
            citationEndSeconds: 10,
            confidence: 'low',
            continuity: 'continuous',
            provenance: 'live_capture',
            rights: 'owned',
            reuseScope: 'public_network',
            capturedAt: new Date().toISOString(),
            sha256: 'b'.repeat(64),
          },
        }),
      },
    );

    expect(publishResponse.status).toBe(422);
    expect(await publishResponse.json()).toMatchObject({ error: 'evidence_not_reusable' });
    const snapshotResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/snapshot`,
      { headers: { Origin: origin } },
    );
    expect(await snapshotResponse.json()).toMatchObject({
      state: { activeCase: { mission: { status: 'open' }, answers: [{ status: 'insufficient' }] } },
    });
  });

  it('coalesces concurrent analysis requests into one active model review', async () => {
    const { credentials } = await createCase();
    const uploadResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          fileSizeBytes: 2_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    const upload = reservedEvidenceUploadSchema.parse(await uploadResponse.json());
    const analyze = (): Promise<Response> =>
      SELF.fetch(
        `https://rooms.example/evidence-cases/${credentials.caseId}/videos/${upload.uploadId}/analysis`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin },
          body: JSON.stringify({
            token: credentials.contributorToken,
            confirmRightsForAnalysis: true,
          }),
        },
      );

    const responses = await Promise.all([analyze(), analyze()]);
    expect(responses.map(({ status }) => status).sort()).toEqual([200, 202]);
    const bodies = await Promise.all(responses.map((response) => response.json()));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'processing', stage: 'model-review' }),
        expect.objectContaining({ kind: 'proposal', modelId: 'google/gemini-3.7-flash' }),
      ]),
    );

    const cached = await analyze();
    expect(cached.status).toBe(200);
    expect(await cached.json()).toMatchObject({
      kind: 'proposal',
      modelId: 'google/gemini-3.7-flash',
    });
  });

  it('does not let the owner token exercise the contributor upload capability', async () => {
    const { credentials } = await createCase();
    const response = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.ownerToken,
          fileSizeBytes: 1_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'invalid_contributor_token' });
  });

  it('caps upload attempts and rejects clips larger than the bounded analysis path', async () => {
    const { credentials } = await createCase();
    const reserve = (fileSizeBytes: number): Promise<Response> =>
      SELF.fetch(`https://rooms.example/evidence-cases/${credentials.caseId}/uploads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          fileSizeBytes,
          maxDurationSeconds: 15,
          mimeType: 'video/mp4',
        }),
      });

    const tooLarge = await reserve(maximumDirectUploadBytes + 1);
    expect(tooLarge.status).toBe(400);
    expect(await tooLarge.json()).toMatchObject({ error: 'invalid_upload_request' });

    for (let attempt = 0; attempt < maximumUploadsPerEvidenceCase; attempt += 1) {
      expect((await reserve(2_000_000)).status).toBe(201);
    }
    const exhausted = await reserve(2_000_000);
    expect(exhausted.status).toBe(429);
    expect(await exhausted.json()).toMatchObject({ error: 'upload_limit_reached' });
  });

  it('does not let the owner token invoke paid analysis for a contributor upload', async () => {
    const { credentials } = await createCase();
    const uploadResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          fileSizeBytes: 2_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    const upload = reservedEvidenceUploadSchema.parse(await uploadResponse.json());

    const response = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/videos/${upload.uploadId}/analysis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ token: credentials.ownerToken, confirmRightsForAnalysis: true }),
      },
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: 'invalid_contributor_token' });
  });

  it('refuses analysis before the contributor confirms media rights', async () => {
    const { credentials } = await createCase();
    const uploadResponse = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/uploads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({
          token: credentials.contributorToken,
          fileSizeBytes: 2_000_000,
          maxDurationSeconds: 30,
          mimeType: 'video/mp4',
        }),
      },
    );
    const upload = reservedEvidenceUploadSchema.parse(await uploadResponse.json());

    const response = await SELF.fetch(
      `https://rooms.example/evidence-cases/${credentials.caseId}/videos/${upload.uploadId}/analysis`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ token: credentials.contributorToken }),
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'invalid_video_analysis_request' });
  });
});
