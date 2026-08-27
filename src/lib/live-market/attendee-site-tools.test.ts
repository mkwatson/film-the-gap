import { describe, expect, it } from 'vitest';

import { createAttendeeSiteTools } from './attendee-site-tools';
import { createInitialState, defaultEvidenceRequirements, type LiveMarketState } from './model';
import { applyRoomCommand, type RoomCommand } from './room-command';
import type { SiteToolRuntime } from './site-tools';

const executeOptions: WebMCP.ToolExecuteCallbackOptions = {
  signal: new AbortController().signal,
};

function tool(runtime: SiteToolRuntime, name: string): WebMCP.ModelContextTool {
  const found = createAttendeeSiteTools(runtime).find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Error(`Expected attendee Site Tool ${name}.`);
  }
  return found;
}

function queuedState(): LiveMarketState {
  const scoped = applyRoomCommand(createInitialState(), {
    kind: 'set-evidence-requirements',
    actor: 'agent',
    requirements: defaultEvidenceRequirements,
  }).state;
  return applyRoomCommand(scoped, {
    kind: 'request-repair-history',
    actor: 'agent',
  }).state;
}

describe('attendee WebMCP Site Tools', () => {
  it('publishes no tools before an attendee credential authenticates', () => {
    const state = createInitialState();
    const runtime: SiteToolRuntime = {
      readState: () => state,
      readAuthorized: () => false,
      dispatch: async () => {
        throw new Error('No mutation expected.');
      },
    };

    expect(createAttendeeSiteTools(runtime)).toEqual([]);
  });

  it('publishes a read-only inspection tool before demand opens', () => {
    const state = createInitialState();
    const runtime: SiteToolRuntime = {
      readState: () => state,
      dispatch: async () => {
        throw new Error('No mutation expected.');
      },
      readJoined: () => false,
    };

    expect(createAttendeeSiteTools(runtime).map(({ name }) => name)).toEqual([
      'inspect_shared_evidence_demand',
    ]);
  });

  it('exposes exactly one least-authority join mutation for an open request', async () => {
    let state = queuedState();
    let joined = false;
    const runtime: SiteToolRuntime = {
      readState: () => state,
      readJoined: () => joined,
      dispatch: async (command: RoomCommand) => {
        const result = applyRoomCommand(state, command);
        state = result.state;
        if (command.kind === 'join-evidence-demand' && result.ok) {
          joined = true;
        }
        return result;
      },
    };

    const tools = createAttendeeSiteTools(runtime);
    expect(tools.map(({ name }) => name)).toEqual([
      'inspect_shared_evidence_demand',
      'join_shared_evidence_demand',
    ]);
    expect(tools.map(({ name }) => name)).not.toEqual(
      expect.arrayContaining(['reserve_current_lot', 'prepare_merchant_cart', 'reset_room']),
    );

    const inspect = await tool(runtime, 'inspect_shared_evidence_demand').execute(
      {},
      executeOptions,
    );
    expect(inspect).toMatchObject({
      normalizedQuestion: 'Show the base and disclose whether it has ever been repaired.',
      demand: {
        authenticatedAttendeeCount: 0,
        fixtureAgentCount: 7,
        liveAgentCount: 1,
        totalAgentCount: 8,
        thisAttendeeJoined: false,
      },
      privateBuyerContext: 'not collected',
    });
    expect(JSON.stringify(inspect)).not.toContain('maximumAllInPrice');
    expect(JSON.stringify(inspect)).not.toContain('450');

    const result = await tool(runtime, 'join_shared_evidence_demand').execute({}, executeOptions);
    expect(result).toMatchObject({
      ok: true,
      demand: {
        authenticatedAttendeeCount: 1,
        fixtureAgentCount: 6,
        liveAgentCount: 2,
        totalAgentCount: 8,
        thisAttendeeJoined: true,
      },
    });
    expect(createAttendeeSiteTools(runtime).map(({ name }) => name)).toEqual([
      'inspect_shared_evidence_demand',
    ]);
  });

  it('rejects extra fields instead of accepting hidden attendee context', async () => {
    const state = queuedState();
    const runtime: SiteToolRuntime = {
      readState: () => state,
      readJoined: () => false,
      dispatch: async () => {
        throw new Error('Invalid input must not dispatch.');
      },
    };

    await expect(
      tool(runtime, 'join_shared_evidence_demand').execute({ maximumPrice: 450 }, executeOptions),
    ).resolves.toEqual({ ok: false, error: 'invalid_input' });
  });
});
