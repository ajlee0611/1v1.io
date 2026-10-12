import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface VFXManagerHandle {
  spawnTracer: (from: THREE.Vector3, to: THREE.Vector3) => void;
  spawnImpact: (pos: THREE.Vector3, isHeadshot: boolean) => void;
}

interface Tracer {
  id: number;
  points: [THREE.Vector3, THREE.Vector3];
  createdAt: number;
}

interface Particle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: string;
  createdAt: number;
}

export const VFXManager = forwardRef<VFXManagerHandle>((_, ref) => {
  const tracers = useRef<Tracer[]>([]);
  const particles = useRef<Particle[]>([]);
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);

  useImperativeHandle(ref, () => ({
    spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
      tracers.current.push({
        id: Math.random(),
        points: [from.clone(), to.clone()],
        createdAt: performance.now(),
      });
      forceUpdate();
    },
    spawnImpact(pos: THREE.Vector3, isHeadshot: boolean) {
      const color = isHeadshot ? '#ef4444' : '#f59e0b';
      for (let i = 0; i < 8; i++) {
        particles.current.push({
          id: Math.random(),
          position: pos.clone(),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 6,
            Math.random() * 5 + 2,
            (Math.random() - 0.5) * 6
          ),
          color,
          createdAt: performance.now(),
        });
      }
      forceUpdate();
    },
  }));

  useFrame((_, delta) => {
    const now = performance.now();
    let hasChanges = false;

    // Fade tracers after 100ms
    if (tracers.current.length > 0) {
      const filtered = tracers.current.filter((t) => now - t.createdAt < 100);
      if (filtered.length !== tracers.current.length) {
        tracers.current = filtered;
        hasChanges = true;
      }
    }

    // Step particles with gravity
    if (particles.current.length > 0) {
      const remaining: Particle[] = [];
      for (const p of particles.current) {
        if (now - p.createdAt < 450) {
          p.velocity.y -= 18 * delta;
          p.position.addScaledVector(p.velocity, delta);
          remaining.push(p);
        } else {
          hasChanges = true;
        }
      }
      particles.current = remaining;
      hasChanges = true;
    }

    if (hasChanges) {
      forceUpdate();
    }
  });

  return (
    <group>
      {/* Bullet Tracers */}
      {tracers.current.map((t) => {
        const geom = new THREE.BufferGeometry().setFromPoints(t.points);
        return (
          <primitive key={t.id} object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#38bdf8', linewidth: 2 }))} />
        );
      })}

      {/* Spark Particles */}
      {particles.current.map((p) => (
        <mesh key={p.id} position={[p.position.x, p.position.y, p.position.z]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
});

VFXManager.displayName = 'VFXManager';