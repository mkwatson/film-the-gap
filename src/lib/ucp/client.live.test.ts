// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { cancelUcpCart, createUcpCart } from './client';
import { ucpProtocolVersion } from './profile';

const businessUrl = process.env.LIVE_UCP_BUSINESS_URL;
const variantId = process.env.LIVE_UCP_VARIANT_ID;
const platformProfileUrl = process.env.LIVE_UCP_PLATFORM_PROFILE_URL;
const liveConfigurationPresent =
  businessUrl !== undefined && variantId !== undefined && platformProfileUrl !== undefined;

describe.skipIf(!liveConfigurationPresent)('live UCP merchant', () => {
  it('creates and immediately cancels an anonymous Cart without retaining its credential', async () => {
    if (businessUrl === undefined || variantId === undefined || platformProfileUrl === undefined) {
      throw new Error('The live UCP environment is incomplete.');
    }

    const created = await createUcpCart({
      businessUrl,
      platformProfileUrl,
      input: {
        variantId,
        context: {
          currency: 'USD',
          language: 'en-US',
          intent: 'verify an evidence-gated cart handoff before judging',
        },
      },
    });

    try {
      expect(created.cart.protocolVersion).toBe(ucpProtocolVersion);
      expect(created.cart.currency).toBe('USD');
      expect(created.cart.lineItems).toHaveLength(1);
      expect(created.cart.totals.length).toBeGreaterThan(0);
      expect(created.cart.continueUrl).toMatch(/^https:\/\//);
    } finally {
      await cancelUcpCart({
        businessUrl,
        platformProfileUrl,
        cartId: created.cart.id,
        negotiation: created.negotiation,
      });
    }
  }, 30_000);
});
