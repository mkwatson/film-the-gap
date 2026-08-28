import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const knownPageReaderTestReceiptLimitBytes = 2 * 1024 * 1024;

function json(body: object, status = 200): Response {
  return Response.json(body, { status });
}

async function mockCloudflareStream(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === '/direct-upload') {
    return json({
      uploadId: '0123456789abcdef0123456789abcdef',
      uploadUrl: 'https://upload.videodelivery.net/0123456789abcdef0123456789abcdef',
    });
  }
  if (request.method === 'GET' && url.pathname === '/videos/0123456789abcdef0123456789abcdef') {
    return json({
      uploaded: true,
      readyToStream: true,
      status: 'ready',
      durationSeconds: 10,
      previewUrl:
        'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/watch',
      thumbnailUrl:
        'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/thumbnails/thumbnail.jpg',
      hlsPlaybackUrl:
        'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/manifest/video.m3u8',
    });
  }
  if (
    ['GET', 'POST'].includes(request.method) &&
    url.pathname === '/videos/0123456789abcdef0123456789abcdef/downloads/default'
  ) {
    return json({
      status: 'ready',
      percentComplete: 100,
      url: 'https://customer-demo.cloudflarestream.com/0123456789abcdef0123456789abcdef/downloads/default.mp4',
    });
  }
  return json({ error: 'not_found' }, 404);
}

async function mockVideoAnalysis(request: Request): Promise<Response> {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/video') {
    return json({ error: 'not_found' }, 404);
  }
  const input = (await request.json()) as Record<string, unknown>;
  const captureChallengePhrase = input.captureChallengePhrase;
  if (typeof captureChallengePhrase !== 'string') {
    return json({ error: 'capture_challenge_required' }, 400);
  }
  await new Promise((resolve) => setTimeout(resolve, 60));
  return json({
    modelId: 'google/gemini-3.7-flash',
    finding: {
      result: 'supports',
      confidence: 'high',
      observation: 'No water reached the paper during the continuous inversion.',
      startSeconds: 1,
      endSeconds: 10,
      continuity: 'continuous',
      captureChallenge: {
        status: 'verified',
        observation: `The exact mission phrase ${captureChallengePhrase} is audible at the start.`,
      },
      visibleDetails: ['The closed bottle stayed inverted above dry paper.'],
      limitations: ['The recording establishes only the tested ten-second interval.'],
    },
  });
}

async function mockProductPageReader(request: Request): Promise<Response> {
  if (request.method !== 'POST' || new URL(request.url).pathname !== '/markdown') {
    return json({ error: 'not_found' }, 404);
  }
  const input = (await request.json()) as Record<string, unknown>;
  const url = input.url;
  if (typeof url !== 'string') {
    return json({ error: 'url_required' }, 400);
  }
  const gotoOptions = input.gotoOptions;
  const extraHeaders = input.setExtraHTTPHeaders;
  const rejectedResourceTypes = input.rejectResourceTypes;
  if (
    !Array.isArray(input.allowRequestPattern) ||
    input.allowRequestPattern.length !== 1 ||
    input.allowRequestPattern[0] !== '/^https:\\/\\/shop\\.example\\//' ||
    !Array.isArray(rejectedResourceTypes) ||
    !['stylesheet', 'image', 'media', 'font'].every((resource) =>
      rejectedResourceTypes.includes(resource),
    ) ||
    typeof gotoOptions !== 'object' ||
    gotoOptions === null ||
    (gotoOptions as Record<string, unknown>).timeout !== 8_000 ||
    (gotoOptions as Record<string, unknown>).waitUntil !== 'domcontentloaded' ||
    input.actionTimeout !== 8_000 ||
    input.bestAttempt !== true ||
    input.cacheTTL !== 86_400 ||
    typeof extraHeaders !== 'object' ||
    extraHeaders === null ||
    (extraHeaders as Record<string, unknown>).Accept !== 'text/markdown, text/html;q=0.9'
  ) {
    return json({ error: 'unsafe_page_reader_contract' }, 400);
  }
  const crossOrigin = url.includes('/cross-origin');
  return Response.json(
    {
      success: true,
      result: url.includes('/oversized')
        ? 'x'.repeat(knownPageReaderTestReceiptLimitBytes + 1)
        : '---\ntitle: Trail Flask\n---\n# Trail Flask\n\n[Leak-resistant lid](https://shop.example/claims) for everyday use.\n\n```json\n{"@type":"Product"}\n```',
      meta: {
        status: 200,
        title: 'Trail Flask 24 oz',
        finalUrl: crossOrigin ? 'https://redirected.example/product' : url,
        headers: {
          'content-signal': url.includes('/deny-content')
            ? 'ai-train=no, search=no, ai-input=no'
            : 'ai-train=no, search=yes, ai-input=yes',
        },
      },
    },
    { headers: { 'X-Browser-Ms-Used': '824' } },
  );
}

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.evidence.jsonc' },
        miniflare: {
          d1Databases: { EVIDENCE_LIBRARY: 'test-evidence-library' },
          bindings: {
            AI_GATEWAY_API_KEY: 'test-only-budgeted-key',
            PAGE_READER_SHARED_SECRET: 'test-only-page-reader-secret',
            TEST_EVIDENCE_LIBRARY_MIGRATIONS: migrations,
          },
          serviceBindings: {
            STREAM_OUTBOUND: mockCloudflareStream,
            AI_ANALYSIS_OUTBOUND: mockVideoAnalysis,
            PAGE_READER_OUTBOUND: mockProductPageReader,
          },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/apply-evidence-library-migrations.ts'],
    },
  };
});
