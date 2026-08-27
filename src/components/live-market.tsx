'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { historicalEvidenceLimitation } from '@/lib/live-market/evidence-proposal';

import {
  defaultEvidenceRequirements,
  evaluateEvidence,
  getActionFrontier,
  getAllInPrice,
  getAvailableToolNames,
  getEvidenceDemandSummary,
  type EvidenceStatus,
} from '@/lib/live-market/model';
import { type SiteToolRuntime } from '@/lib/live-market/site-tools';
import { useLiveRoom, type RoomConnectionPhase } from '@/lib/live-market/use-live-room';
import { useSiteTools } from '@/lib/live-market/use-site-tools';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const statusCopy: Readonly<Record<EvidenceStatus, string>> = {
  supported: 'Supported',
  unresolved: 'Needs evidence',
  violated: 'Does not qualify',
};

function actorLabel(actor: string): string {
  if (actor === 'agent') {
    return 'ChatGPT';
  }
  return actor.charAt(0).toUpperCase() + actor.slice(1);
}

function roomConnectionCopy(phase: RoomConnectionPhase): string {
  if (phase === 'linked') {
    return 'Host linked';
  }
  if (phase === 'waiting') {
    return 'Waiting for host';
  }
  if (phase === 'solo') {
    return 'Single-screen mode';
  }
  return 'Connecting room';
}

export function LiveMarket(): React.JSX.Element {
  const {
    state,
    lastMessage,
    connectionPhase,
    transport,
    roomId,
    hostInviteUrl,
    presence,
    readState,
    resetDemo,
    dispatch,
  } = useLiveRoom('buyer');
  const [inviteCopied, setInviteCopied] = useState(false);
  const siteToolRuntime = useMemo<SiteToolRuntime>(
    () => ({ readState, dispatch }),
    [dispatch, readState],
  );
  const availableToolNames = getAvailableToolNames(state);
  const availabilityKey = availableToolNames.join('|');
  const siteToolStatus = useSiteTools(siteToolRuntime, availabilityKey);
  const evaluation = evaluateEvidence(state);
  const frontier = getActionFrontier(state);
  const demand = getEvidenceDemandSummary(state, 'repair_history');
  const allInPrice = getAllInPrice(state.lot);
  const queuedRepairRequest = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );

  async function copyHostInvite(): Promise<void> {
    if (hostInviteUrl === null || navigator.clipboard === undefined) {
      return;
    }
    try {
      await navigator.clipboard.writeText(hostInviteUrl);
      setInviteCopied(true);
    } catch {
      setInviteCopied(false);
    }
  }

  const evaluationTitle =
    evaluation.outcome === 'no-requirements'
      ? 'Private context intact'
      : evaluation.outcome === 'unresolved'
        ? 'One fact still missing'
        : evaluation.outcome === 'ready'
          ? 'Public evidence ready'
          : 'Evidence conflicts';

  return (
    <main className="market-shell">
      <header className="topbar">
        <div className="brand-lockup" aria-label="Agent-attended market prototype">
          <span className="brand-mark" aria-hidden="true">
            WM
          </span>
          <span>
            <strong>Agent-attended market</strong>
            <small>Privacy membrane · working rung</small>
          </span>
        </div>
        <div className="topbar-actions">
          <span className={`room-pill room-${connectionPhase}`}>
            <span aria-hidden="true" />
            {roomConnectionCopy(connectionPhase)}
          </span>
          {transport === 'remote' && roomId !== null ? (
            <span className="room-code" title="Temporary Cloudflare evidence room">
              Room {roomId} · {presence.host > 0 ? 'phone online' : 'invite phone'}
            </span>
          ) : null}
          <span className={`runtime-pill runtime-${siteToolStatus.phase}`}>
            <span className="runtime-dot" aria-hidden="true" />
            {siteToolStatus.phase === 'ready'
              ? 'Site Tools live'
              : siteToolStatus.phase === 'unsupported'
                ? 'Browser fallback'
                : siteToolStatus.phase === 'error'
                  ? 'Tools need attention'
                  : 'Connecting tools'}
          </span>
          {hostInviteUrl !== null ? (
            <button
              className="quiet-button invite-button"
              type="button"
              onClick={() => void copyHostInvite()}
            >
              {inviteCopied ? 'Invite copied ✓' : 'Copy phone invite'}
            </button>
          ) : null}
          {hostInviteUrl === null ? (
            <Link className="quiet-button quiet-link" href="/host" target="_blank" rel="noreferrer">
              Open host view ↗
            </Link>
          ) : (
            <a
              className="quiet-button quiet-link invite-button"
              href={hostInviteUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open phone host ↗
            </a>
          )}
          <button className="quiet-button" type="button" onClick={resetDemo}>
            Reset demo
          </button>
        </div>
      </header>

      <section className="hero-copy" aria-labelledby="page-title">
        <p className="eyebrow">Private intent · public proof</p>
        <h1 id="page-title">The market learns what to show—not what you’ll pay.</h1>
        <p>
          ChatGPT keeps the buyer’s ceiling and wider context, shares only product-evidence needs,
          and asks one human camera answer to serve a private crowd.
        </p>
      </section>

      <section className="experience-grid" aria-label="Live market collaboration">
        <article className="stream-panel panel">
          <div className="stream-heading">
            <div>
              <span className="live-label">
                <span aria-hidden="true" /> Live · lot 07
              </span>
              <h2>{state.lot.title}</h2>
              <p>{state.lot.subtitle}</p>
            </div>
            <div className="countdown" aria-label="Lot closes in 72 seconds">
              <small>closes in</small>
              <strong>01:12</strong>
            </div>
          </div>

          <div className="video-stage" aria-label="Simulated rights-clear live snowboard video">
            <div className="mountain mountain-back" aria-hidden="true" />
            <div className="mountain mountain-front" aria-hidden="true" />
            <div className="board-shadow" aria-hidden="true" />
            <div className="snowboard" aria-hidden="true">
              <span className="binding binding-top" />
              <span className="binding binding-bottom" />
            </div>
            <div className="host-caption">
              <span>Host</span>
              “Edges are clean. Ask me for any angle you need.”
            </div>
            <div className="viewer-count">● deterministic demo room · 184 watching</div>
          </div>

          <div className="price-strip">
            <span>
              <small>Current bid</small>
              <strong>{usd.format(state.lot.currentBid)}</strong>
            </span>
            <span>
              <small>Shipping</small>
              <strong>{usd.format(state.lot.shipping)}</strong>
            </span>
            <span className="all-in-price">
              <small>Exact quote now</small>
              <strong>{usd.format(allInPrice)}</strong>
            </span>
          </div>

          <div
            className={`host-queue ${queuedRepairRequest ? 'queue-active' : ''} ${demand.status === 'resolved' ? 'queue-resolved' : ''}`}
          >
            <div className="queue-title">
              <span className="queue-icon" aria-hidden="true">
                ↗
              </span>
              <span>
                <strong>Private-crowd evidence queue</strong>
                <small>
                  {demand.status === 'resolved'
                    ? `${demand.totalAgentCount} decisions updated`
                    : queuedRepairRequest
                      ? `${demand.totalAgentCount} private agents waiting`
                      : `${demand.anonymousAgentCount} anonymous demo signals`}
                </small>
              </span>
            </div>
            {queuedRepairRequest ? (
              <div className="queue-request">
                <span className="aggregate-badge">
                  {demand.totalAgentCount} decisions · one camera answer
                </span>
                <p>Show the base and disclose whether it has ever been repaired.</p>
                {transport === 'local' ? (
                  <div className="host-controls" aria-label="Deterministic host response controls">
                    <small>Single-screen fallback</small>
                    <button
                      type="button"
                      onClick={() =>
                        void dispatch({ kind: 'answer-repair-history', repairHistory: 'none' })
                      }
                    >
                      Show: no repair
                    </button>
                    <button
                      className="danger-button"
                      type="button"
                      onClick={() =>
                        void dispatch({ kind: 'answer-repair-history', repairHistory: 'repaired' })
                      }
                    >
                      Disclose repair
                    </button>
                  </div>
                ) : (
                  <div className="host-controls remote-host-waiting">
                    <small>Separate seller surface</small>
                    <strong>
                      {presence.host > 0
                        ? 'The phone host is reviewing this request.'
                        : 'Open the private invite on the seller phone.'}
                    </strong>
                  </div>
                )}
              </div>
            ) : demand.status === 'resolved' ? (
              <div className="multicast-result">
                <strong>One answer → {demand.totalAgentCount} private decisions</strong>
                <p>
                  {state.lot.evidence.repairEvidenceFrame?.kind === 'camera-keyframe'
                    ? `Camera keyframe ${state.lot.evidence.repairEvidenceFrame.frameId} was fingerprinted, reviewed, and intentionally published.`
                    : 'The fixture recorded one host source frame.'}{' '}
                  No profile, private ceiling, or live camera feed crossed the boundary.
                </p>
              </div>
            ) : (
              <p className="empty-copy">
                Seven anonymous demo-room agents need the same normalized fact. Their profiles,
                ceilings, and individual choices are not collected.
              </p>
            )}
          </div>
        </article>

        <article className="decision-panel panel" aria-labelledby="decision-title">
          <div className="panel-kicker">
            <span>Buyer decision</span>
            <span className={`outcome-tag outcome-${evaluation.outcome}`}>{evaluationTitle}</span>
          </div>
          <h2 id="decision-title">Public proof, private decision</h2>
          <p className="panel-intro">
            The seller sees only product facts it can help establish. Maximum price, urgency, and
            the wider conversation stay with ChatGPT.
          </p>

          <section className="mandate-card" aria-labelledby="requirements-title">
            <div className="section-heading">
              <span>
                <small>01</small>
                <strong id="requirements-title">Seller-visible evidence envelope</strong>
              </span>
              {state.evidenceRequirements === null ? <em>Empty</em> : <em>4 fields</em>}
            </div>
            {state.evidenceRequirements === null ? (
              <div className="empty-mandate">
                <p>Share what the product must prove—not what the buyer can afford.</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    void dispatch({
                      kind: 'set-evidence-requirements',
                      actor: 'buyer',
                      requirements: defaultEvidenceRequirements,
                    })
                  }
                >
                  Share demo evidence needs
                </button>
              </div>
            ) : (
              <>
                <dl className="mandate-grid">
                  <div>
                    <dt>Length</dt>
                    <dd>
                      {state.evidenceRequirements.minLengthCm}-
                      {state.evidenceRequirements.maxLengthCm} cm
                    </dd>
                  </div>
                  <div>
                    <dt>Edge proof</dt>
                    <dd>
                      {state.evidenceRequirements.requireVisibleEdgeEvidence
                        ? 'Required'
                        : 'Optional'}
                    </dd>
                  </div>
                  <div>
                    <dt>Prior repair</dt>
                    <dd>
                      {state.evidenceRequirements.forbidPriorBaseRepair ? 'Forbidden' : 'Allowed'}
                    </dd>
                  </div>
                  <div className="private-field">
                    <dt>Maximum price</dt>
                    <dd>Stays private</dd>
                  </div>
                </dl>
                <div className="privacy-receipt">
                  <span aria-hidden="true">◉</span>
                  <p>
                    <strong>Privacy receipt</strong>
                    The market received four product fields and no buyer profile or numeric ceiling.
                    This minimizes disclosure; it does not claim zero inference.
                  </p>
                </div>
              </>
            )}
          </section>

          <section className="evidence-card" aria-labelledby="evidence-title">
            <div className="section-heading">
              <span>
                <small>02</small>
                <strong id="evidence-title">Public evidence</strong>
              </span>
              {evaluation.conditions.length > 0 ? (
                <em>
                  {evaluation.conditions.filter(({ status }) => status === 'supported').length}/
                  {evaluation.conditions.length} supported
                </em>
              ) : null}
            </div>
            {evaluation.conditions.length === 0 ? (
              <p className="empty-copy">
                Evidence will be evaluated when public requirements are shared.
              </p>
            ) : (
              <>
                <ul className="evidence-list">
                  {evaluation.conditions.map((condition) => (
                    <li key={condition.id} className={`evidence-${condition.status}`}>
                      <span className="evidence-symbol" aria-hidden="true">
                        {condition.status === 'supported'
                          ? '✓'
                          : condition.status === 'violated'
                            ? '×'
                            : '?'}
                      </span>
                      <span className="evidence-copy">
                        <span>
                          <strong>{condition.label}</strong>
                          <em>{statusCopy[condition.status]}</em>
                        </span>
                        <small>{condition.detail}</small>
                        <cite>{condition.source}</cite>
                      </span>
                    </li>
                  ))}
                </ul>
                {state.lot.evidence.repairEvidenceImage !== null &&
                state.lot.evidence.repairEvidenceFrame?.kind === 'camera-keyframe' &&
                state.lot.evidence.visualReview !== null ? (
                  <figure className="published-evidence-frame">
                    <Image
                      src={state.lot.evidence.repairEvidenceImage}
                      width={state.lot.evidence.repairEvidenceFrame.widthPx}
                      height={state.lot.evidence.repairEvidenceFrame.heightPx}
                      alt="Host-published evidence frame showing the snowboard base"
                      unoptimized
                    />
                    <figcaption>
                      <span>
                        <small>Selected public frame</small>
                        <code>{state.lot.evidence.repairEvidenceFrame.frameId}</code>
                      </span>
                      <span>
                        <small>Visual review</small>
                        <strong>
                          {state.lot.evidence.visualReview.source} · host{' '}
                          {state.lot.evidence.visualReview.hostDecision}
                        </strong>
                      </span>
                      <p>{state.lot.evidence.visualReview.reviewedFinding.summary}</p>
                      <p className="published-evidence-limit">{historicalEvidenceLimitation}</p>
                    </figcaption>
                  </figure>
                ) : null}
              </>
            )}
          </section>

          <section
            className={`action-card action-${evaluation.outcome}`}
            aria-labelledby="action-title"
          >
            <div className="section-heading">
              <span>
                <small>03</small>
                <strong id="action-title">Exact-quote action</strong>
              </span>
            </div>
            {state.reservation !== null ? (
              <div className="action-content">
                <div>
                  <strong>
                    Reversible hold active at {usd.format(state.reservation.acceptedAllInPrice)}
                  </strong>
                  <p>Attributed to {actorLabel(state.reservation.heldBy)}. No payment was taken.</p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => void dispatch({ kind: 'release-current-lot', actor: 'buyer' })}
                >
                  Release hold
                </button>
              </div>
            ) : evaluation.outcome === 'ready' ? (
              <div className="action-content">
                <div>
                  <strong>Public evidence complete</strong>
                  <p>
                    ChatGPT privately compares {usd.format(allInPrice)} and passes only that exact
                    quote if a hold is wanted.
                  </p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    void dispatch({
                      kind: 'reserve-current-lot',
                      actor: 'buyer',
                      expectedAllInPrice: getAllInPrice(state.lot),
                    })
                  }
                >
                  Hold at {usd.format(allInPrice)}
                </button>
              </div>
            ) : (
              <div className="action-content">
                <div>
                  <strong>Hold unavailable</strong>
                  <p>
                    {evaluation.outcome === 'no-requirements'
                      ? 'Share public evidence requirements before the page exposes a hold.'
                      : evaluation.outcome === 'unresolved'
                        ? queuedRepairRequest
                          ? 'The host must answer the aggregated repair-history question.'
                          : 'Repair-history evidence is still missing from the live camera.'
                        : 'At least one public product requirement is violated.'}
                  </p>
                </div>
                {evaluation.outcome === 'unresolved' && !queuedRepairRequest ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void dispatch({ kind: 'request-repair-history', actor: 'buyer' })
                    }
                  >
                    Join evidence request
                  </button>
                ) : null}
              </div>
            )}
          </section>

          <p className="result-message" role="status" aria-live="polite">
            {lastMessage}
          </p>
        </article>

        <aside className="trace-panel panel" aria-label="Site Tools and activity trace">
          <section className="tool-contract" aria-labelledby="tools-title">
            <div className="section-heading">
              <span>
                <small>Page contract</small>
                <strong id="tools-title">Tools available now</strong>
              </span>
              <em>{availableToolNames.length}</em>
            </div>
            <p className="runtime-message">{siteToolStatus.message}</p>
            <ul className="tool-list">
              {availableToolNames.map((name) => (
                <li key={name}>
                  <span aria-hidden="true">{name.includes('inspect') ? '○' : '◇'}</span>
                  <code>{name}</code>
                  <small>
                    {siteToolStatus.registeredNames.includes(name) ? 'registered' : 'page contract'}
                  </small>
                </li>
              ))}
            </ul>
            <p className="contract-note">
              The hold tool is genuinely unregistered until public evidence is ready. It accepts an
              exact quote, never a private ceiling.
            </p>
          </section>

          <section className="frontier-section" aria-labelledby="frontier-title">
            <div className="section-heading">
              <span>
                <small>Counterfactual contract</small>
                <strong id="frontier-title">Next capability</strong>
              </span>
              <em>{frontier.next.actor === 'host' ? 'Host' : 'Buyer'}</em>
            </div>
            <code>{frontier.next.action}</code>
            <p>{frontier.next.instruction}</p>
            {frontier.blocked[0] === undefined ? null : (
              <div className="frontier-blocked">
                <small>{frontier.blocked[0].name} remains unavailable</small>
                <p>{frontier.blocked[0].recovery}</p>
              </div>
            )}
          </section>

          <section className="activity-section" aria-labelledby="activity-title">
            <div className="section-heading">
              <span>
                <small>Shared history</small>
                <strong id="activity-title">Attributed activity</strong>
              </span>
            </div>
            <ol className="activity-list">
              {[...state.activity].reverse().map((event) => (
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

          <footer className="safety-note">
            <span aria-hidden="true">↩</span>
            <p>
              <strong>Human control stays visible.</strong>
              This rung creates only a reversible exact-quote hold. It cannot bid, pay, or purchase.
            </p>
          </footer>
        </aside>
      </section>
    </main>
  );
}
