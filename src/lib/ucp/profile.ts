import { z } from 'zod';

export const ucpProtocolVersion = '2026-08-25' as const;
export const ucpShoppingServiceName = 'dev.ucp.shopping' as const;
export const ucpCartCapabilityName = 'dev.ucp.shopping.cart' as const;

const ucpServiceEntrySchema = z.looseObject({
  version: z.string().min(1),
  spec: z.string().url().optional(),
  schema: z.string().url().optional(),
  transport: z.string().min(1),
  endpoint: z.string().url().optional(),
});

const ucpCapabilityEntrySchema = z.looseObject({
  version: z.string().min(1),
  spec: z.string().url().optional(),
  schema: z.string().url().optional(),
  extends: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
});

export const ucpDiscoveryProfileSchema = z.looseObject({
  ucp: z.looseObject({
    version: z.string().min(1),
    services: z.record(z.string().min(1), z.array(ucpServiceEntrySchema)),
    capabilities: z.record(z.string().min(1), z.array(ucpCapabilityEntrySchema)),
    payment_handlers: z.record(z.string().min(1), z.array(z.unknown())).optional(),
    supported_versions: z.record(z.string().min(1), z.string().url()).optional(),
  }),
  keys: z.array(z.unknown()).optional(),
});

export type UcpDiscoveryProfile = z.infer<typeof ucpDiscoveryProfileSchema>;

export const webMcpPlatformProfile = {
  ucp: {
    version: ucpProtocolVersion,
    services: {
      [ucpShoppingServiceName]: [
        {
          version: ucpProtocolVersion,
          spec: `https://ucp.dev/${ucpProtocolVersion}/specification/overview`,
          transport: 'mcp',
          schema: `https://ucp.dev/${ucpProtocolVersion}/services/shopping/mcp.openrpc.json`,
        },
      ],
    },
    capabilities: {
      [ucpCartCapabilityName]: [
        {
          version: ucpProtocolVersion,
          spec: `https://ucp.dev/${ucpProtocolVersion}/specification/shopping/cart`,
          schema: `https://ucp.dev/${ucpProtocolVersion}/schemas/shopping/cart.json`,
        },
      ],
    },
    payment_handlers: {},
  },
} as const satisfies UcpDiscoveryProfile;

ucpDiscoveryProfileSchema.parse(webMcpPlatformProfile);
