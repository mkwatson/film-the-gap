import { env } from 'cloudflare:workers';
import { evictDurableObject, runDurableObjectAlarm, SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { defaultEvidenceRequirements } from '../../src/lib/live-market/model';
import {
  parseRemoteRoomServerMessage,
  roomCredentialsSchema,
  type RemoteRoomClientMessage,
  type RemoteRoomServerMessage,
  type RoomCredentials,
} from '../../src/lib/live-market/remote-room-protocol';
import type { WorkerEnv } from '../src/index';

const workerEnv = env as unknown as WorkerEnv;

interface TestSocket {
  readonly socket: WebSocket;
  readonly next: (type: RemoteRoomServerMessage['type']) => Promise<RemoteRoomServerMessage>;
}

function createMessageReader(socket: WebSocket): TestSocket['next'] {
  const buffered: RemoteRoomServerMessage[] = [];
  const waiters: Array<(message: RemoteRoomServerMessage) => void> = [];
  socket.addEventListener('message', (event: MessageEvent) => {
    const raw: unknown = typeof event.data === 'string' ? JSON.parse(event.data) : null;
    const message = parseRemoteRoomServerMessage(raw);
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

  return async (type): Promise<RemoteRoomServerMessage> => {
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
        new Promise<RemoteRoomServerMessage>((resolve) => waiters.push(resolve)),
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
  };
}

function send(socket: WebSocket, message: RemoteRoomClientMessage): void {
  socket.send(JSON.stringify(message));
}

async function createRoom(): Promise<RoomCredentials> {
  const response = await SELF.fetch('https://rooms.example/rooms', {
    method: 'POST',
    headers: { Origin: 'http://localhost:3000' },
  });
  const body: unknown = await response.json();
  return roomCredentialsSchema.parse(body);
}

async function connect(
  credentials: RoomCredentials,
  role: 'buyer' | 'host',
  lastSeenRevision = 0,
): Promise<TestSocket> {
  const response = await SELF.fetch(`https://rooms.example/rooms/${credentials.roomId}/ws`, {
    headers: {
      Origin: 'http://localhost:3000',
      Upgrade: 'websocket',
    },
  });
  const socket = response.webSocket;
  if (socket === null) {
    throw new Error('Expected a WebSocket response.');
  }
  const next = createMessageReader(socket);
  socket.accept();
  send(socket, {
    type: 'authenticate',
    role,
    token: role === 'buyer' ? credentials.buyerToken : credentials.hostToken,
    clientId: `${role}-${crypto.randomUUID()}`,
    lastSeenRevision,
  });
  const snapshot = await next('room-snapshot');
  expect(snapshot).toMatchObject({ type: 'room-snapshot', revision: 0 });
  return { socket, next };
}

async function commandResult(
  client: TestSocket,
): Promise<Extract<RemoteRoomServerMessage, { type: 'command-result' }>> {
  const message = await client.next('command-result');
  if (message.type !== 'command-result') {
    throw new Error('Expected command result.');
  }
  return message;
}

async function roomSnapshot(
  client: TestSocket,
): Promise<Extract<RemoteRoomServerMessage, { type: 'room-snapshot' }>> {
  const message = await client.next('room-snapshot');
  if (message.type !== 'room-snapshot') {
    throw new Error('Expected room snapshot.');
  }
  return message;
}

describe('evidence room worker', () => {
  it('creates a room without putting either role credential in the URL', async () => {
    const response = await SELF.fetch('https://rooms.example/rooms', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    });
    const body: unknown = await response.json();
    const credentials = roomCredentialsSchema.parse(body);

    expect(response.status).toBe(201);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(credentials.buyerToken).not.toBe(credentials.hostToken);
    expect(response.url).not.toContain(credentials.buyerToken);
    expect(response.url).not.toContain(credentials.hostToken);
  });

  it('rejects untrusted browser origins before creating a Durable Object', async () => {
    const response = await SELF.fetch('https://rooms.example/rooms', {
      method: 'POST',
      headers: { Origin: 'https://attacker.example' },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('runs the buyer-to-host evidence journey with authoritative revisions', async () => {
    const credentials = await createRoom();
    const buyer = await connect(credentials, 'buyer');
    const host = await connect(credentials, 'host');
    await buyer.next('room-snapshot');

    send(buyer.socket, {
      type: 'command',
      commandId: 'scope-1',
      expectedRevision: 0,
      command: {
        kind: 'set-evidence-requirements',
        actor: 'agent',
        requirements: defaultEvidenceRequirements,
      },
    });
    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 1 });
    expect(await roomSnapshot(buyer)).toMatchObject({ revision: 1 });
    expect(await roomSnapshot(host)).toMatchObject({
      revision: 1,
      state: { evidenceRequirements: defaultEvidenceRequirements },
    });

    send(buyer.socket, {
      type: 'command',
      commandId: 'request-1',
      expectedRevision: 1,
      command: { kind: 'request-repair-history', actor: 'agent' },
    });
    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 2 });
    expect(await roomSnapshot(buyer)).toMatchObject({ revision: 2 });
    expect(await roomSnapshot(host)).toMatchObject({
      revision: 2,
      state: { evidenceRequests: [{ status: 'queued' }] },
    });

    send(host.socket, {
      type: 'command',
      commandId: 'answer-1',
      expectedRevision: 2,
      command: {
        kind: 'answer-repair-history',
        repairHistory: 'none',
        evidenceFrame: {
          kind: 'fixture-frame',
          frameId: 'fixture-host-frame-0031',
          label: 'Host fixture disclosure · source frame 00:31',
          capturedAt: null,
          showOffsetSeconds: 31,
          sha256: null,
          widthPx: null,
          heightPx: null,
        },
        visualReview: null,
        publicEvidenceImage: null,
      },
    });
    expect(await commandResult(host)).toMatchObject({ ok: true, revision: 3 });
    const resolved = await roomSnapshot(buyer);
    expect(resolved).toMatchObject({
      revision: 3,
      state: { lot: { evidence: { repairHistory: 'none' } } },
    });
    expect(JSON.stringify(resolved)).not.toContain('450');
  });

  it('rejects role escalation, stale writes, and replays duplicates idempotently', async () => {
    const credentials = await createRoom();
    const buyer = await connect(credentials, 'buyer');
    const host = await connect(credentials, 'host');
    await buyer.next('room-snapshot');

    send(host.socket, {
      type: 'command',
      commandId: 'host-reserve',
      expectedRevision: 0,
      command: {
        kind: 'reserve-current-lot',
        actor: 'buyer',
        expectedAllInPrice: 423,
      },
    });
    expect(await host.next('room-error')).toMatchObject({
      type: 'room-error',
      code: 'unauthorized-command',
      currentRevision: 0,
    });

    const scopeMessage: RemoteRoomClientMessage = {
      type: 'command',
      commandId: 'scope-once',
      expectedRevision: 0,
      command: {
        kind: 'set-evidence-requirements',
        actor: 'buyer',
        requirements: defaultEvidenceRequirements,
      },
    };
    send(buyer.socket, scopeMessage);
    expect(await commandResult(buyer)).toMatchObject({ duplicate: false, revision: 1 });
    expect(await roomSnapshot(buyer)).toMatchObject({ revision: 1 });
    await host.next('room-snapshot');

    send(buyer.socket, scopeMessage);
    expect(await commandResult(buyer)).toMatchObject({ duplicate: true, revision: 1 });
    expect(await roomSnapshot(buyer)).toMatchObject({ revision: 1 });

    send(buyer.socket, {
      type: 'command',
      commandId: 'stale-new-command',
      expectedRevision: 0,
      command: { kind: 'request-repair-history', actor: 'buyer' },
    });
    expect(await buyer.next('room-error')).toMatchObject({
      type: 'room-error',
      code: 'stale-revision',
      currentRevision: 1,
    });
    expect(await roomSnapshot(buyer)).toMatchObject({ revision: 1, recovered: true });
  });

  it('recovers durable state and authenticated sockets after hibernation', async () => {
    const credentials = await createRoom();
    const buyer = await connect(credentials, 'buyer');
    const id = workerEnv.ROOMS.idFromName(credentials.roomId);
    const stub = workerEnv.ROOMS.get(id);

    await evictDurableObject(stub);
    send(buyer.socket, {
      type: 'command',
      commandId: 'after-hibernation',
      expectedRevision: 0,
      command: {
        kind: 'set-evidence-requirements',
        actor: 'agent',
        requirements: defaultEvidenceRequirements,
      },
    });

    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 1 });
    expect(await roomSnapshot(buyer)).toMatchObject({
      revision: 1,
      state: { evidenceRequirements: defaultEvidenceRequirements },
    });
  });

  it('deletes the room and closes peers when its alarm fires', async () => {
    const credentials = await createRoom();
    const buyer = await connect(credentials, 'buyer');
    const id = workerEnv.ROOMS.idFromName(credentials.roomId);
    const stub = workerEnv.ROOMS.get(id);

    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await buyer.next('room-expired')).toMatchObject({ type: 'room-expired' });

    const response = await stub.fetch('https://room.internal/connect', {
      headers: { Upgrade: 'websocket' },
    });
    expect(response.status).toBe(404);
  });
});
