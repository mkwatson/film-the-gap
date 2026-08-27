import { describe, expect, it } from 'vitest';

import {
  blobToDataUrl,
  canvasToJpegBlob,
  createCameraEvidenceFrame,
  sha256Hex,
} from './camera-evidence';

const frameHash = '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e';

describe('camera evidence provenance', () => {
  it('creates a stable public descriptor without embedding the captured bytes', async () => {
    const blob = new Blob(['frame'], { type: 'image/jpeg' });

    await expect(sha256Hex(blob)).resolves.toBe(frameHash);
    await expect(
      createCameraEvidenceFrame({
        blob,
        widthPx: 960,
        heightPx: 540,
        capturedAt: '2026-08-26T19:22:31.000Z',
      }),
    ).resolves.toEqual({
      kind: 'camera-keyframe',
      frameId: 'camera-9dff50df08c6',
      label: 'Host camera keyframe · camera-9dff50df08c6',
      capturedAt: '2026-08-26T19:22:31.000Z',
      showOffsetSeconds: null,
      sha256: frameHash,
      widthPx: 960,
      heightPx: 540,
    });
  });

  it('rejects empty or dimensionless evidence frames', async () => {
    await expect(sha256Hex(new Blob())).rejects.toThrow('empty evidence frame');
    await expect(
      createCameraEvidenceFrame({
        blob: new Blob(['frame']),
        widthPx: 0,
        heightPx: 540,
        capturedAt: '2026-08-26T19:22:31.000Z',
      }),
    ).rejects.toThrow('Frame width must be a positive integer');
    await expect(
      createCameraEvidenceFrame({
        blob: new Blob(['frame']),
        widthPx: 960,
        heightPx: 540,
        capturedAt: 'not-a-time',
      }),
    ).rejects.toThrow('Capture time must be an ISO-8601 timestamp');
  });

  it('rejects when the browser cannot encode a canvas keyframe', async () => {
    const canvas = document.createElement('canvas');
    canvas.toBlob = (callback): void => callback(null);

    await expect(canvasToJpegBlob(canvas)).rejects.toThrow('could not encode');
  });

  it('reduces JPEG quality until the frame fits the remote room budget', async () => {
    const canvas = document.createElement('canvas');
    let attempts = 0;
    canvas.toBlob = (callback): void => {
      attempts += 1;
      const size = attempts === 1 ? 700_000 : 500_000;
      callback(new Blob([new Uint8Array(size)], { type: 'image/jpeg' }));
    };

    await expect(canvasToJpegBlob(canvas)).resolves.toMatchObject({ size: 500_000 });
    expect(attempts).toBe(2);
  });

  it('asks the host to retry when no safe JPEG encoding fits', async () => {
    const canvas = document.createElement('canvas');
    canvas.toBlob = (callback): void => {
      callback(new Blob([new Uint8Array(700_000)], { type: 'image/jpeg' }));
    };

    await expect(canvasToJpegBlob(canvas)).rejects.toThrow('too detailed to publish safely');
  });

  it('serializes only a selected non-empty JPEG for intentional publication', async () => {
    await expect(blobToDataUrl(new Blob(['frame'], { type: 'image/jpeg' }))).resolves.toBe(
      'data:image/jpeg;base64,ZnJhbWU=',
    );
    await expect(blobToDataUrl(new Blob(['frame'], { type: 'image/png' }))).rejects.toThrow(
      'Only a non-empty JPEG',
    );
  });
});
