import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HostCameraCapture } from './host-camera-capture';

const frameHash = '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e';
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalCreateObjectUrl = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectUrl = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

function restoreProperty(
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, property);
    return;
  }
  Object.defineProperty(target, property, descriptor);
}

function installMediaDevices(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

describe('HostCameraCapture', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:host-camera-frame'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(HTMLVideoElement.prototype, 'videoWidth', 'get').mockReturnValue(1280);
    vi.spyOn(HTMLVideoElement.prototype, 'videoHeight', 'get').mockReturnValue(720);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(new Blob(['frame'], { type: 'image/jpeg' }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    restoreProperty(navigator, 'mediaDevices', originalMediaDevices);
    restoreProperty(URL, 'createObjectURL', originalCreateObjectUrl);
    restoreProperty(URL, 'revokeObjectURL', originalRevokeObjectUrl);
  });

  it('keeps the camera off until an explicit click, then publishes one manually reviewed frame', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    const onPublish = vi.fn();
    installMediaDevices(getUserMedia);

    render(<HostCameraCapture onPublish={onPublish} />);

    expect(getUserMedia).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Start camera' }));
    await screen.findByRole('button', { name: 'Capture keyframe' });
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    await user.click(screen.getByRole('button', { name: 'Capture keyframe' }));
    await screen.findByRole('button', { name: 'Review manually' });
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText('camera-9dff50df08c6')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Review manually' }));
    await user.selectOptions(screen.getByLabelText('Base visibility'), 'clear');
    await user.selectOptions(screen.getByLabelText('Visible surface signal'), 'no-obvious-repair');
    await user.click(screen.getByRole('button', { name: 'Save manual observation' }));
    await user.click(screen.getByRole('button', { name: 'Publish · no prior repair' }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish).toHaveBeenCalledWith(
      'none',
      {
        kind: 'camera-keyframe',
        frameId: 'camera-9dff50df08c6',
        label: 'Host camera keyframe · camera-9dff50df08c6',
        capturedAt: expect.any(String),
        showOffsetSeconds: null,
        sha256: frameHash,
        widthPx: 960,
        heightPx: 540,
      },
      {
        source: 'manual-review',
        modelId: null,
        frameId: 'camera-9dff50df08c6',
        frameSha256: frameHash,
        proposal: null,
        reviewedFinding: {
          baseVisibility: 'clear',
          surfaceFinding: 'no-obvious-repair',
          confidence: 'medium',
          visibleDetails: [],
          summary:
            'Host review: base visibility is clear; visible surface finding is no-obvious-repair.',
          suggestedNextView: null,
        },
        hostDecision: 'manual',
      },
      'data:image/jpeg;base64,ZnJhbWU=',
    );
    expect(JSON.stringify(onPublish.mock.calls)).not.toContain('blob:host-camera-frame');
  });

  it('sends only the selected frame for an AI proposal and records explicit host acceptance', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    installMediaDevices(vi.fn(async () => stream));
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        void input;
        void init;
        return Response.json({
          kind: 'proposal',
          frameId: 'camera-9dff50df08c6',
          frameSha256: frameHash,
          modelId: 'openai/gpt-5.6-sol',
          finding: {
            baseVisibility: 'clear',
            surfaceFinding: 'no-obvious-repair',
            confidence: 'medium',
            visibleDetails: ['The full base is visible in even light.'],
            summary: 'The full base is visible with no obvious repair marker.',
            suggestedNextView: null,
          },
        });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    const onPublish = vi.fn();

    render(<HostCameraCapture onPublish={onPublish} />);
    await user.click(screen.getByRole('button', { name: 'Start camera' }));
    await user.click(await screen.findByRole('button', { name: 'Capture keyframe' }));
    await user.click(await screen.findByRole('button', { name: 'Analyze with AI Gateway' }));
    await screen.findByText('AI proposal · untrusted until reviewed');

    const request = fetchMock.mock.calls[0];
    expect(request?.[0]).toBe('/api/evidence/propose');
    expect(request?.[1]).toMatchObject({ method: 'POST' });
    expect(request?.[1]?.body).toBeInstanceOf(FormData);

    await user.click(screen.getByRole('button', { name: 'Accept or save correction' }));
    expect(screen.getByText('Host accepted')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Publish · no prior repair' }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish.mock.calls[0]?.[2]).toMatchObject({
      source: 'ai-gateway',
      modelId: 'openai/gpt-5.6-sol',
      hostDecision: 'accepted',
    });
    expect(onPublish.mock.calls[0]?.[3]).toBe('data:image/jpeg;base64,ZnJhbWU=');
  });

  it('reports a permission denial and preserves the retry/fallback path', async () => {
    const user = userEvent.setup();
    const getUserMedia = vi.fn(async () => {
      throw new DOMException('Denied for test', 'NotAllowedError');
    });
    const onPublish = vi.fn();
    installMediaDevices(getUserMedia);

    render(<HostCameraCapture onPublish={onPublish} />);
    await user.click(screen.getByRole('button', { name: 'Start camera' }));

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('Camera permission was not granted');
    });
    expect(screen.getByRole('button', { name: 'Start camera' })).toBeTruthy();
    expect(screen.getByText(/retry or use the fixture fallback/i)).toBeTruthy();
    expect(onPublish).not.toHaveBeenCalled();
  });

  it('stops a live camera stream when the host view unmounts', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    } as unknown as MediaStream;
    installMediaDevices(vi.fn(async () => stream));

    const { unmount } = render(<HostCameraCapture onPublish={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start camera' }));
    await screen.findByRole('button', { name: 'Capture keyframe' });

    unmount();

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
