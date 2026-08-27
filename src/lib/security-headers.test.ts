import { describe, expect, it } from 'vitest';

import { buildAppSecurityHeaders, buildContentSecurityPolicy } from './security-headers';

describe('app security headers', () => {
  it('allows only the configured room HTTP and WebSocket origins in production', () => {
    const policy = buildContentSecurityPolicy({
      evidenceRoomUrl: 'https://rooms.example/path?ignored=true',
      development: false,
    });

    expect(policy).toContain("connect-src 'self' https://rooms.example wss://rooms.example");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).not.toContain('ws:;');
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it('adds the development WebSocket and evaluator allowance without widening production', () => {
    expect(
      buildContentSecurityPolicy({ evidenceRoomUrl: 'http://127.0.0.1:8787', development: true }),
    ).toContain("connect-src 'self' http://127.0.0.1:8787 ws://127.0.0.1:8787 ws:");
    expect(
      buildContentSecurityPolicy({ evidenceRoomUrl: 'http://127.0.0.1:8787', development: true }),
    ).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  it('fails closed when the room URL is invalid or contains credentials', () => {
    expect(
      buildContentSecurityPolicy({
        evidenceRoomUrl: 'https://user:secret@rooms.example/private',
        development: false,
      }),
    ).toContain("connect-src 'self';");
    expect(
      buildContentSecurityPolicy({ evidenceRoomUrl: 'javascript:alert(1)', development: false }),
    ).toContain("connect-src 'self';");
  });

  it('grants camera access only to an explicitly camera-capable page', () => {
    const buyerHeaders = buildAppSecurityHeaders({ allowCamera: false, development: false });
    const hostHeaders = buildAppSecurityHeaders({ allowCamera: true, development: false });

    expect(buyerHeaders).toContainEqual({
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()',
    });
    expect(hostHeaders).toContainEqual({
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=(), payment=(), browsing-topics=()',
    });
    expect(hostHeaders).toContainEqual({ key: 'Referrer-Policy', value: 'no-referrer' });
    expect(hostHeaders).toContainEqual({ key: 'X-Content-Type-Options', value: 'nosniff' });
  });

  it('allows creator uploads and Stream playback only on explicitly enabled surfaces', () => {
    const defaultPolicy = buildContentSecurityPolicy({ development: false });
    const contributorPolicy = buildContentSecurityPolicy({
      development: false,
      allowCreatorUpload: true,
      allowStreamPlayback: true,
    });

    expect(defaultPolicy).not.toContain('upload.videodelivery.net');
    expect(defaultPolicy).not.toContain('cloudflarestream.com');
    expect(contributorPolicy).toContain("connect-src 'self' https://upload.videodelivery.net");
    expect(contributorPolicy).toContain("frame-src 'self' https://*.cloudflarestream.com");
    expect(contributorPolicy).toContain("media-src 'self' blob: https://*.cloudflarestream.com");
  });
});
