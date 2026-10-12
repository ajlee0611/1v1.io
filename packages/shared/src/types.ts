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
  roundsWon: number;
}

export interface PlayerSnapshot {
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

export interface LobbyInfo {
  id: string;
  hostName: string;
  isPrivate: boolean;
  playerCount: number;
  status: 'waiting' | 'in-game';
}

export type ClientMessage =
  | { type: 'SET_USERNAME'; username: string }
  | { type: 'LIST_LOBBIES' }
  | { type: 'CREATE_ROOM'; isPrivate: boolean; password?: string }
  | { type: 'CANCEL_ROOM' }
  | { type: 'JOIN_ROOM'; roomId: string; password?: string }
  | { type: 'PLAYER_MOVE'; x: number; y: number; z: number; yaw: number; pitch: number; isSliding: boolean; timestamp: number }
  | { type: 'PLAYER_SHOOT'; weapon: WeaponType; origin: { x: number; y: number; z: number }; targetPos?: { x: number; y: number; z: number }; targetId?: string; hitZone?: 'head' | 'body'; timestamp: number }
  | { type: 'PLAYER_THROW_GRENADE'; startPos: { x: number; y: number; z: number }; initialVel: { x: number; y: number; z: number } }
  | { type: 'PLAYER_GRENADE_DAMAGE'; targetId: string; damage: number };

export type ServerMessage =
  | { type: 'USERNAME_ACCEPTED'; username: string }
  | { type: 'USERNAME_REJECTED'; reason: string }
  | { type: 'LOBBY_LIST'; lobbies: LobbyInfo[] }
  | { type: 'ROOM_JOINED'; roomId: string; playerId: string; spawnSide: 'alpha' | 'bravo'; isPrivate: boolean }
  | { type: 'JOIN_REJECTED'; reason: string }
  | { type: 'GAME_COUNTDOWN'; countdown: number; currentRound: number }
  | { type: 'NEW_ROUND_START'; currentRound: number; players: Array<{ id: string; username: string; hp: number; roundsWon: number; spawnSide?: 'alpha' | 'bravo' }> }
  | { type: 'ROUND_END'; winnerId: string; currentRound: number; players: Array<{ id: string; username: string; hp: number; roundsWon: number; spawnSide?: 'alpha' | 'bravo' }> }
  | { type: 'MATCH_OVER'; winnerId: string; players: Array<{ id: string; username: string; hp: number; roundsWon: number; spawnSide?: 'alpha' | 'bravo' }> }
  | { type: 'RETURN_TO_HOME' }
  | { type: 'PLAYER_MOVED'; playerId: string; x: number; y: number; z: number; yaw: number; pitch: number; isSliding: boolean; timestamp: number }
  | { type: 'PLAYER_SHOT'; playerId: string; weapon: WeaponType; origin: { x: number; y: number; z: number }; targetPos?: { x: number; y: number; z: number }; targetId?: string; hitZone?: 'head' | 'body' }
  | { type: 'GRENADE_THROWN'; playerId: string; startPos: { x: number; y: number; z: number }; initialVel: { x: number; y: number; z: number } }
  | { type: 'PLAYER_DAMAGED'; targetId: string; newHp: number; attackerId: string };