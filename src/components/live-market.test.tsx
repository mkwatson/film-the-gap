import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defaultBuyerMandate } from '@/lib/live-market/model';

import { LiveMarket } from './live-market';

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

afterEach(() => {
  setModelContext(undefined);
  vi.restoreAllMocks();
});

describe('LiveMarket', () => {
  it('keeps the complete human fallback usable in an ordinary browser', async () => {
    setModelContext(undefined);
    render(<LiveMarket />);

    expect(await screen.findByText('Browser fallback')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Share demo mandate' }));
    expect(screen.getByText('One fact still missing')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Request missing evidence' }));
    expect(screen.getByText('1 agent-directed request')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Show: no repair' }));
    expect(screen.getByText('Mandate satisfied')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hold this lot' }));
    expect(screen.getByText('Reversible hold active')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Release hold' }));
    expect(screen.getByText('10-minute hold unlocked')).toBeTruthy();
  });

  it('re-registers the native tool contract as live eligibility changes', async () => {
    const modelContext = new RecordingModelContext();
    setModelContext(modelContext);
    render(<LiveMarket />);

    await waitFor(() => {
      expect(modelContext.activeToolNames()).toEqual([
        'inspect_live_show',
        'set_buying_mandate',
        'inspect_current_lot',
      ]);
    });

    await modelContext
      .latestTool('set_buying_mandate')
      .execute(defaultBuyerMandate, { signal: new AbortController().signal });

    await waitFor(() => {
      expect(modelContext.activeToolNames()).toContain('request_host_evidence');
    });

    await modelContext
      .latestTool('request_host_evidence')
      .execute({ kind: 'repair_history' }, { signal: new AbortController().signal });

    await waitFor(() => {
      expect(modelContext.activeToolNames()).not.toContain('request_host_evidence');
      expect(screen.getByText('1 agent-directed request')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show: no repair' }));

    await waitFor(() => {
      expect(modelContext.activeToolNames()).toContain('reserve_current_lot');
    });

    await modelContext
      .latestTool('reserve_current_lot')
      .execute({}, { signal: new AbortController().signal });

    await waitFor(() => {
      expect(modelContext.activeToolNames()).not.toContain('reserve_current_lot');
      expect(modelContext.activeToolNames()).toContain('release_current_lot');
      expect(screen.getByText('Reversible hold active')).toBeTruthy();
    });
  });
});
