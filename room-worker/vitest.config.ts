import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

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
            TEST_EVIDENCE_LIBRARY_MIGRATIONS: migrations,
          },
          serviceBindings: {
            STREAM_OUTBOUND: mockCloudflareStream,
            AI_ANALYSIS_OUTBOUND: mockVideoAnalysis,
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
