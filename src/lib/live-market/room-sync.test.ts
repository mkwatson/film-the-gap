import { describe, expect, it } from 'vitest';

import {
  answerRepairHistory,
  createInitialState,
  defaultEvidenceRequirements,
  requestRepairHistory,
  setEvidenceRequirements,
} from './model';
import {
  advanceRoomVersion,
  compareRoomVersions,
  createInitialRoomVersion,
  createResetRoomVersion,
  createRoomStateSnapshot,
  createRoomSyncRequest,
  parseRoomMessage,
} from './room-sync';

describe('live room synchronization contract', () => {
  it('accepts only the narrow sync-request and validated public-state snapshot shapes', () => {
    const senderId = 'buyer-client';
    const version = createInitialRoomVersion(senderId);
    const state = createInitialState();

    expect(parseRoomMessage(createRoomSyncRequest('room', 'buyer', senderId))).toMatchObject({
      type: 'sync-request',
      role: 'buyer',
    });
    expect(
      parseRoomMessage(
        createRoomStateSnapshot('room', 'buyer', senderId, version, state, 'Room ready.'),
      ),
    ).toMatchObject({ type: 'state-snapshot', state });
    expect(
      parseRoomMessage({
        ...createRoomStateSnapshot('room', 'buyer', senderId, version, state, 'Room ready.'),
        unexpectedAuthority: 'purchase',
      }),
    ).toBeNull();
  });

  it('rejects a private-price field anywhere inside seller-visible requirements', () => {
    const senderId = 'buyer-client';
    const version = createInitialRoomVersion(senderId);
    const state = {
      ...createInitialState(),
      evidenceRequirements: {
        ...defaultEvidenceRequirements,
        maxAllInPrice: 450,
      },
    };

    expect(
      parseRoomMessage({
        type: 'state-snapshot',
        roomId: 'room',
        role: 'buyer',
        senderId,
        version,
        state,
        message: 'Attempted private-state leak.',
      }),
    ).toBeNull();
  });

  it('orders normal revisions and lets a reset epoch supersede stale state', () => {
    const initial = createInitialRoomVersion('buyer-client');
    const revisionOne = advanceRoomVersion(initial, 'buyer-client');
    const revisionTwo = advanceRoomVersion(revisionOne, 'host-client');
    const reset = createResetRoomVersion('buyer-client', 1_000);

    expect(compareRoomVersions(revisionOne, initial)).toBeGreaterThan(0);
    expect(compareRoomVersions(revisionTwo, revisionOne)).toBeGreaterThan(0);
    expect(compareRoomVersions(reset, revisionTwo)).toBeGreaterThan(0);
    expect(compareRoomVersions(revisionTwo, reset)).toBeLessThan(0);
  });

  it('accepts one bounded public frame but rejects misplaced media and malformed fingerprints', () => {
    const senderId = 'host-client';
    const version = createInitialRoomVersion(senderId);
    const scoped = setEvidenceRequirements(
      createInitialState(),
      defaultEvidenceRequirements,
      'agent',
    ).state;
    const requested = requestRepairHistory(scoped, 'agent').state;
    const frame = {
      kind: 'camera-keyframe',
      frameId: 'camera-9dff50df08c6',
      label: 'Host camera keyframe · camera-9dff50df08c6',
      capturedAt: '2026-08-26T19:22:31.000Z',
      showOffsetSeconds: null,
      sha256: '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e',
      widthPx: 960,
      heightPx: 540,
    } as const;
    const finding = {
      baseVisibility: 'clear',
      surfaceFinding: 'no-obvious-repair',
      confidence: 'medium',
      visibleDetails: ['The full base is visible.'],
      summary: 'The full base is visible with no obvious repair marker.',
      suggestedNextView: null,
    } as const;
    const visualReview = {
      source: 'ai-gateway',
      modelId: 'openai/gpt-5.6-sol',
      frameId: frame.frameId,
      frameSha256: frame.sha256,
      proposal: finding,
      reviewedFinding: finding,
      hostDecision: 'accepted',
    } as const;
    const answered = answerRepairHistory(
      requested,
      'none',
      frame,
      visualReview,
      'data:image/jpeg;base64,ZnJhbWU=',
    ).state;
    const snapshot = createRoomStateSnapshot(
      'room',
      'host',
      senderId,
      version,
      answered,
      'Camera attestation published.',
    );

    expect(parseRoomMessage(snapshot)).toMatchObject({
      state: {
        lot: {
          evidence: {
            repairEvidenceFrame: {
              kind: 'camera-keyframe',
              widthPx: 960,
              heightPx: 540,
            },
            repairEvidenceImage: 'data:image/jpeg;base64,ZnJhbWU=',
            visualReview: {
              source: 'ai-gateway',
              hostDecision: 'accepted',
            },
          },
        },
      },
    });
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              repairEvidenceFrame: {
                ...snapshot.state.lot.evidence.repairEvidenceFrame,
                rawFrame: 'data:image/jpeg;base64,private-media',
              },
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              repairEvidenceFrame: {
                ...snapshot.state.lot.evidence.repairEvidenceFrame,
                sha256: 'not-a-digest',
              },
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              repairEvidenceFrame: {
                ...snapshot.state.lot.evidence.repairEvidenceFrame,
                sha256: null,
              },
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              visualReview: {
                ...snapshot.state.lot.evidence.visualReview,
                frameId: 'camera-different-frame',
              },
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              repairEvidenceSource: 'Unrelated seller claim',
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              repairEvidenceImage: null,
            },
          },
        },
      }),
    ).toBeNull();
    expect(
      parseRoomMessage({
        ...snapshot,
        state: {
          ...snapshot.state,
          lot: {
            ...snapshot.state.lot,
            evidence: {
              ...snapshot.state.lot.evidence,
              visualReview: {
                ...snapshot.state.lot.evidence.visualReview,
                reviewedFinding: {
                  ...finding,
                  surfaceFinding: 'possible-repair',
                },
              },
            },
          },
        },
      }),
    ).toBeNull();
  });
});
