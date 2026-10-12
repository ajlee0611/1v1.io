import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { MOVEMENT_CONFIG } from '@1v1/shared';
import { useKeyboard } from '../hooks/useKeyboard';

interface PlayerProps {
  onSpeedUpdate?: (speed: number) => void;
}

export const Player: React.FC<PlayerProps> = ({ onSpeedUpdate }) => {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const keys = useKeyboard();

  const [isSliding, setIsSliding] = useState(false);
  const slideStartTime = useRef<number>(0);

  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const moveDirection = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const currentVel = rigidBodyRef.current.linvel();
    const pos = rigidBodyRef.current.translation();

    // Floor height clamp check
    const isGrounded = Math.abs(currentVel.y) < 0.1 || pos.y <= 1.05;

    // Camera height adjustment
    const targetHeight = isSliding ? MOVEMENT_CONFIG.CROUCH_HEIGHT : MOVEMENT_CONFIG.STAND_HEIGHT;
    camera.position.x = pos.x;
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, pos.y + targetHeight - 0.5, 0.25);
    camera.position.z = pos.z;

    // View direction relative to camera
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

    // Slide state toggle
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

      // Jump & Slide Hop
      if (keys.jump) {
        vy = MOVEMENT_CONFIG.JUMP_IMPULSE;
        if (isSliding) {
          vx *= 1.15;
          vz *= 1.15;
          setIsSliding(false);
        }
      }
    } else {
      // Air strafing
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

    // Set linear velocity with continuous collision detection
    rigidBodyRef.current.setLinvel({ x: vx, y: vy, z: vz }, true);

    if (onSpeedUpdate) {
      const hSpeed = Math.hypot(vx, vz);
      onSpeedUpdate(Math.round(hSpeed * 10) / 10);
    }
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
      ccd={true}
    >
      <CapsuleCollider args={[0.5, 0.4]} />
    </RigidBody>
  );
};