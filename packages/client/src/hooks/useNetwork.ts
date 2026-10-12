import { useEffect, useRef, useState, useCallback } from 'react';
import type { ClientMessage, ServerMessage, LobbyInfo, Vector3D } from '@1v1/shared';

export interface PlayerNetState {
  id: string;
  username: string;
  hp: number;
  roundsWon: number;
  spawnSide: 'alpha' | 'bravo';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  isSliding: boolean;
}

export type GameStatus =
  | 'username_prompt'
  | 'home'
  | 'waiting'
  | 'countdown'
  | 'playing'
  | 'round-end'
  | 'match-over';

export interface NetworkState {
  status: GameStatus;
  username: string;
  playerId: string;
  roomId?: string;
  spawnSide?: 'alpha' | 'bravo';
  isPrivate?: boolean;
  lobbies: LobbyInfo[];
  players: PlayerNetState[];
  currentRound: number;
  countdown: number;
  roundWinnerId?: string;
  matchWinnerId?: string;
  error?: string;
}

export function useNetwork() {
  const wsRef = useRef<WebSocket | null>(null);
  const onRemoteGrenadeRef = useRef<((start: Vector3D, vel: Vector3D) => void) | null>(null);

  const [state, setState] = useState<NetworkState>({
    status: 'username_prompt',
    username: '',
    playerId: '',
    lobbies: [],
    players: [],
    currentRound: 1,
    countdown: 3,
  });

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onopen = () => {
      setState((prev) => ({ ...prev, error: undefined }));
    };

    ws.onerror = () => {
      setState((prev) => ({
        ...prev,
        error: 'Unable to connect to game server (ws://localhost:3001).',
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'USERNAME_ACCEPTED': {
            setState((prev) => ({
              ...prev,
              username: msg.username,
              status: 'home',
              error: undefined,
            }));
            break;
          }

          case 'USERNAME_REJECTED': {
            setState((prev) => ({
              ...prev,
              error: msg.reason,
            }));
            break;
          }

          case 'LOBBY_LIST': {
            setState((prev) => ({
              ...prev,
              lobbies: msg.lobbies,
            }));
            break;
          }

          case 'ROOM_JOINED': {
            setState((prev) => ({
              ...prev,
              roomId: msg.roomId,
              playerId: msg.playerId,
              spawnSide: msg.spawnSide,
              isPrivate: msg.isPrivate,
              status: 'waiting',
              error: undefined,
            }));
            break;
          }

          case 'JOIN_REJECTED': {
            setState((prev) => ({
              ...prev,
              error: msg.reason,
            }));
            break;
          }

          case 'GAME_COUNTDOWN': {
            setState((prev) => ({
              ...prev,
              status: 'countdown',
              countdown: msg.countdown,
              currentRound: msg.currentRound,
            }));
            break;
          }

          case 'NEW_ROUND_START': {
            setState((prev) => ({
              ...prev,
              status: 'playing',
              currentRound: msg.currentRound,
              players: msg.players.map((p) => {
                const existing = prev.players.find((ep) => ep.id === p.id);
                const derivedSpawnSide: 'alpha' | 'bravo' =
                  p.spawnSide ??
                  (p.id === prev.playerId
                    ? (prev.spawnSide ?? 'alpha')
                    : prev.spawnSide === 'alpha'
                    ? 'bravo'
                    : 'alpha');

                return {
                  ...p,
                  spawnSide: derivedSpawnSide,
                  x: existing?.x ?? 0,
                  y: existing?.y ?? 1,
                  z: existing?.z ?? 0,
                  yaw: existing?.yaw ?? 0,
                  pitch: existing?.pitch ?? 0,
                  isSliding: false,
                };
              }),
            }));
            break;
          }

          case 'ROUND_END': {
            setState((prev) => ({
              ...prev,
              status: 'round-end',
              roundWinnerId: msg.winnerId,
              players: prev.players.map((p) => {
                const match = msg.players.find((mp) => mp.id === p.id);
                return match ? { ...p, hp: match.hp, roundsWon: match.roundsWon } : p;
              }),
            }));
            break;
          }

          case 'MATCH_OVER': {
            setState((prev) => ({
              ...prev,
              status: 'match-over',
              matchWinnerId: msg.winnerId,
              players: prev.players.map((p) => {
                const match = msg.players.find((mp) => mp.id === p.id);
                return match ? { ...p, hp: match.hp, roundsWon: match.roundsWon } : p;
              }),
            }));
            break;
          }

          case 'RETURN_TO_HOME': {
            setState((prev) => ({
              ...prev,
              status: 'home',
              roomId: undefined,
              spawnSide: undefined,
              players: [],
              currentRound: 1,
              roundWinnerId: undefined,
              matchWinnerId: undefined,
              error: undefined,
            }));
            break;
          }

          case 'PLAYER_MOVED': {
            setState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.id === msg.playerId
                  ? {
                      ...p,
                      x: msg.x,
                      y: msg.y,
                      z: msg.z,
                      yaw: msg.yaw,
                      pitch: msg.pitch,
                      isSliding: msg.isSliding,
                    }
                  : p
              ),
            }));
            break;
          }

          case 'PLAYER_DAMAGED': {
            setState((prev) => ({
              ...prev,
              players: prev.players.map((p) =>
                p.id === msg.targetId ? { ...p, hp: msg.newHp } : p
              ),
            }));
            break;
          }

          case 'GRENADE_THROWN': {
            if (onRemoteGrenadeRef.current) {
              onRemoteGrenadeRef.current(msg.startPos, msg.initialVel);
            }
            break;
          }
        }
      } catch (err) {
        console.error('Failed to parse incoming WS message:', err);
      }
    };

    ws.onclose = (event) => {
      if (event.code === 1000) return;
      setTimeout(() => {
        connect();
      }, 2000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        const socket = wsRef.current;
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000, 'Unmounted');
        } else if (socket.readyState === WebSocket.CONNECTING) {
          socket.onopen = () => {
            socket.close(1000, 'Unmounted');
          };
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((msg: ClientMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      setState((prev) => ({
        ...prev,
        error: 'Server is offline or reconnecting. Please wait a moment...',
      }));
    }
  }, []);

  const registerUsername = useCallback(
    (username: string) => {
      sendMessage({ type: 'SET_USERNAME', username });
    },
    [sendMessage]
  );

  const refreshLobbies = useCallback(() => {
    sendMessage({ type: 'LIST_LOBBIES' });
  }, [sendMessage]);

  const createRoom = useCallback(
    (isPrivate: boolean, password?: string) => {
      sendMessage({ type: 'CREATE_ROOM', isPrivate, password });
    },
    [sendMessage]
  );

  const joinRoom = useCallback(
    (roomId: string, password?: string) => {
      sendMessage({ type: 'JOIN_ROOM', roomId, password });
    },
    [sendMessage]
  );

  const setOnRemoteGrenade = useCallback(
    (fn: (start: Vector3D, vel: Vector3D) => void) => {
      onRemoteGrenadeRef.current = fn;
    },
    []
  );

  return {
    state,
    registerUsername,
    refreshLobbies,
    createRoom,
    joinRoom,
    sendMessage,
    setOnRemoteGrenade,
  };
}