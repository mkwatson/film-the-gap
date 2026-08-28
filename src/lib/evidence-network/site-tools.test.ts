import { describe, expect, it } from 'vitest';

import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
  type EvidenceNetworkCommand,
  type EvidenceNetworkState,
} from './model';
import {
  answerChangeSnapshot,
  createEvidenceSiteTools,
  evidenceCaseSnapshot,
  type EvidenceSiteToolRuntime,
} from './site-tools';

function runtime(initialState = createDemoEvidenceNetworkState()): {
  readonly runtime: EvidenceSiteToolRuntime;
  readonly readState: () => EvidenceNetworkState;
} {
  let state = initialState;
  const readState = (): EvidenceNetworkState => state;
  return {
    readState,
    runtime: {
      readState,
      dispatch: async (command: EvidenceNetworkCommand) => {
        const result = applyEvidenceNetworkCommand(state, command, '2026-08-27T16:00:00.000Z');
        state = result.state;
        return result;
      },
    },
  };
}

function tool(runtimeValue: EvidenceSiteToolRuntime, name: string): WebMCP.ModelContextTool {
  const found = createEvidenceSiteTools(runtimeValue).find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`Missing tool ${name}.`);
  }
  return found;
}

describe('product evidence Site Tools', () => {
  it('exposes one read, one generic question action, and one state-valid mission action', () => {
    const { runtime: runtimeValue } = runtime();

    expect(createEvidenceSiteTools(runtimeValue).map(({ name }) => name)).toEqual([
      'inspect_product_evidence',
      'ask_product_question',
      'create_filming_mission',
    ]);
  });

  it('accepts no private shopper fields in any registered schema', () => {
    const { runtime: runtimeValue } = runtime();
    const tools = createEvidenceSiteTools(runtimeValue);
    const schemas = JSON.stringify(tools.map(({ inputSchema }) => inputSchema));
    const definitions = JSON.stringify(tools.map(({ description }) => description));

    expect(schemas).not.toMatch(/budget|maximumPrice|purchaseHistory|buyerIdentity/i);
    expect(definitions).toContain('private preferences');
  });

  it('opens an arbitrary product case through the native contract', async () => {
    const { runtime: runtimeValue, readState } = runtime();
    const result = await tool(runtimeValue, 'ask_product_question').execute(
      {
        productName: 'Desk lamp',
        question: 'Does the lamp retain its last brightness after losing power?',
      },
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({
      ok: true,
      privateShopperContext: 'not collected',
    });
    expect(evidenceCaseSnapshot(readState())).toMatchObject({
      privacyReceipt: { accepted: 'product name and observable question only' },
    });
    expect(readState().activeCase?.product.name).toBe('Desk lamp');
  });

  it('reports a public URL only when the active case actually received one', async () => {
    const { runtime: runtimeValue, readState } = runtime();

    const result = await tool(runtimeValue, 'ask_product_question').execute(
      {
        productName: 'Desk lamp',
        productUrl: 'https://catalog.example/desk-lamp',
        question: 'Does the lamp retain its last brightness after losing power?',
      },
      { signal: new AbortController().signal },
    );

    expect(result).toMatchObject({ ok: true });
    expect(evidenceCaseSnapshot(readState())).toMatchObject({
      privacyReceipt: {
        accepted: 'product name, public URL, observable question only',
      },
    });
  });

  it('searches the active question and exposes only link-only leads before a mission', async () => {
    const { runtime: runtimeValue, readState } = runtime();
    await tool(runtimeValue, 'ask_product_question').execute(
      {
        productName: 'Desk lamp',
        question: 'Does the lamp retain its last brightness after losing power?',
      },
      { signal: new AbortController().signal },
    );
    const runtimeWithSearch = {
      ...runtimeValue,
      evidenceSearch: {
        run: async () =>
          runtimeValue.dispatch({
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
                  summary: 'Candidate only; the video has not been reviewed.',
                  creatorLabel: 'YouTube · Test Lab',
                },
              ],
            },
          }),
      },
    } satisfies EvidenceSiteToolRuntime;

    expect(createEvidenceSiteTools(runtimeWithSearch).map(({ name }) => name)).toContain(
      'search_product_evidence',
    );
    const searchTool = tool(runtimeWithSearch, 'search_product_evidence');
    expect(searchTool.annotations).toMatchObject({
      readOnlyHint: false,
      untrustedContentHint: true,
    });
    const result = await searchTool.execute({}, { signal: new AbortController().signal });

    expect(result).toMatchObject({ ok: true, answerStatus: 'insufficient' });
    expect(readState().activeCase?.sources.at(-1)?.rights).toBe('link_only');
    expect(createEvidenceSiteTools(runtimeWithSearch).map(({ name }) => name)).toContain(
      'create_filming_mission',
    );
  });

  it('creates a mission and dynamically removes the now-invalid duplicate action', async () => {
    const { runtime: runtimeValue } = runtime();
    await tool(runtimeValue, 'create_filming_mission').execute(
      {
        instruction: 'Invert the filled bottle over dry paper for ten seconds.',
        successCriterion: 'Keep the closed lid and dry paper visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
      { signal: new AbortController().signal },
    );

    expect(createEvidenceSiteTools(runtimeValue).map(({ name }) => name)).toEqual([
      'inspect_product_evidence',
      'ask_product_question',
    ]);
  });

  it('adds one bounded phone handoff only while an open mission lacks a shared case', async () => {
    const { runtime: runtimeValue } = runtime();
    await tool(runtimeValue, 'create_filming_mission').execute(
      {
        instruction: 'Invert the filled bottle over dry paper for ten seconds.',
        successCriterion: 'Keep the closed lid and dry paper visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
      { signal: new AbortController().signal },
    );
    let receipt: {
      readonly caseId: string;
      readonly contributorUrl: string;
      readonly expiresAt: number;
    } | null = null;
    const runtimeWithPhone = {
      ...runtimeValue,
      phoneCapture: {
        available: true,
        current: () => receipt,
        create: async () => {
          receipt = {
            caseId: 'BCDF2345',
            contributorUrl: 'https://app.example/contribute/BCDF2345#token=bounded',
            expiresAt: 1_800_000_000_000,
          };
          return receipt;
        },
      },
    } satisfies EvidenceSiteToolRuntime;

    expect(createEvidenceSiteTools(runtimeWithPhone).map(({ name }) => name)).toEqual([
      'inspect_product_evidence',
      'ask_product_question',
      'create_phone_capture_link',
    ]);
    const result = await tool(runtimeWithPhone, 'create_phone_capture_link').execute(
      {},
      { signal: new AbortController().signal },
    );
    expect(result).toMatchObject({ ok: true, caseId: 'BCDF2345' });
    expect(createEvidenceSiteTools(runtimeWithPhone).map(({ name }) => name)).toEqual([
      'inspect_product_evidence',
      'ask_product_question',
    ]);
  });

  it('requires explicit confirmation to publish and revoke a privacy-bounded public mission', async () => {
    const { runtime: runtimeValue } = runtime();
    await tool(runtimeValue, 'create_filming_mission').execute(
      {
        instruction: 'Invert the filled bottle over dry paper for ten seconds.',
        successCriterion: 'Keep the closed lid and dry paper visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
      { signal: new AbortController().signal },
    );
    const receipt = {
      caseId: 'BCDF2345',
      contributorUrl: 'https://app.example/contribute/BCDF2345#token=private-bounded-token',
      expiresAt: 1_800_000_000_000,
    };
    const mission = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      caseId: receipt.caseId,
      productName: 'Everyday insulated travel bottle',
      productUrl: null,
      question: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
      instruction: 'Invert the filled bottle over dry paper for ten seconds.',
      successCriterion: 'Keep the closed lid and dry paper visible throughout.',
      minimumSeconds: 10,
      continuousTakeRequired: true,
      status: 'open',
      createdAt: '2026-08-27T16:00:00.000Z',
      expiresAt: '2026-08-28T16:00:00.000Z',
      fulfilledAt: null,
    } as const;
    let currentMission: typeof mission | null = null;
    let publications = 0;
    let removals = 0;
    const runtimeWithBoard = {
      ...runtimeValue,
      phoneCapture: {
        available: true,
        current: () => receipt,
        create: async () => receipt,
      },
      missionBoard: {
        available: true,
        current: () => currentMission,
        publish: async () => {
          publications += 1;
          currentMission = mission;
          return mission;
        },
        remove: async () => {
          removals += 1;
          currentMission = null;
          return { ...mission, status: 'removed' as const };
        },
      },
    } satisfies EvidenceSiteToolRuntime;

    const publishTool = tool(runtimeWithBoard, 'publish_filming_mission');
    expect(publishTool.annotations).toMatchObject({ readOnlyHint: false });
    await expect(
      publishTool.execute({}, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid_input' });
    await expect(
      publishTool.execute({ confirmPublicListing: true }, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({
      ok: true,
      mission: { id: mission.id },
      privateShopperContext: 'not collected',
    });
    expect(publications).toBe(1);
    expect(createEvidenceSiteTools(runtimeWithBoard).map(({ name }) => name)).toContain(
      'remove_public_filming_mission',
    );

    await expect(
      tool(runtimeWithBoard, 'remove_public_filming_mission').execute(
        { confirmRemoval: true },
        { signal: new AbortController().signal },
      ),
    ).resolves.toMatchObject({ ok: true, mission: { status: 'removed' } });
    expect(removals).toBe(1);
  });

  it('keeps common inspect results within the current Chrome character budget', () => {
    let state = createDemoEvidenceNetworkState();
    const initialSnapshot = evidenceCaseSnapshot(state);
    const initialSerialized = JSON.stringify(initialSnapshot);

    expect(initialSerialized).toContain('rights');
    expect(initialSerialized).toContain('provenance');
    expect(initialSerialized).toContain('Product-page copy');
    expect(initialSerialized.length).toBeLessThanOrEqual(1_500);

    state = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'create-filming-mission',
        actor: 'agent',
        input: {
          instruction: 'Invert the filled bottle over dry paper for ten seconds.',
          successCriterion: 'Keep the closed lid and dry paper visible throughout.',
          minimumSeconds: 10,
          continuousTakeRequired: true,
        },
      },
      '2026-08-27T16:01:00.000Z',
    ).state;
    const receipt = {
      caseId: 'BCDF2345',
      contributorUrl: 'https://app.example/contribute/BCDF2345#token=private-bounded-token',
      expiresAt: 1_800_000_000_000,
    };
    const publicMission = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      caseId: receipt.caseId,
      productName: 'Everyday insulated travel bottle',
      productUrl: null,
      question: 'Does the filled bottle stay leak-free when held upside down for 10 seconds?',
      instruction: 'Invert the filled bottle over dry paper for ten seconds.',
      successCriterion: 'Keep the closed lid and dry paper visible throughout.',
      minimumSeconds: 10,
      continuousTakeRequired: true,
      status: 'open',
      createdAt: '2026-08-27T16:01:00.000Z',
      expiresAt: '2026-08-28T16:01:00.000Z',
      fulfilledAt: null,
    } as const;
    const missionSnapshot = evidenceCaseSnapshot(
      state,
      {
        available: true,
        current: () => receipt,
        create: async () => receipt,
      },
      {
        available: true,
        current: () => publicMission,
        publish: async () => publicMission,
        remove: async () => ({ ...publicMission, status: 'removed' as const }),
      },
    );
    const missionSerialized = JSON.stringify(missionSnapshot);

    expect(missionSerialized).toContain('freshCapturePhrase');
    expect(missionSerialized).not.toContain('private-bounded-token');
    expect(missionSerialized.length).toBeLessThanOrEqual(1_500);

    state = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'No water reached the paper during the continuous inversion.',
          contributorLabel: 'Replay contributor',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'preexisting',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'demo_replay',
          capturedAt: '2026-08-27T16:02:00.000Z',
        },
      },
      '2026-08-27T16:02:00.000Z',
    ).state;
    const resolvedSnapshot = evidenceCaseSnapshot(state);
    const resolvedSerialized = JSON.stringify(resolvedSnapshot);

    expect(resolvedSnapshot).toMatchObject({
      case: {
        evidence: {
          total: 2,
          moreVisibleOnPage: true,
          shown: [{ provenance: 'demo_replay', finding: { result: 'supports' } }],
        },
      },
    });
    expect(resolvedSerialized.length).toBeLessThanOrEqual(1_500);
  });

  it('shows exactly which reviewed evidence changed the answer', () => {
    let state = applyEvidenceNetworkCommand(
      createDemoEvidenceNetworkState(),
      {
        kind: 'create-filming-mission',
        actor: 'agent',
        input: {
          instruction: 'Invert the filled bottle over dry paper for ten seconds.',
          successCriterion: 'Keep the closed lid and dry paper visible throughout.',
          minimumSeconds: 10,
          continuousTakeRequired: true,
        },
      },
      '2026-08-27T16:01:00.000Z',
    ).state;
    state = applyEvidenceNetworkCommand(
      state,
      {
        kind: 'publish-reviewed-evidence',
        actor: 'contributor',
        input: {
          result: 'supports',
          observation: 'No water reached the paper during the continuous inversion.',
          contributorLabel: 'Replay contributor',
          durationSeconds: 10,
          citationStartSeconds: 0,
          citationEndSeconds: 10,
          confidence: 'high',
          continuity: 'continuous',
          captureTiming: 'preexisting',
          rights: 'owned',
          reuseScope: 'case_only',
          provenance: 'demo_replay',
          capturedAt: '2026-08-27T16:02:00.000Z',
        },
      },
      '2026-08-27T16:02:00.000Z',
    ).state;

    expect(answerChangeSnapshot(state)).toMatchObject({
      changed: true,
      before: { status: 'insufficient' },
      after: { status: 'supported' },
      decisiveEvidence: [{ timestamp: '00:00–00:10', captureTiming: 'preexisting' }],
    });
    expect(createEvidenceSiteTools(runtime(state).runtime).map(({ name }) => name)).toContain(
      'inspect_answer_change',
    );
  });
});
