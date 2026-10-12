import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls } from '@react-three/drei';
import { Arena } from './components/Arena';
import { Player } from './components/Player';

export const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900">
      {/* 3D Canvas */}
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        shadows
        className="w-full h-full"
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[20, 30, 20]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <Physics gravity={[0, -28, 0]}>
          <Arena />
          <Player />
        </Physics>
        <PointerLockControls
          onLock={() => setIsLocked(true)}
          onUnlock={() => setIsLocked(false)}
        />
      </Canvas>

      {/* Minimal HUD: Crosshair */}
      {isLocked && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-4 h-4 flex items-center justify-center">
            {/* Center dot */}
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            {/* Crosshair marks */}
            <div className="absolute w-3 h-[2px] -left-3 bg-emerald-400/80" />
            <div className="absolute w-3 h-[2px] -right-3 bg-emerald-400/80" />
            <div className="absolute h-3 w-[2px] -top-3 bg-emerald-400/80" />
            <div className="absolute h-3 w-[2px] -bottom-3 bg-emerald-400/80" />
          </div>
        </div>
      )}

      {/* Click-to-Play Overlay */}
      {!isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-50">
          <div className="bg-slate-800/90 border border-slate-700 p-8 rounded-2xl shadow-2xl text-center max-w-md">
            <h1 className="text-3xl font-extrabold text-white tracking-wider mb-2">1v1.IO</h1>
            <p className="text-sm text-slate-400 mb-6">Phase 2: Local Movement & Arena Sandbox</p>
            
            <div className="text-xs text-slate-300 space-y-1 mb-6 text-left bg-slate-900/60 p-4 rounded-lg border border-slate-700/50">
              <p><span className="text-amber-400 font-bold">WASD:</span> Move</p>
              <p><span className="text-amber-400 font-bold">SPACE:</span> Jump</p>
              <p><span className="text-amber-400 font-bold">SHIFT / C:</span> Slide</p>
              <p><span className="text-emerald-400 font-bold">SLIDE HOP:</span> Hold W + SHIFT then tap SPACE</p>
            </div>

            <button
              onClick={() => {
                const canvas = document.querySelector('canvas');
                canvas?.requestPointerLock();
              }}
              className="w-full py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition duration-150 shadow-lg shadow-emerald-500/30"
            >
              CLICK TO LOCK & PLAY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;