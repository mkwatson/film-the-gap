import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CrowdAttendeeInvites } from './crowd-attendee-invites';

const inviteUrls = Array.from(
  { length: 7 },
  (_, index) =>
    `https://market.example/attend#room=ABC234&token=${String(index + 1).repeat(43)}&expires=9999999999999`,
);

describe('CrowdAttendeeInvites', () => {
  it('keeps bearer links collapsed until an explicit reveal', () => {
    render(<CrowdAttendeeInvites inviteUrls={inviteUrls} authenticatedAttendeeCount={0} />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(document.body.textContent).not.toContain(inviteUrls[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Reveal 7 private attendee invites' }));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(7);
    expect(links[0]?.getAttribute('href')).toBe(inviteUrls[0]);
    expect(document.body.textContent).not.toContain(inviteUrls[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Hide attendee invites' }));
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });

  it('replaces the invite controls with a completion receipt', () => {
    render(<CrowdAttendeeInvites inviteUrls={inviteUrls} authenticatedAttendeeCount={7} />);

    expect(screen.getByText('All seven fixtures replaced by authenticated sessions.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
