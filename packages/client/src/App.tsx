import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls } from '@react-three/drei';
import { Arena } from './components/Arena';
import { Player } from './components/Player';

export const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [speed, setSpeed] = useState(0);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000, position: [0, 5, 10] }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />
        
        <Suspense fallback={null}>
          <Physics gravity={[0, -28, 0]}>
            <Arena />
            <Player onSpeedUpdate={setSpeed} />
          </Physics>
        </Suspense>

        <PointerLockControls
          onLock={() => setIsLocked(true)}
          onUnlock={() => setIsLocked(false)}
        />
      </Canvas>

      {/* Crosshair */}
      {isLocked && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '6px',
          height: '6px',
          backgroundColor: '#34d399',
          borderRadius: '50%',
          pointerEvents: 'none',
          boxShadow: '0 0 8px rgba(52, 211, 153, 0.8)'
        }} />
      )}

      {/* Speedometer HUD */}
      {isLocked && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          padding: '6px 16px',
          borderRadius: '9999px',
          border: '1px solid rgba(51, 65, 85, 0.8)',
          color: '#38bdf8',
          fontFamily: 'monospace',
          fontSize: '14px',
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          pointerEvents: 'none'
        }}>
          VELOCITY: <span style={{ color: speed > 18 ? '#4ade80' : '#f8fafc' }}>{speed.toFixed(1)}</span> m/s
        </div>
      )}

      {/* Click-to-Play Overlay */}
      {!isLocked && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '32px',
            borderRadius: '16px',
            textAlign: 'center',
            color: 'white',
            maxWidth: '380px',
            border: '1px solid #334155'
          }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>1v1.IO</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Phase 2: Movement Sandbox</p>
            <div style={{ textAlign: 'left', backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
              <div><strong style={{ color: '#fbbf24' }}>WASD:</strong> Move</div>
              <div><strong style={{ color: '#fbbf24' }}>SPACE:</strong> Jump</div>
              <div><strong style={{ color: '#fbbf24' }}>SHIFT / C:</strong> Slide</div>
              <div><strong style={{ color: '#34d399' }}>SLIDE HOP:</strong> W + Shift into Space</div>
            </div>
            <button
              onClick={() => {
                const canvas = document.querySelector('canvas');
                canvas?.requestPointerLock();
              }}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#10b981',
                color: 'white',
                fontWeight: 'bold',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              CLICK TO PLAY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;