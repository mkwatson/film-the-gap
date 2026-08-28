import {
  maximumUploadsPerEvidenceCase,
  remoteEvidenceProtocolVersion,
} from '../../src/lib/evidence-network/remote-protocol';
import { publicNetworkEvidenceRetentionDays } from '../../src/lib/evidence-network/model';
import { deleteExpiredReusableEvidence, routeReusableEvidenceRequest } from './evidence-library';
import {
  deleteExpiredPageReaderUsage,
  routeKnownPageReaderRequest,
  type KnownPageReaderWorkerEnv,
} from './known-page-reader';
import { routeProductEvidenceRequest, type ProductEvidenceWorkerEnv } from './product-evidence';
import { deleteExpiredPublicMissions, routePublicMissionRequest } from './public-mission-board';

export { ProductEvidenceCaseObject } from './product-evidence';

export interface EvidenceWorkerEnv extends ProductEvidenceWorkerEnv, KnownPageReaderWorkerEnv {
  readonly CF_VERSION_METADATA: WorkerVersionMetadata;
}

function allowedOrigins(env: EvidenceWorkerEnv): ReadonlySet<string> {
  return new Set(
    env.ALLOWED_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  );
}

function requestOriginAllowed(request: Request, env: EvidenceWorkerEnv): boolean {
  const origin = request.headers.get('Origin');
  return origin === null || allowedOrigins(env).has(origin);
}

function corsHeaders(request: Request, env: EvidenceWorkerEnv): HeadersInit {
  const origin = request.headers.get('Origin');
  if (origin === null || !allowedOrigins(env).has(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function jsonResponse(body: object, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers: responseHeaders });
}

async function route(request: Request, env: EvidenceWorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/healthz') {
    return jsonResponse({
      ok: true,
      service: 'webmcp-product-evidence',
      protocolVersion: remoteEvidenceProtocolVersion,
      abuseControls: {
        perClientCaseCreation: env.CASE_CREATION_PER_CLIENT_RATE_LIMITER !== undefined,
        globalCaseCreation: env.CASE_CREATION_GLOBAL_RATE_LIMITER !== undefined,
        maximumUploadsPerEvidenceCase,
      },
      evidenceServices: {
        stream: env.STREAM !== undefined || env.STREAM_OUTBOUND !== undefined,
        videoAnalysis:
          env.AI_ANALYSIS_OUTBOUND !== undefined ||
          (env.AI_GATEWAY_API_KEY?.trim().length ?? 0) > 0,
        missionBoundCapture: true,
        reusableEvidence: env.EVIDENCE_LIBRARY !== undefined,
        reusableEvidenceRetentionDays: publicNetworkEvidenceRetentionDays,
        expiredEvidencePurge: 'daily',
        publicMissionBoard: env.EVIDENCE_LIBRARY !== undefined,
        publicMissionRetentionHours: 24,
        productPageReader:
          (env.BROWSER !== undefined || env.PAGE_READER_OUTBOUND !== undefined) &&
          env.EVIDENCE_LIBRARY !== undefined &&
          (env.PAGE_READER_SHARED_SECRET?.trim().length ?? 0) >= 24,
      },
      workerVersion: env.CF_VERSION_METADATA,
    });
  }
  if (!requestOriginAllowed(request, env)) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403);
  }
  const knownPageResponse = await routeKnownPageReaderRequest(request, env);
  if (knownPageResponse !== null) {
    return knownPageResponse;
  }
  const publicMissionResponse = await routePublicMissionRequest(
    request,
    env,
    corsHeaders(request, env),
  );
  if (publicMissionResponse !== null) {
    return publicMissionResponse;
  }
  const reusableEvidenceResponse = await routeReusableEvidenceRequest(
    request,
    env.EVIDENCE_LIBRARY,
    corsHeaders(request, env),
  );
  if (reusableEvidenceResponse !== null) {
    return reusableEvidenceResponse;
  }
  const evidenceResponse = await routeProductEvidenceRequest(
    request,
    env,
    corsHeaders(request, env),
  );
  return evidenceResponse ?? jsonResponse({ error: 'not_found' }, 404);
}

export default {
  async fetch(request: Request, env: EvidenceWorkerEnv): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error: unknown) {
      console.error('Product evidence request failure', error);
      return jsonResponse({ error: 'internal_error' }, 500, corsHeaders(request, env));
    }
  },
  async scheduled(controller: ScheduledController, env: EvidenceWorkerEnv): Promise<void> {
    if (env.EVIDENCE_LIBRARY === undefined) {
      console.warn('Skipped expired evidence purge because the D1 binding is unavailable.');
      return;
    }
    const now = new Date(controller.scheduledTime).toISOString();
    const [reusableEvidence, publicMissions, pageReaderUsage] = await Promise.all([
      deleteExpiredReusableEvidence(env.EVIDENCE_LIBRARY, now),
      deleteExpiredPublicMissions(env.EVIDENCE_LIBRARY, now),
      deleteExpiredPageReaderUsage(env.EVIDENCE_LIBRARY, now.slice(0, 10)),
    ]);
    console.log('Expired evidence network purge completed.', {
      reusableEvidence,
      publicMissions,
      pageReaderUsage,
    });
  },
} satisfies ExportedHandler<EvidenceWorkerEnv>;
