import { z } from 'zod';

import {
  ucpCartCapabilityName,
  ucpDiscoveryProfileSchema,
  ucpProtocolVersion,
  ucpShoppingServiceName,
} from './profile';

export type UcpFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export const ucpClientErrorCodes = [
  'invalid-config',
  'profile-unavailable',
  'profile-invalid',
  'version-incompatible',
  'cart-capability-missing',
  'endpoint-invalid',
  'tools-unavailable',
  'tool-missing',
  'rpc-error',
  'cart-invalid',
] as const;

export type UcpClientErrorCode = (typeof ucpClientErrorCodes)[number];

export class UcpClientError extends Error {
  readonly code: UcpClientErrorCode;
  readonly retryable: boolean;

  constructor(code: UcpClientErrorCode, message: string, retryable = false) {
    super(message);
    this.name = 'UcpClientError';
    this.code = code;
    this.retryable = retryable;
  }
}

const toolDescriptorSchema = z.looseObject({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.unknown(),
});

const toolsListResultSchema = z.looseObject({
  tools: z.array(toolDescriptorSchema),
});

const jsonRpcEnvelopeSchema = z.looseObject({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  result: z.unknown().optional(),
  error: z
    .looseObject({
      code: z.number().int(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

const toolCallResultSchema = z.looseObject({
  structuredContent: z.unknown().optional(),
  content: z
    .array(
      z.looseObject({
        type: z.string(),
        text: z.string().optional(),
      }),
    )
    .optional(),
  isError: z.boolean().optional(),
});

const merchantTotalSchema = z.looseObject({
  type: z.string().min(1),
  display_text: z.string().optional(),
  amount: z.number().int().safe(),
  lines: z
    .array(
      z.looseObject({
        display_text: z.string().min(1),
        amount: z.number().int().safe(),
      }),
    )
    .optional(),
});

const merchantMessageSchema = z.looseObject({
  type: z.string().min(1),
  content: z.string(),
  code: z.string().optional(),
  path: z.string().optional(),
  image_url: z.string().url().optional(),
  url: z.string().url().optional(),
  severity: z.string().optional(),
  presentation: z.string().optional(),
});

const cartResponseSchema = z.looseObject({
  ucp: z.looseObject({
    version: z.string().min(1),
    capabilities: z.record(z.string().min(1), z.array(z.looseObject({ version: z.string() }))),
  }),
  id: z.string().min(1).max(2_000),
  line_items: z.array(
    z.looseObject({
      id: z.string().min(1).max(2_000),
      item: z.looseObject({
        id: z.string().min(1).max(2_000),
        title: z.string().min(1).max(1_000),
        price: z.number().int().safe(),
      }),
      quantity: z.number().int().positive().safe(),
      subtotal: z.number().int().safe().optional(),
    }),
  ),
  currency: z.string().regex(/^[A-Z]{3}$/),
  totals: z.array(merchantTotalSchema).min(1),
  messages: z.array(merchantMessageSchema).optional(),
  continue_url: z.string().url().optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
});

const createCartInputSchema = z.strictObject({
  variantId: z.string().min(1).max(2_000),
  quantity: z.number().int().positive().max(10).default(1),
  context: z
    .strictObject({
      addressCountry: z
        .string()
        .regex(/^[A-Z]{2}$/)
        .optional(),
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .optional(),
      language: z.string().min(2).max(35).optional(),
      intent: z.string().min(1).max(300).optional(),
    })
    .optional(),
});

const maximumResponseCharacters = 2_000_000;
const defaultTimeoutMs = 15_000;

export interface UcpClientOptions {
  readonly businessUrl: string;
  readonly platformProfileUrl: string;
  readonly fetch?: UcpFetch;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface UcpMerchantNegotiation {
  readonly businessOrigin: string;
  readonly endpoint: string;
  readonly protocolVersion: typeof ucpProtocolVersion;
  readonly toolNames: readonly string[];
  readonly createCartInputSchema: unknown;
}

export interface UcpCartLine {
  readonly id: string;
  readonly itemId: string;
  readonly title: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly subtotal: number | null;
}

export interface UcpMerchantTotal {
  readonly type: string;
  readonly displayText: string;
  readonly amount: number;
  readonly lines: readonly {
    readonly displayText: string;
    readonly amount: number;
  }[];
}

export interface UcpMerchantMessage {
  readonly type: string;
  readonly content: string;
  readonly code: string | null;
  readonly path: string | null;
  readonly imageUrl: string | null;
  readonly url: string | null;
  readonly severity: string | null;
  readonly presentation: string | null;
}

export interface UcpCart {
  readonly id: string;
  readonly merchantOrigin: string;
  readonly protocolVersion: typeof ucpProtocolVersion;
  readonly currency: string;
  readonly lineItems: readonly UcpCartLine[];
  readonly totals: readonly UcpMerchantTotal[];
  readonly messages: readonly UcpMerchantMessage[];
  readonly continueUrl: string | null;
  readonly expiresAt: string | null;
}

export interface CreatedUcpCart {
  readonly cart: UcpCart;
  readonly negotiation: UcpMerchantNegotiation;
}

export interface CreateUcpCartOptions extends UcpClientOptions {
  readonly input: z.input<typeof createCartInputSchema>;
  readonly idempotencyKey?: string;
}

export interface CancelUcpCartOptions extends UcpClientOptions {
  readonly cartId: string;
  readonly idempotencyKey?: string;
  readonly negotiation?: UcpMerchantNegotiation;
}

function parseHttpsUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UcpClientError('invalid-config', `${label} must be an absolute HTTPS URL.`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0
  ) {
    throw new UcpClientError('invalid-config', `${label} must be a credential-free HTTPS URL.`);
  }
  return url;
}

function requestSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs ?? defaultTimeoutMs);
  return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
}

async function readBoundedJson(response: Response, code: UcpClientErrorCode): Promise<unknown> {
  const declaredLength = Number.parseInt(response.headers.get('Content-Length') ?? '0', 10);
  if (Number.isFinite(declaredLength) && declaredLength > maximumResponseCharacters) {
    throw new UcpClientError(code, 'The UCP response exceeded the accepted size.', false);
  }
  const text = await response.text();
  if (text.length > maximumResponseCharacters) {
    throw new UcpClientError(code, 'The UCP response exceeded the accepted size.', false);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new UcpClientError(code, 'The UCP response was not valid JSON.', false);
  }
}

async function fetchBusinessProfile(options: UcpClientOptions): Promise<{
  readonly businessOrigin: string;
  readonly profile: z.infer<typeof ucpDiscoveryProfileSchema>;
}> {
  const business = parseHttpsUrl(options.businessUrl, 'Business URL');
  const profileUrl = new URL('/.well-known/ucp', business.origin);
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(profileUrl, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: requestSignal(options.signal, options.timeoutMs),
    });
  } catch {
    throw new UcpClientError(
      'profile-unavailable',
      'The merchant UCP profile could not be reached.',
      true,
    );
  }
  if (!response.ok) {
    throw new UcpClientError(
      'profile-unavailable',
      `The merchant UCP profile returned HTTP ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }
  const value = await readBoundedJson(response, 'profile-invalid');
  const parsed = ucpDiscoveryProfileSchema.safeParse(value);
  if (!parsed.success) {
    throw new UcpClientError('profile-invalid', 'The merchant UCP profile was not valid.');
  }
  return { businessOrigin: business.origin, profile: parsed.data };
}

async function mcpRpc(
  endpoint: string,
  method: 'tools/list' | 'tools/call',
  params: unknown,
  options: UcpClientOptions,
): Promise<unknown> {
  const id = crypto.randomUUID();
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      redirect: 'error',
      signal: requestSignal(options.signal, options.timeoutMs),
    });
  } catch {
    throw new UcpClientError('tools-unavailable', 'The merchant UCP endpoint failed.', true);
  }
  const value = await readBoundedJson(response, 'rpc-error');
  const parsed = jsonRpcEnvelopeSchema.safeParse(value);
  if (!parsed.success || parsed.data.id !== id) {
    throw new UcpClientError('rpc-error', 'The merchant returned an invalid JSON-RPC response.');
  }
  if (parsed.data.error !== undefined) {
    throw new UcpClientError(
      'rpc-error',
      `The merchant refused the UCP operation (${parsed.data.error.code}).`,
      response.status === 429 || response.status >= 500,
    );
  }
  if (!response.ok || parsed.data.result === undefined) {
    throw new UcpClientError(
      'rpc-error',
      `The merchant UCP endpoint returned HTTP ${response.status}.`,
      response.status === 429 || response.status >= 500,
    );
  }
  return parsed.data.result;
}

function schemaRequiresCartEnvelope(inputSchema: unknown): boolean {
  if (typeof inputSchema !== 'object' || inputSchema === null) {
    return false;
  }
  const schema = inputSchema as Record<string, unknown>;
  const properties = schema.properties;
  const required = schema.required;
  return (
    properties !== null &&
    typeof properties === 'object' &&
    'meta' in properties &&
    'cart' in properties &&
    Array.isArray(required) &&
    required.includes('meta') &&
    required.includes('cart')
  );
}

export async function discoverUcpCartMerchant(
  options: UcpClientOptions,
): Promise<UcpMerchantNegotiation> {
  parseHttpsUrl(options.platformProfileUrl, 'Platform profile URL');
  const { businessOrigin, profile } = await fetchBusinessProfile(options);
  const cartCapability = profile.ucp.capabilities[ucpCartCapabilityName];
  if (!cartCapability?.some(({ version }) => version === ucpProtocolVersion)) {
    throw new UcpClientError(
      'cart-capability-missing',
      'The merchant does not advertise the compatible UCP Cart capability.',
    );
  }

  const service = profile.ucp.services[ucpShoppingServiceName]
    ?.filter(
      ({ version, transport }) =>
        version === ucpProtocolVersion && transport.toLowerCase() === 'mcp',
    )
    .at(0);
  if (service === undefined) {
    throw new UcpClientError(
      'version-incompatible',
      `The merchant does not offer MCP shopping at UCP ${ucpProtocolVersion}.`,
    );
  }
  if (service.endpoint === undefined) {
    throw new UcpClientError('endpoint-invalid', 'The negotiated UCP service has no endpoint.');
  }
  const endpoint = parseHttpsUrl(service.endpoint, 'Merchant UCP endpoint');
  if (endpoint.origin !== businessOrigin) {
    throw new UcpClientError(
      'endpoint-invalid',
      'The merchant UCP endpoint must remain on the discovered merchant origin.',
    );
  }

  const result = await mcpRpc(
    endpoint.toString(),
    'tools/list',
    {
      arguments: {
        meta: {
          'ucp-agent': { profile: options.platformProfileUrl },
        },
      },
    },
    options,
  );
  const tools = toolsListResultSchema.safeParse(result);
  if (!tools.success) {
    throw new UcpClientError('tools-unavailable', 'The merchant tool list was invalid.');
  }
  const createCart = tools.data.tools.find(({ name }) => name === 'create_cart');
  const cancelCart = tools.data.tools.find(({ name }) => name === 'cancel_cart');
  if (
    createCart === undefined ||
    cancelCart === undefined ||
    !schemaRequiresCartEnvelope(createCart.inputSchema)
  ) {
    throw new UcpClientError(
      'tool-missing',
      'The negotiated merchant surface cannot safely create and cancel carts.',
    );
  }

  return {
    businessOrigin,
    endpoint: endpoint.toString(),
    protocolVersion: ucpProtocolVersion,
    toolNames: tools.data.tools.map(({ name }) => name).sort(),
    createCartInputSchema: createCart.inputSchema,
  };
}

function createRequestMeta(platformProfileUrl: string, idempotencyKey?: string): object {
  return {
    'ucp-agent': { profile: platformProfileUrl },
    'idempotency-key': idempotencyKey ?? crypto.randomUUID(),
  };
}

function parseJsonTextContent(result: z.infer<typeof toolCallResultSchema>): unknown {
  const text = result.content?.find(
    (candidate) => candidate.type === 'text' && candidate.text !== undefined,
  )?.text;
  if (text === undefined || text.length > maximumResponseCharacters) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function cartFromToolResult(value: unknown): z.infer<typeof cartResponseSchema> {
  const toolResult = toolCallResultSchema.safeParse(value);
  if (!toolResult.success || toolResult.data.isError === true) {
    throw new UcpClientError('cart-invalid', 'The merchant did not return a usable cart.');
  }
  const structured = toolResult.data.structuredContent ?? parseJsonTextContent(toolResult.data);
  const cartValue =
    typeof structured === 'object' && structured !== null && 'cart' in structured
      ? (structured as { readonly cart: unknown }).cart
      : structured;
  const cart = cartResponseSchema.safeParse(cartValue);
  if (!cart.success) {
    throw new UcpClientError('cart-invalid', 'The merchant cart did not match UCP Cart.');
  }
  const negotiatedCart = cart.data.ucp.capabilities[ucpCartCapabilityName];
  if (
    cart.data.ucp.version !== ucpProtocolVersion ||
    !negotiatedCart?.some(({ version }) => version === ucpProtocolVersion)
  ) {
    throw new UcpClientError('cart-invalid', 'The merchant cart changed protocol versions.');
  }
  return cart.data;
}

export async function createUcpCart(options: CreateUcpCartOptions): Promise<CreatedUcpCart> {
  const input = createCartInputSchema.parse(options.input);
  const negotiation = await discoverUcpCartMerchant(options);
  const context = input.context;
  const cartRequest = {
    line_items: [{ item: { id: input.variantId }, quantity: input.quantity }],
    ...(context === undefined
      ? {}
      : {
          context: {
            ...(context.addressCountry === undefined
              ? {}
              : { address_country: context.addressCountry }),
            ...(context.currency === undefined ? {} : { currency: context.currency }),
            ...(context.language === undefined ? {} : { language: context.language }),
            ...(context.intent === undefined ? {} : { intent: context.intent }),
          },
        }),
  };
  const result = await mcpRpc(
    negotiation.endpoint,
    'tools/call',
    {
      name: 'create_cart',
      arguments: {
        meta: createRequestMeta(options.platformProfileUrl, options.idempotencyKey),
        cart: cartRequest,
      },
    },
    options,
  );
  const cart = cartFromToolResult(result);

  return {
    negotiation,
    cart: {
      id: cart.id,
      merchantOrigin: negotiation.businessOrigin,
      protocolVersion: ucpProtocolVersion,
      currency: cart.currency,
      lineItems: cart.line_items.map((line) => ({
        id: line.id,
        itemId: line.item.id,
        title: line.item.title,
        unitPrice: line.item.price,
        quantity: line.quantity,
        subtotal: line.subtotal ?? null,
      })),
      totals: cart.totals.map((total) => ({
        type: total.type,
        displayText: total.display_text ?? total.type,
        amount: total.amount,
        lines: (total.lines ?? []).map((line) => ({
          displayText: line.display_text,
          amount: line.amount,
        })),
      })),
      messages: (cart.messages ?? []).map((message) => ({
        type: message.type,
        content: message.content,
        code: message.code ?? null,
        path: message.path ?? null,
        imageUrl: message.image_url ?? null,
        url: message.url ?? null,
        severity: message.severity ?? null,
        presentation: message.presentation ?? null,
      })),
      continueUrl: cart.continue_url ?? null,
      expiresAt: cart.expires_at ?? null,
    },
  };
}

export async function cancelUcpCart(options: CancelUcpCartOptions): Promise<void> {
  if (options.cartId.length === 0 || options.cartId.length > 2_000) {
    throw new UcpClientError('invalid-config', 'Cart ID must be a bounded non-empty value.');
  }
  const negotiation = options.negotiation ?? (await discoverUcpCartMerchant(options));
  const result = await mcpRpc(
    negotiation.endpoint,
    'tools/call',
    {
      name: 'cancel_cart',
      arguments: {
        meta: createRequestMeta(options.platformProfileUrl, options.idempotencyKey),
        id: options.cartId,
      },
    },
    options,
  );
  const parsed = toolCallResultSchema.safeParse(result);
  if (!parsed.success || parsed.data.isError === true) {
    throw new UcpClientError('rpc-error', 'The merchant did not cancel the cart.', true);
  }
}
