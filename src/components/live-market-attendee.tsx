'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';

import { createAttendeeSiteTools } from '@/lib/live-market/attendee-site-tools';
import { getEvidenceDemandSummary } from '@/lib/live-market/model';
import type { RoomCommand } from '@/lib/live-market/room-command';
import type { SiteToolRuntime } from '@/lib/live-market/site-tools';
import {
  configuredEvidenceRoomServiceUrl,
  useRemoteLiveRoom,
} from '@/lib/live-market/use-remote-live-room';
import { useSiteTools } from '@/lib/live-market/use-site-tools';

function connectionCopy(roomId: string | null, phase: string): string {
  if (roomId === null) {
    return 'Invite required';
  }
  if (phase === 'linked') {
    return 'Evidence room linked';
  }
  if (phase === 'waiting') {
    return 'Credential authenticated';
  }
  if (phase === 'checking') {
    return 'Opening room';
  }
  return 'Room unavailable';
}

export function LiveMarketAttendee(): React.JSX.Element {
  const room = useRemoteLiveRoom('attendee', configuredEvidenceRoomServiceUrl());
  const dispatchRoomCommand = room.dispatch;
  const readRoomState = room.readState;
  const [joined, setJoined] = useState(false);
  const joinedRef = useRef(false);
  const demand = getEvidenceDemandSummary(room.state, 'repair_history');
  const queued = room.state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );

  const readJoined = useCallback((): boolean => joinedRef.current, []);
  const readAuthorized = useCallback(
    (): boolean => room.roomId !== null && ['waiting', 'linked'].includes(room.connectionPhase),
    [room.connectionPhase, room.roomId],
  );
  const attendeeDispatch = useCallback(
    async (command: RoomCommand) => {
      const result = await dispatchRoomCommand(command);
      if (command.kind === 'join-evidence-demand' && result.ok) {
        joinedRef.current = true;
        setJoined(true);
      }
      return result;
    },
    [dispatchRoomCommand],
  );
  const siteToolRuntime = useMemo<SiteToolRuntime>(
    () => ({
      readState: readRoomState,
      dispatch: attendeeDispatch,
      readJoined,
      readAuthorized,
    }),
    [attendeeDispatch, readAuthorized, readJoined, readRoomState],
  );
  const availabilityKey = [
    room.roomId ?? 'no-room',
    demand.status,
    demand.fixtureAgentCount,
    room.connectionPhase,
    joined ? 'joined' : 'not-joined',
  ].join('|');
  const siteToolStatus = useSiteTools(siteToolRuntime, availabilityKey, createAttendeeSiteTools);
  const canJoin = room.roomId !== null && queued && demand.fixtureAgentCount > 0 && !joined;

  return (
    <main className="attendee-shell">
      <header className="topbar attendee-topbar">
        <div className="brand-lockup">
          <span className="brand-mark attendee-mark" aria-hidden="true">
            A
          </span>
          <span>
            <strong>Evidence attendee</strong>
            <small>One credential · one aggregate signal</small>
          </span>
        </div>
        <div className="topbar-actions">
          <span className={`room-pill room-${room.connectionPhase}`}>
            <span aria-hidden="true" />
            {connectionCopy(room.roomId, room.connectionPhase)}
          </span>
          {room.roomId === null ? null : (
            <span className="room-code">Room {room.roomId} · least authority</span>
          )}
          <span className={`runtime-pill runtime-${siteToolStatus.phase}`}>
            <span className="runtime-dot" aria-hidden="true" />
            {room.roomId === null
              ? 'No tools without invite'
              : siteToolStatus.phase === 'ready'
                ? `${siteToolStatus.registeredNames.length} Site Tools live`
                : siteToolStatus.phase === 'unsupported'
                  ? 'Human fallback'
                  : 'Connecting tools'}
          </span>
          <Link className="quiet-button quiet-link" href="/">
            Buyer view ↗
          </Link>
        </div>
      </header>

      <section className="attendee-hero" aria-labelledby="attendee-title">
        <p className="eyebrow">Authenticated test-agent session · evidence only</p>
        <h1 id="attendee-title">Add one private decision to one public question.</h1>
        <p>
          This temporary credential can join an existing product-evidence request. It cannot see why
          anyone needs the answer—and it has no authority over the host, hold, cart, or checkout.
        </p>
      </section>

      <section className="attendee-grid" aria-label="Evidence attendee experience">
        <article className="attendee-demand panel" aria-labelledby="shared-question-title">
          <div className="section-heading">
            <span>
              <small>Normalized public demand</small>
              <strong id="shared-question-title">
                {queued
                  ? 'One question is open'
                  : demand.status === 'resolved'
                    ? 'One answer reached the crowd'
                    : 'Waiting for the primary agent'}
              </strong>
            </span>
            <em>{demand.totalAgentCount} decisions</em>
          </div>

          {queued ? (
            <blockquote className="attendee-question">
              “Show the base and disclose whether it has ever been repaired.”
            </blockquote>
          ) : demand.status === 'resolved' ? (
            <div className="attendee-answer">
              <span aria-hidden="true">✓</span>
              <p>
                <strong>
                  Published answer: {room.state.lot.evidence.repairHistory.replaceAll('-', ' ')}
                </strong>
                {room.state.lot.evidence.repairEvidenceSource}
              </p>
            </div>
          ) : (
            <p className="empty-copy">
              The primary buyer agent must first share its product-only requirements and open the
              missing-evidence request.
            </p>
          )}

          <div className="attendee-counts" aria-label="Evidence crowd composition">
            <span>
              <small>Live sessions</small>
              <strong>{demand.liveAgentCount}</strong>
            </span>
            <span>
              <small>Fixture signals left</small>
              <strong>{demand.fixtureAgentCount}</strong>
            </span>
            <span>
              <small>Total decisions</small>
              <strong>{demand.totalAgentCount}</strong>
            </span>
          </div>

          <button
            className="primary-button attendee-join"
            type="button"
            disabled={!canJoin}
            onClick={() => void attendeeDispatch({ kind: 'join-evidence-demand' })}
          >
            {joined
              ? 'Joined with this credential ✓'
              : demand.fixtureAgentCount === 0
                ? 'All seven attendee slots are live'
                : queued
                  ? 'Replace one fixture with this live session'
                  : 'Waiting for an open request'}
          </button>
          <p className="result-message" role="status" aria-live="polite">
            {room.lastMessage}
          </p>
        </article>

        <aside className="attendee-boundary panel" aria-labelledby="attendee-boundary-title">
          <div className="section-heading">
            <span>
              <small>Capability boundary</small>
              <strong id="attendee-boundary-title">What this credential can do</strong>
            </span>
            <em>2 tools max</em>
          </div>
          <ul className="attendee-authority-list">
            <li className="authority-allowed">
              <span aria-hidden="true">✓</span>
              Inspect this shared evidence question and its aggregate status
            </li>
            <li className="authority-allowed">
              <span aria-hidden="true">✓</span>
              Join once, replacing one deterministic fixture signal
            </li>
            <li>
              <span aria-hidden="true">×</span>
              No buyer context, profile, reason, urgency, or price ceiling
            </li>
            <li>
              <span aria-hidden="true">×</span>
              No host answer, reset, hold, UCP cart, checkout, or payment authority
            </li>
          </ul>
          <div className="attendee-tools">
            <small>Page-owned contract available now</small>
            {siteToolStatus.registeredNames.length === 0 ? (
              <code>Human controls only</code>
            ) : (
              siteToolStatus.registeredNames.map((name) => <code key={name}>{name}</code>)
            )}
          </div>
          <p className="contract-note">
            The bearer fragment was moved into session storage and scrubbed from the address bar
            before this room connected.
          </p>
        </aside>
      </section>
    </main>
  );
}
