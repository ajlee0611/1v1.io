export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export type WeaponType = 'PISTOL' | 'KNIFE' | 'GRENADE';

export interface PlayerInput {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  crouch: boolean;
  yaw: number;
  pitch: number;
  timestamp: number;
}

export type ClientMessage =
  | { type: 'CREATE_ROOM'; username: string; isPrivate: boolean; password?: string }
  | { type: 'JOIN_ROOM'; username: string; roomId?: string; password?: string }
  | { type: 'PLAYER_MOVE'; x: number; y: number; z: number; yaw: number; pitch: number; isSliding: boolean }
  | { type: 'PLAYER_SHOOT'; hitZone?: 'head' | 'body'; targetId?: string; weapon: WeaponType }
  | { type: 'PLAYER_THROW_GRENADE'; startPos: Vector3D; initialVel: Vector3D }
  | { type: 'PLAYER_GRENADE_DAMAGE'; targetId: string; damage: number };

export interface NetworkPlayer {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  isSliding: boolean;
  spawnSide: 'alpha' | 'bravo';
}

export type ServerMessage =
  | { type: 'ROOM_JOINED'; roomId: string; playerId: string; spawnSide: 'alpha' | 'bravo'; isPrivate: boolean }
  | { type: 'ROOM_ERROR'; message: string }
  | { type: 'GAME_START'; players: NetworkPlayer[] }
  | { type: 'STATE_UPDATE'; players: NetworkPlayer[] }
  | { type: 'REMOTE_SHOOT'; shooterId: string; weapon: WeaponType }
  | { type: 'REMOTE_THROW_GRENADE'; shooterId: string; startPos: Vector3D; initialVel: Vector3D }
  | { type: 'PLAYER_DAMAGED'; targetId: string; newHp: number; damage: number; isHeadshot: boolean }
  | { type: 'PLAYER_DISCONNECTED'; playerId: string };