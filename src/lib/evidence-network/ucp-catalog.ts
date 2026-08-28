import { z } from 'zod';

import { publicHttpUrlSchema } from './url-policy';

export const shopifyCatalogProtocolVersion = '2026-04-08' as const;
export const shopifyGlobalCatalogEndpoint = 'https://catalog.shopify.com/api/ucp/mcp' as const;
export const shopifyCatalogDevelopmentProfile =
  'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json' as const;

const ucpCatalogSearchCapability = 'dev.ucp.shopping.catalog.search' as const;
const ucpCatalogLookupCapability = 'dev.ucp.shopping.catalog.lookup' as const;
const shopifyGlobalCatalogCapability = 'dev.shopify.catalog.global' as const;

export const shopifyCatalogSearchInputSchema = z.strictObject({
  query: z.string().trim().min(3).max(160),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/u)
    .default('US'),
});

const catalogPriceSchema = z.strictObject({
  amount: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  currency: z.string().regex(/^[A-Z]{3}$/u),
});

const catalogClaimSchema = z.strictObject({
  text: z.string().min(1).max(360),
  provenance: z.literal('shopify_inferred'),
  evidenceStatus: z.literal('unverified_catalog_context'),
});

export const shopifyCatalogProductSchema = z.strictObject({
  productId: z.string().startsWith('gid://shopify/').max(240),
  variantId: z.string().startsWith('gid://shopify/').max(240),
  title: z.string().min(1).max(200),
  variantTitle: z.string().min(1).max(200),
  productUrl: publicHttpUrlSchema.optional(),
  seller: z.strictObject({
    name: z.string().min(1).max(160),
    domain: z.string().min(1).max(253),
  }),
  price: catalogPriceSchema,
  condition: z.array(z.string().min(1).max(40)).max(4),
  catalogClaims: z.array(catalogClaimSchema).max(3),
});

export const shopifyCatalogSearchResponseSchema = z.strictObject({
  provider: z.literal('shopify_global_catalog'),
  protocolVersion: z.literal(shopifyCatalogProtocolVersion),
  status: z.enum(['complete', 'unavailable']),
  query: z.string().min(3).max(160),
  products: z.array(shopifyCatalogProductSchema).max(4),
  warnings: z.array(z.string().min(1).max(240)).max(4),
});

export type ShopifyCatalogSearchInput = z.infer<typeof shopifyCatalogSearchInputSchema>;
export type ShopifyCatalogProduct = z.infer<typeof shopifyCatalogProductSchema>;
export type ShopifyCatalogSearchResponse = z.infer<typeof shopifyCatalogSearchResponseSchema>;

export const filmTheGapUcpPlatformProfile = {
  ucp: {
    version: shopifyCatalogProtocolVersion,
    services: {
      'dev.ucp.shopping': [
        {
          version: shopifyCatalogProtocolVersion,
          spec: 'https://ucp.dev/2026-04-08/specification/overview',
          transport: 'mcp',
          schema: 'https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json',
        },
      ],
    },
    capabilities: {
      [ucpCatalogSearchCapability]: [
        {
          version: shopifyCatalogProtocolVersion,
          spec: 'https://ucp.dev/2026-04-08/specification/catalog/search',
          schema: 'https://ucp.dev/2026-04-08/schemas/shopping/catalog_search.json',
        },
      ],
      [ucpCatalogLookupCapability]: [
        {
          version: shopifyCatalogProtocolVersion,
          spec: 'https://ucp.dev/2026-04-08/specification/catalog/lookup',
          schema: 'https://ucp.dev/2026-04-08/schemas/shopping/catalog_lookup.json',
        },
      ],
      [shopifyGlobalCatalogCapability]: [
        {
          version: shopifyCatalogProtocolVersion,
          spec: 'https://shopify.dev/docs/agents/catalog/global-catalog',
          schema: 'https://shopify.dev/ucp/schemas/2026-04-08/shopify_catalog_global.json',
          extends: [ucpCatalogLookupCapability, ucpCatalogSearchCapability],
        },
      ],
    },
    payment_handlers: {},
  },
} as const;
