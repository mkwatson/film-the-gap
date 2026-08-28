import {
  publicEvidenceMissionClaimSchema,
  publicEvidenceMissionIdPattern,
  publicEvidenceMissionListSchema,
  publicEvidenceMissionSchema,
  publishPublicEvidenceMissionRequestSchema,
  removePublicEvidenceMissionRequestSchema,
  type PublicEvidenceMission,
} from '../../src/lib/evidence-network/remote-protocol';
import type { ProductEvidenceCaseObject } from './product-evidence';

interface PublicMissionBoardRow {
  readonly mission_id: string;
  readonly case_id: string;
  readonly contributor_token: string;
  readonly product_name: string;
  readonly product_url: string | null;
  readonly question: string;
  readonly instruction: string;
  readonly success_criterion: string;
  readonly minimum_seconds: number;
  readonly continuous_take_required: number;
  readonly status: 'open' | 'fulfilled' | 'removed';
  readonly created_at: string;
  readonly expires_at: string;
  readonly fulfilled_at: string | null;
}

export interface PublicMissionBoardEnv {
  readonly CASES: DurableObjectNamespace<ProductEvidenceCaseObject>;
  readonly EVIDENCE_LIBRARY?: D1Database;
}

function rowToMission(row: PublicMissionBoardRow): PublicEvidenceMission {
  return publicEvidenceMissionSchema.parse({
    id: row.mission_id,
    caseId: row.case_id,
    productName: row.product_name,
    productUrl: row.product_url,
    question: row.question,
    instruction: row.instruction,
    successCriterion: row.success_criterion,
    minimumSeconds: row.minimum_seconds,
    continuousTakeRequired: row.continuous_take_required === 1,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    fulfilledAt: row.fulfilled_at,
  });
}

function jsonResponse(body: object, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers: responseHeaders });
}

function applicationJson(request: Request): boolean {
  return request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json') ?? false;
}

async function requestJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function privateMissionRow(
  database: D1Database,
  missionId: string,
): Promise<PublicMissionBoardRow | null> {
  return database
    .withSession('first-primary')
    .prepare(
      `SELECT
        mission_id,
        case_id,
        contributor_token,
        product_name,
        product_url,
        question,
        instruction,
        success_criterion,
        minimum_seconds,
        continuous_take_required,
        status,
        created_at,
        expires_at,
        fulfilled_at
      FROM public_evidence_missions
      WHERE mission_id = ?`,
    )
    .bind(missionId)
    .first<PublicMissionBoardRow>();
}

async function privateMissionRowByCase(
  database: D1Database,
  caseId: string,
): Promise<PublicMissionBoardRow | null> {
  return database
    .withSession('first-primary')
    .prepare(
      `SELECT
        mission_id,
        case_id,
        contributor_token,
        product_name,
        product_url,
        question,
        instruction,
        success_criterion,
        minimum_seconds,
        continuous_take_required,
        status,
        created_at,
        expires_at,
        fulfilled_at
      FROM public_evidence_missions
      WHERE case_id = ?`,
    )
    .bind(caseId)
    .first<PublicMissionBoardRow>();
}

function randomPublicContributorToken(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
}

export async function listOpenPublicMissions(
  database: D1Database,
  now = new Date().toISOString(),
): Promise<readonly PublicEvidenceMission[]> {
  const result = await database
    .withSession('first-primary')
    .prepare(
      `SELECT
        mission_id,
        case_id,
        contributor_token,
        product_name,
        product_url,
        question,
        instruction,
        success_criterion,
        minimum_seconds,
        continuous_take_required,
        status,
        created_at,
        expires_at,
        fulfilled_at
      FROM public_evidence_missions
      WHERE status = 'open' AND expires_at > ?
      ORDER BY created_at DESC
      LIMIT 24`,
    )
    .bind(now)
    .all<PublicMissionBoardRow>();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the public mission search.');
  }
  return result.results.map(rowToMission);
}

export async function insertPublicMission(
  database: D1Database,
  mission: PublicEvidenceMission,
  contributorToken: string,
): Promise<void> {
  const parsedMission = publicEvidenceMissionSchema.parse(mission);
  const parsedClaim = publicEvidenceMissionClaimSchema.parse({
    mission: parsedMission,
    contributorToken,
  });
  const result = await database
    .prepare(
      `INSERT INTO public_evidence_missions (
        mission_id,
        case_id,
        contributor_token,
        product_name,
        product_url,
        question,
        instruction,
        success_criterion,
        minimum_seconds,
        continuous_take_required,
        status,
        created_at,
        expires_at,
        fulfilled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mission_id) DO NOTHING
      ON CONFLICT(case_id) DO UPDATE SET
        mission_id = excluded.mission_id,
        contributor_token = excluded.contributor_token,
        product_name = excluded.product_name,
        product_url = excluded.product_url,
        question = excluded.question,
        instruction = excluded.instruction,
        success_criterion = excluded.success_criterion,
        minimum_seconds = excluded.minimum_seconds,
        continuous_take_required = excluded.continuous_take_required,
        status = excluded.status,
        created_at = excluded.created_at,
        expires_at = excluded.expires_at,
        fulfilled_at = excluded.fulfilled_at
      WHERE
        public_evidence_missions.status = 'removed' OR
        public_evidence_missions.expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .bind(
      parsedMission.id,
      parsedMission.caseId,
      parsedClaim.contributorToken,
      parsedMission.productName,
      parsedMission.productUrl,
      parsedMission.question,
      parsedMission.instruction,
      parsedMission.successCriterion,
      parsedMission.minimumSeconds,
      parsedMission.continuousTakeRequired ? 1 : 0,
      parsedMission.status,
      parsedMission.createdAt,
      parsedMission.expiresAt,
      parsedMission.fulfilledAt,
    )
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the public mission write.');
  }
  const stored = await privateMissionRow(database, parsedMission.id);
  if (
    stored === null ||
    stored.case_id !== parsedMission.caseId ||
    stored.contributor_token !== parsedClaim.contributorToken
  ) {
    throw new Error('The public mission identifier is already bound to another capability.');
  }
}

export async function markPublicMissionFulfilled(
  database: D1Database,
  missionId: string,
  fulfilledAt: string,
): Promise<void> {
  if (!publicEvidenceMissionIdPattern.test(missionId)) {
    throw new Error('Cannot fulfill an invalid public mission identifier.');
  }
  const result = await database
    .prepare(
      `UPDATE public_evidence_missions
      SET status = 'fulfilled', fulfilled_at = ?
      WHERE mission_id = ? AND status = 'open'`,
    )
    .bind(fulfilledAt, missionId)
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge public mission fulfillment.');
  }
}

export async function deleteExpiredPublicMissions(
  database: D1Database,
  now = new Date().toISOString(),
): Promise<number> {
  const result = await database
    .prepare('DELETE FROM public_evidence_missions WHERE expires_at <= ?')
    .bind(now)
    .run();
  if (!result.success) {
    throw new Error('Cloudflare D1 did not acknowledge the expired mission purge.');
  }
  return result.meta.changes;
}

function caseStub(env: PublicMissionBoardEnv, caseId: string): DurableObjectStub {
  return env.CASES.get(env.CASES.idFromName(caseId));
}

async function forwardInternalJson(
  stub: DurableObjectStub,
  path: string,
  body: object,
): Promise<{ readonly response: Response; readonly body: unknown }> {
  const response = await stub.fetch(`https://evidence.internal${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    // The outer route returns a stable error instead of forwarding unreadable internal content.
  }
  return { response, body: parsed };
}

export async function routePublicMissionRequest(
  request: Request,
  env: PublicMissionBoardEnv,
  cors: HeadersInit,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/public-missions')) {
    return null;
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  const database = env.EVIDENCE_LIBRARY;
  if (database === undefined) {
    return jsonResponse(
      { error: 'mission_board_unavailable', message: 'The public mission board is unavailable.' },
      503,
      cors,
    );
  }

  if (request.method === 'GET' && url.pathname === '/public-missions') {
    return jsonResponse(
      publicEvidenceMissionListSchema.parse({
        missions: await listOpenPublicMissions(database),
      }),
      200,
      cors,
    );
  }

  if (request.method === 'POST' && url.pathname === '/public-missions') {
    if (!applicationJson(request)) {
      return jsonResponse({ error: 'application_json_required' }, 415, cors);
    }
    const parsed = publishPublicEvidenceMissionRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) {
      return jsonResponse(
        { error: 'invalid_public_mission', issues: parsed.error.issues },
        400,
        cors,
      );
    }
    const existing = await privateMissionRowByCase(database, parsed.data.caseId);
    const recoverExisting =
      existing !== null &&
      existing.status === 'open' &&
      Date.parse(existing.expires_at) > Date.now();
    const missionId = recoverExisting ? existing.mission_id : parsed.data.missionId;
    const publicContributorToken = recoverExisting
      ? existing.contributor_token
      : randomPublicContributorToken();
    const internal = await forwardInternalJson(
      caseStub(env, parsed.data.caseId),
      '/publish-public-mission',
      {
        ...parsed.data,
        missionId,
        publicContributorToken,
      },
    );
    if (!internal.response.ok) {
      return jsonResponse(
        typeof internal.body === 'object' && internal.body !== null
          ? internal.body
          : { error: 'public_mission_rejected' },
        internal.response.status,
        cors,
      );
    }
    const mission = publicEvidenceMissionSchema.parse(internal.body);
    // This token is distinct from both the public mission identifier and the
    // private phone capability. D1 never returns it from a list/read route, and
    // the Durable Object retains only its digest.
    await insertPublicMission(database, mission, publicContributorToken);
    return jsonResponse(mission, 201, cors);
  }

  const match = /^\/public-missions\/([^/]+)(?:\/(claim|remove))?$/.exec(url.pathname);
  const missionId = match?.[1];
  const action = match?.[2];
  if (missionId === undefined || !publicEvidenceMissionIdPattern.test(missionId)) {
    return jsonResponse({ error: 'public_mission_not_found' }, 404, cors);
  }
  const row = await privateMissionRow(database, missionId);
  if (row === null) {
    return jsonResponse({ error: 'public_mission_not_found' }, 404, cors);
  }
  const mission = rowToMission(row);
  if (request.method === 'GET' && action === undefined) {
    return jsonResponse(mission, 200, cors);
  }
  if (request.method === 'POST' && action === 'claim') {
    if (mission.status !== 'open' || Date.parse(mission.expiresAt) <= Date.now()) {
      return jsonResponse({ error: 'public_mission_closed' }, 409, cors);
    }
    return jsonResponse(
      publicEvidenceMissionClaimSchema.parse({
        mission,
        contributorToken: row.contributor_token,
      }),
      200,
      cors,
    );
  }
  if (request.method === 'POST' && action === 'remove') {
    if (!applicationJson(request)) {
      return jsonResponse({ error: 'application_json_required' }, 415, cors);
    }
    const parsed = removePublicEvidenceMissionRequestSchema.safeParse(await requestJson(request));
    if (!parsed.success) {
      return jsonResponse(
        { error: 'invalid_public_mission_removal', issues: parsed.error.issues },
        400,
        cors,
      );
    }
    const internal = await forwardInternalJson(
      caseStub(env, mission.caseId),
      '/remove-public-mission',
      { ...parsed.data, missionId },
    );
    if (!internal.response.ok) {
      return jsonResponse(
        typeof internal.body === 'object' && internal.body !== null
          ? internal.body
          : { error: 'public_mission_removal_rejected' },
        internal.response.status,
        cors,
      );
    }
    const result = await database
      .prepare(
        `UPDATE public_evidence_missions
        SET status = 'removed'
        WHERE mission_id = ? AND status = 'open'`,
      )
      .bind(missionId)
      .run();
    if (!result.success) {
      throw new Error('Cloudflare D1 did not acknowledge public mission removal.');
    }
    return jsonResponse({ ...mission, status: 'removed' }, 200, cors);
  }
  return jsonResponse({ error: 'method_not_allowed' }, 405, cors);
}
