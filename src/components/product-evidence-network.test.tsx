import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyEvidenceNetworkCommand,
  createDemoEvidenceNetworkState,
} from '@/lib/evidence-network/model';
import {
  evidenceCaseHandoffSource,
  evidenceCaseHandoffVersion,
} from '@/lib/evidence-network/case-handoff';
import { demoProduct } from '@/lib/evidence-network/demo-product';
import { remoteEvidenceProtocolVersion } from '@/lib/evidence-network/remote-protocol';

import { ProductEvidenceNetwork } from './product-evidence-network';

const remoteMocks = vi.hoisted(() => ({
  evidenceServiceUrl: null as string | null,
  createRemoteEvidenceCase: vi.fn(),
  publishPublicEvidenceMission: vi.fn(),
  removePublicEvidenceMission: vi.fn(),
}));

vi.mock('@/lib/evidence-network/remote-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/evidence-network/remote-client')>();
  return {
    ...actual,
    configuredEvidenceServiceUrl: (): string | null => remoteMocks.evidenceServiceUrl,
    createRemoteEvidenceCase: remoteMocks.createRemoteEvidenceCase,
    publishPublicEvidenceMission: remoteMocks.publishPublicEvidenceMission,
    removePublicEvidenceMission: remoteMocks.removePublicEvidenceMission,
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

function setModelContext(modelContext: WebMCP.ModelContext | undefined): void {
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: modelContext,
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (): Promise<Response> =>
      Response.json({
        provider: 'evidence_network',
        status: 'complete',
        query: 'travel bottle continuous upside-down leak test',
        searchedPlatforms: ['web'],
        warnings: [],
        leads: [],
      }),
    ),
  );
  remoteMocks.evidenceServiceUrl = null;
  remoteMocks.createRemoteEvidenceCase.mockReset();
  remoteMocks.publishPublicEvidenceMission.mockReset();
  remoteMocks.removePublicEvidenceMission.mockReset();
});

afterEach(() => {
  window.sessionStorage.clear();
  setModelContext(undefined);
  vi.unstubAllGlobals();
});

describe('ProductEvidenceNetwork', () => {
  it('opens directly on the exact public question handed off by a product page', async () => {
    setModelContext(undefined);
    render(
      <ProductEvidenceNetwork
        initialHandoff={{
          version: evidenceCaseHandoffVersion,
          source: evidenceCaseHandoffSource,
          question: {
            productName: demoProduct.name,
            productUrl: 'https://catalog.example/demo-product',
            question: demoProduct.question,
          },
        }}
      />,
    );

    expect(screen.getByText(demoProduct.name)).toBeTruthy();
    expect(screen.getAllByText(demoProduct.question)).toHaveLength(2);
    expect(screen.getByText('Shopper-supplied product page')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open source page ↗' }).getAttribute('href')).toBe(
      'https://catalog.example/demo-product',
    );
    expect(
      screen.getByText(
        /product page opened this exact evidence question without carrying private/i,
      ),
    ).toBeTruthy();
    expect(await screen.findByText('Human controls ready')).toBeTruthy();
  });

  it('keeps the search and filming handoff usable without native Site Tools', async () => {
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    expect(screen.getByText('Everyday insulated travel bottle')).toBeTruthy();
    expect(
      screen.getByRole('heading', {
        name: 'If the web cannot prove it, ask someone with the product to film it.',
      }),
    ).toBeTruthy();
    expect(await screen.findByText('Human controls ready')).toBeTruthy();
    expect(screen.getByText('Not enough proof')).toBeTruthy();
    expect(screen.getByText(/explicit confirmation to publish those fields/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Search existing evidence' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Create claim-specific filming mission' }),
    );
    expect(await screen.findByText('Put this exact mission on any phone.')).toBeTruthy();
    expect(screen.queryByText(/Replay a completed rights-clean mission/)).toBeNull();
  });

  it('reconciles the native tool frontier as evidence state changes', async () => {
    const modelContext = new RecordingModelContext();
    setModelContext(modelContext);
    render(<ProductEvidenceNetwork />);

    await waitFor(() => {
      expect(modelContext.activeToolNames()).toEqual([
        'inspect_product_evidence',
        'ask_product_question',
        'search_product_evidence',
      ]);
    });

    const inspectRegistration = modelContext.registrations.find(
      ({ tool }) => tool.name === 'inspect_product_evidence',
    );
    await modelContext
      .latestTool('search_product_evidence')
      .execute({}, { signal: new AbortController().signal });
    await waitFor(() => {
      expect(modelContext.activeToolNames()).toContain('create_filming_mission');
      expect(modelContext.activeToolNames()).not.toContain('search_product_evidence');
    });
    await modelContext.latestTool('create_filming_mission').execute(
      {
        instruction: 'Invert the filled bottle over dry paper for ten seconds.',
        successCriterion: 'Keep the closed lid and dry paper visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
      { signal: new AbortController().signal },
    );

    await waitFor(() => {
      expect(modelContext.activeToolNames()).not.toContain('create_filming_mission');
      expect(modelContext.activeToolNames()).toContain('refine_filming_mission');
      expect(screen.getByText('Put this exact mission on any phone.')).toBeTruthy();
    });
    expect(inspectRegistration?.signal?.aborted).toBe(false);
    expect(
      modelContext.registrations.filter(({ tool }) => tool.name === 'inspect_product_evidence'),
    ).toHaveLength(1);
  });

  it('opens an unseen product case without a product-specific code path', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({
          provider: 'scrapecreators',
          status: 'unavailable',
          query: 'USB-C lavalier microphone phone charge receiver connected recording',
          searchedPlatforms: [],
          warnings: ['Live social search is not configured on this deployment.'],
          leads: [],
        }),
      ),
    );
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.change(screen.getByLabelText('Product'), {
      target: { value: 'USB-C lavalier microphone' },
    });
    fireEvent.change(screen.getByLabelText('What do you need to know?'), {
      target: { value: 'Can the phone charge while the receiver is connected and recording?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open new evidence case' }));

    await waitFor(() => {
      expect(screen.getByText('USB-C lavalier microphone')).toBeTruthy();
      expect(
        screen.getAllByText('Can the phone charge while the receiver is connected and recording?'),
      ).toHaveLength(2);
    });
    expect(screen.getByText('No public source has been supplied for this case yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Search existing evidence' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Search existing evidence' }));

    expect(await screen.findByText('Live public search unavailable')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Create claim-specific filming mission' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Create claim-specific filming mission' }));

    expect(await screen.findByText('Put this exact mission on any phone.')).toBeTruthy();
    expect(screen.queryByText('Replay a completed rights-clean mission')).toBeNull();
  });

  it('revokes an open public request before resetting its private capability', async () => {
    const remoteState = applyEvidenceNetworkCommand(createDemoEvidenceNetworkState(), {
      kind: 'create-filming-mission',
      actor: 'human',
      input: {
        instruction: 'Invert the filled bottle over dry paper for ten seconds.',
        successCriterion: 'Keep the closed lid and paper visible throughout.',
        minimumSeconds: 10,
        continuousTakeRequired: true,
      },
    }).state;
    const mission = remoteState.activeCase?.mission;
    if (mission === null || mission === undefined) {
      throw new Error('Expected the test fixture to create a filming mission.');
    }
    const publicMission = {
      id: '123e4567-e89b-42d3-a456-426614174000',
      caseId: 'BCDF2345',
      productName: remoteState.activeCase?.product.name ?? 'Travel bottle',
      productUrl: remoteState.activeCase?.product.suppliedUrl ?? null,
      question: remoteState.activeCase?.question.text ?? 'Does it leak?',
      instruction: mission.instruction,
      successCriterion: mission.successCriterion,
      minimumSeconds: mission.minimumSeconds,
      continuousTakeRequired: mission.continuousTakeRequired,
      status: 'open' as const,
      createdAt: '2026-08-27T20:00:00.000Z',
      expiresAt: '2026-08-28T20:00:00.000Z',
      fulfilledAt: null,
    };
    remoteMocks.evidenceServiceUrl = 'https://evidence.example';
    remoteMocks.createRemoteEvidenceCase.mockResolvedValue({
      protocolVersion: remoteEvidenceProtocolVersion,
      caseId: publicMission.caseId,
      ownerToken: 'o'.repeat(43),
      contributorToken: 'c'.repeat(43),
      expiresAt: Date.now() + 60_000,
      state: remoteState,
    });
    remoteMocks.publishPublicEvidenceMission.mockResolvedValue(publicMission);
    remoteMocks.removePublicEvidenceMission.mockResolvedValue({
      ...publicMission,
      status: 'removed',
    });
    class QuietWebSocket extends EventTarget {
      close(): void {
        // The test exercises lifecycle cleanup without a remote broadcast.
      }
    }
    vi.stubGlobal('WebSocket', QuietWebSocket);
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.click(screen.getByRole('button', { name: 'Search existing evidence' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Create claim-specific filming mission' }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Create phone capture link' }));
    expect(await screen.findByText(/Private live case BCDF2345/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /I understand this product request will be public/i,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Publish open filming request' }));
    expect(await screen.findByText(/Anyone with this product can now record/)).toBeTruthy();

    remoteMocks.removePublicEvidenceMission.mockRejectedValueOnce(
      new Error('Evidence service temporarily unavailable.'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Reset proof loop' }));

    expect(await screen.findByText('Evidence service temporarily unavailable.')).toBeTruthy();
    expect(screen.getByText(/Private live case BCDF2345/)).toBeTruthy();
    expect(window.sessionStorage.length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Reset proof loop' }));

    await waitFor(() => {
      expect(remoteMocks.removePublicEvidenceMission).toHaveBeenCalledTimes(2);
      expect(remoteMocks.removePublicEvidenceMission).toHaveBeenLastCalledWith(
        'https://evidence.example',
        publicMission.id,
        { ownerToken: 'o'.repeat(43), confirmRemoval: true },
      );
      expect(window.sessionStorage.length).toBe(0);
    });
  });

  it('does not reuse the bottle fixture for a new case that happens to share its name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({
          provider: 'evidence_network',
          status: 'partial',
          query: 'Everyday insulated travel bottle handle heat test',
          searchedPlatforms: [],
          warnings: ['Live public providers are not configured.'],
          leads: [
            {
              platform: 'web',
              title: 'Supplied travel bottle page',
              url: 'https://shop.example/products/travel-bottle',
              summary: 'Supplied page; not treated as proof.',
              creatorLabel: 'Supplied page · shop.example',
            },
          ],
        }),
      ),
    );
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.change(screen.getByLabelText('Product'), {
      target: { value: 'Everyday insulated travel bottle' },
    });
    fireEvent.change(screen.getByLabelText(/Public product URL/), {
      target: { value: 'https://shop.example/products/travel-bottle' },
    });
    fireEvent.change(screen.getByLabelText('What do you need to know?'), {
      target: { value: 'Does the handle stay cool after ten minutes with hot liquid?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open new evidence case' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Search existing evidence' }));

    expect(await screen.findByText('Only the supplied product page is available')).toBeTruthy();
    expect(
      screen.getByText(/Supplied product page retained · 1 candidate source retained/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create claim-specific filming mission' }));

    expect(
      await screen.findAllByText(
        /Record one continuous take that visibly answers:.*handle stay cool/,
      ),
    ).toHaveLength(2);
    expect(
      screen.queryByText('Fill the bottle, close the lid, and hold it upside down over dry paper.'),
    ).toBeNull();
    expect(screen.queryByText('Replay a completed rights-clean mission')).toBeNull();
  });

  it('lets an ordinary-browser shopper refine the mission before creating its phone link', async () => {
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.click(screen.getByRole('button', { name: 'Search existing evidence' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Create claim-specific filming mission' }),
    );
    const originalPhrase = screen.getByText(/^[A-Z]+ [A-Z]+ [1-9][0-9]$/).textContent;
    if (originalPhrase === null) {
      throw new Error('Expected the open mission to expose a fresh-capture phrase.');
    }
    fireEvent.click(screen.getByText('Refine this mission before sharing'));
    fireEvent.change(screen.getByLabelText('Recording instruction'), {
      target: { value: 'Show the closed lid, then invert the bottle for twelve seconds.' },
    });
    fireEvent.change(screen.getByLabelText('Acceptance boundary'), {
      target: { value: 'Keep the lid seam and dry paper visible for the full inversion.' },
    });
    fireEvent.change(screen.getByLabelText('Minimum seconds'), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save refined mission' }));

    expect(
      await screen.findByText(
        'Filming mission refined. Its bounded fresh-capture phrase was preserved.',
      ),
    ).toBeTruthy();
    expect(
      screen.getAllByText('Show the closed lid, then invert the bottle for twelve seconds.'),
    ).toHaveLength(2);
    expect((screen.getByLabelText('Recording instruction') as HTMLTextAreaElement).value).toBe(
      'Show the closed lid, then invert the bottle for twelve seconds.',
    );
    expect(screen.getByText('refine filming mission')).toBeTruthy();
    expect(screen.getByText(originalPhrase)).toBeTruthy();
  });

  it('reuses reviewed network evidence without asking another person to film', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({
          provider: 'evidence_network',
          status: 'complete',
          query: 'Desk lamp brightness memory power loss',
          searchedPlatforms: [],
          warnings: [],
          leads: [],
          reviewedEvidence: [
            {
              id: 'prior-case:networkvideo00000001',
              productName: 'Desk lamp',
              productUrl: null,
              question: 'Does it remember its brightness after losing power?',
              source: {
                title: 'Contributor-recorded mission video',
                videoUrl: 'https://customer-demo.cloudflarestream.com/networkvideo00000001/watch',
                rights: 'owned',
                provenance: 'live_capture',
                continuity: 'continuous',
                captureTiming: 'mission_challenge_verified',
                contributorLabel: 'Lamp owner',
                capturedAt: '2026-08-27T19:00:00.000Z',
                streamUid: 'networkvideo00000001',
                sha256: 'a'.repeat(64),
                durationSeconds: 12,
              },
              observation: {
                result: 'supports',
                confidence: 'high',
                text: 'The lamp returned to the same brightness after the complete power cycle.',
                citationStartSeconds: 2,
                citationEndSeconds: 11,
                reviewedAt: '2026-08-27T19:01:00.000Z',
              },
              indexedAt: '2026-08-27T19:01:00.000Z',
              expiresAt: '2026-09-26T19:01:00.000Z',
            },
          ],
        }),
      ),
    );
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.change(screen.getByLabelText('Product'), {
      target: { value: 'Desk lamp' },
    });
    fireEvent.change(screen.getByLabelText('What do you need to know?'), {
      target: { value: 'Does it remember its brightness after losing power?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open new evidence case' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Search existing evidence' }));

    expect(await screen.findByText('1 reusable reviewed recording found')).toBeTruthy();
    expect(screen.getByText(/Cloudflare D1 reusable evidence/)).toBeTruthy();
    expect(screen.getByText('The evidence network already has a reviewed answer.')).toBeTruthy();
    expect(screen.getAllByText('Supported')).not.toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: 'Create claim-specific filming mission' }),
    ).toBeNull();
  });

  it('shows the concrete social and broad-web discovery receipt without promoting leads to proof', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({
          provider: 'evidence_network',
          status: 'complete',
          query: 'Desk lamp brightness memory after power loss',
          searchedPlatforms: ['youtube', 'web'],
          warnings: [],
          leads: [
            {
              platform: 'youtube',
              title: 'Desk lamp power-cycle video',
              url: 'https://www.youtube.com/watch?v=abc123',
              summary: 'Candidate only; the video has not been reviewed.',
              creatorLabel: 'YouTube · Test Lab',
            },
            {
              platform: 'web',
              title: 'Desk lamp owner report',
              url: 'https://reviews.example/desk-lamp',
              summary: 'Search excerpt only; the page has not been claim-reviewed.',
              creatorLabel: 'Open web · Exa via Vercel AI Gateway',
            },
          ],
        }),
      ),
    );
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.change(screen.getByLabelText('Product'), {
      target: { value: 'Desk lamp' },
    });
    fireEvent.change(screen.getByLabelText('What do you need to know?'), {
      target: { value: 'Does it remember its brightness after losing power?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open new evidence case' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Search existing evidence' }));

    expect(await screen.findByText(/ScrapeCreators \+ Exa through Vercel AI Gateway/)).toBeTruthy();
    expect(screen.getAllByText('inconclusive')).toHaveLength(2);
    expect(screen.getAllByText(/public leads never count as proof/)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Watch cited video ↗' }).getAttribute('href')).toBe(
      'https://www.youtube.com/watch?v=abc123',
    );
    expect(screen.getByRole('link', { name: 'Open source page ↗' }).getAttribute('href')).toBe(
      'https://reviews.example/desk-lamp',
    );
  });

  it('shows a Browser Run page receipt while keeping product copy non-decisive', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({
          provider: 'evidence_network',
          status: 'partial',
          query: 'Trail Flask leak-free upside down ten seconds',
          searchedPlatforms: ['web'],
          warnings: [
            'Live social search is not configured on this deployment.',
            'Broad web search through Vercel AI Gateway is not configured.',
          ],
          leads: [
            {
              platform: 'web',
              title: 'Trail Flask 24 oz · supplied product page',
              url: 'https://shop.example/products/trail-flask',
              summary:
                'Untrusted product-page excerpt read by Cloudflare Browser Run: “The product page claims a leak-resistant lid.” Page copy remains a lead, never proof.',
              creatorLabel: 'Product page · Cloudflare Browser Run',
            },
          ],
        }),
      ),
    );
    setModelContext(undefined);
    render(<ProductEvidenceNetwork />);

    fireEvent.change(screen.getByLabelText('Product'), {
      target: { value: 'Trail Flask 24 oz' },
    });
    fireEvent.change(screen.getByLabelText(/Public product URL/), {
      target: { value: 'https://shop.example/products/trail-flask' },
    });
    fireEvent.change(screen.getByLabelText('What do you need to know?'), {
      target: { value: 'Does it stay leak-free while upside down for ten seconds?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open new evidence case' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Search existing evidence' }));

    expect(await screen.findByText(/Cloudflare Browser Run read the supplied page/)).toBeTruthy();
    expect(screen.getByText(/Cloudflare Browser Run · 1 candidate source retained/)).toBeTruthy();
    expect(screen.getByText(/product page claims a leak-resistant lid/)).toBeTruthy();
    expect(screen.getByText(/low confidence · Product page · Cloudflare Browser Run/)).toBeTruthy();
    expect(screen.getAllByText('Not enough proof')).not.toHaveLength(0);
    expect(
      screen.getByRole('button', { name: 'Create claim-specific filming mission' }),
    ).toBeTruthy();
  });
});
