import { describe, expect, it } from 'vitest';

import {
  applyEvidenceNetworkCommand,
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

  it('creates one bounded continuous-video mission and removes the duplicate action', () => {
    const state = createOpenMission();

    expect(state.activeCase?.mission).toMatchObject({
      status: 'open',
      minimumSeconds: 10,
      continuousTakeRequired: true,
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
          confidence: 'high',
          rights: 'owned',
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
          confidence: 'low',
          rights: 'authorized',
          provenance: 'authorized_import',
          capturedAt: evidenceTime,
        },
      },
      evidenceTime,
    );

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
          confidence: 'high',
          rights: 'owned',
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
          confidence: 'high',
          rights: 'owned',
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
          confidence: 'high',
          rights: 'owned',
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
          confidence: 'high',
          rights: 'owned',
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
