interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id: string | number;
  readonly method: string;
  readonly params?: unknown;
}

function json(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function parseJsonRpc(value: unknown): JsonRpcRequest | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.jsonrpc !== '2.0' ||
    (typeof record.id !== 'string' && typeof record.id !== 'number') ||
    typeof record.method !== 'string'
  ) {
    return null;
  }
  return {
    jsonrpc: '2.0',
    id: record.id,
    method: record.method,
    params: record.params,
  };
}

function rpcResult(id: string | number, result: object): Response {
  return json({ jsonrpc: '2.0', id, result });
}

function rpcError(id: string | number, code: number, message: string): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message } });
}

function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const forwardedProtocol = request.headers.get('X-Forwarded-Proto');
  const protocol = forwardedProtocol === 'https' ? 'https:' : url.protocol;
  return `${protocol}//${request.headers.get('Host') ?? url.host}`;
}

function merchantProfile(origin: string): object {
  return {
    ucp: {
      version: '2026-08-25',
      services: {
        'dev.ucp.shopping': [
          {
            version: '2026-08-25',
            transport: 'mcp',
            endpoint: `${origin}/api/ucp/mcp`,
          },
        ],
      },
      capabilities: {
        'dev.ucp.shopping.cart': [{ version: '2026-08-25' }],
      },
      payment_handlers: {},
    },
  };
}

function tools(): object {
  return {
    tools: [
      {
        name: 'create_cart',
        description: 'Create a reversible demonstration cart.',
        inputSchema: {
          type: 'object',
          properties: { meta: { type: 'object' }, cart: { type: 'object' } },
          required: ['meta', 'cart'],
        },
      },
      {
        name: 'cancel_cart',
        description: 'Cancel a demonstration cart.',
        inputSchema: { type: 'object' },
      },
    ],
  };
}

function createdCart(origin: string): object {
  return {
    structuredContent: {
      ucp: {
        version: '2026-08-25',
        capabilities: {
          'dev.ucp.shopping.cart': [{ version: '2026-08-25' }],
        },
      },
      id: 'gid://shopify/Cart/manual-browser-fixture',
      line_items: [
        {
          id: 'gid://shopify/CartLine/manual-browser-fixture',
          item: {
            id: 'gid://shopify/ProductVariant/manual-browser-fixture',
            title: 'Rights-cleared 156 cm demo board',
            price: 37500,
          },
          quantity: 1,
          subtotal: 37500,
        },
      ],
      currency: 'USD',
      totals: [
        { type: 'subtotal', display_text: 'Item subtotal', amount: 37500 },
        { type: 'fulfillment', display_text: 'Flat shipping', amount: 4800 },
        { type: 'total', display_text: 'Exact total', amount: 42300 },
      ],
      messages: [
        {
          type: 'warning',
          content: 'Fixture only: no checkout or payment capability.',
        },
      ],
      continue_url: `${origin}/cart/c/manual-browser-fixture`,
    },
  };
}

function handoffPage(): Response {
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>UCP fixture handoff</title><body><main><h1>Reversible UCP fixture</h1><p>This local acceptance merchant cannot check out or take payment.</p></main></body></html>`;
  return new Response(html, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = publicOrigin(request);
    if (request.method === 'GET' && url.pathname === '/.well-known/ucp') {
      return json(merchantProfile(origin));
    }
    if (request.method === 'GET' && url.pathname === '/cart/c/manual-browser-fixture') {
      return handoffPage();
    }
    if (request.method !== 'POST' || url.pathname !== '/api/ucp/mcp') {
      return json({ error: 'not_found' }, 404);
    }

    const text = await request.text();
    const rpc = parseJsonRpc(JSON.parse(text) as unknown);
    if (rpc === null) {
      return json({ error: 'invalid_json_rpc' }, 400);
    }
    if (/maxAllInPrice|maximum|buyer|email|address_|postal|payment|credential/i.test(text)) {
      return rpcError(rpc.id, -32_600, 'A forbidden private field crossed the fixture boundary.');
    }
    if (rpc.method === 'tools/list') {
      return rpcResult(rpc.id, tools());
    }
    if (rpc.method !== 'tools/call' || typeof rpc.params !== 'object' || rpc.params === null) {
      return rpcError(rpc.id, -32_601, 'Unknown fixture operation.');
    }

    const params = rpc.params as Record<string, unknown>;
    if (params.name === 'create_cart') {
      return rpcResult(rpc.id, createdCart(origin));
    }
    if (params.name === 'cancel_cart') {
      return rpcResult(rpc.id, { structuredContent: { ucp: { status: 'success' } } });
    }
    return rpcError(rpc.id, -32_601, 'Unknown fixture tool.');
  },
} satisfies ExportedHandler;
