'use client';

import { useId, useState } from 'react';

interface CrowdAttendeeInvitesProps {
  readonly inviteUrls: readonly string[];
  readonly authenticatedAttendeeCount: number;
}

export function CrowdAttendeeInvites({
  inviteUrls,
  authenticatedAttendeeCount,
}: CrowdAttendeeInvitesProps): React.JSX.Element | null {
  const panelId = useId();
  const [revealed, setRevealed] = useState(false);

  if (inviteUrls.length === 0) {
    return null;
  }

  const complete = authenticatedAttendeeCount >= inviteUrls.length;

  return (
    <section className={`crowd-invites ${complete ? 'crowd-invites-complete' : ''}`}>
      <div className="crowd-invites-copy">
        <span className="crowd-proof-mark" aria-hidden="true">
          {complete ? '✓' : '8×'}
        </span>
        <span>
          <small>Optional real-crowd proof</small>
          <strong>
            {complete
              ? 'All seven fixtures replaced by authenticated sessions.'
              : 'Replace seven fixtures with seven independent browser sessions.'}
          </strong>
          <p>
            {authenticatedAttendeeCount}/7 attendee credentials joined · each can only inspect and
            join the normalized evidence request.
          </p>
        </span>
      </div>
      {complete ? null : (
        <button
          className="secondary-button"
          type="button"
          aria-controls={panelId}
          aria-expanded={revealed}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? 'Hide attendee invites' : 'Reveal 7 private attendee invites'}
        </button>
      )}
      {revealed && !complete ? (
        <div className="crowd-invite-panel" id={panelId}>
          <div>
            <strong>Temporary bearer links</strong>
            <p>
              Open each in a separate browser session. Do not publish, record, or paste these
              credential-bearing links.
            </p>
          </div>
          <ol>
            {inviteUrls.map((inviteUrl, index) => (
              <li key={inviteUrl}>
                <a href={inviteUrl} target="_blank" rel="noopener noreferrer">
                  Open attendee {index + 1} ↗
                </a>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
