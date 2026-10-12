import React from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';

export const Arena: React.FC = () => {
  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" friction={0}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[50, 1, 50]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>
      </RigidBody>

      {/* Grid Floor Overlay */}
      <gridHelper args={[50, 50, '#38bdf8', '#1e293b']} position={[0, 0.01, 0]} />

      {/* Perimeter Walls */}
      <RigidBody type="fixed">
        {/* North */}
        <CuboidCollider args={[25, 4, 0.5]} position={[0, 4, -25]} />
        <mesh position={[0, 4, -25]}>
          <boxGeometry args={[50, 8, 1]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* South */}
        <CuboidCollider args={[25, 4, 0.5]} position={[0, 4, 25]} />
        <mesh position={[0, 4, 25]}>
          <boxGeometry args={[50, 8, 1]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* West */}
        <CuboidCollider args={[0.5, 4, 25]} position={[-25, 4, 0]} />
        <mesh position={[-25, 4, 0]}>
          <boxGeometry args={[1, 8, 50]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* East */}
        <CuboidCollider args={[0.5, 4, 25]} position={[25, 4, 0]} />
        <mesh position={[25, 4, 0]}>
          <boxGeometry args={[1, 8, 50]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </RigidBody>

      {/* Center Structure & Cover Pillars */}
      <RigidBody type="fixed">
        {/* Central pillar */}
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 5, 4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>

        {/* Low cover boxes for jumping over */}
        <mesh position={[-10, 0.75, -10]} castShadow receiveShadow>
          <boxGeometry args={[4, 1.5, 2]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        <mesh position={[10, 0.75, 10]} castShadow receiveShadow>
          <boxGeometry args={[4, 1.5, 2]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>

        {/* Elevated platforms */}
        <mesh position={[-12, 1.5, 12]} castShadow receiveShadow>
          <boxGeometry args={[6, 3, 6]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>
        <mesh position={[12, 1.5, -12]} castShadow receiveShadow>
          <boxGeometry args={[6, 3, 6]} />
          <meshStandardMaterial color="#ea580c" />
        </mesh>
      </RigidBody>
    </group>
  );
};