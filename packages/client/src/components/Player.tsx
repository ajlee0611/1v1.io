import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { MOVEMENT_CONFIG } from '@1v1/shared';
import { useKeyboard } from '../hooks/useKeyboard';

export const Player: React.FC = () => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const keys = useKeyboard();

  const [isSliding, setIsSliding] = useState(false);
  const slideStartTime = useRef<number>(0);

  // Reusable math vectors to avoid garbage collection allocations
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const currentVel = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();

    // 1. Raycast-free reliable ground check: check if downward velocity is small and height is near floor
    const isGrounded = Math.abs(currentVel.y) < 0.1 || pos.y <= 1.05;

    // 2. Camera positioning (anchor camera to physics capsule with crouch lerp)
    const targetHeight = isSliding ? MOVEMENT_CONFIG.CROUCH_HEIGHT : MOVEMENT_CONFIG.STAND_HEIGHT;
    camera.position.x = pos.x;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pos.y + targetHeight - 0.5, 0.25);
    camera.position.z = pos.z;

    // 3. Extract pure horizontal forward & right vectors from camera
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    forward.current.normalize();

    right.current.crossVectors(forward.current, new THREE.Vector3(0, 1, 0)).normalize();

    // 4. Calculate desired horizontal movement vector
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

    // 5. Slide logic
    if (keys.slide && isGrounded && !isSliding) {
      setIsSliding(true);
      slideStartTime.current = now;
    } else if (!keys.slide && isSliding) {
      setIsSliding(false);
    }

    // 6. Movement calculation
    if (isGrounded) {
      if (isSliding) {
        const slideElapsed = now - slideStartTime.current;
        if (slideElapsed < MOVEMENT_CONFIG.SLIDE_DURATION_MS) {
          // Burst forward in camera direction
          vx = forward.current.x * MOVEMENT_CONFIG.SLIDE_SPEED;
          vz = forward.current.z * MOVEMENT_CONFIG.SLIDE_SPEED;
        } else {
          // Slide bleed-off
          vx *= MOVEMENT_CONFIG.SLIDE_FRICTION;
          vz *= MOVEMENT_CONFIG.SLIDE_FRICTION;
        }
      } else {
        // Instant acceleration & instant braking on ground
        if (moveDirection.current.lengthSq() > 0) {
          vx = moveDirection.current.x * MOVEMENT_CONFIG.WALK_SPEED;
          vz = moveDirection.current.z * MOVEMENT_CONFIG.WALK_SPEED;
        } else {
          vx = 0;
          vz = 0;
        }
      }

      // Jump & Slide Hop
      if (keys.jump) {
        vy = MOVEMENT_CONFIG.JUMP_IMPULSE;
        if (isSliding) {
          // Carry and amplify slide impulse into the jump
          vx *= 1.15;
          vz *= 1.15;
          setIsSliding(false);
        }
      }
    } else {
      // Air strafing: Add lateral acceleration without killing existing speed
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
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      colliders={false}
      mass={1}
      type="dynamic"
      position={[0, 1.5, 0]}
      enabledRotations={[false, false, false]}
      linearDamping={0}
    >
      <CapsuleCollider args={[0.5, 0.4]} />
    </RigidBody>
  );
};