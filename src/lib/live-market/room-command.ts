import { z } from 'zod';

import {
  answerRepairHistory,
  createInitialState,
  evidenceRequirementsSchema,
  releaseCurrentLot,
  repairHistoryValues,
  requestRepairHistory,
  reserveCurrentLot,
  setEvidenceRequirements,
  type LiveMarketState,
  type TransitionResult,
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
  evidenceFrame: evidenceFrameProvenanceSchema,
  visualReview: visualEvidenceReviewSchema.nullable(),
  publicEvidenceImage: z
    .string()
    .max(2_100_000)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
    .nullable(),
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

export type RoomCommand = z.infer<typeof roomCommandSchema>;

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
        command.visualReview,
        command.publicEvidenceImage,
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
