'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LiveRoomController, RoomConnectionPhase } from './live-room-controller';
import { createInitialState, type LiveMarketState, type TransitionResult } from './model';
import { applyRoomCommand, type RoomCommand } from './room-command';
import {
  advanceRoomVersion,
  compareRoomVersions,
  createInitialRoomVersion,
  createResetRoomVersion,
  createRoomStateSnapshot,
  createRoomSyncRequest,
  parseRoomMessage,
  type RoomRole,
  type RoomVersion,
} from './room-sync';
import { configuredEvidenceRoomServiceUrl, useRemoteLiveRoom } from './use-remote-live-room';

export type { LiveRoomController, RoomConnectionPhase } from './live-room-controller';

const roomId = 'evidence-market-demo-room-v1';
const roomChannelName = 'webmcp-evidence-market-room-v1';

function initialMessage(role: RoomRole): string {
  return role === 'host'
    ? 'Listening for the buyer’s normalized evidence request.'
    : 'Waiting for public evidence requirements.';
}

function useBroadcastLiveRoom(role: RoomRole, enabled: boolean): LiveRoomController {
  const [state, setState] = useState<LiveMarketState>(createInitialState);
  const [lastMessage, setLastMessage] = useState(initialMessage(role));
  const [connectionPhase, setConnectionPhase] = useState<RoomConnectionPhase>('checking');
  const [peerRole, setPeerRole] = useState<RoomRole | null>(null);
  const stateRef = useRef(state);
  const messageRef = useRef(lastMessage);
  const clientIdRef = useRef('');
  const channelRef = useRef<BroadcastChannel | null>(null);
  const versionRef = useRef<RoomVersion>(createInitialRoomVersion('unbound-client'));

  const publishSnapshot = useCallback(
    (nextState: LiveMarketState, nextMessage: string, nextVersion: RoomVersion): void => {
      const channel = channelRef.current;
      const senderId = clientIdRef.current;
      if (channel === null || senderId === '') {
        return;
      }
      channel.postMessage(
        createRoomStateSnapshot(roomId, role, senderId, nextVersion, nextState, nextMessage),
      );
    },
    [role],
  );

  const applyLocalState = useCallback((nextState: LiveMarketState, nextMessage: string): void => {
    stateRef.current = nextState;
    messageRef.current = nextMessage;
    setState(nextState);
    setLastMessage(nextMessage);
  }, []);

  const dispatch = useCallback(
    async (command: RoomCommand): Promise<TransitionResult> => {
      const result = applyRoomCommand(stateRef.current, command);
      applyLocalState(result.state, result.message);

      const senderId = clientIdRef.current;
      if (senderId !== '') {
        const nextVersion = advanceRoomVersion(versionRef.current, senderId);
        versionRef.current = nextVersion;
        publishSnapshot(result.state, result.message, nextVersion);
      }
      return result;
    },
    [applyLocalState, publishSnapshot],
  );

  const readState = useCallback((): LiveMarketState => stateRef.current, []);

  const resetDemo = useCallback((): void => {
    const nextState = createInitialState();
    const nextMessage =
      role === 'host'
        ? 'Demo reset. Listening for the buyer’s normalized evidence request.'
        : 'Demo reset. Waiting for public evidence requirements.';
    applyLocalState(nextState, nextMessage);

    const senderId = clientIdRef.current;
    if (senderId !== '') {
      const nextVersion = createResetRoomVersion(senderId, Date.now());
      versionRef.current = nextVersion;
      publishSnapshot(nextState, nextMessage, nextVersion);
    }
  }, [applyLocalState, publishSnapshot, role]);

  useEffect(() => {
    let active = true;
    const scheduleConnectionPhase = (phase: RoomConnectionPhase): void => {
      queueMicrotask(() => {
        if (active) {
          setConnectionPhase(phase);
        }
      });
    };
    const senderId = crypto.randomUUID();
    clientIdRef.current = senderId;
    versionRef.current = createInitialRoomVersion(senderId);

    if (!enabled) {
      scheduleConnectionPhase('solo');
      return () => {
        active = false;
      };
    }

    if (typeof BroadcastChannel === 'undefined') {
      scheduleConnectionPhase('solo');
      return () => {
        active = false;
      };
    }

    const channel = new BroadcastChannel(roomChannelName);
    channelRef.current = channel;
    scheduleConnectionPhase('waiting');

    channel.onmessage = (event: MessageEvent<unknown>): void => {
      const roomMessage = parseRoomMessage(event.data);
      if (
        roomMessage === null ||
        roomMessage.roomId !== roomId ||
        roomMessage.senderId === senderId
      ) {
        return;
      }

      setConnectionPhase('linked');
      setPeerRole(roomMessage.role);

      if (roomMessage.type === 'sync-request') {
        publishSnapshot(stateRef.current, messageRef.current, versionRef.current);
        return;
      }

      if (compareRoomVersions(roomMessage.version, versionRef.current) <= 0) {
        return;
      }

      versionRef.current = roomMessage.version;
      applyLocalState(roomMessage.state, roomMessage.message);
    };

    channel.postMessage(createRoomSyncRequest(roomId, role, senderId));

    return () => {
      active = false;
      channel.close();
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [applyLocalState, enabled, publishSnapshot, role]);

  return {
    state,
    lastMessage,
    connectionPhase,
    peerRole,
    transport: 'local',
    roomId: null,
    hostInviteUrl: null,
    attendeeInviteUrls: [],
    expiresAt: null,
    presence: {
      buyer: role === 'buyer' || peerRole === 'buyer' ? 1 : 0,
      host: role === 'host' || peerRole === 'host' ? 1 : 0,
      attendee: 0,
    },
    readState,
    resetDemo,
    dispatch,
  };
}

export function useLiveRoom(role: RoomRole): LiveRoomController {
  const serviceUrl = configuredEvidenceRoomServiceUrl();
  const localRoom = useBroadcastLiveRoom(role, serviceUrl === null);
  const remoteRoom = useRemoteLiveRoom(role, serviceUrl);
  return serviceUrl === null ? localRoom : remoteRoom;
}
