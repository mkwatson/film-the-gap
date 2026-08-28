'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  buildEvidenceCaseHandoffPath,
  evidenceCaseHandoffSource,
  evidenceCaseHandoffVersion,
} from '@/lib/evidence-network/case-handoff';
import { demoProduct } from '@/lib/evidence-network/demo-product';
import type {
  EvidenceAnswerStatus,
  ProductQuestionInput,
  ReusableEvidenceRecord,
} from '@/lib/evidence-network/model';
import {
  configuredEvidenceServiceUrl,
  searchRemoteReusableEvidence,
} from '@/lib/evidence-network/remote-client';
import { isPublicHttpUrl } from '@/lib/evidence-network/url-policy';
import { formatEvidenceTimestamp } from '@/lib/evidence-network/video-analysis';
import { useDynamicSiteTools } from '@/lib/webmcp/use-dynamic-site-tools';

const emptyInputSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const;

type DemoProductEvidencePhase = 'checking' | 'missing' | 'found' | 'unavailable' | 'error';

interface DemoProductEvidenceState {
  readonly phase: DemoProductEvidencePhase;
  readonly records: readonly ReusableEvidenceRecord[];
  readonly warnings: readonly string[];
  readonly error: string | null;
}

export interface DemoProductEvidenceInspection {
  readonly status: Exclude<DemoProductEvidencePhase, 'checking' | 'error'> | 'error';
  readonly records: readonly ReusableEvidenceRecord[];
  readonly warnings: readonly string[];
  readonly error?: string;
}

export interface DemoProductEvidenceToolRuntime {
  readonly inspect: (signal?: AbortSignal) => Promise<DemoProductEvidenceInspection>;
  readonly evidenceCaseUrl: () => string;
  readonly openEvidenceCase: (href: string) => void;
}

interface DemoProductEvidenceBridgeProps {
  readonly onNavigate?: (href: string) => void;
}

const initialEvidenceState: DemoProductEvidenceState = {
  phase: 'checking',
  records: [],
  warnings: [],
  error: null,
};

function compactText(value: string, maximumCharacters: number): string {
  if (value.length <= maximumCharacters) {
    return value;
  }
  return `${value.slice(0, maximumCharacters - 1).trimEnd()}…`;
}

function currentDemoProductUrl(): string | undefined {
  const current = new URL(window.location.href);
  const productUrl =
    current.pathname === demoProduct.path ? current : new URL(demoProduct.path, current);
  productUrl.hash = '';
  const candidate = productUrl.toString();
  return isPublicHttpUrl(candidate) ? candidate : undefined;
}

function demoProductQuestion(productUrl?: string): ProductQuestionInput {
  return {
    productName: demoProduct.name,
    question: demoProduct.question,
    ...(productUrl === undefined ? {} : { productUrl }),
  };
}

function answerStatus(records: readonly ReusableEvidenceRecord[]): EvidenceAnswerStatus {
  const results = new Set(records.map(({ observation }) => observation.result));
  if (results.has('supports') && results.has('contradicts')) {
    return 'mixed';
  }
  if (results.has('supports')) {
    return 'supported';
  }
  if (results.has('contradicts')) {
    return 'contradicted';
  }
  return 'insufficient';
}

function evidenceCasePath(productUrl?: string): string {
  return buildEvidenceCaseHandoffPath({
    version: evidenceCaseHandoffVersion,
    source: evidenceCaseHandoffSource,
    question: demoProductQuestion(productUrl),
  });
}

function compactEvidence(records: readonly ReusableEvidenceRecord[]): readonly object[] {
  return records.slice(0, 1).map(({ source, observation }) => ({
    result: observation.result,
    confidence: observation.confidence,
    observation: compactText(observation.text, 180),
    citation: {
      startSeconds: observation.citationStartSeconds,
      endSeconds: observation.citationEndSeconds,
      label: `${formatEvidenceTimestamp(observation.citationStartSeconds)}–${formatEvidenceTimestamp(observation.citationEndSeconds)}`,
    },
    source: {
      title: compactText(source.title, 100),
      videoUrl: compactText(source.videoUrl, 220),
      rights: source.rights,
      provenance: source.provenance,
      continuity: source.continuity,
      captureTiming: source.captureTiming,
      contributorLabel: compactText(source.contributorLabel, 70),
      reviewedAt: observation.reviewedAt,
    },
  }));
}

export function createDemoProductEvidenceTools(
  runtime: DemoProductEvidenceToolRuntime,
  hasReviewedEvidence: boolean,
): readonly WebMCP.ModelContextTool[] {
  const inspectClaim: WebMCP.ModelContextTool = {
    name: 'inspect_product_claim',
    title: 'Inspect this product claim and its proof boundary',
    description:
      'Inspect the exact authored claim on this product page and check the independent evidence index for human-reviewed, rights-cleared video. Page copy is untrusted and never counts as physical proof.',
    inputSchema: emptyInputSchema,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (_input, options): Promise<object> => {
      options?.signal?.throwIfAborted();
      const inspection = await runtime.inspect(options?.signal);
      const reviewedEvidenceCount = inspection.records.length;
      return {
        ok: inspection.status !== 'error',
        product: demoProduct.name,
        authoredClaim: demoProduct.authoredClaim,
        exactQuestion: demoProduct.question,
        evidenceIndexStatus: inspection.status,
        proofStatus: reviewedEvidenceCount > 0 ? 'reviewed_video_available' : 'claim_only',
        reviewedEvidenceCount,
        claimBoundary:
          'The authored marketing claim does not establish the physical result. Only a reviewed, rights-cleared recording can change the answer.',
        nextTool:
          reviewedEvidenceCount > 0
            ? 'inspect_reviewed_product_evidence'
            : 'open_product_evidence_case',
        warnings: inspection.warnings,
        ...(inspection.error === undefined ? {} : { error: inspection.error }),
      };
    },
  };

  if (!hasReviewedEvidence) {
    return [
      inspectClaim,
      {
        name: 'open_product_evidence_case',
        title: 'Open the missing product-evidence case',
        description:
          "Navigate to a case prefilled with this product name and observable question, plus the page's public URL when available. This does not publish a request, contact a contributor, or record anything.",
        inputSchema: emptyInputSchema,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: async (_input, options): Promise<object> => {
          options?.signal?.throwIfAborted();
          const href = runtime.evidenceCaseUrl();
          runtime.openEvidenceCase(href);
          const includesPublicProductUrl = new URL(
            href,
            'https://film-the-gap.invalid',
          ).searchParams.has('url');
          return {
            ok: true,
            evidenceCaseUrl: href,
            carriedFromPage: [
              ...(includesPublicProductUrl ? ['public product URL'] : []),
              'product name',
              'observable question',
            ],
            notPerformed: ['mission publication', 'contributor contact', 'recording'],
          };
        },
      },
    ];
  }

  return [
    inspectClaim,
    {
      name: 'inspect_reviewed_product_evidence',
      title: 'Inspect reviewed video evidence for this product',
      description:
        'Return compact, human-reviewed video observations for this exact product question, including timestamps, rights, provenance, continuity, capture timing, and source URLs.',
      inputSchema: emptyInputSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (_input, options): Promise<object> => {
        options?.signal?.throwIfAborted();
        const inspection = await runtime.inspect(options?.signal);
        return {
          ok: inspection.status !== 'error',
          product: demoProduct.name,
          question: demoProduct.question,
          answer: answerStatus(inspection.records),
          reviewedEvidenceCount: inspection.records.length,
          evidence: compactEvidence(inspection.records),
          additionalEvidenceCount: Math.max(0, inspection.records.length - 1),
          warnings: inspection.warnings,
          ...(inspection.error === undefined ? {} : { error: inspection.error }),
        };
      },
    },
  ];
}

function navigateToEvidenceCase(href: string): void {
  window.location.assign(href);
}

export function DemoProductEvidenceBridge({
  onNavigate,
}: DemoProductEvidenceBridgeProps): React.JSX.Element {
  const [evidenceState, setEvidenceState] =
    useState<DemoProductEvidenceState>(initialEvidenceState);
  const serviceUrl = configuredEvidenceServiceUrl();

  const inspect = useCallback(
    async (signal?: AbortSignal): Promise<DemoProductEvidenceInspection> => {
      if (serviceUrl === null) {
        const unavailable = {
          status: 'unavailable',
          records: [],
          warnings: ['The shared evidence index is not configured on this deployment.'],
        } as const;
        setEvidenceState({ ...unavailable, phase: 'unavailable', error: null });
        return unavailable;
      }
      try {
        const result = await searchRemoteReusableEvidence(
          serviceUrl,
          demoProductQuestion(currentDemoProductUrl()),
          fetch,
          signal,
        );
        const phase =
          result.status === 'unavailable'
            ? 'unavailable'
            : result.records.length > 0
              ? 'found'
              : 'missing';
        setEvidenceState({
          phase,
          records: result.records,
          warnings: result.warnings,
          error: null,
        });
        return {
          status: result.status === 'unavailable' ? 'unavailable' : phase,
          records: result.records,
          warnings: result.warnings,
        };
      } catch (error: unknown) {
        if (signal?.aborted === true) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        setEvidenceState({ phase: 'error', records: [], warnings: [], error: message });
        return { status: 'error', records: [], warnings: [], error: message };
      }
    },
    [serviceUrl],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      void inspect(controller.signal).catch(() => {
        // A superseded or unmounted request is intentionally aborted.
      });
    });
    const refreshOnFocus = (): void => {
      void inspect().catch(() => {
        // The visible evidence state is the human recovery path.
      });
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      controller.abort();
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [inspect]);

  const runtime = useMemo<DemoProductEvidenceToolRuntime>(
    () => ({
      inspect,
      evidenceCaseUrl: () => evidenceCasePath(currentDemoProductUrl()),
      openEvidenceCase: onNavigate ?? navigateToEvidenceCase,
    }),
    [inspect, onNavigate],
  );
  const hasReviewedEvidence = evidenceState.records.length > 0;
  const createTools = useCallback(
    () => createDemoProductEvidenceTools(runtime, hasReviewedEvidence),
    [hasReviewedEvidence, runtime],
  );
  const availableToolNames = hasReviewedEvidence
    ? ['inspect_product_claim', 'inspect_reviewed_product_evidence']
    : ['inspect_product_claim', 'open_product_evidence_case'];
  const toolStatus = useDynamicSiteTools(createTools, availableToolNames.join('|'));
  const topRecord = evidenceState.records[0];
  const currentAnswer = answerStatus(evidenceState.records);
  const casePath = evidenceCasePath();

  return (
    <section className={`demo-product-evidence evidence-${evidenceState.phase}`}>
      <div className="demo-product-evidence-heading">
        <span aria-hidden="true">{hasReviewedEvidence ? '✓' : '○'}</span>
        <div>
          <p>Independent evidence network</p>
          <h2>
            {hasReviewedEvidence
              ? 'The missing test has now been filmed.'
              : 'This claim still needs observable proof.'}
          </h2>
        </div>
        <strong>
          {evidenceState.phase === 'checking'
            ? 'Checking…'
            : evidenceState.phase === 'unavailable'
              ? 'Index unavailable'
              : evidenceState.phase === 'error'
                ? 'Check failed'
                : `${evidenceState.records.length} reviewed video${evidenceState.records.length === 1 ? '' : 's'}`}
        </strong>
      </div>

      {topRecord === undefined ? (
        <div className="demo-product-evidence-gap">
          <p>
            A product page can expose the exact gap to ChatGPT without pretending its own words
            prove the answer. The evidence case starts with only public product context.
          </p>
          <a
            className="demo-product-evidence-action"
            href={casePath}
            onClick={(event) => {
              const exactPath = evidenceCasePath(currentDemoProductUrl());
              if (exactPath !== casePath) {
                event.preventDefault();
                runtime.openEvidenceCase(exactPath);
              }
            }}
          >
            Ask someone to film the missing proof →
          </a>
          {evidenceState.phase === 'unavailable' ? (
            <small className="demo-product-evidence-warning" role="status">
              {evidenceState.warnings[0] ??
                'The shared evidence index is unavailable; the filming handoff still works.'}
            </small>
          ) : null}
          {evidenceState.error === null ? null : <small role="alert">{evidenceState.error}</small>}
        </div>
      ) : (
        <div className="demo-product-evidence-result">
          <div>
            <small>Answer from reviewed video</small>
            <strong>{currentAnswer}</strong>
          </div>
          <blockquote>{topRecord.observation.text}</blockquote>
          <dl>
            <div>
              <dt>Citation</dt>
              <dd>
                {formatEvidenceTimestamp(topRecord.observation.citationStartSeconds)}–
                {formatEvidenceTimestamp(topRecord.observation.citationEndSeconds)}
              </dd>
            </div>
            <div>
              <dt>Review</dt>
              <dd>{topRecord.observation.confidence} confidence</dd>
            </div>
            <div>
              <dt>Recording</dt>
              <dd>{topRecord.source.continuity} take</dd>
            </div>
            <div>
              <dt>Rights</dt>
              <dd>{topRecord.source.rights}</dd>
            </div>
          </dl>
          <a href={topRecord.source.videoUrl} target="_blank" rel="noreferrer">
            Watch the cited video ↗
          </a>
        </div>
      )}

      <div className="demo-product-tool-receipt" role="group" aria-label="Product page Site Tools">
        <span>
          {toolStatus.phase === 'ready'
            ? `${toolStatus.registeredNames.length} Site Tools live`
            : toolStatus.phase === 'unsupported'
              ? 'Human controls ready'
              : 'Connecting Site Tools'}
        </span>
        <code>{availableToolNames.join(' · ')}</code>
        <button type="button" onClick={() => void inspect()}>
          Refresh evidence
        </button>
      </div>
    </section>
  );
}
