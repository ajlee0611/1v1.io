import { useEffect, useRef, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage, NetworkPlayer } from '@1v1/shared';

const SERVER_URL = 'ws://localhost:3001';

export interface NetworkState {
  isConnected: boolean;
  roomId: string | null;
  playerId: string | null;
  spawnSide: 'alpha' | 'bravo' | null;
  status: 'menu' | 'waiting' | 'playing';
  players: NetworkPlayer[];
  error: string | null;
}

export function useNetwork() {
  const ws = useRef<WebSocket | null>(null);
  const [state, setState] = useState<NetworkState>({
    isConnected: false,
    roomId: null,
    playerId: null,
    spawnSide: null,
    status: 'menu',
    players: [],
    error: null,
  });

  const remoteGrenadeCallback = useRef<((startPos: any, initialVel: any) => void) | null>(null);

  const setOnRemoteGrenade = (cb: (startPos: any, initialVel: any) => void) => {
    remoteGrenadeCallback.current = cb;
  };

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(SERVER_URL);
    ws.current = socket;

    socket.onopen = () => {
      setState((s) => ({ ...s, isConnected: true, error: null }));
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;

        switch (msg.type) {
          case 'ROOM_JOINED':
            setState((s) => ({
              ...s,
              roomId: msg.roomId,
              playerId: msg.playerId,
              spawnSide: msg.spawnSide,
              status: 'waiting',
              error: null,
            }));
            break;

          case 'GAME_START':
            setState((s) => ({
              ...s,
              status: 'playing',
              players: msg.players,
            }));
            break;

          case 'STATE_UPDATE':
            setState((s) => {
              // Update all players except local player's authoritative input overrides
              return {
                ...s,
                players: msg.players,
              };
            });
            break;

          case 'PLAYER_DAMAGED':
            setState((s) => ({
              ...s,
              players: s.players.map((p) => (p.id === msg.targetId ? { ...p, hp: msg.newHp } : p)),
            }));
            break;

          case 'REMOTE_THROW_GRENADE':
            if (remoteGrenadeCallback.current) {
              remoteGrenadeCallback.current(msg.startPos, msg.initialVel);
            }
            break;

          case 'ROOM_ERROR':
            setState((s) => ({ ...s, error: msg.message, status: 'menu' }));
            break;

          case 'PLAYER_DISCONNECTED':
            setState((s) => ({
              ...s,
              status: 'waiting',
              players: s.players.filter((p) => p.id !== msg.playerId),
            }));
            break;
        }
      } catch (err) {
        console.error('Failed to parse network packet:', err);
      }
    };

    socket.onclose = () => {
      setState((s) => ({ ...s, isConnected: false, status: 'menu' }));
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      ws.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(msg));
    }
  }, []);

  const createRoom = useCallback((username: string, isPrivate: boolean, password?: string) => {
    sendMessage({ type: 'CREATE_ROOM', username, isPrivate, password });
  }, [sendMessage]);

  const joinRoom = useCallback((username: string, roomId?: string, password?: string) => {
    sendMessage({ type: 'JOIN_ROOM', username, roomId, password });
  }, [sendMessage]);

  return {
    state,
    sendMessage,
    createRoom,
    joinRoom,
    setOnRemoteGrenade,
  };
}