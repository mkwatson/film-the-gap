import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PhoneHostInvite } from './phone-host-invite';

const inviteUrl =
  'https://market.example/host#room=ABC234&token=HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH&expires=1787840000000';

function setClipboard(clipboard: Pick<Clipboard, 'writeText'> | undefined): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
}

afterEach(() => {
  setClipboard(undefined);
  vi.restoreAllMocks();
});

describe('PhoneHostInvite', () => {
  it('keeps the bearer QR out of the page until a person explicitly reveals it', () => {
    render(<PhoneHostInvite inviteUrl={inviteUrl} />);

    expect(screen.queryByRole('img', { name: 'Private phone host invite QR code' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show private phone QR' }));

    expect(screen.getByRole('img', { name: 'Private phone host invite QR code' })).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/temporary bearer invite/i)).toBeTruthy();
    expect(document.body.textContent).not.toContain(inviteUrl);

    fireEvent.click(screen.getByRole('button', { name: 'Hide QR' }));
    expect(screen.queryByRole('img', { name: 'Private phone host invite QR code' })).toBeNull();
  });

  it('copies the exact invite only after an explicit action', async () => {
    const writeText = vi.fn(async (): Promise<void> => undefined);
    setClipboard({ writeText });
    render(<PhoneHostInvite inviteUrl={inviteUrl} />);

    expect(writeText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Show private phone QR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy instead' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledExactlyOnceWith(inviteUrl));
    expect(screen.getByRole('button', { name: 'Invite copied ✓' })).toBeTruthy();
  });

  it('keeps scan and same-device paths available when the clipboard is unavailable', async () => {
    setClipboard(undefined);
    render(<PhoneHostInvite inviteUrl={inviteUrl} />);

    expect(screen.getByRole('link', { name: 'Open phone host ↗' }).getAttribute('href')).toBe(
      inviteUrl,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show private phone QR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy instead' }));

    expect(
      await screen.findByText(/Clipboard unavailable—scan the QR or open the host/i),
    ).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Private phone host invite QR code' })).toBeTruthy();
  });
});
