import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  parseRemoteEvidenceServerMessage,
  remoteEvidenceCaseCredentialsSchema,
  remoteEvidenceCaseSnapshotSchema,
  reservedEvidenceUploadSchema,
  type RemoteEvidenceServerMessage,
} from '../../src/lib/evidence-network/remote-protocol';

const origin = 'http://localhost:3000';
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
          review: {
            result: 'supports',
            observation: 'No water reached the paper during the continuous inversion.',
            contributorLabel: 'Bottle owner',
            durationSeconds: 10,
            confidence: 'high',
            rights: 'owned',
            capturedAt: new Date().toISOString(),
            sha256: 'a'.repeat(64),
          },
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
});
