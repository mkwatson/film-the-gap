import { createHash } from 'node:crypto';

import { getCache } from '@vercel/functions';

import { searchShopifyGlobalCatalog } from '@/lib/evidence-network/server/shopify-global-catalog';
import {
  shopifyCatalogDevelopmentProfile,
  shopifyCatalogSearchInputSchema,
  shopifyCatalogSearchResponseSchema,
  type ShopifyCatalogSearchInput,
  type ShopifyCatalogSearchResponse,
} from '@/lib/evidence-network/ucp-catalog';

export const runtime = 'nodejs';
export const maxDuration = 15;

const cacheTtlSeconds = 5 * 60;
const runtimeCache = getCache({ namespace: 'shopify-ucp-catalog-v1' });

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

export interface CatalogEnvironment {
  readonly UCP_AGENT_PROFILE_URL?: string;
  readonly VERCEL?: string;
}

export function configuredUcpAgentProfile(environment: CatalogEnvironment): string {
  const configured = environment.UCP_AGENT_PROFILE_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  return environment.VERCEL === '1' ? '' : shopifyCatalogDevelopmentProfile;
}

function cacheKey(input: object, profileUrl: string): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ version: 'v1', input, profileUrl }))
    .digest('hex');
  return `catalog:${digest}`;
}

async function readCache(key: string): Promise<ShopifyCatalogSearchResponse | null> {
  try {
    const parsed = shopifyCatalogSearchResponseSchema.safeParse(await runtimeCache.get(key));
    return parsed.success && parsed.data.status === 'complete' ? parsed.data : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: ShopifyCatalogSearchResponse): Promise<void> {
  if (value.status !== 'complete') {
    return;
  }
  try {
    await runtimeCache.set(key, value, {
      ttl: cacheTtlSeconds,
      tags: ['shopify-ucp-catalog'],
      name: 'Shopify UCP product discovery',
    });
  } catch {
    // Product discovery remains available when the regional cache is unavailable.
  }
}

export interface CatalogSearchRouteDependencies {
  readonly environment?: CatalogEnvironment;
  readonly readCached?: (key: string) => Promise<ShopifyCatalogSearchResponse | null>;
  readonly searchCatalog?: (
    input: ShopifyCatalogSearchInput,
    options: { readonly agentProfileUrl: string },
    signal?: AbortSignal,
  ) => Promise<ShopifyCatalogSearchResponse>;
  readonly writeCached?: (key: string, value: ShopifyCatalogSearchResponse) => Promise<void>;
}

export async function handleCatalogSearch(
  request: Request,
  dependencies: CatalogSearchRouteDependencies = {},
): Promise<Response> {
  if (!sameOriginJsonRequest(request)) {
    return json({ error: 'same_origin_json_required' }, 403);
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const parsed = shopifyCatalogSearchInputSchema.safeParse(input);
  if (!parsed.success) {
    return json({ error: 'invalid_catalog_search', issues: parsed.error.issues }, 400);
  }
  const environment = dependencies.environment ?? {
    ...(process.env.UCP_AGENT_PROFILE_URL === undefined
      ? {}
      : { UCP_AGENT_PROFILE_URL: process.env.UCP_AGENT_PROFILE_URL }),
    ...(process.env.VERCEL === undefined ? {} : { VERCEL: process.env.VERCEL }),
  };
  const agentProfileUrl = configuredUcpAgentProfile(environment);
  const key = cacheKey(parsed.data, agentProfileUrl);
  const cached = await (dependencies.readCached ?? readCache)(key);
  if (cached !== null) {
    return json(cached);
  }
  const result = await (dependencies.searchCatalog ?? searchShopifyGlobalCatalog)(
    parsed.data,
    { agentProfileUrl },
    request.signal,
  );
  await (dependencies.writeCached ?? writeCache)(key, result);
  return json(shopifyCatalogSearchResponseSchema.parse(result));
}

export async function POST(request: Request): Promise<Response> {
  return handleCatalogSearch(request);
}
