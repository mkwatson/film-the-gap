import { describe, expect, it } from 'vitest';

import {
  createInitialState,
  defaultEvidenceRequirements,
  getAllInPrice,
  recordPreparedMerchantCart,
  type LiveMarketState,
} from './model';
import { applyRoomCommand, type RoomCommand } from './room-command';
import { createSiteTools, type SiteToolRuntime } from './site-tools';

interface MutableRuntime extends SiteToolRuntime {
  readonly getState: () => LiveMarketState;
  readonly setStateForTest: (next: (state: LiveMarketState) => LiveMarketState) => void;
}

function createRuntime(initialState: LiveMarketState = createInitialState()): MutableRuntime {
  let state = initialState;

  return {
    readState: () => state,
    getState: () => state,
    dispatch: async (command: RoomCommand) => {
      const result = applyRoomCommand(state, command);
      state = result.state;
      return result;
    },
    setStateForTest: (next) => {
      state = next(state);
    },
  };
}

function getTool(runtime: SiteToolRuntime, name: string): WebMCP.ModelContextTool {
  const tool = createSiteTools(runtime).find((candidate) => candidate.name === name);
  if (tool === undefined) {
    throw new Error(`Expected ${name} to be available.`);
  }
  return tool;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function schemaPropertyNames(tool: WebMCP.ModelContextTool): readonly string[] {
  if (!isRecord(tool.inputSchema) || !isRecord(tool.inputSchema.properties)) {
    return [];
  }
  return Object.keys(tool.inputSchema.properties);
}

function collectObjectKeys(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectObjectKeys(item));
  }
  if (!isRecord(value)) {
    return [];
  }
  return [
    ...Object.keys(value),
    ...Object.values(value).flatMap((item) => collectObjectKeys(item)),
  ];
}

function expectNoPrivateBuyerFields(value: unknown): void {
  const keys = collectObjectKeys(value);
  expect(keys).not.toContain('maxAllInPrice');
  expect(keys).not.toContain('buyerProfile');
  expect(JSON.stringify(value)).not.toContain('450');
}

const executeOptions: WebMCP.ToolExecuteCallbackOptions = {
  signal: new AbortController().signal,
};

describe('WebMCP Site Tools', () => {
  it('rejects private-value fields instead of accepting them into page state', async () => {
    const runtime = createRuntime();
    const requirementsTool = getTool(runtime, 'set_evidence_requirements');

    const output = await requirementsTool.execute(
      { ...defaultEvidenceRequirements, maxAllInPrice: 450 },
      executeOptions,
    );

    expect(isRecord(output)).toBe(true);
    expect(output).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(runtime.getState().evidenceRequirements).toBeNull();
  });

  it('exposes only product evidence fields at the buyer-to-seller boundary', async () => {
    const runtime = createRuntime();
    const requirementsTool = getTool(runtime, 'set_evidence_requirements');

    expect(schemaPropertyNames(requirementsTool)).toEqual([
      'minLengthCm',
      'maxLengthCm',
      'requireVisibleEdgeEvidence',
      'forbidPriorBaseRepair',
    ]);
    expectNoPrivateBuyerFields(createSiteTools(runtime));

    const inspectOutput = await getTool(runtime, 'inspect_live_show').execute({}, executeOptions);
    expectNoPrivateBuyerFields(inspectOutput);
    expect(inspectOutput).toMatchObject({
      privacyReceipt: {
        sharedFields: [],
        holdBinding: 'exact current page quote only',
      },
    });
  });

  it('supports the complete private-agent-to-host-to-agent golden path', async () => {
    const runtime = createRuntime();

    const requirementsOutput = await getTool(runtime, 'set_evidence_requirements').execute(
      defaultEvidenceRequirements,
      executeOptions,
    );
    expect(requirementsOutput).toMatchObject({ ok: true });
    expectNoPrivateBuyerFields(requirementsOutput);
    expectNoPrivateBuyerFields(createSiteTools(runtime));
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('request_host_evidence');

    const requestOutput = await getTool(runtime, 'request_host_evidence').execute(
      { kind: 'repair_history' },
      executeOptions,
    );
    expect(requestOutput).toMatchObject({
      ok: true,
      state: {
        hostRequest: {
          totalAgentCount: 8,
          status: 'queued',
        },
      },
    });
    expectNoPrivateBuyerFields(requestOutput);
    expectNoPrivateBuyerFields(createSiteTools(runtime));
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('request_host_evidence');

    await runtime.dispatch({ kind: 'answer-repair-history', repairHistory: 'none' });
    expectNoPrivateBuyerFields(createSiteTools(runtime));
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('reserve_current_lot');

    const exactQuote = getAllInPrice(runtime.getState().lot);
    const reserveOutput = await getTool(runtime, 'reserve_current_lot').execute(
      { expectedAllInPrice: exactQuote },
      executeOptions,
    );
    expect(reserveOutput).toMatchObject({ ok: true });
    expectNoPrivateBuyerFields(reserveOutput);
    expectNoPrivateBuyerFields(createSiteTools(runtime));
    expect(runtime.getState().reservation).toMatchObject({
      heldBy: 'agent',
      acceptedAllInPrice: exactQuote,
    });
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('release_current_lot');
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain(
      'set_evidence_requirements',
    );
  });

  it('exposes camera provenance and host review without embedding the JPEG in tool output', async () => {
    const runtime = createRuntime();
    await getTool(runtime, 'set_evidence_requirements').execute(
      defaultEvidenceRequirements,
      executeOptions,
    );
    await getTool(runtime, 'request_host_evidence').execute(
      { kind: 'repair_history' },
      executeOptions,
    );
    const frame = {
      kind: 'camera-keyframe',
      frameId: 'camera-9dff50df08c6',
      label: 'Host camera keyframe · camera-9dff50df08c6',
      capturedAt: '2026-08-26T19:22:31.000Z',
      showOffsetSeconds: null,
      sha256: '9dff50df08c635815f4b19da10f756605a34a79a48d4ba48712782502975a70e',
      widthPx: 960,
      heightPx: 540,
    } as const;
    const finding = {
      baseVisibility: 'clear',
      surfaceFinding: 'no-obvious-repair',
      confidence: 'medium',
      visibleDetails: ['The full base is visible.'],
      summary: 'The full base is visible with no obvious repair marker.',
      suggestedNextView: null,
    } as const;
    await runtime.dispatch({
      kind: 'answer-repair-history',
      repairHistory: 'none',
      evidenceFrame: frame,
      visualReview: {
        source: 'ai-gateway',
        modelId: 'openai/gpt-5.6-sol',
        frameId: frame.frameId,
        frameSha256: frame.sha256,
        proposal: finding,
        reviewedFinding: finding,
        hostDecision: 'accepted',
      },
      publicEvidenceImage: 'data:image/jpeg;base64,ZnJhbWU=',
    });

    const output = await getTool(runtime, 'inspect_live_show').execute({}, executeOptions);

    expect(output).toMatchObject({
      publishedEvidence: {
        repairHistory: 'none',
        selectedFrame: {
          kind: 'camera-keyframe',
          frameId: 'camera-9dff50df08c6',
          widthPx: 960,
          heightPx: 540,
        },
        selectedFramePubliclyVisible: true,
        reviewedObservation: {
          source: 'ai-gateway',
          modelId: 'openai/gpt-5.6-sol',
          hostDecision: 'accepted',
        },
      },
    });
    expect(JSON.stringify(output)).not.toContain('data:image');
    expectNoPrivateBuyerFields(output);
  });

  it('rejects an exact quote after page price changes and tells the agent how to recover', async () => {
    const runtime = createRuntime();
    await getTool(runtime, 'set_evidence_requirements').execute(
      defaultEvidenceRequirements,
      executeOptions,
    );
    await runtime.dispatch({ kind: 'answer-repair-history', repairHistory: 'none' });
    const reserveTool = getTool(runtime, 'reserve_current_lot');
    const inspectedQuote = getAllInPrice(runtime.getState().lot);

    runtime.setStateForTest((state) => ({
      ...state,
      lot: {
        ...state.lot,
        currentBid: state.lot.currentBid + 10,
      },
    }));
    const output = await reserveTool.execute(
      { expectedAllInPrice: inspectedQuote },
      executeOptions,
    );

    expect(output).toMatchObject({ ok: false });
    expect(JSON.stringify(output)).toContain('Inspect the lot and decide again privately');
    expect(runtime.getState().reservation).toBeNull();
  });

  it('reports a counterfactual next step while unavailable tools remain unregistered', async () => {
    const runtime = createRuntime();
    const initial = await getTool(runtime, 'inspect_live_show').execute({}, executeOptions);
    expect(initial).toMatchObject({
      next: {
        action: 'set_evidence_requirements',
        availableTools: ['inspect_live_show', 'set_evidence_requirements'],
      },
    });
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('reserve_current_lot');
  });

  it('keeps common tool results within a compact agent context budget', async () => {
    const runtime = createRuntime();
    const outputs: unknown[] = [];

    outputs.push(await getTool(runtime, 'inspect_live_show').execute({}, executeOptions));
    outputs.push(
      await getTool(runtime, 'set_evidence_requirements').execute(
        defaultEvidenceRequirements,
        executeOptions,
      ),
    );
    outputs.push(
      await getTool(runtime, 'request_host_evidence').execute(
        { kind: 'repair_history' },
        executeOptions,
      ),
    );
    await runtime.dispatch({ kind: 'answer-repair-history', repairHistory: 'none' });
    outputs.push(await getTool(runtime, 'inspect_live_show').execute({}, executeOptions));

    for (const output of outputs) {
      expect(JSON.stringify(output).length).toBeLessThanOrEqual(3_500);
    }
  });

  it('returns a compact merchant receipt while withholding the UCP cart credential', async () => {
    const runtime = createRuntime(
      createInitialState({ ucpMerchantOrigin: 'https://merchant.example' }),
    );
    await getTool(runtime, 'set_evidence_requirements').execute(
      defaultEvidenceRequirements,
      executeOptions,
    );
    await runtime.dispatch({ kind: 'answer-repair-history', repairHistory: 'none' });
    await getTool(runtime, 'reserve_current_lot').execute(
      { expectedAllInPrice: getAllInPrice(runtime.getState().lot) },
      executeOptions,
    );
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('prepare_merchant_cart');

    runtime.setStateForTest(
      (state) =>
        recordPreparedMerchantCart(state, 'agent', {
          protocolVersion: '2026-04-08',
          currency: 'USD',
          lineItems: [
            {
              title: 'Rights-cleared 156 cm demo board',
              unitPrice: 37500,
              quantity: 1,
              subtotal: 37500,
            },
          ],
          totals: [
            { type: 'subtotal', displayText: 'Subtotal', amount: 37500 },
            { type: 'total', displayText: 'Total', amount: 37500 },
          ],
          messages: [
            {
              type: 'warning',
              content: 'Shipping is finalized during human checkout.',
              severity: null,
            },
          ],
          continuationAvailable: true,
          createdAt: 1_787_787_200_000,
        }).state,
    );

    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('cancel_merchant_cart');
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('prepare_merchant_cart');
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('release_current_lot');
    const output = await getTool(runtime, 'inspect_live_show').execute({}, executeOptions);
    expect(output).toMatchObject({
      commerce: {
        protocol: 'UCP',
        protocolVersion: '2026-04-08',
        merchantOrigin: 'https://merchant.example',
        cartStatus: 'active',
        receipt: {
          totals: [
            { type: 'subtotal', displayText: 'Subtotal', amount: 37500 },
            { type: 'total', displayText: 'Total', amount: 37500 },
          ],
          continuationAvailable: true,
        },
        privateCredential: 'server-held; never returned in shared room state',
      },
    });
    expect(JSON.stringify(output)).not.toMatch(/Cart\/|continue_url|private-test-cart/);
    expect(JSON.stringify(output).length).toBeLessThanOrEqual(3_500);
  });

  it('tolerates judged runtime callback shapes without a usable signal', async () => {
    const runtime = createRuntime();
    const inspectTool = getTool(runtime, 'inspect_live_show');

    const outputWithoutOptions = await inspectTool.execute(
      {},
      undefined as unknown as WebMCP.ToolExecuteCallbackOptions,
    );
    const outputWithoutSignal = await inspectTool.execute(
      {},
      {} as unknown as WebMCP.ToolExecuteCallbackOptions,
    );

    expect(outputWithoutOptions).toMatchObject({ show: { status: 'live' } });
    expect(outputWithoutSignal).toMatchObject({ show: { status: 'live' } });
  });

  it('propagates cancellation before performing a mutation', async () => {
    const runtime = createRuntime();
    const requirementsTool = getTool(runtime, 'set_evidence_requirements');
    const controller = new AbortController();
    controller.abort('cancelled by agent');

    await expect(
      requirementsTool.execute(defaultEvidenceRequirements, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(runtime.getState().evidenceRequirements).toBeNull();
  });
});
