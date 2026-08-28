import { z } from 'zod';

import { canonicalizePublicDiscoveryUrl, isPublicHttpUrl } from '../url-policy';
import {
  shopifyCatalogProtocolVersion,
  shopifyCatalogSearchResponseSchema,
  shopifyGlobalCatalogEndpoint,
  type ShopifyCatalogProduct,
  type ShopifyCatalogSearchInput,
  type ShopifyCatalogSearchResponse,
} from '../ucp-catalog';

const maximumResponseBytes = 512 * 1024;
const defaultTimeoutMilliseconds = 8_000;
const catalogSearchCapability = 'dev.ucp.shopping.catalog.search';
const globalCatalogCapability = 'dev.shopify.catalog.global';

const upstreamPriceSchema = z.object({
  amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/u),
});

const upstreamSellerSchema = z.object({
  name: z.string().trim().min(1).max(160),
  domain: z.string().trim().min(1).max(253),
});

const upstreamVariantSchema = z.object({
  id: z.string().startsWith('gid://shopify/').max(240),
  title: z.string().trim().min(1).max(200),
  url: z.string().max(2_048).optional(),
  price: upstreamPriceSchema,
  condition: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  seller: upstreamSellerSchema,
});

const upstreamProductSchema = z.object({
  id: z.string().startsWith('gid://shopify/').max(240),
  title: z.string().trim().min(1).max(200),
  description: z
    .object({
      plain: z.string().trim().min(1).max(4_000).optional(),
    })
    .optional(),
  metadata: z
    .object({
      unique_selling_points: z.array(z.string().trim().min(1).max(1_000)).max(20).optional(),
      top_features: z.string().trim().min(1).max(4_000).optional(),
    })
    .optional(),
  variants: z.array(upstreamVariantSchema).min(1).max(250),
});

const upstreamEnvelopeSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.object({
    isError: z.boolean().optional(),
    structuredContent: z.object({
      ucp: z.object({
        version: z.literal(shopifyCatalogProtocolVersion),
        status: z.literal('success'),
        capabilities: z.record(
          z.string(),
          z.array(
            z.object({
              version: z.string(),
            }),
          ),
        ),
      }),
      products: z.array(z.unknown()).max(20),
    }),
  }),
});

export type ShopifyCatalogFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ShopifyCatalogSearchOptions {
  readonly agentProfileUrl: string;
  readonly fetcher?: ShopifyCatalogFetcher;
  readonly timeoutMilliseconds?: number;
}

function unavailableCatalogSearch(
  input: ShopifyCatalogSearchInput,
  warning: string,
): ShopifyCatalogSearchResponse {
  return shopifyCatalogSearchResponseSchema.parse({
    provider: 'shopify_global_catalog',
    protocolVersion: shopifyCatalogProtocolVersion,
    status: 'unavailable',
    query: input.query,
    products: [],
    warnings: [warning],
  });
}

function boundedSignal(signal: AbortSignal | undefined, timeoutMilliseconds: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMilliseconds);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

function validAgentProfileUrl(value: string): boolean {
  if (!isPublicHttpUrl(value)) {
    return false;
  }
  const url = new URL(value);
  return url.protocol === 'https:' && url.hash.length === 0 && url.username.length === 0;
}

function normalizedCatalogProductUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const canonical = canonicalizePublicDiscoveryUrl(value);
  if (canonical === null) {
    return undefined;
  }
  const url = new URL(canonical);
  if (url.protocol !== 'https:') {
    return undefined;
  }
  url.searchParams.delete('_gsid');
  return url.toString();
}

function normalizedClaim(value: string): string | null {
  const normalized = value.replaceAll(/\s+/gu, ' ').trim();
  return normalized.length === 0 ? null : normalized.slice(0, 360);
}

function catalogClaims(
  product: z.infer<typeof upstreamProductSchema>,
): ShopifyCatalogProduct['catalogClaims'] {
  const candidates = [
    product.description?.plain,
    ...(product.metadata?.unique_selling_points ?? []),
    ...(product.metadata?.top_features?.split('\n') ?? []),
  ].flatMap((value) => (value === undefined ? [] : [normalizedClaim(value)]));
  const unique = new Set<string>();
  return candidates
    .flatMap((text) => {
      if (text === null || unique.has(text)) {
        return [];
      }
      unique.add(text);
      return [
        {
          text,
          provenance: 'shopify_inferred' as const,
          evidenceStatus: 'unverified_catalog_context' as const,
        },
      ];
    })
    .slice(0, 3);
}

function mapCatalogProduct(value: unknown): ShopifyCatalogProduct | null {
  const parsed = upstreamProductSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const product = parsed.data;
  const variant = product.variants[0];
  if (variant === undefined) {
    return null;
  }
  const productUrl = normalizedCatalogProductUrl(variant.url);
  return {
    productId: product.id,
    variantId: variant.id,
    title: product.title,
    variantTitle: variant.title,
    ...(productUrl === undefined ? {} : { productUrl }),
    seller: variant.seller,
    price: variant.price,
    condition: (variant.condition ?? []).slice(0, 4),
    catalogClaims: catalogClaims(product),
  };
}

function hasNegotiatedCapability(
  capabilities: Record<string, readonly { readonly version: string }[]>,
  name: string,
): boolean {
  return (
    capabilities[name]?.some(({ version }) => version === shopifyCatalogProtocolVersion) === true
  );
}

async function responseJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('application/json')) {
    throw new Error('Shopify Global Catalog did not return JSON.');
  }
  const declaredLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumResponseBytes) {
    throw new Error('Shopify Global Catalog response exceeded the byte limit.');
  }
  const body = await response.text();
  if (new TextEncoder().encode(body).byteLength > maximumResponseBytes) {
    throw new Error('Shopify Global Catalog response exceeded the byte limit.');
  }
  return JSON.parse(body) as unknown;
}

export async function searchShopifyGlobalCatalog(
  input: ShopifyCatalogSearchInput,
  options: ShopifyCatalogSearchOptions,
  signal?: AbortSignal,
): Promise<ShopifyCatalogSearchResponse> {
  if (!validAgentProfileUrl(options.agentProfileUrl)) {
    return unavailableCatalogSearch(
      input,
      'UCP product discovery is not configured with a valid public agent profile.',
    );
  }
  const fetcher = options.fetcher ?? fetch;
  try {
    const response = await fetcher(shopifyGlobalCatalogEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        id: 1,
        params: {
          name: 'search_catalog',
          arguments: {
            meta: {
              'ucp-agent': {
                profile: options.agentProfileUrl,
              },
            },
            catalog: {
              query: input.query,
              context: { address_country: input.country },
              pagination: { limit: 4 },
            },
          },
        },
      }),
      signal: boundedSignal(signal, options.timeoutMilliseconds ?? defaultTimeoutMilliseconds),
    });
    if (!response.ok) {
      throw new Error(`Shopify Global Catalog returned HTTP ${response.status}.`);
    }
    const parsed = upstreamEnvelopeSchema.parse(await responseJson(response));
    if (parsed.result.isError === true) {
      throw new Error('Shopify Global Catalog reported a tool error.');
    }
    const capabilities = parsed.result.structuredContent.ucp.capabilities;
    if (
      !hasNegotiatedCapability(capabilities, catalogSearchCapability) ||
      !hasNegotiatedCapability(capabilities, globalCatalogCapability)
    ) {
      throw new Error('Shopify Global Catalog did not negotiate the required UCP capabilities.');
    }
    const products = parsed.result.structuredContent.products
      .flatMap((product) => {
        const mapped = mapCatalogProduct(product);
        return mapped === null ? [] : [mapped];
      })
      .slice(0, 4);
    return shopifyCatalogSearchResponseSchema.parse({
      provider: 'shopify_global_catalog',
      protocolVersion: shopifyCatalogProtocolVersion,
      status: 'complete',
      query: input.query,
      products,
      warnings: [],
    });
  } catch {
    if (signal?.aborted === true) {
      throw signal.reason ?? new DOMException('The catalog search was aborted.', 'AbortError');
    }
    return unavailableCatalogSearch(
      input,
      'Shopify Global Catalog was temporarily unavailable; no product was selected.',
    );
  }
}
