import { WebSocketServer, WebSocket } from 'ws';
import type { ClientMessage, ServerMessage, NetworkPlayer } from '@1v1/shared';
import { WEAPON_CONFIG } from '@1v1/shared';

const PORT = 3001;
const wss = new WebSocketServer({ port: PORT });

interface Room {
  id: string;
  isPrivate: boolean;
  password?: string;
  players: Map<string, { ws: WebSocket; player: NetworkPlayer }>;
  status: 'waiting' | 'in-game';
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
        };

        const room: Room = {
          id: roomId,
          isPrivate: msg.isPrivate,
          password: msg.password,
          players: new Map([[playerId, { ws, player }]]),
          status: 'waiting',
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
        };

        targetRoom.players.set(playerId, { ws, player });
        targetRoom.status = 'in-game';
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
        return;
      }

      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      if (msg.type === 'PLAYER_MOVE') {
        const client = room.players.get(playerId);
        if (client) {
          client.player.x = msg.x;
          client.player.y = msg.y;
          client.player.z = msg.z;
          client.player.yaw = msg.yaw;
          client.player.pitch = msg.pitch;
          client.player.isSliding = msg.isSliding;
        }
        return;
      }

      if (msg.type === 'PLAYER_SHOOT') {
        broadcastToRoom(room, { type: 'REMOTE_SHOOT', shooterId: playerId, weapon: msg.weapon }, playerId);

        if (msg.targetId && msg.hitZone) {
          const target = room.players.get(msg.targetId);
          if (target) {
            const isHeadshot = msg.hitZone === 'head';
            const damage = msg.weapon === 'KNIFE'
              ? WEAPON_CONFIG.KNIFE.DAMAGE
              : (isHeadshot ? WEAPON_CONFIG.PISTOL.HEAD_DAMAGE : WEAPON_CONFIG.PISTOL.BODY_DAMAGE);

            target.player.hp = Math.max(0, target.player.hp - damage);

            broadcastToRoom(room, {
              type: 'PLAYER_DAMAGED',
              targetId: msg.targetId,
              newHp: target.player.hp,
              damage,
              isHeadshot,
            });
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
          });
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

// 30 Hz State Synchronization Loop
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.players.size > 0) {
      const players = Array.from(room.players.values()).map((p) => p.player);
      broadcastToRoom(room, { type: 'STATE_UPDATE', players });
    }
  }
}, 1000 / 30);

console.log(`[1v1.io Server] Listening on ws://localhost:${PORT}`);