import React, { useEffect, useRef } from 'react';
import { RigidBody, RapierRigidBody, useRapier } from '@react-three/rapier';
import * as THREE from 'three';
import { WEAPON_CONFIG } from '@1v1/shared';
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
  const { rapier, world } = useRapier();

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.setLinvel(initialVelocity, true);
      // Give realistic initial tumble
      bodyRef.current.setAngvel(
        {
          x: (Math.random() - 0.5) * 4,
          y: (Math.random() - 0.5) * 2,
          z: (Math.random() - 0.5) * 4,
        },
        true
      );
    }

    const timer = setTimeout(() => {
      if (bodyRef.current && world && rapier) {
        const trans = bodyRef.current.translation();
        const explodePos = new THREE.Vector3(trans.x, trans.y, trans.z);
        sounds.playExplosion();

        try {
          const shape = new rapier.Ball(WEAPON_CONFIG.GRENADE.RADIUS);
          world.intersectionsWithShape(explodePos, { w: 1, x: 0, y: 0, z: 0 }, shape, (collider) => {
            const parent = collider.parent();
            const userData = parent?.userData as any;
            if (userData && userData.type === 'target' && typeof userData.onDamage === 'function') {
              userData.onDamage(WEAPON_CONFIG.GRENADE.DAMAGE, explodePos);
            }
            return true;
          });
        } catch {
          // ignore
        }

        onExplode(id, explodePos);
      }
    }, WEAPON_CONFIG.GRENADE.FUSE_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <RigidBody
      ref={bodyRef}
      colliders="ball"
      restitution={0.35}
      friction={0.9}
      linearDamping={1.2}
      angularDamping={4.0}
      position={[startPosition.x, startPosition.y, startPosition.z]}
      mass={1.5}
      ccd={true}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#15803d" roughness={0.6} metalness={0.4} />
      </mesh>
    </RigidBody>
  );
};