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