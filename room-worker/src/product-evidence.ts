import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
  createEmptyEvidenceNetworkState,
  publicNetworkEvidenceRetentionDays,
  qualifiesForPublicNetworkReuse,
  reusableEvidenceRecordSchema,
  type EvidenceNetworkState,
  type ReviewedEvidenceInput,
} from '../../src/lib/evidence-network/model';
import {
  analyzeEvidenceVideoRequestSchema,
  createRemoteEvidenceCaseRequestSchema,
  evidenceNetworkStateSchema,
  ownerEvidenceCommandRequestSchema,
  publishRemoteEvidenceRequestSchema,
  publishPublicEvidenceMissionRequestSchema,
  publicEvidenceMissionIdPattern,
  publicEvidenceMissionSchema,
  remoteEvidenceCaseIdPattern,
  remoteEvidenceProtocolVersion,
  maximumUploadsPerEvidenceCase,
  requestDiscovery,
  removePublicEvidenceMissionRequestSchema,
  requestMission,
  requestQuestion,
  reserveEvidenceUploadRequestSchema,
  type CreateRemoteEvidenceCaseRequest,
  type RemoteEvidenceCaseSnapshot,
  type RemoteEvidenceServerMessage,
} from '../../src/lib/evidence-network/remote-protocol';
import { generateAuthorizedVideoProposal } from '../../src/lib/evidence-network/server/video-analysis';
import {
  maximumAnalyzableVideoBytes,
  videoEvidenceProposalSchema,
  type AuthorizedVideoAnalysisInput,
  type VideoEvidenceProposal,
} from '../../src/lib/evidence-network/video-analysis';
import { indexReusableEvidence } from './evidence-library';
import { markPublicMissionFulfilled } from './public-mission-board';

export interface ProductEvidenceWorkerEnv {
  readonly CASES: DurableObjectNamespace<ProductEvidenceCaseObject>;
  readonly EVIDENCE_CASE_TTL_SECONDS: string;
  readonly ALLOWED_ORIGINS: string;
  readonly CASE_CREATION_PER_CLIENT_RATE_LIMITER?: RateLimit;
  readonly CASE_CREATION_GLOBAL_RATE_LIMITER?: RateLimit;
  readonly STREAM?: StreamBinding;
  readonly STREAM_OUTBOUND?: Fetcher;
  readonly AI_GATEWAY_API_KEY?: string;
  readonly AI_ANALYSIS_OUTBOUND?: Fetcher;
  readonly EVIDENCE_LIBRARY?: D1Database;
}

interface StoredUploadReservation {
  readonly uploadId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly fileSizeBytes: number;
  readonly maxDurationSeconds: number;
  readonly mimeType: string;
  readonly downloadRequestedAt: number | null;
  readonly analysisStatus: 'not_requested' | 'running' | 'complete' | 'unavailable';
  readonly analysisStartedAt: number | null;
  readonly analysisAttempts: number;
  readonly analysis: VideoEvidenceProposal | null;
}

interface ProcessedEvidenceCommand {
  readonly commandId: string;
  readonly digest: string;
  readonly revision: number;
  readonly ok: boolean;
  readonly message: string;
}

interface StoredEvidenceCase {
  readonly protocolVersion: typeof remoteEvidenceProtocolVersion;
  readonly ownerTokenDigest: string;
  readonly contributorTokenDigest: string;
  readonly publicMissionId: string | null;
  readonly publicContributorTokenDigest: string | null;
  readonly publicMissionExpiresAt: number | null;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly state: EvidenceNetworkState;
  readonly lastMessage: string;
  readonly uploads: readonly StoredUploadReservation[];
  readonly uploadReservationsCreated: number;
  readonly processedCommands: readonly ProcessedEvidenceCommand[];
}

interface StreamVideoDetails {
  readonly uploaded: boolean;
  readonly readyToStream: boolean;
  readonly status: string;
  readonly durationSeconds: number | null;
  readonly previewUrl: string | null;
  readonly thumbnailUrl: string | null;
  readonly hlsPlaybackUrl: string | null;
}

interface StreamDownloadDetails {
  readonly status: 'ready' | 'inprogress' | 'error';
  readonly percentComplete: number;
  readonly url: string | null;
}

export { maximumUploadsPerEvidenceCase } from '../../src/lib/evidence-network/remote-protocol';

const storedUploadReservationSchema = z.strictObject({
  uploadId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  fileSizeBytes: z.number().int().positive(),
  maxDurationSeconds: z.number().int().min(2).max(90),
  mimeType: z.string().min(3).max(120),
  downloadRequestedAt: z.number().int().positive().nullable(),
  analysisStatus: z.enum(['not_requested', 'running', 'complete', 'unavailable']),
  analysisStartedAt: z.number().int().positive().nullable(),
  analysisAttempts: z.number().int().min(0).max(2),
  analysis: videoEvidenceProposalSchema.nullable(),
});

const processedEvidenceCommandSchema = z.strictObject({
  commandId: z.string().min(1).max(160),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  revision: z.number().int().nonnegative(),
  ok: z.boolean(),
  message: z.string().min(1).max(500),
});

const storedEvidenceCaseSchema: z.ZodType<StoredEvidenceCase> = z.strictObject({
  protocolVersion: z.literal(remoteEvidenceProtocolVersion),
  ownerTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  contributorTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  publicMissionId: z.string().regex(publicEvidenceMissionIdPattern).nullable().default(null),
  publicContributorTokenDigest: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable()
    .default(null),
  publicMissionExpiresAt: z.number().int().positive().nullable().default(null),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  state: evidenceNetworkStateSchema,
  lastMessage: z.string().min(1).max(500),
  uploads: z.array(storedUploadReservationSchema).max(maximumUploadsPerEvidenceCase),
  uploadReservationsCreated: z.number().int().min(0).max(maximumUploadsPerEvidenceCase),
  processedCommands: z.array(processedEvidenceCommandSchema).max(128),
});

const initializeEvidenceCaseSchema = z.strictObject({
  ownerTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  contributorTokenDigest: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  state: evidenceNetworkStateSchema,
  lastMessage: z.string().min(1).max(500),
});

const publishPublicMissionInternalRequestSchema = publishPublicEvidenceMissionRequestSchema.extend({
  publicContributorToken: z.string().min(32).max(256),
});

const removePublicMissionInternalRequestSchema = removePublicEvidenceMissionRequestSchema.extend({
  missionId: z.string().regex(publicEvidenceMissionIdPattern),
});

const streamUploadResponseSchema = z.strictObject({
  uploadId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  uploadUrl: z.url(),
});

const streamVideoDetailsSchema: z.ZodType<StreamVideoDetails> = z.strictObject({
  uploaded: z.boolean(),
  readyToStream: z.boolean(),
  status: z.string().min(1).max(120),
  durationSeconds: z.number().nonnegative().nullable(),
  previewUrl: z.url().nullable(),
  thumbnailUrl: z.url().nullable(),
  hlsPlaybackUrl: z.url().nullable(),
});

const streamDownloadDetailsSchema: z.ZodType<StreamDownloadDetails> = z.strictObject({
  status: z.enum(['ready', 'inprogress', 'error']),
  percentComplete: z.number().min(0).max(100),
  url: z.url().nullable(),
});

const caseIdAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const storedCaseKey = 'product-evidence-case';
const maxProcessedCommands = 128;
const defaultCaseTtlSeconds = 86_400;
const maximumCaseTtlSeconds = 7 * 86_400;
const analysisLockMilliseconds = 60_000;
const streamRetentionMilliseconds = 31 * 86_400_000;
const reusableEvidenceRetentionMilliseconds = publicNetworkEvidenceRetentionDays * 86_400_000;

function jsonResponse(body: object, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');
  return Response.json(body, {
    status,
    headers: responseHeaders,
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

function randomCaseId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => caseIdAlphabet.charAt(byte % caseIdAlphabet.length)).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
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

function evidenceCaseTtlMilliseconds(env: ProductEvidenceWorkerEnv): number {
  const parsed = Number.parseInt(env.EVIDENCE_CASE_TTL_SECONDS, 10);
  const seconds = Number.isFinite(parsed)
    ? Math.min(maximumCaseTtlSeconds, Math.max(300, parsed))
    : defaultCaseTtlSeconds;
  return seconds * 1_000;
}

export function streamAllowedOriginDomains(allowedOrigins: string): readonly string[] {
  return [
    ...new Set(
      allowedOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0)
        .flatMap((origin) => {
          try {
            const url = new URL(origin);
            return ['http:', 'https:'].includes(url.protocol) && url.hostname.length > 0
              ? [url.hostname]
              : [];
          } catch {
            return [];
          }
        }),
    ),
  ];
}

interface CaseCreationRateLimiters {
  readonly perClient: RateLimit | undefined;
  readonly global: RateLimit | undefined;
}

async function rateLimitAllows(limiter: RateLimit | undefined, key: string): Promise<boolean> {
  if (limiter === undefined) {
    return true;
  }
  try {
    return (await limiter.limit({ key })).success;
  } catch (error: unknown) {
    console.error('Cloudflare case-creation rate limiter was unavailable', error);
    return true;
  }
}

export async function enforceCaseCreationRateLimit(
  request: Request,
  limiters: CaseCreationRateLimiters,
  headers?: HeadersInit,
): Promise<Response | null> {
  const address = request.headers.get('CF-Connecting-IP')?.trim();
  if (address !== undefined && address.length > 0 && limiters.perClient !== undefined) {
    const userAgent = request.headers.get('User-Agent')?.trim() ?? '';
    const clientKey = await sha256Hex(`${address}\u0000${userAgent}`);
    if (!(await rateLimitAllows(limiters.perClient, clientKey))) {
      return jsonResponse(
        {
          error: 'case_creation_rate_limited',
          message: 'This client created too many temporary cases. Wait one minute and retry.',
        },
        429,
        { ...Object.fromEntries(new Headers(headers)), 'Retry-After': '60' },
      );
    }
  }
  if (await rateLimitAllows(limiters.global, 'all-case-creation')) {
    return null;
  }
  return jsonResponse(
    {
      error: 'case_creation_rate_limited',
      message: 'The public pilot is receiving too many new cases. Wait one minute and retry.',
    },
    429,
    { ...Object.fromEntries(new Headers(headers)), 'Retry-After': '60' },
  );
}

function snapshot(caseId: string, stored: StoredEvidenceCase): RemoteEvidenceCaseSnapshot {
  return {
    protocolVersion: remoteEvidenceProtocolVersion,
    caseId,
    expiresAt: stored.expiresAt,
    state: stored.state,
    lastMessage: stored.lastMessage,
  };
}

function initialState(request: CreateRemoteEvidenceCaseRequest, now: string): EvidenceNetworkState {
  let state =
    request.seed === 'travel_bottle'
      ? createDemoEvidenceNetworkState()
      : createEmptyEvidenceNetworkState();
  const question = requestQuestion(request);
  if (question !== null) {
    const transition = applyEvidenceNetworkCommand(
      state,
      { kind: 'ask-product-question', actor: 'human', input: question },
      now,
    );
    if (!transition.ok) {
      throw new Error(transition.message);
    }
    state = transition.state;
  }
  const discovery = requestDiscovery(request);
  if (discovery !== null) {
    const transition = applyEvidenceNetworkCommand(
      state,
      { kind: 'record-evidence-discovery', actor: 'system', input: discovery },
      now,
    );
    if (!transition.ok) {
      throw new Error(transition.message);
    }
    state = transition.state;
  }
  const mission = requestMission(request);
  if (mission !== null) {
    const transition = applyEvidenceNetworkCommand(
      state,
      { kind: 'create-filming-mission', actor: 'human', input: mission },
      now,
    );
    if (!transition.ok) {
      throw new Error(transition.message);
    }
    state = transition.state;
  }
  return state;
}

async function createDirectUpload(
  env: ProductEvidenceWorkerEnv,
  caseId: string,
  maxDurationSeconds: number,
  expiresAt: string,
): Promise<{ readonly uploadId: string; readonly uploadUrl: string }> {
  if (env.STREAM_OUTBOUND !== undefined) {
    const response = await env.STREAM_OUTBOUND.fetch('https://stream.test/direct-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, maxDurationSeconds, expiresAt }),
    });
    if (!response.ok) {
      throw new Error(`Cloudflare Stream reservation failed with ${response.status}.`);
    }
    return streamUploadResponseSchema.parse(await response.json());
  }
  if (env.STREAM === undefined) {
    throw new Error('Cloudflare Stream is not configured for this environment.');
  }
  const allowedOrigins = streamAllowedOriginDomains(env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    throw new Error('Cloudflare Stream needs at least one valid playback origin.');
  }
  const upload = await env.STREAM.createDirectUpload({
    maxDurationSeconds,
    expiry: expiresAt,
    creator: caseId,
    meta: { evidenceCaseId: caseId },
    allowedOrigins: [...allowedOrigins],
    requireSignedURLs: false,
    scheduledDeletion: new Date(Date.now() + streamRetentionMilliseconds).toISOString(),
  });
  return { uploadId: upload.id, uploadUrl: upload.uploadURL };
}

async function readStreamVideo(
  env: ProductEvidenceWorkerEnv,
  uploadId: string,
): Promise<StreamVideoDetails> {
  if (env.STREAM_OUTBOUND !== undefined) {
    const response = await env.STREAM_OUTBOUND.fetch(`https://stream.test/videos/${uploadId}`);
    if (!response.ok) {
      throw new Error(`Cloudflare Stream status failed with ${response.status}.`);
    }
    return streamVideoDetailsSchema.parse(await response.json());
  }
  if (env.STREAM === undefined) {
    throw new Error('Cloudflare Stream is not configured for this environment.');
  }
  const details = await env.STREAM.video(uploadId).details();
  return {
    uploaded: details.uploaded !== null,
    readyToStream: details.readyToStream,
    status: details.status.state,
    durationSeconds: details.duration >= 0 ? details.duration : null,
    previewUrl: details.preview ?? null,
    thumbnailUrl: details.thumbnail.length > 0 ? details.thumbnail : null,
    hlsPlaybackUrl: details.hlsPlaybackUrl.length > 0 ? details.hlsPlaybackUrl : null,
  };
}

function isCloudflareStreamMp4(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /^customer-[a-z0-9-]+\.cloudflarestream\.com$/i.test(url.hostname) &&
      url.pathname.endsWith('/downloads/default.mp4') &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
}

async function prepareStreamDownload(
  env: ProductEvidenceWorkerEnv,
  uploadId: string,
  alreadyRequested: boolean,
): Promise<StreamDownloadDetails> {
  if (env.STREAM_OUTBOUND !== undefined) {
    const response = await env.STREAM_OUTBOUND.fetch(
      `https://stream.test/videos/${uploadId}/downloads/default`,
      { method: alreadyRequested ? 'GET' : 'POST' },
    );
    if (!response.ok) {
      throw new Error(`Cloudflare Stream download preparation failed with ${response.status}.`);
    }
    return streamDownloadDetailsSchema.parse(await response.json());
  }
  if (env.STREAM === undefined) {
    throw new Error('Cloudflare Stream is not configured for this environment.');
  }
  const downloads = alreadyRequested
    ? await env.STREAM.video(uploadId).downloads.get()
    : await env.STREAM.video(uploadId).downloads.generate();
  const video = downloads.default;
  if (video === undefined) {
    return { status: 'inprogress', percentComplete: 0, url: null };
  }
  return {
    status: video.status,
    percentComplete: video.percentComplete,
    url: video.url ?? null,
  };
}

async function analyzeAuthorizedVideo(
  env: ProductEvidenceWorkerEnv,
  input: AuthorizedVideoAnalysisInput,
  abortSignal: AbortSignal,
): Promise<VideoEvidenceProposal> {
  if (env.AI_ANALYSIS_OUTBOUND !== undefined) {
    const response = await env.AI_ANALYSIS_OUTBOUND.fetch('https://analysis.test/video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      throw new Error(`The test analysis service failed with ${response.status}.`);
    }
    return videoEvidenceProposalSchema.parse(await response.json());
  }
  const apiKey = env.AI_GATEWAY_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error('Vercel AI Gateway is not configured.');
  }
  return generateAuthorizedVideoProposal(input, { apiKey, abortSignal });
}

function publicServerMessage(
  caseId: string,
  stored: StoredEvidenceCase,
): RemoteEvidenceServerMessage {
  return { type: 'case-snapshot', ...snapshot(caseId, stored) };
}

function send(socket: WebSocket, message: RemoteEvidenceServerMessage): void {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // A public reader can disconnect between enumeration and send.
  }
}

export class ProductEvidenceCaseObject extends DurableObject<ProductEvidenceWorkerEnv> {
  private stored: StoredEvidenceCase | null = null;
  private readonly workerEnv: ProductEvidenceWorkerEnv;
  private readonly activeVideoAnalyses = new Set<string>();

  constructor(ctx: DurableObjectState, env: ProductEvidenceWorkerEnv) {
    super(ctx, env);
    this.workerEnv = env;
    void ctx.blockConcurrencyWhile(async () => {
      const raw: unknown = await ctx.storage.get(storedCaseKey);
      const parsed = storedEvidenceCaseSchema.safeParse(raw);
      this.stored = parsed.success ? parsed.data : null;
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/initialize') {
      return this.initialize(request);
    }
    if (this.stored === null) {
      return jsonResponse({ error: 'evidence_case_not_found' }, 404);
    }
    if (Date.now() >= this.stored.expiresAt) {
      await this.expire();
      return jsonResponse({ error: 'evidence_case_expired' }, 410);
    }
    if (request.method === 'GET' && url.pathname === '/snapshot') {
      return jsonResponse(snapshot(this.caseId(), this.stored));
    }
    if (request.method === 'GET' && url.pathname === '/connect') {
      return this.connectWebSocket(request);
    }
    if (request.method === 'POST' && url.pathname === '/owner-command') {
      return this.ownerCommand(request);
    }
    if (request.method === 'POST' && url.pathname === '/publish-public-mission') {
      return this.publishPublicMission(request);
    }
    if (request.method === 'POST' && url.pathname === '/remove-public-mission') {
      return this.removePublicMission(request);
    }
    if (request.method === 'POST' && url.pathname === '/reserve-upload') {
      return this.reserveUpload(request);
    }
    if (request.method === 'POST' && url.pathname === '/publish-evidence') {
      return this.publishEvidence(request);
    }
    const analysisMatch = /^\/video\/([a-zA-Z0-9_-]{16,128})\/analysis$/.exec(url.pathname);
    if (request.method === 'POST' && analysisMatch !== null) {
      const uploadId = analysisMatch[1];
      if (uploadId === undefined) {
        return jsonResponse({ error: 'invalid_upload_id' }, 400);
      }
      return this.analyzeEvidenceVideo(request, uploadId);
    }
    const videoMatch = /^\/video\/([a-zA-Z0-9_-]{16,128})$/.exec(url.pathname);
    if (request.method === 'GET' && videoMatch !== null) {
      const uploadId = videoMatch[1];
      if (uploadId === undefined) {
        return jsonResponse({ error: 'invalid_upload_id' }, 400);
      }
      return this.videoStatus(uploadId);
    }
    return jsonResponse({ error: 'not_found' }, 404);
  }

  async alarm(): Promise<void> {
    if (this.stored !== null && Date.now() >= this.stored.expiresAt) {
      await this.expire();
    }
  }

  webSocketMessage(socket: WebSocket): void {
    if (this.stored !== null) {
      send(socket, publicServerMessage(this.caseId(), this.stored));
    }
  }

  webSocketClose(socket: WebSocket, code: number, reason: string): void {
    if (code >= 1_000 && code <= 4_999 && ![1_005, 1_006, 1_015].includes(code)) {
      socket.close(code, reason);
    }
  }

  private caseId(): string {
    return this.ctx.id.name ?? 'UNKNOWN';
  }

  private async initialize(request: Request): Promise<Response> {
    if (this.stored !== null) {
      return jsonResponse({ error: 'evidence_case_exists' }, 409);
    }
    const parsed = initializeEvidenceCaseSchema.safeParse(parseJson(await request.text()));
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_initialization', issues: parsed.error.issues }, 400);
    }
    const stored: StoredEvidenceCase = {
      protocolVersion: remoteEvidenceProtocolVersion,
      ...parsed.data,
      publicMissionId: null,
      publicContributorTokenDigest: null,
      publicMissionExpiresAt: null,
      uploads: [],
      uploadReservationsCreated: 0,
      processedCommands: [],
    };
    this.stored = stored;
    await this.ctx.storage.put(storedCaseKey, stored);
    await this.ctx.storage.setAlarm(stored.expiresAt);
    return jsonResponse(snapshot(this.caseId(), stored), 201);
  }

  private connectWebSocket(request: Request): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return jsonResponse({ error: 'websocket_upgrade_required' }, 426);
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const stored = this.stored;
    if (stored !== null) {
      send(server, publicServerMessage(this.caseId(), stored));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  private async publishPublicMission(request: Request): Promise<Response> {
    const parsed = publishPublicMissionInternalRequestSchema.safeParse(
      parseJson(await request.text()),
    );
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_public_mission', issues: parsed.error.issues }, 400);
    }
    const stored = this.stored;
    if (
      stored === null ||
      parsed.data.caseId !== this.caseId() ||
      !(await this.authenticate(parsed.data.ownerToken, stored.ownerTokenDigest)) ||
      !(await this.authenticate(parsed.data.contributorToken, stored.contributorTokenDigest))
    ) {
      return jsonResponse({ error: 'invalid_public_mission_capability' }, 403);
    }
    const evidenceCase = stored.state.activeCase;
    const mission = evidenceCase?.mission;
    if (evidenceCase === null || evidenceCase === undefined || mission?.status !== 'open') {
      return jsonResponse({ error: 'no_open_filming_mission' }, 409);
    }
    // A retry may arrive with a newly generated client ID after the original
    // response was lost. Recover the already-authorized board capability
    // instead of creating an unreachable second listing.
    const activePublicMission =
      stored.publicMissionId !== null &&
      stored.publicMissionExpiresAt !== null &&
      Date.now() < stored.publicMissionExpiresAt;
    const publicMissionId = activePublicMission
      ? (stored.publicMissionId ?? parsed.data.missionId)
      : parsed.data.missionId;
    const publicMissionExpiresAt =
      activePublicMission && stored.publicMissionExpiresAt !== null
        ? stored.publicMissionExpiresAt
        : Math.min(stored.expiresAt, Date.now() + 24 * 60 * 60 * 1_000);
    this.stored = {
      ...stored,
      publicMissionId,
      publicContributorTokenDigest: await sha256Hex(parsed.data.publicContributorToken),
      publicMissionExpiresAt,
    };
    await this.persistAndBroadcast();
    return jsonResponse(
      publicEvidenceMissionSchema.parse({
        id: publicMissionId,
        caseId: this.caseId(),
        productName: evidenceCase.product.name,
        productUrl: evidenceCase.product.suppliedUrl,
        question: evidenceCase.question.text,
        instruction: mission.instruction,
        successCriterion: mission.successCriterion,
        minimumSeconds: mission.minimumSeconds,
        continuousTakeRequired: mission.continuousTakeRequired,
        status: 'open',
        createdAt: mission.createdAt,
        expiresAt: new Date(publicMissionExpiresAt).toISOString(),
        fulfilledAt: null,
      }),
    );
  }

  private async removePublicMission(request: Request): Promise<Response> {
    const parsed = removePublicMissionInternalRequestSchema.safeParse(
      parseJson(await request.text()),
    );
    if (!parsed.success) {
      return jsonResponse(
        { error: 'invalid_public_mission_removal', issues: parsed.error.issues },
        400,
      );
    }
    const stored = this.stored;
    if (
      stored === null ||
      !(await this.authenticate(parsed.data.ownerToken, stored.ownerTokenDigest))
    ) {
      return jsonResponse({ error: 'invalid_owner_token' }, 403);
    }
    if (stored.publicMissionId !== parsed.data.missionId) {
      return jsonResponse({ error: 'public_mission_not_active' }, 409);
    }
    this.stored = {
      ...stored,
      publicMissionId: null,
      publicContributorTokenDigest: null,
      publicMissionExpiresAt: null,
    };
    await this.persistAndBroadcast();
    return jsonResponse({ ok: true, missionId: parsed.data.missionId });
  }

  private async authenticate(token: string, expectedDigest: string): Promise<boolean> {
    return constantTimeEqual(await sha256Hex(token), expectedDigest);
  }

  private async authenticateContributor(
    token: string,
    stored: StoredEvidenceCase,
  ): Promise<boolean> {
    const tokenDigest = await sha256Hex(token);
    return (
      constantTimeEqual(tokenDigest, stored.contributorTokenDigest) ||
      (stored.publicContributorTokenDigest !== null &&
        stored.publicMissionExpiresAt !== null &&
        Date.now() < stored.publicMissionExpiresAt &&
        constantTimeEqual(tokenDigest, stored.publicContributorTokenDigest))
    );
  }

  private findProcessed(commandId: string): ProcessedEvidenceCommand | null {
    return this.stored?.processedCommands.find((entry) => entry.commandId === commandId) ?? null;
  }

  private async recordTransition(
    commandId: string,
    digest: string,
    ok: boolean,
    message: string,
    nextState: EvidenceNetworkState,
  ): Promise<void> {
    const stored = this.stored;
    if (stored === null) {
      return;
    }
    const processed: ProcessedEvidenceCommand = {
      commandId,
      digest,
      revision: nextState.revision,
      ok,
      message,
    };
    this.stored = {
      ...stored,
      state: nextState,
      lastMessage: message,
      processedCommands: [...stored.processedCommands, processed].slice(-maxProcessedCommands),
    };
    await this.persistAndBroadcast();
  }

  private duplicateResponse(commandId: string, digest: string): Response | null {
    const processed = this.findProcessed(commandId);
    if (processed === null) {
      return null;
    }
    if (!constantTimeEqual(processed.digest, digest)) {
      return jsonResponse({ error: 'command_id_reused' }, 409);
    }
    const stored = this.stored;
    if (stored === null) {
      return jsonResponse({ error: 'evidence_case_not_found' }, 404);
    }
    return jsonResponse({
      ok: processed.ok,
      duplicate: true,
      message: processed.message,
      snapshot: snapshot(this.caseId(), stored),
    });
  }

  private staleRevisionResponse(expectedRevision: number): Response | null {
    const stored = this.stored;
    if (stored === null || expectedRevision === stored.state.revision) {
      return null;
    }
    return jsonResponse(
      {
        error: 'stale_revision',
        expectedRevision,
        actualRevision: stored.state.revision,
        snapshot: snapshot(this.caseId(), stored),
      },
      409,
    );
  }

  private async ownerCommand(request: Request): Promise<Response> {
    const raw = parseJson(await request.text());
    const parsed = ownerEvidenceCommandRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_owner_command', issues: parsed.error.issues }, 400);
    }
    const stored = this.stored;
    if (stored === null || !(await this.authenticate(parsed.data.token, stored.ownerTokenDigest))) {
      return jsonResponse({ error: 'invalid_owner_token' }, 403);
    }
    const digest = await sha256Hex(JSON.stringify(raw));
    const duplicate = this.duplicateResponse(parsed.data.commandId, digest);
    if (duplicate !== null) {
      return duplicate;
    }
    const stale = this.staleRevisionResponse(parsed.data.expectedRevision);
    if (stale !== null) {
      return stale;
    }
    const transition = applyEvidenceNetworkCommand(stored.state, parsed.data.command);
    await this.recordTransition(
      parsed.data.commandId,
      digest,
      transition.ok,
      transition.message,
      transition.state,
    );
    return jsonResponse({
      ok: transition.ok,
      duplicate: false,
      message: transition.message,
      snapshot: snapshot(this.caseId(), this.stored ?? stored),
    });
  }

  private async reserveUpload(request: Request): Promise<Response> {
    const parsed = reserveEvidenceUploadRequestSchema.safeParse(parseJson(await request.text()));
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_upload_request', issues: parsed.error.issues }, 400);
    }
    const stored = this.stored;
    if (stored === null || !(await this.authenticateContributor(parsed.data.token, stored))) {
      return jsonResponse({ error: 'invalid_contributor_token' }, 403);
    }
    if (stored.state.activeCase?.mission?.status !== 'open') {
      return jsonResponse({ error: 'no_open_filming_mission' }, 409);
    }
    if (stored.uploadReservationsCreated >= maximumUploadsPerEvidenceCase) {
      return jsonResponse(
        {
          error: 'upload_limit_reached',
          message:
            'This temporary case already used both video attempts. Create a fresh case to retry.',
        },
        429,
      );
    }
    const maxDurationSeconds = Math.max(
      parsed.data.maxDurationSeconds,
      stored.state.activeCase.mission.minimumSeconds,
    );
    const expiresAt = new Date(Math.min(stored.expiresAt, Date.now() + 15 * 60_000)).toISOString();
    let upload: { readonly uploadId: string; readonly uploadUrl: string };
    try {
      upload = await createDirectUpload(
        this.workerEnv,
        this.caseId(),
        maxDurationSeconds,
        expiresAt,
      );
    } catch (error: unknown) {
      console.error('Cloudflare Stream direct upload reservation failed', error);
      return jsonResponse(
        {
          error: 'video_upload_unavailable',
          message: error instanceof Error ? error.message : String(error),
        },
        503,
      );
    }
    const reservation: StoredUploadReservation = {
      uploadId: upload.uploadId,
      createdAt: Date.now(),
      expiresAt: Date.parse(expiresAt),
      fileSizeBytes: parsed.data.fileSizeBytes,
      maxDurationSeconds,
      mimeType: parsed.data.mimeType,
      downloadRequestedAt: null,
      analysisStatus: 'not_requested',
      analysisStartedAt: null,
      analysisAttempts: 0,
      analysis: null,
    };
    this.stored = {
      ...stored,
      uploads: [
        ...stored.uploads.filter(({ expiresAt: expiry }) => expiry > Date.now()),
        reservation,
      ].slice(-maximumUploadsPerEvidenceCase),
      uploadReservationsCreated: stored.uploadReservationsCreated + 1,
    };
    await this.ctx.storage.put(storedCaseKey, this.stored);
    return jsonResponse(
      {
        provider: 'cloudflare_stream',
        uploadId: upload.uploadId,
        uploadUrl: upload.uploadUrl,
        maxDurationSeconds,
        expiresAt,
      },
      201,
    );
  }

  private async replaceUpload(nextUpload: StoredUploadReservation): Promise<void> {
    const stored = this.stored;
    if (stored === null) {
      return;
    }
    this.stored = {
      ...stored,
      uploads: stored.uploads.map((upload) =>
        upload.uploadId === nextUpload.uploadId ? nextUpload : upload,
      ),
    };
    await this.ctx.storage.put(storedCaseKey, this.stored);
  }

  private analysisProcessing(
    uploadId: string,
    stage: 'stream-processing' | 'mp4-preparing' | 'model-review',
    message: string,
  ): Response {
    return jsonResponse({ kind: 'processing', uploadId, stage, message }, 202);
  }

  private manualAnalysis(
    uploadId: string,
    reason:
      'gateway-unconfigured' | 'gateway-unavailable' | 'video-too-large' | 'stream-unavailable',
    message: string,
  ): Response {
    return jsonResponse({ kind: 'manual-review-required', uploadId, reason, message });
  }

  private async analyzeEvidenceVideo(request: Request, uploadId: string): Promise<Response> {
    const parsed = analyzeEvidenceVideoRequestSchema.safeParse(parseJson(await request.text()));
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_video_analysis_request' }, 400);
    }
    const stored = this.stored;
    if (stored === null || !(await this.authenticateContributor(parsed.data.token, stored))) {
      return jsonResponse({ error: 'invalid_contributor_token' }, 403);
    }
    const evidenceCase = stored.state.activeCase;
    const mission = evidenceCase?.mission;
    if (evidenceCase === null || evidenceCase === undefined || mission?.status !== 'open') {
      return jsonResponse({ error: 'no_open_filming_mission' }, 409);
    }
    let reservation = stored.uploads.find((upload) => upload.uploadId === uploadId);
    if (reservation === undefined || reservation.expiresAt <= Date.now()) {
      return jsonResponse({ error: 'upload_reservation_not_found' }, 409);
    }
    if (reservation.fileSizeBytes > maximumAnalyzableVideoBytes) {
      return this.manualAnalysis(
        uploadId,
        'video-too-large',
        'This clip is preserved in Stream but is too large for the bounded AI review path. Review it manually.',
      );
    }
    if (reservation.analysisStatus === 'complete' && reservation.analysis !== null) {
      return jsonResponse({ kind: 'proposal', uploadId, ...reservation.analysis });
    }
    if (reservation.analysisStatus === 'unavailable') {
      return this.manualAnalysis(
        uploadId,
        'gateway-unavailable',
        'The AI proposal was unavailable. Review the exact uploaded recording manually.',
      );
    }
    const now = Date.now();
    if (
      reservation.analysisStatus === 'running' &&
      reservation.analysisStartedAt !== null &&
      now - reservation.analysisStartedAt < analysisLockMilliseconds
    ) {
      return this.analysisProcessing(
        uploadId,
        'model-review',
        'Gemini is locating the smallest interval that answers the question.',
      );
    }
    if (reservation.analysisStatus === 'running' && reservation.analysisAttempts >= 2) {
      reservation = { ...reservation, analysisStatus: 'unavailable' };
      await this.replaceUpload(reservation);
      return this.manualAnalysis(
        uploadId,
        'gateway-unavailable',
        'The bounded AI review did not finish. Review the exact uploaded recording manually.',
      );
    }

    let video: StreamVideoDetails;
    try {
      video = await readStreamVideo(this.workerEnv, uploadId);
    } catch (error: unknown) {
      console.error('Cloudflare Stream video analysis status failed', error);
      return this.manualAnalysis(
        uploadId,
        'stream-unavailable',
        'Cloudflare Stream could not verify this clip yet. Review can continue manually.',
      );
    }
    if (!video.uploaded || !video.readyToStream) {
      return this.analysisProcessing(
        uploadId,
        'stream-processing',
        'Cloudflare Stream is verifying and encoding the exact uploaded clip.',
      );
    }

    let download: StreamDownloadDetails;
    try {
      const alreadyRequested = reservation.downloadRequestedAt !== null;
      download = await prepareStreamDownload(this.workerEnv, uploadId, alreadyRequested);
      if (!alreadyRequested) {
        reservation = { ...reservation, downloadRequestedAt: now };
        await this.replaceUpload(reservation);
      }
    } catch (error: unknown) {
      console.error('Cloudflare Stream MP4 preparation failed', error);
      return this.manualAnalysis(
        uploadId,
        'stream-unavailable',
        'The exact Stream MP4 was unavailable. Review can continue manually.',
      );
    }
    if (download.status === 'inprogress') {
      return this.analysisProcessing(
        uploadId,
        'mp4-preparing',
        `Cloudflare Stream is preparing the analysis copy (${Math.round(download.percentComplete)}%).`,
      );
    }
    if (
      download.status !== 'ready' ||
      download.url === null ||
      !isCloudflareStreamMp4(download.url)
    ) {
      return this.manualAnalysis(
        uploadId,
        'stream-unavailable',
        'Cloudflare Stream did not return a valid analysis copy. Review can continue manually.',
      );
    }
    if (
      this.workerEnv.AI_ANALYSIS_OUTBOUND === undefined &&
      !this.workerEnv.AI_GATEWAY_API_KEY?.trim()
    ) {
      return this.manualAnalysis(
        uploadId,
        'gateway-unconfigured',
        'Vercel AI Gateway is not configured here. Review the exact uploaded recording manually.',
      );
    }

    const latestReservation = this.stored?.uploads.find((upload) => upload.uploadId === uploadId);
    if (latestReservation === undefined || latestReservation.expiresAt <= Date.now()) {
      return jsonResponse({ error: 'upload_reservation_not_found' }, 409);
    }
    if (latestReservation.analysisStatus === 'complete' && latestReservation.analysis !== null) {
      return jsonResponse({ kind: 'proposal', uploadId, ...latestReservation.analysis });
    }
    if (latestReservation.analysisStatus === 'unavailable') {
      return this.manualAnalysis(
        uploadId,
        'gateway-unavailable',
        'The AI proposal was unavailable. Review the exact uploaded recording manually.',
      );
    }
    const latestNow = Date.now();
    if (
      this.activeVideoAnalyses.has(uploadId) ||
      (latestReservation.analysisStatus === 'running' &&
        latestReservation.analysisStartedAt !== null &&
        latestNow - latestReservation.analysisStartedAt < analysisLockMilliseconds)
    ) {
      return this.analysisProcessing(
        uploadId,
        'model-review',
        'Gemini is locating the smallest interval that answers the question.',
      );
    }
    if (latestReservation.analysisStatus === 'running' && latestReservation.analysisAttempts >= 2) {
      await this.replaceUpload({ ...latestReservation, analysisStatus: 'unavailable' });
      return this.manualAnalysis(
        uploadId,
        'gateway-unavailable',
        'The bounded AI review did not finish. Review the exact uploaded recording manually.',
      );
    }

    reservation = {
      ...latestReservation,
      analysisStatus: 'running',
      analysisStartedAt: latestNow,
      analysisAttempts: Math.min(2, latestReservation.analysisAttempts + 1),
    };
    this.activeVideoAnalyses.add(uploadId);
    try {
      await this.replaceUpload(reservation);
      const durationSeconds = Math.max(
        1,
        Math.round(video.durationSeconds ?? reservation.maxDurationSeconds),
      );
      const analysis = await analyzeAuthorizedVideo(
        this.workerEnv,
        {
          uploadId,
          videoUrl: download.url,
          productName: evidenceCase.product.name,
          question: evidenceCase.question.text,
          instruction: mission.instruction,
          successCriterion: mission.successCriterion,
          durationSeconds,
          continuousTakeRequired: mission.continuousTakeRequired,
        },
        request.signal,
      );
      await this.replaceUpload({
        ...reservation,
        analysisStatus: 'complete',
        analysisStartedAt: null,
        analysis,
      });
      return jsonResponse({ kind: 'proposal', uploadId, ...analysis });
    } catch (error: unknown) {
      console.error('Vercel AI Gateway video analysis failed', error);
      await this.replaceUpload({
        ...reservation,
        analysisStatus: 'unavailable',
        analysisStartedAt: null,
        analysis: null,
      });
      return this.manualAnalysis(
        uploadId,
        'gateway-unavailable',
        'The AI proposal was unavailable. Review the exact uploaded recording manually.',
      );
    } finally {
      this.activeVideoAnalyses.delete(uploadId);
    }
  }

  private async publishEvidence(request: Request): Promise<Response> {
    const raw = parseJson(await request.text());
    const parsed = publishRemoteEvidenceRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_evidence_review', issues: parsed.error.issues }, 400);
    }
    const stored = this.stored;
    if (stored === null || !(await this.authenticateContributor(parsed.data.token, stored))) {
      return jsonResponse({ error: 'invalid_contributor_token' }, 403);
    }
    const evidenceCase = stored.state.activeCase;
    if (evidenceCase?.mission?.status !== 'open') {
      return jsonResponse({ error: 'no_open_filming_mission' }, 409);
    }
    const digest = await sha256Hex(JSON.stringify(raw));
    const duplicate = this.duplicateResponse(parsed.data.commandId, digest);
    if (duplicate !== null) {
      return duplicate;
    }
    const stale = this.staleRevisionResponse(parsed.data.expectedRevision);
    if (stale !== null) {
      return stale;
    }
    const reservation = stored.uploads.find(({ uploadId }) => uploadId === parsed.data.uploadId);
    if (reservation === undefined || reservation.expiresAt <= Date.now()) {
      return jsonResponse({ error: 'upload_reservation_not_found' }, 409);
    }
    let video: StreamVideoDetails;
    try {
      video = await readStreamVideo(this.workerEnv, parsed.data.uploadId);
    } catch (error: unknown) {
      console.error('Cloudflare Stream video verification failed', error);
      return jsonResponse({ error: 'video_status_unavailable' }, 503);
    }
    if (!video.uploaded) {
      return jsonResponse({ error: 'video_upload_incomplete' }, 409);
    }
    if (!video.readyToStream) {
      return jsonResponse({ error: 'video_still_processing' }, 409);
    }
    const actualDuration =
      video.durationSeconds === null
        ? parsed.data.review.durationSeconds
        : Math.max(1, Math.round(video.durationSeconds));
    if (parsed.data.review.citationEndSeconds > actualDuration) {
      return jsonResponse(
        {
          error: 'citation_outside_video',
          message: 'The reviewed citation extends beyond the verified Stream duration.',
        },
        400,
      );
    }
    const evidenceInput: ReviewedEvidenceInput = {
      ...parsed.data.review,
      durationSeconds: actualDuration,
      provenance: 'live_capture',
      streamUid: parsed.data.uploadId,
      ...(video.previewUrl === null ? {} : { videoUrl: video.previewUrl }),
    };
    const reviewedAt = new Date().toISOString();
    const transition = applyEvidenceNetworkCommand(
      stored.state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: evidenceInput,
      },
      reviewedAt,
    );
    if (transition.ok && parsed.data.review.reuseScope === 'public_network') {
      if (!qualifiesForPublicNetworkReuse(parsed.data.review)) {
        return jsonResponse(
          {
            error: 'evidence_not_reusable',
            message:
              'Network reuse requires a conclusive, medium-or-high-confidence continuous recording. Choose case-only publication or strengthen the review.',
          },
          422,
        );
      }
      if (this.workerEnv.EVIDENCE_LIBRARY === undefined) {
        return jsonResponse(
          {
            error: 'evidence_library_unavailable',
            message:
              'This deployment cannot make the clip reusable yet. Choose case-only publication or retry later.',
          },
          503,
        );
      }
      if (video.previewUrl === null) {
        return jsonResponse(
          {
            error: 'video_playback_unavailable',
            message:
              'Cloudflare Stream has not exposed a reusable playback URL yet. Retry after processing finishes.',
          },
          503,
        );
      }
      const reusableRecord = reusableEvidenceRecordSchema.parse({
        id: `${this.caseId()}:${parsed.data.uploadId}`,
        productName: evidenceCase.product.name,
        productUrl: evidenceCase.product.suppliedUrl,
        question: evidenceCase.question.text,
        source: {
          title: 'Contributor-recorded mission video',
          videoUrl: video.previewUrl,
          rights: parsed.data.review.rights,
          provenance: 'live_capture',
          continuity: parsed.data.review.continuity,
          contributorLabel: parsed.data.review.contributorLabel,
          capturedAt: parsed.data.review.capturedAt,
          streamUid: parsed.data.uploadId,
          sha256: parsed.data.review.sha256,
          durationSeconds: actualDuration,
        },
        observation: {
          result: parsed.data.review.result,
          confidence: parsed.data.review.confidence,
          text: parsed.data.review.observation,
          citationStartSeconds: parsed.data.review.citationStartSeconds,
          citationEndSeconds: parsed.data.review.citationEndSeconds,
          reviewedAt,
        },
        indexedAt: reviewedAt,
        expiresAt: new Date(Date.now() + reusableEvidenceRetentionMilliseconds).toISOString(),
      });
      try {
        await indexReusableEvidence(this.workerEnv.EVIDENCE_LIBRARY, reusableRecord);
      } catch (error: unknown) {
        console.error('Cloudflare D1 reusable evidence write failed', error);
        return jsonResponse(
          {
            error: 'evidence_library_unavailable',
            message:
              'The reusable evidence index did not accept this clip. Choose case-only publication or retry later.',
          },
          503,
        );
      }
    }
    await this.recordTransition(
      parsed.data.commandId,
      digest,
      transition.ok,
      transition.message,
      transition.state,
    );
    if (
      transition.ok &&
      stored.publicMissionId !== null &&
      this.workerEnv.EVIDENCE_LIBRARY !== undefined
    ) {
      try {
        await markPublicMissionFulfilled(
          this.workerEnv.EVIDENCE_LIBRARY,
          stored.publicMissionId,
          reviewedAt,
        );
      } catch (error: unknown) {
        console.error('Cloudflare D1 public mission fulfillment update failed', error);
      }
    }
    return jsonResponse({
      ok: transition.ok,
      duplicate: false,
      message: transition.message,
      video: {
        provider: 'cloudflare_stream',
        uploadId: parsed.data.uploadId,
        readyToStream: video.readyToStream,
        status: video.status,
      },
      reuse: {
        scope: parsed.data.review.reuseScope,
        indexed: parsed.data.review.reuseScope === 'public_network',
      },
      snapshot: snapshot(this.caseId(), this.stored ?? stored),
    });
  }

  private async videoStatus(uploadId: string): Promise<Response> {
    const stored = this.stored;
    if (stored?.uploads.some((upload) => upload.uploadId === uploadId) !== true) {
      return jsonResponse({ error: 'upload_not_found' }, 404);
    }
    try {
      const video = await readStreamVideo(this.workerEnv, uploadId);
      return jsonResponse({ provider: 'cloudflare_stream', uploadId, ...video });
    } catch (error: unknown) {
      console.error('Cloudflare Stream video status failed', error);
      return jsonResponse({ error: 'video_status_unavailable' }, 503);
    }
  }

  private async persistAndBroadcast(): Promise<void> {
    const stored = this.stored;
    if (stored === null) {
      return;
    }
    await this.ctx.storage.put(storedCaseKey, stored);
    const message = publicServerMessage(this.caseId(), stored);
    for (const socket of this.ctx.getWebSockets()) {
      send(socket, message);
    }
  }

  private async expire(): Promise<void> {
    for (const socket of this.ctx.getWebSockets()) {
      send(socket, {
        type: 'case-expired',
        message: 'This temporary product-evidence case expired. Create a new case to continue.',
      });
      socket.close(1001, 'Evidence case expired');
    }
    this.stored = null;
    await this.ctx.storage.deleteAll();
  }
}

async function createEvidenceCase(
  request: Request,
  env: ProductEvidenceWorkerEnv,
  cors: HeadersInit,
): Promise<Response> {
  const parsed = createRemoteEvidenceCaseRequestSchema.safeParse(parseJson(await request.text()));
  if (!parsed.success) {
    return jsonResponse({ error: 'invalid_evidence_case', issues: parsed.error.issues }, 400, cors);
  }
  const rateLimited = await enforceCaseCreationRateLimit(
    request,
    {
      perClient: env.CASE_CREATION_PER_CLIENT_RATE_LIMITER,
      global: env.CASE_CREATION_GLOBAL_RATE_LIMITER,
    },
    cors,
  );
  if (rateLimited !== null) {
    return rateLimited;
  }
  const createdAt = Date.now();
  const expiresAt = createdAt + evidenceCaseTtlMilliseconds(env);
  const ownerToken = randomBase64Url(32);
  const contributorToken = randomBase64Url(32);
  const state = initialState(parsed.data, new Date(createdAt).toISOString());
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const caseId = randomCaseId();
    const stub = env.CASES.get(env.CASES.idFromName(caseId));
    const response = await stub.fetch('https://evidence.internal/initialize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerTokenDigest: await sha256Hex(ownerToken),
        contributorTokenDigest: await sha256Hex(contributorToken),
        createdAt,
        expiresAt,
        state,
        lastMessage:
          state.activeCase?.mission === null
            ? 'Shared evidence case created. No filming mission exists yet.'
            : 'Shared evidence case created. A contributor can now record the mission.',
      }),
    });
    if (response.status === 409) {
      continue;
    }
    if (!response.ok) {
      return jsonResponse({ error: 'evidence_case_initialization_failed' }, 500, cors);
    }
    return jsonResponse(
      {
        protocolVersion: remoteEvidenceProtocolVersion,
        caseId,
        ownerToken,
        contributorToken,
        expiresAt,
        state,
      },
      201,
      cors,
    );
  }
  return jsonResponse({ error: 'evidence_case_id_collision' }, 503, cors);
}

function caseStub(env: ProductEvidenceWorkerEnv, caseId: string): DurableObjectStub {
  return env.CASES.get(env.CASES.idFromName(caseId));
}

export async function routeProductEvidenceRequest(
  request: Request,
  env: ProductEvidenceWorkerEnv,
  cors: HeadersInit,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/evidence-cases')) {
    return null;
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method === 'POST' && url.pathname === '/evidence-cases') {
    return createEvidenceCase(request, env, cors);
  }
  const match =
    /^\/evidence-cases\/([A-Z2-9]{8})(?:\/(snapshot|ws|commands|uploads|evidence|videos\/([a-zA-Z0-9_-]{16,128})(?:\/(analysis))?))?$/.exec(
      url.pathname,
    );
  if (match === null) {
    return jsonResponse({ error: 'not_found' }, 404, cors);
  }
  const caseId = match[1];
  const action = match[2] ?? 'snapshot';
  const uploadId = match[3];
  const videoAction = match[4];
  if (caseId === undefined || !remoteEvidenceCaseIdPattern.test(caseId)) {
    return jsonResponse({ error: 'invalid_evidence_case_id' }, 400, cors);
  }
  const stub = caseStub(env, caseId);
  let internalPath: string;
  if (action === 'snapshot') {
    internalPath = '/snapshot';
  } else if (action === 'ws') {
    internalPath = '/connect';
  } else if (action === 'commands') {
    internalPath = '/owner-command';
  } else if (action === 'uploads') {
    internalPath = '/reserve-upload';
  } else if (action === 'evidence') {
    internalPath = '/publish-evidence';
  } else if (uploadId !== undefined) {
    internalPath = `/video/${uploadId}${videoAction === 'analysis' ? '/analysis' : ''}`;
  } else {
    return jsonResponse({ error: 'not_found' }, 404, cors);
  }
  if (action === 'ws') {
    return stub.fetch(`https://evidence.internal${internalPath}`, request);
  }
  const requestBody = ['GET', 'HEAD'].includes(request.method) ? null : await request.text();
  const response = await stub.fetch(`https://evidence.internal${internalPath}`, {
    method: request.method,
    headers: request.headers,
    body: requestBody,
  });
  const headers = new Headers(response.headers);
  for (const [name, value] of new Headers(cors)) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}
