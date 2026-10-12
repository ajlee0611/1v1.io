import React, { useState } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { Html } from '@react-three/drei';

interface TargetDummyProps {
  position: [number, number, number];
}

export const TargetDummy: React.FC<TargetDummyProps> = ({ position }) => {
  const [hp, setHp] = useState<number>(100);
  const [lastHitText, setLastHitText] = useState<{ text: string; color: string; id: number } | null>(null);

  const handleDamage = (amount: number, isHeadshot: boolean) => {
    setHp((prev) => Math.max(0, prev - amount));
    setLastHitText({
      text: isHeadshot ? `-${amount} HEADSHOT!` : `-${amount}`,
      color: isHeadshot ? '#ef4444' : '#f59e0b',
      id: Date.now(),
    });

    setTimeout(() => {
      setLastHitText(null);
    }, 1200);
  };

  return (
    <group position={position}>
      {/* Floating HP & Damage Numbers */}
      <Html position={[0, 2.5, 0]} center distanceFactor={14}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          {lastHitText && (
            <span
              key={lastHitText.id}
              style={{
                color: lastHitText.color,
                fontWeight: 900,
                fontSize: '18px',
                textShadow: '0 0 6px rgba(0,0,0,0.9)',
                marginBottom: '4px',
                whiteSpace: 'nowrap'
              }}
            >
              {lastHitText.text}
            </span>
          )}
          <div style={{ width: '64px', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden', border: '1px solid #475569' }}>
            <div
              style={{
                width: `${hp}%`,
                height: '100%',
                backgroundColor: hp > 50 ? '#22c55e' : hp > 20 ? '#eab308' : '#ef4444',
                transition: 'width 0.1s ease-out'
              }}
            />
          </div>
          <span style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px', fontWeight: 'bold' }}>{hp} / 100</span>
        </div>
      </Html>

      {/* Head */}
      <RigidBody type="fixed" position={[0, 1.6, 0]}>
        <CuboidCollider args={[0.25, 0.25, 0.25]} />
        <mesh
          castShadow
          receiveShadow
          userData={{ isTarget: true, part: 'head', onDamage: (dmg: number) => handleDamage(dmg, true) }}
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color="#ef4444" roughness={0.3} />
        </mesh>
      </RigidBody>

      {/* Body */}
      <RigidBody type="fixed" position={[0, 0.65, 0]}>
        <CuboidCollider args={[0.35, 0.65, 0.25]} />
        <mesh
          castShadow
          receiveShadow
          userData={{ isTarget: true, part: 'body', onDamage: (dmg: number) => handleDamage(dmg, false) }}
        >
          <boxGeometry args={[0.7, 1.3, 0.5]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.4} />
        </mesh>
      </RigidBody>
    </group>
  );
};