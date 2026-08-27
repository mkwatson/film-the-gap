import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
  createEmptyEvidenceNetworkState,
  type EvidenceNetworkState,
  type ReviewedEvidenceInput,
} from '../../src/lib/evidence-network/model';
import {
  createRemoteEvidenceCaseRequestSchema,
  evidenceNetworkStateSchema,
  ownerEvidenceCommandRequestSchema,
  publishRemoteEvidenceRequestSchema,
  remoteEvidenceCaseIdPattern,
  remoteEvidenceProtocolVersion,
  requestMission,
  requestQuestion,
  reserveEvidenceUploadRequestSchema,
  type CreateRemoteEvidenceCaseRequest,
  type RemoteEvidenceCaseSnapshot,
  type RemoteEvidenceServerMessage,
} from '../../src/lib/evidence-network/remote-protocol';

export interface ProductEvidenceWorkerEnv {
  readonly CASES: DurableObjectNamespace<ProductEvidenceCaseObject>;
  readonly EVIDENCE_CASE_TTL_SECONDS: string;
  readonly ALLOWED_ORIGINS: string;
  readonly STREAM?: StreamBinding;
  readonly STREAM_OUTBOUND?: Fetcher;
}

interface StoredUploadReservation {
  readonly uploadId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly fileSizeBytes: number;
  readonly maxDurationSeconds: number;
  readonly mimeType: string;
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
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly state: EvidenceNetworkState;
  readonly lastMessage: string;
  readonly uploads: readonly StoredUploadReservation[];
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

const storedUploadReservationSchema = z.strictObject({
  uploadId: z.string().regex(/^[a-zA-Z0-9_-]{16,128}$/),
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  fileSizeBytes: z.number().int().positive(),
  maxDurationSeconds: z.number().int().min(2).max(90),
  mimeType: z.string().min(3).max(120),
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
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  state: evidenceNetworkStateSchema,
  lastMessage: z.string().min(1).max(500),
  uploads: z.array(storedUploadReservationSchema).max(16),
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

const caseIdAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const storedCaseKey = 'product-evidence-case';
const maxProcessedCommands = 128;
const defaultCaseTtlSeconds = 86_400;
const maximumCaseTtlSeconds = 7 * 86_400;

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

function originList(env: ProductEvidenceWorkerEnv): readonly string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
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
  const upload = await env.STREAM.createDirectUpload({
    maxDurationSeconds,
    expiry: expiresAt,
    creator: caseId,
    meta: { evidenceCaseId: caseId },
    allowedOrigins: [...originList(env)],
    requireSignedURLs: false,
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
    if (request.method === 'POST' && url.pathname === '/reserve-upload') {
      return this.reserveUpload(request);
    }
    if (request.method === 'POST' && url.pathname === '/publish-evidence') {
      return this.publishEvidence(request);
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
      uploads: [],
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

  private async authenticate(token: string, expectedDigest: string): Promise<boolean> {
    return constantTimeEqual(await sha256Hex(token), expectedDigest);
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
    if (
      stored === null ||
      !(await this.authenticate(parsed.data.token, stored.contributorTokenDigest))
    ) {
      return jsonResponse({ error: 'invalid_contributor_token' }, 403);
    }
    if (stored.state.activeCase?.mission?.status !== 'open') {
      return jsonResponse({ error: 'no_open_filming_mission' }, 409);
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
    };
    this.stored = {
      ...stored,
      uploads: [
        ...stored.uploads.filter(({ expiresAt: expiry }) => expiry > Date.now()),
        reservation,
      ].slice(-16),
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

  private async publishEvidence(request: Request): Promise<Response> {
    const raw = parseJson(await request.text());
    const parsed = publishRemoteEvidenceRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse({ error: 'invalid_evidence_review', issues: parsed.error.issues }, 400);
    }
    const stored = this.stored;
    if (
      stored === null ||
      !(await this.authenticate(parsed.data.token, stored.contributorTokenDigest))
    ) {
      return jsonResponse({ error: 'invalid_contributor_token' }, 403);
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
    const actualDuration =
      video.durationSeconds === null
        ? parsed.data.review.durationSeconds
        : Math.max(1, Math.round(video.durationSeconds));
    const evidenceInput: ReviewedEvidenceInput = {
      ...parsed.data.review,
      durationSeconds: actualDuration,
      provenance: 'live_capture',
      streamUid: parsed.data.uploadId,
      ...(video.previewUrl === null ? {} : { videoUrl: video.previewUrl }),
    };
    const transition = applyEvidenceNetworkCommand(stored.state, {
      kind: 'publish-reviewed-evidence',
      actor: 'contributor',
      input: evidenceInput,
    });
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
      video: {
        provider: 'cloudflare_stream',
        uploadId: parsed.data.uploadId,
        readyToStream: video.readyToStream,
        status: video.status,
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
    /^\/evidence-cases\/([A-Z2-9]{8})(?:\/(snapshot|ws|commands|uploads|evidence|videos\/([a-zA-Z0-9_-]{16,128})))?$/.exec(
      url.pathname,
    );
  if (match === null) {
    return jsonResponse({ error: 'not_found' }, 404, cors);
  }
  const caseId = match[1];
  const action = match[2] ?? 'snapshot';
  const uploadId = match[3];
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
    internalPath = `/video/${uploadId}`;
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
