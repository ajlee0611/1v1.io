import React, { useRef, useState, useEffect, useCallback } from 'react';
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
  resetTrigger?: number;
  onSpeedUpdate?: (speed: number) => void;
  onWeaponStateUpdate?: (state: WeaponState) => void;
  onNetworkMove?: (x: number, y: number, z: number, yaw: number, pitch: number, isSliding: boolean, timestamp: number) => void;
  onNetworkShoot?: (weapon: WeaponType, origin: Vector3D, targetPos?: Vector3D, targetId?: string, hitZone?: 'head' | 'body') => void;
  onNetworkThrowGrenade?: (startPos: Vector3D, initialVel: Vector3D) => void;
  onGrenadeExplode?: (id: string, pos: THREE.Vector3) => void;
}

export const Player: React.FC<PlayerProps> = ({
  spawnSide = 'alpha',
  resetTrigger = 0,
  onSpeedUpdate,
  onWeaponStateUpdate,
  onNetworkMove,
  onNetworkShoot,
  onNetworkThrowGrenade,
  onGrenadeExplode,
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

  // Viewmodel Rigging Refs
  const viewmodelRootRef = useRef<THREE.Group>(null);
  const weaponOffsetRef = useRef<THREE.Group>(null);
  const isKnifing = useRef(false);
  const knifeSlashStartTime = useRef(0);

  // Weapon State: React state controls strict mounting/unmounting
  const [activeWeapon, setActiveWeapon] = useState<WeaponType>('PISTOL');
  const currentWeaponRef = useRef<WeaponType>('PISTOL');

  const [ammoCount, setAmmoCount] = useState<number>(WEAPON_CONFIG.PISTOL.MAG_SIZE);
  const ammoRef = useRef<number>(WEAPON_CONFIG.PISTOL.MAG_SIZE);
  ammoRef.current = ammoCount;

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

  const syncWeaponHUD = useCallback((ammo: number, charges: number, reloading: boolean, weapon: WeaponType) => {
    if (onWeaponStateUpdate) {
      onWeaponStateUpdate({
        currentWeapon: weapon,
        ammo,
        isReloading: reloading,
        grenadeCharges: charges,
      });
    }
  }, [onWeaponStateUpdate]);

  const selectWeapon = useCallback((weapon: WeaponType) => {
    currentWeaponRef.current = weapon;
    setActiveWeapon(weapon);
    syncWeaponHUD(ammoRef.current, grenadeChargesRef.current, isReloading.current, weapon);
  }, [syncWeaponHUD]);

  // Round reset: replenish weapons and reset physics transform
  useEffect(() => {
    ammoRef.current = WEAPON_CONFIG.PISTOL.MAG_SIZE;
    setAmmoCount(WEAPON_CONFIG.PISTOL.MAG_SIZE);
    isReloading.current = false;

    grenadeChargesRef.current = WEAPON_CONFIG.GRENADE.MAX_CHARGES;
    setGrenadeCharges(WEAPON_CONFIG.GRENADE.MAX_CHARGES);
    grenadeCooldownTimers.current = [];
    setGrenades([]);

    selectWeapon('PISTOL');

    if (rigidBodyRef.current) {
      const zSpawn = spawnSide === 'alpha' ? 18 : -18;
      rigidBodyRef.current.setTranslation({ x: 0, y: 1.0, z: zSpawn }, true);
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      rigidBodyRef.current.wakeUp();
    }
  }, [resetTrigger, spawnSide, selectWeapon]);

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
          keys.current.left = true;
          break;
        case 'KeyD':
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
          selectWeapon('PISTOL');
          break;
        case 'Digit2':
          selectWeapon('KNIFE');
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
          keys.current.left = false;
          break;
        case 'KeyD':
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
        if (currentWeaponRef.current === 'PISTOL') shootPistol();
        else if (currentWeaponRef.current === 'KNIFE') swingKnife();
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
  }, [selectWeapon]);

  const triggerReload = () => {
    if (isReloading.current || ammoRef.current === WEAPON_CONFIG.PISTOL.MAG_SIZE) return;
    isReloading.current = true;
    syncWeaponHUD(ammoRef.current, grenadeChargesRef.current, true, currentWeaponRef.current);

    setTimeout(() => {
      ammoRef.current = WEAPON_CONFIG.PISTOL.MAG_SIZE;
      setAmmoCount(WEAPON_CONFIG.PISTOL.MAG_SIZE);
      isReloading.current = false;
      syncWeaponHUD(WEAPON_CONFIG.PISTOL.MAG_SIZE, grenadeChargesRef.current, false, currentWeaponRef.current);
    }, WEAPON_CONFIG.PISTOL.RELOAD_TIME_MS);
  };

  const throwGrenade = () => {
    if (grenadeChargesRef.current <= 0) return;
    const nextCharges = grenadeChargesRef.current - 1;
    grenadeChargesRef.current = nextCharges;
    setGrenadeCharges(nextCharges);
    grenadeCooldownTimers.current.push(performance.now());
    syncWeaponHUD(ammoRef.current, nextCharges, isReloading.current, currentWeaponRef.current);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);

    const spawnPos = camera.position.clone().add(dir.clone().multiplyScalar(0.8));
    const impulse = dir.clone().multiplyScalar(49).add(new THREE.Vector3(0, 5.5, 0));

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
    if (isReloading.current || ammoRef.current <= 0) {
      if (ammoRef.current === 0 && !isReloading.current) triggerReload();
      return;
    }
    if (now - lastShotTime.current < WEAPON_CONFIG.PISTOL.FIRE_RATE_MS) return;

    lastShotTime.current = now;
    const nextAmmo = ammoRef.current - 1;
    ammoRef.current = nextAmmo;
    setAmmoCount(nextAmmo);
    syncWeaponHUD(nextAmmo, grenadeChargesRef.current, isReloading.current, 'PISTOL');
    sounds.playShoot();

    if (weaponOffsetRef.current) {
      weaponOffsetRef.current.position.z += 0.08;
      weaponOffsetRef.current.rotation.x += 0.12;
    }

    // Get right-hand gun barrel position by applying viewmodel offsets (+0.28 R, -0.20 U, -0.45 F) to camera look
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();

    const origin: Vector3D = {
      x: camera.position.x + (right.x * 0.28) + (up.x * -0.20) + (dir.x * 0.45),
      y: camera.position.y + (right.y * 0.28) + (up.y * -0.20) + (dir.y * 0.45),
      z: camera.position.z + (right.z * 0.28) + (up.z * -0.20) + (dir.z * 0.45),
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

        if (!targetId && typeof userData.onDamage === 'function') {
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
      const farPoint = camera.position.clone().add(dir.multiplyScalar(60));
      onNetworkShoot('PISTOL', origin, { x: farPoint.x, y: farPoint.y, z: farPoint.z });
    }
  };

  const swingKnife = () => {
    const now = performance.now();
    if (now - lastKnifeTime.current < WEAPON_CONFIG.KNIFE.COOLDOWN_MS) return;
    lastKnifeTime.current = now;

    isKnifing.current = true;
    knifeSlashStartTime.current = now;
    sounds.playKnifeSwing();

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();

    const origin: Vector3D = {
      x: camera.position.x + (right.x * 0.28) + (up.x * -0.20) + (dir.x * 0.45),
      y: camera.position.y + (right.y * 0.28) + (up.y * -0.20) + (dir.y * 0.45),
      z: camera.position.z + (right.z * 0.28) + (up.z * -0.20) + (dir.z * 0.45),
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
        if (!targetId && typeof userData.onDamage === 'function') {
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

    rigidBodyRef.current.wakeUp();

    const currentVel = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();
    const input = keys.current;

    const isGrounded = pos.y <= 1.05 || (Math.abs(currentVel.y) < 0.1 && pos.y < 3.5);

    const targetHeight = isSliding.current ? MOVEMENT_CONFIG.CROUCH_HEIGHT : MOVEMENT_CONFIG.STAND_HEIGHT;
    camera.position.x = pos.x;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pos.y + targetHeight - 0.35, 0.25);
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

    const hasInput = moveDirection.current.lengthSq() > 0;
    if (hasInput) {
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
        if (hasInput) {
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
      if (hasInput) {
        if (Math.hypot(vx, vz) < 2) {
          vx = moveDirection.current.x * 8.0;
          vz = moveDirection.current.z * 8.0;
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

    if (onNetworkMove && now - lastNetworkSend.current > 33) {
      lastNetworkSend.current = now;
      onNetworkMove(pos.x, pos.y, pos.z, camera.rotation.y, camera.rotation.x, isSliding.current, Date.now());
    }

    // ==========================================
    // VIEWMODEL POSITIONING & ANIMATION
    // ==========================================
    if (viewmodelRootRef.current && weaponOffsetRef.current) {
      // Direct camera tracking
      viewmodelRootRef.current.position.copy(camera.position);
      viewmodelRootRef.current.quaternion.copy(camera.quaternion);

      const isWalking = hasInput && isGrounded;
      const bobFreq = isWalking ? 12 : 3;
      const bobAmp = isWalking ? 0.015 : 0.003;
      const bobX = Math.cos(now * 0.006 * bobFreq) * bobAmp;
      const bobY = Math.sin(now * 0.012 * bobFreq) * bobAmp;

      if (isKnifing.current) {
        const slashDuration = 220;
        const progress = (now - knifeSlashStartTime.current) / slashDuration;

        if (progress < 1.0) {
          const swingPhase = Math.sin(progress * Math.PI);
          const slashAngle = progress * Math.PI * 0.9;

          weaponOffsetRef.current.position.set(
            0.28 - swingPhase * 0.45 + bobX,
            -0.24 + Math.sin(progress * Math.PI) * 0.15 + bobY,
            -0.45 - swingPhase * 0.22
          );

          weaponOffsetRef.current.rotation.set(
            0.2 + swingPhase * 0.8,
            -0.3 - slashAngle,
            -swingPhase * 1.4
          );
        } else {
          isKnifing.current = false;
        }
      } else {
        const targetPos = new THREE.Vector3(0.28 + bobX, -0.25 + bobY, -0.45);
        const targetRot = new THREE.Euler(0, 0, 0);

        weaponOffsetRef.current.position.lerp(targetPos, 0.25);
        weaponOffsetRef.current.rotation.x = THREE.MathUtils.lerp(weaponOffsetRef.current.rotation.x, targetRot.x, 0.25);
        weaponOffsetRef.current.rotation.y = THREE.MathUtils.lerp(weaponOffsetRef.current.rotation.y, targetRot.y, 0.25);
        weaponOffsetRef.current.rotation.z = THREE.MathUtils.lerp(weaponOffsetRef.current.rotation.z, targetRot.z, 0.25);
      }
    }
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        colliders={false}
        mass={1}
        type="dynamic"
        position={[0, 1.0, spawnSide === 'alpha' ? 18 : -18]}
        enabledRotations={[false, false, false]}
        linearDamping={0}
        angularDamping={0}
        ccd={true}
      >
        <CapsuleCollider args={[0.5, 0.4]} friction={0} restitution={0} />
      </RigidBody>

      {/* VIEWMODEL ROOT: Positioned directly in world space to track camera cleanly */}
      <group ref={viewmodelRootRef}>
        <group ref={weaponOffsetRef} position={[0.28, -0.25, -0.45]}>
          {/* Arm Sleeve & Glove */}
          <mesh position={[0.08, -0.22, 0.25]} rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.12, 0.45, 0.14]} />
            <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.1} />
          </mesh>

          <mesh position={[0.04, -0.04, 0.12]}>
            <boxGeometry args={[0.1, 0.12, 0.12]} />
            <meshStandardMaterial color="#1e293b" roughness={0.6} />
          </mesh>

          {/* STRICT CONDITIONAL MOUNTING: Exactly one weapon model exists at any time */}
          {activeWeapon === 'PISTOL' ? (
            <group key="viewmodel_pistol">
              {/* Lower Grip (Coyote Sand) */}
              <mesh position={[0, -0.03, -0.03]} rotation={[-0.2, 0, 0]}>
                <boxGeometry args={[0.065, 0.14, 0.1]} />
                <meshStandardMaterial color="#d97706" roughness={0.5} metalness={0.2} />
              </mesh>

              {/* Slide (Silver Chrome) */}
              <mesh position={[0, 0.05, -0.07]}>
                <boxGeometry args={[0.062, 0.07, 0.28]} />
                <meshStandardMaterial color="#f1f5f9" metalness={0.9} roughness={0.2} />
              </mesh>

              {/* Barrel (Titanium) */}
              <mesh position={[0, 0.05, -0.22]}>
                <boxGeometry args={[0.04, 0.04, 0.04]} />
                <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.3} />
              </mesh>

              {/* Cyan Optic Glow Bead */}
              <mesh position={[0, 0.09, -0.2]}>
                <boxGeometry args={[0.015, 0.015, 0.02]} />
                <meshBasicMaterial color="#06b6d4" />
              </mesh>
            </group>
          ) : (
            <group key="viewmodel_knife">
              {/* Pommel Cap (Orange) */}
              <mesh position={[0, 0, 0.16]}>
                <cylinderGeometry args={[0.025, 0.025, 0.03, 12]} />
                <meshStandardMaterial color="#ea580c" metalness={0.7} roughness={0.3} />
              </mesh>

              {/* Straight Handle / Grip (Brown Leather) */}
              <mesh position={[0, 0, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.024, 0.024, 0.16, 12]} />
                <meshStandardMaterial color="#78350f" roughness={0.7} metalness={0.1} />
              </mesh>

              {/* Crossguard Bar (Slate) */}
              <mesh position={[0, 0, -0.03]}>
                <boxGeometry args={[0.1, 0.025, 0.02]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
              </mesh>

              {/* Straight Blade Body (Polished Silver) */}
              <mesh position={[0, 0, -0.2]}>
                <boxGeometry args={[0.008, 0.04, 0.32]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.98} roughness={0.1} />
              </mesh>

              {/* Tapered Straight Tip (Polished Silver) */}
              <mesh position={[0, 0, -0.38]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.02, 0.05, 4]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.98} roughness={0.1} />
              </mesh>
            </group>
          )}
        </group>
      </group>

      {grenades.map((g) => (
        <GrenadeProjectile
          key={g.id}
          id={g.id}
          startPosition={g.startPos}
          initialVelocity={g.initialVel}
          onExplode={(id, pos) => {
            if (onGrenadeExplode) {
              onGrenadeExplode(id, pos);
            }
            setTimeout(() => {
              setGrenades((prev) => prev.filter((item) => item.id !== id));
            }, 500);
          }}
        />
      ))}
    </>
  );
};

export default Player;