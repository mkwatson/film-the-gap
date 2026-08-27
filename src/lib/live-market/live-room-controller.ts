import type { LiveMarketState, TransitionResult } from './model';
import type { RoomCommand } from './room-command';
import type { RoomPresence } from './remote-room-protocol';
import type { RoomRole } from './room-sync';

export const roomConnectionPhases = ['checking', 'solo', 'waiting', 'linked'] as const;
export type RoomConnectionPhase = (typeof roomConnectionPhases)[number];

export const roomTransports = ['local', 'remote'] as const;
export type RoomTransport = (typeof roomTransports)[number];

export interface LiveRoomController {
  readonly state: LiveMarketState;
  readonly lastMessage: string;
  readonly connectionPhase: RoomConnectionPhase;
  readonly peerRole: RoomRole | null;
  readonly transport: RoomTransport;
  readonly roomId: string | null;
  readonly hostInviteUrl: string | null;
  readonly expiresAt: number | null;
  readonly presence: RoomPresence;
  readonly readState: () => LiveMarketState;
  readonly resetDemo: () => void;
  readonly dispatch: (command: RoomCommand) => Promise<TransitionResult>;
}
