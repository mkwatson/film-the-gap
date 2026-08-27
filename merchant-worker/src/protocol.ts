import { z } from 'zod';

export const ucpProtocolVersion = '2026-08-25' as const;
export const modernMcpProtocolVersion = '2026-07-28' as const;
export const legacyMcpProtocolVersions = ['2025-11-25', '2025-06-18'] as const;
export const merchantServerName = 'Evidence Market Merchant' as const;
export const merchantServerVersion = '0.1.0' as const;

export const demoProduct = {
  id: 'urn:webmcp-evidence-market:product:live-inspected-board',
  variantId: 'urn:webmcp-evidence-market:product-variant:live-inspected-board-156',
  title: 'Evidence Market 156 · Live-inspected board',
  variantTitle: '156 cm',
  description:
    'An original challenge listing whose edge condition and repair history are reviewed live before a buyer agent prepares a reversible cart.',
  price: 37_500,
  fulfillment: 4_800,
  total: 42_300,
  currency: 'USD',
  lengthCm: 156,
  inventory: 1,
} as const;

export const cartStatuses = ['active', 'cancelled'] as const;
export type CartStatus = (typeof cartStatuses)[number];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const cartIdPattern = /^urn:webmcp-evidence-market:cart:[0-9a-f-]{36}$/;
const continuationTokenPattern = /^[0-9a-f]{32}$/;

const profileUrlSchema = z.string().url().min(1).max(2_000);
const idempotencyKeySchema = z.string().regex(uuidPattern).max(64);

export const requestMetaSchema = z.strictObject({
  'ucp-agent': z.strictObject({
    profile: profileUrlSchema,
  }),
  'idempotency-key': idempotencyKeySchema,
});

export const readRequestMetaSchema = z.strictObject({
  'ucp-agent': z.strictObject({
    profile: profileUrlSchema,
  }),
});

const cartContextSchema = z.strictObject({
  currency: z.literal('USD').optional(),
  language: z.literal('en-US').optional(),
  intent: z.string().min(1).max(300).optional(),
});

const requestedLineItemSchema = z.strictObject({
  item: z.strictObject({
    id: z.literal(demoProduct.variantId),
  }),
  quantity: z.literal(1),
});

export const requestedCartSchema = z.strictObject({
  line_items: z.tuple([requestedLineItemSchema]),
  context: cartContextSchema.optional(),
});

export const createCartArgumentsSchema = z.strictObject({
  meta: requestMetaSchema,
  cart: requestedCartSchema,
});

export const existingCartArgumentsSchema = z.strictObject({
  meta: requestMetaSchema,
  id: z.string().regex(cartIdPattern).max(160),
});

export const getCartArgumentsSchema = z.strictObject({
  meta: readRequestMetaSchema,
  id: z.string().regex(cartIdPattern).max(160),
});

export const updateCartArgumentsSchema = z.strictObject({
  meta: requestMetaSchema,
  id: z.string().regex(cartIdPattern).max(160),
  cart: requestedCartSchema,
});

export const rpcRequestSchema = z.strictObject({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string().max(160), z.number().finite(), z.null()]),
  method: z.string().min(1).max(160),
  params: z.unknown().optional(),
});

export const rpcNotificationSchema = z.strictObject({
  jsonrpc: z.literal('2.0'),
  method: z.string().min(1).max(160),
  params: z.unknown().optional(),
});

export const toolCallParamsSchema = z.looseObject({
  name: z.string().min(1).max(160),
  arguments: z.unknown(),
});

export const modernRequestMetaSchema = z.strictObject({
  'io.modelcontextprotocol/protocolVersion': z.literal(modernMcpProtocolVersion),
  'io.modelcontextprotocol/clientInfo': z.strictObject({
    name: z.string().min(1).max(160),
    version: z.string().min(1).max(160),
  }),
  'io.modelcontextprotocol/clientCapabilities': z.record(z.string(), z.unknown()),
});

export const storedCartSchema = z.strictObject({
  id: z.string().regex(cartIdPattern),
  continuationToken: z.string().regex(continuationTokenPattern),
  lineId: z.string().min(1).max(160),
  status: z.enum(cartStatuses),
  platformProfileUrl: profileUrlSchema,
  requestDigest: z.string().regex(/^[0-9a-f]{64}$/),
  createIdempotencyKey: idempotencyKeySchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  retentionEndsAt: z.number().int().positive(),
  cancelledAt: z.number().int().positive().nullable(),
});

export type StoredCart = z.infer<typeof storedCartSchema>;

export const idempotencyRecordSchema = z.strictObject({
  operation: z.enum(['create', 'update', 'cancel']),
  cartId: z.string().regex(cartIdPattern),
  requestDigest: z.string().regex(/^[0-9a-f]{64}$/),
  retentionEndsAt: z.number().int().positive(),
});

export type IdempotencyRecord = z.infer<typeof idempotencyRecordSchema>;

const requestMetaInputSchema = {
  type: 'object',
  properties: {
    'ucp-agent': {
      type: 'object',
      properties: {
        profile: {
          type: 'string',
          format: 'uri',
          description: 'Public UCP profile for the invoking agent or platform.',
        },
      },
      required: ['profile'],
      additionalProperties: false,
    },
    'idempotency-key': {
      type: 'string',
      format: 'uuid',
      description: 'Unique request key used to make every mutation retry-safe.',
    },
  },
  required: ['ucp-agent', 'idempotency-key'],
  additionalProperties: false,
} as const;

const readRequestMetaInputSchema = {
  type: 'object',
  properties: {
    'ucp-agent': {
      type: 'object',
      properties: {
        profile: {
          type: 'string',
          format: 'uri',
          description: 'Public UCP profile for the invoking agent or platform.',
        },
      },
      required: ['profile'],
      additionalProperties: false,
    },
  },
  required: ['ucp-agent'],
  additionalProperties: false,
} as const;

const requestedCartInputSchema = {
  type: 'object',
  properties: {
    line_items: {
      type: 'array',
      minItems: 1,
      maxItems: 1,
      items: {
        type: 'object',
        properties: {
          item: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                const: demoProduct.variantId,
              },
            },
            required: ['id'],
            additionalProperties: false,
          },
          quantity: { type: 'integer', const: 1 },
        },
        required: ['item', 'quantity'],
        additionalProperties: false,
      },
    },
    context: {
      type: 'object',
      properties: {
        currency: { type: 'string', const: 'USD' },
        language: { type: 'string', const: 'en-US' },
        intent: {
          type: 'string',
          maxLength: 300,
          description: 'Public action context only; never include buyer identity or constraints.',
        },
      },
      additionalProperties: false,
    },
  },
  required: ['line_items'],
  additionalProperties: false,
} as const;

const cartIdInputSchema = {
  type: 'string',
  pattern: '^urn:webmcp-evidence-market:cart:[0-9a-f-]{36}$',
} as const;

export const cartTools = [
  {
    name: 'cancel_cart',
    title: 'Cancel reversible merchant cart',
    description:
      'Cancel an Evidence Market cart. Requires its private cart ID and a fresh idempotency key. This cannot create an order or charge money.',
    inputSchema: {
      type: 'object',
      properties: { meta: requestMetaInputSchema, id: cartIdInputSchema },
      required: ['meta', 'id'],
      additionalProperties: false,
    },
    annotations: {
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: false,
    },
  },
  {
    name: 'create_cart',
    title: 'Create reversible merchant cart',
    description:
      'Create one authoritative, expiring cart for the original 156 cm demo board. Accepts product and public context only; buyer identity, private price ceilings, addresses, credentials, and payment are rejected.',
    inputSchema: {
      type: 'object',
      properties: { meta: requestMetaInputSchema, cart: requestedCartInputSchema },
      required: ['meta', 'cart'],
      additionalProperties: false,
    },
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: false,
    },
  },
  {
    name: 'get_cart',
    title: 'Inspect merchant cart',
    description:
      'Read the authoritative product, totals, expiry, and status for a private Evidence Market cart ID.',
    inputSchema: {
      type: 'object',
      properties: { meta: readRequestMetaInputSchema, id: cartIdInputSchema },
      required: ['meta', 'id'],
      additionalProperties: false,
    },
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: true,
    },
  },
  {
    name: 'update_cart',
    title: 'Replace merchant cart',
    description:
      'Replace the full contents of an active Evidence Market cart using UCP PUT semantics. This constrained demo accepts exactly one copy of its single variant.',
    inputSchema: {
      type: 'object',
      properties: {
        meta: requestMetaInputSchema,
        id: cartIdInputSchema,
        cart: requestedCartInputSchema,
      },
      required: ['meta', 'id', 'cart'],
      additionalProperties: false,
    },
    annotations: {
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
      readOnlyHint: false,
    },
  },
] as const;

export function merchantProfile(origin: string): object {
  return {
    ucp: {
      version: ucpProtocolVersion,
      services: {
        'dev.ucp.shopping': [
          {
            version: ucpProtocolVersion,
            spec: `https://ucp.dev/${ucpProtocolVersion}/specification/overview/`,
            transport: 'mcp',
            endpoint: `${origin}/api/ucp/mcp`,
            schema: `https://ucp.dev/${ucpProtocolVersion}/services/shopping/mcp.openrpc.json`,
          },
        ],
      },
      capabilities: {
        'dev.ucp.shopping.cart': [
          {
            version: ucpProtocolVersion,
            spec: `https://ucp.dev/${ucpProtocolVersion}/specification/shopping/cart`,
            schema: `https://ucp.dev/${ucpProtocolVersion}/schemas/shopping/cart.json`,
          },
        ],
      },
      payment_handlers: {},
    },
  };
}

export function cartStructuredContent(cart: StoredCart, origin: string): object {
  return {
    ucp: {
      version: ucpProtocolVersion,
      capabilities: {
        'dev.ucp.shopping.cart': [
          {
            version: ucpProtocolVersion,
            spec: `https://ucp.dev/${ucpProtocolVersion}/specification/shopping/cart`,
          },
        ],
      },
    },
    id: cart.id,
    line_items: [
      {
        id: cart.lineId,
        item: {
          id: demoProduct.variantId,
          title: demoProduct.title,
          price: demoProduct.price,
        },
        quantity: 1,
        subtotal: demoProduct.price,
        totals: [
          { type: 'subtotal', display_text: 'Line subtotal', amount: demoProduct.price },
          { type: 'total', display_text: 'Line total', amount: demoProduct.price },
        ],
      },
    ],
    currency: demoProduct.currency,
    totals: [
      { type: 'subtotal', display_text: 'Item subtotal', amount: demoProduct.price },
      {
        type: 'fulfillment',
        display_text: 'Flat shipping',
        amount: demoProduct.fulfillment,
      },
      { type: 'total', display_text: 'Exact total', amount: demoProduct.total },
    ],
    messages: [
      {
        type: 'warning',
        presentation: 'disclosure',
        code: 'demo_no_checkout',
        content:
          'The exact total includes flat shipping and no tax. This reversible challenge merchant cannot accept payment or create an order.',
      },
    ],
    continue_url: `${origin}/cart/c/${cart.continuationToken}`,
    expires_at: new Date(cart.expiresAt).toISOString(),
  };
}

export function ucpErrorStructuredContent(message: string, code: string): object {
  return {
    ucp: { version: ucpProtocolVersion, status: 'error' },
    messages: [{ type: 'error', code, content: message, severity: 'unrecoverable' }],
  };
}

export function validatePublicProfileUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.username.length === 0 &&
    url.password.length === 0 &&
    url.hash.length === 0
  );
}

export function containsPrivateMandate(value: string): boolean {
  return /max(?:imum)?(?:[_ -]?price)?|budget|ceiling|buyer|email|phone|address|postal|payment|credential|card(?:holder|number)?|\$\s*\d/i.test(
    value,
  );
}
