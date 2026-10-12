// Tuned for Krunker-style slide-hopping and sharp air control
export const MOVEMENT_CONFIG = {
  WALK_SPEED: 14.0,           // Snappy base run speed (m/s)
  SLIDE_SPEED: 22.0,          // Instant burst when crouching from a sprint
  SLIDE_DURATION_MS: 350,     // Window to time the jump for a slide-hop
  SLIDE_FRICTION: 0.98,       // Friction multiplier while sliding (near-zero drag)
  GROUND_FRICTION: 0.05,      // Instant ground stopping power when not sliding
  AIR_ACCELERATION: 40.0,     // Quake/Source-style air strafing response
  AIR_SPEED_CAP: 26.0,        // Max horizontal velocity achievable from strafing
  JUMP_IMPULSE: 11.5,         // Fast, punchy jump vertical impulse
  GRAVITY: -28.0,             // Heavy gravity for rapid jump cycles
  STAND_HEIGHT: 1.8,          // Eye level standing
  CROUCH_HEIGHT: 0.9,         // Eye level sliding/crouching
} as const;

export const WEAPON_CONFIG = {
  PISTOL: {
    MAG_SIZE: 10,
    BODY_DAMAGE: 15,
    HEAD_DAMAGE: 60,
    RELOAD_TIME_MS: 1500,
    FIRE_RATE_MS: 250,
  },
  GRENADE: {
    MAX_CHARGES: 2,
    COOLDOWN_MS: 15000,
    FUSE_MS: 2500,
    DAMAGE: 30,
    RADIUS: 5.0,
    THROW_IMPULSE: 16.0,
  },
  KNIFE: {
    DAMAGE: 50,
    RANGE: 2.4,
    COOLDOWN_MS: 500,
  },
  MAX_HP: 100,
  ROUNDS_TO_WIN: 2,
} as const;