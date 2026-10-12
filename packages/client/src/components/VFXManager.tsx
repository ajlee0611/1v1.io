import { useRef, useImperativeHandle, forwardRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface VFXManagerHandle {
  spawnTracer: (from: THREE.Vector3, to: THREE.Vector3) => void;
  spawnImpact: (pos: THREE.Vector3, isHeadshot: boolean) => void;
}

interface Tracer {
  id: number;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  createdAt: number;
}

interface Particle {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: string;
  createdAt: number;
}

// Reusable unit cylinder along Y-axis; dynamically scaled per tracer
const unitCylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 8);

export const VFXManager = forwardRef<VFXManagerHandle>((_, ref) => {
  const tracers = useRef<Tracer[]>([]);
  const particles = useRef<Particle[]>([]);
  const [, setTick] = useState(0);

  const upVec = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useImperativeHandle(ref, () => ({
    spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
      const diff = new THREE.Vector3().subVectors(to, from);
      const length = diff.length();
      if (length < 0.1) return;

      const midpoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
      const dir = diff.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(upVec, dir);

      tracers.current.push({
        id: Math.random(),
        midpoint,
        quaternion,
        length,
        createdAt: performance.now(),
      });
      setTick((t) => t + 1);
    },
    spawnImpact(pos: THREE.Vector3, isHeadshot: boolean) {
      const color = isHeadshot ? '#ef4444' : '#f59e0b';
      for (let i = 0; i < 6; i++) {
        particles.current.push({
          id: Math.random(),
          position: pos.clone(),
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 5,
            Math.random() * 4 + 1.5,
            (Math.random() - 0.5) * 5
          ),
          color,
          createdAt: performance.now(),
        });
      }
      setTick((t) => t + 1);
    },
  }));

  useFrame((_, delta) => {
    const now = performance.now();
    let changed = false;

    // Fast tracer flash lifetime: 80 ms
    if (tracers.current.length > 0) {
      const filtered = tracers.current.filter((t) => now - t.createdAt < 80);
      if (filtered.length !== tracers.current.length) {
        tracers.current = filtered;
        changed = true;
      }
    }

    // Impact spark physics
    if (particles.current.length > 0) {
      const remaining: Particle[] = [];
      for (const p of particles.current) {
        if (now - p.createdAt < 350) {
          p.velocity.y -= 18 * delta;
          p.position.addScaledVector(p.velocity, delta);
          remaining.push(p);
        } else {
          changed = true;
        }
      }
      particles.current = remaining;
      changed = true;
    }

    if (changed) {
      setTick((t) => (t + 1) % 10000);
    }
  });

  return (
    <group>
      {/* Cylindrical Bullet Tracers */}
      {tracers.current.map((t) => (
        <group
          key={t.id}
          position={[t.midpoint.x, t.midpoint.y, t.midpoint.z]}
          quaternion={t.quaternion}
        >
          {/* Intense Thin White Core */}
          <mesh geometry={unitCylinderGeo} scale={[0.005, t.length, 0.005]}>
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* Subtler Cyan Energy Sheath */}
          <mesh geometry={unitCylinderGeo} scale={[0.015, t.length, 0.015]}>
            <meshBasicMaterial
              color="#38bdf8"
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Impact Sparks */}
      {particles.current.map((p) => (
        <mesh key={p.id} position={[p.position.x, p.position.y, p.position.z]}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshBasicMaterial color={p.color} />
        </mesh>
      ))}
    </group>
  );
});

VFXManager.displayName = 'VFXManager';
export default VFXManager;