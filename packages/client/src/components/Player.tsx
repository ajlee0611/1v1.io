import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { MOVEMENT_CONFIG, WEAPON_CONFIG, type WeaponType } from '@1v1/shared';
import { useKeyboard } from '../hooks/useKeyboard';
import { GrenadeProjectile } from './GrenadeProjectile';

export interface WeaponState {
  currentWeapon: WeaponType;
  ammo: number;
  isReloading: boolean;
  grenadeCharges: number;
  grenadeCooldownProgress: number;
}

interface PlayerProps {
  onSpeedUpdate?: (speed: number) => void;
  onWeaponStateUpdate?: (state: WeaponState) => void;
}

export const Player: React.FC<PlayerProps> = ({ onSpeedUpdate, onWeaponStateUpdate }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const { camera, scene } = useThree();
  const keys = useKeyboard();

  // Movement & Slide State
  const [isSliding, setIsSliding] = useState(false);
  const slideStartTime = useRef<number>(0);
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());

  // Weapon State
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>('PISTOL');
  const [ammo, setAmmo] = useState<number>(WEAPON_CONFIG.PISTOL.MAG_SIZE);
  const [isReloading, setIsReloading] = useState<boolean>(false);
  const lastShotTime = useRef<number>(0);
  const lastKnifeTime = useRef<number>(0);

  // Grenades
  const [grenadeCharges, setGrenadeCharges] = useState<number>(WEAPON_CONFIG.GRENADE.MAX_CHARGES);
  const grenadeCooldownTimers = useRef<number[]>([]);
  const [grenades, setGrenades] = useState<{ id: string; startPos: THREE.Vector3; initialVel: THREE.Vector3 }[]>([]);

  // Three.js Raycaster for instant, rock-solid hitscan
  const raycaster = useRef(new THREE.Raycaster());

  useEffect(() => {
    if (onWeaponStateUpdate) {
      onWeaponStateUpdate({
        currentWeapon,
        ammo,
        isReloading,
        grenadeCharges,
        grenadeCooldownProgress: 0,
      });
    }
  }, [currentWeapon, ammo, isReloading, grenadeCharges, onWeaponStateUpdate]);

  // Grenade recharge loop
  useFrame(() => {
    const now = performance.now();
    if (grenadeCooldownTimers.current.length > 0) {
      const firstTimer = grenadeCooldownTimers.current[0];
      if (now - firstTimer >= WEAPON_CONFIG.GRENADE.COOLDOWN_MS) {
        grenadeCooldownTimers.current.shift();
        setGrenadeCharges((c) => Math.min(WEAPON_CONFIG.GRENADE.MAX_CHARGES, c + 1));
      }
    }
  });

  const triggerReload = () => {
    if (isReloading || ammo === WEAPON_CONFIG.PISTOL.MAG_SIZE) return;
    setIsReloading(true);
    setTimeout(() => {
      setAmmo(WEAPON_CONFIG.PISTOL.MAG_SIZE);
      setIsReloading(false);
    }, WEAPON_CONFIG.PISTOL.RELOAD_TIME_MS);
  };

  const throwGrenade = () => {
    if (grenadeCharges <= 0) return;
    setGrenadeCharges((c) => c - 1);
    grenadeCooldownTimers.current.push(performance.now());

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    const spawnPos = camera.position.clone().add(dir.clone().multiplyScalar(0.8));
    const impulse = dir.clone().multiplyScalar(WEAPON_CONFIG.GRENADE.THROW_IMPULSE).add(new THREE.Vector3(0, 4, 0));

    setGrenades((prev) => [
      ...prev,
      {
        id: `grenade_${Date.now()}_${Math.random()}`,
        startPos: spawnPos,
        initialVel: impulse,
      },
    ]);
  };

  const shootPistol = () => {
    const now = performance.now();
    if (isReloading || ammo <= 0) {
      if (ammo === 0 && !isReloading) triggerReload();
      return;
    }
    if (now - lastShotTime.current < WEAPON_CONFIG.PISTOL.FIRE_RATE_MS) {
      return;
    }

    lastShotTime.current = now;
    setAmmo((a) => a - 1);

    // Hitscan using camera ray
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    for (const hit of intersects) {
      const obj = hit.object;
      const userData = obj.userData;
      if (userData && userData.isTarget && typeof userData.onDamage === 'function') {
        const isHeadshot = userData.part === 'head';
        const damage = isHeadshot ? WEAPON_CONFIG.PISTOL.HEAD_DAMAGE : WEAPON_CONFIG.PISTOL.BODY_DAMAGE;
        userData.onDamage(damage);
        break; // Hit frontmost target
      }
      // If we hit level geometry, stop ray
      if (obj.type === 'Mesh') {
        break;
      }
    }
  };

  const swingKnife = () => {
    const now = performance.now();
    if (now - lastKnifeTime.current < WEAPON_CONFIG.KNIFE.COOLDOWN_MS) return;
    lastKnifeTime.current = now;

    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.current.far = WEAPON_CONFIG.KNIFE.RANGE;
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    raycaster.current.far = 1000;

    for (const hit of intersects) {
      const obj = hit.object;
      const userData = obj.userData;
      if (userData && userData.isTarget && typeof userData.onDamage === 'function') {
        userData.onDamage(WEAPON_CONFIG.KNIFE.DAMAGE);
        break;
      }
    }
  };

  // Keyboard & Mouse Listeners
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) {
        if (currentWeapon === 'PISTOL') shootPistol();
        else if (currentWeapon === 'KNIFE') swingKnife();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') triggerReload();
      if (e.code === 'KeyG') throwGrenade();
      if (e.code === 'Digit1') setCurrentWeapon('PISTOL');
      if (e.code === 'Digit2') setCurrentWeapon('KNIFE');
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentWeapon, ammo, isReloading, grenadeCharges]);

  // Movement Frame Loop
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const currentVel = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();

    // Resilient grounded check
    const isGrounded = Math.abs(currentVel.y) < 0.3 || pos.y <= 1.2;

    // Anchor camera height
    const targetHeight = isSliding ? MOVEMENT_CONFIG.CROUCH_HEIGHT : MOVEMENT_CONFIG.STAND_HEIGHT;
    camera.position.x = pos.x;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pos.y + targetHeight - 0.4, 0.25);
    camera.position.z = pos.z;

    // Camera view directions (pure horizontal)
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();
    right.current.crossVectors(forward.current, new THREE.Vector3(0, 1, 0)).normalize();

    moveDirection.current.set(0, 0, 0);
    if (keys.forward) moveDirection.current.add(forward.current);
    if (keys.backward) moveDirection.current.sub(forward.current);
    if (keys.right) moveDirection.current.add(right.current);
    if (keys.left) moveDirection.current.sub(right.current);

    if (moveDirection.current.lengthSq() > 0) {
      moveDirection.current.normalize();
    }

    const now = performance.now();
    let vx = currentVel.x;
    let vz = currentVel.z;
    let vy = currentVel.y;

    if (keys.slide && isGrounded && !isSliding) {
      setIsSliding(true);
      slideStartTime.current = now;
    } else if (!keys.slide && isSliding) {
      setIsSliding(false);
    }

    if (isGrounded) {
      if (isSliding) {
        const slideElapsed = now - slideStartTime.current;
        if (slideElapsed < MOVEMENT_CONFIG.SLIDE_DURATION_MS) {
          vx = forward.current.x * MOVEMENT_CONFIG.SLIDE_SPEED;
          vz = forward.current.z * MOVEMENT_CONFIG.SLIDE_SPEED;
        } else {
          vx *= MOVEMENT_CONFIG.SLIDE_FRICTION;
          vz *= MOVEMENT_CONFIG.SLIDE_FRICTION;
        }
      } else {
        if (moveDirection.current.lengthSq() > 0) {
          vx = moveDirection.current.x * MOVEMENT_CONFIG.WALK_SPEED;
          vz = moveDirection.current.z * MOVEMENT_CONFIG.WALK_SPEED;
        } else {
          vx = 0;
          vz = 0;
        }
      }

      if (keys.jump) {
        vy = MOVEMENT_CONFIG.JUMP_IMPULSE;
        if (isSliding) {
          vx *= 1.15;
          vz *= 1.15;
          setIsSliding(false);
        }
      }
    } else {
      // In-air control
      if (moveDirection.current.lengthSq() > 0) {
        // If falling from standstill, provide base air authority
        if (Math.hypot(vx, vz) < 2) {
          vx = moveDirection.current.x * 6.0;
          vz = moveDirection.current.z * 6.0;
        } else {
          vx += moveDirection.current.x * MOVEMENT_CONFIG.AIR_ACCELERATION * delta;
          vz += moveDirection.current.z * MOVEMENT_CONFIG.AIR_ACCELERATION * delta;
        }

        const currentSpeed = Math.hypot(vx, vz);
        if (currentSpeed > MOVEMENT_CONFIG.AIR_SPEED_CAP) {
          const ratio = MOVEMENT_CONFIG.AIR_SPEED_CAP / currentSpeed;
          vx *= ratio;
          vz *= ratio;
        }
      }
    }

    rigidBodyRef.current.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (onSpeedUpdate) {
      onSpeedUpdate(Math.round(Math.hypot(vx, vz) * 10) / 10);
    }
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 1.5, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={0}
        ccd={true}
      >
        <CapsuleCollider args={[0.5, 0.4]} />
      </RigidBody>

      {grenades.map((g) => (
        <GrenadeProjectile
          key={g.id}
          id={g.id}
          startPosition={g.startPos}
          initialVelocity={g.initialVel}
          onExplode={(id) => {
            setGrenades((prev) => prev.filter((item) => item.id !== id));
          }}
        />
      ))}
    </>
  );
};