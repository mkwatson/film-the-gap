import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';

import { renderContinuation, renderMerchantHome, type ContinuationStatus } from './pages';
import {
  cartStructuredContent,
  cartTools,
  containsPrivateMandate,
  createCartArgumentsSchema,
  existingCartArgumentsSchema,
  getCartArgumentsSchema,
  idempotencyRecordSchema,
  legacyMcpProtocolVersions,
  merchantProfile,
  merchantServerName,
  merchantServerVersion,
  modernMcpProtocolVersion,
  modernRequestMetaSchema,
  rpcNotificationSchema,
  rpcRequestSchema,
  storedCartSchema,
  toolCallParamsSchema,
  ucpErrorStructuredContent,
  ucpProtocolVersion,
  updateCartArgumentsSchema,
  validatePublicProfileUrl,
  type IdempotencyRecord,
  type StoredCart,
} from './protocol';

export interface MerchantEnv {
  readonly MERCHANT: DurableObjectNamespace<MerchantLedger>;
  readonly CART_TTL_SECONDS?: string;
}

type RpcId = string | number | null;
type RpcRequest = z.infer<typeof rpcRequestSchema>;

const cartKeyPrefix = 'cart:';
const tokenKeyPrefix = 'token:';
const idempotencyKeyPrefix = 'idempotency:';
const maximumRequestCharacters = 65_536;
const maximumRetainedCarts = 500;
const defaultCartTtlSeconds = 1_800;
const retentionMilliseconds = 24 * 60 * 60 * 1_000;
const continuationTokenPattern = /^[0-9a-f]{32}$/;

interface ModernValidation {
  readonly modern: boolean;
  readonly error: Response | null;
}

function jsonResponse(body: object, status = 200, headers?: HeadersInit): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}

function rpcResult(id: RpcId, result: object, status = 200): Response {
  return jsonResponse({ jsonrpc: '2.0', id, result }, status);
}

function rpcError(
  id: RpcId | undefined,
  code: number,
  message: string,
  status = 400,
  data?: object,
): Response {
  return jsonResponse(
    {
      jsonrpc: '2.0',
      ...(id === undefined ? {} : { id }),
      error: { code, message, ...(data === undefined ? {} : { data }) },
    },
    status,
  );
}

function toolResult(id: RpcId, structuredContent: object): Response {
  return rpcResult(id, {
    resultType: 'complete',
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: false,
  });
}

function toolFailure(id: RpcId, message: string, code = 'invalid_request'): Response {
  const structuredContent = ucpErrorStructuredContent(message, code);
  return rpcResult(id, {
    resultType: 'complete',
    content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
    structuredContent,
    isError: true,
  });
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return typeof value === 'object' && value !== null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function publicOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const forwardedProtocol = request.headers.get('X-Forwarded-Proto');
  const forwardedHost = request.headers.get('X-Forwarded-Host');
  const protocol = forwardedProtocol === 'https' ? 'https:' : requestUrl.protocol;
  const host = forwardedHost?.trim() || requestUrl.host;
  return `${protocol}//${host}`;
}

function requestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (origin === null) {
    return true;
  }
  try {
    const actual = new URL(origin);
    const expected = new URL(publicOrigin(request));
    const tlsTerminatedByProxy =
      request.headers.get('X-Forwarded-Proto') === 'https' &&
      [actual.protocol, expected.protocol].every(
        (protocol) => protocol === 'http:' || protocol === 'https:',
      );
    return (
      actual.username.length === 0 &&
      actual.password.length === 0 &&
      actual.hash.length === 0 &&
      actual.host === expected.host &&
      (actual.protocol === expected.protocol || tlsTerminatedByProxy)
    );
  } catch {
    return false;
  }
}

function nonce(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(18)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

function pageResponse(html: string, pageNonce: string, cacheControl: string): Response {
  return new Response(html, {
    headers: {
      'Cache-Control': cacheControl,
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${pageNonce}'; style-src 'nonce-${pageNonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'Content-Type': 'text/html; charset=utf-8',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
    },
  });
}

function cartTtlMilliseconds(env: MerchantEnv): number {
  const parsed = Number.parseInt(env.CART_TTL_SECONDS ?? '', 10);
  const seconds = Number.isFinite(parsed)
    ? Math.min(3_600, Math.max(300, parsed))
    : defaultCartTtlSeconds;
  return seconds * 1_000;
}

function randomHex(byteLength: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cartKey(id: string): string {
  return `${cartKeyPrefix}${id}`;
}

function tokenKey(token: string): string {
  return `${tokenKeyPrefix}${token}`;
}

function idempotencyKey(key: string): string {
  return `${idempotencyKeyPrefix}${key}`;
}

function decodeMcpHeader(value: string): string | null {
  if (!value.startsWith('=?base64?') || !value.endsWith('?=')) {
    return value;
  }
  try {
    const encoded = value.slice(9, -2);
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return null;
  }
}

function modernMetadata(rpc: RpcRequest): unknown {
  return asRecord(rpc.params)?.['_meta'];
}

function validateModernRequest(request: Request, rpc: RpcRequest): ModernValidation {
  const protocolHeader = request.headers.get('MCP-Protocol-Version');
  const metadata = asRecord(modernMetadata(rpc));
  const bodyProtocol = metadata?.['io.modelcontextprotocol/protocolVersion'];
  const modern =
    protocolHeader !== null || bodyProtocol !== undefined || rpc.method === 'server/discover';
  if (!modern) {
    return { modern: false, error: null };
  }

  if (protocolHeader !== modernMcpProtocolVersion || bodyProtocol !== modernMcpProtocolVersion) {
    const requested =
      typeof bodyProtocol === 'string'
        ? bodyProtocol
        : protocolHeader === null
          ? 'missing'
          : protocolHeader;
    return {
      modern: true,
      error:
        protocolHeader !== null && bodyProtocol !== undefined && protocolHeader !== bodyProtocol
          ? rpcError(rpc.id, -32_020, 'Header mismatch: MCP protocol versions differ.', 400)
          : rpcError(rpc.id, -32_022, 'Unsupported protocol version.', 400, {
              supported: [modernMcpProtocolVersion, ...legacyMcpProtocolVersions],
              requested,
            }),
    };
  }

  if (!modernRequestMetaSchema.safeParse(metadata).success) {
    return {
      modern: true,
      error: rpcError(rpc.id, -32_602, 'Invalid request metadata.', 400),
    };
  }

  if (request.headers.get('Mcp-Method') !== rpc.method) {
    return {
      modern: true,
      error: rpcError(rpc.id, -32_020, 'Header mismatch: Mcp-Method must match the body.', 400),
    };
  }

  if (rpc.method === 'tools/call') {
    const name = asRecord(rpc.params)?.['name'];
    const encodedHeader = request.headers.get('Mcp-Name');
    const headerName = encodedHeader === null ? null : decodeMcpHeader(encodedHeader);
    if (typeof name !== 'string' || headerName !== name) {
      return {
        modern: true,
        error: rpcError(rpc.id, -32_020, 'Header mismatch: Mcp-Name must match the body.', 400),
      };
    }
  }

  return { modern: true, error: null };
}

function initializeResult(requestedVersion: unknown): object | null {
  const selected = legacyMcpProtocolVersions.find((version) => version === requestedVersion);
  if (selected === undefined) {
    return null;
  }
  return {
    protocolVersion: selected,
    capabilities: { tools: {} },
    serverInfo: { name: merchantServerName, version: merchantServerVersion },
    instructions:
      'Use create_cart only for the fixed public product after evidence review. This merchant cannot create orders or accept payment.',
  };
}

function discoverResult(): object {
  return {
    resultType: 'complete',
    supportedVersions: [modernMcpProtocolVersion],
    capabilities: { tools: {} },
    _meta: {
      'io.modelcontextprotocol/serverInfo': {
        name: merchantServerName,
        version: merchantServerVersion,
      },
    },
    instructions:
      'Inspect tools before calling. Create only the fixed reversible product cart; never send private buyer constraints, identity, address, credentials, or payment.',
    ttlMs: 300_000,
    cacheScope: 'public',
  };
}

function listToolsResult(modern: boolean): object {
  return {
    ...(modern ? { resultType: 'complete' } : {}),
    tools: cartTools,
    ...(modern ? { ttlMs: 300_000, cacheScope: 'public' } : {}),
  };
}

function cartView(cart: StoredCart, origin: string): object {
  return {
    ...cartStructuredContent(cart, origin),
    merchant: {
      cart_status: cart.status,
      order_created: false,
      payment_available: false,
    },
  };
}

export class MerchantLedger extends DurableObject<MerchantEnv> {
  private readonly state: DurableObjectState;
  private readonly workerEnv: MerchantEnv;
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(state: DurableObjectState, env: MerchantEnv) {
    super(state, env);
    this.state = state;
    this.workerEnv = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const continuationMatch = /^\/cart\/c\/([0-9a-f]{32})$/.exec(url.pathname);
    if (request.method === 'GET' && continuationMatch !== null) {
      const token = continuationMatch[1];
      return token === undefined
        ? jsonResponse({ error: 'not_found' }, 404)
        : this.continuation(request, token);
    }
    if (request.method !== 'POST' || url.pathname !== '/api/ucp/mcp') {
      return jsonResponse({ error: 'not_found' }, 404);
    }
    const task = this.requestQueue.then(
      () => this.handleRpc(request),
      () => this.handleRpc(request),
    );
    this.requestQueue = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }

  async alarm(): Promise<void> {
    const now = Date.now();
    const carts = await this.state.storage.list<unknown>({ prefix: cartKeyPrefix });
    for (const [key, value] of carts) {
      const parsed = storedCartSchema.safeParse(value);
      if (!parsed.success || parsed.data.retentionEndsAt <= now) {
        await this.state.storage.delete(key);
        if (parsed.success) {
          await this.state.storage.delete(tokenKey(parsed.data.continuationToken));
        }
      }
    }
    const records = await this.state.storage.list<unknown>({ prefix: idempotencyKeyPrefix });
    for (const [key, value] of records) {
      const parsed = idempotencyRecordSchema.safeParse(value);
      if (!parsed.success || parsed.data.retentionEndsAt <= now) {
        await this.state.storage.delete(key);
      }
    }
    await this.scheduleAlarm();
  }

  private async handleRpc(request: Request): Promise<Response> {
    if (!requestOriginAllowed(request)) {
      return rpcError(undefined, -32_000, 'Forbidden origin.', 403);
    }
    const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10);
    if (Number.isFinite(declaredLength) && declaredLength > maximumRequestCharacters) {
      return rpcError(undefined, -32_600, 'Request body is too large.', 413);
    }
    const text = await request.text();
    if (text.length > maximumRequestCharacters) {
      return rpcError(undefined, -32_600, 'Request body is too large.', 413);
    }
    const value = parseJson(text);
    const requestMessage = rpcRequestSchema.safeParse(value);
    if (!requestMessage.success) {
      const notification = rpcNotificationSchema.safeParse(value);
      if (notification.success && notification.data.method === 'notifications/initialized') {
        return new Response(null, { status: 202, headers: { 'Cache-Control': 'no-store' } });
      }
      return rpcError(
        undefined,
        value === null ? -32_700 : -32_600,
        'Invalid JSON-RPC request.',
        400,
      );
    }
    const rpc = requestMessage.data;
    const validation = validateModernRequest(request, rpc);
    if (validation.error !== null) {
      return validation.error;
    }

    if (rpc.method === 'server/discover') {
      return rpcResult(rpc.id, discoverResult());
    }
    if (rpc.method === 'initialize') {
      const requestedVersion = asRecord(rpc.params)?.['protocolVersion'];
      const result = initializeResult(requestedVersion);
      return result === null
        ? rpcError(rpc.id, -32_022, 'Unsupported protocol version.', 400, {
            supported: [...legacyMcpProtocolVersions],
            requested: typeof requestedVersion === 'string' ? requestedVersion : 'missing',
          })
        : rpcResult(rpc.id, result);
    }
    if (rpc.method === 'tools/list') {
      return rpcResult(rpc.id, listToolsResult(validation.modern));
    }
    if (rpc.method !== 'tools/call') {
      return rpcError(rpc.id, -32_601, 'Method not found.', validation.modern ? 404 : 400);
    }

    const call = toolCallParamsSchema.safeParse(rpc.params);
    if (!call.success) {
      return rpcError(rpc.id, -32_602, 'Invalid tool-call parameters.', 400);
    }
    switch (call.data.name) {
      case 'create_cart':
        return this.createCart(rpc.id, call.data.arguments, request);
      case 'get_cart':
        return this.getCart(rpc.id, call.data.arguments, request);
      case 'update_cart':
        return this.updateCart(rpc.id, call.data.arguments, request);
      case 'cancel_cart':
        return this.cancelCart(rpc.id, call.data.arguments, request);
      default:
        return rpcError(rpc.id, -32_602, 'Unknown merchant tool.', 400);
    }
  }

  private async createCart(id: RpcId, value: unknown, request: Request): Promise<Response> {
    const parsed = createCartArgumentsSchema.safeParse(value);
    if (!parsed.success) {
      return toolFailure(
        id,
        'Invalid cart request. Only the fixed public variant and bounded public context are accepted.',
      );
    }
    const profile = parsed.data.meta['ucp-agent'].profile;
    const intent = parsed.data.cart.context?.intent;
    if (
      !validatePublicProfileUrl(profile) ||
      (intent !== undefined && containsPrivateMandate(intent))
    ) {
      return toolFailure(
        id,
        'Private buyer data and non-public agent profiles are forbidden at this merchant boundary.',
      );
    }

    const key = parsed.data.meta['idempotency-key'];
    const digest = await sha256Hex(
      JSON.stringify({ operation: 'create', profile, cart: parsed.data.cart }),
    );
    const replay = await this.readIdempotency(key);
    if (replay !== null) {
      if (replay.operation !== 'create' || replay.requestDigest !== digest) {
        return toolFailure(id, 'That idempotency key was already used for a different mutation.');
      }
      const existing = await this.readCart(replay.cartId);
      if (existing === null || this.status(existing) !== 'active') {
        return toolFailure(id, 'The original idempotent cart is no longer active.');
      }
      return toolResult(id, cartView(existing, publicOrigin(request)));
    }

    await this.pruneExpiredRecords();
    const retained = await this.state.storage.list<unknown>({ prefix: cartKeyPrefix });
    if (retained.size >= maximumRetainedCarts) {
      return toolFailure(id, 'The merchant is temporarily at its bounded cart capacity.');
    }

    const now = Date.now();
    const cartUuid = crypto.randomUUID();
    const cart: StoredCart = {
      id: `urn:webmcp-evidence-market:cart:${cartUuid}`,
      continuationToken: randomHex(16),
      lineId: `urn:webmcp-evidence-market:cart-line:${crypto.randomUUID()}`,
      status: 'active',
      platformProfileUrl: profile,
      requestDigest: digest,
      createIdempotencyKey: key,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + cartTtlMilliseconds(this.workerEnv),
      retentionEndsAt: now + retentionMilliseconds,
      cancelledAt: null,
    };
    const record: IdempotencyRecord = {
      operation: 'create',
      cartId: cart.id,
      requestDigest: digest,
      retentionEndsAt: cart.retentionEndsAt,
    };
    await this.state.storage.put({
      [cartKey(cart.id)]: cart,
      [tokenKey(cart.continuationToken)]: cart.id,
      [idempotencyKey(key)]: record,
    });
    await this.scheduleAlarm();
    return toolResult(id, cartView(cart, publicOrigin(request)));
  }

  private async getCart(id: RpcId, value: unknown, request: Request): Promise<Response> {
    const parsed = getCartArgumentsSchema.safeParse(value);
    if (!parsed.success || !validatePublicProfileUrl(parsed.data.meta['ucp-agent'].profile)) {
      return toolFailure(id, 'Invalid private cart lookup.');
    }
    const cart = await this.readCart(parsed.data.id);
    if (cart === null) {
      return toolFailure(id, 'Cart not found.', 'not_found');
    }
    const status = this.status(cart);
    if (status !== 'active') {
      return toolFailure(id, 'Cart not found.', 'not_found');
    }
    return toolResult(id, cartView(cart, publicOrigin(request)));
  }

  private async updateCart(id: RpcId, value: unknown, request: Request): Promise<Response> {
    const parsed = updateCartArgumentsSchema.safeParse(value);
    if (!parsed.success) {
      return toolFailure(id, 'Invalid full-cart replacement.');
    }
    const profile = parsed.data.meta['ucp-agent'].profile;
    const intent = parsed.data.cart.context?.intent;
    if (
      !validatePublicProfileUrl(profile) ||
      (intent !== undefined && containsPrivateMandate(intent))
    ) {
      return toolFailure(id, 'Private buyer data is forbidden at this merchant boundary.');
    }
    const cart = await this.readCart(parsed.data.id);
    if (cart === null || this.status(cart) !== 'active') {
      return toolFailure(id, 'Cart not found.', 'not_found');
    }
    const key = parsed.data.meta['idempotency-key'];
    const digest = await sha256Hex(
      JSON.stringify({ operation: 'update', profile, id: cart.id, cart: parsed.data.cart }),
    );
    const replay = await this.readIdempotency(key);
    if (replay !== null) {
      return replay.operation === 'update' &&
        replay.cartId === cart.id &&
        replay.requestDigest === digest
        ? toolResult(id, cartView(cart, publicOrigin(request)))
        : toolFailure(id, 'That idempotency key was already used for a different mutation.');
    }
    const updated: StoredCart = { ...cart, updatedAt: Date.now() };
    const record: IdempotencyRecord = {
      operation: 'update',
      cartId: cart.id,
      requestDigest: digest,
      retentionEndsAt: cart.retentionEndsAt,
    };
    await this.state.storage.put({
      [cartKey(cart.id)]: updated,
      [idempotencyKey(key)]: record,
    });
    return toolResult(id, cartView(updated, publicOrigin(request)));
  }

  private async cancelCart(id: RpcId, value: unknown, request: Request): Promise<Response> {
    const parsed = existingCartArgumentsSchema.safeParse(value);
    if (!parsed.success || !validatePublicProfileUrl(parsed.data.meta['ucp-agent'].profile)) {
      return toolFailure(id, 'Invalid cart cancellation.');
    }
    const cart = await this.readCart(parsed.data.id);
    if (cart === null) {
      return toolFailure(id, 'Cart not found.', 'not_found');
    }
    const key = parsed.data.meta['idempotency-key'];
    const digest = await sha256Hex(JSON.stringify({ operation: 'cancel', id: cart.id }));
    const replay = await this.readIdempotency(key);
    if (replay !== null) {
      return replay.operation === 'cancel' &&
        replay.cartId === cart.id &&
        replay.requestDigest === digest
        ? toolResult(id, cartView({ ...cart, status: 'cancelled' }, publicOrigin(request)))
        : toolFailure(id, 'That idempotency key was already used for a different mutation.');
    }
    if (this.status(cart) !== 'active') {
      return toolFailure(id, 'Cart not found.', 'not_found');
    }
    const now = Date.now();
    const cancelled: StoredCart =
      cart.status === 'cancelled'
        ? cart
        : { ...cart, status: 'cancelled', updatedAt: now, cancelledAt: now };
    const record: IdempotencyRecord = {
      operation: 'cancel',
      cartId: cart.id,
      requestDigest: digest,
      retentionEndsAt: cart.retentionEndsAt,
    };
    await this.state.storage.put({
      [cartKey(cart.id)]: cancelled,
      [idempotencyKey(key)]: record,
    });
    await this.scheduleAlarm();
    return toolResult(id, cartView(cancelled, publicOrigin(request)));
  }

  private async continuation(request: Request, token: string): Promise<Response> {
    if (!continuationTokenPattern.test(token)) {
      return jsonResponse({ error: 'not_found' }, 404);
    }
    const id: unknown = await this.state.storage.get(tokenKey(token));
    if (typeof id !== 'string') {
      return jsonResponse({ error: 'not_found' }, 404);
    }
    const cart = await this.readCart(id);
    if (cart === null || cart.retentionEndsAt <= Date.now()) {
      return jsonResponse({ error: 'not_found' }, 404);
    }
    const pageNonce = nonce();
    const status = this.status(cart);
    return pageResponse(
      renderContinuation(cart, status, publicOrigin(request), pageNonce),
      pageNonce,
      'no-store, max-age=0',
    );
  }

  private status(cart: StoredCart): ContinuationStatus {
    if (cart.status === 'cancelled') {
      return 'cancelled';
    }
    return cart.expiresAt <= Date.now() ? 'expired' : 'active';
  }

  private async readCart(id: string): Promise<StoredCart | null> {
    const value: unknown = await this.state.storage.get(cartKey(id));
    const parsed = storedCartSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
  }

  private async readIdempotency(key: string): Promise<IdempotencyRecord | null> {
    const value: unknown = await this.state.storage.get(idempotencyKey(key));
    const parsed = idempotencyRecordSchema.safeParse(value);
    if (!parsed.success || parsed.data.retentionEndsAt <= Date.now()) {
      return null;
    }
    return parsed.data;
  }

  private async pruneExpiredRecords(): Promise<void> {
    const now = Date.now();
    const carts = await this.state.storage.list<unknown>({ prefix: cartKeyPrefix });
    for (const [key, value] of carts) {
      const parsed = storedCartSchema.safeParse(value);
      if (!parsed.success || parsed.data.retentionEndsAt <= now) {
        await this.state.storage.delete(key);
        if (parsed.success) {
          await this.state.storage.delete(tokenKey(parsed.data.continuationToken));
        }
      }
    }
  }

  private async scheduleAlarm(): Promise<void> {
    const now = Date.now();
    const candidates: number[] = [];
    const carts = await this.state.storage.list<unknown>({ prefix: cartKeyPrefix });
    for (const value of carts.values()) {
      const parsed = storedCartSchema.safeParse(value);
      if (!parsed.success) {
        continue;
      }
      if (parsed.data.status === 'active' && parsed.data.expiresAt > now) {
        candidates.push(parsed.data.expiresAt);
      } else if (parsed.data.retentionEndsAt > now) {
        candidates.push(parsed.data.retentionEndsAt);
      }
    }
    const records = await this.state.storage.list<unknown>({ prefix: idempotencyKeyPrefix });
    for (const value of records.values()) {
      const parsed = idempotencyRecordSchema.safeParse(value);
      if (parsed.success && parsed.data.retentionEndsAt > now) {
        candidates.push(parsed.data.retentionEndsAt);
      }
    }
    if (candidates.length === 0) {
      await this.state.storage.deleteAlarm();
      return;
    }
    await this.state.storage.setAlarm(Math.min(...candidates));
  }
}

function profileResponse(origin: string): Response {
  return jsonResponse(merchantProfile(origin), 200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300',
  });
}

function textResponse(body: string, contentType = 'text/plain; charset=utf-8'): Response {
  return new Response(body, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default {
  async fetch(request: Request, env: MerchantEnv): Promise<Response> {
    const url = new URL(request.url);
    const origin = publicOrigin(request);

    if (
      request.method === 'GET' &&
      (url.pathname === '/.well-known/ucp' ||
        url.pathname === `/.well-known/ucp/${ucpProtocolVersion}`)
    ) {
      return profileResponse(origin);
    }
    if (
      request.method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/products/live-inspected-board')
    ) {
      const pageNonce = nonce();
      return pageResponse(renderMerchantHome(origin, pageNonce), pageNonce, 'public, max-age=60');
    }
    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: merchantServerName,
        version: merchantServerVersion,
      });
    }
    if (request.method === 'GET' && url.pathname === '/robots.txt') {
      return textResponse('User-agent: *\nAllow: /\nDisallow: /cart/c/\n');
    }
    if (request.method === 'GET' && url.pathname === '/llms.txt') {
      return textResponse(
        `# Evidence Market Merchant\n\nOriginal challenge merchant for one reversible UCP cart.\n\n- Product: ${origin}/products/live-inspected-board\n- UCP profile: ${origin}/.well-known/ucp\n- No checkout, order creation, payment, or collection of private buyer mandates.\n`,
      );
    }
    if (request.method === 'GET' && url.pathname === '/agents.md') {
      return textResponse(
        `# Agent contract\n\nDiscover ${origin}/.well-known/ucp. Only create a cart after evidence review and an exact-price reversible hold. Never send buyer identity, maximum budget, address, credentials, or payment. The private continuation can inspect or cancel; it cannot order or pay.\n`,
        'text/markdown; charset=utf-8',
      );
    }
    if (request.method === 'OPTIONS' && url.pathname === '/api/ucp/mcp') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Headers':
            'Accept, Content-Type, MCP-Protocol-Version, Mcp-Method, Mcp-Name',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Origin': origin,
          'Cache-Control': 'no-store',
          Vary: 'Origin',
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/api/ucp/mcp') {
      const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10);
      if (Number.isFinite(declaredLength) && declaredLength > maximumRequestCharacters) {
        return rpcError(undefined, -32_600, 'Request body is too large.', 413);
      }
      const body = await request.text();
      if (body.length > maximumRequestCharacters) {
        return rpcError(undefined, -32_600, 'Request body is too large.', 413);
      }
      return env.MERCHANT.getByName('primary').fetch(
        new Request(request.url, {
          method: 'POST',
          headers: request.headers,
          body,
        }),
      );
    }
    if (request.method === 'GET' && url.pathname.startsWith('/cart/c/')) {
      return env.MERCHANT.getByName('primary').fetch(request);
    }
    return jsonResponse({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler<MerchantEnv>;
