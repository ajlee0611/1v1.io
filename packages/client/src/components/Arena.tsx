import React from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';

export const Arena: React.FC = () => {
  return (
    <group>
      {/* Floor - Clean Off-White */}
      <RigidBody type="fixed" friction={0} restitution={0}>
        <mesh receiveShadow position={[0, -0.5, 0]}>
          <boxGeometry args={[50, 1, 50]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.4} metalness={0.05} />
        </mesh>
      </RigidBody>

      {/* Grid Floor Overlay - Subtle slate contrast grid */}
      <gridHelper args={[50, 50, '#94a3b8', '#cbd5e1']} position={[0, 0.01, 0]} />

      {/* Perimeter Walls - Clean White with Slate Trim */}
      <RigidBody type="fixed">
        {/* North Wall */}
        <CuboidCollider args={[25, 4, 0.5]} position={[0, 4, -25]} />
        <mesh position={[0, 4, -25]} receiveShadow>
          <boxGeometry args={[50, 8, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>

        {/* South Wall */}
        <CuboidCollider args={[25, 4, 0.5]} position={[0, 4, 25]} />
        <mesh position={[0, 4, 25]} receiveShadow>
          <boxGeometry args={[50, 8, 1]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>

        {/* West Wall */}
        <CuboidCollider args={[0.5, 4, 25]} position={[-25, 4, 0]} />
        <mesh position={[-25, 4, 0]} receiveShadow>
          <boxGeometry args={[1, 8, 50]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>

        {/* East Wall */}
        <CuboidCollider args={[0.5, 4, 25]} position={[25, 4, 0]} />
        <mesh position={[25, 4, 0]} receiveShadow>
          <boxGeometry args={[1, 8, 50]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      </RigidBody>

      {/* Obstacles & Cover Elements - Neutral Grays */}
      <RigidBody type="fixed">
        {/* Central Monolith Pillar - Mid Slate Gray */}
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 5, 4]} />
          <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.2} />
        </mesh>

        {/* Low Cover Boxes - Cool Light Slate Gray */}
        <mesh position={[-10, 0.75, -10]} castShadow receiveShadow>
          <boxGeometry args={[4, 1.5, 2]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.15} />
        </mesh>
        <mesh position={[10, 0.75, 10]} castShadow receiveShadow>
          <boxGeometry args={[4, 1.5, 2]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.15} />
        </mesh>

        {/* Elevated Jump Platforms - Darker Charcoal Gray */}
        <mesh position={[-12, 1.5, 12]} castShadow receiveShadow>
          <boxGeometry args={[6, 3, 6]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.25} />
        </mesh>
        <mesh position={[12, 1.5, -12]} castShadow receiveShadow>
          <boxGeometry args={[6, 3, 6]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.25} />
        </mesh>
      </RigidBody>
    </group>
  );
};