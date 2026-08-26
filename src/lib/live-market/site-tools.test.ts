import { describe, expect, it } from 'vitest';

import {
  answerRepairHistory,
  createInitialState,
  defaultBuyerMandate,
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

const executeOptions: WebMCP.ToolExecuteCallbackOptions = {
  signal: new AbortController().signal,
};

describe('WebMCP Site Tools', () => {
  it('validates inputs at runtime instead of trusting the agent', async () => {
    const runtime = createRuntime();
    const mandateTool = getTool(runtime, 'set_buying_mandate');

    const output = await mandateTool.execute(
      { ...defaultBuyerMandate, maxAllInPrice: '450' },
      executeOptions,
    );

    expect(isRecord(output)).toBe(true);
    if (!isRecord(output)) {
      return;
    }
    expect(output).toMatchObject({ ok: false, error: 'invalid_input' });
    expect(runtime.getState().mandate).toBeNull();
  });

  it('supports the complete agent-to-host-to-agent golden path', async () => {
    const runtime = createRuntime();

    const mandateOutput = await getTool(runtime, 'set_buying_mandate').execute(
      defaultBuyerMandate,
      executeOptions,
    );
    expect(mandateOutput).toMatchObject({ ok: true });
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('request_host_evidence');

    const requestOutput = await getTool(runtime, 'request_host_evidence').execute(
      { kind: 'repair_history' },
      executeOptions,
    );
    expect(requestOutput).toMatchObject({ ok: true });
    expect(createSiteTools(runtime).map(({ name }) => name)).not.toContain('request_host_evidence');

    runtime.transition((state) => answerRepairHistory(state, 'none'));
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('reserve_current_lot');

    const reserveOutput = await getTool(runtime, 'reserve_current_lot').execute({}, executeOptions);
    expect(reserveOutput).toMatchObject({ ok: true });
    expect(runtime.getState().reservation).toMatchObject({ heldBy: 'agent' });
    expect(createSiteTools(runtime).map(({ name }) => name)).toContain('release_current_lot');
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
    const mandateTool = getTool(runtime, 'set_buying_mandate');
    const controller = new AbortController();
    controller.abort('cancelled by agent');

    await expect(
      mandateTool.execute(defaultBuyerMandate, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(runtime.getState().mandate).toBeNull();
  });
});
