import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { MOVEMENT_CONFIG, WEAPON_CONFIG, type WeaponType, type Vector3D } from '@1v1/shared';
import { GrenadeProjectile } from './GrenadeProjectile';
import { sounds } from '../utils/sound';

export interface WeaponState {
  currentWeapon: WeaponType;
  ammo: number;
  isReloading: boolean;
  grenadeCharges: number;
}

interface PlayerProps {
  spawnSide?: 'alpha' | 'bravo';
  onSpeedUpdate?: (speed: number) => void;
  onWeaponStateUpdate?: (state: WeaponState) => void;
  onNetworkMove?: (x: number, y: number, z: number, yaw: number, pitch: number, isSliding: boolean, timestamp: number) => void;
  onNetworkShoot?: (weapon: WeaponType, origin: Vector3D, targetPos?: Vector3D, targetId?: string, hitZone?: 'head' | 'body') => void;
  onNetworkThrowGrenade?: (startPos: Vector3D, initialVel: Vector3D) => void;
}

export const Player: React.FC<PlayerProps> = ({
  spawnSide = 'alpha',
  onSpeedUpdate,
  onWeaponStateUpdate,
  onNetworkMove,
  onNetworkShoot,
  onNetworkThrowGrenade,
}) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const { camera, scene } = useThree();

  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    slide: false,
  });

  const isSliding = useRef(false);
  const slideStartTime = useRef(0);
  const forwardVec = useRef(new THREE.Vector3());
  const rightVec = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());

  const currentWeapon = useRef<WeaponType>('PISTOL');
  const ammo = useRef<number>(WEAPON_CONFIG.PISTOL.MAG_SIZE);
  const isReloading = useRef<boolean>(false);
  const lastShotTime = useRef<number>(0);
  const lastKnifeTime = useRef<number>(0);

  const [grenadeCharges, setGrenadeCharges] = useState<number>(WEAPON_CONFIG.GRENADE.MAX_CHARGES);
  const grenadeChargesRef = useRef<number>(WEAPON_CONFIG.GRENADE.MAX_CHARGES);
  grenadeChargesRef.current = grenadeCharges;
  const grenadeCooldownTimers = useRef<number[]>([]);
  const [grenades, setGrenades] = useState<{ id: string; startPos: THREE.Vector3; initialVel: THREE.Vector3 }[]>([]);

  const raycaster = useRef(new THREE.Raycaster());
  const lastNetworkSend = useRef(0);

  useEffect(() => {
    if (rigidBodyRef.current) {
      const zSpawn = spawnSide === 'alpha' ? 18 : -18;
      const initialYaw = spawnSide === 'alpha' ? Math.PI : 0;
      rigidBodyRef.current.setTranslation({ x: 0, y: 1.5, z: zSpawn }, true);
      camera.rotation.set(0, initialYaw, 0, 'YXZ');
    }
  }, [spawnSide, camera]);

  const syncWeaponHUD = () => {
    if (onWeaponStateUpdate) {
      onWeaponStateUpdate({
        currentWeapon: currentWeapon.current,
        ammo: ammo.current,
        isReloading: isReloading.current,
        grenadeCharges: grenadeChargesRef.current,
      });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = true;
          break;
        case 'Space':
          keys.current.jump = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
          keys.current.slide = true;
          break;
        case 'KeyR':
          triggerReload();
          break;
        case 'KeyG':
          throwGrenade();
          break;
        case 'Digit1':
          currentWeapon.current = 'PISTOL';
          syncWeaponHUD();
          break;
        case 'Digit2':
          currentWeapon.current = 'KNIFE';
          syncWeaponHUD();
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.current.right = false;
          break;
        case 'Space':
          keys.current.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
        case 'KeyC':
          keys.current.slide = false;
          break;
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) {
        if (currentWeapon.current === 'PISTOL') shootPistol();
        else if (currentWeapon.current === 'KNIFE') swingKnife();
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  const triggerReload = () => {
    if (isReloading.current || ammo.current === WEAPON_CONFIG.PISTOL.MAG_SIZE) return;
    isReloading.current = true;
    syncWeaponHUD();

    setTimeout(() => {
      ammo.current = WEAPON_CONFIG.PISTOL.MAG_SIZE;
      isReloading.current = false;
      syncWeaponHUD();
    }, WEAPON_CONFIG.PISTOL.RELOAD_TIME_MS);
  };

  const throwGrenade = () => {
    if (grenadeChargesRef.current <= 0) return;
    setGrenadeCharges((c) => {
      const next = c - 1;
      grenadeChargesRef.current = next;
      syncWeaponHUD();
      return next;
    });
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

    if (onNetworkThrowGrenade) {
      onNetworkThrowGrenade(
        { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
        { x: impulse.x, y: impulse.y, z: impulse.z }
      );
    }
  };

  const shootPistol = () => {
    const now = performance.now();
    if (isReloading.current || ammo.current <= 0) {
      if (ammo.current === 0 && !isReloading.current) triggerReload();
      return;
    }
    if (now - lastShotTime.current < WEAPON_CONFIG.PISTOL.FIRE_RATE_MS) return;

    lastShotTime.current = now;
    ammo.current -= 1;
    syncWeaponHUD();
    sounds.playShoot();

    const origin: Vector3D = {
      x: camera.position.x,
      y: camera.position.y - 0.2,
      z: camera.position.z,
    };

    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const intersects = raycaster.current.intersectObjects(scene.children, true);

    let hitTarget = false;
    for (const hit of intersects) {
      const obj = hit.object;
      const userData = obj.userData;
      if (userData && userData.isTarget) {
        hitTarget = true;
        const hitZone = userData.part as 'head' | 'body';
        const targetId = userData.targetId as string | undefined;
        const targetPos: Vector3D = { x: hit.point.x, y: hit.point.y, z: hit.point.z };

        if (typeof userData.onDamage === 'function') {
          userData.onDamage(
            hitZone === 'head' ? WEAPON_CONFIG.PISTOL.HEAD_DAMAGE : WEAPON_CONFIG.PISTOL.BODY_DAMAGE,
            hit.point
          );
        }

        if (onNetworkShoot) {
          onNetworkShoot('PISTOL', origin, targetPos, targetId, hitZone);
        }
        break;
      }
      if (obj.type === 'Mesh') {
        const targetPos: Vector3D = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
        if (onNetworkShoot) {
          onNetworkShoot('PISTOL', origin, targetPos);
        }
        break;
      }
    }

    if (!hitTarget && onNetworkShoot) {
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const farPoint = camera.position.clone().add(dir.multiplyScalar(60));
      onNetworkShoot('PISTOL', origin, { x: farPoint.x, y: farPoint.y, z: farPoint.z });
    }
  };

  const swingKnife = () => {
    const now = performance.now();
    if (now - lastKnifeTime.current < WEAPON_CONFIG.KNIFE.COOLDOWN_MS) return;
    lastKnifeTime.current = now;
    sounds.playKnifeSwing();

    const origin: Vector3D = {
      x: camera.position.x,
      y: camera.position.y - 0.2,
      z: camera.position.z,
    };

    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    raycaster.current.far = WEAPON_CONFIG.KNIFE.RANGE;
    const intersects = raycaster.current.intersectObjects(scene.children, true);
    raycaster.current.far = 1000;

    let hitTarget = false;
    for (const hit of intersects) {
      const obj = hit.object;
      const userData = obj.userData;
      if (userData && userData.isTarget) {
        hitTarget = true;
        const targetId = userData.targetId as string | undefined;
        const targetPos: Vector3D = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
        if (typeof userData.onDamage === 'function') {
          userData.onDamage(WEAPON_CONFIG.KNIFE.DAMAGE, hit.point);
        }
        if (onNetworkShoot) {
          onNetworkShoot('KNIFE', origin, targetPos, targetId, 'body');
        }
        break;
      }
    }

    if (!hitTarget && onNetworkShoot) {
      onNetworkShoot('KNIFE', origin);
    }
  };

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const currentVel = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();
    const input = keys.current;

    const isGrounded = pos.y <= 1.3 || Math.abs(currentVel.y) < 0.35;

    const targetHeight = isSliding.current ? MOVEMENT_CONFIG.CROUCH_HEIGHT : MOVEMENT_CONFIG.STAND_HEIGHT;
    camera.position.x = pos.x;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pos.y + targetHeight - 0.4, 0.25);
    camera.position.z = pos.z;

    camera.getWorldDirection(forwardVec.current);
    forwardVec.current.y = 0;
    forwardVec.current.normalize();
    rightVec.current.crossVectors(forwardVec.current, new THREE.Vector3(0, 1, 0)).normalize();

    moveDirection.current.set(0, 0, 0);
    if (input.forward) moveDirection.current.add(forwardVec.current);
    if (input.backward) moveDirection.current.sub(forwardVec.current);
    if (input.right) moveDirection.current.add(rightVec.current);
    if (input.left) moveDirection.current.sub(rightVec.current);

    if (moveDirection.current.lengthSq() > 0) {
      moveDirection.current.normalize();
    }

    const now = performance.now();
    let vx = currentVel.x;
    let vz = currentVel.z;
    let vy = currentVel.y;

    if (input.slide && isGrounded && !isSliding.current) {
      isSliding.current = true;
      slideStartTime.current = now;
    } else if (!input.slide && isSliding.current) {
      isSliding.current = false;
    }

    if (isGrounded) {
      if (isSliding.current) {
        const slideElapsed = now - slideStartTime.current;
        if (slideElapsed < MOVEMENT_CONFIG.SLIDE_DURATION_MS) {
          vx = forwardVec.current.x * MOVEMENT_CONFIG.SLIDE_SPEED;
          vz = forwardVec.current.z * MOVEMENT_CONFIG.SLIDE_SPEED;
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

      if (input.jump) {
        vy = MOVEMENT_CONFIG.JUMP_IMPULSE;
        if (isSliding.current) {
          vx *= 1.15;
          vz *= 1.15;
          isSliding.current = false;
        }
      }
    } else {
      if (moveDirection.current.lengthSq() > 0) {
        vx += moveDirection.current.x * MOVEMENT_CONFIG.AIR_ACCELERATION * delta;
        vz += moveDirection.current.z * MOVEMENT_CONFIG.AIR_ACCELERATION * delta;

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

    if (onNetworkMove && now - lastNetworkSend.current > 33) {
      lastNetworkSend.current = now;
      onNetworkMove(pos.x, pos.y, pos.z, camera.rotation.y, camera.rotation.x, isSliding.current, Date.now());
    }
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 1.5, spawnSide === 'alpha' ? 18 : -18]}
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