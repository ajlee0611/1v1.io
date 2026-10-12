import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, NetworkPlayer } from '@1v1/shared';
import { WEAPON_CONFIG } from '@1v1/shared';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

interface PlayerSession {
  ws: WebSocket;
  player: NetworkPlayer;
  history: { timestamp: number; x: number; y: number; z: number }[];
}

interface Room {
  id: string;
  isPrivate: boolean;
  password?: string;
  players: Map<string, PlayerSession>;
  status: 'waiting' | 'countdown' | 'in-game' | 'round-end' | 'match-over';
  currentRound: number;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function broadcastToRoom(room: Room, message: ServerMessage, excludeId?: string) {
  for (const [id, client] of room.players) {
    if (id !== excludeId) {
      send(client.ws, message);
    }
  }
}

function resetPlayerRoundPositions(room: Room) {
  for (const [, client] of room.players) {
    client.player.hp = WEAPON_CONFIG.MAX_HP;
    client.player.isSliding = false;
    client.history = [];
    if (client.player.spawnSide === 'alpha') {
      client.player.x = 0;
      client.player.y = 1.5;
      client.player.z = 18;
      client.player.yaw = Math.PI;
    } else {
      client.player.x = 0;
      client.player.y = 1.5;
      client.player.z = -18;
      client.player.yaw = 0;
    }
  }
}

function startRoundSequence(room: Room) {
  room.status = 'countdown';
  resetPlayerRoundPositions(room);

  broadcastToRoom(room, {
    type: 'NEW_ROUND_START',
    currentRound: room.currentRound,
    countdown: 3,
  });

  setTimeout(() => {
    room.status = 'in-game';
    const allPlayers = Array.from(room.players.values()).map((p) => p.player);
    broadcastToRoom(room, { type: 'STATE_UPDATE', players: allPlayers });
  }, 3000);
}

function handleRoundDefeat(room: Room, defeatedPlayerId: string) {
  if (room.status !== 'in-game') return;
  room.status = 'round-end';

  let winnerId = '';
  for (const [id, client] of room.players) {
    if (id !== defeatedPlayerId) {
      client.player.roundsWon += 1;
      winnerId = id;
    }
  }

  const scores: Record<string, number> = {};
  let matchWinnerId: string | null = null;

  for (const [id, client] of room.players) {
    scores[id] = client.player.roundsWon;
    if (client.player.roundsWon >= WEAPON_CONFIG.ROUNDS_TO_WIN) {
      matchWinnerId = id;
    }
  }

  if (matchWinnerId) {
    room.status = 'match-over';
    broadcastToRoom(room, {
      type: 'MATCH_OVER',
      winnerId: matchWinnerId,
      finalScores: scores,
    });
  } else {
    broadcastToRoom(room, {
      type: 'ROUND_OVER',
      winnerId,
      currentRound: room.currentRound,
      scores,
    });

    room.currentRound += 1;
    setTimeout(() => {
      startRoundSequence(room);
    }, 3000);
  }
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  const playerId = `p_${Math.random().toString(36).substring(2, 9)}`;

  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw.toString()) as ClientMessage;

      if (msg.type === 'CREATE_ROOM') {
        const roomId = generateRoomCode();
        const spawnSide = 'alpha';
        const player: NetworkPlayer = {
          id: playerId,
          username: msg.username || 'Player 1',
          x: 0,
          y: 1.5,
          z: 18,
          yaw: Math.PI,
          pitch: 0,
          hp: WEAPON_CONFIG.MAX_HP,
          isSliding: false,
          spawnSide,
          roundsWon: 0,
        };

        const room: Room = {
          id: roomId,
          isPrivate: msg.isPrivate,
          password: msg.password,
          players: new Map([[playerId, { ws, player, history: [] }]]),
          status: 'waiting',
          currentRound: 1,
        };

        rooms.set(roomId, room);
        currentRoomId = roomId;

        send(ws, {
          type: 'ROOM_JOINED',
          roomId,
          playerId,
          spawnSide,
          isPrivate: msg.isPrivate,
        });
        return;
      }

      if (msg.type === 'JOIN_ROOM') {
        let targetRoom: Room | undefined;

        if (msg.roomId) {
          targetRoom = rooms.get(msg.roomId.toUpperCase());
          if (!targetRoom) {
            send(ws, { type: 'ROOM_ERROR', message: 'Room not found.' });
            return;
          }
          if (targetRoom.isPrivate && targetRoom.password !== msg.password) {
            send(ws, { type: 'ROOM_ERROR', message: 'Incorrect room password.' });
            return;
          }
          if (targetRoom.players.size >= 2) {
            send(ws, { type: 'ROOM_ERROR', message: 'Room is already full.' });
            return;
          }
        } else {
          for (const r of rooms.values()) {
            if (!r.isPrivate && r.players.size === 1 && r.status === 'waiting') {
              targetRoom = r;
              break;
            }
          }

          if (!targetRoom) {
            send(ws, { type: 'ROOM_ERROR', message: 'No open public games found. Create one!' });
            return;
          }
        }

        const spawnSide = 'bravo';
        const player: NetworkPlayer = {
          id: playerId,
          username: msg.username || 'Player 2',
          x: 0,
          y: 1.5,
          z: -18,
          yaw: 0,
          pitch: 0,
          hp: WEAPON_CONFIG.MAX_HP,
          isSliding: false,
          spawnSide,
          roundsWon: 0,
        };

        targetRoom.players.set(playerId, { ws, player, history: [] });
        currentRoomId = targetRoom.id;

        send(ws, {
          type: 'ROOM_JOINED',
          roomId: targetRoom.id,
          playerId,
          spawnSide,
          isPrivate: targetRoom.isPrivate,
        });

        const allPlayers = Array.from(targetRoom.players.values()).map((p) => p.player);
        broadcastToRoom(targetRoom, { type: 'GAME_START', players: allPlayers });
        startRoundSequence(targetRoom);
        return;
      }

      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      if (msg.type === 'RESTART_MATCH' && room.status === 'match-over') {
        room.currentRound = 1;
        for (const [, c] of room.players) {
          c.player.roundsWon = 0;
        }
        startRoundSequence(room);
        return;
      }

      if (room.status !== 'in-game') return;

      if (msg.type === 'PLAYER_MOVE') {
        const client = room.players.get(playerId);
        if (client) {
          client.player.x = msg.x;
          client.player.y = msg.y;
          client.player.z = msg.z;
          client.player.yaw = msg.yaw;
          client.player.pitch = msg.pitch;
          client.player.isSliding = msg.isSliding;

          // Record snapshot history (1 second retention)
          const now = Date.now();
          client.history.push({ timestamp: now, x: msg.x, y: msg.y, z: msg.z });
          if (client.history.length > 35) {
            client.history.shift();
          }
        }
        return;
      }

      if (msg.type === 'PLAYER_SHOOT') {
        broadcastToRoom(
          room,
          {
            type: 'REMOTE_SHOOT',
            shooterId: playerId,
            weapon: msg.weapon,
            origin: msg.origin,
            targetPos: msg.targetPos,
          },
          playerId
        );

        if (msg.targetId && msg.hitZone) {
          const target = room.players.get(msg.targetId);
          if (target) {
            const isHeadshot = msg.hitZone === 'head';
            const damage = msg.weapon === 'KNIFE'
              ? WEAPON_CONFIG.KNIFE.DAMAGE
              : (isHeadshot ? WEAPON_CONFIG.PISTOL.HEAD_DAMAGE : WEAPON_CONFIG.PISTOL.BODY_DAMAGE);

            target.player.hp = Math.max(0, target.player.hp - damage);

            const hitPos = msg.targetPos ?? { x: target.player.x, y: target.player.y + 1, z: target.player.z };

            broadcastToRoom(room, {
              type: 'PLAYER_DAMAGED',
              targetId: msg.targetId,
              newHp: target.player.hp,
              damage,
              isHeadshot,
              hitPos,
            });

            if (target.player.hp <= 0) {
              handleRoundDefeat(room, target.player.id);
            }
          }
        }
        return;
      }

      if (msg.type === 'PLAYER_THROW_GRENADE') {
        broadcastToRoom(room, {
          type: 'REMOTE_THROW_GRENADE',
          shooterId: playerId,
          startPos: msg.startPos,
          initialVel: msg.initialVel,
        }, playerId);
        return;
      }

      if (msg.type === 'PLAYER_GRENADE_DAMAGE') {
        const target = room.players.get(msg.targetId);
        if (target) {
          target.player.hp = Math.max(0, target.player.hp - msg.damage);
          broadcastToRoom(room, {
            type: 'PLAYER_DAMAGED',
            targetId: msg.targetId,
            newHp: target.player.hp,
            damage: msg.damage,
            isHeadshot: false,
            hitPos: { x: target.player.x, y: target.player.y, z: target.player.z },
          });

          if (target.player.hp <= 0) {
            handleRoundDefeat(room, target.player.id);
          }
        }
      }
    } catch (err) {
      console.error('Error handling packet:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(playerId);
        broadcastToRoom(room, { type: 'PLAYER_DISCONNECTED', playerId });
        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.size > 0 && (room.status === 'in-game' || room.status === 'countdown')) {
      const players = Array.from(room.players.values()).map((p) => p.player);
      broadcastToRoom(room, { type: 'STATE_UPDATE', players });
    }
  }
}, 1000 / 30);

console.log(`[1v1.io Server] Listening on ws://localhost:${PORT}`);