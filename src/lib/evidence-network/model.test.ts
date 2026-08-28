import { describe, expect, it } from 'vitest';

import {
  applyEvidenceNetworkCommand,
  attachDemoProductPageUrl,
  createDemoEvidenceQuestionState,
  createDemoEvidenceNetworkState,
  createEmptyEvidenceNetworkState,
  currentEvidenceAnswer,
  getEvidenceNetworkToolNames,
  initialEvidenceAnswer,
} from './model';

const questionTime = '2026-08-27T15:00:00.000Z';
const missionTime = '2026-08-27T15:01:00.000Z';
const evidenceTime = '2026-08-27T15:02:00.000Z';

function createOpenMission() {
  const initial = createDemoEvidenceNetworkState();
  return applyEvidenceNetworkCommand(
    initial,
    {
      kind: 'create-filming-mission',
      actor: 'agent',
      input: {
        instruction: 'Fill the bottle, close the lid, and hold it upside down for ten seconds.',
        successCriterion: 'Keep the lid and a dry sheet of paper visible for the full test.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
    },
    missionTime,
  ).state;
}

describe('product evidence network model', () => {
  it('opens an arbitrary product question without collecting private shopper context', () => {
    const result = applyEvidenceNetworkCommand(
      createEmptyEvidenceNetworkState(),
      {
        kind: 'ask-product-question',
        actor: 'agent',
        input: {
          productName: 'USB-C lavalier microphone',
          productUrl: 'https://example.com/microphone',
          question: 'Can the phone charge while the receiver is connected and recording?',
        },
      },
      questionTime,
    );

    expect(result.ok).toBe(true);
    expect(result.state.activeCase?.product).toEqual({
      id: 'product-1',
      name: 'USB-C lavalier microphone',
      suppliedUrl: 'https://example.com/microphone',
    });
    expect(result.state.activeCase?.sources).toHaveLength(1);
    expect(result.state.activeCase).not.toHaveProperty('budget');
    expect(JSON.stringify(result.state)).not.toContain('maximumPrice');
  });

  it('keeps a product-page claim insufficient until reviewed evidence exists', () => {
    const state = createDemoEvidenceNetworkState();

    expect(state.activeCase?.observations[0]?.result).toBe('inconclusive');
    expect(currentEvidenceAnswer(state)?.status).toBe('insufficient');
    expect(getEvidenceNetworkToolNames(state)).toContain('create_filming_mission');
  });

  it('makes the judge-facing bottle case search before it can request new footage', () => {
    const state = createDemoEvidenceQuestionState();

    expect(state.activeCase?.discovery).toBeNull();
    expect(getEvidenceNetworkToolNames(state)).toContain('search_product_evidence');
    expect(getEvidenceNetworkToolNames(state)).not.toContain('create_filming_mission');
  });

  it('binds the rights-clean demo listing only on a public HTTPS origin', () => {
    const state = createDemoEvidenceQuestionState();
    const attached = attachDemoProductPageUrl(state, 'https://film-the-gap.example/demo-product');

    expect(attached.activeCase?.product.suppliedUrl).toBe(
      'https://film-the-gap.example/demo-product',
    );
    expect(attached.activeCase?.sources[0]?.url).toBe('https://film-the-gap.example/demo-product');
    expect(attachDemoProductPageUrl(state, 'http://localhost:3000/demo-product')).toBe(state);
  });

  it('requires an existing-evidence search before requesting new footage', () => {
    const asked = applyEvidenceNetworkCommand(
      createEmptyEvidenceNetworkState(),
      {
        kind: 'ask-product-question',
        actor: 'human',
        input: {
          productName: 'Desk lamp',
          question: 'Does it remember its brightness after losing power?',
        },
      },
      questionTime,
    ).state;

    expect(getEvidenceNetworkToolNames(asked)).toContain('search_product_evidence');
    expect(getEvidenceNetworkToolNames(asked)).not.toContain('create_filming_mission');
    const mission = applyEvidenceNetworkCommand(
      asked,
      {
        kind: 'create-filming-mission',
        actor: 'agent',
        input: {
          instruction: 'Record the lamp through a complete power cycle.',
          successCriterion: 'Keep the brightness setting and light output visible.',
          minimumSeconds: 10,
          continuousTakeRequired: true,
        },
      },
      missionTime,
    );
    expect(mission.ok).toBe(false);
    expect(mission.message).toContain('Search existing public evidence');
  });

  it('indexes public social results as non-decisive discovery leads', () => {
    const asked = applyEvidenceNetworkCommand(
      createEmptyEvidenceNetworkState(),
      {
        kind: 'ask-product-question',
        actor: 'human',
        input: {
          productName: 'Desk lamp',
          question: 'Does it remember its brightness after losing power?',
        },
      },
      questionTime,
    ).state;
    const result = applyEvidenceNetworkCommand(
      asked,
      {
        kind: 'record-evidence-discovery',
        actor: 'agent',
        input: {
          provider: 'scrapecreators',
          status: 'complete',
          query: 'Desk lamp brightness memory power loss',
          searchedPlatforms: ['youtube'],
          warnings: [],
          leads: [
            {
              platform: 'youtube',
              title: 'Desk lamp power-cycle test',
              url: 'https://www.youtube.com/watch?v=abc123',
              summary: 'Candidate metadata mentions a power-cycle test; video not yet reviewed.',
              creatorLabel: 'YouTube · Test Lab',
            },
          ],
        },
      },
      missionTime,
    );

    expect(result.ok).toBe(true);
    expect(result.state.activeCase?.sources.at(-1)).toMatchObject({
      rights: 'link_only',
      provenance: 'external_link',
    });
    expect(result.state.activeCase?.observations.at(-1)).toMatchObject({
      result: 'inconclusive',
      confidence: 'low',
    });
    expect(currentEvidenceAnswer(result.state)?.status).toBe('insufficient');
    expect(getEvidenceNetworkToolNames(result.state)).not.toContain('search_product_evidence');
    expect(getEvidenceNetworkToolNames(result.state)).toContain('create_filming_mission');
  });

  it('attaches a known-page reader excerpt to the supplied source without duplicating it', () => {
    const asked = applyEvidenceNetworkCommand(
      createEmptyEvidenceNetworkState(),
      {
        kind: 'ask-product-question',
        actor: 'human',
        input: {
          productName: 'Trail Flask',
          productUrl: 'https://shop.example/products/flask?utm_source=judge#details',
          question: 'Does it stay leak-free while upside down for ten seconds?',
        },
      },
      questionTime,
    ).state;
    const result = applyEvidenceNetworkCommand(
      asked,
      {
        kind: 'record-evidence-discovery',
        actor: 'agent',
        input: {
          provider: 'evidence_network',
          status: 'partial',
          query: 'Trail Flask leak-free upside down ten seconds',
          searchedPlatforms: ['web'],
          warnings: [],
          leads: [
            {
              platform: 'web',
              title: 'Trail Flask · supplied product page',
              url: 'https://shop.example/products/flask',
              summary:
                'Untrusted product-page excerpt read by Cloudflare Browser Run: “Leak-resistant lid.” Page copy remains a lead, never proof.',
              creatorLabel: 'Product page · Cloudflare Browser Run',
            },
          ],
        },
      },
      missionTime,
    );

    expect(result.ok).toBe(true);
    expect(result.state.activeCase?.sources).toHaveLength(1);
    expect(result.state.activeCase?.observations).toEqual([
      expect.objectContaining({
        result: 'inconclusive',
        confidence: 'low',
        reviewedBy: 'Product page · Cloudflare Browser Run',
        citation: expect.objectContaining({ sourceId: 'source-1' }),
      }),
    ]);
    expect(result.state.activeCase?.discovery?.sourceIds).toEqual(['source-1']);
    expect(currentEvidenceAnswer(result.state)?.status).toBe('insufficient');
  });

  it('adds a live page-reader receipt alongside the authored demo claim', () => {
    const initial = attachDemoProductPageUrl(
      createDemoEvidenceQuestionState(),
      'https://film-the-gap.example/demo-product',
    );
    const result = applyEvidenceNetworkCommand(
      initial,
      {
        kind: 'record-evidence-discovery',
        actor: 'agent',
        input: {
          provider: 'evidence_network',
          status: 'partial',
          query: 'travel bottle continuous upside-down leak test',
          searchedPlatforms: ['web'],
          warnings: [],
          leads: [
            {
              platform: 'web',
              title: 'Everyday insulated travel bottle · supplied product page',
              url: 'https://film-the-gap.example/demo-product',
              summary:
                'Untrusted product-page excerpt read by Cloudflare Browser Run. Page copy remains a lead, never proof.',
              creatorLabel: 'Product page · Cloudflare Browser Run',
            },
          ],
        },
      },
      missionTime,
    );

    expect(result.state.activeCase?.sources).toHaveLength(1);
    expect(result.state.activeCase?.observations).toHaveLength(2);
    expect(result.state.activeCase?.observations.at(-1)).toMatchObject({
      reviewedBy: 'Product page · Cloudflare Browser Run',
      confidence: 'low',
      result: 'inconclusive',
    });
    expect(currentEvidenceAnswer(result.state)?.status).toBe('insufficient');
  });

  it('reuses a rights-cleared network recording instead of creating another mission', () => {
    const asked = applyEvidenceNetworkCommand(
      createEmptyEvidenceNetworkState(),
      {
        kind: 'ask-product-question',
        actor: 'agent',
        input: {
          productName: 'Desk lamp',
          question: 'Does it remember its brightness after losing power?',
        },
      },
      questionTime,
    ).state;
    const result = applyEvidenceNetworkCommand(
      asked,
      {
        kind: 'record-evidence-discovery',
        actor: 'agent',
        input: {
          provider: 'evidence_network',
          status: 'complete',
          query: 'Desk lamp brightness memory power loss',
          searchedPlatforms: [],
          warnings: [],
          leads: [],
          reviewedEvidence: [
            {
              id: 'prior-case:networkvideo00000001',
              productName: 'Desk lamp',
              productUrl: null,
              question: 'Does it remember its brightness after losing power?',
              source: {
                title: 'Contributor-recorded mission video',
                videoUrl: 'https://customer-demo.cloudflarestream.com/networkvideo00000001/watch',
                rights: 'owned',
                provenance: 'live_capture',
                continuity: 'continuous',
                captureTiming: 'mission_challenge_verified',
                contributorLabel: 'Lamp owner',
                capturedAt: evidenceTime,
                streamUid: 'networkvideo00000001',
                sha256: 'a'.repeat(64),
                durationSeconds: 12,
              },
              observation: {
                result: 'supports',
                confidence: 'high',
                text: 'The lamp returned to the same brightness after the complete power cycle.',
                citationStartSeconds: 2,
                citationEndSeconds: 11,
                reviewedAt: evidenceTime,
              },
              indexedAt: evidenceTime,
              expiresAt: '2026-09-27T15:02:00.000Z',
            },
          ],
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(true);
    expect(result.message).toContain('Reused 1 reviewed network recording');
    expect(currentEvidenceAnswer(result.state)?.status).toBe('supported');
    expect(result.state.activeCase?.sources.at(-1)).toMatchObject({
      reuseScope: 'public_network',
      streamUid: 'networkvideo00000001',
    });
    expect(getEvidenceNetworkToolNames(result.state)).toContain('inspect_answer_change');
    expect(getEvidenceNetworkToolNames(result.state)).not.toContain('create_filming_mission');
  });

  it('creates one bounded continuous-video mission and removes the duplicate action', () => {
    const state = createOpenMission();

    expect(state.activeCase?.mission).toMatchObject({
      status: 'open',
      minimumSeconds: 10,
      continuousTakeRequired: true,
      captureChallenge: {
        kind: 'spoken_or_shown_phrase',
        phrase: expect.stringMatching(/^[A-Z]+ [A-Z]+ [1-9][0-9]$/),
      },
    });
    expect(getEvidenceNetworkToolNames(state)).not.toContain('create_filming_mission');
  });

  it('changes the answer after a reviewed, rights-cleared mission replay', () => {
    const before = createOpenMission();
    const result = applyEvidenceNetworkCommand(
      before,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'No water reached the paper during the continuous ten-second inversion.',
          contributorLabel: 'Judge replay contributor',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'preexisting',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'demo_replay',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(true);
    expect(initialEvidenceAnswer(result.state)?.status).toBe('insufficient');
    expect(currentEvidenceAnswer(result.state)?.status).toBe('supported');
    expect(result.state.activeCase?.mission?.status).toBe('fulfilled');
    expect(result.state.activeCase?.sources.at(-1)).toMatchObject({
      provenance: 'demo_replay',
      continuity: 'continuous',
      rights: 'owned',
    });
    expect(getEvidenceNetworkToolNames(result.state)).toContain('inspect_answer_change');
  });

  it('does not let low-confidence evidence become decision-grade', () => {
    const state = createOpenMission();
    const result = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'The lid was partly out of frame, so leakage could not be ruled out.',
          contributorLabel: 'Cautious contributor',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'low',
          continuity: 'continuous',
          captureTiming: 'preexisting',
          rights: 'authorized',
          reuseScope: 'case_only',
          provenance: 'authorized_import',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

    expect(currentEvidenceAnswer(result.state)?.status).toBe('insufficient');
  });

  it('does not let an edited clip satisfy a mission that requires one continuous take', () => {
    const state = createOpenMission();
    const result = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'Separate shots showed the bottle inverted and the paper still dry.',
          contributorLabel: 'Product owner',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'edited',
          captureTiming: 'preexisting',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'authorized_import',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(true);
    expect(currentEvidenceAnswer(result.state)?.status).toBe('insufficient');
  });

  it('rejects a clip shorter than the bounded mission', () => {
    const state = createOpenMission();
    const result = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'The short clip did not cover the complete requested interval.',
          contributorLabel: 'Product owner',
          durationSeconds: 5,
          citationStartSeconds: 0,
          citationEndSeconds: 5,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'preexisting',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'demo_replay',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.message).toContain('at least 10 continuous seconds');
  });

  it('binds a live capture to its reserved video and digest metadata', () => {
    const state = createOpenMission();
    const result = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'contradicts',
          observation: 'Water reached the paper during the continuous inversion.',
          contributorLabel: 'Product owner',
          durationSeconds: 10,
          citationStartSeconds: 1,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'mission_challenge_verified',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'live_capture',
          capturedAt: evidenceTime,
          streamUid: '0123456789abcdef0123456789abcdef',
          sha256: 'a'.repeat(64),
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(true);
    expect(currentEvidenceAnswer(result.state)?.status).toBe('contradicted');
    expect(result.state.activeCase?.sources.at(-1)).toMatchObject({
      provenance: 'live_capture',
      captureTiming: 'mission_challenge_verified',
      streamUid: '0123456789abcdef0123456789abcdef',
      sha256: 'a'.repeat(64),
    });
  });

  it('does not label an unreserved video as a live capture', () => {
    const state = createOpenMission();
    const result = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'No water reached the paper during the inversion.',
          contributorLabel: 'Product owner',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'contributor_attested',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'live_capture',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.message).toContain('reserved video upload');
  });

  it('refuses evidence publication when no mission is open', () => {
    const state = createDemoEvidenceNetworkState();
    const result = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'contradicts',
          observation: 'Water appeared below the lid during inversion.',
          contributorLabel: 'Product owner',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'contributor_attested',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'live_capture',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(result.message).toContain('no open filming mission');
  });
});
