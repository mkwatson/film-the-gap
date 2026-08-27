'use client';

import Link from 'next/link';

import { HostCameraCapture } from '@/components/host-camera-capture';
import { getAllInPrice, getEvidenceDemandSummary } from '@/lib/live-market/model';
import { useLiveRoom, type RoomConnectionPhase } from '@/lib/live-market/use-live-room';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function connectionCopy(phase: RoomConnectionPhase): string {
  if (phase === 'linked') {
    return 'Buyer view linked';
  }
  if (phase === 'waiting') {
    return 'Listening for buyer view';
  }
  if (phase === 'solo') {
    return 'Local host preview';
  }
  return 'Opening room';
}

function actorLabel(actor: string): string {
  if (actor === 'agent') {
    return 'ChatGPT';
  }
  return actor.charAt(0).toUpperCase() + actor.slice(1);
}

export function LiveMarketHost(): React.JSX.Element {
  const { state, lastMessage, connectionPhase, transport, roomId, resetDemo, dispatch } =
    useLiveRoom('host');
  const demand = getEvidenceDemandSummary(state, 'repair_history');
  const queuedRepairRequest = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );
  const recentActivity = [...state.activity].reverse().slice(0, 6);

  return (
    <main className="host-shell">
      <header className="topbar host-topbar">
        <div className="brand-lockup" aria-label="Live market host console">
          <span className="brand-mark host-mark" aria-hidden="true">
            H
          </span>
          <span>
            <strong>Host evidence console</strong>
            <small>Public demand · private buyers</small>
          </span>
        </div>
        <div className="topbar-actions">
          <span className={`room-pill room-${connectionPhase}`}>
            <span aria-hidden="true" />
            {connectionCopy(connectionPhase)}
          </span>
          {transport === 'remote' && roomId !== null ? (
            <span className="room-code">Room {roomId} · authoritative</span>
          ) : null}
          <Link className="quiet-button quiet-link" href="/">
            Buyer view ↗
          </Link>
          <button className="quiet-button" type="button" onClick={resetDemo}>
            Reset room
          </button>
        </div>
      </header>

      <section className="host-hero" aria-labelledby="host-title">
        <p className="eyebrow">Agent-directed evidence · host-controlled camera</p>
        <h1 id="host-title">One useful answer can unblock a private crowd.</h1>
        <p>
          The host sees the product fact that people need—not their profiles, urgency, choices, or
          maximum prices.
        </p>
      </section>

      <section className="host-experience-grid" aria-label="Synchronized host experience">
        <article className="host-stream panel">
          <div className="stream-heading">
            <div>
              <span className="live-label">
                <span aria-hidden="true" /> Live · host camera
              </span>
              <h2>{state.lot.title}</h2>
              <p>
                {state.lot.lengthCm} cm · exact public quote {usd.format(getAllInPrice(state.lot))}
              </p>
            </div>
            <span className="host-live-chip">184 watching</span>
          </div>

          <div className="video-stage host-video-stage" aria-label="Simulated host camera preview">
            <div className="camera-grid" aria-hidden="true" />
            <div className="board-shadow" aria-hidden="true" />
            <div className="snowboard" aria-hidden="true">
              <span className="binding binding-top" />
              <span className="binding binding-bottom" />
            </div>
            <div className="camera-reticle" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="host-caption">
              <span>Camera ready</span>
              Frame the exact surface the agents request.
            </div>
          </div>
        </article>

        <article
          className={`host-demand panel ${queuedRepairRequest ? 'host-demand-active' : ''}`}
          aria-labelledby="host-demand-title"
        >
          <div className="host-demand-heading">
            <span className="queue-icon" aria-hidden="true">
              ↗
            </span>
            <span>
              <small>Normalized audience demand</small>
              <strong id="host-demand-title">
                {queuedRepairRequest
                  ? `${demand.totalAgentCount} private decisions need one fact`
                  : demand.status === 'resolved'
                    ? `${demand.totalAgentCount} decisions updated`
                    : 'Waiting for a decision-relevant question'}
              </strong>
            </span>
          </div>

          {queuedRepairRequest ? (
            <div className="host-request-card">
              <span className="aggregate-badge">
                {demand.totalAgentCount} agents · one normalized request
              </span>
              <blockquote>
                “Show the base and disclose whether it has ever been repaired.”
              </blockquote>
              <p>
                Answer from the camera. The same public fact will update every attending private
                decision without revealing why each person needs it.
              </p>
              <HostCameraCapture
                onPublish={(repairHistory, evidenceFrame, visualReview, publicEvidenceImage) =>
                  void dispatch({
                    kind: 'answer-repair-history',
                    repairHistory,
                    evidenceFrame,
                    visualReview,
                    publicEvidenceImage,
                  })
                }
              />
              <div className="fixture-fallback-heading">
                <span>Permission-free fallback</span>
                <small>Deterministic, judge-safe path</small>
              </div>
              <div className="host-response-grid" aria-label="Host evidence response controls">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    void dispatch({ kind: 'answer-repair-history', repairHistory: 'none' })
                  }
                >
                  Show base · no repair
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() =>
                    void dispatch({ kind: 'answer-repair-history', repairHistory: 'repaired' })
                  }
                >
                  Show repaired area
                </button>
              </div>
            </div>
          ) : demand.status === 'resolved' ? (
            <div className="host-resolution">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>One camera answer → {demand.totalAgentCount} private decisions</strong>
                <p>{state.lot.evidence.repairEvidenceSource}</p>
                {state.lot.evidence.repairEvidenceFrame !== null ? (
                  <code>
                    {state.lot.evidence.repairEvidenceFrame.kind} ·{' '}
                    {state.lot.evidence.repairEvidenceFrame.sha256?.slice(0, 16) ??
                      `offset ${state.lot.evidence.repairEvidenceFrame.showOffsetSeconds}s`}
                  </code>
                ) : null}
                {state.lot.evidence.visualReview !== null ? (
                  <code>
                    {state.lot.evidence.visualReview.source} · host{' '}
                    {state.lot.evidence.visualReview.hostDecision}
                  </code>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="host-waiting">
              <span aria-hidden="true">◎</span>
              <div>
                <strong>No individual buyer questions to triage</strong>
                <p>
                  Seven anonymous demo agents currently need repair history. The attending buyer’s
                  agent can join that evidence kind without sending its private reason.
                </p>
              </div>
            </div>
          )}

          <p className="result-message host-result" role="status" aria-live="polite">
            {lastMessage}
          </p>
        </article>

        <aside className="host-context panel" aria-label="Host privacy receipt and activity">
          <section className="host-privacy" aria-labelledby="host-privacy-title">
            <div className="section-heading">
              <span>
                <small>Seller boundary</small>
                <strong id="host-privacy-title">What reached this room</strong>
              </span>
              <em>{state.evidenceRequirements === null ? '0 fields' : '4 fields'}</em>
            </div>
            <dl>
              <div>
                <dt>Evidence kind</dt>
                <dd>Repair history</dd>
              </div>
              <div>
                <dt>Aggregate demand</dt>
                <dd>{demand.totalAgentCount} agents</dd>
              </div>
              <div>
                <dt>Length envelope</dt>
                <dd>
                  {state.evidenceRequirements === null
                    ? 'Not shared yet'
                    : `${state.evidenceRequirements.minLengthCm}–${state.evidenceRequirements.maxLengthCm} cm`}
                </dd>
              </div>
            </dl>
            <div className="host-not-collected">
              <strong>Never sent to the host</strong>
              <ul>
                <li>Maximum price or budget</li>
                <li>Buyer identity or profile</li>
                <li>Urgency or preference weights</li>
                <li>Individual purchase decision</li>
              </ul>
            </div>
          </section>

          <section className="host-activity" aria-labelledby="host-activity-title">
            <div className="section-heading">
              <span>
                <small>Shared room history</small>
                <strong id="host-activity-title">Visible activity</strong>
              </span>
            </div>
            <ol className="activity-list host-activity-list">
              {recentActivity.map((event) => (
                <li key={event.id}>
                  <span className={`actor actor-${event.actor}`}>{actorLabel(event.actor)}</span>
                  <div>
                    <strong>{event.action.replaceAll('_', ' ')}</strong>
                    <p>{event.summary}</p>
                  </div>
                  <small>#{event.id.toString().padStart(2, '0')}</small>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </section>
    </main>
  );
}
