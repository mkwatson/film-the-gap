import { z } from 'zod';

import {
  merchantCartPreparationBlocker,
  recordCancelledMerchantCart,
  recordMerchantCartFailure,
  recordPreparedMerchantCart,
  type LiveMarketState,
  type PrivateActionResult,
  type TransitionResult,
  type UcpMerchantCartReceipt,
} from '../../src/lib/live-market/model';
import {
  cancelUcpCart,
  createUcpCart,
  UcpClientError,
  type UcpFetch,
} from '../../src/lib/ucp/client';

export interface UcpCommerceEnv {
  readonly UCP_BUSINESS_URL?: string;
  readonly UCP_VARIANT_ID?: string;
  readonly UCP_PLATFORM_PROFILE_URL?: string;
}

export interface UcpRoomConfiguration {
  readonly businessUrl: string;
  readonly merchantOrigin: string;
  readonly variantId: string;
  readonly platformProfileUrl: string;
}

export interface PreparedRoomCart {
  readonly result: TransitionResult;
  readonly privateCartId: string | null;
  readonly privateResult: PrivateActionResult | null;
}

const ucpConfigurationSchema = z.strictObject({
  businessUrl: z.string().url(),
  variantId: z.string().min(1).max(2_000),
  platformProfileUrl: z.string().url(),
});

function credentialFreeHttpsUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0
  ) {
    throw new Error(`${label} must be a credential-free HTTPS URL.`);
  }
  return url;
}

export function readUcpRoomConfiguration(env: UcpCommerceEnv): UcpRoomConfiguration | null {
  const values = [env.UCP_BUSINESS_URL, env.UCP_VARIANT_ID, env.UCP_PLATFORM_PROFILE_URL];
  if (values.every((value) => value === undefined || value.trim().length === 0)) {
    return null;
  }

  const parsed = ucpConfigurationSchema.safeParse({
    businessUrl: env.UCP_BUSINESS_URL,
    variantId: env.UCP_VARIANT_ID,
    platformProfileUrl: env.UCP_PLATFORM_PROFILE_URL,
  });
  if (!parsed.success) {
    throw new Error('UCP commerce configuration must be complete and bounded.');
  }
  const business = credentialFreeHttpsUrl(parsed.data.businessUrl, 'UCP business URL');
  credentialFreeHttpsUrl(parsed.data.platformProfileUrl, 'UCP platform profile URL');
  return {
    ...parsed.data,
    businessUrl: business.origin,
    merchantOrigin: business.origin,
  };
}

function genericMerchantFailure(error: unknown, action: 'prepare' | 'cancel'): string {
  const recovery = 'The local evidence hold remains safe; retry or continue without commerce.';
  if (error instanceof UcpClientError) {
    return `The merchant refused the UCP ${action} step (${error.code}). ${recovery}`;
  }
  return `The merchant UCP ${action} step failed. ${recovery}`;
}

function publicReceipt(
  created: Awaited<ReturnType<typeof createUcpCart>>,
  createdAt: number,
): UcpMerchantCartReceipt {
  return {
    protocolVersion: created.cart.protocolVersion,
    currency: created.cart.currency,
    lineItems: created.cart.lineItems.map((line) => ({
      title: line.title,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      subtotal: line.subtotal,
    })),
    totals: created.cart.totals.map((total) => ({
      type: total.type,
      displayText: total.displayText,
      amount: total.amount,
    })),
    messages: created.cart.messages.map((message) => ({
      type: message.type,
      content: message.content,
      severity: message.severity,
    })),
    continuationAvailable: created.cart.continueUrl !== null,
    createdAt,
  };
}

export async function ucpIdempotencyKey(scope: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function prepareRoomMerchantCart(
  state: LiveMarketState,
  actor: 'agent' | 'buyer',
  configuration: UcpRoomConfiguration | null,
  idempotencyKey: string,
  fetcher: UcpFetch = fetch,
  createdAt = Date.now(),
): Promise<PreparedRoomCart> {
  const blocker = merchantCartPreparationBlocker(state);
  if (blocker !== null || configuration === null) {
    return {
      result: recordMerchantCartFailure(
        state,
        actor,
        'merchant_cart_prepared',
        blocker ?? 'This room has no authoritative UCP merchant configured.',
      ),
      privateCartId: null,
      privateResult: null,
    };
  }

  try {
    const created = await createUcpCart({
      businessUrl: configuration.businessUrl,
      platformProfileUrl: configuration.platformProfileUrl,
      fetch: fetcher,
      idempotencyKey,
      input: {
        variantId: configuration.variantId,
        context: {
          currency: 'USD',
          language: 'en-US',
          intent: 'evidence reviewed; exact-quote hold active; prepare reversible cart only',
        },
      },
    });
    if (created.cart.merchantOrigin !== configuration.merchantOrigin) {
      throw new UcpClientError('endpoint-invalid', 'Merchant origin changed after negotiation.');
    }
    return {
      result: recordPreparedMerchantCart(state, actor, publicReceipt(created, createdAt)),
      privateCartId: created.cart.id,
      privateResult:
        created.cart.continueUrl === null
          ? null
          : {
              kind: 'ucp-cart-handoff',
              continueUrl: created.cart.continueUrl,
              instruction:
                'Open only with explicit buyer approval. The merchant—not this app—owns checkout, fulfillment, and payment.',
            },
    };
  } catch (error: unknown) {
    return {
      result: recordMerchantCartFailure(
        state,
        actor,
        'merchant_cart_prepared',
        genericMerchantFailure(error, 'prepare'),
      ),
      privateCartId: null,
      privateResult: null,
    };
  }
}

export async function cancelRoomMerchantCart(
  state: LiveMarketState,
  actor: 'agent' | 'buyer',
  configuration: UcpRoomConfiguration | null,
  privateCartId: string | null,
  idempotencyKey: string,
  fetcher: UcpFetch = fetch,
): Promise<TransitionResult> {
  if (configuration === null || privateCartId === null || state.commerce.cartStatus !== 'active') {
    return recordMerchantCartFailure(
      state,
      actor,
      'merchant_cart_cancelled',
      'The authoritative room has no active merchant cart credential to cancel.',
    );
  }

  try {
    await cancelUcpCart({
      businessUrl: configuration.businessUrl,
      platformProfileUrl: configuration.platformProfileUrl,
      cartId: privateCartId,
      idempotencyKey,
      fetch: fetcher,
    });
    return recordCancelledMerchantCart(state, actor);
  } catch (error: unknown) {
    return recordMerchantCartFailure(
      state,
      actor,
      'merchant_cart_cancelled',
      genericMerchantFailure(error, 'cancel'),
    );
  }
}
