import { z } from 'zod';

import { isPublicHttpUrl } from '../../src/lib/evidence-network/url-policy';
import { findReusableEvidenceByStreamUid } from './evidence-library';

export interface StreamPlaybackWorkerEnv {
  readonly ALLOWED_ORIGINS: string;
  readonly PUBLIC_EVIDENCE_ORIGIN: string;
  readonly STREAM?: StreamBinding;
  readonly STREAM_OUTBOUND?: Fetcher;
  readonly EVIDENCE_LIBRARY?: D1Database;
}

interface StreamPlaybackUsageRow {
  readonly tokens: number;
}

const streamUidPattern = /^[a-zA-Z0-9_-]{16,128}$/;
const signedStreamTokenPattern = /^[a-zA-Z0-9._~-]{32,4096}$/;
const streamPlaybackPathPattern = /^\/evidence-library\/videos\/([a-zA-Z0-9_-]{16,128})$/;
const streamPlaybackTokenResponseSchema = z.strictObject({
  token: z.string().regex(signedStreamTokenPattern),
  previewUrl: z.url(),
});

export const streamPlaybackDailyTokenLimit = 60;

function utcDay(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function publicEvidenceOrigin(value: string): URL {
  const url = new URL(value);
  if (
    !isPublicHttpUrl(url.toString()) ||
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.search.length > 0 ||
    url.hash.length > 0 ||
    (url.pathname !== '' && url.pathname !== '/')
  ) {
    throw new Error('PUBLIC_EVIDENCE_ORIGIN must be an exact public HTTPS origin.');
  }
  return url;
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

function protectedPlaybackOrigins(env: StreamPlaybackWorkerEnv): readonly string[] {
  return [
    ...new Set([
      ...streamAllowedOriginDomains(env.ALLOWED_ORIGINS),
      publicEvidenceOrigin(env.PUBLIC_EVIDENCE_ORIGIN).hostname,
    ]),
  ];
}

export function reusableEvidencePlaybackUrl(
  env: Pick<StreamPlaybackWorkerEnv, 'PUBLIC_EVIDENCE_ORIGIN'>,
  streamUid: string,
): string {
  if (!streamUidPattern.test(streamUid)) {
    throw new Error('A valid Stream video identifier is required.');
  }
  return new URL(
    `/evidence-library/videos/${encodeURIComponent(streamUid)}`,
    publicEvidenceOrigin(env.PUBLIC_EVIDENCE_ORIGIN),
  ).toString();
}

export async function protectReusableStreamVideo(
  env: StreamPlaybackWorkerEnv,
  streamUid: string,
): Promise<void> {
  if (!streamUidPattern.test(streamUid)) {
    throw new Error('A valid Stream video identifier is required.');
  }
  const allowedOrigins = protectedPlaybackOrigins(env);
  if (env.STREAM_OUTBOUND !== undefined) {
    const response = await env.STREAM_OUTBOUND.fetch(
      `https://stream.test/videos/${streamUid}/privacy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedOrigins, requireSignedURLs: true }),
      },
    );
    if (!response.ok) {
      throw new Error(`Cloudflare Stream privacy update failed with ${response.status}.`);
    }
    return;
  }
  if (env.STREAM === undefined) {
    throw new Error('Cloudflare Stream is not configured for this environment.');
  }
  await env.STREAM.video(streamUid).update({
    allowedOrigins: [...allowedOrigins],
    requireSignedURLs: true,
  });
}

export async function restoreUnpublishedStreamVideo(
  env: StreamPlaybackWorkerEnv,
  streamUid: string,
): Promise<void> {
  if (!streamUidPattern.test(streamUid)) {
    throw new Error('A valid Stream video identifier is required.');
  }
  const allowedOrigins = streamAllowedOriginDomains(env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    throw new Error('Cloudflare Stream needs at least one valid playback origin.');
  }
  if (env.STREAM_OUTBOUND !== undefined) {
    const response = await env.STREAM_OUTBOUND.fetch(
      `https://stream.test/videos/${streamUid}/privacy`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedOrigins, requireSignedURLs: false }),
      },
    );
    if (!response.ok) {
      throw new Error(`Cloudflare Stream privacy restoration failed with ${response.status}.`);
    }
    return;
  }
  if (env.STREAM === undefined) {
    throw new Error('Cloudflare Stream is not configured for this environment.');
  }
  await env.STREAM.video(streamUid).update({
    allowedOrigins: [...allowedOrigins],
    requireSignedURLs: false,
  });
}

function signedPlayerUrl(streamUid: string, token: string, previewUrl: string, start: number): URL {
  if (!streamUidPattern.test(streamUid) || !signedStreamTokenPattern.test(token)) {
    throw new Error('Cloudflare Stream returned an invalid signed playback token.');
  }
  const preview = new URL(previewUrl);
  if (
    preview.protocol !== 'https:' ||
    preview.username.length > 0 ||
    preview.password.length > 0 ||
    !/^customer-[a-z0-9-]+\.cloudflarestream\.com$/iu.test(preview.hostname) ||
    preview.pathname !== `/${streamUid}/watch`
  ) {
    throw new Error('Cloudflare Stream returned an invalid preview origin.');
  }
  const player = new URL(`https://${preview.hostname}/${token}/iframe`);
  player.searchParams.set('preload', 'metadata');
  if (start > 0) {
    player.searchParams.set('startTime', String(start));
  }
  return player;
}

async function createSignedPlayerUrl(
  env: StreamPlaybackWorkerEnv,
  streamUid: string,
  start: number,
): Promise<URL> {
  if (env.STREAM_OUTBOUND !== undefined) {
    const response = await env.STREAM_OUTBOUND.fetch(
      `https://stream.test/videos/${streamUid}/token`,
      { method: 'POST' },
    );
    if (!response.ok) {
      throw new Error(`Cloudflare Stream token generation failed with ${response.status}.`);
    }
    const result = streamPlaybackTokenResponseSchema.parse(await response.json());
    return signedPlayerUrl(streamUid, result.token, result.previewUrl, start);
  }
  if (env.STREAM === undefined) {
    throw new Error('Cloudflare Stream is not configured for this environment.');
  }
  const video = env.STREAM.video(streamUid);
  const [details, token] = await Promise.all([video.details(), video.generateToken()]);
  if (details.preview === null || details.preview === undefined) {
    throw new Error('Cloudflare Stream has not exposed a playback origin yet.');
  }
  return signedPlayerUrl(streamUid, token, details.preview, start);
}

async function reserveDailyPlaybackToken(database: D1Database, day: string): Promise<boolean> {
  const row = await database
    .prepare(
      `INSERT INTO stream_playback_daily_usage (day, tokens)
       VALUES (?, 1)
       ON CONFLICT(day) DO UPDATE SET tokens = tokens + 1
       WHERE tokens < ?
       RETURNING tokens`,
    )
    .bind(day, streamPlaybackDailyTokenLimit)
    .first<StreamPlaybackUsageRow>();
  return row !== null && row.tokens <= streamPlaybackDailyTokenLimit;
}

export async function deleteExpiredStreamPlaybackUsage(
  database: D1Database,
  currentDay = utcDay(),
): Promise<number> {
  const result = await database
    .prepare('DELETE FROM stream_playback_daily_usage WHERE day < ?')
    .bind(currentDay)
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the Stream playback usage purge.');
  }
  return result.meta.changes;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderStreamPlaybackPage(
  playerUrl: URL,
  productName: string,
  observation: string,
  citationStartSeconds: number,
  citationEndSeconds: number,
): Response {
  const playerOrigin = playerUrl.origin;
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Reviewed video evidence · Film the Gap</title>
  <style>
    :root{color-scheme:dark;font-family:ui-sans-serif,system-ui,sans-serif;background:#090b0f;color:#f7f7f2}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,#253547,#090b0f 58%)}
    main{width:min(800px,calc(100% - 32px));padding:24px 0 36px}
    small{color:#9de0c4;text-transform:uppercase;letter-spacing:.12em;font-weight:700}
    h1{font-size:clamp(1.6rem,4vw,2.8rem);margin:.45rem 0 1rem}
    iframe{display:block;width:100%;aspect-ratio:16/9;border:1px solid #ffffff26;border-radius:18px;background:#000;box-shadow:0 24px 80px #0008}
    blockquote{margin:16px 0 6px;padding-left:16px;border-left:3px solid #9de0c4;font-size:1.05rem;line-height:1.5}
    p{color:#c7cbd1;line-height:1.55}
  </style>
</head>
<body>
  <main>
    <small>Private, signed Cloudflare Stream playback</small>
    <h1>${escapeHtml(productName)}</h1>
    <iframe src="${escapeHtml(playerUrl.toString())}" title="Reviewed product evidence video" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
    <blockquote>${escapeHtml(observation)}</blockquote>
    <p>Cited interval: ${citationStartSeconds}–${citationEndSeconds}s. Playback opens at the cited moment; the signed media token expires automatically.</p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': `default-src 'none'; frame-src ${playerOrigin}; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'Content-Type': 'text/html; charset=utf-8',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

function jsonResponse(body: object, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function routeStreamPlaybackRequest(
  request: Request,
  env: StreamPlaybackWorkerEnv,
): Promise<Response | null> {
  const url = new URL(request.url);
  const match = streamPlaybackPathPattern.exec(url.pathname);
  if (match === null) {
    return null;
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }
  let configuredOrigin: URL;
  try {
    configuredOrigin = publicEvidenceOrigin(env.PUBLIC_EVIDENCE_ORIGIN);
  } catch {
    return jsonResponse({ error: 'stream_playback_not_configured' }, 503);
  }
  if (url.origin !== configuredOrigin.origin) {
    return jsonResponse({ error: 'unexpected_playback_origin' }, 421);
  }
  const streamUid = match[1];
  if (streamUid === undefined || env.EVIDENCE_LIBRARY === undefined) {
    return jsonResponse({ error: 'evidence_video_not_found' }, 404);
  }
  const record = await findReusableEvidenceByStreamUid(env.EVIDENCE_LIBRARY, streamUid);
  if (record === null) {
    return jsonResponse({ error: 'evidence_video_not_found' }, 404);
  }
  if (!(await reserveDailyPlaybackToken(env.EVIDENCE_LIBRARY, utcDay()))) {
    return jsonResponse({ error: 'stream_playback_daily_budget_exhausted' }, 429);
  }
  try {
    const playerUrl = await createSignedPlayerUrl(
      env,
      streamUid,
      record.observation.citationStartSeconds,
    );
    return renderStreamPlaybackPage(
      playerUrl,
      record.productName,
      record.observation.text,
      record.observation.citationStartSeconds,
      record.observation.citationEndSeconds,
    );
  } catch (error: unknown) {
    console.error('Cloudflare Stream signed playback failed', error);
    return jsonResponse({ error: 'stream_playback_unavailable' }, 503);
  }
}
