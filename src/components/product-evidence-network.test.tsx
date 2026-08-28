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
      screen.getByRole('heading', { name: 'If the web cannot prove it, ask the product.' }),
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

    expect(await screen.findByText('Live social search unavailable')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Create claim-specific filming mission' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Create claim-specific filming mission' }));

    expect(await screen.findByText('Put this exact mission on any phone.')).toBeTruthy();
    expect(screen.queryByText('Replay a completed rights-clean mission')).toBeNull();
  });
});
