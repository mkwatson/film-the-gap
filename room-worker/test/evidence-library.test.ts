import { env } from 'cloudflare:workers';
import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

import {
  reusableEvidenceSearchResponseSchema,
  type ReusableEvidenceRecord,
} from '../../src/lib/evidence-network/model';
import {
  deleteExpiredReusableEvidence,
  indexReusableEvidence,
  normalizeEvidenceMatchText,
  searchReusableEvidence,
} from '../src/evidence-library';

const database = (env as unknown as { readonly EVIDENCE_LIBRARY: D1Database }).EVIDENCE_LIBRARY;
const appOrigin = 'http://localhost:3000';

function record(
  streamUid: string,
  overrides: Partial<ReusableEvidenceRecord> = {},
): ReusableEvidenceRecord {
  return {
    id: `case:${streamUid}`,
    productName: 'Trail Flask 24 oz',
    productUrl: 'https://shop.example/products/trail-flask',
    question: 'Does it stay leak-free while upside down for ten seconds?',
    source: {
      title: 'Contributor-recorded mission video',
      videoUrl: `https://customer-demo.cloudflarestream.com/${streamUid}/watch`,
      rights: 'owned',
      provenance: 'live_capture',
      continuity: 'continuous',
      captureTiming: 'mission_challenge_verified',
      contributorLabel: 'Product owner',
      capturedAt: '2026-08-27T19:00:00.000Z',
      streamUid,
      sha256: 'a'.repeat(64),
      durationSeconds: 12,
    },
    observation: {
      result: 'supports',
      confidence: 'high',
      text: 'No liquid reached the paper during the continuous inversion.',
      citationStartSeconds: 1,
      citationEndSeconds: 11,
      reviewedAt: '2026-08-27T19:01:00.000Z',
    },
    indexedAt: '2026-08-27T19:01:00.000Z',
    expiresAt: '2026-09-26T19:01:00.000Z',
    ...overrides,
  };
}

describe('reusable evidence library', () => {
  it('normalizes harmless wording differences without claiming semantic matching', () => {
    expect(normalizeEvidenceMatchText('  TRAIL-Flask™ 24 OZ! ')).toBe('trail flask 24 oz');
  });

  it('rejects inconclusive or weak recordings from the reusable index', async () => {
    await expect(
      indexReusableEvidence(
        database,
        record('networkvideo00000007', {
          observation: {
            ...record('networkvideo00000007').observation,
            result: 'inconclusive',
            confidence: 'low',
          },
        }),
      ),
    ).rejects.toThrow(/conclusive.*confidence.*continuous/i);
  });

  it('returns fresh exact-claim evidence and excludes expired records', async () => {
    await indexReusableEvidence(database, record('networkvideo00000001'));
    await indexReusableEvidence(
      database,
      record('networkvideo00000002', {
        indexedAt: '2026-08-27T19:02:00.000Z',
        expiresAt: '2026-08-28T19:02:00.000Z',
      }),
    );

    const results = await searchReusableEvidence(
      database,
      {
        productName: 'trail flask 24 OZ',
        question: 'Does it stay leak free while upside down for ten seconds?',
      },
      '2026-08-29T00:00:00.000Z',
    );

    expect(results.map(({ source }) => source.streamUid)).toEqual(['networkvideo00000001']);
  });

  it('requires exact product identity when a public product URL is supplied', async () => {
    await indexReusableEvidence(
      database,
      record('networkvideo00000004', {
        productName: 'Same-name product',
        productUrl: 'https://brand-one.example/products/model',
      }),
    );
    await indexReusableEvidence(
      database,
      record('networkvideo00000005', {
        productName: 'Same-name product',
        productUrl: 'https://brand-two.example/products/model',
      }),
    );

    const results = await searchReusableEvidence(database, {
      productName: 'Same-name product',
      productUrl: 'https://brand-two.example/products/model#details',
      question: 'Does it stay leak-free while upside down for ten seconds?',
    });

    expect(results.map(({ source }) => source.streamUid)).toEqual(['networkvideo00000005']);
  });

  it('physically purges expired evidence after it stops being searchable', async () => {
    const expired = record('networkvideo00000006', {
      productName: 'Expired-only product',
      question: 'Does this expired-only product show the requested behavior?',
      indexedAt: '2026-08-27T19:04:00.000Z',
      expiresAt: '2026-08-28T19:04:00.000Z',
    });
    await indexReusableEvidence(database, expired);

    expect(
      await deleteExpiredReusableEvidence(database, '2026-08-29T00:00:00.000Z'),
    ).toBeGreaterThan(0);
    expect(
      await searchReusableEvidence(
        database,
        { productName: expired.productName, question: expired.question },
        '2026-08-27T20:00:00.000Z',
      ),
    ).toEqual([]);
  });

  it('upserts a reviewed Stream recording and serves it through the public Worker route', async () => {
    const initial = record('networkvideo00000003');
    await indexReusableEvidence(database, initial);
    await indexReusableEvidence(database, {
      ...initial,
      observation: {
        ...initial.observation,
        result: 'contradicts',
        text: 'A wet line appeared on the paper at 00:08.',
        reviewedAt: '2026-08-27T19:03:00.000Z',
      },
      indexedAt: '2026-08-27T19:03:00.000Z',
    });

    const response = await SELF.fetch('https://evidence.example/evidence-library/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: appOrigin },
      body: JSON.stringify({
        productName: 'Trail Flask 24 oz',
        productUrl: 'https://shop.example/products/trail-flask#details',
        question: 'Does it stay leak-free while upside down for ten seconds?',
      }),
    });
    const result = reusableEvidenceSearchResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(appOrigin);
    expect(result.status).toBe('complete');
    expect(result.records[0]).toMatchObject({
      source: {
        streamUid: 'networkvideo00000003',
        captureTiming: 'mission_challenge_verified',
      },
      observation: {
        result: 'contradicts',
        text: 'A wet line appeared on the paper at 00:08.',
      },
    });
  });
});
