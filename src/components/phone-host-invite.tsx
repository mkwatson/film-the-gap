'use client';

import { useId, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface PhoneHostInviteProps {
  readonly inviteUrl: string;
}

type CopyStatus = 'idle' | 'copied' | 'error';

export function PhoneHostInvite({ inviteUrl }: PhoneHostInviteProps): React.JSX.Element {
  const panelId = useId();
  const descriptionId = useId();
  const [revealed, setRevealed] = useState(false);
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');

  async function copyInvite(): Promise<void> {
    if (navigator.clipboard === undefined) {
      setCopyStatus('error');
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  function toggleQr(): void {
    setRevealed((current) => !current);
    setCopyStatus('idle');
  }

  return (
    <div className="phone-invite-control">
      <button
        className="quiet-button invite-button"
        type="button"
        aria-controls={panelId}
        aria-expanded={revealed}
        onClick={toggleQr}
      >
        {revealed ? 'Hide phone QR' : 'Show private phone QR'}
      </button>
      <a
        className="quiet-button quiet-link invite-button"
        href={inviteUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open phone host ↗
      </a>
      {revealed ? (
        <section
          className="phone-invite-card"
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          aria-describedby={descriptionId}
        >
          <div className="phone-invite-qr-frame">
            <QRCodeSVG
              value={inviteUrl}
              size={220}
              level="M"
              marginSize={4}
              bgColor="#f7fff9"
              fgColor="#07100c"
              title="Private phone host invite QR code"
              aria-describedby={descriptionId}
            />
          </div>
          <div className="phone-invite-copy">
            <small>Private seller invite</small>
            <strong id={`${panelId}-title`}>Scan with any phone camera.</strong>
            <p id={descriptionId}>
              This QR encodes a temporary bearer invite for the host role. Hide it after scanning
              and never publish a screenshot containing it.
            </p>
            <div className="phone-invite-actions">
              <button className="secondary-button" type="button" onClick={() => void copyInvite()}>
                {copyStatus === 'copied' ? 'Invite copied ✓' : 'Copy instead'}
              </button>
              <button className="secondary-button" type="button" onClick={toggleQr}>
                Hide QR
              </button>
            </div>
            <span role="status" aria-live="polite">
              {copyStatus === 'error'
                ? 'Clipboard unavailable—scan the QR or open the host on this device.'
                : 'The invite fragment is scrubbed after the phone joins.'}
            </span>
          </div>
        </section>
      ) : null}
    </div>
  );
}
