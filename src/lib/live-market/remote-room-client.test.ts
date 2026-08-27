import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyRoomCommand } from './room-command';
import {
  createRemoteRoom,
  RemoteRoomClient,
  type RemoteRoomConnectionPhase,
} from './remote-room-client';
import {
  remoteRoomClientMessageSchema,
  remoteRoomProtocolVersion,
  type RemoteRoomAccess,
  type RemoteRoomClientMessage,
  type RemoteRoomServerMessage,
  type RoomSnapshotMessage,
} from './remote-room-protocol';
import { createInitialState, defaultEvidenceRequirements, type LiveMarketState } from './model';

class FakeWebSocket extends EventTarget {
  readonly url: string;
  readonly sent: string[] = [];
  readyState = 0;

  constructor(url: string) {
    super();
    this.url = url;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.readyState === 3) {
      return;
    }
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }

  open(): void {
    this.readyState = 1;
    this.dispatchEvent(new Event('open'));
  }

  receive(message: RemoteRoomServerMessage): void {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  disconnect(): void {
    this.readyState = 3;
    this.dispatchEvent(new Event('close'));
  }
}

const access: RemoteRoomAccess = {
  roomId: 'ABC234',
  role: 'buyer',
  token: 'a'.repeat(43),
  expiresAt: Date.now() + 60_000,
};

function snapshot(
  revision: number,
  state: LiveMarketState,
  recovered = false,
): RoomSnapshotMessage {
  return {
    type: 'room-snapshot',
    protocolVersion: remoteRoomProtocolVersion,
    roomId: access.roomId,
    revision,
    state,
    message: revision === 0 ? 'Room ready.' : 'Room updated.',
    presence: { buyer: 1, host: 0, attendee: 0 },
    recovered,
    serverTime: Date.now(),
  };
}

function parsedSent(socket: FakeWebSocket): readonly RemoteRoomClientMessage[] {
  return socket.sent.map((value) => remoteRoomClientMessageSchema.parse(JSON.parse(value)));
}

function commandFrom(socket: FakeWebSocket): Extract<RemoteRoomClientMessage, { type: 'command' }> {
  const command = parsedSent(socket).find((message) => message.type === 'command');
  if (command === undefined || command.type !== 'command') {
    throw new Error('Expected a sent room command.');
  }
  return command;
}

interface ClientHarness {
  readonly client: RemoteRoomClient;
  readonly sockets: FakeWebSocket[];
  readonly phases: RemoteRoomConnectionPhase[];
}

function createHarness(): ClientHarness {
  const sockets: FakeWebSocket[] = [];
  const phases: RemoteRoomConnectionPhase[] = [];
  const client = new RemoteRoomClient({
    serviceUrl: 'https://rooms.example/',
    access,
    socketFactory: (url) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket as unknown as WebSocket;
    },
    onSnapshot: () => undefined,
    onPhase: (phase) => phases.push(phase),
  });
  return { client, sockets, phases };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RemoteRoomClient', () => {
  it('authenticates without putting the token in the URL and resolves after authoritative state', async () => {
    const { client, sockets, phases } = createHarness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) {
      throw new Error('Expected a socket.');
    }

    expect(socket.url).toBe('wss://rooms.example/rooms/ABC234/ws');
    expect(socket.url).not.toContain(access.token);
    socket.open();
    expect(parsedSent(socket)[0]).toMatchObject({
      type: 'authenticate',
      role: 'buyer',
      token: access.token,
    });
    socket.receive(snapshot(0, createInitialState()));

    const resultPromise = client.dispatch({
      kind: 'set-evidence-requirements',
      actor: 'agent',
      requirements: defaultEvidenceRequirements,
    });
    const command = commandFrom(socket);
    const nextState = applyRoomCommand(createInitialState(), command.command).state;
    socket.receive({
      type: 'command-result',
      commandId: command.commandId,
      ok: true,
      duplicate: false,
      revision: 1,
      message: 'Requirements recorded.',
      privateResult: null,
    });
    socket.receive(snapshot(1, nextState));

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      state: { evidenceRequirements: defaultEvidenceRequirements },
    });
    expect(phases).toContain('online');
    client.close();
  });

  it('replays the same command ID after reconnect so an applied command is idempotent', async () => {
    vi.useFakeTimers();
    const { client, sockets } = createHarness();
    client.connect();
    const first = sockets[0];
    if (first === undefined) {
      throw new Error('Expected the first socket.');
    }
    first.open();
    first.receive(snapshot(0, createInitialState()));

    const resultPromise = client.dispatch({
      kind: 'set-evidence-requirements',
      actor: 'buyer',
      requirements: defaultEvidenceRequirements,
    });
    const original = commandFrom(first);
    const nextState = applyRoomCommand(createInitialState(), original.command).state;
    first.disconnect();
    await vi.advanceTimersByTimeAsync(250);

    const second = sockets[1];
    if (second === undefined) {
      throw new Error('Expected the reconnect socket.');
    }
    second.open();
    second.receive(snapshot(1, nextState, true));
    const replay = commandFrom(second);
    expect(replay).toEqual(original);
    second.receive({
      type: 'command-result',
      commandId: replay.commandId,
      ok: true,
      duplicate: true,
      revision: 1,
      message: 'Requirements recorded.',
      privateResult: null,
    });

    await expect(resultPromise).resolves.toMatchObject({ ok: true });
    client.close();
  });

  it('returns a buyer-private cart handoff without placing it in the room snapshot', async () => {
    const { client, sockets } = createHarness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) {
      throw new Error('Expected a socket.');
    }
    socket.open();
    const state = createInitialState();
    socket.receive(snapshot(0, state));

    const resultPromise = client.dispatch({ kind: 'prepare-merchant-cart', actor: 'agent' });
    const command = commandFrom(socket);
    socket.receive({
      type: 'command-result',
      commandId: command.commandId,
      ok: true,
      duplicate: false,
      revision: 1,
      message: 'Cart prepared.',
      privateResult: {
        kind: 'ucp-cart-handoff',
        continueUrl: 'https://merchant.example/cart/c/private-test-cart',
        instruction: 'Open only with explicit buyer approval.',
      },
    });
    socket.receive(snapshot(1, state));

    await expect(resultPromise).resolves.toMatchObject({
      ok: true,
      privateResult: {
        kind: 'ucp-cart-handoff',
        continueUrl: 'https://merchant.example/cart/c/private-test-cart',
      },
    });
    expect(JSON.stringify(snapshot(1, state))).not.toContain('private-test-cart');
    client.close();
  });

  it('returns a stale command as a typed refusal after the recovery snapshot', async () => {
    const { client, sockets } = createHarness();
    client.connect();
    const socket = sockets[0];
    if (socket === undefined) {
      throw new Error('Expected a socket.');
    }
    socket.open();
    socket.receive(snapshot(0, createInitialState()));

    const resultPromise = client.dispatch({
      kind: 'request-repair-history',
      actor: 'agent',
    });
    const command = commandFrom(socket);
    const advancedState = applyRoomCommand(createInitialState(), {
      kind: 'set-evidence-requirements',
      actor: 'buyer',
      requirements: defaultEvidenceRequirements,
    }).state;
    socket.receive({
      type: 'room-error',
      code: 'stale-revision',
      message: 'Expected revision 0; current revision is 1.',
      recoverable: true,
      currentRevision: 1,
      commandId: command.commandId,
    });
    socket.receive(snapshot(1, advancedState, true));

    await expect(resultPromise).resolves.toMatchObject({
      ok: false,
      message: 'Expected revision 0; current revision is 1.',
      state: { evidenceRequirements: defaultEvidenceRequirements },
    });
    client.close();
  });

  it('parses the strict room-creation response', async () => {
    const attendeeCredentials = Array.from({ length: 7 }, (_, index) => ({
      attendeeId: `attendee-${index + 1}`,
      token: String(index + 1).repeat(43),
    }));
    const credentials = {
      protocolVersion: remoteRoomProtocolVersion,
      roomId: 'XYZ789',
      buyerToken: 'b'.repeat(43),
      hostToken: 'h'.repeat(43),
      attendeeCredentials,
      expiresAt: Date.now() + 60_000,
    } as const;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(credentials, { status: 201 }));

    await expect(createRemoteRoom('https://rooms.example/', undefined, fetcher)).resolves.toEqual(
      credentials,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('https://rooms.example/rooms'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
