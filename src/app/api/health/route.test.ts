// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';

import { GET } from './route';

const originalRoomOrigin = process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL;
const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;
const originalReleaseCommit = process.env.WEBMCP_RELEASE_COMMIT_SHA;

afterEach(() => {
  if (originalRoomOrigin === undefined) {
    delete process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL;
  } else {
    process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL = originalRoomOrigin;
  }
  if (originalCommit === undefined) {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
  } else {
    process.env.VERCEL_GIT_COMMIT_SHA = originalCommit;
  }
  if (originalReleaseCommit === undefined) {
    delete process.env.WEBMCP_RELEASE_COMMIT_SHA;
  } else {
    process.env.WEBMCP_RELEASE_COMMIT_SHA = originalReleaseCommit;
  }
});

describe('GET /api/health', () => {
  it('reports the normalized public room origin and deployed commit without exposing secrets', async () => {
    process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL = 'https://rooms.example/';
    process.env.VERCEL_GIT_COMMIT_SHA = 'A'.repeat(40);

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: 'webmcp-challenge-app',
      commit: 'a'.repeat(40),
      evidenceRoomOrigin: 'https://rooms.example',
      evidenceRoomConfigured: true,
    });
  });

  it('fails closed for credentialed or path-bearing room configuration and malformed commits', async () => {
    process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL = 'https://user:secret@rooms.example/private';
    process.env.VERCEL_GIT_COMMIT_SHA = 'not-a-commit';

    await expect(GET().json()).resolves.toMatchObject({
      commit: null,
      evidenceRoomOrigin: null,
      evidenceRoomConfigured: false,
    });
  });

  it('uses an explicitly reviewed release commit for a prebuilt artifact', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    process.env.WEBMCP_RELEASE_COMMIT_SHA = 'b'.repeat(40);

    await expect(GET().json()).resolves.toMatchObject({
      commit: 'b'.repeat(40),
    });
  });

  it('prefers Vercel Git identity over an explicit release fallback', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'c'.repeat(40);
    process.env.WEBMCP_RELEASE_COMMIT_SHA = 'd'.repeat(40);

    await expect(GET().json()).resolves.toMatchObject({
      commit: 'c'.repeat(40),
    });
  });
});
