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
  privateActionResultSchema,
  maximumRoomAttendeeCount,
  remoteRoomIdPattern,
  remoteRoomProtocolVersion,
  type RemoteRoomErrorCode,
  type RemoteRoomServerMessage,
  type RoomPresence,
} from '../../src/lib/live-market/remote-room-protocol';
import { liveMarketStateSchema } from '../../src/lib/live-market/room-sync';
import type { UcpFetch } from '../../src/lib/ucp/client';
import {
  cancelRoomMerchantCart,
  prepareRoomMerchantCart,
  readUcpRoomConfiguration,
  ucpIdempotencyKey,
} from './commerce';
import { routeProductEvidenceRequest, type ProductEvidenceWorkerEnv } from './product-evidence';

export { ProductEvidenceCaseObject } from './product-evidence';

export interface WorkerEnv extends ProductEvidenceWorkerEnv {
  readonly ROOMS: DurableObjectNamespace<EvidenceRoom>;
  readonly CF_VERSION_METADATA: WorkerVersionMetadata;
  readonly ALLOWED_ORIGINS: string;
  readonly ROOM_TTL_SECONDS: string;
  readonly UCP_BUSINESS_URL?: string;
  readonly UCP_VARIANT_ID?: string;
  readonly UCP_PLATFORM_PROFILE_URL?: string;
  readonly UCP_OUTBOUND?: Fetcher;
}

interface ProcessedCommand {
  readonly commandId: string;
  readonly role: RemoteRoomRole;
  readonly clientId: string;
  readonly commandDigest: string;
  readonly revision: number;
  readonly ok: boolean;
  readonly message: string;
  readonly privateResult: z.infer<typeof privateActionResultSchema> | null;
}

interface StoredAttendeeCredential {
  readonly attendeeId: string;
  readonly tokenDigest: string;
}

interface StoredRoom {
  readonly protocolVersion: typeof remoteRoomProtocolVersion;
  readonly buyerTokenDigest: string;
  readonly hostTokenDigest: string;
  readonly attendeeCredentials: readonly StoredAttendeeCredential[];
  readonly joinedAttendeeIds: readonly string[];
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly revision: number;
  readonly state: ReturnType<typeof createInitialState>;
  readonly lastMessage: string;
  readonly processedCommands: readonly ProcessedCommand[];
  readonly privateUcpCartId: string | null;
}

interface SocketAttachment {
  readonly authenticated: boolean;
  readonly role: RemoteRoomRole | null;
  readonly clientId: string | null;
  readonly attendeeId: string | null;
}

const storedAttendeeCredentialSchema = z.strictObject({
  attendeeId: z.string().regex(/^attendee-[1-7]$/),
  tokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
});

const storedAttendeeCredentialsSchema = z
  .array(storedAttendeeCredentialSchema)
  .length(maximumRoomAttendeeCount)
  .refine(
    (credentials) =>
      new Set(credentials.map(({ attendeeId }) => attendeeId)).size === credentials.length,
    'Attendee IDs must be unique.',
  )
  .refine(
    (credentials) =>
      new Set(credentials.map(({ tokenDigest }) => tokenDigest)).size === credentials.length,
    'Attendee credential digests must be unique.',
  );

const joinedAttendeeIdsSchema = z
  .array(z.string().regex(/^attendee-[1-7]$/))
  .max(maximumRoomAttendeeCount)
  .refine((ids) => new Set(ids).size === ids.length, 'Joined attendee IDs must be unique.');

const processedCommandSchema = z.strictObject({
  commandId: z.string().min(1).max(160),
  role: z.enum(remoteRoomRoles),
  clientId: z.string().min(1).max(160),
  commandDigest: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().nonnegative(),
  ok: z.boolean(),
  message: z.string().min(1).max(500),
  privateResult: privateActionResultSchema.nullable(),
});

const storedRoomSchema = z.strictObject({
  protocolVersion: z.literal(remoteRoomProtocolVersion),
  buyerTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  hostTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  attendeeCredentials: storedAttendeeCredentialsSchema,
  joinedAttendeeIds: joinedAttendeeIdsSchema,
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  revision: z.number().int().nonnegative(),
  state: liveMarketStateSchema,
  lastMessage: z.string().min(1).max(500),
  processedCommands: z.array(processedCommandSchema).max(128),
  privateUcpCartId: z.string().min(1).max(2_000).nullable(),
});

const initializeRoomSchema = z
  .strictObject({
    buyerTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
    hostTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
    attendeeCredentials: storedAttendeeCredentialsSchema,
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
  attendeeId: z
    .string()
    .regex(/^attendee-[1-7]$/)
    .nullable(),
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function socketAttachment(socket: WebSocket): SocketAttachment {
  const value: unknown = socket.deserializeAttachment();
  const parsed = socketAttachmentSchema.safeParse(value);
  return parsed.success
    ? parsed.data
    : { authenticated: false, role: null, clientId: null, attendeeId: null };
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
  commandId: string | null = null,
): void {
  send(socket, {
    type: 'room-error',
    code,
    message,
    recoverable,
    currentRevision,
    commandId,
  });
}

export class EvidenceRoom extends DurableObject<WorkerEnv> {
  private room: StoredRoom | null = null;
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly workerEnv: WorkerEnv;

  constructor(context: DurableObjectState, env: WorkerEnv) {
    super(context, env);
    this.workerEnv = env;
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
      joinedAttendeeIds: [],
      revision: 0,
      state: createInitialState(
        (() => {
          const configuration = readUcpRoomConfiguration(this.workerEnv);
          return configuration === null ? {} : { ucpMerchantOrigin: configuration.merchantOrigin };
        })(),
      ),
      lastMessage: 'Room created. Waiting for public evidence requirements.',
      processedCommands: [],
      privateUcpCartId: null,
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
    server.serializeAttachment({
      authenticated: false,
      role: null,
      clientId: null,
      attendeeId: null,
    });
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
        `The room message did not match protocol v${remoteRoomProtocolVersion}.`,
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
    if (
      attachment.role === null ||
      attachment.clientId === null ||
      (attachment.role === 'attendee' && attachment.attendeeId === null) ||
      !roomRoleCanDispatch(attachment.role, message.command)
    ) {
      roomError(
        socket,
        'unauthorized-command',
        'This room role cannot perform that command.',
        true,
        room.revision,
        message.commandId,
      );
      return;
    }
    await this.applyCommand(
      socket,
      attachment.role,
      attachment.clientId,
      attachment.attendeeId,
      message.commandId,
      message.expectedRevision,
      message.command,
    );
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
    const attendeeCredential =
      role === 'attendee'
        ? room.attendeeCredentials.find(({ tokenDigest }) => constantTimeEqual(digest, tokenDigest))
        : null;
    const expectedDigest =
      role === 'buyer'
        ? room.buyerTokenDigest
        : role === 'host'
          ? room.hostTokenDigest
          : attendeeCredential?.tokenDigest;
    if (expectedDigest === undefined || !constantTimeEqual(digest, expectedDigest)) {
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

    socket.serializeAttachment({
      authenticated: true,
      role,
      clientId,
      attendeeId: attendeeCredential?.attendeeId ?? null,
    });
    this.sendSnapshot(socket, lastSeenRevision !== room.revision);
    await this.broadcastSnapshot(false, socket);
  }

  private async applyCommand(
    socket: WebSocket,
    role: RemoteRoomRole,
    clientId: string,
    attendeeId: string | null,
    commandId: string,
    expectedRevision: number,
    command: RoomCommand,
  ): Promise<void> {
    const room = this.room;
    if (room === null) {
      roomError(socket, 'room-unavailable', 'This evidence room is unavailable.', false, null);
      return;
    }

    const commandDigest = await sha256Hex(JSON.stringify(command));
    const previous = room.processedCommands.find((candidate) => candidate.commandId === commandId);
    if (previous !== undefined) {
      if (
        previous.role !== role ||
        previous.clientId !== clientId ||
        !constantTimeEqual(previous.commandDigest, commandDigest)
      ) {
        roomError(
          socket,
          'invalid-message',
          'A command ID cannot be reused by another client, role, or payload.',
          false,
          room.revision,
          commandId,
        );
        return;
      }
      send(socket, {
        type: 'command-result',
        commandId,
        ok: previous.ok,
        duplicate: true,
        revision: previous.revision,
        message: previous.message,
        privateResult: previous.privateResult,
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
        commandId,
      );
      this.sendSnapshot(socket, true);
      return;
    }

    const execution = await this.executeRoomCommand(room, command, commandId, role, attendeeId);
    const result = execution.result;
    const revision = room.revision + 1;
    const processed: ProcessedCommand = {
      commandId,
      role,
      clientId,
      commandDigest,
      revision,
      ok: result.ok,
      message: result.message,
      privateResult: result.privateResult ?? null,
    };
    const priorProcessedCommands =
      result.ok && (command.kind === 'cancel-merchant-cart' || command.kind === 'reset-room')
        ? room.processedCommands.map((candidate) => ({ ...candidate, privateResult: null }))
        : room.processedCommands;
    const nextRoom: StoredRoom = {
      ...room,
      revision,
      state: result.state,
      lastMessage: result.message,
      processedCommands: [...priorProcessedCommands, processed].slice(-maxProcessedCommands),
      privateUcpCartId: execution.privateUcpCartId,
      joinedAttendeeIds: execution.joinedAttendeeIds,
    };
    await this.saveRoom(nextRoom);
    send(socket, {
      type: 'command-result',
      commandId,
      ok: result.ok,
      duplicate: false,
      revision,
      message: result.message,
      privateResult: result.privateResult ?? null,
    });
    await this.broadcastSnapshot(false);
  }

  private async executeRoomCommand(
    room: StoredRoom,
    command: RoomCommand,
    commandId: string,
    role: RemoteRoomRole,
    attendeeId: string | null,
  ): Promise<{
    readonly result: ReturnType<typeof applyRoomCommand>;
    readonly privateUcpCartId: string | null;
    readonly joinedAttendeeIds: readonly string[];
  }> {
    const configuration = readUcpRoomConfiguration(this.workerEnv);
    const roomId = this.ctx.id.name ?? 'UNKNOWN';

    if (command.kind === 'join-evidence-demand') {
      if (role !== 'attendee' || attendeeId === null) {
        return {
          result: {
            ok: false,
            state: room.state,
            message: 'Only an authenticated attendee can join this evidence request.',
          },
          privateUcpCartId: room.privateUcpCartId,
          joinedAttendeeIds: room.joinedAttendeeIds,
        };
      }
      if (room.joinedAttendeeIds.includes(attendeeId)) {
        return {
          result: {
            ok: true,
            state: room.state,
            message: 'This authenticated attendee already joined the evidence request.',
          },
          privateUcpCartId: room.privateUcpCartId,
          joinedAttendeeIds: room.joinedAttendeeIds,
        };
      }
      const result = applyRoomCommand(room.state, command);
      return {
        result,
        privateUcpCartId: room.privateUcpCartId,
        joinedAttendeeIds: result.ok
          ? [...room.joinedAttendeeIds, attendeeId]
          : room.joinedAttendeeIds,
      };
    }

    if (command.kind === 'prepare-merchant-cart') {
      const prepared = await prepareRoomMerchantCart(
        room.state,
        command.actor,
        configuration,
        await ucpIdempotencyKey(`${roomId}:${commandId}:prepare`),
        this.ucpFetch(),
      );
      return {
        result:
          prepared.privateResult === null
            ? prepared.result
            : { ...prepared.result, privateResult: prepared.privateResult },
        privateUcpCartId: prepared.privateCartId ?? room.privateUcpCartId,
        joinedAttendeeIds: room.joinedAttendeeIds,
      };
    }

    if (command.kind === 'cancel-merchant-cart') {
      const result = await cancelRoomMerchantCart(
        room.state,
        command.actor,
        configuration,
        room.privateUcpCartId,
        await ucpIdempotencyKey(`${roomId}:${commandId}:cancel`),
        this.ucpFetch(),
      );
      return {
        result,
        privateUcpCartId: result.ok ? null : room.privateUcpCartId,
        joinedAttendeeIds: room.joinedAttendeeIds,
      };
    }

    if (
      command.kind === 'reset-room' &&
      room.state.commerce.cartStatus === 'active' &&
      room.privateUcpCartId !== null
    ) {
      const cancelled = await cancelRoomMerchantCart(
        room.state,
        'buyer',
        configuration,
        room.privateUcpCartId,
        await ucpIdempotencyKey(`${roomId}:${commandId}:reset-cancel`),
        this.ucpFetch(),
      );
      if (!cancelled.ok) {
        return {
          result: cancelled,
          privateUcpCartId: room.privateUcpCartId,
          joinedAttendeeIds: room.joinedAttendeeIds,
        };
      }
    }

    return {
      result: applyRoomCommand(room.state, command),
      privateUcpCartId: command.kind === 'reset-room' ? null : room.privateUcpCartId,
      joinedAttendeeIds: command.kind === 'reset-room' ? [] : room.joinedAttendeeIds,
    };
  }

  private ucpFetch(): UcpFetch {
    const outbound = this.workerEnv.UCP_OUTBOUND;
    if (outbound === undefined) {
      return fetch;
    }
    return async (input, init) => outbound.fetch(input, init);
  }

  private async saveRoom(room: StoredRoom): Promise<void> {
    await this.ctx.storage.put(storedRoomKey, room);
    this.room = room;
  }

  private presence(): RoomPresence {
    let buyer = 0;
    let host = 0;
    let attendee = 0;
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socketAttachment(socket);
      if (!attachment.authenticated || attachment.role === null) {
        continue;
      }
      if (attachment.role === 'buyer') {
        buyer += 1;
      } else if (attachment.role === 'host') {
        host += 1;
      } else {
        attendee += 1;
      }
    }
    return { buyer, host, attendee };
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
    const room = this.room;
    if (
      room !== null &&
      room.state.commerce.cartStatus === 'active' &&
      room.privateUcpCartId !== null
    ) {
      const configuration = readUcpRoomConfiguration(this.workerEnv);
      await cancelRoomMerchantCart(
        room.state,
        'buyer',
        configuration,
        room.privateUcpCartId,
        crypto.randomUUID(),
        this.ucpFetch(),
      ).catch((error: unknown) => {
        console.error('Evidence room could not cancel its expiring merchant cart', error);
      });
    }
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
    const attendeeCredentials = Array.from({ length: maximumRoomAttendeeCount }, (_, index) => ({
      attendeeId: `attendee-${index + 1}`,
      token: randomBase64Url(32),
    }));
    const storedAttendeeCredentials = await Promise.all(
      attendeeCredentials.map(async ({ attendeeId, token }) => ({
        attendeeId,
        tokenDigest: await sha256Hex(token),
      })),
    );
    const id = env.ROOMS.idFromName(roomId);
    const stub = env.ROOMS.get(id);
    const initialization = await stub.fetch('https://room.internal/initialize', {
      method: 'POST',
      body: JSON.stringify({
        buyerTokenDigest: await sha256Hex(buyerToken),
        hostTokenDigest: await sha256Hex(hostToken),
        attendeeCredentials: storedAttendeeCredentials,
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
        attendeeCredentials,
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
    return jsonResponse({
      ok: true,
      protocolVersion: remoteRoomProtocolVersion,
      ucpCommerceConfigured: readUcpRoomConfiguration(env) !== null,
      workerVersion: env.CF_VERSION_METADATA,
    });
  }
  if (!requestOriginAllowed(request, env)) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403);
  }
  const evidenceResponse = await routeProductEvidenceRequest(
    request,
    env,
    corsHeaders(request, env),
  );
  if (evidenceResponse !== null) {
    return evidenceResponse;
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
