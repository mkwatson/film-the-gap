import { z } from 'zod';

import {
  knownPageReadRequestSchema,
  knownPageReadResponseSchema,
  type KnownPageReadResponse,
} from '../../src/lib/evidence-network/known-page-reader';

const pageReaderDailyLimit = 60;
const browserTimeoutMilliseconds = 8_000;
const browserCacheTtlSeconds = 24 * 60 * 60;
const browserReceiptLimitBytes = 2 * 1024 * 1024;
const readerRequestLimitBytes = 2 * 1024;

const browserRunResponseSchema = z.object({
  success: z.literal(true),
  result: z.string(),
  meta: z.object({
    status: z.number().int(),
    title: z.string().optional(),
    finalUrl: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
  }),
});

interface PageReaderUsageRow {
  readonly calls: number;
}

export interface KnownPageReaderWorkerEnv {
  readonly BROWSER?: BrowserRun;
  readonly PAGE_READER_OUTBOUND?: Fetcher;
  readonly PAGE_READER_SHARED_SECRET?: string;
  readonly EVIDENCE_LIBRARY?: D1Database;
}

function jsonResponse(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization');
  if (authorization === null || !authorization.startsWith('Bearer ')) {
    return null;
  }
  const token = authorization.slice('Bearer '.length).trim();
  return token.length === 0 ? null : token;
}

async function secretMatches(actual: string | null, expected: string): Promise<boolean> {
  if (actual === null) {
    return false;
  }
  const encoder = new TextEncoder();
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(actual)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const actualBytes = new Uint8Array(actualDigest);
  const expectedBytes = new Uint8Array(expectedDigest);
  let difference = actualBytes.length ^ expectedBytes.length;
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= (actualBytes[index] ?? 0) ^ (expectedBytes[index] ?? 0);
  }
  return difference === 0;
}

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function reserveDailyPageRead(database: D1Database, day: string): Promise<boolean> {
  const row = await database
    .prepare(
      `INSERT INTO page_reader_daily_usage (day, calls)
       VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET calls = calls + 1
       WHERE calls < ?
       RETURNING calls`,
    )
    .bind(day, pageReaderDailyLimit)
    .first<PageReaderUsageRow>();
  return row !== null && row.calls <= pageReaderDailyLimit;
}

export async function deleteExpiredPageReaderUsage(
  database: D1Database,
  currentDay = utcDay(),
): Promise<number> {
  const result = await database
    .prepare('DELETE FROM page_reader_daily_usage WHERE day < ?')
    .bind(currentDay)
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the page-reader usage purge.');
  }
  return result.meta.changes;
}

function regexLiteral(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replaceAll('/', '\\/');
}

function sameOriginRequestPattern(url: URL): string {
  return `/^${regexLiteral(url.origin)}\\//`;
}

async function readBoundedJson(
  body: ReadableStream<Uint8Array> | null,
  declaredLength: string | null,
  limitBytes: number,
): Promise<unknown | null> {
  const parsedLength = Number(declaredLength);
  if (Number.isFinite(parsedLength) && parsedLength > limitBytes) {
    await body?.cancel();
    return null;
  }
  if (body === null) {
    return null;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        break;
      }
      totalBytes += chunk.value.byteLength;
      if (totalBytes > limitBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(chunk.value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

async function runBrowserMarkdown(
  env: KnownPageReaderWorkerEnv,
  url: string,
): Promise<Response | null> {
  const target = new URL(url);
  const options: BrowserRunMarkdownOptions = {
    url,
    allowRequestPattern: [sameOriginRequestPattern(target)],
    rejectResourceTypes: [
      'stylesheet',
      'image',
      'media',
      'font',
      'texttrack',
      'prefetch',
      'eventsource',
      'websocket',
      'manifest',
      'signedexchange',
      'ping',
      'cspviolationreport',
    ],
    setExtraHTTPHeaders: { Accept: 'text/markdown, text/html;q=0.9' },
    gotoOptions: {
      timeout: browserTimeoutMilliseconds,
      waitUntil: 'domcontentloaded',
    },
    actionTimeout: browserTimeoutMilliseconds,
    bestAttempt: true,
    cacheTTL: browserCacheTtlSeconds,
  };
  if (env.PAGE_READER_OUTBOUND !== undefined) {
    return env.PAGE_READER_OUTBOUND.fetch('https://page-reader.internal/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
  }
  return env.BROWSER?.quickAction('markdown', options) ?? null;
}

function compactPageExcerpt(markdown: string): string {
  return markdown
    .replace(/^---\s*[\s\S]*?\s*---\s*/u, '')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/^[#>*_`~-]+/gmu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, 320);
}

function contentSignal(headers: Readonly<Record<string, string>> | undefined): string | null {
  if (headers === undefined) {
    return null;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'content-signal') {
      const compact = value.replace(/\s+/gu, ' ').trim().slice(0, 200);
      return compact.length === 0 ? null : compact;
    }
  }
  return null;
}

function contentSignalPermitsEvidence(signal: string | null): boolean {
  if (signal === null) {
    return true;
  }
  const directives = new Map(
    signal.split(',').flatMap((directive) => {
      const [rawName, rawValue] = directive.split('=', 2);
      const name = rawName?.trim().toLowerCase();
      const value = rawValue?.trim().toLowerCase();
      return name === undefined || value === undefined ? [] : [[name, value] as const];
    }),
  );
  return directives.get('search') !== 'no' && directives.get('ai-input') !== 'no';
}

function unavailable(requestedUrl: string, warning: string): KnownPageReadResponse {
  return knownPageReadResponseSchema.parse({
    reader: 'cloudflare_browser_run',
    status: 'unavailable',
    requestedUrl,
    warning,
  });
}

async function readProductPage(
  requestedUrl: string,
  env: KnownPageReaderWorkerEnv,
): Promise<KnownPageReadResponse> {
  let response: Response | null;
  try {
    response = await runBrowserMarkdown(env, requestedUrl);
  } catch {
    return unavailable(requestedUrl, 'Cloudflare Browser Run could not read this product page.');
  }
  if (response === null || !response.ok) {
    return unavailable(requestedUrl, 'Cloudflare Browser Run could not read this product page.');
  }
  const payload = await readBoundedJson(
    response.body,
    response.headers.get('Content-Length'),
    browserReceiptLimitBytes,
  );
  if (payload === null) {
    return unavailable(requestedUrl, 'Cloudflare Browser Run returned an invalid page receipt.');
  }
  const parsed = browserRunResponseSchema.safeParse(payload);
  if (!parsed.success || parsed.data.meta.status < 200 || parsed.data.meta.status >= 400) {
    return unavailable(requestedUrl, 'The supplied product page did not return readable content.');
  }
  const finalUrl = parsed.data.meta.finalUrl ?? requestedUrl;
  let final: URL;
  try {
    final = new URL(finalUrl);
  } catch {
    return unavailable(requestedUrl, 'The product-page reader returned an invalid final URL.');
  }
  if (final.origin !== new URL(requestedUrl).origin) {
    return unavailable(requestedUrl, 'The product page redirected outside its approved origin.');
  }
  const excerpt = compactPageExcerpt(parsed.data.result);
  if (excerpt.length === 0) {
    return unavailable(requestedUrl, 'The supplied product page contained no readable page text.');
  }
  const headerMilliseconds = Number(response.headers.get('X-Browser-Ms-Used'));
  const browserMilliseconds =
    Number.isInteger(headerMilliseconds) && headerMilliseconds >= 0
      ? Math.min(headerMilliseconds, 120_000)
      : null;
  const originContentSignal = contentSignal(parsed.data.meta.headers);
  if (!contentSignalPermitsEvidence(originContentSignal)) {
    return unavailable(
      requestedUrl,
      'The origin content signal does not permit this page to be used for evidence search.',
    );
  }
  return knownPageReadResponseSchema.parse({
    reader: 'cloudflare_browser_run',
    status: 'complete',
    requestedUrl,
    finalUrl,
    title: (parsed.data.meta.title?.trim() || final.hostname).slice(0, 240),
    excerpt,
    contentSignal: originContentSignal,
    browserMilliseconds,
  });
}

export async function routeKnownPageReaderRequest(
  request: Request,
  env: KnownPageReaderWorkerEnv,
): Promise<Response | null> {
  if (new URL(request.url).pathname !== '/product-page-reader') {
    return null;
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }
  if (!(
    request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json') ?? false
  )) {
    return jsonResponse({ error: 'application_json_required' }, 415);
  }
  const secret = env.PAGE_READER_SHARED_SECRET?.trim();
  if (secret === undefined || secret.length < 24 || env.EVIDENCE_LIBRARY === undefined) {
    return jsonResponse({ error: 'page_reader_not_configured' }, 503);
  }
  if (!(await secretMatches(bearerToken(request), secret))) {
    return jsonResponse({ error: 'invalid_page_reader_authorization' }, 401);
  }
  const input = await readBoundedJson(
    request.body,
    request.headers.get('Content-Length'),
    readerRequestLimitBytes,
  );
  if (input === null) {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  const parsed = knownPageReadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return jsonResponse({ error: 'invalid_product_page', issues: parsed.error.issues }, 400);
  }
  if (!(await reserveDailyPageRead(env.EVIDENCE_LIBRARY, utcDay()))) {
    return jsonResponse({ error: 'page_reader_daily_budget_exhausted' }, 429);
  }
  return jsonResponse(await readProductPage(parsed.data.url, env));
}

export const knownPageReaderWorkerRuntime = {
  pageReaderDailyLimit,
  browserTimeoutMilliseconds,
  browserCacheTtlSeconds,
  browserReceiptLimitBytes,
  readerRequestLimitBytes,
} as const;
