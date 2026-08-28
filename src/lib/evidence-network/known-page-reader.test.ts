import { describe, expect, it, vi } from 'vitest';

import { knownPageReadRequestSchema, readRemoteKnownProductPage } from './known-page-reader';

describe('known product-page reader protocol', () => {
  it.each([
    'http://shop.example/product',
    'https://shop.example:8443/product',
    'https://localhost/product',
    'https://169.254.169.254/latest/meta-data',
  ])('rejects unsafe or non-default HTTPS targets: %s', (url) => {
    expect(knownPageReadRequestSchema.safeParse({ url }).success).toBe(false);
  });

  it('sends the reader token only to the evidence service and validates its receipt', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        reader: 'cloudflare_browser_run',
        status: 'complete',
        requestedUrl: 'https://shop.example/products/flask',
        finalUrl: 'https://shop.example/products/flask',
        title: 'Trail Flask',
        excerpt: 'The product page claims a leak-resistant lid.',
        contentSignal: 'ai-train=no, search=yes, ai-input=yes',
        browserMilliseconds: 824,
      }),
    );

    await expect(
      readRemoteKnownProductPage(
        { url: 'https://shop.example/products/flask' },
        {
          serviceUrl: 'https://evidence.example',
          token: 'private-reader-token',
          fetchImpl,
        },
      ),
    ).resolves.toMatchObject({ status: 'complete', title: 'Trail Flask' });
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL('https://evidence.example/product-page-reader'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer private-reader-token' }),
      }),
    );
  });

  it('turns quota and malformed responses into bounded unavailable receipts', async () => {
    const quota = await readRemoteKnownProductPage(
      { url: 'https://shop.example/product' },
      {
        serviceUrl: 'https://evidence.example',
        token: 'reader-token',
        fetchImpl: async () => Response.json({ error: 'budget_exhausted' }, { status: 429 }),
      },
    );
    expect(quota).toMatchObject({
      status: 'unavailable',
      warning: expect.stringContaining('allowance'),
    });

    const malformed = await readRemoteKnownProductPage(
      { url: 'https://shop.example/product' },
      {
        serviceUrl: 'https://evidence.example',
        token: 'reader-token',
        fetchImpl: async () => Response.json({ success: true, markdown: 'unbounded' }),
      },
    );
    expect(malformed).toMatchObject({
      status: 'unavailable',
      warning: expect.stringContaining('invalid receipt'),
    });

    const invalidJson = await readRemoteKnownProductPage(
      { url: 'https://shop.example/product' },
      {
        serviceUrl: 'https://evidence.example',
        token: 'reader-token',
        fetchImpl: async () => new Response('not JSON'),
      },
    );
    expect(invalidJson).toMatchObject({
      status: 'unavailable',
      warning: expect.stringContaining('invalid receipt'),
    });
  });
});
