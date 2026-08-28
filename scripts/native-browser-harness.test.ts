// @vitest-environment node

import { describe, expect, it } from 'vitest';

import {
  browserAllowedDomains,
  containsPrivateMaterial,
  findSingleNewTab,
  isStringArray,
  parseAcceptanceTabs,
  parseBrowserJson,
  readAcceptanceConfig,
  readAcceptanceArtifactConfig,
  sameStringSet,
  sanitizeAcceptanceFailure,
  webMcpFeatureArgument,
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
      EVIDENCE_ACCEPTANCE_TIMEOUT_MS: '12000',
      EVIDENCE_ACCEPTANCE_HEADED: '1',
    });

    expect(config.appUrl).toBe('http://127.0.0.1:3000');
    expect(config.roomOrigin).toBe('https://room.example');
    expect(config.commandTimeoutMs).toBe(12_000);
    expect(config.headed).toBe(true);
  });

  it('rejects credentialed, path-bearing, or insecure service URLs', () => {
    expect(() =>
      readAcceptanceConfig({
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'https://user:secret@room.example',
      }),
    ).toThrow(/credential-free/i);
    expect(() =>
      readAcceptanceConfig({
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'https://room.example/api',
      }),
    ).toThrow(/credential-free/i);
    expect(() =>
      readAcceptanceConfig({
        EVIDENCE_ACCEPTANCE_ROOM_ORIGIN: 'http://room.example',
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

  it('launches Chrome with an explicit WebMCP feature state', () => {
    expect(webMcpFeatureArgument(true)).toBe('--enable-features=WebMCP');
    expect(webMcpFeatureArgument(false)).toBe('--disable-features=WebMCP');
  });

  it('allows both loopback aliases when local services use either one', () => {
    expect(
      browserAllowedDomains({
        appUrl: 'http://localhost:3000',
        roomOrigin: 'http://127.0.0.1:8792',
      }),
    ).toEqual(['localhost', '127.0.0.1']);
    expect(
      browserAllowedDomains({
        appUrl: 'https://app.example',
        roomOrigin: 'https://room.example',
      }),
    ).toEqual(['app.example', 'room.example']);
  });

  it('parses dynamic browser tab identifiers without depending on a fixed tab count', () => {
    expect(
      parseAcceptanceTabs(
        '  [t1] Buyer - https://app.example\n→ [t2] Recorder - https://app.example\n  [t7] Host',
      ),
    ).toEqual(['t1', 't2', 't7']);
  });

  it('identifies exactly one newly opened browser tab', () => {
    expect(findSingleNewTab(['t1', 't2'], ['t1', 't2'])).toBeNull();
    expect(findSingleNewTab(['t1', 't2'], ['t1', 't3', 't2'])).toBe('t3');
    expect(() => findSingleNewTab(['t1'], ['t1', 't2', 't3'])).toThrow(
      /more than one browser tab/i,
    );
  });

  it('detects bearer material without flagging generic privacy copy', () => {
    expect(containsPrivateMaterial('https://example.test/?token=privateCredential123')).toBe(true);
    expect(containsPrivateMaterial('_vercel_jwt=privateCredential123')).toBe(true);
    expect(containsPrivateMaterial('The shopper identity stays private.')).toBe(false);
  });

  it('suppresses private failure details and removes arbitrary URLs from reports', () => {
    expect(sanitizeAcceptanceFailure(new Error('Failed at https://example.test/path?q=1'))).toBe(
      'Failed at [origin suppressed]',
    );
    expect(sanitizeAcceptanceFailure(new Error('Failed at ?token=privateCredential123'))).toBe(
      'Acceptance failed; private material was suppressed.',
    );
  });
});
