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
  role: 'buyer' | 'host' | 'attendee',
  lastSeenRevision = 0,
  attendeeIndex = 0,
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
  const attendeeToken = credentials.attendeeCredentials[attendeeIndex]?.token;
  if (role === 'attendee' && attendeeToken === undefined) {
    throw new Error(`Expected attendee credential ${attendeeIndex + 1}.`);
  }
  send(socket, {
    type: 'authenticate',
    role,
    token:
      role === 'buyer'
        ? credentials.buyerToken
        : role === 'host'
          ? credentials.hostToken
          : (attendeeToken ?? ''),
    clientId: `${role}-${crypto.randomUUID()}`,
    lastSeenRevision,
  });
  const snapshot = await next('room-snapshot');
  expect(snapshot).toMatchObject({ type: 'room-snapshot', revision: lastSeenRevision });
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
  it('exposes liveness, commerce configuration, and Cloudflare version metadata', async () => {
    const response = await SELF.fetch('https://rooms.example/healthz');
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      protocolVersion: '3',
      ucpCommerceConfigured: true,
      workerVersion: {
        id: expect.any(String),
        tag: expect.any(String),
        timestamp: expect.any(String),
      },
    });
  });

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
    expect(new Set(credentials.attendeeCredentials.map(({ token }) => token)).size).toBe(7);
    expect(
      credentials.attendeeCredentials.every(
        ({ token }) => token !== credentials.buyerToken && token !== credentials.hostToken,
      ),
    ).toBe(true);
    expect(response.url).not.toContain(credentials.buyerToken);
    expect(response.url).not.toContain(credentials.hostToken);
    for (const { token } of credentials.attendeeCredentials) {
      expect(response.url).not.toContain(token);
    }
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
      },
    });
    expect(await commandResult(host)).toMatchObject({ ok: true, revision: 3 });
    const resolved = await roomSnapshot(buyer);
    expect(resolved).toMatchObject({
      revision: 3,
      state: { lot: { evidence: { repairHistory: 'none' } } },
    });
    expect(JSON.stringify(resolved)).not.toContain('$450');
    expect(JSON.stringify(resolved)).not.toContain('maxAllInPrice');
  });

  it('replaces crowd fixtures with seven distinct least-authority attendee sessions', async () => {
    const credentials = await createRoom();
    const buyer = await connect(credentials, 'buyer');

    send(buyer.socket, {
      type: 'command',
      commandId: 'crowd-scope',
      expectedRevision: 0,
      command: {
        kind: 'set-evidence-requirements',
        actor: 'agent',
        requirements: defaultEvidenceRequirements,
      },
    });
    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 1 });
    await roomSnapshot(buyer);

    send(buyer.socket, {
      type: 'command',
      commandId: 'crowd-request',
      expectedRevision: 1,
      command: { kind: 'request-repair-history', actor: 'agent' },
    });
    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 2 });
    await roomSnapshot(buyer);

    send(buyer.socket, {
      type: 'command',
      commandId: 'buyer-cannot-join-crowd',
      expectedRevision: 2,
      command: { kind: 'join-evidence-demand' },
    });
    expect(await buyer.next('room-error')).toMatchObject({
      code: 'unauthorized-command',
      currentRevision: 2,
    });

    let revision = 2;
    let finalAttendeeSnapshot: Extract<RemoteRoomServerMessage, { type: 'room-snapshot' }> | null =
      null;
    for (let attendeeIndex = 0; attendeeIndex < 7; attendeeIndex += 1) {
      const attendee = await connect(credentials, 'attendee', revision, attendeeIndex);

      if (attendeeIndex === 0) {
        const forbiddenCommands = [
          {
            kind: 'reserve-current-lot',
            actor: 'agent',
            expectedAllInPrice: 423,
          },
          { kind: 'answer-repair-history', repairHistory: 'none' },
          { kind: 'reset-room' },
        ] as const;
        for (const [index, command] of forbiddenCommands.entries()) {
          send(attendee.socket, {
            type: 'command',
            commandId: `attendee-forbidden-${index}`,
            expectedRevision: revision,
            command,
          });
          expect(await attendee.next('room-error')).toMatchObject({
            code: 'unauthorized-command',
            currentRevision: revision,
          });
        }
      }

      send(attendee.socket, {
        type: 'command',
        commandId: `attendee-join-${attendeeIndex + 1}`,
        expectedRevision: revision,
        command: { kind: 'join-evidence-demand' },
      });
      revision += 1;
      expect(await commandResult(attendee)).toMatchObject({
        ok: true,
        duplicate: false,
        revision,
      });
      finalAttendeeSnapshot = await roomSnapshot(attendee);
      expect(finalAttendeeSnapshot).toMatchObject({
        revision,
        state: { authenticatedAttendeeCount: attendeeIndex + 1 },
      });
      attendee.socket.close(1000, 'Attendee proof complete');
    }

    expect(finalAttendeeSnapshot).not.toBeNull();
    const serializedSnapshot = JSON.stringify(finalAttendeeSnapshot);
    expect(serializedSnapshot).not.toMatch(/attendee-[1-7]/);
    for (const { token } of credentials.attendeeCredentials) {
      expect(serializedSnapshot).not.toContain(token);
    }

    const id = workerEnv.ROOMS.idFromName(credentials.roomId);
    await evictDurableObject(workerEnv.ROOMS.get(id));

    const returningAttendee = await connect(credentials, 'attendee', revision, 0);
    send(returningAttendee.socket, {
      type: 'command',
      commandId: 'returning-attendee-does-not-double-count',
      expectedRevision: revision,
      command: { kind: 'join-evidence-demand' },
    });
    revision += 1;
    expect(await commandResult(returningAttendee)).toMatchObject({
      ok: true,
      revision,
      message: 'This authenticated attendee already joined the evidence request.',
    });
    expect(await roomSnapshot(returningAttendee)).toMatchObject({
      revision,
      state: { authenticatedAttendeeCount: 7 },
    });
    returningAttendee.socket.close(1000, 'Idempotency verified');

    const host = await connect(credentials, 'host', revision);
    send(host.socket, {
      type: 'command',
      commandId: 'crowd-answer',
      expectedRevision: revision,
      command: { kind: 'answer-repair-history', repairHistory: 'none' },
    });
    revision += 1;
    expect(await commandResult(host)).toMatchObject({
      ok: true,
      revision,
      message: 'One camera answer resolved 8 private agent decisions.',
    });
    expect(await roomSnapshot(host)).toMatchObject({
      revision,
      state: {
        authenticatedAttendeeCount: 7,
        lot: { evidence: { repairHistory: 'none' } },
      },
    });
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
      commandId: 'scope-once',
      expectedRevision: 1,
      command: { kind: 'request-repair-history', actor: 'buyer' },
    });
    expect(await buyer.next('room-error')).toMatchObject({
      type: 'room-error',
      code: 'invalid-message',
      recoverable: false,
      currentRevision: 1,
      commandId: 'scope-once',
    });

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

  it('gates an anonymous UCP cart behind evidence and keeps its credential server-private', async () => {
    const outbound = workerEnv.UCP_OUTBOUND;
    if (outbound === undefined) {
      throw new Error('Expected the test UCP service binding.');
    }
    const credentials = await createRoom();
    const buyer = await connect(credentials, 'buyer');
    const host = await connect(credentials, 'host');
    await buyer.next('room-snapshot');

    send(buyer.socket, {
      type: 'command',
      commandId: 'ucp-scope',
      expectedRevision: 0,
      command: {
        kind: 'set-evidence-requirements',
        actor: 'agent',
        requirements: defaultEvidenceRequirements,
      },
    });
    await commandResult(buyer);
    await roomSnapshot(buyer);
    await roomSnapshot(host);

    send(buyer.socket, {
      type: 'command',
      commandId: 'ucp-request',
      expectedRevision: 1,
      command: { kind: 'request-repair-history', actor: 'agent' },
    });
    await commandResult(buyer);
    await roomSnapshot(buyer);
    await roomSnapshot(host);

    send(host.socket, {
      type: 'command',
      commandId: 'ucp-answer',
      expectedRevision: 2,
      command: { kind: 'answer-repair-history', repairHistory: 'none' },
    });
    await commandResult(host);
    await roomSnapshot(host);
    await roomSnapshot(buyer);

    send(buyer.socket, {
      type: 'command',
      commandId: 'ucp-hold',
      expectedRevision: 3,
      command: { kind: 'reserve-current-lot', actor: 'agent', expectedAllInPrice: 423 },
    });
    await commandResult(buyer);
    await roomSnapshot(buyer);
    await roomSnapshot(host);

    const prepareMessage = {
      type: 'command',
      commandId: 'ucp-prepare-once',
      expectedRevision: 4,
      command: { kind: 'prepare-merchant-cart', actor: 'agent' },
    } as const satisfies RemoteRoomClientMessage;
    send(buyer.socket, prepareMessage);
    const prepareResult = await commandResult(buyer);
    expect(prepareResult.ok, prepareResult.message).toBe(true);
    expect(prepareResult).toMatchObject({
      duplicate: false,
      revision: 5,
      privateResult: {
        kind: 'ucp-cart-handoff',
        continueUrl: 'https://merchant.example/cart/c/private-test-cart',
      },
    });
    const prepared = await roomSnapshot(buyer);
    await roomSnapshot(host);
    expect(prepared).toMatchObject({
      revision: 5,
      state: {
        commerce: {
          available: true,
          protocolVersion: '2026-08-25',
          merchantOrigin: 'https://merchant.example',
          cartStatus: 'active',
          receipt: {
            currency: 'USD',
            totals: [
              { type: 'subtotal', displayText: 'Item subtotal', amount: 37500 },
              { type: 'fulfillment', displayText: 'Flat shipping', amount: 4800 },
              { type: 'total', displayText: 'Exact total', amount: 42300 },
            ],
            continuationAvailable: true,
          },
        },
      },
    });
    expect(JSON.stringify(prepared)).not.toContain('private-test-cart');

    send(host.socket, {
      type: 'command',
      commandId: 'ucp-prepare-once',
      expectedRevision: 5,
      command: { kind: 'answer-repair-history', repairHistory: 'none' },
    });
    expect(await host.next('room-error')).toMatchObject({
      type: 'room-error',
      code: 'invalid-message',
      recoverable: false,
      currentRevision: 5,
      commandId: 'ucp-prepare-once',
    });

    send(buyer.socket, prepareMessage);
    expect(await commandResult(buyer)).toMatchObject({
      ok: true,
      duplicate: true,
      revision: 5,
      privateResult: { kind: 'ucp-cart-handoff' },
    });
    await roomSnapshot(buyer);

    send(buyer.socket, {
      type: 'command',
      commandId: 'ucp-cancel',
      expectedRevision: 5,
      command: { kind: 'cancel-merchant-cart', actor: 'agent' },
    });
    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 6 });
    expect(await roomSnapshot(buyer)).toMatchObject({
      revision: 6,
      state: { commerce: { cartStatus: 'cancelled' } },
    });
    await roomSnapshot(host);

    send(buyer.socket, prepareMessage);
    expect(await commandResult(buyer)).toMatchObject({
      ok: true,
      duplicate: true,
      revision: 5,
      privateResult: null,
    });
    await roomSnapshot(buyer);

    send(buyer.socket, {
      type: 'command',
      commandId: 'ucp-release',
      expectedRevision: 6,
      command: { kind: 'release-current-lot', actor: 'agent' },
    });
    expect(await commandResult(buyer)).toMatchObject({ ok: true, revision: 7 });
    expect(await roomSnapshot(buyer)).toMatchObject({
      revision: 7,
      state: { reservation: null, commerce: { cartStatus: 'none', receipt: null } },
    });
    await roomSnapshot(host);
  });
});
