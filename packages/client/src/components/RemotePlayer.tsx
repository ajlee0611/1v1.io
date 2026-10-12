import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { NetworkPlayer } from '@1v1/shared';
import { CharacterRig } from './CharacterRig';

interface RemotePlayerProps {
  player: NetworkPlayer;
  onHit: (targetId: string, part: 'head' | 'body', hitPoint: THREE.Vector3) => void;
}

export const RemotePlayer: React.FC<RemotePlayerProps> = ({ player, onHit }) => {
  const groupRef = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(player.x, player.y, player.z));
  const targetYaw = useRef(player.yaw);

  const [lastDamage, setLastDamage] = useState<{ amount: number; isHeadshot: boolean; id: number } | null>(null);
  const prevHp = useRef(player.hp);
  const [speed, setSpeed] = useState(0);
  const prevPos = useRef(new THREE.Vector3(player.x, player.y, player.z));

  useEffect(() => {
    if (player.hp < prevHp.current) {
      const diff = prevHp.current - player.hp;
      const isHeadshot = diff === 60;
      setLastDamage({ amount: diff, isHeadshot, id: Date.now() });
      setTimeout(() => setLastDamage(null), 1200);
    }
    prevHp.current = player.hp;
  }, [player.hp]);

  useEffect(() => {
    targetPos.current.set(player.x, player.y, player.z);
    targetYaw.current = player.yaw;
  }, [player.x, player.y, player.z, player.yaw]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(targetPos.current, 0.35);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetYaw.current, 0.35);

    const distMoved = groupRef.current.position.distanceTo(prevPos.current);
    setSpeed(distMoved / Math.max(delta, 0.016));
    prevPos.current.copy(groupRef.current.position);
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

      {/* Articulated Visual Rig */}
      <CharacterRig isSliding={player.isSliding} speed={speed} />

      {/* Invisible Raycast Hitboxes */}
      {/* Head Hitbox */}
      <mesh
        position={[0, 1.35, 0]}
        visible={false}
        userData={{
          isTarget: true,
          part: 'head',
          targetId: player.id,
          onDamage: (_dmg: number, pt: THREE.Vector3) => onHit(player.id, 'head', pt),
        }}
      >
        <boxGeometry args={[0.55, 0.55, 0.55]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Body Hitbox */}
      <mesh
        position={[0, 0.65, 0]}
        visible={false}
        userData={{
          isTarget: true,
          part: 'body',
          targetId: player.id,
          onDamage: (_dmg: number, pt: THREE.Vector3) => onHit(player.id, 'body', pt),
        }}
      >
        <boxGeometry args={[0.7, 1.25, 0.5]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
};