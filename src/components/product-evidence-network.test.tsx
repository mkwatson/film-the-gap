import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductEvidenceNetwork } from './product-evidence-network';

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
});

afterEach(() => {
  window.sessionStorage.clear();
  setModelContext(undefined);
  vi.unstubAllGlobals();
});

describe('ProductEvidenceNetwork', () => {
  it('keeps the complete evidence loop usable without native Site Tools', async () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'Create claim-specific filming mission' }));
    expect(await screen.findByText('Replay a completed rights-clean mission')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Replay: test passed' }));
    expect(await screen.findByText('Evidence changes answer')).toBeTruthy();
    expect(screen.getAllByText('Supported').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reviewed evidence published')).toBeTruthy();
  });

  it('reconciles the native tool frontier as evidence state changes', async () => {
    const modelContext = new RecordingModelContext();
    setModelContext(modelContext);
    render(<ProductEvidenceNetwork />);

    await waitFor(() => {
      expect(modelContext.activeToolNames()).toEqual([
        'inspect_product_evidence',
        'ask_product_question',
        'create_filming_mission',
      ]);
    });

    const inspectRegistration = modelContext.registrations.find(
      ({ tool }) => tool.name === 'inspect_product_evidence',
    );
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
      expect(screen.getByText('Replay a completed rights-clean mission')).toBeTruthy();
    });
    expect(inspectRegistration?.signal?.aborted).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Replay: test passed' }));

    await waitFor(() => {
      expect(modelContext.activeToolNames()).toContain('inspect_answer_change');
      expect(screen.getAllByText('Supported').length).toBeGreaterThanOrEqual(1);
    });
    expect(
      modelContext.registrations.filter(({ tool }) => tool.name === 'inspect_product_evidence'),
    ).toHaveLength(1);

    const result = await modelContext
      .latestTool('inspect_answer_change')
      .execute({}, { signal: new AbortController().signal });
    expect(result).toMatchObject({
      changed: true,
      before: { status: 'insufficient' },
      after: { status: 'supported' },
      decisiveEvidence: [{ timestamp: '00:00–00:10' }],
    });
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
      await screen.findByText(/Record one continuous take that visibly answers:.*handle stay cool/),
    ).toBeTruthy();
    expect(
      screen.queryByText('Fill the bottle, close the lid, and hold it upside down over dry paper.'),
    ).toBeNull();
    expect(screen.queryByText('Replay a completed rights-clean mission')).toBeNull();
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
});
