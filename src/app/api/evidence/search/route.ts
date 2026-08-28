import { getCache } from '@vercel/functions';

import {
  evidenceDiscoveryInputSchema,
  productQuestionInputSchema,
} from '@/lib/evidence-network/model';
import {
  searchPublicProductEvidence,
  type EvidenceDiscoveryCache,
} from '@/lib/evidence-network/server/public-evidence-search';

export const runtime = 'nodejs';
export const maxDuration = 30;

const runtimeCache = getCache({ namespace: 'product-evidence-discovery-v1' });
const discoveryCache: EvidenceDiscoveryCache = {
  get: (key) => runtimeCache.get(key),
  set: (key, value, options) => runtimeCache.set(key, value, options),
};

function json(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function sameOriginJsonRequest(request: Request): boolean {
  const contentType = request.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    return false;
  }
  const origin = request.headers.get('Origin');
  if (origin === null) {
    return true;
  }
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOriginJsonRequest(request)) {
    return json({ error: 'same_origin_json_required' }, 403);
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = productQuestionInputSchema.safeParse(input);
  if (!parsed.success) {
    return json({ error: 'invalid_product_question', issues: parsed.error.issues }, 400);
  }
  const result = await searchPublicProductEvidence(
    parsed.data,
    {
      scrapeCreatorsApiKey: process.env.SCRAPECREATORS_API_KEY,
      gatewayApiKey: process.env.AI_GATEWAY_DISCOVERY_API_KEY,
      gatewayOidcAvailable: process.env.VERCEL === '1',
      ...(process.env.EVIDENCE_PAGE_READER_TOKEN?.trim()
        ? { pageReaderToken: process.env.EVIDENCE_PAGE_READER_TOKEN.trim() }
        : {}),
      ...(process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL?.trim()
        ? { evidenceServiceUrl: process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL.trim() }
        : {}),
      cache: discoveryCache,
    },
    request.signal,
  );
  return json(evidenceDiscoveryInputSchema.parse(result));
}
