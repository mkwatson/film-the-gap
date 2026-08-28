import { afterEach, describe, expect, it } from 'vitest';

import { POST } from './route';

const originalKey = process.env.SCRAPECREATORS_API_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.SCRAPECREATORS_API_KEY;
  } else {
    process.env.SCRAPECREATORS_API_KEY = originalKey;
  }
});

describe('product evidence search route', () => {
  it('rejects malformed requests', async () => {
    const response = await POST(
      new Request('http://localhost/api/evidence/search', {
        method: 'POST',
        body: JSON.stringify({ productName: 'x' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'invalid_product_question' });
  });

  it('returns a typed unavailable result when live discovery is not configured', async () => {
    delete process.env.SCRAPECREATORS_API_KEY;
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
      provider: 'scrapecreators',
      status: 'unavailable',
      leads: [],
    });
  });
});
