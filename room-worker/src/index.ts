import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

import { createInitialState } from '../../src/lib/live-market/model';
import {
  applyRoomCommand,
  remoteRoomRoles,
  roomRoleCanDispatch,
  type RemoteRoomRole,
  type RoomCommand,
} from '../../src/lib/live-market/room-command';
import {
  parseRemoteRoomClientMessage,
  remoteRoomIdPattern,
  remoteRoomProtocolVersion,
  type RemoteRoomErrorCode,
  type RemoteRoomServerMessage,
  type RoomPresence,
} from '../../src/lib/live-market/remote-room-protocol';
import { liveMarketStateSchema } from '../../src/lib/live-market/room-sync';

export interface WorkerEnv {
  readonly ROOMS: DurableObjectNamespace<EvidenceRoom>;
  readonly ALLOWED_ORIGINS: string;
  readonly ROOM_TTL_SECONDS: string;
}

interface ProcessedCommand {
  readonly commandId: string;
  readonly revision: number;
  readonly ok: boolean;
  readonly message: string;
}

interface StoredRoom {
  readonly protocolVersion: typeof remoteRoomProtocolVersion;
  readonly buyerTokenDigest: string;
  readonly hostTokenDigest: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly revision: number;
  readonly state: ReturnType<typeof createInitialState>;
  readonly lastMessage: string;
  readonly processedCommands: readonly ProcessedCommand[];
}

interface SocketAttachment {
  readonly authenticated: boolean;
  readonly role: RemoteRoomRole | null;
  readonly clientId: string | null;
}

const processedCommandSchema = z.strictObject({
  commandId: z.string().min(1).max(160),
  revision: z.number().int().nonnegative(),
  ok: z.boolean(),
  message: z.string().min(1).max(500),
});

const storedRoomSchema = z.strictObject({
  protocolVersion: z.literal(remoteRoomProtocolVersion),
  buyerTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  hostTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  state: liveMarketStateSchema,
  lastMessage: z.string().min(1).max(500),
  processedCommands: z.array(processedCommandSchema).max(128),
});

const initializeRoomSchema = z
  .strictObject({
    buyerTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
    hostTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
    createdAt: z.number().int().positive(),
    expiresAt: z.number().int().positive(),
  })
  .refine(({ createdAt, expiresAt }) => expiresAt > createdAt, {
    message: 'Room expiry must follow creation.',
  });

const socketAttachmentSchema = z.strictObject({
  authenticated: z.boolean(),
  role: z.enum(remoteRoomRoles).nullable(),
  clientId: z.string().min(1).max(160).nullable(),
});

const storedRoomKey = 'room';
const roomIdAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const maxProcessedCommands = 128;
const maxInboundMessageCharacters = 1_200_000;
const defaultRoomTtlSeconds = 7_200;

function jsonResponse(body: object, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function randomBase64Url(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function randomRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => roomIdAlphabet.charAt(byte % roomIdAlphabet.length)).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function roomTtlMilliseconds(env: WorkerEnv): number {
  const parsed = Number.parseInt(env.ROOM_TTL_SECONDS, 10);
  const seconds = Number.isFinite(parsed)
    ? Math.min(86_400, Math.max(300, parsed))
    : defaultRoomTtlSeconds;
  return seconds * 1_000;
}

function allowedOrigins(env: WorkerEnv): ReadonlySet<string> {
  return new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}

function requestOriginAllowed(request: Request, env: WorkerEnv): boolean {
  const origin = request.headers.get('Origin');
  return origin === null || allowedOrigins(env).has(origin);
}

function corsHeaders(request: Request, env: WorkerEnv): HeadersInit {
  const origin = request.headers.get('Origin');
  if (origin === null || !allowedOrigins(env).has(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function socketAttachment(socket: WebSocket): SocketAttachment {
  const value: unknown = socket.deserializeAttachment();
  const parsed = socketAttachmentSchema.safeParse(value);
  return parsed.success ? parsed.data : { authenticated: false, role: null, clientId: null };
}

function send(socket: WebSocket, message: RemoteRoomServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // A peer can disconnect between enumeration and send.
  }
}

function roomError(
  socket: WebSocket,
  code: RemoteRoomErrorCode,
  message: string,
  recoverable: boolean,
  currentRevision: number | null,
): void {
  send(socket, {
    type: 'room-error',
    code,
    message,
    recoverable,
    currentRevision,
  });
}

export class EvidenceRoom extends DurableObject<WorkerEnv> {
  private room: StoredRoom | null = null;
  private commandQueue: Promise<void> = Promise.resolve();

  constructor(context: DurableObjectState, env: WorkerEnv) {
    super(context, env);
    void context.blockConcurrencyWhile(async () => {
      const stored: unknown = await context.storage.get(storedRoomKey);
      if (stored === undefined) {
        return;
      }
      const parsed = storedRoomSchema.safeParse(stored);
      if (!parsed.success) {
        await context.storage.deleteAll();
        return;
      }
      this.room = parsed.data;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/initialize') {
      return this.initialize(request);
    }
    if (request.method === 'GET' && url.pathname === '/connect') {
      return this.connectWebSocket(request);
    }
    return jsonResponse({ error: 'not_found' }, 404);
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const task = async (): Promise<void> => {
      try {
        await this.processSocketMessage(socket, message);
      } catch (error: unknown) {
        console.error('Evidence room message failure', error);
        roomError(socket, 'internal-error', 'The room could not process that message.', true, null);
      }
    };
    const queued = this.commandQueue.then(task, task);
    this.commandQueue = queued.catch(() => undefined);
    await queued;
  }

  async webSocketClose(): Promise<void> {
    await this.broadcastSnapshot(false);
  }

  async webSocketError(socket: WebSocket, error: unknown): Promise<void> {
    console.error('Evidence room WebSocket error', {
      clientId: socketAttachment(socket).clientId,
      error,
    });
    await this.broadcastSnapshot(false);
  }

  async alarm(): Promise<void> {
    await this.expireRoom();
  }

  private async initialize(request: Request): Promise<Response> {
    if (this.room !== null) {
      return jsonResponse({ error: 'room_exists' }, 409);
    }
    const input: unknown = await request.json().catch(() => null);
    const parsed = initializeRoomSchema.safeParse(input);
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_initialization' }, 400);
    }

    const room: StoredRoom = {
      protocolVersion: remoteRoomProtocolVersion,
      ...parsed.data,
      revision: 0,
      state: createInitialState(),
      lastMessage: 'Room created. Waiting for public evidence requirements.',
      processedCommands: [],
    };
    await this.saveRoom(room);
    await this.ctx.storage.setAlarm(room.expiresAt);
    return jsonResponse({ ok: true }, 201);
  }

  private async connectWebSocket(request: Request): Promise<Response> {
    const room = this.room;
    if (room === null) {
      return jsonResponse({ error: 'room_not_found' }, 404);
    }
    if (Date.now() >= room.expiresAt) {
      await this.expireRoom();
      return jsonResponse({ error: 'room_expired' }, 410);
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse({ error: 'websocket_upgrade_required' }, 426);
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ authenticated: false, role: null, clientId: null });
    return new Response(null, { status: 101, webSocket: client });
  }

  private async processSocketMessage(
    socket: WebSocket,
    rawMessage: string | ArrayBuffer,
  ): Promise<void> {
    const room = this.room;
    if (room === null) {
      roomError(socket, 'room-unavailable', 'This evidence room is unavailable.', false, null);
      socket.close(1008, 'Room unavailable');
      return;
    }
    if (Date.now() >= room.expiresAt) {
      await this.expireRoom();
      return;
    }
    if (typeof rawMessage !== 'string' || rawMessage.length > maxInboundMessageCharacters) {
      roomError(
        socket,
        'invalid-message',
        'Send one bounded JSON protocol message.',
        true,
        room.revision,
      );
      return;
    }

    const message = parseRemoteRoomClientMessage(parseJson(rawMessage));
    if (message === null) {
      roomError(
        socket,
        'invalid-message',
        'The room message did not match protocol v1.',
        true,
        room.revision,
      );
      return;
    }

    const attachment = socketAttachment(socket);
    if (!attachment.authenticated) {
      if (message.type !== 'authenticate') {
        roomError(
          socket,
          'authentication-required',
          'Authenticate before sending room commands.',
          true,
          room.revision,
        );
        return;
      }
      await this.authenticate(
        socket,
        message.role,
        message.token,
        message.clientId,
        message.lastSeenRevision,
      );
      return;
    }

    if (message.type === 'authenticate') {
      roomError(
        socket,
        'invalid-message',
        'This connection is already authenticated.',
        true,
        room.revision,
      );
      return;
    }
    if (attachment.role === null || !roomRoleCanDispatch(attachment.role, message.command)) {
      roomError(
        socket,
        'unauthorized-command',
        'This room role cannot perform that command.',
        true,
        room.revision,
      );
      return;
    }
    await this.applyCommand(socket, message.commandId, message.expectedRevision, message.command);
  }

  private async authenticate(
    socket: WebSocket,
    role: RemoteRoomRole,
    token: string,
    clientId: string,
    lastSeenRevision: number,
  ): Promise<void> {
    const room = this.room;
    if (room === null) {
      roomError(socket, 'room-unavailable', 'This evidence room is unavailable.', false, null);
      return;
    }
    const digest = await sha256Hex(token);
    const expectedDigest = role === 'buyer' ? room.buyerTokenDigest : room.hostTokenDigest;
    if (!constantTimeEqual(digest, expectedDigest)) {
      roomError(
        socket,
        'authentication-failed',
        'The room credential was not accepted.',
        false,
        null,
      );
      socket.close(1008, 'Authentication failed');
      return;
    }

    socket.serializeAttachment({ authenticated: true, role, clientId });
    this.sendSnapshot(socket, lastSeenRevision !== room.revision);
    await this.broadcastSnapshot(false, socket);
  }

  private async applyCommand(
    socket: WebSocket,
    commandId: string,
    expectedRevision: number,
    command: RoomCommand,
  ): Promise<void> {
    const room = this.room;
    if (room === null) {
      roomError(socket, 'room-unavailable', 'This evidence room is unavailable.', false, null);
      return;
    }

    const previous = room.processedCommands.find((candidate) => candidate.commandId === commandId);
    if (previous !== undefined) {
      send(socket, {
        type: 'command-result',
        commandId,
        ok: previous.ok,
        duplicate: true,
        revision: previous.revision,
        message: previous.message,
      });
      this.sendSnapshot(socket, false);
      return;
    }
    if (expectedRevision !== room.revision) {
      roomError(
        socket,
        'stale-revision',
        `Expected revision ${expectedRevision}; current revision is ${room.revision}.`,
        true,
        room.revision,
      );
      this.sendSnapshot(socket, true);
      return;
    }

    const result = applyRoomCommand(room.state, command);
    const revision = room.revision + 1;
    const processed: ProcessedCommand = {
      commandId,
      revision,
      ok: result.ok,
      message: result.message,
    };
    const nextRoom: StoredRoom = {
      ...room,
      revision,
      state: result.state,
      lastMessage: result.message,
      processedCommands: [...room.processedCommands, processed].slice(-maxProcessedCommands),
    };
    await this.saveRoom(nextRoom);
    send(socket, {
      type: 'command-result',
      commandId,
      ok: result.ok,
      duplicate: false,
      revision,
      message: result.message,
    });
    await this.broadcastSnapshot(false);
  }

  private async saveRoom(room: StoredRoom): Promise<void> {
    await this.ctx.storage.put(storedRoomKey, room);
    this.room = room;
  }

  private presence(): RoomPresence {
    let buyer = 0;
    let host = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socketAttachment(socket);
      if (!attachment.authenticated || attachment.role === null) {
        continue;
      }
      if (attachment.role === 'buyer') {
        buyer += 1;
      } else {
        host += 1;
      }
    }
    return { buyer, host };
  }

  private sendSnapshot(socket: WebSocket, recovered: boolean): void {
    const room = this.room;
    if (room === null) {
      return;
    }
    send(socket, {
      type: 'room-snapshot',
      protocolVersion: remoteRoomProtocolVersion,
      roomId: this.ctx.id.name ?? 'UNKNOWN',
      revision: room.revision,
      state: room.state,
      message: room.lastMessage,
      presence: this.presence(),
      recovered,
      serverTime: Date.now(),
    });
  }

  private async broadcastSnapshot(recovered: boolean, except?: WebSocket): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === except || !socketAttachment(socket).authenticated) {
        continue;
      }
      this.sendSnapshot(socket, recovered);
    }
  }

  private async expireRoom(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      send(socket, {
        type: 'room-expired',
        message: 'This temporary evidence room expired. Create a new room to continue.',
      });
      socket.close(1001, 'Room expired');
    }
    this.room = null;
    await this.ctx.storage.deleteAll();
  }
}

async function createRoom(request: Request, env: WorkerEnv): Promise<Response> {
  const createdAt = Date.now();
  const expiresAt = createdAt + roomTtlMilliseconds(env);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const roomId = randomRoomId();
    const buyerToken = randomBase64Url(32);
    const hostToken = randomBase64Url(32);
    const id = env.ROOMS.idFromName(roomId);
    const stub = env.ROOMS.get(id);
    const initialization = await stub.fetch('https://room.internal/initialize', {
      method: 'POST',
      body: JSON.stringify({
        buyerTokenDigest: await sha256Hex(buyerToken),
        hostTokenDigest: await sha256Hex(hostToken),
        createdAt,
        expiresAt,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    if (initialization.status === 409) {
      continue;
    }
    if (!initialization.ok) {
      return jsonResponse({ error: 'room_initialization_failed' }, 500, corsHeaders(request, env));
    }
    return jsonResponse(
      {
        protocolVersion: remoteRoomProtocolVersion,
        roomId,
        buyerToken,
        hostToken,
        expiresAt,
      },
      201,
      corsHeaders(request, env),
    );
  }
  return jsonResponse({ error: 'room_id_collision' }, 503, corsHeaders(request, env));
}

async function route(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/healthz') {
    return jsonResponse({ ok: true, protocolVersion: remoteRoomProtocolVersion });
  }
  if (!requestOriginAllowed(request, env)) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403);
  }
  if (request.method === 'OPTIONS' && url.pathname === '/rooms') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method === 'POST' && url.pathname === '/rooms') {
    return createRoom(request, env);
  }

  const match = /^\/rooms\/([A-Z2-9]{6})\/ws$/.exec(url.pathname);
  if (request.method === 'GET' && match !== null) {
    const roomId = match[1];
    if (roomId === undefined || !remoteRoomIdPattern.test(roomId)) {
      return jsonResponse({ error: 'invalid_room_id' }, 400);
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse({ error: 'websocket_upgrade_required' }, 426);
    }
    const id = env.ROOMS.idFromName(roomId);
    return env.ROOMS.get(id).fetch('https://room.internal/connect', request);
  }
  return jsonResponse({ error: 'not_found' }, 404);
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error: unknown) {
      console.error('Evidence room request failure', error);
      return jsonResponse({ error: 'internal_error' }, 500, corsHeaders(request, env));
    }
  },
} satisfies ExportedHandler<WorkerEnv>;
