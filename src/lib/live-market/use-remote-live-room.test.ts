import { describe, expect, it } from 'vitest';

import { remoteRoomProtocolVersion, type RoomCredentials } from './remote-room-protocol';
import { createHostInviteUrl, parseHostInviteHash } from './use-remote-live-room';

function credentials(expiresAt: number): RoomCredentials {
  return {
    protocolVersion: remoteRoomProtocolVersion,
    roomId: 'ABC234',
    buyerToken: 'b'.repeat(43),
    hostToken: 'h'.repeat(43),
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
});
