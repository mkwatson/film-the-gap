// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { filmTheGapUcpPlatformProfile } from '@/lib/evidence-network/ucp-catalog';

import { GET } from './route';

describe('GET /ucp/agent-profile', () => {
  it('publishes the exact UCP platform profile with restrictive document headers', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=3600');
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(response.json()).resolves.toEqual(filmTheGapUcpPlatformProfile);
  });
});
