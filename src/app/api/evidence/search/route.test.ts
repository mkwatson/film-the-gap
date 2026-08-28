import { afterEach, describe, expect, it } from 'vitest';

import { POST } from './route';

const originalKey = process.env.SCRAPECREATORS_API_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_DISCOVERY_API_KEY;
const originalVercel = process.env.VERCEL;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.SCRAPECREATORS_API_KEY;
  } else {
    process.env.SCRAPECREATORS_API_KEY = originalKey;
  }
  if (originalGatewayKey === undefined) {
    delete process.env.AI_GATEWAY_DISCOVERY_API_KEY;
  } else {
    process.env.AI_GATEWAY_DISCOVERY_API_KEY = originalGatewayKey;
  }
  if (originalVercel === undefined) {
    delete process.env.VERCEL;
  } else {
    process.env.VERCEL = originalVercel;
  }
});

describe('product evidence search route', () => {
  it('rejects malformed requests', async () => {
    const response = await POST(
      new Request('http://localhost/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: 'x' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_product_question' });
  });

  it('rejects cross-origin and non-JSON browser requests before discovery', async () => {
    const body = JSON.stringify({
      productName: 'Desk lamp',
      question: 'Does it remember its brightness after losing power?',
    });
    const crossOrigin = await POST(
      new Request('https://app.example/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' },
        body,
      }),
    );
    expect(crossOrigin.status).toBe(403);

    const nonJson = await POST(
      new Request('https://app.example/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body,
      }),
    );
    expect(nonJson.status).toBe(403);
  });

  it('returns a typed unavailable result when live discovery is not configured', async () => {
    delete process.env.SCRAPECREATORS_API_KEY;
    delete process.env.AI_GATEWAY_DISCOVERY_API_KEY;
    delete process.env.VERCEL;
    const response = await POST(
      new Request('http://localhost/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Desk lamp',
          question: 'Does it remember its brightness after losing power?',
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: 'evidence_network',
      status: 'unavailable',
      leads: [],
    });
  });
});
