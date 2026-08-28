import {
  maximumUploadsPerEvidenceCase,
  remoteEvidenceProtocolVersion,
} from '../../src/lib/evidence-network/remote-protocol';
import { routeProductEvidenceRequest, type ProductEvidenceWorkerEnv } from './product-evidence';

export { ProductEvidenceCaseObject } from './product-evidence';

export interface EvidenceWorkerEnv extends ProductEvidenceWorkerEnv {
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
      },
      workerVersion: env.CF_VERSION_METADATA,
    });
  }
  if (!requestOriginAllowed(request, env)) {
    return jsonResponse({ error: 'origin_not_allowed' }, 403);
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
} satisfies ExportedHandler<EvidenceWorkerEnv>;
