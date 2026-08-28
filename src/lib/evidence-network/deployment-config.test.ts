import { describe, expect, it } from 'vitest';

import { evidenceRoomOriginForBuild, ucpAgentProfileUrlForBuild } from './deployment-config';

describe('evidence deployment configuration', () => {
  it('allows an unconfigured local build for the honest manual fallback', () => {
    expect(evidenceRoomOriginForBuild({})).toBeUndefined();
  });

  it('normalizes a local HTTP evidence origin', () => {
    expect(
      evidenceRoomOriginForBuild({
        NEXT_PUBLIC_EVIDENCE_ROOM_URL: ' http://127.0.0.1:8792/ ',
      }),
    ).toBe('http://127.0.0.1:8792');
  });

  it.each([
    'not a URL',
    'ftp://evidence.example',
    'https://user:secret@evidence.example',
    'https://evidence.example/private',
    'https://evidence.example?token=secret',
    'https://evidence.example/#fragment',
  ])('rejects malformed or over-scoped origins: %s', (value) => {
    expect(() => evidenceRoomOriginForBuild({ NEXT_PUBLIC_EVIDENCE_ROOM_URL: value })).toThrow(
      /NEXT_PUBLIC_EVIDENCE_ROOM_URL/,
    );
  });

  it('requires the evidence origin in a Vercel build', () => {
    expect(() => evidenceRoomOriginForBuild({ VERCEL: '1' })).toThrow(
      'NEXT_PUBLIC_EVIDENCE_ROOM_URL is required for every Vercel build.',
    );
  });

  it.each(['http://evidence.example', 'https://localhost:8792', 'https://127.0.0.1:8792'])(
    'rejects a non-public Vercel evidence origin: %s',
    (value) => {
      expect(() =>
        evidenceRoomOriginForBuild({
          NEXT_PUBLIC_EVIDENCE_ROOM_URL: value,
          VERCEL: '1',
        }),
      ).toThrow('NEXT_PUBLIC_EVIDENCE_ROOM_URL must be a public HTTPS origin');
    },
  );

  it('accepts an exact public HTTPS origin in a Vercel build', () => {
    expect(
      evidenceRoomOriginForBuild({
        NEXT_PUBLIC_EVIDENCE_ROOM_URL: 'https://evidence.example/',
        VERCEL: '1',
      }),
    ).toBe('https://evidence.example');
  });
});

describe('UCP deployment configuration', () => {
  it('allows the official development fallback only outside Vercel', () => {
    expect(ucpAgentProfileUrlForBuild({})).toBeUndefined();
    expect(() => ucpAgentProfileUrlForBuild({ VERCEL: '1' })).toThrow(
      'UCP_AGENT_PROFILE_URL is required for every Vercel build.',
    );
  });

  it.each([
    'not a URL',
    'http://proof.example/ucp/agent-profile',
    'https://user:secret@proof.example/ucp/agent-profile',
    'https://proof.example/ucp/other',
    'https://proof.example/ucp/agent-profile?token=secret',
    'https://proof.example/ucp/agent-profile#fragment',
  ])('rejects an invalid production profile target: %s', (value) => {
    expect(() => ucpAgentProfileUrlForBuild({ UCP_AGENT_PROFILE_URL: value })).toThrow(
      /UCP_AGENT_PROFILE_URL/,
    );
  });

  it('accepts the exact public app-owned profile path', () => {
    expect(
      ucpAgentProfileUrlForBuild({
        UCP_AGENT_PROFILE_URL: ' https://proof.example/ucp/agent-profile ',
        VERCEL: '1',
      }),
    ).toBe('https://proof.example/ucp/agent-profile');
  });

  it('rejects local profile targets on Vercel', () => {
    expect(() =>
      ucpAgentProfileUrlForBuild({
        UCP_AGENT_PROFILE_URL: 'https://localhost/ucp/agent-profile',
        VERCEL: '1',
      }),
    ).toThrow('UCP_AGENT_PROFILE_URL must be public');
  });
});
