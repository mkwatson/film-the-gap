// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest';

import { GET } from './route';

const originalRoomOrigin = process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL;
const originalCommit = process.env.VERCEL_GIT_COMMIT_SHA;

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
});
