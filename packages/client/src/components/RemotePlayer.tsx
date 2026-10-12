import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { NetworkPlayer } from '@1v1/shared';

interface RemotePlayerProps {
  player: NetworkPlayer;
  onHit: (targetId: string, part: 'head' | 'body') => void;
}

export const RemotePlayer: React.FC<RemotePlayerProps> = ({ player, onHit }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.x, player.y, player.z));
  const targetYaw = useRef(player.yaw);

  const [lastDamage, setLastDamage] = useState<{ amount: number; isHeadshot: boolean; id: number } | null>(null);
  const prevHp = useRef(player.hp);

  // Detect HP drop and trigger floating damage number
  useEffect(() => {
    if (player.hp < prevHp.current) {
      const diff = prevHp.current - player.hp;
      const isHeadshot = diff === 60;
      setLastDamage({ amount: diff, isHeadshot, id: Date.now() });
      setTimeout(() => setLastDamage(null), 1200);
    }
    prevHp.current = player.hp;
  }, [player.hp]);

  // Update target coordinates from network state update
  useEffect(() => {
    targetPos.current.set(player.x, player.y, player.z);
    targetYaw.current = player.yaw;
  }, [player.x, player.y, player.z, player.yaw]);

  // Smooth dead-reckoning / interpolation loop
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, 0.35);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetYaw.current, 0.35);
  });

  return (
    <group ref={groupRef} position={[player.x, player.y, player.z]}>
      {/* Floating Username, HP & Damage Numbers */}
      <Html position={[0, 2.3, 0]} center distanceFactor={14}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', userSelect: 'none' }}>
          {lastDamage && (
            <span
              key={lastDamage.id}
              style={{
                color: lastDamage.isHeadshot ? '#ef4444' : '#f59e0b',
                fontWeight: 900,
                fontSize: '18px',
                textShadow: '0 0 6px rgba(0,0,0,0.9)',
                marginBottom: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              {lastDamage.isHeadshot ? `-${lastDamage.amount} HEADSHOT!` : `-${lastDamage.amount}`}
            </span>
          )}
          <span style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 4px #000', marginBottom: '2px' }}>
            {player.username}
          </span>
          <div style={{ width: '64px', height: '6px', backgroundColor: '#334155', borderRadius: '3px', overflow: 'hidden', border: '1px solid #475569' }}>
            <div
              style={{
                width: `${player.hp}%`,
                height: '100%',
                backgroundColor: player.hp > 50 ? '#22c55e' : player.hp > 20 ? '#eab308' : '#ef4444',
                transition: 'width 0.1s ease-out',
              }}
            />
          </div>
        </div>
      </Html>

      {/* Head Hitbox & Mesh */}
      <mesh
        position={[0, 0.45, 0]}
        castShadow
        userData={{
          isTarget: true,
          part: 'head',
          targetId: player.id,
          onDamage: () => onHit(player.id, 'head'),
        }}
      >
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#ef4444" roughness={0.3} />
      </mesh>

      {/* Torso Hitbox & Mesh */}
      <mesh
        position={[0, -0.4, 0]}
        castShadow
        userData={{
          isTarget: true,
          part: 'body',
          targetId: player.id,
          onDamage: () => onHit(player.id, 'body'),
        }}
      >
        <boxGeometry args={[0.7, 1.2, 0.45]} />
        <meshStandardMaterial color="#0284c7" roughness={0.4} />
      </mesh>
    </group>
  );
};