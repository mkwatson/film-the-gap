import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

function json(body: object, status = 200): Response {
  return Response.json(body, { status });
}

function jsonRpcRequest(value: unknown): {
  readonly id: string | number;
  readonly method: string;
  readonly params: unknown;
} {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Expected a JSON-RPC request.');
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

async function mockUcpMerchant(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/.well-known/ucp') {
    return json({
      ucp: {
        version: '2026-08-25',
        services: {
          'dev.ucp.shopping': [
            {
              version: '2026-08-25',
              transport: 'mcp',
              endpoint: 'https://merchant.example/api/ucp/mcp',
            },
          ],
        },
        capabilities: {
          'dev.ucp.shopping.cart': [{ version: '2026-08-25' }],
        },
        payment_handlers: {},
      },
    });
  }
  if (request.method !== 'POST' || url.pathname !== '/api/ucp/mcp') {
    return json({ error: 'not_found' }, 404);
  }

  const text = await request.text();
  const rpc = jsonRpcRequest(JSON.parse(text) as unknown);
  if (/maxAllInPrice|maximum|buyer|email|address_|postal|payment|credential/i.test(text)) {
    return json({
      jsonrpc: '2.0',
      id: rpc.id,
      error: { code: -32_600, message: 'Forbidden private field crossed the UCP boundary.' },
    });
  }
  if (rpc.method === 'tools/list') {
    return json({
      jsonrpc: '2.0',
      id: rpc.id,
      result: {
        tools: [
          {
            name: 'create_cart',
            inputSchema: {
              type: 'object',
              properties: { meta: { type: 'object' }, cart: { type: 'object' } },
              required: ['meta', 'cart'],
            },
          },
          { name: 'cancel_cart', inputSchema: { type: 'object' } },
        ],
      },
    });
  }

  const params = rpc.params as { readonly name?: unknown };
  if (params.name === 'create_cart') {
    return json({
      jsonrpc: '2.0',
      id: rpc.id,
      result: {
        structuredContent: {
          ucp: {
            version: '2026-08-25',
            capabilities: {
              'dev.ucp.shopping.cart': [{ version: '2026-08-25' }],
            },
          },
          id: 'gid://shopify/Cart/private-test-cart',
          line_items: [
            {
              id: 'gid://shopify/CartLine/private-test-line',
              item: {
                id: 'gid://shopify/ProductVariant/test-variant',
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
              content: 'No checkout or payment capability.',
            },
          ],
          continue_url: 'https://merchant.example/cart/c/private-test-cart',
        },
      },
    });
  }
  if (params.name === 'cancel_cart') {
    return json({
      jsonrpc: '2.0',
      id: rpc.id,
      result: { structuredContent: { ucp: { status: 'success' } } },
    });
  }
  return json({
    jsonrpc: '2.0',
    id: rpc.id,
    error: { code: -32_601, message: 'Unknown test tool.' },
  });
}

async function mockCloudflareStream(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/direct-upload') {
    return json({
      uploadId: '0123456789abcdef0123456789abcdef',
      uploadUrl: 'https://upload.videodelivery.net/0123456789abcdef0123456789abcdef',
    });
  }
  if (request.method === 'GET' && url.pathname === '/videos/0123456789abcdef0123456789abcdef') {
    return json({
      uploaded: true,
      readyToStream: true,
      status: 'ready',
      durationSeconds: 10,
      previewUrl:
        'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/watch',
      thumbnailUrl:
        'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/thumbnails/thumbnail.jpg',
      hlsPlaybackUrl:
        'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/manifest/video.m3u8',
    });
  }
  return json({ error: 'not_found' }, 404);
}

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          UCP_BUSINESS_URL: 'https://merchant.example',
          UCP_VARIANT_ID: 'gid://shopify/ProductVariant/test-variant',
          UCP_PLATFORM_PROFILE_URL: 'https://platform.example/.well-known/ucp',
        },
        serviceBindings: {
          UCP_OUTBOUND: mockUcpMerchant,
          STREAM_OUTBOUND: mockCloudflareStream,
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
});
