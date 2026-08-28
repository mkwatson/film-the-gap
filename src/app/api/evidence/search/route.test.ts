import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoProduct } from '@/lib/evidence-network/demo-product';

import { POST } from './route';

const originalKey = process.env.SCRAPECREATORS_API_KEY;
const originalGatewayKey = process.env.AI_GATEWAY_DISCOVERY_API_KEY;
const originalVercel = process.env.VERCEL;
const originalPageReaderToken = process.env.EVIDENCE_PAGE_READER_TOKEN;
const originalEvidenceRoomUrl = process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL;

afterEach(() => {
  vi.unstubAllGlobals();
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
  if (originalPageReaderToken === undefined) {
    delete process.env.EVIDENCE_PAGE_READER_TOKEN;
  } else {
    process.env.EVIDENCE_PAGE_READER_TOKEN = originalPageReaderToken;
  }
  if (originalEvidenceRoomUrl === undefined) {
    delete process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL;
  } else {
    process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL = originalEvidenceRoomUrl;
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

  it('checks only reusable evidence for the same-origin rights-clean judge example', async () => {
    process.env.VERCEL = '1';
    process.env.SCRAPECREATORS_API_KEY = 'configured-social-key';
    process.env.AI_GATEWAY_DISCOVERY_API_KEY = 'configured-gateway-key';
    process.env.EVIDENCE_PAGE_READER_TOKEN = 'configured-page-reader-token';
    process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL = 'https://evidence.example';
    const fetcher = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      if (String(input) === 'https://evidence.example/evidence-library/search') {
        return Response.json({ status: 'complete', records: [], warnings: [] });
      }
      throw new Error(`The judge example reached an unexpected public provider: ${String(input)}`);
    });
    vi.stubGlobal('fetch', fetcher);

    const response = await POST(
      new Request('https://film.example/api/evidence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: demoProduct.name,
          productUrl: `https://film.example${demoProduct.path}`,
          question: demoProduct.question,
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      provider: 'evidence_network',
      status: 'partial',
      searchedPlatforms: [],
      reviewedEvidence: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://evidence.example/evidence-library/search');
  });
});
