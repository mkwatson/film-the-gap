'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LiveRoomController, RoomConnectionPhase } from './live-room-controller';
import { createInitialState, type LiveMarketState, type TransitionResult } from './model';
import type { RoomCommand } from './room-command';
import {
  createRemoteRoom,
  emptyRoomPresence,
  RemoteRoomClient,
  type RemoteRoomConnectionPhase,
} from './remote-room-client';
import {
  remoteRoomAccessSchema,
  roomCredentialsSchema,
  type RemoteRoomAccess,
  type RoomCredentials,
  type RoomPresence,
} from './remote-room-protocol';
import type { RoomRole } from './room-sync';

const buyerCredentialsStorageKey = 'webmcp.evidence-room.buyer.v1';
const hostAccessStorageKey = 'webmcp.evidence-room.host.v1';
const pendingRoomCreations = new Map<string, Promise<RoomCredentials>>();

function safeSessionRead(key: string): unknown {
  try {
    const stored = window.sessionStorage.getItem(key);
    return stored === null ? null : (JSON.parse(stored) as unknown);
  } catch {
    return null;
  }
}

function safeSessionWrite(key: string, value: object): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A privacy-restricted browser can still use the in-memory room for this page lifetime.
  }
}

function safeSessionRemove(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}

function unexpired(expiresAt: number): boolean {
  return expiresAt > Date.now() + 5_000;
}

function storedBuyerCredentials(): RoomCredentials | null {
  const parsed = roomCredentialsSchema.safeParse(safeSessionRead(buyerCredentialsStorageKey));
  if (!parsed.success || !unexpired(parsed.data.expiresAt)) {
    safeSessionRemove(buyerCredentialsStorageKey);
    return null;
  }
  return parsed.data;
}

function storedHostAccess(): RemoteRoomAccess | null {
  const parsed = remoteRoomAccessSchema.safeParse(safeSessionRead(hostAccessStorageKey));
  if (!parsed.success || parsed.data.role !== 'host' || !unexpired(parsed.data.expiresAt)) {
    safeSessionRemove(hostAccessStorageKey);
    return null;
  }
  return parsed.data;
}

export function parseHostInviteHash(hash: string): RemoteRoomAccess | null {
  const parameters = new URLSearchParams(hash.replace(/^#/, ''));
  const expiresAt = Number.parseInt(parameters.get('expires') ?? '', 10);
  const parsed = remoteRoomAccessSchema.safeParse({
    roomId: parameters.get('room'),
    role: 'host',
    token: parameters.get('token'),
    expiresAt,
  });
  return parsed.success && unexpired(parsed.data.expiresAt) ? parsed.data : null;
}

export function createHostInviteUrl(pageOrigin: string, credentials: RoomCredentials): string {
  const url = new URL('/host', pageOrigin);
  const parameters = new URLSearchParams({
    room: credentials.roomId,
    token: credentials.hostToken,
    expires: String(credentials.expiresAt),
  });
  url.hash = parameters.toString();
  return url.toString();
}

function getOrCreateBuyerRoom(serviceUrl: string): Promise<RoomCredentials> {
  const stored = storedBuyerCredentials();
  if (stored !== null) {
    return Promise.resolve(stored);
  }
  const existing = pendingRoomCreations.get(serviceUrl);
  if (existing !== undefined) {
    return existing;
  }
  const creation = createRemoteRoom(serviceUrl)
    .then((credentials) => {
      safeSessionWrite(buyerCredentialsStorageKey, credentials);
      return credentials;
    })
    .finally(() => pendingRoomCreations.delete(serviceUrl));
  pendingRoomCreations.set(serviceUrl, creation);
  return creation;
}

function mapRemotePhase(phase: RemoteRoomConnectionPhase): RoomConnectionPhase {
  if (phase === 'online') {
    return 'waiting';
  }
  if (phase === 'connecting' || phase === 'reconnecting') {
    return 'checking';
  }
  return 'solo';
}

function peerForPresence(role: RoomRole, presence: RoomPresence): RoomRole | null {
  if (role === 'buyer') {
    return presence.host > 0 ? 'host' : null;
  }
  return presence.buyer > 0 ? 'buyer' : null;
}

export function configuredEvidenceRoomServiceUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_EVIDENCE_ROOM_URL?.trim();
  return value === undefined || value.length === 0 ? null : value;
}

export function useRemoteLiveRoom(role: RoomRole, serviceUrl: string | null): LiveRoomController {
  const [state, setState] = useState<LiveMarketState>(createInitialState);
  const [lastMessage, setLastMessage] = useState(
    serviceUrl === null
      ? 'Remote evidence rooms are not configured.'
      : 'Preparing a temporary evidence room…',
  );
  const [connectionPhase, setConnectionPhase] = useState<RoomConnectionPhase>('checking');
  const [peerRole, setPeerRole] = useState<RoomRole | null>(null);
  const [presence, setPresence] = useState<RoomPresence>(emptyRoomPresence);
  const [access, setAccess] = useState<RemoteRoomAccess | null>(null);
  const [hostInviteUrl, setHostInviteUrl] = useState<string | null>(null);
  const stateRef = useRef(state);
  const clientRef = useRef<RemoteRoomClient | null>(null);

  const applySnapshot = useCallback(
    (snapshot: {
      readonly state: LiveMarketState;
      readonly message: string;
      readonly presence: RoomPresence;
    }): void => {
      stateRef.current = snapshot.state;
      setState(snapshot.state);
      setLastMessage(snapshot.message);
      setPresence(snapshot.presence);
      const nextPeer = peerForPresence(role, snapshot.presence);
      setPeerRole(nextPeer);
      setConnectionPhase(nextPeer === null ? 'waiting' : 'linked');
    },
    [role],
  );

  useEffect(() => {
    if (serviceUrl === null) {
      return;
    }
    let active = true;

    if (role === 'buyer') {
      void getOrCreateBuyerRoom(serviceUrl)
        .then((credentials) => {
          if (!active) {
            return;
          }
          setAccess({
            roomId: credentials.roomId,
            role: 'buyer',
            token: credentials.buyerToken,
            expiresAt: credentials.expiresAt,
          });
          setHostInviteUrl(createHostInviteUrl(window.location.origin, credentials));
        })
        .catch((error: unknown) => {
          if (!active) {
            return;
          }
          setConnectionPhase('solo');
          setLastMessage(
            error instanceof Error
              ? error.message
              : 'The temporary evidence room could not be created.',
          );
        });
    } else {
      const invite = parseHostInviteHash(window.location.hash) ?? storedHostAccess();
      if (invite === null) {
        queueMicrotask(() => {
          if (!active) {
            return;
          }
          setConnectionPhase('solo');
          setLastMessage('Open the private host invite from the buyer view to join its room.');
        });
      } else {
        safeSessionWrite(hostAccessStorageKey, invite);
        queueMicrotask(() => {
          if (active) {
            setAccess(invite);
          }
        });
        if (window.location.hash.length > 0) {
          window.history.replaceState(
            window.history.state,
            '',
            `${window.location.pathname}${window.location.search}`,
          );
        }
      }
    }

    return () => {
      active = false;
    };
  }, [role, serviceUrl]);

  useEffect(() => {
    if (serviceUrl === null || access === null) {
      return;
    }
    const client = new RemoteRoomClient({
      serviceUrl,
      access,
      initialState: stateRef.current,
      onSnapshot: applySnapshot,
      onPhase: (phase, message) => {
        setLastMessage(message);
        if (phase !== 'online') {
          setConnectionPhase(mapRemotePhase(phase));
          setPeerRole(null);
          setPresence(emptyRoomPresence());
        }
      },
    });
    clientRef.current = client;
    client.connect();

    return () => {
      client.close();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [access, applySnapshot, serviceUrl]);

  const dispatch = useCallback(async (command: RoomCommand): Promise<TransitionResult> => {
    const client = clientRef.current;
    if (client === null) {
      return {
        ok: false,
        state: stateRef.current,
        message: 'The authoritative evidence room is not connected yet.',
      };
    }
    const result = await client.dispatch(command);
    setLastMessage(result.message);
    return result;
  }, []);

  const readState = useCallback((): LiveMarketState => stateRef.current, []);
  const resetDemo = useCallback((): void => {
    void dispatch({ kind: 'reset-room' });
  }, [dispatch]);

  return {
    state,
    lastMessage,
    connectionPhase,
    peerRole,
    transport: 'remote',
    roomId: access?.roomId ?? null,
    hostInviteUrl,
    expiresAt: access?.expiresAt ?? null,
    presence,
    readState,
    resetDemo,
    dispatch,
  };
}
