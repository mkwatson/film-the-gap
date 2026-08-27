// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  containsPrivateMaterial,
  isStringArray,
  parseBrowserJson,
  readAcceptanceConfig,
  sameStringSet,
  sanitizeAcceptanceFailure,
} from './native-browser-harness.ts';

describe('native browser acceptance harness', () => {
  it('accepts credential-free local app and HTTPS service origins', () => {
    const config = readAcceptanceConfig({
      EVIDENCE_ACCEPTANCE_APP_URL: 'http://127.0.0.1:3000/',
      EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'https://room.example/',
      EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: 'https://merchant.example',
      EVIDENCE_ACCEPTANCE_TIMEOUT_MS: '12000',
      EVIDENCE_ACCEPTANCE_HEADED: '1',
    });

    expect(config.appUrl).toBe('http://127.0.0.1:3000');
    expect(config.roomOrigin).toBe('https://room.example');
    expect(config.merchantOrigin).toBe('https://merchant.example');
    expect(config.commandTimeoutMs).toBe(12_000);
    expect(config.headed).toBe(true);
  });

  it('rejects credentialed, path-bearing, or insecure service URLs', () => {
    expect(() =>
      readAcceptanceConfig({
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'https://user:secret@room.example',
        EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: 'https://merchant.example',
      }),
    ).toThrow(/credential-free/i);
    expect(() =>
      readAcceptanceConfig({
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'https://room.example/api',
        EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: 'https://merchant.example',
      }),
    ).toThrow(/credential-free/i);
    expect(() =>
      readAcceptanceConfig({
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'https://room.example',
        EVIDENCE_ACCEPTANCE_MERCHANT_ORIGIN: 'http://merchant.example',
      }),
    ).toThrow(/must use HTTPS/i);
  });

  it('parses only JSON-shaped browser assertions and recognizes exact tool sets', () => {
    expect(parseBrowserJson('{"ok":true}')).toEqual({ ok: true });
    expect(() => parseBrowserJson('page says: secret')).toThrow(/non-JSON/i);
    expect(isStringArray(['inspect', 'act'])).toBe(true);
    expect(isStringArray(['inspect', 7])).toBe(false);
    expect(sameStringSet(['act', 'inspect'], ['inspect', 'act'])).toBe(true);
    expect(sameStringSet(['inspect'], ['inspect', 'act'])).toBe(false);
  });

  it('detects private ceilings and bearer paths without flagging generic privacy copy', () => {
    expect(containsPrivateMaterial('maximum price is $450')).toBe(true);
    expect(containsPrivateMaterial('https://example.test/cart/c/privateCredential123')).toBe(true);
    expect(containsPrivateMaterial('https://example.test/?token=privateCredential123')).toBe(true);
    expect(containsPrivateMaterial('Maximum price stays private.')).toBe(false);
  });

  it('suppresses private failure details and removes arbitrary URLs from reports', () => {
    expect(sanitizeAcceptanceFailure(new Error('Failed at https://example.test/path?q=1'))).toBe(
      'Failed at [origin suppressed]',
    );
    expect(sanitizeAcceptanceFailure(new Error('Failed at /cart/c/privateCredential123'))).toBe(
      'Acceptance failed; private material was suppressed.',
    );
  });
});
