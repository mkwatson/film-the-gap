import { env } from 'cloudflare:workers';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import { knownPageReadResponseSchema } from '../../src/lib/evidence-network/known-page-reader';
import { knownPageReaderWorkerRuntime } from '../src/known-page-reader';

const database = (env as unknown as { readonly EVIDENCE_LIBRARY: D1Database }).EVIDENCE_LIBRARY;
const authorization = 'Bearer test-only-page-reader-secret';

function readerRequest(url: string, token = authorization): Request {
  return new Request('https://evidence.example/product-page-reader', {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

describe('bounded Cloudflare Browser Run product-page reader', () => {
  it('requires the server-only reader capability', async () => {
    const response = await SELF.fetch(readerRequest('https://shop.example/product', 'Bearer bad'));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid_page_reader_authorization',
    });
  });

  it('rejects private, non-HTTPS, and non-default-port targets before Browser Run', async () => {
    for (const url of [
      'http://shop.example/product',
      'https://localhost/product',
      'https://169.254.169.254/latest/meta-data',
      'https://shop.example:8443/product',
    ]) {
      const response = await SELF.fetch(readerRequest(url));
      expect(response.status).toBe(400);
    }
  });

  it('returns a bounded untrusted excerpt, content policy, and browser usage receipt', async () => {
    const response = await SELF.fetch(readerRequest('https://shop.example/products/flask'));
    expect(response.status).toBe(200);
    const parsed = knownPageReadResponseSchema.parse(await response.json());
    expect(parsed).toMatchObject({
      status: 'complete',
      title: 'Trail Flask 24 oz',
      excerpt: 'Trail Flask Leak-resistant lid for everyday use.',
      contentSignal: 'ai-train=no, search=yes, ai-input=yes',
      browserMilliseconds: 824,
    });
  });

  it('fails closed when a page redirects outside the approved origin', async () => {
    const response = await SELF.fetch(readerRequest('https://shop.example/cross-origin'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'unavailable',
      warning: expect.stringContaining('redirected outside'),
    });
  });

  it('discards page text when the origin content signal forbids search or AI input', async () => {
    const response = await SELF.fetch(readerRequest('https://shop.example/deny-content'));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toMatchObject({
      status: 'unavailable',
      warning: expect.stringContaining('content signal'),
    });
    expect(JSON.stringify(payload)).not.toContain('Leak-resistant lid');
  });

  it('rejects oversized request and Browser Run response bodies', async () => {
    const oversizedRequest = await SELF.fetch(
      new Request('https://evidence.example/product-page-reader', {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://shop.example/product',
          padding: 'x'.repeat(2_048),
        }),
      }),
    );
    expect(oversizedRequest.status).toBe(400);

    const oversizedReceipt = await SELF.fetch(readerRequest('https://shop.example/oversized'));
    expect(oversizedReceipt.status).toBe(200);
    await expect(oversizedReceipt.json()).resolves.toMatchObject({
      status: 'unavailable',
      warning: expect.stringContaining('invalid page receipt'),
    });
  });

  it('enforces the D1-backed daily Browser Run ceiling atomically', async () => {
    await database
      .prepare(
        `INSERT INTO page_reader_daily_usage (day, calls) VALUES (?, ?)
         ON CONFLICT(day) DO UPDATE SET calls = excluded.calls`,
      )
      .bind(
        new Date().toISOString().slice(0, 10),
        knownPageReaderWorkerRuntime.pageReaderDailyLimit,
      )
      .run();

    const response = await SELF.fetch(readerRequest('https://shop.example/product'));
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: 'page_reader_daily_budget_exhausted',
    });
  });
});
