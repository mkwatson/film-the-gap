// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { generateTextMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: generateTextMock,
  Output: {
    object: vi.fn((options: unknown) => options),
  },
}));

import { POST } from './route';

const frameHash = '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e';
const originalGatewayKey = process.env.AI_GATEWAY_API_KEY;
const originalOidcToken = process.env.VERCEL_OIDC_TOKEN;

function evidenceRequest(sha256 = frameHash): Request {
  const formData = new FormData();
  formData.append('frame', new File(['frame'], 'camera.jpg', { type: 'image/jpeg' }));
  formData.append('frameId', `camera-${sha256.slice(0, 12)}`);
  formData.append('frameSha256', sha256);
  formData.append('widthPx', '960');
  formData.append('heightPx', '540');
  return new Request('http://localhost/api/evidence/propose', {
    method: 'POST',
    body: formData,
  });
}

function restoreEnvironment(): void {
  if (originalGatewayKey === undefined) {
    delete process.env.AI_GATEWAY_API_KEY;
  } else {
    process.env.AI_GATEWAY_API_KEY = originalGatewayKey;
  }
  if (originalOidcToken === undefined) {
    delete process.env.VERCEL_OIDC_TOKEN;
  } else {
    process.env.VERCEL_OIDC_TOKEN = originalOidcToken;
  }
}

describe('POST /api/evidence/propose', () => {
  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
    delete process.env.VERCEL_OIDC_TOKEN;
    generateTextMock.mockReset();
  });

  afterEach(() => {
    restoreEnvironment();
  });

  it('returns a typed manual-review path when Gateway authentication is absent', async () => {
    const response = await POST(evidenceRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: 'manual-review-required',
      reason: 'gateway-unconfigured',
      frameId: 'camera-9dff50df08c6',
      frameSha256: frameHash,
    });
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it('recomputes the digest and rejects bytes that do not match the declaration', async () => {
    const wrongHash = `0${frameHash.slice(1)}`;
    const response = await POST(evidenceRequest(wrongHash));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'invalid_evidence_frame',
      message: 'The JPEG bytes do not match the declared frame digest.',
    });
  });

  it('uses the current OpenAI vision model through Gateway with bounded structured output', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-only-key';
    const finding = {
      baseVisibility: 'clear',
      surfaceFinding: 'no-obvious-repair',
      confidence: 'medium',
      visibleDetails: ['The full base is visible.'],
      summary: 'The full base is visible with no obvious repair marker.',
      suggestedNextView: null,
    };
    generateTextMock.mockResolvedValue({
      output: finding,
      finalStep: { response: { modelId: 'openai/gpt-5.6-sol' } },
    });

    const response = await POST(evidenceRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: 'proposal',
      modelId: 'openai/gpt-5.6-sol',
      finding,
    });
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'openai/gpt-5.6-sol',
        providerOptions: {
          gateway: {
            models: ['openai/gpt-5.6-terra', 'openai/gpt-5.6-luna'],
            zeroDataRetention: true,
          },
        },
        include: {
          requestBody: false,
          requestMessages: false,
          responseBody: false,
        },
      }),
    );
  });

  it('falls back to manual review without exposing provider errors', async () => {
    process.env.AI_GATEWAY_API_KEY = 'test-only-key';
    generateTextMock.mockRejectedValue(new Error('sensitive provider failure'));

    const response = await POST(evidenceRequest());
    const body: unknown = await response.json();

    expect(body).toMatchObject({
      kind: 'manual-review-required',
      reason: 'gateway-unavailable',
    });
    expect(JSON.stringify(body)).not.toContain('sensitive provider failure');
  });
});
