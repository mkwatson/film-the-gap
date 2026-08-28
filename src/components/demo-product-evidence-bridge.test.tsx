import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseEvidenceCaseHandoffSearchParams } from '@/lib/evidence-network/case-handoff';
import { demoProduct } from '@/lib/evidence-network/demo-product';
import type { ReusableEvidenceRecord } from '@/lib/evidence-network/model';

import {
  createDemoProductEvidenceTools,
  DemoProductEvidenceBridge,
} from './demo-product-evidence-bridge';

const remoteMocks = vi.hoisted(() => ({
  evidenceServiceUrl: null as string | null,
  searchRemoteReusableEvidence: vi.fn(),
}));

vi.mock('@/lib/evidence-network/remote-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/evidence-network/remote-client')>();
  return {
    ...actual,
    configuredEvidenceServiceUrl: (): string | null => remoteMocks.evidenceServiceUrl,
    searchRemoteReusableEvidence: remoteMocks.searchRemoteReusableEvidence,
  };
});

interface Registration {
  readonly tool: WebMCP.ModelContextTool;
  readonly signal: AbortSignal | undefined;
}

class RecordingModelContext extends EventTarget implements WebMCP.ModelContext {
  readonly registrations: Registration[] = [];
  ontoolchange: ((this: WebMCP.ModelContext, event: Event) => unknown) | null = null;

  async registerTool(
    tool: WebMCP.ModelContextTool,
    options?: WebMCP.ModelContextRegisterToolOptions,
  ): Promise<void> {
    this.registrations.push({ tool, signal: options?.signal });
  }

  async getTools(): Promise<WebMCP.RegisteredTool[]> {
    return [];
  }

  latestTool(name: string): WebMCP.ModelContextTool {
    const registration = this.registrations.findLast(
      ({ tool, signal }) => tool.name === name && signal?.aborted === false,
    );
    if (registration === undefined) {
      throw new Error(`Expected an active ${name} registration.`);
    }
    return registration.tool;
  }

  activeToolNames(): readonly string[] {
    return this.registrations
      .filter(({ signal }) => signal?.aborted === false)
      .map(({ tool }) => tool.name);
  }
}

const reviewedRecord: ReusableEvidenceRecord = {
  id: 'case-demo:demo_stream_000001',
  productName: demoProduct.name,
  productUrl: null,
  question: demoProduct.question,
  source: {
    title: 'Contributor-recorded bottle test',
    videoUrl: 'https://customer-demo.cloudflarestream.com/demo_stream_000001/watch',
    rights: 'owned',
    provenance: 'live_capture',
    continuity: 'continuous',
    captureTiming: 'mission_challenge_verified',
    contributorLabel: 'Anonymous contributor',
    capturedAt: '2026-08-28T03:00:00.000Z',
    streamUid: 'demo_stream_000001',
    sha256: 'a'.repeat(64),
    durationSeconds: 14,
  },
  observation: {
    result: 'supports',
    confidence: 'high',
    text: 'No water appeared on the dry paper during the continuous ten-second inversion.',
    citationStartSeconds: 2,
    citationEndSeconds: 13,
    reviewedAt: '2026-08-28T03:01:00.000Z',
  },
  indexedAt: '2026-08-28T03:01:00.000Z',
  expiresAt: '2026-09-27T03:01:00.000Z',
};

function setModelContext(modelContext: WebMCP.ModelContext | undefined): void {
  Object.defineProperty(document, 'modelContext', { configurable: true, value: modelContext });
}

beforeEach(() => {
  remoteMocks.evidenceServiceUrl = null;
  remoteMocks.searchRemoteReusableEvidence.mockReset();
});

afterEach(() => {
  setModelContext(undefined);
  vi.unstubAllGlobals();
});

describe('DemoProductEvidenceBridge', () => {
  it('offers the exact evidence-case handoff in an ordinary browser', async () => {
    setModelContext(undefined);
    render(<DemoProductEvidenceBridge />);

    expect(await screen.findByText('Human controls ready')).toBeTruthy();
    expect(screen.getByText('This claim still needs observable proof.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Ask someone to film the missing proof →' });
    const url = new URL(link.getAttribute('href') ?? '', window.location.origin);
    const handoff = parseEvidenceCaseHandoffSearchParams(Object.fromEntries(url.searchParams));
    expect(handoff).toMatchObject({
      source: 'demo_product',
      question: { productName: demoProduct.name, question: demoProduct.question },
    });
    expect(JSON.stringify(handoff)).not.toMatch(/budget|identity|history|preference/i);
  });

  it('exposes a narrow claim inspector and navigational handoff before proof exists', async () => {
    const modelContext = new RecordingModelContext();
    const navigate = vi.fn();
    setModelContext(modelContext);
    remoteMocks.evidenceServiceUrl = 'https://evidence.example';
    remoteMocks.searchRemoteReusableEvidence.mockResolvedValue({
      status: 'complete',
      records: [],
      warnings: [],
    });

    render(<DemoProductEvidenceBridge onNavigate={navigate} />);
    await waitFor(() => {
      expect(modelContext.activeToolNames()).toEqual([
        'inspect_product_claim',
        'open_product_evidence_case',
      ]);
    });

    const inspected = await modelContext
      .latestTool('inspect_product_claim')
      .execute({}, { signal: new AbortController().signal });
    expect(inspected).toMatchObject({
      evidenceIndexStatus: 'missing',
      proofStatus: 'claim_only',
      reviewedEvidenceCount: 0,
      nextTool: 'open_product_evidence_case',
    });
    expect(JSON.stringify(inspected).length).toBeLessThanOrEqual(1_500);

    const opened = await modelContext
      .latestTool('open_product_evidence_case')
      .execute({}, { signal: new AbortController().signal });
    expect(opened).toMatchObject({ ok: true, evidenceCaseUrl: expect.stringMatching(/^\/case\?/) });
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/case\?/));
    expect(JSON.stringify(opened).length).toBeLessThanOrEqual(1_500);
  });

  it('replaces the missing-proof tool with reviewed evidence when a recording arrives', async () => {
    const modelContext = new RecordingModelContext();
    let records: readonly ReusableEvidenceRecord[] = [];
    setModelContext(modelContext);
    remoteMocks.evidenceServiceUrl = 'https://evidence.example';
    remoteMocks.searchRemoteReusableEvidence.mockImplementation(async () => ({
      status: 'complete' as const,
      records,
      warnings: [],
    }));

    render(<DemoProductEvidenceBridge onNavigate={vi.fn()} />);
    await waitFor(() => {
      expect(modelContext.activeToolNames()).toContain('open_product_evidence_case');
    });
    const retiredRegistration = modelContext.registrations.find(
      ({ tool }) => tool.name === 'open_product_evidence_case',
    );

    records = [reviewedRecord];
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    });

    expect(await screen.findByText('The missing test has now been filmed.')).toBeTruthy();
    expect(screen.getByText(reviewedRecord.observation.text)).toBeTruthy();
    await waitFor(() => {
      expect(modelContext.activeToolNames()).toEqual([
        'inspect_product_claim',
        'inspect_reviewed_product_evidence',
      ]);
    });
    expect(retiredRegistration?.signal?.aborted).toBe(true);

    const inspected = await modelContext
      .latestTool('inspect_reviewed_product_evidence')
      .execute({}, { signal: new AbortController().signal });
    expect(inspected).toMatchObject({
      answer: 'supported',
      reviewedEvidenceCount: 1,
      evidence: [
        {
          result: 'supports',
          confidence: 'high',
          citation: { label: '00:02–00:13' },
          source: {
            rights: 'owned',
            provenance: 'live_capture',
            continuity: 'continuous',
            captureTiming: 'mission_challenge_verified',
          },
        },
      ],
    });
    expect(JSON.stringify(inspected)).not.toMatch(/sha256|streamUid/i);
    expect(JSON.stringify(inspected).length).toBeLessThanOrEqual(1_500);
  });

  it('keeps a four-record Site Tool result compact while disclosing omitted evidence', async () => {
    const records: readonly ReusableEvidenceRecord[] = Array.from({ length: 4 }, (_, index) => ({
      ...reviewedRecord,
      id: `case-demo:demo_stream_00000${index}`,
      source: {
        ...reviewedRecord.source,
        title: 'T'.repeat(240),
        videoUrl: `https://video.example/${'v'.repeat(180)}?record=${index}`,
        contributorLabel: 'C'.repeat(80),
        streamUid: `demo_stream_00000${index}`,
      },
      observation: {
        ...reviewedRecord.observation,
        text: 'O'.repeat(360),
      },
    }));
    const tools = createDemoProductEvidenceTools(
      {
        inspect: async () => ({ status: 'found', records, warnings: [] }),
        evidenceCaseUrl: () => '/case',
        openEvidenceCase: vi.fn(),
      },
      true,
    );
    const tool = tools.find(({ name }) => name === 'inspect_reviewed_product_evidence');
    if (tool === undefined) {
      throw new Error('Expected the reviewed-evidence Site Tool.');
    }

    const output = await tool.execute({}, { signal: new AbortController().signal });

    expect(output).toMatchObject({
      reviewedEvidenceCount: 4,
      evidence: [expect.any(Object)],
      moreEvidenceVisibleOnPage: true,
    });
    expect(JSON.stringify(output).length).toBeLessThanOrEqual(1_500);
  });
});
