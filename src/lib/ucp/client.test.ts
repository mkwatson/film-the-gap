// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  cancelUcpCart,
  createUcpCart,
  discoverUcpCartMerchant,
  UcpClientError,
  type UcpFetch,
} from './client';
import { ucpCartCapabilityName, ucpProtocolVersion } from './profile';

const businessUrl = 'https://merchant.example';
const endpoint = 'https://merchant.example/api/ucp/mcp';
const platformProfileUrl = 'https://platform.example/.well-known/ucp';
const variantId = 'gid://shopify/ProductVariant/51510885581120';

interface RecordedRequest {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
}

interface MockMerchantOptions {
  readonly includeCreateCart?: boolean;
  readonly cartProtocolVersion?: string;
  readonly continueUrl?: string;
  readonly cartResponse?: object;
  readonly cancelNotFound?: boolean;
  readonly wrapCartResponse?: boolean;
}

function businessProfile(): object {
  return {
    ucp: {
      version: ucpProtocolVersion,
      services: {
        'dev.ucp.shopping': [
          {
            version: ucpProtocolVersion,
            spec: `https://ucp.dev/${ucpProtocolVersion}/specification/overview`,
            schema: `https://ucp.dev/${ucpProtocolVersion}/services/shopping/mcp.openrpc.json`,
            transport: 'mcp',
            endpoint,
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
  };
}

function toolSchema(): object {
  return {
    type: 'object',
    properties: {
      meta: { type: 'object' },
      cart: { type: 'object' },
    },
    required: ['meta', 'cart'],
  };
}

function cartResponse(
  protocolVersion: string = ucpProtocolVersion,
  continueUrl = 'https://merchant.example/cart/c/test-cart',
): object {
  return {
    ucp: {
      version: protocolVersion,
      capabilities: {
        [ucpCartCapabilityName]: [{ version: protocolVersion }],
      },
    },
    id: 'gid://shopify/Cart/test-cart',
    line_items: [
      {
        id: 'gid://shopify/CartLine/test-line',
        item: {
          id: variantId,
          title: 'Rights-cleared 156 cm demo board',
          price: 38995,
        },
        quantity: 1,
        subtotal: 38995,
      },
    ],
    currency: 'USD',
    totals: [
      { type: 'subtotal', display_text: 'Subtotal', amount: 38995 },
      { type: 'total', display_text: 'Total', amount: 38995 },
    ],
    messages: [
      {
        type: 'warning',
        presentation: 'notice',
        content: 'Shipping is finalized during checkout.',
      },
    ],
    continue_url: continueUrl,
  };
}

function jsonRpcRequest(body: BodyInit | null | undefined): {
  readonly id: string | number;
  readonly method: string;
  readonly params: unknown;
} {
  if (typeof body !== 'string') {
    throw new Error('Expected a JSON string request body.');
  }
  const value: unknown = JSON.parse(body);
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected a JSON-RPC request object.');
  }
  const record = value as Record<string, unknown>;
  if (
    (typeof record.id !== 'string' && typeof record.id !== 'number') ||
    typeof record.method !== 'string'
  ) {
    throw new Error('Expected a JSON-RPC id and method.');
  }
  return { id: record.id, method: record.method, params: record.params };
}

function recordedRequestParams(request: RecordedRequest | undefined): unknown {
  const body = request?.body;
  if (typeof body !== 'object' || body === null || !('params' in body)) {
    throw new Error('Expected a recorded JSON-RPC request with params.');
  }
  return body.params;
}

function mockMerchant(options: MockMerchantOptions = {}): {
  readonly fetch: UcpFetch;
  readonly requests: readonly RecordedRequest[];
} {
  const requests: RecordedRequest[] = [];
  const fetch: UcpFetch = async (input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      requests.push({ url, method, body: null });
      return Response.json(businessProfile());
    }
    const request = jsonRpcRequest(init?.body);
    requests.push({ url, method, body: request });
    if (request.method === 'tools/list') {
      const tools = [
        ...(options.includeCreateCart === false
          ? []
          : [{ name: 'create_cart', description: 'Create a cart.', inputSchema: toolSchema() }]),
        { name: 'cancel_cart', description: 'Cancel a cart.', inputSchema: {} },
      ];
      return Response.json({ jsonrpc: '2.0', id: request.id, result: { tools } });
    }
    const params = request.params as { readonly name?: unknown };
    if (params.name === 'create_cart') {
      const cart =
        options.cartResponse ?? cartResponse(options.cartProtocolVersion, options.continueUrl);
      return Response.json({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          structuredContent: options.wrapCartResponse === true ? { cart } : cart,
        },
      });
    }
    if (params.name === 'cancel_cart' && options.cancelNotFound === true) {
      const structuredContent = {
        ucp: { version: ucpProtocolVersion, status: 'error' },
        messages: [
          {
            type: 'error',
            code: 'not_found',
            content: 'Cart not found.',
            severity: 'unrecoverable',
          },
        ],
      };
      return Response.json({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          structuredContent,
          content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
          isError: true,
        },
      });
    }
    return Response.json({
      jsonrpc: '2.0',
      id: request.id,
      result: { structuredContent: { ucp: { status: 'success' } } },
    });
  };
  return { fetch, requests };
}

describe('UCP Cart client', () => {
  it('negotiates the live profile version and minimal merchant tool surface', async () => {
    const merchant = mockMerchant();

    const negotiation = await discoverUcpCartMerchant({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
    });

    expect(negotiation).toMatchObject({
      businessOrigin: businessUrl,
      endpoint,
      protocolVersion: ucpProtocolVersion,
      toolNames: ['cancel_cart', 'create_cart'],
    });
    expect(JSON.stringify(merchant.requests[1]?.body)).toContain(platformProfileUrl);
  });

  it('creates a merchant cart without buyer identity, budget, address, or payment', async () => {
    const merchant = mockMerchant();

    const created = await createUcpCart({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
      idempotencyKey: 'create-test-idempotency-key',
      input: {
        variantId,
        context: {
          addressCountry: 'US',
          currency: 'USD',
          language: 'en-US',
          intent: 'reviewed evidence requirements satisfied before cart handoff',
        },
      },
    });

    expect(created.cart).toMatchObject({
      protocolVersion: ucpProtocolVersion,
      currency: 'USD',
      merchantOrigin: businessUrl,
      totals: [
        { type: 'subtotal', displayText: 'Subtotal', amount: 38995 },
        { type: 'total', displayText: 'Total', amount: 38995 },
      ],
      continueUrl: 'https://merchant.example/cart/c/test-cart',
    });
    const callParams = JSON.stringify(recordedRequestParams(merchant.requests[2]));
    expect(callParams).toContain('create_cart');
    expect(callParams).toContain(variantId);
    expect(callParams).not.toMatch(/450|maximum|buyer|email|postal|payment|credential/i);
  });

  it('preserves merchant messages and total order without recomputing them', async () => {
    const merchant = mockMerchant();

    const created = await createUcpCart({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
      input: { variantId },
    });

    expect(created.cart.totals.map(({ displayText }) => displayText)).toEqual([
      'Subtotal',
      'Total',
    ]);
    expect(created.cart.messages).toEqual([
      expect.objectContaining({
        type: 'warning',
        presentation: 'notice',
        content: 'Shipping is finalized during checkout.',
      }),
    ]);
  });

  it('accepts the older wrapped Cart response during negotiated merchant migration', async () => {
    const merchant = mockMerchant({ wrapCartResponse: true });

    const created = await createUcpCart({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
      input: { variantId },
    });

    expect(created.cart).toMatchObject({
      protocolVersion: ucpProtocolVersion,
      continueUrl: 'https://merchant.example/cart/c/test-cart',
    });
  });

  it('refuses a merchant that omits a safely cancelable Cart surface', async () => {
    const merchant = mockMerchant({ includeCreateCart: false });

    await expect(
      discoverUcpCartMerchant({ businessUrl, platformProfileUrl, fetch: merchant.fetch }),
    ).rejects.toMatchObject({ code: 'tool-missing' } satisfies Partial<UcpClientError>);
  });

  it('uses portable manual redirect handling and refuses redirected discovery', async () => {
    const fetch: UcpFetch = async (_input, init) => {
      expect(init?.redirect).toBe('manual');
      return new Response(null, {
        status: 302,
        headers: { Location: 'https://attacker.example/.well-known/ucp' },
      });
    };

    await expect(
      discoverUcpCartMerchant({ businessUrl, platformProfileUrl, fetch }),
    ).rejects.toMatchObject({ code: 'profile-unavailable' } satisfies Partial<UcpClientError>);
  });

  it('refuses a cart response that changes the negotiated protocol version', async () => {
    const merchant = mockMerchant({ cartProtocolVersion: '2026-01-23' });

    await expect(
      createUcpCart({
        businessUrl,
        platformProfileUrl,
        fetch: merchant.fetch,
        input: { variantId },
      }),
    ).rejects.toMatchObject({ code: 'cart-invalid' } satisfies Partial<UcpClientError>);
  });

  it('refuses a cart continuation that leaves the negotiated merchant origin', async () => {
    const merchant = mockMerchant({
      continueUrl: 'https://attacker.example/cart/c/stolen-cart',
    });

    await expect(
      createUcpCart({
        businessUrl,
        platformProfileUrl,
        fetch: merchant.fetch,
        input: { variantId },
      }),
    ).rejects.toMatchObject({ code: 'cart-invalid' } satisfies Partial<UcpClientError>);
  });

  it('refuses merchant-authored receipts that exceed the public room bounds', async () => {
    const merchant = mockMerchant({
      cartResponse: {
        ...cartResponse(),
        messages: Array.from({ length: 31 }, (_, index) => ({
          type: 'warning',
          content: `Merchant message ${index + 1}`,
        })),
      },
    });

    await expect(
      createUcpCart({
        businessUrl,
        platformProfileUrl,
        fetch: merchant.fetch,
        input: { variantId },
      }),
    ).rejects.toMatchObject({ code: 'cart-invalid' } satisfies Partial<UcpClientError>);
  });

  it('cancels with a fresh idempotency key and no payment fields', async () => {
    const merchant = mockMerchant();
    const negotiation = await discoverUcpCartMerchant({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
    });

    await cancelUcpCart({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
      cartId: 'gid://shopify/Cart/test-cart',
      idempotencyKey: 'cancel-test-idempotency-key',
      negotiation,
    });

    const callBody = JSON.stringify(merchant.requests.at(-1)?.body);
    expect(callBody).toContain('cancel_cart');
    expect(callBody).toContain('cancel-test-idempotency-key');
    expect(callBody).not.toMatch(/buyer|email|payment|credential/i);
  });

  it('treats UCP not_found as an already-closed cancellation outcome', async () => {
    const merchant = mockMerchant({ cancelNotFound: true });
    const negotiation = await discoverUcpCartMerchant({
      businessUrl,
      platformProfileUrl,
      fetch: merchant.fetch,
    });

    await expect(
      cancelUcpCart({
        businessUrl,
        platformProfileUrl,
        fetch: merchant.fetch,
        cartId: 'gid://shopify/Cart/test-cart',
        negotiation,
      }),
    ).resolves.toBeUndefined();
  });
});
