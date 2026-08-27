import type { CameraEvidenceFrameProvenance } from './model';

export interface CameraEvidenceInput {
  readonly blob: Blob;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly capturedAt: string;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export async function sha256Hex(blob: Blob): Promise<string> {
  if (blob.size === 0) {
    throw new Error('Cannot fingerprint an empty evidence frame.');
  }

  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createCameraEvidenceFrame(
  input: CameraEvidenceInput,
): Promise<CameraEvidenceFrameProvenance> {
  assertPositiveInteger(input.widthPx, 'Frame width');
  assertPositiveInteger(input.heightPx, 'Frame height');
  if (Number.isNaN(Date.parse(input.capturedAt))) {
    throw new Error('Capture time must be an ISO-8601 timestamp.');
  }

  const sha256 = await sha256Hex(input.blob);
  const frameId = `camera-${sha256.slice(0, 12)}`;

  return {
    kind: 'camera-keyframe',
    frameId,
    label: `Host camera keyframe · ${frameId}`,
    capturedAt: input.capturedAt,
    showOffsetSeconds: null,
    sha256,
    widthPx: input.widthPx,
    heightPx: input.heightPx,
  };
}

export function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob === null) {
          reject(new Error('The browser could not encode the evidence keyframe.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      0.86,
    );
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  if (blob.type !== 'image/jpeg' || blob.size === 0) {
    return Promise.reject(new Error('Only a non-empty JPEG evidence frame can be published.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (
        typeof reader.result !== 'string' ||
        !reader.result.startsWith('data:image/jpeg;base64,')
      ) {
        reject(new Error('The browser could not serialize the selected JPEG evidence frame.'));
        return;
      }
      resolve(reader.result);
    });
    reader.addEventListener('error', () => {
      reject(reader.error ?? new Error('The browser could not read the selected evidence frame.'));
    });
    reader.readAsDataURL(blob);
  });
}
