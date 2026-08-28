import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createGatewayMock, generateTextMock, gatewayModelMock } = vi.hoisted(() => {
  const model = vi.fn((modelId: string) => ({ provider: 'gateway', modelId }));
  return {
    createGatewayMock: vi.fn(() => model),
    generateTextMock: vi.fn(),
    gatewayModelMock: model,
  };
});

vi.mock('ai', () => ({
  createGateway: createGatewayMock,
  generateText: generateTextMock,
  Output: { object: vi.fn((options: unknown) => options) },
}));

import { generateAuthorizedVideoProposal } from './video-analysis';

const input = {
  uploadId: '0123456789abcdef0123456789abcdef',
  videoUrl:
    'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/downloads/default.mp4',
  productName: 'USB-C lavalier microphone',
  question: 'Can the phone charge while the receiver is connected and recording?',
  instruction: 'Show the receiver, charging indicator, and active recording timer.',
  successCriterion: 'Keep all three visible while the timer advances.',
  captureChallengePhrase: 'LIME ORBIT 47',
  durationSeconds: 12,
  continuousTakeRequired: true,
} as const;

const finding = {
  result: 'supports',
  confidence: 'high',
  observation: 'The charging indicator stayed visible while the recording timer advanced.',
  startSeconds: 2,
  endSeconds: 11,
  continuity: 'continuous',
  captureChallenge: {
    status: 'verified',
    observation: 'The exact mission phrase is audible at the start.',
  },
  visibleDetails: ['The charging icon remained visible.', 'The recording timer advanced.'],
  limitations: ['The clip does not establish long-term charging performance.'],
} as const;

describe('Vercel AI Gateway video evidence adapter', () => {
  beforeEach(() => {
    createGatewayMock.mockClear();
    gatewayModelMock.mockClear();
    generateTextMock.mockReset();
    generateTextMock.mockResolvedValue({
      output: finding,
      finalStep: { response: { modelId: 'google/gemini-3.7-flash' } },
    });
  });

  it('sends one authorized Stream MP4 to the latest compatible Gemini model', async () => {
    const proposal = await generateAuthorizedVideoProposal(input, { apiKey: 'test-key' });

    expect(createGatewayMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(gatewayModelMock).toHaveBeenCalledWith('google/gemini-3.7-flash');
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: 'low',
        providerOptions: {
          gateway: {
            models: ['google/gemini-3.6-flash'],
            disallowPromptTraining: true,
            tags: ['webmcp-challenge', 'product-evidence', 'video-review-v1'],
          },
        },
        include: {
          requestBody: false,
          requestMessages: false,
          responseBody: false,
        },
        messages: [
          {
            role: 'user',
            content: [
              expect.objectContaining({
                type: 'file',
                data: new URL(input.videoUrl),
                mediaType: 'video/mp4',
              }),
              expect.objectContaining({
                type: 'text',
                text: expect.stringMatching(
                  new RegExp(`${input.question}.*${input.captureChallengePhrase}`, 's'),
                ),
              }),
            ],
          },
        ],
      }),
    );
    expect(proposal).toEqual({ modelId: 'google/gemini-3.7-flash', finding });
  });

  it('rejects a model citation that escapes the verified recording', async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { ...finding, endSeconds: 20 },
      finalStep: { response: { modelId: 'google/gemini-3.7-flash' } },
    });

    await expect(generateAuthorizedVideoProposal(input, { apiKey: 'test-key' })).rejects.toThrow(
      'did not fit the recording boundary',
    );
  });
});
