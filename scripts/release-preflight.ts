import { z } from 'zod';

import { reusableEvidenceSearchResponseSchema } from '../src/lib/evidence-network/model.ts';
import {
  maximumUploadsPerEvidenceCase,
  publicEvidenceMissionListSchema,
  remoteEvidenceCaseCredentialsSchema,
  remoteEvidenceCaseSnapshotSchema,
  remoteEvidenceProtocolVersion,
} from '../src/lib/evidence-network/remote-protocol.ts';

export interface ReleaseConfig {
  readonly appOrigin: string;
  readonly roomOrigin: string;
  readonly expectedCommit: string;
  readonly timeoutMs: number;
}

export interface ReleaseStep {
  readonly name: string;
  readonly durationMs: number;
}

export interface ReleaseWorkerVersion {
  readonly id: string;
  readonly tag: string;
  readonly timestamp: string;
}

export interface ReleaseReport {
  readonly ok: true;
  readonly commit: string;
  readonly workerVersion: ReleaseWorkerVersion;
  readonly steps: readonly ReleaseStep[];
}

export type ReleaseFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const commitPattern = /^[0-9a-f]{40}$/i;
const minimumTimeoutMs = 2_000;
const maximumTimeoutMs = 60_000;
const maximumJsonBytes = 128 * 1024;
const maximumHtmlBytes = 2 * 1024 * 1024;

const workerVersionSchema = z.strictObject({
  id: z.string().min(1).max(160),
  tag: z.string().min(1).max(160),
  timestamp: z.string().min(1).max(160),
});

const appHealthSchema = z.strictObject({
  ok: z.literal(true),
  service: z.literal('webmcp-challenge-app'),
  commit: z.string().regex(commitPattern),
  evidenceRoomOrigin: z.string().url(),
  evidenceRoomConfigured: z.literal(true),
});

const roomHealthSchema = z.strictObject({
  ok: z.literal(true),
  service: z.literal('webmcp-product-evidence'),
  protocolVersion: z.literal(remoteEvidenceProtocolVersion),
  abuseControls: z.strictObject({
    perClientCaseCreation: z.literal(true),
    globalCaseCreation: z.literal(true),
    maximumUploadsPerEvidenceCase: z.literal(maximumUploadsPerEvidenceCase),
  }),
  evidenceServices: z.strictObject({
    stream: z.literal(true),
    videoAnalysis: z.literal(true),
    reusableEvidence: z.literal(true),
    reusableEvidenceRetentionDays: z.literal(30),
    expiredEvidencePurge: z.literal('daily'),
    publicMissionBoard: z.literal(true),
    publicMissionRetentionHours: z.literal(24),
  }),
  workerVersion: workerVersionSchema,
});

function releaseOrigin(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
): string {
  const value = environment[key]?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(`${key} is required.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute HTTPS origin.`);
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.search.length > 0 ||
    parsed.hash.length > 0 ||
    (parsed.pathname !== '' && parsed.pathname !== '/')
  ) {
    throw new Error(`${key} must be a credential-free HTTPS origin.`);
  }
  return parsed.origin;
}

function releaseCommit(environment: Readonly<Record<string, string | undefined>>): string {
  const value = environment.EVIDENCE_RELEASE_COMMIT_SHA?.trim();
  if (value === undefined || !commitPattern.test(value)) {
    throw new Error('EVIDENCE_RELEASE_COMMIT_SHA must be an exact 40-character Git commit.');
  }
  return value.toLowerCase();
}

function releaseTimeout(environment: Readonly<Record<string, string | undefined>>): number {
  const value = environment.EVIDENCE_RELEASE_TIMEOUT_MS?.trim();
  if (value === undefined || value.length === 0) {
    return 15_000;
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimumTimeoutMs || parsed > maximumTimeoutMs) {
    throw new Error(
      `EVIDENCE_RELEASE_TIMEOUT_MS must be an integer from ${minimumTimeoutMs} to ${maximumTimeoutMs}.`,
    );
  }
  return parsed;
}

export function readReleaseConfig(
  environment: Readonly<Record<string, string | undefined>>,
): ReleaseConfig {
  const appOrigin = releaseOrigin(environment, 'EVIDENCE_ACCEPTANCE_APP_URL');
  const roomOrigin = releaseOrigin(environment, 'EVIDENCE_ACCEPTANCE_ROOM_ORIGIN');
  if (appOrigin === roomOrigin) {
    throw new Error('Release app and evidence-service origins must be distinct.');
  }
  return {
    appOrigin,
    roomOrigin,
    expectedCommit: releaseCommit(environment),
    timeoutMs: releaseTimeout(environment),
  };
}

function probeError(label: string, detail?: string): Error {
  return new Error(`Release probe failed: ${label}${detail === undefined ? '.' : ` (${detail}).`}`);
}

function contentLengthWithin(response: Response, maximumBytes: number, label: string): void {
  const rawLength = response.headers.get('Content-Length');
  if (rawLength === null) return;
  const length = Number(rawLength);
  if (!Number.isSafeInteger(length) || length < 0 || length > maximumBytes) {
    throw probeError(label, 'invalid response size');
  }
}

async function boundedBody(
  response: Response,
  maximumBytes: number,
  label: string,
): Promise<string> {
  contentLengthWithin(response, maximumBytes, label);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > maximumBytes) throw probeError(label, 'response too large');
  return new TextDecoder().decode(bytes);
}

async function probe(
  fetcher: ReleaseFetch,
  config: ReleaseConfig,
  label: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetcher(path, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch {
    throw probeError(label, 'request failed');
  }
}

async function jsonBody(response: Response, label: string): Promise<unknown> {
  if (!(response.headers.get('Content-Type')?.toLowerCase() ?? '').startsWith('application/json')) {
    throw probeError(label, 'expected JSON');
  }
  const body = await boundedBody(response, maximumJsonBytes, label);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw probeError(label, 'invalid JSON');
  }
}

async function htmlBody(response: Response, label: string): Promise<string> {
  if (!(response.headers.get('Content-Type')?.toLowerCase() ?? '').startsWith('text/html')) {
    throw probeError(label, 'expected HTML');
  }
  return boundedBody(response, maximumHtmlBytes, label);
}

function requireStatus(response: Response, expected: number, label: string): void {
  if (response.status !== expected) throw probeError(label, `HTTP ${response.status}`);
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw probeError(label, 'invalid response contract');
  return result.data;
}

function requireHeader(response: Response, name: string, expected: string, label: string): void {
  if (response.headers.get(name) !== expected) throw probeError(label, `${name} mismatch`);
}

function requireHeaderIncludes(
  response: Response,
  name: string,
  expected: string,
  label: string,
): void {
  if (!response.headers.get(name)?.includes(expected)) throw probeError(label, `${name} mismatch`);
}

function requireHeaderExcludes(
  response: Response,
  name: string,
  forbidden: string,
  label: string,
): void {
  if (response.headers.get(name)?.includes(forbidden)) {
    throw probeError(label, `${name} is over-permissive`);
  }
}

function requireMarker(body: string, marker: string, label: string): void {
  if (!body.includes(marker)) throw probeError(label, 'expected page marker missing');
}

interface AppSecurityExpectation {
  readonly allowCamera: boolean;
  readonly allowCreatorUpload: boolean;
  readonly allowStreamPlayback: boolean;
}

function requireAppSecurityPolicy(
  response: Response,
  label: string,
  roomOrigin: string,
  expectation: AppSecurityExpectation,
): void {
  const websocketOrigin = roomOrigin.replace(/^https:/, 'wss:');
  for (const source of [
    "default-src 'self'",
    `connect-src 'self'`,
    roomOrigin,
    websocketOrigin,
    "object-src 'none'",
    "frame-ancestors 'none'",
  ]) {
    requireHeaderIncludes(response, 'Content-Security-Policy', source, label);
  }
  const streamSource = 'https://*.cloudflarestream.com';
  if (expectation.allowStreamPlayback) {
    requireHeaderIncludes(response, 'Content-Security-Policy', streamSource, label);
  } else {
    requireHeaderExcludes(response, 'Content-Security-Policy', streamSource, label);
  }
  const uploadSource = 'https://upload.videodelivery.net';
  if (expectation.allowCreatorUpload) {
    requireHeaderIncludes(response, 'Content-Security-Policy', uploadSource, label);
  } else {
    requireHeaderExcludes(response, 'Content-Security-Policy', uploadSource, label);
  }
  requireHeaderIncludes(
    response,
    'Permissions-Policy',
    expectation.allowCamera ? 'camera=(self)' : 'camera=()',
    label,
  );
  requireHeaderIncludes(response, 'Permissions-Policy', 'microphone=()', label);
  requireHeaderIncludes(response, 'Permissions-Policy', 'payment=()', label);
  requireHeader(response, 'Referrer-Policy', 'no-referrer', label);
  requireHeader(response, 'X-Content-Type-Options', 'nosniff', label);
}

function validateWorkerVersion(
  version: ReleaseWorkerVersion,
  expectedCommit: string,
  label: string,
): void {
  if (version.tag.toLowerCase() !== expectedCommit) {
    throw probeError(label, 'worker tag does not match commit');
  }
}

export function sanitizeReleaseFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown release verification failure.';
  return message
    .replaceAll(/https?:\/\/[^\s"'<>]+/gi, '[origin suppressed]')
    .replaceAll(/[A-Za-z0-9_-]{32,128}/g, '[credential suppressed]');
}

export async function verifyPublicRelease(
  config: ReleaseConfig,
  fetcher: ReleaseFetch = fetch,
): Promise<ReleaseReport> {
  const steps: ReleaseStep[] = [];
  let roomVersion: ReleaseWorkerVersion | null = null;
  async function step(name: string, operation: () => Promise<void>): Promise<void> {
    const startedAt = performance.now();
    await operation();
    steps.push({ name, durationMs: Math.max(0, Math.round(performance.now() - startedAt)) });
  }

  await step('app health and commit', async () => {
    const label = 'app health and commit';
    const response = await probe(fetcher, config, label, `${config.appOrigin}/api/health`);
    requireStatus(response, 200, label);
    requireHeaderIncludes(response, 'Cache-Control', 'no-store', label);
    const health = parseWithSchema(appHealthSchema, await jsonBody(response, label), label);
    if (
      health.commit.toLowerCase() !== config.expectedCommit ||
      health.evidenceRoomOrigin !== config.roomOrigin
    ) {
      throw probeError(label, 'deployed configuration mismatch');
    }
  });

  await step('evidence service health, commit, and cost controls', async () => {
    const label = 'evidence service health, commit, and cost controls';
    const response = await probe(fetcher, config, label, `${config.roomOrigin}/healthz`);
    requireStatus(response, 200, label);
    requireHeaderIncludes(response, 'Cache-Control', 'no-store', label);
    const health = parseWithSchema(roomHealthSchema, await jsonBody(response, label), label);
    validateWorkerVersion(health.workerVersion, config.expectedCommit, label);
    roomVersion = health.workerVersion;
  });

  await step('reusable evidence index', async () => {
    const label = 'reusable evidence index';
    const response = await probe(
      fetcher,
      config,
      label,
      `${config.roomOrigin}/evidence-library/search`,
      {
        method: 'POST',
        headers: { Origin: config.appOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Release preflight sentinel product',
          question: 'Is there reviewed evidence for this release preflight sentinel?',
        }),
      },
    );
    requireStatus(response, 200, label);
    requireHeader(response, 'Access-Control-Allow-Origin', config.appOrigin, label);
    requireHeaderIncludes(response, 'Cache-Control', 'no-store', label);
    const result = parseWithSchema(
      reusableEvidenceSearchResponseSchema,
      await jsonBody(response, label),
      label,
    );
    if (result.status !== 'complete') {
      throw probeError(label, 'D1 schema or binding unavailable');
    }
  });

  await step('public filming mission board', async () => {
    const label = 'public filming mission board';
    const response = await probe(fetcher, config, label, `${config.roomOrigin}/public-missions`, {
      headers: { Origin: config.appOrigin },
    });
    requireStatus(response, 200, label);
    requireHeader(response, 'Access-Control-Allow-Origin', config.appOrigin, label);
    requireHeaderIncludes(response, 'Cache-Control', 'no-store', label);
    parseWithSchema(publicEvidenceMissionListSchema, await jsonBody(response, label), label);
  });

  await step('buyer, mission board, and contributor pages', async () => {
    const buyerLabel = 'buyer page';
    const buyerResponse = await probe(fetcher, config, buyerLabel, `${config.appOrigin}/`);
    requireStatus(buyerResponse, 200, buyerLabel);
    requireMarker(
      await htmlBody(buyerResponse, buyerLabel),
      'If the web cannot prove it, ask someone with the product to film it.',
      buyerLabel,
    );
    requireAppSecurityPolicy(buyerResponse, buyerLabel, config.roomOrigin, {
      allowCamera: false,
      allowCreatorUpload: false,
      allowStreamPlayback: true,
    });

    const boardLabel = 'mission board page';
    const boardResponse = await probe(fetcher, config, boardLabel, `${config.appOrigin}/missions`);
    requireStatus(boardResponse, 200, boardLabel);
    requireMarker(
      await htmlBody(boardResponse, boardLabel),
      'Turn unanswered product questions into tiny public filming jobs.',
      boardLabel,
    );
    requireAppSecurityPolicy(boardResponse, boardLabel, config.roomOrigin, {
      allowCamera: false,
      allowCreatorUpload: false,
      allowStreamPlayback: false,
    });

    const contributorLabel = 'contributor page';
    const contributorResponse = await probe(
      fetcher,
      config,
      contributorLabel,
      `${config.appOrigin}/contribute/BCDF2345`,
    );
    requireStatus(contributorResponse, 200, contributorLabel);
    requireMarker(
      await htmlBody(contributorResponse, contributorLabel),
      'Product evidence network',
      contributorLabel,
    );
    requireAppSecurityPolicy(contributorResponse, contributorLabel, config.roomOrigin, {
      allowCamera: true,
      allowCreatorUpload: true,
      allowStreamPlayback: true,
    });
  });

  await step('evidence service browser boundary and durable case', async () => {
    const optionsLabel = 'evidence CORS preflight';
    const optionsResponse = await probe(
      fetcher,
      config,
      optionsLabel,
      `${config.roomOrigin}/evidence-cases`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: config.appOrigin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      },
    );
    requireStatus(optionsResponse, 204, optionsLabel);
    requireHeader(optionsResponse, 'Access-Control-Allow-Origin', config.appOrigin, optionsLabel);
    requireHeaderIncludes(optionsResponse, 'Access-Control-Allow-Methods', 'POST', optionsLabel);
    requireHeaderIncludes(
      optionsResponse,
      'Access-Control-Allow-Headers',
      'Content-Type',
      optionsLabel,
    );
    requireHeader(optionsResponse, 'Vary', 'Origin', optionsLabel);

    const hostileLabel = 'hostile-origin rejection';
    const hostileResponse = await probe(
      fetcher,
      config,
      hostileLabel,
      `${config.roomOrigin}/evidence-cases`,
      {
        method: 'POST',
        headers: { Origin: 'https://untrusted.invalid', 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: 'travel_bottle' }),
      },
    );
    requireStatus(hostileResponse, 403, hostileLabel);

    const createLabel = 'disposable evidence case';
    const createResponse = await probe(
      fetcher,
      config,
      createLabel,
      `${config.roomOrigin}/evidence-cases`,
      {
        method: 'POST',
        headers: { Origin: config.appOrigin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: 'travel_bottle' }),
      },
    );
    requireStatus(createResponse, 201, createLabel);
    requireHeader(createResponse, 'Access-Control-Allow-Origin', config.appOrigin, createLabel);
    const credentials = parseWithSchema(
      remoteEvidenceCaseCredentialsSchema,
      await jsonBody(createResponse, createLabel),
      createLabel,
    );

    const readLabel = 'durable evidence case read-back';
    const readResponse = await probe(
      fetcher,
      config,
      readLabel,
      `${config.roomOrigin}/evidence-cases/${encodeURIComponent(credentials.caseId)}/snapshot`,
      { headers: { Origin: config.appOrigin } },
    );
    requireStatus(readResponse, 200, readLabel);
    requireHeader(readResponse, 'Access-Control-Allow-Origin', config.appOrigin, readLabel);
    const snapshot = parseWithSchema(
      remoteEvidenceCaseSnapshotSchema,
      await jsonBody(readResponse, readLabel),
      readLabel,
    );
    if (
      snapshot.caseId !== credentials.caseId ||
      snapshot.state.revision !== credentials.state.revision
    ) {
      throw probeError(readLabel, 'created case did not survive read-back');
    }
  });

  if (roomVersion === null) throw probeError('release report', 'missing worker version');
  return { ok: true, commit: config.expectedCommit, workerVersion: roomVersion, steps };
}
