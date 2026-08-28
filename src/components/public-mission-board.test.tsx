import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PublicMissionBoard } from './public-mission-board';

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
    if (registration === undefined) throw new Error(`Expected an active ${name} tool.`);
    return registration.tool;
  }
}

const mission = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  caseId: 'BCDF2345',
  productName: 'USB-C lavalier microphone',
  productUrl: 'https://shop.example/lavalier-mic',
  question: 'Can the phone charge while the receiver is connected and recording?',
  instruction: 'Record the receiver while the phone charges and captures audio.',
  successCriterion: 'Keep the charging indicator and recording state visible.',
  minimumSeconds: 10,
  continuousTakeRequired: true,
  status: 'open',
  createdAt: '2026-08-27T16:00:00.000Z',
  expiresAt: '2026-08-28T16:00:00.000Z',
  fulfilledAt: null,
} as const;

const publicContributorToken = 'p'.repeat(43);

function setModelContext(modelContext: WebMCP.ModelContext | undefined): void {
  Object.defineProperty(document, 'modelContext', { configurable: true, value: modelContext });
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_EVIDENCE_ROOM_URL', 'https://evidence.example');
});

afterEach(() => {
  setModelContext(undefined);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PublicMissionBoard', () => {
  it('mirrors the public request and bounded phone handoff for humans', async () => {
    setModelContext(undefined);
    const evidenceFetch = vi.fn(async (input: string | URL | Request): Promise<Response> => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.endsWith('/claim')) {
        return Response.json({ mission, contributorToken: publicContributorToken });
      }
      return Response.json({ missions: [mission] });
    });
    vi.stubGlobal('fetch', evidenceFetch);

    render(<PublicMissionBoard />);

    expect(await screen.findByText(mission.productName)).toBeTruthy();
    expect(screen.getByText(`“${mission.question}”`)).toBeTruthy();
    expect(screen.getByText(/shopper.?s identity/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I have this product' }));

    const recorder = await screen.findByRole('link', { name: 'Open on this device →' });
    expect(recorder.getAttribute('href')).toBe(
      `${window.location.origin}/contribute/${mission.caseId}#token=${publicContributorToken}`,
    );
    expect(evidenceFetch).toHaveBeenCalledTimes(2);
  });

  it('gives WebMCP a public-only listing and an exact mission opener', async () => {
    const modelContext = new RecordingModelContext();
    setModelContext(modelContext);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request): Promise<Response> => {
        const url = new URL(input instanceof Request ? input.url : input);
        return url.pathname.endsWith('/claim')
          ? Response.json({ mission, contributorToken: publicContributorToken })
          : Response.json({ missions: [mission] });
      }),
    );

    render(<PublicMissionBoard />);
    await screen.findByText(mission.productName);
    await waitFor(() => {
      expect(modelContext.latestTool('inspect_open_filming_missions')).toBeTruthy();
      expect(modelContext.latestTool('open_filming_mission')).toBeTruthy();
    });

    const inspected = await modelContext
      .latestTool('inspect_open_filming_missions')
      .execute({}, { signal: new AbortController().signal });
    const serialized = JSON.stringify(inspected);
    expect(serialized).toContain(mission.question);
    expect(serialized).not.toMatch(/ownerToken|contributorToken/i);
    expect(inspected).toMatchObject({
      missions: [{ missionId: mission.id, product: mission.productName }],
      privacyReceipt: { excluded: expect.stringContaining('budget') },
    });
    expect(serialized.length).toBeLessThanOrEqual(1_500);

    const opened = await modelContext
      .latestTool('open_filming_mission')
      .execute({ missionId: mission.id }, { signal: new AbortController().signal });
    expect(opened).toMatchObject({
      ok: true,
      contributorUrl: `${window.location.origin}/contribute/${mission.caseId}#token=${publicContributorToken}`,
    });
    expect(JSON.stringify(opened).length).toBeLessThanOrEqual(1_500);
  });

  it('filters a larger board and returns only compact mission summaries', async () => {
    const modelContext = new RecordingModelContext();
    setModelContext(modelContext);
    const otherMissions = [
      {
        ...mission,
        id: '123e4567-e89b-42d3-a456-426614174001',
        productName: 'Rechargeable desk lamp',
        question: 'Does it restore the previous brightness after power is removed?',
      },
      {
        ...mission,
        id: '123e4567-e89b-42d3-a456-426614174002',
        productName: 'Countertop coffee grinder',
        question: 'How much grounds retention remains after one measured dose?',
      },
      {
        ...mission,
        id: '123e4567-e89b-42d3-a456-426614174003',
        productName: 'Portable charging bank',
        question: 'Can it charge two phones continuously at the advertised output?',
      },
    ] as const;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Response> =>
        Response.json({ missions: [mission, ...otherMissions] }),
      ),
    );

    render(<PublicMissionBoard />);
    await screen.findByText(mission.productName);
    await waitFor(() => {
      expect(modelContext.latestTool('inspect_open_filming_missions')).toBeTruthy();
    });
    const inspectTool = modelContext.latestTool('inspect_open_filming_missions');
    const unfiltered = await inspectTool.execute({}, { signal: new AbortController().signal });
    const filtered = await inspectTool.execute(
      { query: 'lavalier' },
      { signal: new AbortController().signal },
    );

    expect(unfiltered).toMatchObject({
      totalOpen: 4,
      totalMatching: 4,
      moreMatching: true,
      missions: [{ missionId: mission.id }, {}, {}],
    });
    expect(JSON.stringify(unfiltered).length).toBeLessThanOrEqual(1_500);
    expect(filtered).toMatchObject({
      totalOpen: 4,
      totalMatching: 1,
      moreMatching: false,
      missions: [{ missionId: mission.id }],
    });
    await expect(
      inspectTool.execute({ query: 'x' }, { signal: new AbortController().signal }),
    ).resolves.toMatchObject({ ok: false, error: 'invalid_input' });
  });
});
