import { z } from 'zod';

import {
  answerRepairHistory,
  createInitialState,
  evidenceRequirementsSchema,
  maximumPublishedEvidenceImageCharacters,
  releaseCurrentLot,
  repairHistoryValues,
  requestRepairHistory,
  reserveCurrentLot,
  setEvidenceRequirements,
  type EvidenceFrameProvenance,
  type EvidenceRequirements,
  type LiveMarketState,
  type RepairHistory,
  type TransitionResult,
  type VisualEvidenceReview,
} from './model';
import { evidenceFrameProvenanceSchema, visualEvidenceReviewSchema } from './room-sync';

export const remoteRoomRoles = ['buyer', 'host'] as const;
export type RemoteRoomRole = (typeof remoteRoomRoles)[number];

const buyerActors = ['agent', 'buyer'] as const;

const setEvidenceRequirementsCommandSchema = z.strictObject({
  kind: z.literal('set-evidence-requirements'),
  actor: z.enum(buyerActors),
  requirements: evidenceRequirementsSchema,
});

const requestRepairHistoryCommandSchema = z.strictObject({
  kind: z.literal('request-repair-history'),
  actor: z.enum(buyerActors),
});

const answerRepairHistoryCommandSchema = z.strictObject({
  kind: z.literal('answer-repair-history'),
  repairHistory: z.enum(repairHistoryValues).exclude(['unknown']),
  evidenceFrame: evidenceFrameProvenanceSchema.optional(),
  visualReview: visualEvidenceReviewSchema.nullable().optional(),
  publicEvidenceImage: z
    .string()
    .max(maximumPublishedEvidenceImageCharacters)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .nullable()
    .optional(),
});

const reserveCurrentLotCommandSchema = z.strictObject({
  kind: z.literal('reserve-current-lot'),
  actor: z.enum(buyerActors),
  expectedAllInPrice: z.number().finite().positive(),
});

const releaseCurrentLotCommandSchema = z.strictObject({
  kind: z.literal('release-current-lot'),
  actor: z.enum(buyerActors),
});

const resetRoomCommandSchema = z.strictObject({
  kind: z.literal('reset-room'),
});

export const roomCommandSchema = z.discriminatedUnion('kind', [
  setEvidenceRequirementsCommandSchema,
  requestRepairHistoryCommandSchema,
  answerRepairHistoryCommandSchema,
  reserveCurrentLotCommandSchema,
  releaseCurrentLotCommandSchema,
  resetRoomCommandSchema,
]);

export interface SetEvidenceRequirementsCommand {
  readonly kind: 'set-evidence-requirements';
  readonly actor: 'agent' | 'buyer';
  readonly requirements: EvidenceRequirements;
}

export interface RequestRepairHistoryCommand {
  readonly kind: 'request-repair-history';
  readonly actor: 'agent' | 'buyer';
}

export interface AnswerRepairHistoryCommand {
  readonly kind: 'answer-repair-history';
  readonly repairHistory: Exclude<RepairHistory, 'unknown'>;
  readonly evidenceFrame?: EvidenceFrameProvenance | undefined;
  readonly visualReview?: VisualEvidenceReview | null | undefined;
  readonly publicEvidenceImage?: string | null | undefined;
}

export interface ReserveCurrentLotCommand {
  readonly kind: 'reserve-current-lot';
  readonly actor: 'agent' | 'buyer';
  readonly expectedAllInPrice: number;
}

export interface ReleaseCurrentLotCommand {
  readonly kind: 'release-current-lot';
  readonly actor: 'agent' | 'buyer';
}

export interface ResetRoomCommand {
  readonly kind: 'reset-room';
}

export type RoomCommand =
  | SetEvidenceRequirementsCommand
  | RequestRepairHistoryCommand
  | AnswerRepairHistoryCommand
  | ReserveCurrentLotCommand
  | ReleaseCurrentLotCommand
  | ResetRoomCommand;

export function parseRoomCommand(value: unknown): RoomCommand | null {
  const parsed = roomCommandSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function roomRoleCanDispatch(role: RemoteRoomRole, command: RoomCommand): boolean {
  if (command.kind === 'reset-room') {
    return true;
  }
  if (role === 'host') {
    return command.kind === 'answer-repair-history';
  }
  return command.kind !== 'answer-repair-history';
}

export function applyRoomCommand(state: LiveMarketState, command: RoomCommand): TransitionResult {
  switch (command.kind) {
    case 'set-evidence-requirements':
      return setEvidenceRequirements(state, command.requirements, command.actor);
    case 'request-repair-history':
      return requestRepairHistory(state, command.actor);
    case 'answer-repair-history':
      return answerRepairHistory(
        state,
        command.repairHistory,
        command.evidenceFrame,
        command.visualReview ?? null,
        command.publicEvidenceImage ?? null,
      );
    case 'reserve-current-lot':
      return reserveCurrentLot(state, command.actor, command.expectedAllInPrice);
    case 'release-current-lot':
      return releaseCurrentLot(state, command.actor);
    case 'reset-room':
      return {
        ok: true,
        state: createInitialState(),
        message: 'Room reset. Waiting for public evidence requirements.',
      };
  }
}
