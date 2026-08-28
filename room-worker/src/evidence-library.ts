import {
  productQuestionInputSchema,
  reusableEvidenceRecordSchema,
  reusableEvidenceSearchResponseSchema,
  type ProductQuestionInput,
  type ReusableEvidenceRecord,
  type ReusableEvidenceSearchResponse,
} from '../../src/lib/evidence-network/model';
import { canonicalizePublicDiscoveryUrl } from '../../src/lib/evidence-network/url-policy';

interface EvidenceLibraryRow {
  readonly evidence_id: string;
  readonly product_name: string;
  readonly product_url: string | null;
  readonly question: string;
  readonly source_title: string;
  readonly video_url: string;
  readonly rights: 'owned' | 'authorized';
  readonly provenance: 'live_capture' | 'authorized_import';
  readonly continuity: 'continuous' | 'edited' | 'unknown';
  readonly capture_timing:
    'mission_challenge_verified' | 'contributor_attested' | 'preexisting' | 'unknown';
  readonly contributor_label: string;
  readonly captured_at: string;
  readonly stream_uid: string;
  readonly sha256: string;
  readonly duration_seconds: number;
  readonly result: 'supports' | 'contradicts' | 'inconclusive';
  readonly confidence: 'low' | 'medium' | 'high';
  readonly observation_text: string;
  readonly citation_start_seconds: number;
  readonly citation_end_seconds: number;
  readonly reviewed_at: string;
  readonly indexed_at: string;
  readonly expires_at: string;
}

const maximumReusableEvidenceResults = 4;

export async function deleteExpiredReusableEvidence(
  database: D1Database,
  now = new Date().toISOString(),
): Promise<number> {
  const result = await database
    .prepare('DELETE FROM reusable_evidence WHERE expires_at <= ?')
    .bind(now)
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the expired evidence purge.');
  }
  return result.meta.changes;
}

export function normalizeEvidenceMatchText(value: string): string {
  return value
    .replace(/[©®™]/g, '')
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function productUrlKey(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return canonicalizePublicDiscoveryUrl(value);
}

function rowToRecord(row: EvidenceLibraryRow): ReusableEvidenceRecord {
  return reusableEvidenceRecordSchema.parse({
    id: row.evidence_id,
    productName: row.product_name,
    productUrl: row.product_url,
    question: row.question,
    source: {
      title: row.source_title,
      videoUrl: row.video_url,
      rights: row.rights,
      provenance: row.provenance,
      continuity: row.continuity,
      captureTiming: row.capture_timing,
      contributorLabel: row.contributor_label,
      capturedAt: row.captured_at,
      streamUid: row.stream_uid,
      sha256: row.sha256,
      durationSeconds: row.duration_seconds,
    },
    observation: {
      result: row.result,
      confidence: row.confidence,
      text: row.observation_text,
      citationStartSeconds: row.citation_start_seconds,
      citationEndSeconds: row.citation_end_seconds,
      reviewedAt: row.reviewed_at,
    },
    indexedAt: row.indexed_at,
    expiresAt: row.expires_at,
  });
}

export async function indexReusableEvidence(
  database: D1Database,
  input: ReusableEvidenceRecord,
): Promise<void> {
  const record = reusableEvidenceRecordSchema.parse(input);
  const result = await database
    .prepare(
      `INSERT INTO reusable_evidence (
        evidence_id,
        product_name,
        product_name_key,
        product_url,
        product_url_key,
        question,
        question_key,
        source_title,
        video_url,
        rights,
        provenance,
        continuity,
        capture_timing,
        contributor_label,
        captured_at,
        stream_uid,
        sha256,
        duration_seconds,
        result,
        confidence,
        observation_text,
        citation_start_seconds,
        citation_end_seconds,
        reviewed_at,
        indexed_at,
        expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stream_uid) DO UPDATE SET
        evidence_id = excluded.evidence_id,
        product_name = excluded.product_name,
        product_name_key = excluded.product_name_key,
        product_url = excluded.product_url,
        product_url_key = excluded.product_url_key,
        question = excluded.question,
        question_key = excluded.question_key,
        source_title = excluded.source_title,
        video_url = excluded.video_url,
        rights = excluded.rights,
        provenance = excluded.provenance,
        continuity = excluded.continuity,
        capture_timing = excluded.capture_timing,
        contributor_label = excluded.contributor_label,
        captured_at = excluded.captured_at,
        sha256 = excluded.sha256,
        duration_seconds = excluded.duration_seconds,
        result = excluded.result,
        confidence = excluded.confidence,
        observation_text = excluded.observation_text,
        citation_start_seconds = excluded.citation_start_seconds,
        citation_end_seconds = excluded.citation_end_seconds,
        reviewed_at = excluded.reviewed_at,
        indexed_at = excluded.indexed_at,
        expires_at = excluded.expires_at
      WHERE reusable_evidence.indexed_at <= excluded.indexed_at`,
    )
    .bind(
      record.id,
      record.productName,
      normalizeEvidenceMatchText(record.productName),
      record.productUrl,
      productUrlKey(record.productUrl),
      record.question,
      normalizeEvidenceMatchText(record.question),
      record.source.title,
      record.source.videoUrl,
      record.source.rights,
      record.source.provenance,
      record.source.continuity,
      record.source.captureTiming,
      record.source.contributorLabel,
      record.source.capturedAt,
      record.source.streamUid,
      record.source.sha256,
      record.source.durationSeconds,
      record.observation.result,
      record.observation.confidence,
      record.observation.text,
      record.observation.citationStartSeconds,
      record.observation.citationEndSeconds,
      record.observation.reviewedAt,
      record.indexedAt,
      record.expiresAt,
    )
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the reusable evidence write.');
  }
}

export async function searchReusableEvidence(
  database: D1Database,
  input: ProductQuestionInput,
  now = new Date().toISOString(),
): Promise<readonly ReusableEvidenceRecord[]> {
  const question = productQuestionInputSchema.parse(input);
  const canonicalProductUrl = productUrlKey(question.productUrl);
  const session = database.withSession('first-primary');
  const result = await session
    .prepare(
      `SELECT
        evidence_id,
        product_name,
        product_url,
        question,
        source_title,
        video_url,
        rights,
        provenance,
        continuity,
        capture_timing,
        contributor_label,
        captured_at,
        stream_uid,
        sha256,
        duration_seconds,
        result,
        confidence,
        observation_text,
        citation_start_seconds,
        citation_end_seconds,
        reviewed_at,
        indexed_at,
        expires_at
      FROM reusable_evidence
      WHERE question_key = ?
        AND expires_at > ?
        AND (
          (? IS NOT NULL AND product_url_key = ?)
          OR (? IS NULL AND product_name_key = ?)
        )
      ORDER BY
        CASE WHEN ? IS NOT NULL AND product_url_key = ? THEN 0 ELSE 1 END,
        reviewed_at DESC
      LIMIT ?`,
    )
    .bind(
      normalizeEvidenceMatchText(question.question),
      now,
      canonicalProductUrl,
      canonicalProductUrl,
      canonicalProductUrl,
      normalizeEvidenceMatchText(question.productName),
      canonicalProductUrl,
      canonicalProductUrl,
      maximumReusableEvidenceResults,
    )
    .all<EvidenceLibraryRow>();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the reusable evidence search.');
  }
  return result.results.map(rowToRecord);
}

export async function findReusableEvidenceByStreamUid(
  database: D1Database,
  streamUid: string,
  now = new Date().toISOString(),
): Promise<ReusableEvidenceRecord | null> {
  const row = await database
    .withSession('first-primary')
    .prepare(
      `SELECT
        evidence_id,
        product_name,
        product_url,
        question,
        source_title,
        video_url,
        rights,
        provenance,
        continuity,
        capture_timing,
        contributor_label,
        captured_at,
        stream_uid,
        sha256,
        duration_seconds,
        result,
        confidence,
        observation_text,
        citation_start_seconds,
        citation_end_seconds,
        reviewed_at,
        indexed_at,
        expires_at
      FROM reusable_evidence
      WHERE stream_uid = ? AND expires_at > ?
      LIMIT 1`,
    )
    .bind(streamUid, now)
    .first<EvidenceLibraryRow>();
  return row === null ? null : rowToRecord(row);
}

export async function reusableEvidenceSearchResponse(
  database: D1Database | undefined,
  input: ProductQuestionInput,
): Promise<ReusableEvidenceSearchResponse> {
  if (database === undefined) {
    return reusableEvidenceSearchResponseSchema.parse({
      status: 'unavailable',
      records: [],
      warnings: ['The reusable evidence index is not configured on this deployment.'],
    });
  }
  return reusableEvidenceSearchResponseSchema.parse({
    status: 'complete',
    records: await searchReusableEvidence(database, input),
    warnings: [],
  });
}

function jsonResponse(body: object, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers: responseHeaders });
}

export async function routeReusableEvidenceRequest(
  request: Request,
  database: D1Database | undefined,
  cors: HeadersInit,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/evidence-library/search') {
    return null;
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
  }
  if (!(
    request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json') ?? false
  )) {
    return jsonResponse({ error: 'application_json_required' }, 415, cors);
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400, cors);
  }
  const parsed = productQuestionInputSchema.safeParse(input);
  if (!parsed.success) {
    return jsonResponse(
      { error: 'invalid_product_question', issues: parsed.error.issues },
      400,
      cors,
    );
  }
  return jsonResponse(await reusableEvidenceSearchResponse(database, parsed.data), 200, cors);
}

export const evidenceLibraryRuntime = {
  maximumReusableEvidenceResults,
} as const;
