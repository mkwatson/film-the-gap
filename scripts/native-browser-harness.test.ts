// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  containsPrivateMaterial,
  isStringArray,
  parseAcceptanceTabs,
  parseBrowserJson,
  readAcceptanceConfig,
  readAcceptanceArtifactConfig,
  sameStringSet,
  sanitizeAcceptanceFailure,
} from './native-browser-harness.ts';

describe('native browser acceptance harness', () => {
  it('keeps capture disabled by default and validates an opt-in artifact directory', () => {
    expect(readAcceptanceArtifactConfig({})).toEqual({
      directory: null,
      pauseMs: 0,
      recordVideo: false,
    });

    const capture = readAcceptanceArtifactConfig({
      EVIDENCE_ACCEPTANCE_ARTIFACT_DIR: 'tmp/demo-capture',
      EVIDENCE_ACCEPTANCE_CAPTURE_PAUSE_MS: '1250',
      EVIDENCE_ACCEPTANCE_RECORD_VIDEO: '1',
    });
    expect(capture.directory).toMatch(/\/tmp\/demo-capture$/);
    expect(capture.pauseMs).toBe(1_250);
    expect(capture.recordVideo).toBe(true);
  });

  it('rejects unbounded capture pauses and video without an artifact destination', () => {
    expect(() =>
      readAcceptanceArtifactConfig({ EVIDENCE_ACCEPTANCE_CAPTURE_PAUSE_MS: '5001' }),
    ).toThrow(/integer from 0 to 5000/i);
    expect(() => readAcceptanceArtifactConfig({ EVIDENCE_ACCEPTANCE_RECORD_VIDEO: '1' })).toThrow(
      /artifact_dir is required/i,
    );
    expect(() =>
      readAcceptanceArtifactConfig({
        EVIDENCE_ACCEPTANCE_ARTIFACT_DIR: '   ',
        EVIDENCE_ACCEPTANCE_RECORD_VIDEO: '1',
      }),
    ).toThrow(/artifact_dir is required/i);
  });

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

  it('parses dynamic browser tab identifiers without depending on a fixed tab count', () => {
    expect(
      parseAcceptanceTabs(
        '  [t1] Buyer - https://app.example\n→ [t2] Recorder - https://app.example\n  [t7] Host',
      ),
    ).toEqual(['t1', 't2', 't7']);
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
