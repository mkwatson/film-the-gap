import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
  type EvidenceNetworkState,
} from '@/lib/evidence-network/model';
import type { RemoteEvidenceCaseSnapshot } from '@/lib/evidence-network/remote-protocol';

import { EvidenceContributor } from './evidence-contributor';

const remoteMocks = vi.hoisted(() => ({
  read: vi.fn(),
  reserve: vi.fn(),
  upload: vi.fn(),
  analyze: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/lib/evidence-network/remote-client', () => ({
  configuredEvidenceServiceUrl: () => 'https://rooms.example',
  readRemoteEvidenceCase: remoteMocks.read,
  reserveRemoteEvidenceUpload: remoteMocks.reserve,
  uploadEvidenceVideo: remoteMocks.upload,
  analyzeRemoteEvidenceVideo: remoteMocks.analyze,
  publishRemoteEvidence: remoteMocks.publish,
}));

const mission = {
  instruction: 'Fill the bottle, close the lid, and hold it upside down over dry paper.',
  successCriterion: 'Keep the closed lid and dry paper visible for the entire test.',
  minimumSeconds: 10,
  continuousTakeRequired: true,
} as const;

function openMissionState(): EvidenceNetworkState {
  return applyEvidenceNetworkCommand(
    createDemoEvidenceNetworkState(),
    { kind: 'create-filming-mission', actor: 'agent', input: mission },
    '2026-08-27T16:00:00.000Z',
  ).state;
}

function snapshot(state = openMissionState()): RemoteEvidenceCaseSnapshot {
  return {
    protocolVersion: '1',
    caseId: 'BCDF2345',
    expiresAt: Date.now() + 60_000,
    state,
    lastMessage: 'Waiting for a contributor.',
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.location.hash = `token=${'c'.repeat(43)}`;
  remoteMocks.read.mockResolvedValue(snapshot());
  remoteMocks.reserve.mockResolvedValue({
    provider: 'cloudflare_stream',
    uploadId: '0123456789abcdef0123456789abcdef',
    uploadUrl: 'https://upload.videodelivery.net/0123456789abcdef0123456789abcdef',
    maxDurationSeconds: 15,
    expiresAt: '2026-08-27T17:00:00.000Z',
  });
  remoteMocks.upload.mockResolvedValue(undefined);
  remoteMocks.analyze.mockResolvedValue({
    kind: 'proposal',
    uploadId: '0123456789abcdef0123456789abcdef',
    modelId: 'google/gemini-3.7-flash',
    finding: {
      result: 'supports',
      confidence: 'high',
      observation: 'No water reached the paper during the continuous inversion.',
      startSeconds: 1,
      endSeconds: 10,
      continuity: 'continuous',
      visibleDetails: ['The bottle and dry paper remained visible.'],
      limitations: ['This shows only the recorded ten-second test.'],
    },
  });
  const publishedState = applyEvidenceNetworkCommand(
    openMissionState(),
    {
      kind: 'publish-reviewed-evidence',
      actor: 'contributor',
      input: {
        result: 'supports',
        observation: 'The requested behavior was visible for the full continuous test.',
        contributorLabel: 'Product owner',
        durationSeconds: 10,
        citationStartSeconds: 1,
        citationEndSeconds: 10,
        confidence: 'high',
        continuity: 'continuous',
        rights: 'owned',
        reuseScope: 'case_only',
        provenance: 'live_capture',
        capturedAt: '2026-08-27T16:01:00.000Z',
        streamUid: '0123456789abcdef0123456789abcdef',
        sha256: 'a'.repeat(64),
      },
    },
    '2026-08-27T16:01:00.000Z',
  ).state;
  remoteMocks.publish.mockResolvedValue({
    ...snapshot(publishedState),
    lastMessage: 'Reviewed evidence published. The answer is now supported.',
  });
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:test-video'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  window.location.hash = '';
  window.sessionStorage.clear();
  vi.clearAllMocks();
});

describe('EvidenceContributor', () => {
  it('opens one exact no-login mission with a phone camera input', async () => {
    render(<EvidenceContributor caseId="BCDF2345" />);

    expect(await screen.findByText('Everyday insulated travel bottle')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
      }),
    ).toBeTruthy();
    const input = screen.getByLabelText('Record or choose evidence video');
    expect(input.getAttribute('accept')).toBe('video/*');
    expect(input.getAttribute('capture')).toBe('environment');
    expect(screen.queryByText(/sign in/i)).toBeNull();
  });

  it('scrubs the bearer capability from the URL and recovers it after reload', async () => {
    const capability = 'c'.repeat(43);
    const first = render(<EvidenceContributor caseId="BCDF2345" />);

    expect(await screen.findByText('Everyday insulated travel bottle')).toBeTruthy();
    expect(window.location.hash).toBe('');
    expect(window.sessionStorage.getItem('product-evidence-contributor:BCDF2345')).toBe(capability);

    first.unmount();
    remoteMocks.read.mockClear();
    render(<EvidenceContributor caseId="BCDF2345" />);

    expect(await screen.findByText('Everyday insulated travel bottle')).toBeTruthy();
    expect(remoteMocks.read).toHaveBeenCalledOnce();
  });

  it('refuses a link whose contributor capability is missing', async () => {
    window.location.hash = '';
    window.sessionStorage.clear();
    render(<EvidenceContributor caseId="BCDF2345" />);

    expect(
      await screen.findByText('This contribution link is missing its private one-time capability.'),
    ).toBeTruthy();
    expect(remoteMocks.read).not.toHaveBeenCalled();
  });

  it('uploads, requires human review, and explicitly opts into reusable publication', async () => {
    render(<EvidenceContributor caseId="BCDF2345" />);
    const input = await screen.findByLabelText('Record or choose evidence video');
    const file = new File(['ten-second-video'], 'proof.mp4', { type: 'video/mp4' });
    if (file.arrayBuffer === undefined) {
      Object.defineProperty(file, 'arrayBuffer', {
        configurable: true,
        value: async (): Promise<ArrayBuffer> =>
          new TextEncoder().encode('ten-second-video').buffer,
      });
    }
    fireEvent.change(input, { target: { files: [file] } });

    const video = await waitFor(() => {
      const found = document.querySelector('video');
      if (found === null) {
        throw new Error('Expected a local video preview.');
      }
      return found;
    });
    Object.defineProperty(video, 'duration', { configurable: true, value: 10 });
    fireEvent.loadedMetadata(video);

    const uploadButton = await screen.findByRole('button', { name: 'Upload + draft evidence' });
    await waitFor(() => expect(uploadButton.hasAttribute('disabled')).toBe(false));
    fireEvent.click(uploadButton);

    expect(
      await screen.findByRole('heading', { name: 'What does your video actually show?' }),
    ).toBeTruthy();
    expect(remoteMocks.reserve).toHaveBeenCalledOnce();
    expect(remoteMocks.reserve).toHaveBeenCalledWith(
      'https://rooms.example',
      'BCDF2345',
      expect.objectContaining({
        fileSizeBytes: file.size,
        maxDurationSeconds: 15,
        mimeType: 'video/mp4',
      }),
    );
    expect(remoteMocks.upload).toHaveBeenCalledOnce();
    expect(remoteMocks.analyze).toHaveBeenCalledOnce();
    expect(screen.getByText('google/gemini-3.7-flash')).toBeTruthy();
    expect(screen.getByText('Proposed citation 00:01–00:10')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Future matching product questions too'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish reviewed evidence' }));

    expect(await screen.findByText('The evidence case updated')).toBeTruthy();
    expect(screen.getByText('Supported')).toBeTruthy();
    expect(remoteMocks.publish).toHaveBeenCalledWith(
      'https://rooms.example',
      'BCDF2345',
      expect.objectContaining({
        uploadId: '0123456789abcdef0123456789abcdef',
        review: expect.objectContaining({
          result: 'supports',
          rights: 'owned',
          reuseScope: 'public_network',
          confidence: 'high',
          continuity: 'continuous',
          citationStartSeconds: 1,
          citationEndSeconds: 10,
        }),
      }),
    );
  });

  it('falls back to an explicit inconclusive manual review when AI is unavailable', async () => {
    remoteMocks.analyze.mockResolvedValueOnce({
      kind: 'manual-review-required',
      uploadId: '0123456789abcdef0123456789abcdef',
      reason: 'gateway-unconfigured',
      message: 'Vercel AI Gateway is not configured here. Review manually.',
    });
    render(<EvidenceContributor caseId="BCDF2345" />);
    const input = await screen.findByLabelText('Record or choose evidence video');
    const file = new File(['ten-second-video'], 'proof.mp4', { type: 'video/mp4' });
    if (file.arrayBuffer === undefined) {
      Object.defineProperty(file, 'arrayBuffer', {
        configurable: true,
        value: async (): Promise<ArrayBuffer> =>
          new TextEncoder().encode('ten-second-video').buffer,
      });
    }
    fireEvent.change(input, { target: { files: [file] } });
    const video = await waitFor(() => {
      const found = document.querySelector('video');
      if (found === null) throw new Error('Expected a local video preview.');
      return found;
    });
    Object.defineProperty(video, 'duration', { configurable: true, value: 10 });
    fireEvent.loadedMetadata(video);
    const uploadButton = await screen.findByRole('button', { name: 'Upload + draft evidence' });
    await waitFor(() => expect(uploadButton.hasAttribute('disabled')).toBe(false));
    fireEvent.click(uploadButton);

    expect(await screen.findByText('Manual review')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'inconclusive' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(
      screen.getByLabelText('Future matching product questions too').hasAttribute('disabled'),
    ).toBe(true);
  });
});
