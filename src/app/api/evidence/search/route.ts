import { getCache } from '@vercel/functions';

import {
  evidenceDiscoveryInputSchema,
  productQuestionInputSchema,
} from '@/lib/evidence-network/model';
import { demoProduct } from '@/lib/evidence-network/demo-product';
import {
  searchPublicProductEvidence,
  type EvidenceDiscoveryCache,
} from '@/lib/evidence-network/server/public-evidence-search';
import { isSameOriginJsonRequest } from '@/lib/http/same-origin-json';

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

function isSameOriginDemoQuestion(
  input: {
    readonly productName: string;
    readonly productUrl?: string | undefined;
    readonly question: string;
  },
  requestUrl: string,
): boolean {
  if (
    input.productName !== demoProduct.name ||
    input.question !== demoProduct.question ||
    input.productUrl === undefined
  ) {
    return false;
  }
  const request = new URL(requestUrl);
  const product = new URL(input.productUrl);
  return (
    product.origin === request.origin &&
    product.pathname === demoProduct.path &&
    product.search === '' &&
    product.hash === ''
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJsonRequest(request)) {
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
  const demoQuestion = isSameOriginDemoQuestion(parsed.data, request.url);
  const result = await searchPublicProductEvidence(
    parsed.data,
    {
      scrapeCreatorsApiKey: demoQuestion ? undefined : process.env.SCRAPECREATORS_API_KEY,
      gatewayApiKey: demoQuestion ? undefined : process.env.AI_GATEWAY_DISCOVERY_API_KEY,
      gatewayOidcAvailable: !demoQuestion && process.env.VERCEL === '1',
      ...(!demoQuestion && process.env.EVIDENCE_PAGE_READER_TOKEN?.trim()
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
