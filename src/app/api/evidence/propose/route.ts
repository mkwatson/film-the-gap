import { generateText, Output } from 'ai';

import { sha256Hex } from '@/lib/live-market/camera-evidence';
import {
  evidenceVisionFallbackModels,
  evidenceVisionPrimaryModel,
  visualEvidenceFindingSchema,
} from '@/lib/live-market/evidence-proposal';
import { maximumCapturedEvidenceFrameBytes } from '@/lib/live-market/model';

export const runtime = 'nodejs';

const maximumRequestBytes = maximumCapturedEvidenceFrameBytes + 150_000;
const sha256Pattern = /^[a-f0-9]{64}$/;
const frameIdPattern = /^camera-[a-f0-9]{12}$/;

interface ValidEvidenceFrameRequest {
  readonly frame: File;
  readonly frameId: string;
  readonly frameSha256: string;
  readonly widthPx: number;
  readonly heightPx: number;
}

interface InvalidEvidenceFrameRequest {
  readonly error: string;
}

function responseJson(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function parsePositiveInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 960 ? parsed : null;
}

async function parseEvidenceFrameRequest(
  request: Request,
): Promise<ValidEvidenceFrameRequest | InvalidEvidenceFrameRequest> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maximumRequestBytes) {
    return { error: 'The evidence request is too large.' };
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return { error: 'Expected one multipart evidence frame.' };
  }

  const frame = formData.get('frame');
  const frameId = formData.get('frameId');
  const frameSha256 = formData.get('frameSha256');
  const widthPx = parsePositiveInteger(formData.get('widthPx'));
  const heightPx = parsePositiveInteger(formData.get('heightPx'));

  if (!(frame instanceof File) || frame.type !== 'image/jpeg') {
    return { error: 'The selected evidence frame must be a JPEG file.' };
  }
  if (frame.size === 0 || frame.size > maximumCapturedEvidenceFrameBytes) {
    return { error: 'The selected evidence frame must be between 1 byte and 650 KB.' };
  }
  if (
    typeof frameId !== 'string' ||
    !frameIdPattern.test(frameId) ||
    typeof frameSha256 !== 'string' ||
    !sha256Pattern.test(frameSha256) ||
    frameId !== `camera-${frameSha256.slice(0, 12)}`
  ) {
    return { error: 'The frame identity or digest is invalid.' };
  }
  if (widthPx === null || heightPx === null) {
    return { error: 'The frame dimensions are invalid.' };
  }

  const computedSha256 = await sha256Hex(frame);
  if (computedSha256 !== frameSha256) {
    return { error: 'The JPEG bytes do not match the declared frame digest.' };
  }

  return { frame, frameId, frameSha256, widthPx, heightPx };
}

function gatewayCanBeAttempted(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    process.env.VERCEL === '1',
  );
}

function manualReviewResponse(
  input: ValidEvidenceFrameRequest,
  reason: 'gateway-unconfigured' | 'gateway-unavailable',
): Response {
  return responseJson({
    kind: 'manual-review-required',
    frameId: input.frameId,
    frameSha256: input.frameSha256,
    reason,
    message:
      reason === 'gateway-unconfigured'
        ? 'AI Gateway is not configured in this environment. Review the exact frame manually.'
        : 'AI Gateway could not return a bounded proposal. Review the exact frame manually.',
  });
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseEvidenceFrameRequest(request);
  if ('error' in parsed) {
    return responseJson({ error: 'invalid_evidence_frame', message: parsed.error }, 400);
  }

  if (!gatewayCanBeAttempted()) {
    return manualReviewResponse(parsed, 'gateway-unconfigured');
  }

  try {
    const frameBytes = new Uint8Array(await parsed.frame.arrayBuffer());
    const result = await generateText({
      model: evidenceVisionPrimaryModel,
      output: Output.object({
        name: 'LiveCommerceFrameObservation',
        description:
          'A bounded observation of only what is visibly supported by one seller-selected frame.',
        schema: visualEvidenceFindingSchema,
      }),
      instructions: [
        'You are reviewing one seller-selected evidence frame from a live snowboard sale.',
        'Describe only visible pixels. Never infer identity, intent, price, authenticity, ownership, safety, or repair history.',
        'A visually clean surface does not prove that the board was never repaired.',
        'Use possible-repair only for an actually visible patch, fill, seam, discoloration, or repair-like marker.',
        'If the full base is not clear enough to assess, choose partial, not-visible, or unclear and request a better view.',
        'Keep the summary concise, neutral, and explicit about uncertainty.',
      ].join(' '),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Review frame ${parsed.frameId} (${parsed.widthPx}×${parsed.heightPx}). Return a visual observation, not a historical repair claim.`,
            },
            {
              type: 'file',
              data: { type: 'data', data: frameBytes },
              mediaType: 'image/jpeg',
              filename: `${parsed.frameId}.jpg`,
            },
          ],
        },
      ],
      reasoning: 'none',
      maxOutputTokens: 500,
      providerOptions: {
        gateway: {
          models: [...evidenceVisionFallbackModels],
          zeroDataRetention: true,
        },
      },
      include: {
        requestBody: false,
        requestMessages: false,
        responseBody: false,
      },
      timeout: { totalMs: 20_000 },
      abortSignal: request.signal,
    });

    return responseJson({
      kind: 'proposal',
      frameId: parsed.frameId,
      frameSha256: parsed.frameSha256,
      modelId: result.finalStep.response.modelId,
      finding: result.output,
    });
  } catch {
    return manualReviewResponse(parsed, 'gateway-unavailable');
  }
}
