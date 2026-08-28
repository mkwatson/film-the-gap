import { describe, expect, it } from 'vitest';

import browserJourneyEvals from '../../../evals/browser-journey-evals.json';
import evidenceInitialEvals from '../../../evals/evidence-initial-evals.json';
import evidenceInitialTools from '../../../evals/evidence-initial-tools.json';
import evidenceMissionEvals from '../../../evals/evidence-mission-evals.json';
import evidenceMissionTools from '../../../evals/evidence-mission-tools.json';
import productPageInitialTools from '../../../evals/product-page-initial-tools.json';
import productPageJourneyEvals from '../../../evals/product-page-journey-evals.json';
import productPageReviewedEvals from '../../../evals/product-page-reviewed-evals.json';
import productPageReviewedTools from '../../../evals/product-page-reviewed-tools.json';
import { createDemoProductEvidenceTools } from '../../components/demo-product-evidence-bridge';
import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
  createDemoEvidenceQuestionState,
} from './model';
import { createEvidenceSiteTools, type EvidenceSiteToolRuntime } from './site-tools';

const allEvidenceToolNames = new Set([
  'inspect_product_evidence',
  'ask_product_question',
  'search_product_evidence',
  'create_filming_mission',
  'refine_filming_mission',
  'create_phone_capture_link',
  'inspect_answer_change',
  'publish_filming_mission',
  'remove_public_filming_mission',
  'inspect_open_filming_missions',
  'open_filming_mission',
  'inspect_product_claim',
  'open_product_evidence_case',
  'inspect_reviewed_product_evidence',
]);

const allEvals = [
  ...evidenceInitialEvals,
  ...evidenceMissionEvals,
  ...browserJourneyEvals,
  ...productPageJourneyEvals,
  ...productPageReviewedEvals,
];

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
    const state = createDemoEvidenceQuestionState();
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

  it('keeps the open-mission refinement schema identical to the live tool frontier', () => {
    const state = applyEvidenceNetworkCommand(createDemoEvidenceNetworkState(), {
      kind: 'create-filming-mission',
      actor: 'agent',
      input: {
        instruction: 'Invert the filled bottle over dry paper for ten seconds.',
        successCriterion: 'Keep the closed lid and dry paper visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
    }).state;
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

    expect(state.revision).toBe(2);
    expect(evidenceMissionTools.tools).toEqual(actual);
  });

  it('keeps both product-page schema snapshots identical to the dynamic tools', () => {
    const runtime = {
      inspect: async () => ({ status: 'missing' as const, records: [], warnings: [] }),
      evidenceCaseUrl: () => '/case',
      openEvidenceCase: () => undefined,
    };
    const project = (hasReviewedEvidence: boolean): readonly object[] =>
      createDemoProductEvidenceTools(runtime, hasReviewedEvidence).map(
        ({ name, description, inputSchema }) => ({ name, description, inputSchema }),
      );

    expect(productPageInitialTools.tools).toEqual(project(false));
    expect(productPageReviewedTools.tools).toEqual(project(true));
  });

  it('uses unique cases and only real dynamic evidence tools', () => {
    expect(new Set(allEvals.map(({ name }) => name)).size).toBe(allEvals.length);

    for (const testCase of allEvals) {
      expect(testCase.messages.length, testCase.name).toBeGreaterThan(0);
      const calls = expectedCalls(testCase.expectedCall);
      expect(calls.length, testCase.name).toBeGreaterThan(0);
      for (const call of calls) {
        expect(allEvidenceToolNames.has(call.functionName), testCase.name).toBe(true);
      }
    }
  });

  it('keeps private test context out of every expected website argument', () => {
    const serializedArguments = JSON.stringify(
      allEvals
        .flatMap(({ expectedCall }) => expectedCalls(expectedCall))
        .map((call) => call.arguments),
    );

    expect(serializedArguments).not.toContain('275');
    expect(serializedArguments).not.toMatch(
      /budget|home situation|shopping history|purchase history|private preferences|buyer identity/i,
    );
  });

  it('models the product-page handoff as a cross-document WebMCP trajectory', () => {
    expect(
      expectedCalls(productPageJourneyEvals[0]?.expectedCall).map(
        ({ functionName }) => functionName,
      ),
    ).toEqual(['inspect_product_claim', 'open_product_evidence_case', 'inspect_product_evidence']);
  });

  it('keeps the reviewed product page read-only and removes the stale handoff', () => {
    const reviewedCalls = productPageReviewedEvals.flatMap(({ expectedCall }) =>
      expectedCalls(expectedCall),
    );
    expect(reviewedCalls.every(({ arguments: input }) => JSON.stringify(input) === '{}')).toBe(
      true,
    );
    expect(reviewedCalls.map(({ functionName }) => functionName)).not.toContain(
      'open_product_evidence_case',
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
      'inspect_product_evidence',
      'refine_filming_mission',
      'create_phone_capture_link',
      'publish_filming_mission',
    ]);
    expect(expectedCalls(hero?.expectedCall).at(-3)?.arguments).toMatchObject({
      expectedRevision: 4,
    });
    expect(expectedCalls(hero?.expectedCall).at(-1)?.arguments).toEqual({
      confirmPublicListing: true,
    });

    const privateHandoff = browserJourneyEvals.find(({ name }) =>
      name.startsWith('No public posting'),
    );
    expect(
      expectedCalls(privateHandoff?.expectedCall).map(({ functionName }) => functionName),
    ).toEqual(['search_product_evidence', 'create_filming_mission', 'create_phone_capture_link']);
  });

  it('requires inspection before a stale-protected mission refinement', () => {
    const refinement = evidenceMissionEvals.find(({ name }) => name.startsWith('Inspect before'));
    const calls = expectedCalls(refinement?.expectedCall);

    expect(calls.map(({ functionName }) => functionName)).toEqual([
      'inspect_product_evidence',
      'refine_filming_mission',
    ]);
    expect(calls.at(-1)?.arguments).toMatchObject({ expectedRevision: 2 });
  });
});
