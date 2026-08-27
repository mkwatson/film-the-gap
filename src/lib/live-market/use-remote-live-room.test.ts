import { describe, expect, it } from 'vitest';

import { remoteRoomProtocolVersion, type RoomCredentials } from './remote-room-protocol';
import {
  createAttendeeInviteUrls,
  createHostInviteUrl,
  parseAttendeeInviteHash,
  parseHostInviteHash,
} from './use-remote-live-room';

function credentials(expiresAt: number): RoomCredentials {
  return {
    protocolVersion: remoteRoomProtocolVersion,
    roomId: 'ABC234',
    buyerToken: 'b'.repeat(43),
    hostToken: 'h'.repeat(43),
    attendeeCredentials: Array.from({ length: 7 }, (_, index) => ({
      attendeeId: `attendee-${index + 1}`,
      token: String(index + 1).repeat(43),
    })),
    expiresAt,
  };
}

describe('remote room invites', () => {
  it('puts the host credential in the fragment rather than the HTTP request URL', () => {
    const room = credentials(Date.now() + 60_000);
    const invite = createHostInviteUrl('https://market.example', room);
    const url = new URL(invite);

    expect(url.pathname).toBe('/host');
    expect(url.search).toBe('');
    expect(`${url.origin}${url.pathname}`).not.toContain(room.hostToken);
    expect(url.hash).toContain(room.hostToken);
    expect(parseHostInviteHash(url.hash)).toEqual({
      roomId: room.roomId,
      role: 'host',
      token: room.hostToken,
      expiresAt: room.expiresAt,
    });
  });

  it('rejects expired or malformed host invites', () => {
    const expired = createHostInviteUrl('https://market.example', credentials(Date.now() - 1));

    expect(parseHostInviteHash(new URL(expired).hash)).toBeNull();
    expect(parseHostInviteHash('#room=bad&token=nope&expires=never')).toBeNull();
  });

  it('creates seven distinct fragment-only attendee invites with attendee authority', () => {
    const room = credentials(Date.now() + 60_000);
    const invites = createAttendeeInviteUrls('https://market.example', room);

    expect(invites).toHaveLength(7);
    expect(new Set(invites).size).toBe(7);
    for (const [index, invite] of invites.entries()) {
      const url = new URL(invite);
      const credential = room.attendeeCredentials[index];
      expect(credential).toBeDefined();
      expect(url.pathname).toBe('/attend');
      expect(url.search).toBe('');
      expect(`${url.origin}${url.pathname}`).not.toContain(credential?.token);
      expect(url.hash).toContain(credential?.token);
      expect(parseAttendeeInviteHash(url.hash)).toEqual({
        roomId: room.roomId,
        role: 'attendee',
        token: credential?.token,
        expiresAt: room.expiresAt,
      });
    }
  });

  it('rejects expired or malformed attendee invites', () => {
    const [expired] = createAttendeeInviteUrls(
      'https://market.example',
      credentials(Date.now() - 1),
    );

    expect(expired).toBeDefined();
    expect(parseAttendeeInviteHash(new URL(expired ?? 'https://invalid.example').hash)).toBeNull();
    expect(parseAttendeeInviteHash('#room=bad&token=nope&expires=never')).toBeNull();
  });
});
