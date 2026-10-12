import React, { useEffect, useRef, useState } from 'react';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sounds } from '../utils/sound';

interface GrenadeProps {
  id: string;
  startPosition: THREE.Vector3;
  initialVelocity: THREE.Vector3;
  onExplode: (id: string, explodePos: THREE.Vector3) => void;
}

export const GrenadeProjectile: React.FC<GrenadeProps> = ({
  id,
  startPosition,
  initialVelocity,
  onExplode,
}) => {
  const bodyRef = useRef<RapierRigidBody>(null);
  const flashMeshRef = useRef<THREE.Mesh>(null);
  const fuseLightRef = useRef<THREE.PointLight>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);

  const [exploded, setExploded] = useState(false);
  const explodedRef = useRef(false);
  const [detonationPos, setDetonationPos] = useState<THREE.Vector3>(startPosition);

  const onExplodeRef = useRef(onExplode);
  onExplodeRef.current = onExplode;
  const startPosRef = useRef(startPosition);
  const initVelRef = useRef(initialVelocity);

  const FUSE_MS = 1600;
  const startTime = useRef(performance.now());

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.setLinvel(initVelRef.current, true);
      bodyRef.current.setAngvel(
        {
          x: (Math.random() - 0.5) * 8 + 4,
          y: (Math.random() - 0.5) * 4,
          z: (Math.random() - 0.5) * 8,
        },
        true
      );
    }

    const timer = setTimeout(() => {
      explodedRef.current = true;
      let finalPos = startPosRef.current.clone();

      if (bodyRef.current) {
        try {
          const t = bodyRef.current.translation();
          finalPos.set(t.x, t.y, t.z);
          // Zero velocity to freeze at impact spot
          bodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
          bodyRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        } catch {
          // ignore
        }
      }

      sounds.playExplosion();
      setDetonationPos(finalPos);
      setExploded(true);
      onExplodeRef.current(id, finalPos);
    }, FUSE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useFrame(() => {
    if (!explodedRef.current) {
      const elapsed = performance.now() - startTime.current;
      const progress = Math.min(1, elapsed / FUSE_MS);
      const blink = Math.sin(progress * (8 + progress * 24) * Math.PI) > 0;

      if (fuseLightRef.current) {
        fuseLightRef.current.intensity = blink ? 3.5 : 0;
      }
      if (flashMeshRef.current && flashMeshRef.current.material) {
        (flashMeshRef.current.material as THREE.MeshBasicMaterial).color.set(
          blink ? '#ef4444' : '#450a0a'
        );
      }
    } else if (shockwaveRef.current) {
      shockwaveRef.current.scale.addScalar(0.35);
      const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
      if (mat && typeof mat.opacity === 'number') {
        mat.opacity = Math.max(0, mat.opacity - 0.06);
      }
    }
  });

  return (
    <group>
      {/* Physical Grenade Body - remains mounted until parent unmounts */}
      <RigidBody
        ref={bodyRef}
        colliders="hull"
        restitution={0.2}
        friction={0.9}
        linearDamping={0.8}
        angularDamping={3.5}
        gravityScale={3.2}
        position={[startPosition.x, startPosition.y, startPosition.z]}
        mass={3.0}
        ccd={true}
      >
        <group visible={!exploded}>
          {/* Main Canister Body */}
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.16, 0.16, 0.38, 16]} />
            <meshStandardMaterial color="#2d371e" roughness={0.6} metalness={0.4} />
          </mesh>

          {/* Steel Rib Rings */}
          {[-0.1, 0, 0.1].map((yOffset, i) => (
            <mesh key={i} position={[0, yOffset, 0]}>
              <torusGeometry args={[0.165, 0.018, 8, 16]} />
              <meshStandardMaterial color="#1f2615" roughness={0.7} metalness={0.5} />
            </mesh>
          ))}

          {/* Steel Neck Assembly */}
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.08, 0.1, 0.08, 12]} />
            <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
          </mesh>

          {/* Safety Fuse Cap */}
          <mesh position={[0, 0.27, 0]}>
            <boxGeometry args={[0.07, 0.06, 0.07]} />
            <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
          </mesh>

          {/* Spoon Lever */}
          <mesh position={[0.09, 0.14, 0]} rotation={[0, 0, -0.15]}>
            <boxGeometry args={[0.02, 0.28, 0.05]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.9} />
          </mesh>

          {/* Safety Pull-Ring */}
          <mesh position={[-0.08, 0.26, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.04, 0.008, 8, 16]} />
            <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.95} />
          </mesh>

          {/* Blinking Detonation LED */}
          <mesh ref={flashMeshRef} position={[0, 0.31, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <pointLight ref={fuseLightRef} position={[0, 0.33, 0]} color="#ef4444" distance={2} intensity={0} />
        </group>
      </RigidBody>

      {/* Explosion Fireball Flash */}
      {exploded && (
        <group position={[detonationPos.x, detonationPos.y, detonationPos.z]}>
          <mesh ref={shockwaveRef}>
            <sphereGeometry args={[0.9, 16, 16]} />
            <meshBasicMaterial color="#f97316" transparent opacity={0.85} />
          </mesh>
          <pointLight color="#f97316" intensity={12} distance={10} decay={2} />
        </group>
      )}
    </group>
  );
};