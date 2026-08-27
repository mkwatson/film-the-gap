import { describe, expect, it } from 'vitest';

import { createInitialState, defaultEvidenceRequirements } from './model';
import {
  applyRoomCommand,
  parseRoomCommand,
  roomRoleCanDispatch,
  type RoomCommand,
} from './room-command';

describe('room commands', () => {
  it('parses a strict buyer command and rejects extra private context', () => {
    const command = {
      kind: 'set-evidence-requirements',
      actor: 'agent',
      requirements: defaultEvidenceRequirements,
    } as const;

    expect(parseRoomCommand(command)).toEqual(command);
    expect(parseRoomCommand({ ...command, maximumPrice: 450 })).toBeNull();
  });

  it('enforces the buyer and host command boundary', () => {
    const buyerCommand: RoomCommand = {
      kind: 'request-repair-history',
      actor: 'agent',
    };
    const hostCommand: RoomCommand = {
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
    };

    expect(roomRoleCanDispatch('buyer', buyerCommand)).toBe(true);
    expect(roomRoleCanDispatch('buyer', hostCommand)).toBe(false);
    expect(roomRoleCanDispatch('host', buyerCommand)).toBe(false);
    expect(roomRoleCanDispatch('host', hostCommand)).toBe(true);
    expect(roomRoleCanDispatch('buyer', { kind: 'reset-room' })).toBe(true);
    expect(roomRoleCanDispatch('host', { kind: 'reset-room' })).toBe(true);
  });

  it('applies commands through the existing guarded domain model', () => {
    const scoped = applyRoomCommand(createInitialState(), {
      kind: 'set-evidence-requirements',
      actor: 'buyer',
      requirements: defaultEvidenceRequirements,
    });
    const requested = applyRoomCommand(scoped.state, {
      kind: 'request-repair-history',
      actor: 'buyer',
    });

    expect(scoped.ok).toBe(true);
    expect(requested).toMatchObject({
      ok: true,
      state: {
        evidenceRequests: [{ kind: 'repair_history', status: 'queued' }],
      },
    });
  });
});
