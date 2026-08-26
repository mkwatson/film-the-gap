import { describe, expect, it } from 'vitest';

import {
  answerRepairHistory,
  createInitialState,
  defaultEvidenceRequirements,
  getAllInPrice,
  type LiveMarketState,
  type TransitionResult,
} from './model';
import { createSiteTools, type MarketTransition, type SiteToolRuntime } from './site-tools';

interface MutableRuntime extends SiteToolRuntime {
  readonly getState: () => LiveMarketState;
}

function createRuntime(): MutableRuntime {
  let state = createInitialState();

  return {
    readState: () => state,
    getState: () => state,
    transition: (transition: MarketTransition): TransitionResult => {
      const result = transition(state);
      state = result.state;
      return result;
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
      privacyBoundary: {
        receivedFromBuyer: [],
        actionBinding: 'A hold accepts only the exact current page quote.',
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
        aggregateEvidenceDemand: {
          totalAgentCount: 8,
          status: 'queued',
        },
      },
    });
    expectNoPrivateBuyerFields(requestOutput);
    expectNoPrivateBuyerFields(createSiteTools(runtime));
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('request_host_evidence');

    runtime.transition((state) => answerRepairHistory(state, 'none'));
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

  it('rejects an exact quote after page price changes and tells the agent how to recover', async () => {
    const runtime = createRuntime();
    await getTool(runtime, 'set_evidence_requirements').execute(
      defaultEvidenceRequirements,
      executeOptions,
    );
    runtime.transition((state) => answerRepairHistory(state, 'none'));
    const reserveTool = getTool(runtime, 'reserve_current_lot');
    const inspectedQuote = getAllInPrice(runtime.getState().lot);

    runtime.transition((state) => ({
      ok: true,
      message: 'Fixture price advanced.',
      state: {
        ...state,
        lot: {
          ...state.lot,
          currentBid: state.lot.currentBid + 10,
        },
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
      actionFrontier: {
        next: { action: 'set_evidence_requirements' },
        blocked: [{ name: 'request_host_evidence' }, { name: 'reserve_current_lot' }],
      },
      currentlyAvailableTools: [
        'inspect_live_show',
        'set_evidence_requirements',
        'inspect_current_lot',
      ],
    });
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('reserve_current_lot');
  });

  it('tolerates the current Chrome callback shape without execution options', async () => {
    const runtime = createRuntime();
    const inspectTool = getTool(runtime, 'inspect_live_show');

    const output = await inspectTool.execute(
      {},
      undefined as unknown as WebMCP.ToolExecuteCallbackOptions,
    );

    expect(output).toMatchObject({ showStatus: 'live' });
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
