import { z } from 'zod';

import { roomCommandSchema, type RoomCommand } from './room-command';
import type { LiveMarketState, PrivateActionResult } from './model';
import { liveMarketStateSchema } from './room-sync';

export const remoteRoomProtocolVersion = '2' as const;
export const remoteRoomIdPattern = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export const roomCredentialsSchema = z.strictObject({
  protocolVersion: z.literal(remoteRoomProtocolVersion),
  roomId: z.string().regex(remoteRoomIdPattern),
  buyerToken: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  hostToken: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  expiresAt: z.number().int().positive(),
});

export type RoomCredentials = z.infer<typeof roomCredentialsSchema>;

export const remoteRoomAccessSchema = z.strictObject({
  roomId: z.string().regex(remoteRoomIdPattern),
  role: z.enum(['buyer', 'host']),
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  expiresAt: z.number().int().positive(),
});

export interface RemoteRoomAccess {
  readonly roomId: string;
  readonly role: 'buyer' | 'host';
  readonly token: string;
  readonly expiresAt: number;
}

export const roomPresenceSchema = z.strictObject({
  buyer: z.number().int().nonnegative().max(100),
  host: z.number().int().nonnegative().max(100),
});

export interface RoomPresence {
  readonly buyer: number;
  readonly host: number;
}

const authenticateMessageSchema = z.strictObject({
  type: z.literal('authenticate'),
  role: z.enum(['buyer', 'host']),
  token: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/),
  clientId: z.string().min(1).max(160),
  lastSeenRevision: z.number().int().nonnegative(),
});

const commandMessageSchema = z.strictObject({
  type: z.literal('command'),
  commandId: z.string().min(1).max(160),
  expectedRevision: z.number().int().nonnegative(),
  command: roomCommandSchema,
});

export const remoteRoomClientMessageSchema = z.discriminatedUnion('type', [
  authenticateMessageSchema,
  commandMessageSchema,
]);

export interface AuthenticateRoomMessage {
  readonly type: 'authenticate';
  readonly role: 'buyer' | 'host';
  readonly token: string;
  readonly clientId: string;
  readonly lastSeenRevision: number;
}

export interface DispatchRoomCommandMessage {
  readonly type: 'command';
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly command: RoomCommand;
}

export type RemoteRoomClientMessage = AuthenticateRoomMessage | DispatchRoomCommandMessage;

const roomSnapshotMessageSchema = z.strictObject({
  type: z.literal('room-snapshot'),
  protocolVersion: z.literal(remoteRoomProtocolVersion),
  roomId: z.string().regex(remoteRoomIdPattern),
  revision: z.number().int().nonnegative(),
  state: liveMarketStateSchema,
  message: z.string().min(1).max(500),
  presence: roomPresenceSchema,
  recovered: z.boolean(),
  serverTime: z.number().int().positive(),
});

export const privateActionResultSchema = z.strictObject({
  kind: z.literal('ucp-cart-handoff'),
  continueUrl: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === 'https:', 'Handoff must use HTTPS.'),
  instruction: z.string().min(1).max(500),
});

const commandResultMessageSchema = z.strictObject({
  type: z.literal('command-result'),
  commandId: z.string().min(1).max(160),
  ok: z.boolean(),
  duplicate: z.boolean(),
  revision: z.number().int().nonnegative(),
  message: z.string().min(1).max(500),
  privateResult: privateActionResultSchema.nullable(),
});

export const remoteRoomErrorCodes = [
  'invalid-message',
  'authentication-required',
  'authentication-failed',
  'unauthorized-command',
  'stale-revision',
  'room-unavailable',
  'internal-error',
] as const;
export type RemoteRoomErrorCode = (typeof remoteRoomErrorCodes)[number];

const roomErrorMessageSchema = z.strictObject({
  type: z.literal('room-error'),
  code: z.enum(remoteRoomErrorCodes),
  message: z.string().min(1).max(500),
  recoverable: z.boolean(),
  currentRevision: z.number().int().nonnegative().nullable(),
  commandId: z.string().min(1).max(160).nullable(),
});

const roomExpiredMessageSchema = z.strictObject({
  type: z.literal('room-expired'),
  message: z.string().min(1).max(500),
});

export const remoteRoomServerMessageSchema = z.discriminatedUnion('type', [
  roomSnapshotMessageSchema,
  commandResultMessageSchema,
  roomErrorMessageSchema,
  roomExpiredMessageSchema,
]);

export interface RoomSnapshotMessage {
  readonly type: 'room-snapshot';
  readonly protocolVersion: typeof remoteRoomProtocolVersion;
  readonly roomId: string;
  readonly revision: number;
  readonly state: LiveMarketState;
  readonly message: string;
  readonly presence: RoomPresence;
  readonly recovered: boolean;
  readonly serverTime: number;
}

export interface RoomCommandResultMessage {
  readonly type: 'command-result';
  readonly commandId: string;
  readonly ok: boolean;
  readonly duplicate: boolean;
  readonly revision: number;
  readonly message: string;
  readonly privateResult: PrivateActionResult | null;
}

export interface RoomErrorMessage {
  readonly type: 'room-error';
  readonly code: RemoteRoomErrorCode;
  readonly message: string;
  readonly recoverable: boolean;
  readonly currentRevision: number | null;
  readonly commandId: string | null;
}

export interface RoomExpiredMessage {
  readonly type: 'room-expired';
  readonly message: string;
}

export type RemoteRoomServerMessage =
  RoomSnapshotMessage | RoomCommandResultMessage | RoomErrorMessage | RoomExpiredMessage;

export function parseRemoteRoomClientMessage(value: unknown): RemoteRoomClientMessage | null {
  const parsed = remoteRoomClientMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseRemoteRoomServerMessage(value: unknown): RemoteRoomServerMessage | null {
  const parsed = remoteRoomServerMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
