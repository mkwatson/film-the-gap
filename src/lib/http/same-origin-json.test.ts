// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { isSameOriginJsonRequest } from './same-origin-json';

function request(url: string, headers: Readonly<Record<string, string>> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  });
}

describe('same-origin JSON request policy', () => {
  it('accepts direct same-origin requests and non-browser clients without Origin', () => {
    expect(
      isSameOriginJsonRequest(
        request('https://proof.example/api/search', { Origin: 'https://proof.example' }),
      ),
    ).toBe(true);
    expect(isSameOriginJsonRequest(request('https://proof.example/api/search'))).toBe(true);
  });

  it('uses the actual Host when a framework canonicalizes the request URL', () => {
    expect(
      isSameOriginJsonRequest(
        request('http://localhost:3101/api/search', {
          Host: '127.0.0.1:3101',
          Origin: 'http://127.0.0.1:3101',
        }),
      ),
    ).toBe(true);
  });

  it('honors the forwarded scheme while still requiring the actual request Host', () => {
    expect(
      isSameOriginJsonRequest(
        request('http://localhost:3000/api/search', {
          Host: 'proof.example',
          Origin: 'https://proof.example',
          'X-Forwarded-Proto': 'https',
        }),
      ),
    ).toBe(true);
  });

  it('rejects cross-origin, malformed-origin, and non-JSON requests', () => {
    expect(
      isSameOriginJsonRequest(
        request('https://proof.example/api/search', { Origin: 'https://untrusted.invalid' }),
      ),
    ).toBe(false);
    expect(
      isSameOriginJsonRequest(request('https://proof.example/api/search', { Origin: 'not a URL' })),
    ).toBe(false);
    expect(
      isSameOriginJsonRequest(
        new Request('https://proof.example/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: '{}',
        }),
      ),
    ).toBe(false);
  });
});
