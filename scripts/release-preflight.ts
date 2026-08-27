import { z } from 'zod';

import {
  merchantServerName,
  merchantServerVersion,
  ucpProtocolVersion as merchantUcpProtocolVersion,
} from '../merchant-worker/src/protocol.ts';
import {
  remoteRoomProtocolVersion,
  roomCredentialsSchema,
} from '../src/lib/live-market/remote-room-protocol.ts';
import {
  ucpDiscoveryProfileSchema,
  ucpProtocolVersion,
  ucpShoppingServiceName,
} from '../src/lib/ucp/profile.ts';

export interface ReleaseConfig {
  readonly appOrigin: string;
  readonly roomOrigin: string;
  readonly merchantOrigin: string;
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
  readonly workerVersions: {
    readonly room: ReleaseWorkerVersion;
    readonly merchant: ReleaseWorkerVersion;
  };
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
  protocolVersion: z.literal(remoteRoomProtocolVersion),
  ucpCommerceConfigured: z.literal(true),
  workerVersion: workerVersionSchema,
});

const merchantHealthSchema = z.strictObject({
  ok: z.literal(true),
  service: z.literal(merchantServerName),
  version: z.literal(merchantServerVersion),
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
  const merchantOrigin = releaseOrigin(environment, 'EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN');
  if (new Set([appOrigin, roomOrigin, merchantOrigin]).size !== 3) {
    throw new Error('Release app, room, and merchant origins must be distinct.');
  }
  return {
    appOrigin,
    roomOrigin,
    merchantOrigin,
    expectedCommit: releaseCommit(environment),
    timeoutMs: releaseTimeout(environment),
  };
}

function probeError(label: string, detail?: string): Error {
  return new Error(`Release probe failed: ${label}${detail === undefined ? '.' : ` (${detail}).`}`);
}

function contentLengthWithin(response: Response, maximumBytes: number, label: string): void {
  const rawLength = response.headers.get('Content-Length');
  if (rawLength === null) {
    return;
  }
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
  if (bytes.byteLength > maximumBytes) {
    throw probeError(label, 'response too large');
  }
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
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
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
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/html')) {
    throw probeError(label, 'expected HTML');
  }
  return boundedBody(response, maximumHtmlBytes, label);
}

function requireStatus(response: Response, expected: number, label: string): void {
  if (response.status !== expected) {
    throw probeError(label, `HTTP ${response.status}`);
  }
}

function parseWithSchema<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw probeError(label, 'invalid response contract');
  }
  return result.data;
}

function requireHeader(response: Response, name: string, expected: string, label: string): void {
  if (response.headers.get(name) !== expected) {
    throw probeError(label, `${name} mismatch`);
  }
}

function requireHeaderIncludes(
  response: Response,
  name: string,
  expected: string,
  label: string,
): void {
  if (!response.headers.get(name)?.includes(expected)) {
    throw probeError(label, `${name} mismatch`);
  }
}

function requireMarker(body: string, marker: string, label: string): void {
  if (!body.includes(marker)) {
    throw probeError(label, 'expected page marker missing');
  }
}

function requireAppSecurityPolicy(
  response: Response,
  label: string,
  roomOrigin: string,
  allowCamera: boolean,
): void {
  const websocketOrigin = roomOrigin.replace(/^https:/, 'wss:');
  requireHeaderIncludes(response, 'Content-Security-Policy', "default-src 'self'", label);
  requireHeaderIncludes(response, 'Content-Security-Policy', `connect-src 'self'`, label);
  requireHeaderIncludes(response, 'Content-Security-Policy', roomOrigin, label);
  requireHeaderIncludes(response, 'Content-Security-Policy', websocketOrigin, label);
  requireHeaderIncludes(response, 'Content-Security-Policy', "object-src 'none'", label);
  requireHeaderIncludes(response, 'Content-Security-Policy', "frame-ancestors 'none'", label);
  requireHeaderIncludes(
    response,
    'Permissions-Policy',
    allowCamera ? 'camera=(self)' : 'camera=()',
    label,
  );
  requireHeaderIncludes(response, 'Permissions-Policy', 'microphone=()', label);
  requireHeaderIncludes(response, 'Permissions-Policy', 'payment=()', label);
  requireHeader(response, 'Referrer-Policy', 'no-referrer', label);
  requireHeader(response, 'X-Content-Type-Options', 'nosniff', label);
}

function validateUcpProfile(value: unknown, expectedEndpoint: string | null, label: string): void {
  const profileResult = ucpDiscoveryProfileSchema.safeParse(value);
  if (!profileResult.success) {
    throw probeError(label, 'invalid UCP discovery profile');
  }
  const profile = profileResult.data;
  if (profile.ucp.version !== ucpProtocolVersion) {
    throw probeError(label, 'unexpected UCP version');
  }
  const services = profile.ucp.services[ucpShoppingServiceName];
  if (services === undefined || services.length === 0) {
    throw probeError(label, 'shopping service missing');
  }
  if (
    expectedEndpoint !== null &&
    !services.some(
      (service) =>
        service.version === ucpProtocolVersion &&
        service.transport === 'mcp' &&
        service.endpoint === expectedEndpoint,
    )
  ) {
    throw probeError(label, 'merchant MCP endpoint mismatch');
  }
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
  let merchantVersion: ReleaseWorkerVersion | null = null;

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

  await step('room health and commit', async () => {
    const label = 'room health and commit';
    const response = await probe(fetcher, config, label, `${config.roomOrigin}/healthz`);
    requireStatus(response, 200, label);
    requireHeaderIncludes(response, 'Cache-Control', 'no-store', label);
    const health = parseWithSchema(roomHealthSchema, await jsonBody(response, label), label);
    validateWorkerVersion(health.workerVersion, config.expectedCommit, label);
    roomVersion = health.workerVersion;
  });

  await step('merchant health and commit', async () => {
    const label = 'merchant health and commit';
    const response = await probe(fetcher, config, label, `${config.merchantOrigin}/health`);
    requireStatus(response, 200, label);
    requireHeaderIncludes(response, 'Cache-Control', 'no-store', label);
    const health = parseWithSchema(merchantHealthSchema, await jsonBody(response, label), label);
    validateWorkerVersion(health.workerVersion, config.expectedCommit, label);
    merchantVersion = health.workerVersion;
  });

  await step('UCP discovery alignment', async () => {
    const appLabel = 'app UCP discovery';
    const appResponse = await probe(
      fetcher,
      config,
      appLabel,
      `${config.appOrigin}/.well-known/ucp`,
    );
    requireStatus(appResponse, 200, appLabel);
    validateUcpProfile(await jsonBody(appResponse, appLabel), null, appLabel);

    const merchantLabel = 'merchant UCP discovery';
    const merchantResponse = await probe(
      fetcher,
      config,
      merchantLabel,
      `${config.merchantOrigin}/.well-known/ucp`,
    );
    requireStatus(merchantResponse, 200, merchantLabel);
    validateUcpProfile(
      await jsonBody(merchantResponse, merchantLabel),
      `${config.merchantOrigin}/api/ucp/mcp`,
      merchantLabel,
    );
  });

  await step('judge pages and merchant policy', async () => {
    const appLabel = 'buyer page';
    const appResponse = await probe(fetcher, config, appLabel, `${config.appOrigin}/`);
    requireStatus(appResponse, 200, appLabel);
    requireMarker(await htmlBody(appResponse, appLabel), 'Agent-attended market', appLabel);
    requireAppSecurityPolicy(appResponse, appLabel, config.roomOrigin, false);

    const hostLabel = 'host page';
    const hostResponse = await probe(fetcher, config, hostLabel, `${config.appOrigin}/host`);
    requireStatus(hostResponse, 200, hostLabel);
    requireMarker(await htmlBody(hostResponse, hostLabel), 'Host evidence console', hostLabel);
    requireAppSecurityPolicy(hostResponse, hostLabel, config.roomOrigin, true);

    const merchantLabel = 'merchant product page';
    const merchantResponse = await probe(
      fetcher,
      config,
      merchantLabel,
      `${config.merchantOrigin}/products/live-inspected-board`,
    );
    requireStatus(merchantResponse, 200, merchantLabel);
    requireMarker(
      await htmlBody(merchantResponse, merchantLabel),
      'Evidence Market',
      merchantLabel,
    );
    requireHeaderIncludes(
      merchantResponse,
      'Content-Security-Policy',
      "default-src 'none'",
      merchantLabel,
    );
    requireHeaderIncludes(merchantResponse, 'Permissions-Policy', 'camera=()', merchantLabel);
    requireHeaderIncludes(merchantResponse, 'Permissions-Policy', 'microphone=()', merchantLabel);
    requireHeaderIncludes(merchantResponse, 'Permissions-Policy', 'payment=()', merchantLabel);
    requireHeader(merchantResponse, 'Referrer-Policy', 'no-referrer', merchantLabel);
  });

  await step('room browser boundary', async () => {
    const optionsLabel = 'room CORS preflight';
    const optionsResponse = await probe(
      fetcher,
      config,
      optionsLabel,
      `${config.roomOrigin}/rooms`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: config.appOrigin,
          'Access-Control-Request-Method': 'POST',
        },
      },
    );
    requireStatus(optionsResponse, 204, optionsLabel);
    requireHeader(optionsResponse, 'Access-Control-Allow-Origin', config.appOrigin, optionsLabel);
    requireHeaderIncludes(optionsResponse, 'Access-Control-Allow-Methods', 'POST', optionsLabel);
    requireHeader(optionsResponse, 'Vary', 'Origin', optionsLabel);

    const createLabel = 'disposable room creation';
    const createResponse = await probe(fetcher, config, createLabel, `${config.roomOrigin}/rooms`, {
      method: 'POST',
      headers: { Origin: config.appOrigin },
    });
    requireStatus(createResponse, 201, createLabel);
    requireHeader(createResponse, 'Access-Control-Allow-Origin', config.appOrigin, createLabel);
    parseWithSchema(
      roomCredentialsSchema,
      await jsonBody(createResponse, createLabel),
      createLabel,
    );
  });

  if (roomVersion === null || merchantVersion === null) {
    throw probeError('release report', 'missing worker version');
  }
  if (merchantUcpProtocolVersion !== ucpProtocolVersion) {
    throw probeError('release report', 'source UCP versions disagree');
  }
  return {
    ok: true,
    commit: config.expectedCommit,
    workerVersions: { room: roomVersion, merchant: merchantVersion },
    steps,
  };
}
