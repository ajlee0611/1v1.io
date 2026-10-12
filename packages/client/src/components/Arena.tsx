import React from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';

export const Arena: React.FC = () => {
  return (
    <group>
      {/* Floor */}
      <RigidBody type="fixed" friction={0}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[40, 1, 40]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
      </RigidBody>

      {/* Grid Floor Overlay for motion reference */}
      <gridHelper args={[40, 40, '#475569', '#334155']} position={[0, 0.01, 0]} />

      {/* Boundary Walls */}
      <RigidBody type="fixed">
        {/* North */}
        <CuboidCollider args={[20, 4, 0.5]} position={[0, 4, -20]} />
        <mesh position={[0, 4, -20]}>
          <boxGeometry args={[40, 8, 1]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* South */}
        <CuboidCollider args={[20, 4, 0.5]} position={[0, 4, 20]} />
        <mesh position={[0, 4, 20]}>
          <boxGeometry args={[40, 8, 1]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* West */}
        <CuboidCollider args={[0.5, 4, 20]} position={[-20, 4, 0]} />
        <mesh position={[-20, 4, 0]}>
          <boxGeometry args={[1, 8, 40]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        {/* East */}
        <CuboidCollider args={[0.5, 4, 20]} position={[20, 4, 0]} />
        <mesh position={[20, 4, 0]}>
          <boxGeometry args={[1, 8, 40]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </RigidBody>

      {/* Cover Pillars & Obstacles */}
      <RigidBody type="fixed">
        <mesh position={[-8, 2, -8]} castShadow receiveShadow>
          <boxGeometry args={[3, 4, 3]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        <mesh position={[8, 2, 8]} castShadow receiveShadow>
          <boxGeometry args={[3, 4, 3]} />
          <meshStandardMaterial color="#0284c7" />
        </mesh>
        <mesh position={[-8, 2, 8]} castShadow receiveShadow>
          <boxGeometry args={[3, 4, 3]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
        <mesh position={[8, 2, -8]} castShadow receiveShadow>
          <boxGeometry args={[3, 4, 3]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
      </RigidBody>
    </group>
  );
};