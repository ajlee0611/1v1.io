import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls } from '@react-three/drei';
import { Arena } from './components/Arena';
import { Player } from './components/Player';
import type { WeaponState } from './components/Player';
import { TargetDummy } from './components/TargetDummy';
import { WEAPON_CONFIG } from '@1v1/shared';

export const App: React.FC = () => {
  const [isLocked, setIsLocked] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [weaponState, setWeaponState] = useState<WeaponState>({
    currentWeapon: 'PISTOL',
    ammo: WEAPON_CONFIG.PISTOL.MAG_SIZE,
    isReloading: false,
    grenadeCharges: WEAPON_CONFIG.GRENADE.MAX_CHARGES,
    grenadeCooldownProgress: 0,
  });

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
            <Player onSpeedUpdate={setSpeed} onWeaponStateUpdate={setWeaponState} />
            
            {/* Practice Dummies placed at strategic arena locations */}
            <TargetDummy position={[0, 0, -8]} />
            <TargetDummy position={[-8, 0, -14]} />
            <TargetDummy position={[8, 0, -14]} />
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
        }}>
          <div style={{ position: 'absolute', width: '10px', height: '2px', left: '-12px', top: '2px', backgroundColor: '#34d399' }} />
          <div style={{ position: 'absolute', width: '10px', height: '2px', right: '-12px', top: '2px', backgroundColor: '#34d399' }} />
          <div style={{ position: 'absolute', height: '10px', width: '2px', top: '-12px', left: '2px', backgroundColor: '#34d399' }} />
          <div style={{ position: 'absolute', height: '10px', width: '2px', bottom: '-12px', left: '2px', backgroundColor: '#34d399' }} />
        </div>
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
          fontSize: '13px',
          fontWeight: 'bold',
          letterSpacing: '0.05em',
          pointerEvents: 'none'
        }}>
          VELOCITY: <span style={{ color: speed > 18 ? '#4ade80' : '#f8fafc' }}>{speed.toFixed(1)}</span> m/s
        </div>
      )}

      {/* Combat & Weapon Status HUD (Bottom Right) */}
      {isLocked && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          right: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '8px',
          pointerEvents: 'none',
          fontFamily: 'sans-serif'
        }}>
          {/* Active Weapon Indicator */}
          <div style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid #334155'
          }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: weaponState.currentWeapon === 'PISTOL' ? '#38bdf8' : '#64748b' }}>
              [1] PISTOL
            </span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: weaponState.currentWeapon === 'KNIFE' ? '#f59e0b' : '#64748b' }}>
              [2] KNIFE
            </span>
          </div>

          {/* Ammo & Grenades */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid #334155'
          }}>
            {/* Grenades */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '2px' }}>[G] GRENADES</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: index < weaponState.grenadeCharges ? '#22c55e' : '#475569',
                      boxShadow: index < weaponState.grenadeCharges ? '0 0 6px #22c55e' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', backgroundColor: '#334155' }} />

            {/* Pistol Ammo */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: weaponState.ammo === 0 ? '#ef4444' : '#f8fafc', lineHeight: 1 }}>
                {weaponState.isReloading ? (
                  <span style={{ fontSize: '16px', color: '#f59e0b' }}>RELOADING...</span>
                ) : (
                  `${weaponState.ammo} / 6`
                )}
              </div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>[R] RELOAD</span>
            </div>
          </div>
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
            maxWidth: '420px',
            border: '1px solid #334155'
          }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px' }}>1v1.IO</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>Phase 3: Weapons & Combat Range</p>
            <div style={{ textAlign: 'left', backgroundColor: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', lineHeight: '1.6' }}>
              <div><strong style={{ color: '#fbbf24' }}>LEFT CLICK:</strong> Shoot Pistol / Swing Knife</div>
              <div><strong style={{ color: '#fbbf24' }}>1 / 2:</strong> Switch Weapon (Pistol / Knife)</div>
              <div><strong style={{ color: '#fbbf24' }}>R:</strong> Reload Pistol (6 Bullets)</div>
              <div><strong style={{ color: '#fbbf24' }}>G:</strong> Throw Grenade (2 Charges, 15s cd)</div>
              <div><strong style={{ color: '#ef4444' }}>HEADSHOT:</strong> 60 DMG | <strong style={{ color: '#38bdf8' }}>BODY:</strong> 15 DMG</div>
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
              CLICK TO PLAY COMBAT RANGE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;