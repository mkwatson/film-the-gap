import { z } from 'zod';

import { getEvidenceDemandSummary } from './model';
import type { SiteToolRuntime } from './site-tools';

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

const emptyObjectSchema = z.strictObject({});

function checkAbort(options?: WebMCP.ToolExecuteCallbackOptions): void {
  options?.signal?.throwIfAborted();
}

function demandSnapshot(runtime: SiteToolRuntime): object {
  const state = runtime.readState();
  const demand = getEvidenceDemandSummary(state, 'repair_history');
  const queued = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );

  return {
    roomPurpose: 'Aggregate one decision-relevant product fact without collecting buyer context.',
    normalizedQuestion: queued
      ? 'Show the base and disclose whether it has ever been repaired.'
      : null,
    demand: {
      status: demand.status,
      authenticatedAttendeeCount: demand.authenticatedAttendeeCount,
      fixtureAgentCount: demand.fixtureAgentCount,
      liveAgentCount: demand.liveAgentCount,
      totalAgentCount: demand.totalAgentCount,
      thisAttendeeJoined: runtime.readJoined?.() ?? false,
    },
    publishedAnswer:
      state.lot.evidence.repairHistory === 'unknown'
        ? null
        : {
            repairHistory: state.lot.evidence.repairHistory,
            source: state.lot.evidence.repairEvidenceSource,
          },
    authority: {
      allowed: ['inspect shared evidence demand', 'join the open normalized request once'],
      denied: ['see buyer context', 'answer for the host', 'hold', 'cart', 'checkout', 'reset'],
    },
    privateBuyerContext: 'not collected',
  };
}

export function createAttendeeSiteTools(
  runtime: SiteToolRuntime,
): readonly WebMCP.ModelContextTool[] {
  if (runtime.readAuthorized?.() === false) {
    return [];
  }
  const state = runtime.readState();
  const demand = getEvidenceDemandSummary(state, 'repair_history');
  const tools: WebMCP.ModelContextTool[] = [
    {
      name: 'inspect_shared_evidence_demand',
      title: 'Inspect shared evidence demand',
      description:
        'Read the one normalized product-evidence question, aggregate counts, any published answer, and this attendee credential’s narrow authority. No buyer profile, reason, or maximum price is available here.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = emptyObjectSchema.safeParse(input);
        if (!parsed.success) {
          return { ok: false, error: 'invalid_input' };
        }
        return demandSnapshot(runtime);
      },
    },
  ];

  const canJoin =
    demand.status === 'queued' &&
    demand.fixtureAgentCount > 0 &&
    !(runtime.readJoined?.() ?? false);
  if (canJoin) {
    tools.push({
      name: 'join_shared_evidence_demand',
      title: 'Join shared evidence demand',
      description:
        'Replace one deterministic crowd fixture with this separately authorized attendee session. This adds one aggregate demand signal only; it sends no identity, private rationale, price ceiling, or commerce instruction.',
      inputSchema: emptyInputSchema,
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
      },
      execute: async (input, options?: WebMCP.ToolExecuteCallbackOptions): Promise<object> => {
        checkAbort(options);
        const parsed = emptyObjectSchema.safeParse(input);
        if (!parsed.success) {
          return { ok: false, error: 'invalid_input' };
        }
        const result = await runtime.dispatch({ kind: 'join-evidence-demand' });
        return {
          ok: result.ok,
          message: result.message,
          ...demandSnapshot(runtime),
        };
      },
    });
  }

  return tools;
}
