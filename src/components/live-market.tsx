'use client';

import { useCallback, useMemo, useRef, useState } from 'react';

import {
  answerRepairHistory,
  createInitialState,
  defaultBuyerMandate,
  evaluateMandate,
  getAllInPrice,
  getAvailableToolNames,
  releaseCurrentLot,
  requestRepairHistory,
  reserveCurrentLot,
  setBuyingMandate,
  type EvidenceStatus,
  type LiveMarketState,
  type TransitionResult,
} from '@/lib/live-market/model';
import { type MarketTransition, type SiteToolRuntime } from '@/lib/live-market/site-tools';
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

export function LiveMarket(): React.JSX.Element {
  const [state, setState] = useState<LiveMarketState>(createInitialState);
  const [lastMessage, setLastMessage] = useState('Waiting for a buyer mandate.');
  const stateRef = useRef(state);

  const transition = useCallback((next: MarketTransition): TransitionResult => {
    const result = next(stateRef.current);
    stateRef.current = result.state;
    setState(result.state);
    setLastMessage(result.message);
    return result;
  }, []);

  const readState = useCallback((): LiveMarketState => stateRef.current, []);
  const siteToolRuntime = useMemo<SiteToolRuntime>(
    () => ({ readState, transition }),
    [readState, transition],
  );
  const availableToolNames = getAvailableToolNames(state);
  const availabilityKey = availableToolNames.join('|');
  const siteToolStatus = useSiteTools(siteToolRuntime, availabilityKey);
  const evaluation = evaluateMandate(state);
  const queuedRepairRequest = state.evidenceRequests.some(
    ({ kind, status }) => kind === 'repair_history' && status === 'queued',
  );

  const resetDemo = useCallback((): void => {
    const initialState = createInitialState();
    stateRef.current = initialState;
    setState(initialState);
    setLastMessage('Demo reset. Waiting for a buyer mandate.');
  }, []);

  const evaluationTitle =
    evaluation.outcome === 'no-mandate'
      ? 'No mandate shared'
      : evaluation.outcome === 'unresolved'
        ? 'One fact still missing'
        : evaluation.outcome === 'eligible'
          ? 'Mandate satisfied'
          : 'Mandate violated';

  return (
    <main className="market-shell">
      <header className="topbar">
        <div className="brand-lockup" aria-label="Agent-attended market prototype">
          <span className="brand-mark" aria-hidden="true">
            WM
          </span>
          <span>
            <strong>Agent-attended market</strong>
            <small>Working rung · one live lot</small>
          </span>
        </div>
        <div className="topbar-actions">
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
          <button className="quiet-button" type="button" onClick={resetDemo}>
            Reset demo
          </button>
        </div>
      </header>

      <section className="hero-copy" aria-labelledby="page-title">
        <p className="eyebrow">Proof before pressure</p>
        <h1 id="page-title">The agent asks the camera for what the decision is missing.</h1>
        <p>
          The buyer watches the show. ChatGPT tracks the mandate, directs one useful host
          demonstration, and receives only the actions that become safe.
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
            <div className="viewer-count">● 184 watching</div>
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
              <small>All-in now</small>
              <strong>{usd.format(getAllInPrice(state.lot))}</strong>
            </span>
          </div>

          <div className={`host-queue ${queuedRepairRequest ? 'queue-active' : ''}`}>
            <div className="queue-title">
              <span className="queue-icon" aria-hidden="true">
                ↗
              </span>
              <span>
                <strong>Host evidence queue</strong>
                <small>
                  {queuedRepairRequest ? '1 agent-directed request' : 'No open requests'}
                </small>
              </span>
            </div>
            {queuedRepairRequest ? (
              <div className="queue-request">
                <p>Show the base and disclose whether it has ever been repaired.</p>
                <div className="host-controls" aria-label="Deterministic host response controls">
                  <button
                    type="button"
                    onClick={() => transition((current) => answerRepairHistory(current, 'none'))}
                  >
                    Show: no repair
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() =>
                      transition((current) => answerRepairHistory(current, 'repaired'))
                    }
                  >
                    Disclose repair
                  </button>
                </div>
              </div>
            ) : (
              <p className="empty-copy">
                Agents can request only evidence that matters to a disclosed mandate.
              </p>
            )}
          </div>
        </article>

        <article className="decision-panel panel" aria-labelledby="decision-title">
          <div className="panel-kicker">
            <span>Buyer decision</span>
            <span className={`outcome-tag outcome-${evaluation.outcome}`}>{evaluationTitle}</span>
          </div>
          <h2 id="decision-title">Evidence, not a recommendation</h2>
          <p className="panel-intro">
            Only the minimum constraints shared with this page are evaluated. The buyer’s wider
            conversation stays with ChatGPT.
          </p>

          <section className="mandate-card" aria-labelledby="mandate-title">
            <div className="section-heading">
              <span>
                <small>01</small>
                <strong id="mandate-title">Disclosed mandate</strong>
              </span>
              {state.mandate === null ? <em>Empty</em> : <em>5 constraints</em>}
            </div>
            {state.mandate === null ? (
              <div className="empty-mandate">
                <p>Tell ChatGPT what matters, or use the deterministic fallback below.</p>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() =>
                    transition((current) => setBuyingMandate(current, defaultBuyerMandate, 'buyer'))
                  }
                >
                  Share demo mandate
                </button>
              </div>
            ) : (
              <dl className="mandate-grid">
                <div>
                  <dt>All-in ceiling</dt>
                  <dd>{usd.format(state.mandate.maxAllInPrice)}</dd>
                </div>
                <div>
                  <dt>Length</dt>
                  <dd>
                    {state.mandate.minLengthCm}-{state.mandate.maxLengthCm} cm
                  </dd>
                </div>
                <div>
                  <dt>Edge proof</dt>
                  <dd>{state.mandate.requireVisibleEdgeEvidence ? 'Required' : 'Optional'}</dd>
                </div>
                <div>
                  <dt>Prior repair</dt>
                  <dd>{state.mandate.forbidPriorBaseRepair ? 'Forbidden' : 'Allowed'}</dd>
                </div>
              </dl>
            )}
          </section>

          <section className="evidence-card" aria-labelledby="evidence-title">
            <div className="section-heading">
              <span>
                <small>02</small>
                <strong id="evidence-title">Constraint evidence</strong>
              </span>
              {evaluation.conditions.length > 0 ? (
                <em>
                  {evaluation.conditions.filter(({ status }) => status === 'supported').length}/
                  {evaluation.conditions.length} supported
                </em>
              ) : null}
            </div>
            {evaluation.conditions.length === 0 ? (
              <p className="empty-copy">Evidence will be evaluated when a mandate is shared.</p>
            ) : (
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
            )}
          </section>

          <section
            className={`action-card action-${evaluation.outcome}`}
            aria-labelledby="action-title"
          >
            <div className="section-heading">
              <span>
                <small>03</small>
                <strong id="action-title">Currently safe action</strong>
              </span>
            </div>
            {state.reservation !== null ? (
              <div className="action-content">
                <div>
                  <strong>Reversible hold active</strong>
                  <p>Attributed to {actorLabel(state.reservation.heldBy)}. No payment was taken.</p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => transition((current) => releaseCurrentLot(current, 'buyer'))}
                >
                  Release hold
                </button>
              </div>
            ) : evaluation.outcome === 'eligible' ? (
              <div className="action-content">
                <div>
                  <strong>10-minute hold unlocked</strong>
                  <p>All disclosed constraints are supported by current page evidence.</p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => transition((current) => reserveCurrentLot(current, 'buyer'))}
                >
                  Hold this lot
                </button>
              </div>
            ) : (
              <div className="action-content">
                <div>
                  <strong>Reservation unavailable</strong>
                  <p>
                    {evaluation.outcome === 'no-mandate'
                      ? 'Share a mandate before the page exposes a reservation action.'
                      : evaluation.outcome === 'unresolved'
                        ? 'The page still needs repair-history evidence from the host.'
                        : 'At least one disclosed constraint is violated.'}
                  </p>
                </div>
                {evaluation.outcome === 'unresolved' && !queuedRepairRequest ? (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => transition((current) => requestRepairHistory(current, 'buyer'))}
                  >
                    Request missing evidence
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
              The reservation tool is not hidden with CSS. It is unregistered until eligibility
              changes.
            </p>
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
              This rung creates only a reversible hold. It cannot bid, pay, or purchase.
            </p>
          </footer>
        </aside>
      </section>
    </main>
  );
}
