import { env } from 'cloudflare:workers';
import { runDurableObjectAlarm, runInDurableObject, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { MerchantEnv, MerchantLedger } from '../src/index';
import {
  demoProduct,
  modernMcpProtocolVersion,
  storedCartSchema,
  ucpProtocolVersion,
} from '../src/protocol';

const workerEnv = env as unknown as MerchantEnv;
const endpoint = 'https://merchant.example/api/ucp/mcp';
const platformProfile = 'https://room.example/.well-known/ucp';

interface RpcResponse {
  readonly jsonrpc: '2.0';
  readonly id?: string | number | null;
  readonly result?: Readonly<Record<string, unknown>>;
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected an object.');
  }
  return value as Readonly<Record<string, unknown>>;
}

function asArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error('Expected an array.');
  }
  return value;
}

async function responseJson(response: Response): Promise<RpcResponse> {
  const value: unknown = await response.json();
  const record = asRecord(value);
  if (record.jsonrpc !== '2.0') {
    throw new Error('Expected a JSON-RPC response.');
  }
  return value as RpcResponse;
}

function modernMeta(version: string = modernMcpProtocolVersion): object {
  return {
    'io.modelcontextprotocol/protocolVersion': version,
    'io.modelcontextprotocol/clientInfo': { name: 'merchant-worker-test', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

async function rpc(
  method: string,
  params: object,
  options: {
    readonly modern?: boolean;
    readonly name?: string;
    readonly protocolVersion?: string;
    readonly origin?: string;
  } = {},
): Promise<{ readonly response: Response; readonly body: RpcResponse }> {
  const id = crypto.randomUUID();
  const protocolVersion = options.protocolVersion ?? modernMcpProtocolVersion;
  const modern = options.modern === true;
  const requestParams = modern ? { ...params, _meta: modernMeta(protocolVersion) } : params;
  const headers = new Headers({
    Accept: modern ? 'application/json, text/event-stream' : 'application/json',
    'Content-Type': 'application/json',
  });
  if (modern) {
    headers.set('MCP-Protocol-Version', protocolVersion);
    headers.set('Mcp-Method', method);
    if (options.name !== undefined) {
      headers.set('Mcp-Name', options.name);
    }
  }
  if (options.origin !== undefined) {
    headers.set('Origin', options.origin);
  }
  const response = await SELF.fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params: requestParams }),
  });
  return { response, body: await responseJson(response) };
}

function cartRequest(
  idempotencyKey: string,
  overrides: Readonly<Record<string, unknown>> = {},
): object {
  return {
    meta: {
      'ucp-agent': { profile: platformProfile },
      'idempotency-key': idempotencyKey,
    },
    cart: {
      line_items: [{ item: { id: demoProduct.variantId }, quantity: 1 }],
      context: {
        currency: 'USD',
        language: 'en-US',
        intent: 'evidence reviewed; exact-quote hold active; prepare reversible cart only',
      },
    },
    ...overrides,
  };
}

async function callTool(
  name: string,
  args: object,
  modern = false,
): Promise<{ readonly response: Response; readonly body: RpcResponse }> {
  return rpc('tools/call', { name, arguments: args }, { modern, ...(modern ? { name } : {}) });
}

function structured(body: RpcResponse): Readonly<Record<string, unknown>> {
  if (body.result === undefined) {
    throw new Error('Expected a tool result.');
  }
  return asRecord(body.result.structuredContent);
}

function cartFrom(body: RpcResponse): Readonly<Record<string, unknown>> {
  return structured(body);
}

function toolIsError(body: RpcResponse): boolean {
  return body.result?.isError === true;
}

function privateCartId(body: RpcResponse): string {
  const value = cartFrom(body).id;
  if (typeof value !== 'string') {
    throw new Error('Expected a private cart ID.');
  }
  return value;
}

function continuationUrl(body: RpcResponse): string {
  const value = cartFrom(body).continue_url;
  if (typeof value !== 'string') {
    throw new Error('Expected a continuation URL.');
  }
  return value;
}

async function createCart(key = crypto.randomUUID()): Promise<RpcResponse> {
  const { body } = await callTool('create_cart', cartRequest(key));
  expect(toolIsError(body)).toBe(false);
  return body;
}

beforeEach(async () => {
  const stub = workerEnv.MERCHANT.getByName('primary');
  await runInDurableObject(stub, async (_instance: MerchantLedger, state) => {
    await state.storage.deleteAll();
    await state.storage.deleteAlarm();
  });
});

describe('public merchant surface', () => {
  it('publishes the versioned UCP profile and an original Site-Tools product page', async () => {
    const profileResponse = await SELF.fetch('https://merchant.example/.well-known/ucp');
    const profile: unknown = await profileResponse.json();
    const ucp = asRecord(asRecord(profile).ucp);
    const services = asRecord(ucp.services);
    const shopping = asArray(services['dev.ucp.shopping']);
    const service = asRecord(shopping[0]);
    const capabilities = asRecord(ucp.capabilities);
    const cartCapability = asRecord(asArray(capabilities['dev.ucp.shopping.cart'])[0]);

    expect(profileResponse.status).toBe(200);
    expect(ucp.version).toBe(ucpProtocolVersion);
    expect(service.endpoint).toBe(endpoint);
    expect(service.transport).toBe('mcp');
    expect(ucp.payment_handlers).toEqual({});
    expect(Object.keys(capabilities)).toEqual(['dev.ucp.shopping.cart']);
    expect(cartCapability).toMatchObject({
      version: ucpProtocolVersion,
      spec: `https://ucp.dev/${ucpProtocolVersion}/specification/shopping/cart`,
      schema: `https://ucp.dev/${ucpProtocolVersion}/schemas/shopping/cart.json`,
    });
    expect(ucp).not.toHaveProperty('supported_versions');

    const versioned = await SELF.fetch(
      `https://merchant.example/.well-known/ucp/${ucpProtocolVersion}`,
    );
    expect(await versioned.json()).toEqual(profile);

    const product = await SELF.fetch('https://merchant.example/products/live-inspected-board');
    const html = await product.text();
    expect(product.status).toBe(200);
    expect(product.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(product.headers.get('Permissions-Policy')).toContain('payment=()');
    expect(html).toContain('inspect_merchant_product');
    expect(html).toContain('Dual-era MCP');
    expect(html).toContain('$375.00');
    expect(html).toContain('$48.00');
    expect(html).toContain('$423.00');
    expect(html).not.toContain('urn:webmcp-evidence-market:cart:');
  });

  it('exposes bounded agent-readable contracts without leaking a cart credential', async () => {
    const [agents, llms, robots, health] = await Promise.all([
      SELF.fetch('https://merchant.example/agents.md'),
      SELF.fetch('https://merchant.example/llms.txt'),
      SELF.fetch('https://merchant.example/robots.txt'),
      SELF.fetch('https://merchant.example/health'),
    ]);

    expect(await agents.text()).toContain('Never send buyer identity');
    expect(await llms.text()).toContain('No checkout');
    expect(await robots.text()).toContain('Disallow: /cart/c/');
    expect(await health.json()).toMatchObject({ ok: true });
  });
});

describe('dual-era MCP transport', () => {
  it('implements modern discovery, cacheable deterministic tools, and required headers', async () => {
    const discovered = await rpc('server/discover', {}, { modern: true });
    expect(discovered.response.status).toBe(200);
    expect(discovered.body.result).toMatchObject({
      resultType: 'complete',
      supportedVersions: [modernMcpProtocolVersion],
      capabilities: { tools: {} },
      cacheScope: 'public',
    });

    const listed = await rpc('tools/list', {}, { modern: true });
    const tools = asArray(listed.body.result?.tools).map((value) => asRecord(value));
    expect(tools.map(({ name }) => name)).toEqual([
      'cancel_cart',
      'create_cart',
      'get_cart',
      'update_cart',
    ]);
    expect(listed.body.result).toMatchObject({ resultType: 'complete', ttlMs: 300_000 });

    const cancel = tools.find(({ name }) => name === 'cancel_cart');
    const get = tools.find(({ name }) => name === 'get_cart');
    expect(JSON.stringify(cancel)).toContain('idempotency-key');
    expect(JSON.stringify(get)).not.toContain('idempotency-key');
  });

  it('rejects missing, mismatched, and unsupported modern metadata precisely', async () => {
    const missingMethod = await SELF.fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': modernMcpProtocolVersion,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'missing-method',
        method: 'tools/list',
        params: { _meta: modernMeta() },
      }),
    });
    expect(missingMethod.status).toBe(400);
    expect((await responseJson(missingMethod)).error?.code).toBe(-32_020);

    const unsupported = await rpc(
      'tools/list',
      {},
      { modern: true, protocolVersion: '2099-01-01' },
    );
    expect(unsupported.response.status).toBe(400);
    expect(unsupported.body.error).toMatchObject({ code: -32_022 });

    const mismatchedName = await rpc(
      'tools/call',
      { name: 'get_cart', arguments: {} },
      { modern: true, name: 'cancel_cart' },
    );
    expect(mismatchedName.response.status).toBe(400);
    expect(mismatchedName.body.error?.code).toBe(-32_020);

    const unknown = await rpc('not/a-method', {}, { modern: true });
    expect(unknown.response.status).toBe(404);
    expect(unknown.body.error?.code).toBe(-32_601);
  });

  it('also serves the initialization-based MCP era required by current UCP clients', async () => {
    const initialized = await rpc('initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'legacy-ucp-client', version: '1.0.0' },
    });
    expect(initialized.body.result).toMatchObject({
      protocolVersion: '2025-11-25',
      capabilities: { tools: {} },
    });

    const notification = await SELF.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
    });
    expect(notification.status).toBe(202);
    expect(await notification.text()).toBe('');

    const listed = await rpc('tools/list', {
      arguments: { meta: { 'ucp-agent': { profile: platformProfile } } },
    });
    expect(asArray(listed.body.result?.tools)).toHaveLength(4);
    expect(listed.body.result).not.toHaveProperty('resultType');
  });
});

describe('authoritative reversible cart', () => {
  it('creates the exact fixed cart and a private same-origin continuation', async () => {
    const body = await createCart();
    const cart = cartFrom(body);
    const lines = asArray(cart.line_items);
    const line = asRecord(lines[0]);
    const item = asRecord(line.item);
    const totals = asArray(cart.totals).map((value) => asRecord(value));
    const continueUrl = continuationUrl(body);

    expect(cart.currency).toBe('USD');
    expect(item).toMatchObject({
      id: demoProduct.variantId,
      title: demoProduct.title,
      price: 37_500,
    });
    expect(line.quantity).toBe(1);
    expect(totals).toEqual([
      expect.objectContaining({ type: 'subtotal', amount: demoProduct.price }),
      expect.objectContaining({ type: 'fulfillment', amount: demoProduct.fulfillment }),
      expect.objectContaining({ type: 'total', amount: demoProduct.total }),
    ]);
    const result = body.result;
    if (result === undefined) {
      throw new Error('Expected a complete merchant tool result.');
    }
    expect(result.content).toEqual([
      { type: 'text', text: JSON.stringify(result.structuredContent) },
    ]);
    expect(new URL(continueUrl).origin).toBe('https://merchant.example');
    expect(JSON.stringify(body)).not.toMatch(/maximum|budget|ceiling|buyer identity|\$450/i);

    const continuation = await SELF.fetch(continueUrl);
    const html = await continuation.text();
    expect(continuation.status).toBe(200);
    expect(continuation.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    expect(continuation.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(html).toContain('inspect_merchant_cart');
    expect(html).toContain('cancel_merchant_cart');
    expect(html).toContain('This merchant cannot create an order or accept payment.');
    expect(html).not.toContain('proceed_to_checkout');
  });

  it('serializes concurrent retries into one idempotent cart', async () => {
    const key = crypto.randomUUID();
    const results = await Promise.all(
      Array.from({ length: 12 }, () => callTool('create_cart', cartRequest(key))),
    );
    const ids = results.map(({ body }) => privateCartId(body));
    const urls = results.map(({ body }) => continuationUrl(body));

    expect(new Set(ids).size).toBe(1);
    expect(new Set(urls).size).toBe(1);

    const stub = workerEnv.MERCHANT.getByName('primary');
    await runInDurableObject(stub, async (_instance: MerchantLedger, state) => {
      const carts = await state.storage.list({ prefix: 'cart:' });
      expect(carts.size).toBe(1);
    });
  });

  it('rejects changed replays, private mandates, unknown fields, variants, quantities, and profiles', async () => {
    const key = crypto.randomUUID();
    const first = await callTool('create_cart', cartRequest(key));
    expect(toolIsError(first.body)).toBe(false);

    const changed = cartRequest(key);
    const changedRecord = asRecord(changed);
    const changedCart = asRecord(changedRecord.cart);
    const changedContext = { ...asRecord(changedCart.context), intent: 'different public intent' };
    const changedReplay = await callTool('create_cart', {
      ...changedRecord,
      cart: { ...changedCart, context: changedContext },
    });
    expect(toolIsError(changedReplay.body)).toBe(true);

    const privateIntent = cartRequest(crypto.randomUUID());
    const privateRecord = asRecord(privateIntent);
    const privateCart = asRecord(privateRecord.cart);
    const privateAttempt = await callTool('create_cart', {
      ...privateRecord,
      cart: {
        ...privateCart,
        context: { ...asRecord(privateCart.context), intent: 'Maximum price is $450' },
      },
    });
    expect(toolIsError(privateAttempt.body)).toBe(true);
    const privateResult = privateAttempt.body.result;
    if (privateResult === undefined) {
      throw new Error('Expected a UCP business outcome.');
    }
    expect(privateResult.content).toEqual([
      { type: 'text', text: JSON.stringify(privateResult.structuredContent) },
    ]);
    expect(structured(privateAttempt.body)).toMatchObject({
      ucp: { version: ucpProtocolVersion, status: 'error' },
      messages: [{ type: 'error', code: 'invalid_request' }],
    });

    const extraField = await callTool(
      'create_cart',
      cartRequest(crypto.randomUUID(), { maxAllInPrice: 450 }),
    );
    expect(toolIsError(extraField.body)).toBe(true);

    const wrongVariantBase = asRecord(cartRequest(crypto.randomUUID()));
    const wrongVariantCart = asRecord(wrongVariantBase.cart);
    const wrongVariant = await callTool('create_cart', {
      ...wrongVariantBase,
      cart: {
        ...wrongVariantCart,
        line_items: [{ item: { id: 'urn:attacker:variant' }, quantity: 1 }],
      },
    });
    expect(toolIsError(wrongVariant.body)).toBe(true);

    const wrongQuantity = await callTool('create_cart', {
      ...wrongVariantBase,
      cart: {
        ...wrongVariantCart,
        line_items: [{ item: { id: demoProduct.variantId }, quantity: 2 }],
      },
    });
    expect(toolIsError(wrongQuantity.body)).toBe(true);

    const unsafeProfileBase = asRecord(cartRequest(crypto.randomUUID()));
    const unsafeMeta = asRecord(unsafeProfileBase.meta);
    const unsafeProfile = await callTool('create_cart', {
      ...unsafeProfileBase,
      meta: { ...unsafeMeta, 'ucp-agent': { profile: 'http://localhost/profile' } },
    });
    expect(toolIsError(unsafeProfile.body)).toBe(true);
  });

  it('reads without an idempotency key, requires one for mutations, and cancels idempotently', async () => {
    const created = await createCart();
    const cartId = privateCartId(created);
    const get = await callTool('get_cart', {
      meta: { 'ucp-agent': { profile: platformProfile } },
      id: cartId,
    });
    expect(toolIsError(get.body)).toBe(false);
    expect(privateCartId(get.body)).toBe(cartId);

    const missingMutationKey = await callTool('cancel_cart', {
      meta: { 'ucp-agent': { profile: platformProfile } },
      id: cartId,
    });
    expect(toolIsError(missingMutationKey.body)).toBe(true);

    const cancelKey = crypto.randomUUID();
    const cancellation = await callTool('cancel_cart', {
      meta: {
        'ucp-agent': { profile: platformProfile },
        'idempotency-key': cancelKey,
      },
      id: cartId,
    });
    expect(cartFrom(cancellation.body)).toMatchObject({
      id: cartId,
      merchant: {
        cart_status: 'cancelled',
        order_created: false,
        payment_available: false,
      },
    });

    const replay = await callTool('cancel_cart', {
      meta: {
        'ucp-agent': { profile: platformProfile },
        'idempotency-key': cancelKey,
      },
      id: cartId,
    });
    expect(toolIsError(replay.body)).toBe(false);

    const secondKey = await callTool('cancel_cart', {
      meta: {
        'ucp-agent': { profile: platformProfile },
        'idempotency-key': crypto.randomUUID(),
      },
      id: cartId,
    });
    expect(toolIsError(secondKey.body)).toBe(true);
    expect(structured(secondKey.body)).toMatchObject({
      ucp: { version: ucpProtocolVersion, status: 'error' },
      messages: [{ type: 'error', code: 'not_found' }],
    });

    const getAfterCancellation = await callTool('get_cart', {
      meta: { 'ucp-agent': { profile: platformProfile } },
      id: cartId,
    });
    expect(toolIsError(getAfterCancellation.body)).toBe(true);
    expect(structured(getAfterCancellation.body)).toMatchObject({
      messages: [{ code: 'not_found' }],
    });

    const page = await SELF.fetch(continuationUrl(created));
    const html = await page.text();
    expect(html).toContain('This cart was cancelled.');
    expect(html).toContain('disabled');
  });

  it('expires safely and removes retained credentials when its alarm runs', async () => {
    const created = await createCart();
    const cartId = privateCartId(created);
    const continueUrl = continuationUrl(created);
    const stub = workerEnv.MERCHANT.getByName('primary');

    await runInDurableObject(stub, async (_instance: MerchantLedger, state) => {
      const key = `cart:${cartId}`;
      const value: unknown = await state.storage.get(key);
      const cart = storedCartSchema.parse(value);
      await state.storage.put(key, { ...cart, expiresAt: Date.now() - 1 });
    });

    const expiredPage = await SELF.fetch(continueUrl);
    expect(await expiredPage.text()).toContain('This cart expired safely.');
    const expiredGet = await callTool('get_cart', {
      meta: { 'ucp-agent': { profile: platformProfile } },
      id: cartId,
    });
    expect(toolIsError(expiredGet.body)).toBe(true);

    await runInDurableObject(stub, async (_instance: MerchantLedger, state) => {
      const key = `cart:${cartId}`;
      const value: unknown = await state.storage.get(key);
      const cart = storedCartSchema.parse(value);
      await state.storage.put(key, { ...cart, retentionEndsAt: Date.now() - 1 });
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await SELF.fetch(continueUrl)).status).toBe(404);
  });
});

describe('network and parsing boundaries', () => {
  it('accepts a same-host TLS origin behind a local reverse proxy', async () => {
    const response = await SELF.fetch('http://merchant.example/api/ucp/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://merchant.example',
        'X-Forwarded-Host': 'merchant.example',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'same-host-proxy',
        method: 'tools/list',
        params: {},
      }),
    });
    expect(response.status).toBe(200);

    const rewrittenOrigin = await SELF.fetch('http://merchant.example/api/ucp/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://merchant.example',
        'X-Forwarded-Host': 'merchant.example',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'rewritten-origin',
        method: 'tools/list',
        params: {},
      }),
    });
    expect(rewrittenOrigin.status).toBe(200);
  });

  it('rejects hostile browser origins and oversized or malformed requests', async () => {
    const hostile = await rpc('tools/list', {}, { origin: 'https://attacker.example' });
    expect(hostile.response.status).toBe(403);

    const oversized = await SELF.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'large',
        method: 'tools/list',
        params: { padding: 'x'.repeat(66_000) },
      }),
    });
    expect(oversized.status).toBe(413);

    const malformed = await SELF.fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    });
    expect(malformed.status).toBe(400);
    expect((await responseJson(malformed)).error?.code).toBe(-32_700);

    const guessed = await SELF.fetch(
      'https://merchant.example/cart/c/00000000000000000000000000000000',
    );
    expect(guessed.status).toBe(404);
  });
});
