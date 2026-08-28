import { describe, expect, it } from 'vitest';

import browserJourneyEvals from '../../../evals/browser-journey-evals.json';
import evidenceInitialEvals from '../../../evals/evidence-initial-evals.json';
import evidenceInitialTools from '../../../evals/evidence-initial-tools.json';
import { createDemoEvidenceNetworkState } from './model';
import { createEvidenceSiteTools, type EvidenceSiteToolRuntime } from './site-tools';

const allEvidenceToolNames = new Set([
  'inspect_product_evidence',
  'ask_product_question',
  'search_product_evidence',
  'create_filming_mission',
  'create_phone_capture_link',
  'inspect_answer_change',
  'publish_filming_mission',
  'remove_public_filming_mission',
]);

interface ExpectedFunctionCall {
  readonly functionName: string;
  readonly arguments?: unknown;
}

function expectedCalls(value: unknown): readonly ExpectedFunctionCall[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => expectedCalls(item));
  }
  if (value === null || typeof value !== 'object') {
    return [];
  }
  const record = value as Readonly<Record<string, unknown>>;
  if (typeof record.functionName === 'string') {
    return [{ functionName: record.functionName, arguments: record.arguments }];
  }
  return [...expectedCalls(record.ordered), ...expectedCalls(record.unordered)];
}

describe('generic product-evidence WebMCP eval corpus', () => {
  it('keeps the static initial schema identical to the actual initial page tools', () => {
    const state = createDemoEvidenceNetworkState();
    const runtime: EvidenceSiteToolRuntime = {
      readState: () => state,
      dispatch: async () => {
        throw new Error('Schema comparison must not execute a tool.');
      },
    };
    const actual = createEvidenceSiteTools(runtime).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));

    expect(evidenceInitialTools.tools).toEqual(actual);
  });

  it('uses unique cases and only real dynamic evidence tools', () => {
    const cases = [...evidenceInitialEvals, ...browserJourneyEvals];
    expect(new Set(cases.map(({ name }) => name)).size).toBe(cases.length);

    for (const testCase of cases) {
      expect(testCase.messages.length, testCase.name).toBeGreaterThan(0);
      const calls = expectedCalls(testCase.expectedCall);
      expect(calls.length, testCase.name).toBeGreaterThan(0);
      for (const call of calls) {
        expect(allEvidenceToolNames.has(call.functionName), testCase.name).toBe(true);
      }
    }
  });

  it('keeps private test context out of every expected website argument', () => {
    const cases = [...evidenceInitialEvals, ...browserJourneyEvals];
    const serializedArguments = JSON.stringify(
      cases
        .flatMap(({ expectedCall }) => expectedCalls(expectedCall))
        .map((call) => call.arguments),
    );

    expect(serializedArguments).not.toContain('275');
    expect(serializedArguments).not.toMatch(
      /budget|home situation|shopping history|purchase history|private preferences|buyer identity/i,
    );
  });

  it('models public recruitment as a separate explicitly confirmed step', () => {
    const hero = browserJourneyEvals.find(({ name }) =>
      name.startsWith('Arbitrary product becomes'),
    );
    expect(expectedCalls(hero?.expectedCall).map(({ functionName }) => functionName)).toEqual([
      'ask_product_question',
      'search_product_evidence',
      'create_filming_mission',
      'create_phone_capture_link',
      'publish_filming_mission',
    ]);
    expect(expectedCalls(hero?.expectedCall).at(-1)?.arguments).toEqual({
      confirmPublicListing: true,
    });

    const privateHandoff = browserJourneyEvals.find(({ name }) =>
      name.startsWith('No public posting'),
    );
    expect(
      expectedCalls(privateHandoff?.expectedCall).map(({ functionName }) => functionName),
    ).not.toContain('publish_filming_mission');
  });
});
