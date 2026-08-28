import { describe, expect, it } from 'vitest';

import evidenceServices from './fixtures/evidence-services';

describe('evidence acceptance services', () => {
  it('returns one coherent Stream upload, status, and download contract', async () => {
    const reservation = await evidenceServices.fetch(
      new Request('https://fixture.test/direct-upload', { method: 'POST' }),
    );
    const created = (await reservation.json()) as {
      readonly uploadId: string;
      readonly uploadUrl: string;
    };

    expect(reservation.status).toBe(201);
    expect(created.uploadUrl).toBe(`https://upload.videodelivery.net/${created.uploadId}`);
    const status = await evidenceServices.fetch(
      new Request(`https://fixture.test/videos/${created.uploadId}`),
    );
    expect(await status.json()).toMatchObject({
      uploaded: true,
      readyToStream: true,
      durationSeconds: 12,
    });
    const download = await evidenceServices.fetch(
      new Request(`https://fixture.test/videos/${created.uploadId}/downloads/default`, {
        method: 'POST',
      }),
    );
    expect(await download.json()).toMatchObject({ status: 'ready', percentComplete: 100 });

    const privacy = await evidenceServices.fetch(
      new Request(`https://fixture.test/videos/${created.uploadId}/privacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requireSignedURLs: true,
          allowedOrigins: ['rooms.example'],
        }),
      }),
    );
    expect(await privacy.json()).toEqual({ protected: true });

    const restored = await evidenceServices.fetch(
      new Request(`https://fixture.test/videos/${created.uploadId}/privacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requireSignedURLs: false,
          allowedOrigins: ['localhost'],
        }),
      }),
    );
    expect(await restored.json()).toEqual({ protected: false });

    const token = await evidenceServices.fetch(
      new Request(`https://fixture.test/videos/${created.uploadId}/token`, { method: 'POST' }),
    );
    expect(await token.json()).toMatchObject({
      token: 'signed.acceptance.token.0123456789abcdef',
      previewUrl: expect.stringContaining(`${created.uploadId}/watch`),
    });
  });

  it('fails malformed video-analysis input closed', async () => {
    const response = await evidenceServices.fetch(
      new Request('https://fixture.test/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId: 'wrong' }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_analysis_input' });
  });
});
