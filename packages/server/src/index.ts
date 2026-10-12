import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, LobbyInfo } from '@1v1/shared';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

interface ClientSession {
  ws: WebSocket;
  id: string;
  username?: string;
  currentRoomId?: string;
}

interface Room {
  id: string;
  hostId: string;
  isPrivate: boolean;
  password?: string;
  players: Map<
    string,
    { username: string; hp: number; roundsWon: number; spawnSide: 'alpha' | 'bravo' }
  >;
  status: 'waiting' | 'in-game';
  currentRound: number;
}

const clients = new Map<WebSocket, ClientSession>();
const activeUsernames = new Set<string>();
const rooms = new Map<string, Room>();

function broadcastLobbies() {
  const lobbyList: LobbyInfo[] = Array.from(rooms.values()).map((r) => {
    const hostPlayer = r.players.get(r.hostId);
    return {
      id: r.id,
      hostName: hostPlayer?.username ?? 'Unknown',
      isPrivate: r.isPrivate,
      playerCount: r.players.size,
      status: r.status,
    };
  });

  const msg: ServerMessage = { type: 'LOBBY_LIST', lobbies: lobbyList };
  const payload = JSON.stringify(msg);

  for (const session of clients.values()) {
    if (session.username && !session.currentRoomId && session.ws.readyState === WebSocket.OPEN) {
      session.ws.send(payload);
    }
  }
}

function sendTo(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToRoom(room: Room, msg: ServerMessage, excludeWs?: WebSocket) {
  const payload = JSON.stringify(msg);
  for (const [playerId] of room.players) {
    for (const session of clients.values()) {
      if (session.id === playerId && session.ws !== excludeWs && session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(payload);
      }
    }
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function startMatch(room: Room) {
  room.status = 'in-game';
  room.currentRound = 1;

  for (const p of room.players.values()) {
    p.hp = 100;
    p.roundsWon = 0;
  }

  broadcastLobbies();
  runCountdown(room, 3);
}

function runCountdown(room: Room, count: number) {
  broadcastToRoom(room, {
    type: 'GAME_COUNTDOWN',
    countdown: count,
    currentRound: room.currentRound,
  });

  if (count > 0) {
    setTimeout(() => runCountdown(room, count - 1), 1000);
  } else {
    for (const p of room.players.values()) {
      p.hp = 100;
    }
    broadcastToRoom(room, {
      type: 'NEW_ROUND_START',
      currentRound: room.currentRound,
      players: Array.from(room.players.entries()).map(([id, p]) => ({
        id,
        username: p.username,
        hp: p.hp,
        roundsWon: p.roundsWon,
        spawnSide: p.spawnSide,
      })),
    });
  }
}

function destroyRoomAndReturnHome(room: Room) {
  broadcastToRoom(room, { type: 'RETURN_TO_HOME' });

  for (const [playerId] of room.players) {
    for (const session of clients.values()) {
      if (session.id === playerId) {
        session.currentRoomId = undefined;
      }
    }
  }

  rooms.delete(room.id);
  broadcastLobbies();
}

wss.on('connection', (ws) => {
  const session: ClientSession = {
    ws,
    id: `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
  clients.set(ws, session);

  ws.on('message', (raw) => {
    try {
      const data: ClientMessage = JSON.parse(raw.toString());

      switch (data.type) {
        case 'SET_USERNAME': {
          const trimmed = data.username.trim();
          if (!trimmed || trimmed.length < 2 || trimmed.length > 16) {
            sendTo(ws, {
              type: 'USERNAME_REJECTED',
              reason: 'Username must be between 2 and 16 characters.',
            });
            return;
          }

          const lower = trimmed.toLowerCase();
          if (activeUsernames.has(lower)) {
            sendTo(ws, {
              type: 'USERNAME_REJECTED',
              reason: 'Username is already taken. Please choose another.',
            });
            return;
          }

          if (session.username) {
            activeUsernames.delete(session.username.toLowerCase());
          }
          session.username = trimmed;
          activeUsernames.add(lower);

          sendTo(ws, { type: 'USERNAME_ACCEPTED', username: trimmed });
          broadcastLobbies();
          break;
        }

        case 'LIST_LOBBIES': {
          const lobbyList: LobbyInfo[] = Array.from(rooms.values()).map((r) => ({
            id: r.id,
            hostName: r.players.get(r.hostId)?.username ?? 'Unknown',
            isPrivate: r.isPrivate,
            playerCount: r.players.size,
            status: r.status,
          }));
          sendTo(ws, { type: 'LOBBY_LIST', lobbies: lobbyList });
          break;
        }

        case 'CREATE_ROOM': {
          if (!session.username) return;
          const roomId = generateRoomCode();
          const room: Room = {
            id: roomId,
            hostId: session.id,
            isPrivate: data.isPrivate,
            password: data.password,
            players: new Map([
              [session.id, { username: session.username, hp: 100, roundsWon: 0, spawnSide: 'alpha' }],
            ]),
            status: 'waiting',
            currentRound: 1,
          };

          rooms.set(roomId, room);
          session.currentRoomId = roomId;

          sendTo(ws, {
            type: 'ROOM_JOINED',
            roomId,
            playerId: session.id,
            spawnSide: 'alpha',
            isPrivate: data.isPrivate,
          });

          broadcastLobbies();
          break;
        }

        case 'CANCEL_ROOM': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (room) {
            destroyRoomAndReturnHome(room);
          }
          break;
        }

        case 'JOIN_ROOM': {
          if (!session.username) return;
          const room = rooms.get(data.roomId.toUpperCase());

          if (!room) {
            sendTo(ws, { type: 'JOIN_REJECTED', reason: 'Lobby not found.' });
            return;
          }
          if (room.status !== 'waiting' || room.players.size >= 2) {
            sendTo(ws, { type: 'JOIN_REJECTED', reason: 'Lobby is full or match already in progress.' });
            return;
          }
          if (room.isPrivate && room.id !== data.password?.toUpperCase() && data.password !== room.id) {
            sendTo(ws, { type: 'JOIN_REJECTED', reason: 'Incorrect 5-digit code.' });
            return;
          }

          room.players.set(session.id, {
            username: session.username,
            hp: 100,
            roundsWon: 0,
            spawnSide: 'bravo',
          });
          session.currentRoomId = room.id;

          sendTo(ws, {
            type: 'ROOM_JOINED',
            roomId: room.id,
            playerId: session.id,
            spawnSide: 'bravo',
            isPrivate: room.isPrivate,
          });

          startMatch(room);
          break;
        }

        case 'PLAYER_MOVE': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room) return;
          broadcastToRoom(
            room,
            {
              type: 'PLAYER_MOVED',
              playerId: session.id,
              x: data.x,
              y: data.y,
              z: data.z,
              yaw: data.yaw,
              pitch: data.pitch,
              isSliding: data.isSliding,
              timestamp: data.timestamp,
            },
            ws
          );
          break;
        }

        case 'PLAYER_SHOOT': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room) return;

          broadcastToRoom(
            room,
            {
              type: 'PLAYER_SHOT',
              playerId: session.id,
              weapon: data.weapon,
              origin: data.origin,
              targetPos: data.targetPos,
              targetId: data.targetId,
              hitZone: data.hitZone,
            },
            ws
          );

          if (data.targetId && room.players.has(data.targetId)) {
            const target = room.players.get(data.targetId)!;
            const dmg = data.weapon === 'KNIFE' ? 50 : data.hitZone === 'head' ? 60 : 15;
            target.hp = Math.max(0, target.hp - dmg);

            broadcastToRoom(room, {
              type: 'PLAYER_DAMAGED',
              targetId: data.targetId,
              newHp: target.hp,
              attackerId: session.id,
            });

            if (target.hp <= 0) {
              const attacker = room.players.get(session.id);
              if (attacker) attacker.roundsWon += 1;

              if (attacker && attacker.roundsWon >= 2) {
                broadcastToRoom(room, {
                  type: 'MATCH_OVER',
                  winnerId: session.id,
                  players: Array.from(room.players.entries()).map(([id, p]) => ({
                    id,
                    username: p.username,
                    hp: p.hp,
                    roundsWon: p.roundsWon,
                    spawnSide: p.spawnSide,
                  })),
                });
                setTimeout(() => destroyRoomAndReturnHome(room), 3500);
              } else {
                broadcastToRoom(room, {
                  type: 'ROUND_END',
                  winnerId: session.id,
                  currentRound: room.currentRound,
                  players: Array.from(room.players.entries()).map(([id, p]) => ({
                    id,
                    username: p.username,
                    hp: p.hp,
                    roundsWon: p.roundsWon,
                    spawnSide: p.spawnSide,
                  })),
                });
                room.currentRound += 1;
                setTimeout(() => runCountdown(room, 3), 2000);
              }
            }
          }
          break;
        }

        case 'PLAYER_THROW_GRENADE': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room) return;
          broadcastToRoom(
            room,
            {
              type: 'GRENADE_THROWN',
              playerId: session.id,
              startPos: data.startPos,
              initialVel: data.initialVel,
            },
            ws
          );
          break;
        }

        case 'PLAYER_GRENADE_DAMAGE': {
          if (!session.currentRoomId) return;
          const room = rooms.get(session.currentRoomId);
          if (!room || !room.players.has(data.targetId)) return;

          const target = room.players.get(data.targetId)!;
          target.hp = Math.max(0, target.hp - data.damage);

          broadcastToRoom(room, {
            type: 'PLAYER_DAMAGED',
            targetId: data.targetId,
            newHp: target.hp,
            attackerId: session.id,
          });

          if (target.hp <= 0) {
            const attacker = room.players.get(session.id);
            if (attacker) attacker.roundsWon += 1;

            if (attacker && attacker.roundsWon >= 2) {
              broadcastToRoom(room, {
                type: 'MATCH_OVER',
                winnerId: session.id,
                players: Array.from(room.players.entries()).map(([id, p]) => ({
                  id,
                  username: p.username,
                  hp: p.hp,
                  roundsWon: p.roundsWon,
                  spawnSide: p.spawnSide,
                })),
              });
              setTimeout(() => destroyRoomAndReturnHome(room), 3500);
            } else {
              broadcastToRoom(room, {
                type: 'ROUND_END',
                winnerId: session.id,
                currentRound: room.currentRound,
                players: Array.from(room.players.entries()).map(([id, p]) => ({
                  id,
                  username: p.username,
                  hp: p.hp,
                  roundsWon: p.roundsWon,
                  spawnSide: p.spawnSide,
                })),
              });
              room.currentRound += 1;
              setTimeout(() => runCountdown(room, 3), 2000);
            }
          }
          break;
        }
      }
    } catch (e) {
      console.error('Error parsing client payload:', e);
    }
  });

  ws.on('close', () => {
    if (session.username) {
      activeUsernames.delete(session.username.toLowerCase());
    }

    if (session.currentRoomId) {
      const room = rooms.get(session.currentRoomId);
      if (room) {
        destroyRoomAndReturnHome(room);
      }
    }

    clients.delete(ws);
    broadcastLobbies();
  });
});

console.log(`[1v1.io Server] Listening on ws://localhost:${PORT}`);