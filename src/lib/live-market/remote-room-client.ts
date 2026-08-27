import { createInitialState, type LiveMarketState, type TransitionResult } from './model';
import type { RoomCommand } from './room-command';
import {
  parseRemoteRoomServerMessage,
  remoteRoomIdPattern,
  roomCredentialsSchema,
  type RemoteRoomAccess,
  type RemoteRoomClientMessage,
  type RoomCredentials,
  type RoomPresence,
  type RoomSnapshotMessage,
} from './remote-room-protocol';

export const remoteRoomConnectionPhases = [
  'connecting',
  'online',
  'reconnecting',
  'expired',
  'error',
] as const;
export type RemoteRoomConnectionPhase = (typeof remoteRoomConnectionPhases)[number];

interface PendingCommand {
  readonly message: Extract<RemoteRoomClientMessage, { type: 'command' }>;
  readonly resolve: (result: TransitionResult) => void;
  readonly timeout: ReturnType<typeof setTimeout>;
  acknowledgement: {
    readonly ok: boolean;
    readonly revision: number;
    readonly message: string;
  } | null;
  failure: {
    readonly revision: number | null;
    readonly message: string;
  } | null;
}

export interface RemoteRoomClientOptions {
  readonly serviceUrl: string;
  readonly access: RemoteRoomAccess;
  readonly initialState?: LiveMarketState;
  readonly socketFactory?: (url: string) => WebSocket;
  readonly onSnapshot: (snapshot: RoomSnapshotMessage) => void;
  readonly onPhase: (phase: RemoteRoomConnectionPhase, message: string) => void;
}

const commandTimeoutMilliseconds = 15_000;
const initialReconnectDelayMilliseconds = 250;
const maximumReconnectDelayMilliseconds = 5_000;

function normalizeServiceUrl(value: string): URL {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('The evidence room service must use HTTP or HTTPS.');
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  url.search = '';
  url.hash = '';
  return url;
}

function roomWebSocketUrl(serviceUrl: string, roomId: string): string {
  const url = normalizeServiceUrl(serviceUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname}/rooms/${roomId}/ws`.replaceAll('//', '/');
  return url.toString();
}

function defaultSocketFactory(url: string): WebSocket {
  return new WebSocket(url);
}

function parseEventData(data: unknown): unknown {
  if (typeof data !== 'string') {
    return null;
  }
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}

export async function createRemoteRoom(
  serviceUrl: string,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<RoomCredentials> {
  const url = normalizeServiceUrl(serviceUrl);
  url.pathname = `${url.pathname}/rooms`.replaceAll('//', '/');
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: signal ?? null,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error('The evidence room service could not create a temporary room.');
  }
  return roomCredentialsSchema.parse(body);
}

export class RemoteRoomClient {
  private readonly serviceUrl: string;
  private readonly access: RemoteRoomAccess;
  private readonly socketFactory: (url: string) => WebSocket;
  private readonly onSnapshot: (snapshot: RoomSnapshotMessage) => void;
  private readonly onPhase: (phase: RemoteRoomConnectionPhase, message: string) => void;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = initialReconnectDelayMilliseconds;
  private stopped = false;
  private authenticated = false;
  private awaitingAuthenticationSnapshot = false;
  private revision = 0;
  private state: LiveMarketState;
  private readonly clientId = crypto.randomUUID();
  private readonly pending = new Map<string, PendingCommand>();

  constructor(options: RemoteRoomClientOptions) {
    if (!remoteRoomIdPattern.test(options.access.roomId)) {
      throw new Error('The evidence room ID is invalid.');
    }
    if (options.access.expiresAt <= Date.now()) {
      throw new Error('The evidence room invite has expired.');
    }
    this.serviceUrl = normalizeServiceUrl(options.serviceUrl).toString();
    this.access = options.access;
    this.socketFactory = options.socketFactory ?? defaultSocketFactory;
    this.onSnapshot = options.onSnapshot;
    this.onPhase = options.onPhase;
    this.state = options.initialState ?? createInitialState();
  }

  connect(): void {
    if (this.stopped || this.socket !== null) {
      return;
    }
    this.onPhase(
      this.reconnectDelay === initialReconnectDelayMilliseconds ? 'connecting' : 'reconnecting',
      'Connecting to the temporary evidence room…',
    );
    const socket = this.socketFactory(roomWebSocketUrl(this.serviceUrl, this.access.roomId));
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket || this.stopped) {
        return;
      }
      this.awaitingAuthenticationSnapshot = true;
      this.send({
        type: 'authenticate',
        role: this.access.role,
        token: this.access.token,
        clientId: this.clientId,
        lastSeenRevision: this.revision,
      });
    });
    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (this.socket !== socket || this.stopped) {
        return;
      }
      this.handleServerMessage(parseEventData(event.data));
    });
    socket.addEventListener('close', () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.authenticated = false;
      if (!this.stopped) {
        this.scheduleReconnect();
      }
    });
    socket.addEventListener('error', () => {
      if (!this.stopped) {
        this.onPhase('reconnecting', 'The room connection was interrupted; retrying safely.');
      }
    });
  }

  close(): void {
    this.stopped = true;
    this.authenticated = false;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close(1000, 'Client closed');
    this.socket = null;
    for (const [commandId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.resolve({
        ok: false,
        state: this.state,
        message: 'The evidence room closed before the command completed.',
      });
      this.pending.delete(commandId);
    }
  }

  dispatch(command: RoomCommand): Promise<TransitionResult> {
    if (this.stopped) {
      return Promise.resolve({
        ok: false,
        state: this.state,
        message: 'The evidence room is closed.',
      });
    }
    if (this.pending.size > 0) {
      return Promise.resolve({
        ok: false,
        state: this.state,
        message: 'Wait for the current room command to finish before sending another.',
      });
    }

    const commandId = crypto.randomUUID();
    const message = {
      type: 'command',
      commandId,
      expectedRevision: this.revision,
      command,
    } as const satisfies RemoteRoomClientMessage;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const pending = this.pending.get(commandId);
        if (pending === undefined) {
          return;
        }
        this.pending.delete(commandId);
        pending.resolve({
          ok: false,
          state: this.state,
          message: 'The evidence room did not acknowledge the command in time.',
        });
      }, commandTimeoutMilliseconds);
      this.pending.set(commandId, {
        message,
        resolve,
        timeout,
        acknowledgement: null,
        failure: null,
      });
      if (this.authenticated) {
        this.send(message);
      }
    });
  }

  private send(message: RemoteRoomClientMessage): void {
    if (this.socket?.readyState !== 1) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private handleServerMessage(value: unknown): void {
    const message = parseRemoteRoomServerMessage(value);
    if (message === null) {
      this.onPhase('error', 'The evidence room returned an invalid protocol message.');
      return;
    }
    if (message.type === 'room-expired') {
      this.stopForTerminalState('expired', message.message);
      return;
    }
    if (message.type === 'room-error') {
      if (!message.recoverable) {
        this.stopForTerminalState('error', message.message);
        return;
      }
      if (message.commandId !== null) {
        const pending = this.pending.get(message.commandId);
        if (pending !== undefined) {
          pending.failure = {
            revision: message.currentRevision,
            message: message.message,
          };
          if (message.code !== 'stale-revision') {
            this.resolvePending(message.commandId, false, message.message);
          }
        }
      }
      this.onPhase(this.authenticated ? 'online' : 'reconnecting', message.message);
      return;
    }
    if (message.type === 'command-result') {
      const pending = this.pending.get(message.commandId);
      if (pending === undefined) {
        return;
      }
      pending.acknowledgement = {
        ok: message.ok,
        revision: message.revision,
        message: message.message,
      };
      if (this.revision >= message.revision) {
        this.resolvePending(message.commandId, message.ok, message.message);
      }
      return;
    }

    if (message.roomId !== this.access.roomId) {
      this.stopForTerminalState('error', 'The room service returned a mismatched room.');
      return;
    }
    this.revision = message.revision;
    this.state = message.state;
    this.onSnapshot(message);
    const firstSnapshotOnSocket = this.awaitingAuthenticationSnapshot;
    if (firstSnapshotOnSocket) {
      this.awaitingAuthenticationSnapshot = false;
      this.authenticated = true;
      this.reconnectDelay = initialReconnectDelayMilliseconds;
      this.onPhase('online', message.message);
    }

    for (const [commandId, pending] of this.pending) {
      if (pending.acknowledgement !== null && this.revision >= pending.acknowledgement.revision) {
        this.resolvePending(commandId, pending.acknowledgement.ok, pending.acknowledgement.message);
      } else if (
        pending.failure !== null &&
        (pending.failure.revision === null || this.revision >= pending.failure.revision)
      ) {
        this.resolvePending(commandId, false, pending.failure.message);
      }
    }
    if (firstSnapshotOnSocket) {
      for (const pending of this.pending.values()) {
        this.send(pending.message);
      }
    }
  }

  private resolvePending(commandId: string, ok: boolean, message: string): void {
    const pending = this.pending.get(commandId);
    if (pending === undefined) {
      return;
    }
    clearTimeout(pending.timeout);
    this.pending.delete(commandId);
    pending.resolve({ ok, state: this.state, message });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.stopped) {
      return;
    }
    this.onPhase('reconnecting', 'Reconnecting to the same authoritative room…');
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(maximumReconnectDelayMilliseconds, this.reconnectDelay * 2);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private stopForTerminalState(
    phase: Extract<RemoteRoomConnectionPhase, 'expired' | 'error'>,
    message: string,
  ): void {
    this.onPhase(phase, message);
    this.stopped = true;
    this.socket?.close(1000, 'Terminal room state');
    this.socket = null;
    for (const commandId of [...this.pending.keys()]) {
      this.resolvePending(commandId, false, message);
    }
  }
}

export function emptyRoomPresence(): RoomPresence {
  return { buyer: 0, host: 0 };
}
