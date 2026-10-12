import React, { useEffect, useRef } from 'react';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { WEAPON_CONFIG } from '@1v1/shared';

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
  const { rapier, world } = useRapier();

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.setLinvel(initialVelocity, true);
      bodyRef.current.setAngvel(
        {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          z: (Math.random() - 0.5) * 10,
        },
        true
      );
    }

    const timer = setTimeout(() => {
      if (bodyRef.current) {
        const trans = bodyRef.current.translation();
        const explodePos = new THREE.Vector3(trans.x, trans.y, trans.z);

        // Perform Rapier intersection sphere query for AOE damage
        const shape = new rapier.Ball(WEAPON_CONFIG.GRENADE.RADIUS);
        world.intersectionsWithShape(explodePos, { w: 1, x: 0, y: 0, z: 0 }, shape, (collider) => {
          const parent = collider.parent();
          const userData = parent?.userData as any;
          if (userData && userData.type === 'target' && typeof userData.onDamage === 'function') {
            userData.onDamage(WEAPON_CONFIG.GRENADE.DAMAGE);
          }
          return true;
        });

        onExplode(id, explodePos);
      }
    }, WEAPON_CONFIG.GRENADE.FUSE_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <RigidBody
      ref={bodyRef}
      colliders="ball"
      restitution={0.6}
      friction={0.4}
      position={[startPosition.x, startPosition.y, startPosition.z]}
      mass={0.8}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#15803d" roughness={0.5} metalness={0.6} />
      </mesh>
    </RigidBody>
  );
};