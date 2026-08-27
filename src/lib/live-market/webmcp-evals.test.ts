import { describe, expect, it } from 'vitest';

import browserJourneyEvals from '../../../evals/browser-journey-evals.json';
import buyerInitialEvals from '../../../evals/buyer-initial-evals.json';
import buyerInitialTools from '../../../evals/buyer-initial-tools.json';
import { createInitialState } from './model';
import { createSiteTools, type SiteToolRuntime } from './site-tools';

const allBuyerToolNames = new Set([
  'inspect_live_show',
  'set_evidence_requirements',
  'request_host_evidence',
  'reserve_current_lot',
  'release_current_lot',
  'prepare_merchant_cart',
  'cancel_merchant_cart',
]);

describe('Chrome WebMCP eval corpus', () => {
  it('keeps the static initial schema identical to the actual initial page tools', () => {
    const runtime: SiteToolRuntime = {
      readState: () => createInitialState(),
      dispatch: async () => {
        throw new Error('Schema comparison must not execute a tool.');
      },
    };
    const actual = createSiteTools(runtime).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));

    expect(buyerInitialTools.tools).toEqual(actual);
  });

  it('uses unique cases and only names real dynamic tools', () => {
    const cases = [...buyerInitialEvals, ...browserJourneyEvals];
    expect(new Set(cases.map(({ name }) => name)).size).toBe(cases.length);

    for (const testCase of cases) {
      expect(testCase.messages.length).toBeGreaterThan(0);
      expect(testCase.expectedCall.length).toBeGreaterThan(0);
      for (const call of testCase.expectedCall) {
        expect(allBuyerToolNames.has(call.functionName), testCase.name).toBe(true);
      }
    }
  });

  it('never places the private test ceiling in expected tool arguments', () => {
    const expectedCalls = [...buyerInitialEvals, ...browserJourneyEvals].flatMap(
      ({ expectedCall }) => expectedCall,
    );
    const expectedArguments = JSON.stringify(expectedCalls.map(({ arguments: input }) => input));

    expect(expectedArguments).not.toContain('450');
    expect(expectedArguments).not.toMatch(/budget|ceiling|maxAllInPrice/i);
  });
});
