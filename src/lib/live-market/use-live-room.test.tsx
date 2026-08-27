import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  defaultEvidenceRequirements,
  evaluateEvidence,
  getAvailableToolNames,
  getEvidenceDemandSummary,
} from './model';
import { type RoomRole } from './room-sync';
import { useLiveRoom } from './use-live-room';

class FakeBroadcastChannel {
  static readonly sentMessages: unknown[] = [];
  static readonly channels = new Map<string, Set<FakeBroadcastChannel>>();

  readonly name: string;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    const peers = FakeBroadcastChannel.channels.get(name) ?? new Set<FakeBroadcastChannel>();
    peers.add(this);
    FakeBroadcastChannel.channels.set(name, peers);
  }

  postMessage(message: unknown): void {
    const clonedMessage: unknown = structuredClone(message);
    FakeBroadcastChannel.sentMessages.push(clonedMessage);
    for (const peer of FakeBroadcastChannel.channels.get(this.name) ?? []) {
      if (peer === this) {
        continue;
      }
      queueMicrotask(() => {
        peer.onmessage?.(new MessageEvent('message', { data: structuredClone(message) }));
      });
    }
  }

  close(): void {
    FakeBroadcastChannel.channels.get(this.name)?.delete(this);
    this.onmessage = null;
  }

  static reset(): void {
    FakeBroadcastChannel.sentMessages.length = 0;
    FakeBroadcastChannel.channels.clear();
  }
}

interface RoomProbeProps {
  readonly role: RoomRole;
}

function containsNumericValue(value: unknown, target: number): boolean {
  if (typeof value === 'number') {
    return value === target;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsNumericValue(item, target));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((item) => containsNumericValue(item, target));
  }
  return false;
}

function RoomProbe({ role }: RoomProbeProps): React.JSX.Element {
  const { state, connectionPhase, resetDemo, dispatch } = useLiveRoom(role);
  const demand = getEvidenceDemandSummary(state, 'repair_history');
  const outcome = evaluateEvidence(state).outcome;

  return (
    <section aria-label={`${role} room probe`}>
      <output>{connectionPhase}</output>
      <p>{state.evidenceRequirements === null ? 'requirements absent' : 'requirements shared'}</p>
      <p>{`${demand.totalAgentCount} ${demand.status}`}</p>
      <p>{outcome}</p>
      <p>{getAvailableToolNames(state).join(',')}</p>
      {role === 'buyer' ? (
        <>
          <button
            type="button"
            onClick={() =>
              void dispatch({
                kind: 'set-evidence-requirements',
                actor: 'agent',
                requirements: defaultEvidenceRequirements,
              })
            }
          >
            Buyer shares requirements
          </button>
          <button
            type="button"
            onClick={() => void dispatch({ kind: 'request-repair-history', actor: 'agent' })}
          >
            Buyer requests evidence
          </button>
          <button type="button" onClick={resetDemo}>
            Buyer resets room
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => void dispatch({ kind: 'answer-repair-history', repairHistory: 'none' })}
        >
          Host answers evidence
        </button>
      )}
    </section>
  );
}

beforeEach(() => {
  FakeBroadcastChannel.reset();
  vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
});

afterEach(() => {
  vi.unstubAllGlobals();
  FakeBroadcastChannel.reset();
});

describe('useLiveRoom', () => {
  it('recovers a late host view and propagates request, answer, dynamic capability, and reset', async () => {
    const { rerender } = render(<RoomProbe key="buyer" role="buyer" />);
    const buyer = within(screen.getByRole('region', { name: 'buyer room probe' }));

    fireEvent.click(buyer.getByRole('button', { name: 'Buyer shares requirements' }));
    fireEvent.click(buyer.getByRole('button', { name: 'Buyer requests evidence' }));
    expect(buyer.getByText('8 queued')).toBeTruthy();

    rerender(
      <>
        <RoomProbe key="buyer" role="buyer" />
        <RoomProbe key="host" role="host" />
      </>,
    );

    const host = within(screen.getByRole('region', { name: 'host room probe' }));
    await waitFor(() => {
      expect(host.getByText('linked')).toBeTruthy();
      expect(host.getByText('requirements shared')).toBeTruthy();
      expect(host.getByText('8 queued')).toBeTruthy();
    });

    fireEvent.click(host.getByRole('button', { name: 'Host answers evidence' }));

    await waitFor(() => {
      expect(buyer.getByText('ready')).toBeTruthy();
      expect(buyer.getByText(/reserve_current_lot/)).toBeTruthy();
      expect(host.getByText('8 resolved')).toBeTruthy();
    });

    const serializedMessages = JSON.stringify(FakeBroadcastChannel.sentMessages);
    expect(serializedMessages).not.toContain('maxAllInPrice');
    expect(serializedMessages).not.toContain('buyerProfile');
    expect(containsNumericValue(FakeBroadcastChannel.sentMessages, 450)).toBe(false);

    fireEvent.click(buyer.getByRole('button', { name: 'Buyer resets room' }));
    await waitFor(() => {
      expect(host.getByText('requirements absent')).toBeTruthy();
      expect(host.getByText('7 open')).toBeTruthy();
    });
  });
});
