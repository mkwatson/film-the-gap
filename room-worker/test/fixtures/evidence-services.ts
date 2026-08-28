const fixtureUploadId = 'acceptancevideo0000000000000001';

interface AnalysisInput {
  readonly uploadId: string;
  readonly productName: string;
  readonly question: string;
  readonly instruction: string;
  readonly successCriterion: string;
  readonly captureChallengePhrase: string;
  readonly durationSeconds: number;
  readonly continuousTakeRequired: boolean;
}

function json(body: object, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function analysisInput(value: unknown): AnalysisInput | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.uploadId !== 'string' ||
    typeof record.productName !== 'string' ||
    typeof record.question !== 'string' ||
    typeof record.instruction !== 'string' ||
    typeof record.successCriterion !== 'string' ||
    typeof record.captureChallengePhrase !== 'string' ||
    typeof record.durationSeconds !== 'number' ||
    typeof record.continuousTakeRequired !== 'boolean'
  ) {
    return null;
  }
  return {
    uploadId: record.uploadId,
    productName: record.productName,
    question: record.question,
    instruction: record.instruction,
    successCriterion: record.successCriterion,
    captureChallengePhrase: record.captureChallengePhrase,
    durationSeconds: record.durationSeconds,
    continuousTakeRequired: record.continuousTakeRequired,
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/direct-upload') {
      return json(
        {
          uploadId: fixtureUploadId,
          uploadUrl: `https://upload.videodelivery.net/${fixtureUploadId}`,
        },
        201,
      );
    }
    if (request.method === 'GET' && url.pathname === `/videos/${fixtureUploadId}`) {
      return json({
        uploaded: true,
        readyToStream: true,
        status: 'ready',
        durationSeconds: 12,
        previewUrl: `https://customer-acceptance.cloudflarestream.com/${fixtureUploadId}/watch`,
        thumbnailUrl: `https://customer-acceptance.cloudflarestream.com/${fixtureUploadId}/thumbnails/thumbnail.jpg`,
        hlsPlaybackUrl: `https://customer-acceptance.cloudflarestream.com/${fixtureUploadId}/manifest/video.m3u8`,
      });
    }
    if (
      ['GET', 'POST'].includes(request.method) &&
      url.pathname === `/videos/${fixtureUploadId}/downloads/default`
    ) {
      return json({
        status: 'ready',
        percentComplete: 100,
        url: `https://customer-acceptance.cloudflarestream.com/${fixtureUploadId}/downloads/default.mp4`,
      });
    }
    if (request.method === 'POST' && url.pathname === '/video') {
      const parsed = analysisInput((await request.json()) as unknown);
      if (
        parsed === null ||
        parsed.uploadId !== fixtureUploadId ||
        parsed.durationSeconds !== 12 ||
        !parsed.continuousTakeRequired
      ) {
        return json({ error: 'invalid_analysis_input' }, 400);
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
      return json({
        modelId: 'google/gemini-3.7-flash',
        finding: {
          result: 'supports',
          confidence: 'medium',
          observation:
            'The closed bottle remains inverted over dry paper for ten continuous seconds with no visible liquid on the paper.',
          startSeconds: 1,
          endSeconds: 11,
          continuity: 'continuous',
          captureChallenge: {
            status: 'not_detected',
            observation: `The synthetic fixture does not contain the mission phrase ${parsed.captureChallengePhrase}.`,
          },
          visibleDetails: [
            'The closed lid remains visible.',
            'The bottle stays inverted above the same paper.',
            'No liquid is visible on the paper at the end of the cited interval.',
          ],
          limitations: ['The clip establishes only this recorded test.'],
        },
      });
    }
    if (request.method === 'POST' && url.pathname === '/markdown') {
      const input = (await request.json()) as unknown;
      if (typeof input !== 'object' || input === null) {
        return json({ error: 'invalid_page_reader_input' }, 400);
      }
      const target = (input as Record<string, unknown>).url;
      const pageReaderInput = input as Record<string, unknown>;
      const gotoOptions = pageReaderInput.gotoOptions;
      const extraHeaders = pageReaderInput.setExtraHTTPHeaders;
      const rejectedResourceTypes = pageReaderInput.rejectResourceTypes;
      if (
        typeof target !== 'string' ||
        !target.startsWith('https://example.com/products/acceptance-travel-bottle-') ||
        !Array.isArray(pageReaderInput.allowRequestPattern) ||
        pageReaderInput.allowRequestPattern.length !== 1 ||
        pageReaderInput.allowRequestPattern[0] !== '/^https:\\/\\/example\\.com\\//' ||
        !Array.isArray(rejectedResourceTypes) ||
        !['stylesheet', 'image', 'media', 'font'].every((resource) =>
          rejectedResourceTypes.includes(resource),
        ) ||
        typeof gotoOptions !== 'object' ||
        gotoOptions === null ||
        (gotoOptions as Record<string, unknown>).timeout !== 8_000 ||
        (gotoOptions as Record<string, unknown>).waitUntil !== 'domcontentloaded' ||
        pageReaderInput.actionTimeout !== 8_000 ||
        pageReaderInput.bestAttempt !== true ||
        pageReaderInput.cacheTTL !== 86_400 ||
        typeof extraHeaders !== 'object' ||
        extraHeaders === null ||
        (extraHeaders as Record<string, unknown>).Accept !== 'text/markdown, text/html;q=0.9'
      ) {
        return json({ error: 'unsafe_page_reader_contract' }, 400);
      }
      return Response.json(
        {
          success: true,
          result:
            '# Acceptance travel bottle\n\nThe product page claims a leak-resistant lid. It does not show the requested upside-down test.',
          meta: {
            status: 200,
            title: 'Acceptance travel bottle',
            finalUrl: target,
            headers: {
              'content-signal': 'ai-train=no, search=yes, ai-input=yes',
            },
          },
        },
        { headers: { 'X-Browser-Ms-Used': '375' } },
      );
    }
    return json({ error: 'not_found' }, 404);
  },
} satisfies ExportedHandler;
