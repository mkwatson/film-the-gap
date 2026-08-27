// @vitest-environment node

import {
  registerSchema,
  validate,
  type JsonSchemaDraft202012,
  type Validator,
} from '@hyperjump/json-schema/draft-2020-12';
import '@hyperjump/json-schema/formats';
import { describe, expect, it } from 'vitest';

import {
  cartStructuredContent,
  merchantProfile,
  ucpErrorStructuredContent,
  ucpProtocolVersion,
  type StoredCart,
} from '../../../merchant-worker/src/protocol';

const releasedSchemaTests = process.env.UCP_RELEASE_SCHEMA_LIVE === '1' ? describe : describe.skip;
const releasedSchemaTimeoutMs = 30_000;
type JsonValue = Parameters<Validator>[0];

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function requireJsonValue(value: unknown): JsonValue {
  if (!isJsonValue(value)) {
    throw new Error('Expected a JSON-compatible released-schema fixture.');
  }
  return value;
}

function collectSchemaReferences(value: unknown, references: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaReferences(item, references);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  if (typeof value.$ref === 'string') {
    references.add(value.$ref);
  }
  for (const child of Object.values(value)) {
    collectSchemaReferences(child, references);
  }
}

async function registerReleasedSchemas(initialUrls: readonly string[]): Promise<readonly string[]> {
  const queue = [...initialUrls];
  const queued = new Set(queue);
  const registered = new Set<string>();
  const roots: string[] = [];

  while (queue.length > 0) {
    const retrievalUrl = queue.shift();
    if (retrievalUrl === undefined) {
      break;
    }
    const response = await fetch(retrievalUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`Released UCP schema returned HTTP ${response.status}.`);
    }
    const value: unknown = await response.json();
    if (!isRecord(value)) {
      throw new Error('Released UCP schema was not an object.');
    }
    const canonicalUrl =
      typeof value.$id === 'string' ? new URL(value.$id, retrievalUrl).href : retrievalUrl;
    if (registered.has(canonicalUrl)) {
      continue;
    }
    registerSchema(value as JsonSchemaDraft202012, canonicalUrl);
    registered.add(canonicalUrl);
    if (initialUrls.includes(retrievalUrl)) {
      roots.push(canonicalUrl);
    }

    const references = new Set<string>();
    collectSchemaReferences(value, references);
    for (const reference of references) {
      const dependency = new URL(reference, canonicalUrl);
      dependency.hash = '';
      if (dependency.hostname !== 'ucp.dev' || queued.has(dependency.href)) {
        continue;
      }
      queued.add(dependency.href);
      queue.push(dependency.href);
    }
  }

  return roots;
}

const storedCart: StoredCart = {
  id: 'urn:webmcp-evidence-market:cart:00000000-0000-4000-8000-000000000001',
  continuationToken: '00000000000000000000000000000001',
  lineId: 'urn:webmcp-evidence-market:cart-line:00000000-0000-4000-8000-000000000002',
  status: 'active',
  platformProfileUrl: 'https://platform.example/.well-known/ucp',
  requestDigest: '0'.repeat(64),
  createIdempotencyKey: '00000000-0000-4000-8000-000000000003',
  createdAt: 1_787_875_200_000,
  updatedAt: 1_787_875_200_000,
  expiresAt: 1_787_877_000_000,
  retentionEndsAt: 1_787_961_600_000,
  cancelledAt: null,
};

releasedSchemaTests('released UCP schema conformance', () => {
  it(
    `validates the business profile, direct Cart, and error result against ${ucpProtocolVersion}`,
    async () => {
      const schemaRoot = `https://ucp.dev/${ucpProtocolVersion}/schemas`;
      const [profileSchema, cartSchema, errorSchema] = await registerReleasedSchemas([
        `${schemaRoot}/profile.json`,
        `${schemaRoot}/shopping/cart.json`,
        `${schemaRoot}/common/types/error_response.json`,
      ]);
      if (profileSchema === undefined || cartSchema === undefined || errorSchema === undefined) {
        throw new Error('Released UCP root schemas were not registered.');
      }
      const [profileResult, cartResult, errorResult] = await Promise.all([
        validate(
          `${profileSchema}#/$defs/business_schema`,
          requireJsonValue(merchantProfile('https://merchant.example')),
        ),
        validate(
          cartSchema,
          requireJsonValue(cartStructuredContent(storedCart, 'https://merchant.example')),
        ),
        validate(
          errorSchema,
          requireJsonValue(ucpErrorStructuredContent('Cart not found.', 'not_found')),
        ),
      ]);

      expect(profileResult.valid).toBe(true);
      expect(cartResult.valid).toBe(true);
      expect(errorResult.valid).toBe(true);
    },
    releasedSchemaTimeoutMs,
  );
});
