// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { GET } from './route';
import {
  ucpCartCapabilityName,
  ucpDiscoveryProfileSchema,
  ucpProtocolVersion,
  ucpShoppingServiceName,
} from '@/lib/ucp/profile';

describe('GET /.well-known/ucp', () => {
  it('publishes a minimal anonymous Cart platform profile', async () => {
    const response = GET();
    const profile: unknown = await response.json();
    const parsed = ucpDiscoveryProfileSchema.parse(profile);

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(parsed.ucp.version).toBe(ucpProtocolVersion);
    expect(Object.keys(parsed.ucp.services)).toEqual([ucpShoppingServiceName]);
    expect(Object.keys(parsed.ucp.capabilities)).toEqual([ucpCartCapabilityName]);
    expect(parsed.ucp.payment_handlers).toEqual({});
    expect(profile).not.toHaveProperty('keys');
  });
});
