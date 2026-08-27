import { z } from 'zod';

import { findingCanSupportAttestation, visualEvidenceFindingSchema } from './evidence-proposal';
import {
  activityActors,
  evidenceRequestKinds,
  evidenceRequirementsSchema,
  hostReviewDecisions,
  maximumPublishedEvidenceImageCharacters,
  repairHistoryValues,
  showStatuses,
  ucpCartStatuses,
  visualReviewSources,
  type LiveMarketState,
} from './model';
import { ucpProtocolVersion } from '../ucp/profile';

export const roomRoles = ['buyer', 'host'] as const;
export type RoomRole = (typeof roomRoles)[number];

export interface RoomVersion {
  readonly epochId: string;
  readonly epochStartedAt: number;
  readonly revision: number;
  readonly senderId: string;
}

export interface RoomSyncRequest {
  readonly type: 'sync-request';
  readonly roomId: string;
  readonly role: RoomRole;
  readonly senderId: string;
}

export interface RoomStateSnapshot {
  readonly type: 'state-snapshot';
  readonly roomId: string;
  readonly role: RoomRole;
  readonly senderId: string;
  readonly version: RoomVersion;
  readonly state: LiveMarketState;
  readonly message: string;
}

export type RoomMessage = RoomSyncRequest | RoomStateSnapshot;

export const evidenceFrameProvenanceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('fixture-frame'),
    frameId: z.string().min(1).max(160),
    label: z.string().min(1).max(240),
    capturedAt: z.null(),
    showOffsetSeconds: z.number().finite().nonnegative(),
    sha256: z.null(),
    widthPx: z.null(),
    heightPx: z.null(),
  }),
  z.strictObject({
    kind: z.literal('camera-keyframe'),
    frameId: z.string().min(1).max(160),
    label: z.string().min(1).max(240),
    capturedAt: z
      .string()
      .min(1)
      .max(64)
      .refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid capture timestamp'),
    showOffsetSeconds: z.null(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    widthPx: z.number().int().positive().max(10_000),
    heightPx: z.number().int().positive().max(10_000),
  }),
]);

export const visualEvidenceReviewSchema = z
  .strictObject({
    source: z.enum(visualReviewSources),
    modelId: z.string().min(1).max(160).nullable(),
    frameId: z.string().min(1).max(160),
    frameSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    proposal: visualEvidenceFindingSchema.nullable(),
    reviewedFinding: visualEvidenceFindingSchema,
    hostDecision: z.enum(hostReviewDecisions),
  })
  .superRefine((review, context) => {
    if (
      review.source === 'ai-gateway' &&
      (review.modelId === null ||
        review.proposal === null ||
        !['accepted', 'corrected'].includes(review.hostDecision) ||
        review.frameSha256 === null)
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid AI Gateway visual review.' });
    }
    if (
      review.source === 'manual-review' &&
      (review.modelId !== null ||
        review.proposal !== null ||
        review.hostDecision !== 'manual' ||
        review.frameSha256 === null)
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid manual visual review.' });
    }
    if (
      review.source === 'fixture' &&
      (review.modelId !== null ||
        review.proposal !== null ||
        review.hostDecision !== 'fixture' ||
        review.frameSha256 !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'Invalid fixture visual review.' });
    }
  });

const lotEvidenceSchema = z
  .strictObject({
    edgeCondition: z.literal('visible-closeup'),
    edgeEvidenceSource: z.string().min(1).max(240),
    repairHistory: z.enum(repairHistoryValues),
    repairEvidenceSource: z.string().min(1).max(240).nullable(),
    repairEvidenceFrame: evidenceFrameProvenanceSchema.nullable(),
    repairEvidenceImage: z
      .string()
      .max(maximumPublishedEvidenceImageCharacters)
      .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
      .nullable(),
    visualReview: visualEvidenceReviewSchema.nullable(),
  })
  .superRefine((evidence, context) => {
    const frame = evidence.repairEvidenceFrame;
    const review = evidence.visualReview;

    if (evidence.repairHistory === 'unknown') {
      if (
        evidence.repairEvidenceSource !== null ||
        frame !== null ||
        evidence.repairEvidenceImage !== null ||
        review !== null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'Unknown repair history cannot carry published evidence.',
        });
      }
      return;
    }

    if (evidence.repairEvidenceSource === null || frame === null || review === null) {
      context.addIssue({
        code: 'custom',
        message: 'Resolved repair history requires a frame-bound visual review.',
      });
      return;
    }

    if (
      evidence.repairEvidenceSource !== frame.label ||
      review.frameId !== frame.frameId ||
      review.frameSha256 !== frame.sha256
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Published evidence source, frame, and review must match.',
      });
    }

    if (
      (frame.kind === 'camera-keyframe' &&
        (evidence.repairEvidenceImage === null || review.source === 'fixture')) ||
      (frame.kind === 'fixture-frame' &&
        (evidence.repairEvidenceImage !== null || review.source !== 'fixture'))
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Published image and review source do not match the frame kind.',
      });
    }

    if (!findingCanSupportAttestation(review.reviewedFinding)) {
      context.addIssue({
        code: 'custom',
        message: 'Published evidence requires a clear, reviewed base view.',
      });
    }

    if (
      evidence.repairHistory === 'none' &&
      review.reviewedFinding.surfaceFinding === 'possible-repair'
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A no-repair attestation conflicts with the reviewed visible signal.',
      });
    }
  });

const ucpMerchantCartReceiptSchema = z.strictObject({
  protocolVersion: z.literal(ucpProtocolVersion),
  currency: z.string().regex(/^[A-Z]{3}$/),
  lineItems: z
    .array(
      z.strictObject({
        title: z.string().min(1).max(1_000),
        unitPrice: z.number().int().safe(),
        quantity: z.number().int().positive().safe(),
        subtotal: z.number().int().safe().nullable(),
      }),
    )
    .min(1)
    .max(20),
  totals: z
    .array(
      z.strictObject({
        type: z.string().min(1).max(160),
        displayText: z.string().min(1).max(240),
        amount: z.number().int().safe(),
      }),
    )
    .min(1)
    .max(30),
  messages: z
    .array(
      z.strictObject({
        type: z.string().min(1).max(160),
        content: z.string().max(2_000),
        severity: z.string().min(1).max(160).nullable(),
      }),
    )
    .max(30),
  continuationAvailable: z.boolean(),
  createdAt: z.number().int().positive(),
});

const ucpCommerceStateSchema = z
  .strictObject({
    available: z.boolean(),
    protocolVersion: z.literal(ucpProtocolVersion).nullable(),
    merchantOrigin: z
      .string()
      .url()
      .refine((value) => new URL(value).protocol === 'https:', 'Merchant origin must use HTTPS.')
      .nullable(),
    cartStatus: z.enum(ucpCartStatuses),
    receipt: ucpMerchantCartReceiptSchema.nullable(),
    lastError: z.string().min(1).max(500).nullable(),
  })
  .superRefine((commerce, context) => {
    if (
      !commerce.available &&
      (commerce.protocolVersion !== null ||
        commerce.merchantOrigin !== null ||
        commerce.cartStatus !== 'none' ||
        commerce.receipt !== null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Unavailable commerce cannot carry merchant or cart state.',
      });
    }
    if (
      commerce.available &&
      (commerce.protocolVersion === null || commerce.merchantOrigin === null)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Available commerce requires a negotiated version and merchant origin.',
      });
    }
    if (
      (commerce.cartStatus === 'active' || commerce.cartStatus === 'cancelled') &&
      commerce.receipt === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'A created merchant cart requires its public receipt.',
      });
    }
    if (commerce.cartStatus === 'none' && commerce.receipt !== null) {
      context.addIssue({
        code: 'custom',
        message: 'An absent merchant cart cannot carry a receipt.',
      });
    }
  });

export const liveMarketStateSchema = z.strictObject({
  showStatus: z.enum(showStatuses),
  lot: z.strictObject({
    id: z.string().min(1).max(120),
    title: z.string().min(1).max(160),
    subtitle: z.string().min(1).max(240),
    lengthCm: z.number().finite().min(80).max(250),
    currentBid: z.number().finite().nonnegative(),
    shipping: z.number().finite().nonnegative(),
    closesInSeconds: z.number().int().nonnegative(),
    evidence: lotEvidenceSchema,
  }),
  evidenceRequirements: evidenceRequirementsSchema.nullable(),
  evidenceRequests: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(120),
        kind: z.enum(evidenceRequestKinds),
        status: z.enum(['queued', 'answered']),
        requestedBy: z.enum(['agent', 'buyer']),
      }),
    )
    .max(50),
  anonymousEvidenceDemand: z
    .array(
      z.strictObject({
        kind: z.enum(evidenceRequestKinds),
        agentCount: z.number().int().nonnegative().max(100_000),
        status: z.enum(['open', 'resolved']),
      }),
    )
    .max(50),
  authenticatedAttendeeCount: z.number().int().nonnegative().max(7),
  reservation: z
    .strictObject({
      id: z.string().min(1).max(120),
      lotId: z.string().min(1).max(120),
      heldBy: z.enum(['agent', 'buyer']),
      acceptedAllInPrice: z.number().finite().positive(),
    })
    .nullable(),
  commerce: ucpCommerceStateSchema,
  activity: z
    .array(
      z.strictObject({
        id: z.number().int().positive(),
        actor: z.enum(activityActors),
        action: z.string().min(1).max(120),
        outcome: z.enum(['accepted', 'refused', 'observed']),
        summary: z.string().min(1).max(500),
      }),
    )
    .max(100),
  nextActivityId: z.number().int().positive(),
});

const roomVersionSchema = z.strictObject({
  epochId: z.string().min(1).max(160),
  epochStartedAt: z.number().int().nonnegative(),
  revision: z.number().int().nonnegative(),
  senderId: z.string().min(1).max(160),
});

const roomSyncRequestSchema = z.strictObject({
  type: z.literal('sync-request'),
  roomId: z.string().min(1).max(160),
  role: z.enum(roomRoles),
  senderId: z.string().min(1).max(160),
});

const roomStateSnapshotSchema = z
  .strictObject({
    type: z.literal('state-snapshot'),
    roomId: z.string().min(1).max(160),
    role: z.enum(roomRoles),
    senderId: z.string().min(1).max(160),
    version: roomVersionSchema,
    state: liveMarketStateSchema,
    message: z.string().min(1).max(500),
  })
  .refine(({ senderId, version }) => senderId === version.senderId, {
    message: 'Snapshot sender must match the version sender.',
    path: ['version', 'senderId'],
  });

const roomMessageSchema = z.union([roomSyncRequestSchema, roomStateSnapshotSchema]);

export function parseRoomMessage(value: unknown): RoomMessage | null {
  const parsed = roomMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function createInitialRoomVersion(senderId: string): RoomVersion {
  return {
    epochId: 'initial-demo-room',
    epochStartedAt: 0,
    revision: 0,
    senderId,
  };
}

export function advanceRoomVersion(version: RoomVersion, senderId: string): RoomVersion {
  return {
    ...version,
    revision: version.revision + 1,
    senderId,
  };
}

export function createResetRoomVersion(senderId: string, startedAt: number): RoomVersion {
  return {
    epochId: `reset-${startedAt}-${senderId}`,
    epochStartedAt: startedAt,
    revision: 0,
    senderId,
  };
}

export function compareRoomVersions(left: RoomVersion, right: RoomVersion): number {
  if (left.epochStartedAt !== right.epochStartedAt) {
    return left.epochStartedAt - right.epochStartedAt;
  }
  if (left.epochId !== right.epochId) {
    return left.epochId.localeCompare(right.epochId);
  }
  if (left.revision !== right.revision) {
    return left.revision - right.revision;
  }
  return left.senderId.localeCompare(right.senderId);
}

export function createRoomSyncRequest(
  roomId: string,
  role: RoomRole,
  senderId: string,
): RoomSyncRequest {
  return { type: 'sync-request', roomId, role, senderId };
}

export function createRoomStateSnapshot(
  roomId: string,
  role: RoomRole,
  senderId: string,
  version: RoomVersion,
  state: LiveMarketState,
  message: string,
): RoomStateSnapshot {
  return {
    type: 'state-snapshot',
    roomId,
    role,
    senderId,
    version,
    state,
    message,
  };
}
