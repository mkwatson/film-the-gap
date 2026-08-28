// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import {
  shopifyCatalogDevelopmentProfile,
  shopifyCatalogProtocolVersion,
  type ShopifyCatalogSearchResponse,
} from '@/lib/evidence-network/ucp-catalog';

import { configuredUcpAgentProfile, handleCatalogSearch } from './route';

const completeResult: ShopifyCatalogSearchResponse = {
  provider: 'shopify_global_catalog',
  protocolVersion: shopifyCatalogProtocolVersion,
  status: 'complete',
  query: 'insulated travel bottle',
  products: [],
  warnings: [],
};

function catalogRequest(body: unknown, headers: HeadersInit = {}): Request {
  return new Request('https://proof.example/api/catalog/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/catalog/search', () => {
  it('rejects malformed, cross-origin, and non-JSON requests before provider access', async () => {
    const searchCatalog = vi.fn();
    const malformed = await handleCatalogSearch(catalogRequest({ query: 'x' }), {
      searchCatalog,
    });
    expect(malformed.status).toBe(400);

    const crossOrigin = await handleCatalogSearch(
      catalogRequest({ query: 'insulated travel bottle' }, { Origin: 'https://untrusted.invalid' }),
      { searchCatalog },
    );
    expect(crossOrigin.status).toBe(403);

    const nonJson = await handleCatalogSearch(
      new Request('https://proof.example/api/catalog/search', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'insulated travel bottle',
      }),
      { searchCatalog },
    );
    expect(nonJson.status).toBe(403);
    expect(searchCatalog).not.toHaveBeenCalled();
  });

  it('uses the configured public profile and caches only the typed provider result', async () => {
    const searchCatalog = vi.fn(async () => completeResult);
    const readCached = vi.fn(async () => null);
    const writeCached = vi.fn(async () => undefined);
    const request = catalogRequest({ query: '  insulated travel bottle ', country: 'ca' });

    const response = await handleCatalogSearch(request, {
      environment: { UCP_AGENT_PROFILE_URL: 'https://proof.example/ucp/agent-profile' },
      readCached,
      searchCatalog,
      writeCached,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(searchCatalog).toHaveBeenCalledWith(
      { query: 'insulated travel bottle', country: 'CA' },
      { agentProfileUrl: 'https://proof.example/ucp/agent-profile' },
      request.signal,
    );
    expect(writeCached).toHaveBeenCalledWith(expect.stringMatching(/^catalog:/u), completeResult);
    await expect(response.json()).resolves.toEqual(completeResult);
  });

  it('returns a cached complete result without calling the provider', async () => {
    const searchCatalog = vi.fn();
    const writeCached = vi.fn();
    const response = await handleCatalogSearch(
      catalogRequest({ query: 'insulated travel bottle' }),
      {
        readCached: async () => completeResult,
        searchCatalog,
        writeCached,
      },
    );

    expect(searchCatalog).not.toHaveBeenCalled();
    expect(writeCached).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual(completeResult);
  });
});

describe('configuredUcpAgentProfile', () => {
  it('uses the official development profile locally and fails closed on Vercel', () => {
    expect(configuredUcpAgentProfile({})).toBe(shopifyCatalogDevelopmentProfile);
    expect(configuredUcpAgentProfile({ VERCEL: '1' })).toBe('');
    expect(
      configuredUcpAgentProfile({
        VERCEL: '1',
        UCP_AGENT_PROFILE_URL: ' https://proof.example/ucp/agent-profile ',
      }),
    ).toBe('https://proof.example/ucp/agent-profile');
  });
});
