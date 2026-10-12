import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface CharacterRigProps {
  isSliding: boolean;
  speed: number;
}

export const CharacterRig: React.FC<CharacterRigProps> = ({ isSliding, speed }) => {
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const swingFreq = speed > 1 ? 12 : 0;
    const swing = Math.sin(t * swingFreq) * 0.45;

    if (isSliding) {
      if (torsoRef.current) torsoRef.current.rotation.x = 0.4;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -1.1;
      if (rightLegRef.current) rightLegRef.current.rotation.x = 0.6;
    } else {
      if (torsoRef.current) torsoRef.current.rotation.x = 0;
      if (leftArmRef.current) leftArmRef.current.rotation.x = swing;
      if (rightArmRef.current) rightArmRef.current.rotation.x = -swing * 0.5;
      if (leftLegRef.current) leftLegRef.current.rotation.x = -swing;
      if (rightLegRef.current) rightLegRef.current.rotation.x = swing;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Torso & Core */}
      <group ref={torsoRef} position={[0, 0.8, 0]}>
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.55, 0.7, 0.35]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Chest Armor Plate */}
        <mesh position={[0, 0.05, 0.18]}>
          <boxGeometry args={[0.42, 0.5, 0.06]} />
          <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* Head & Glowing Visor */}
        <group position={[0, 0.55, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.35, 0.35, 0.35]} />
            <meshStandardMaterial color="#334155" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.02, 0.18]}>
            <boxGeometry args={[0.26, 0.1, 0.04]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>

        {/* Left Arm */}
        <group ref={leftArmRef} position={[-0.38, 0.25, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <boxGeometry args={[0.16, 0.6, 0.16]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
        </group>

        {/* Right Arm + Held Weapon */}
        <group ref={rightArmRef} position={[0.38, 0.25, 0]}>
          <mesh castShadow position={[0, -0.3, 0]}>
            <boxGeometry args={[0.16, 0.6, 0.16]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          {/* Pistol in Hand */}
          <group position={[0, -0.55, 0.2]}>
            <mesh castShadow>
              <boxGeometry args={[0.1, 0.14, 0.35]} />
              <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.03, 0.1]}>
              <boxGeometry args={[0.08, 0.06, 0.2]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Legs */}
      <group ref={leftLegRef} position={[-0.18, 0.45, 0]}>
        <mesh castShadow position={[0, -0.3, 0]}>
          <boxGeometry args={[0.18, 0.65, 0.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
      </group>

      <group ref={rightLegRef} position={[0.18, 0.45, 0]}>
        <mesh castShadow position={[0, -0.3, 0]}>
          <boxGeometry args={[0.18, 0.65, 0.2]} />
          <meshStandardMaterial color="#0f172a" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
};