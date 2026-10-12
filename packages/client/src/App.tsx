import React, { useState, useCallback, Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls } from '@react-three/drei';
import { Arena } from './components/Arena';
import { Player } from './components/Player';
import type { WeaponState } from './components/Player';
import { RemotePlayer } from './components/RemotePlayer';
import { GrenadeProjectile } from './components/GrenadeProjectile';
import { VFXManager, type VFXManagerHandle } from './components/VFXManager';
import { useNetwork } from './hooks/useNetwork';
import { WEAPON_CONFIG, type WeaponType, type Vector3D } from '@1v1/shared';
import * as THREE from 'three';

export const App: React.FC = () => {
  const { state: netState, createRoom, joinRoom, restartMatch, sendMessage, setOnRemoteGrenade } = useNetwork();

  const [username, setUsername] = useState('Player_' + Math.floor(Math.random() * 900 + 100));
  const [joinCode, setJoinCode] = useState('');
  const [password, setPassword] = useState('');

  const [isLocked, setIsLocked] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [roundResetCounter, setRoundResetCounter] = useState(0);
  const [remoteGrenades, setRemoteGrenades] = useState<{ id: string; startPos: THREE.Vector3; initialVel: THREE.Vector3 }[]>([]);

  const vfxRef = useRef<VFXManagerHandle>(null);

  const [weaponState, setWeaponState] = useState<WeaponState>({
    currentWeapon: 'PISTOL',
    ammo: WEAPON_CONFIG.PISTOL.MAG_SIZE,
    isReloading: false,
    grenadeCharges: WEAPON_CONFIG.GRENADE.MAX_CHARGES,
  });

  // Only update speed state when integer value changes to avoid re-rendering every frame
  const speedRef = useRef(0);
  const handleSpeedUpdate = useCallback((s: number) => {
    const rounded = Math.round(s);
    if (rounded !== speedRef.current) {
      speedRef.current = rounded;
      setSpeed(s);
    }
  }, []);

  const handleWeaponUpdate = useCallback((w: WeaponState) => setWeaponState(w), []);

  useEffect(() => {
    if (netState.status === 'countdown' || netState.status === 'playing') {
      setRoundResetCounter((c) => c + 1);
    }
  }, [netState.currentRound, netState.status]);

  useEffect(() => {
    setOnRemoteGrenade((startPos, initialVel) => {
      setRemoteGrenades((prev) => [
        ...prev,
        {
          id: `remote_grenade_${Date.now()}_${Math.random()}`,
          startPos: new THREE.Vector3(startPos.x, startPos.y, startPos.z),
          initialVel: new THREE.Vector3(initialVel.x, initialVel.y, initialVel.z),
        },
      ]);
    });
  }, [setOnRemoteGrenade]);

  const handleNetworkMove = useCallback((
    x: number,
    y: number,
    z: number,
    yaw: number,
    pitch: number,
    isSliding: boolean,
    timestamp: number
  ) => {
    sendMessage({ type: 'PLAYER_MOVE', x, y, z, yaw, pitch, isSliding, timestamp });
  }, [sendMessage]);

  const handleNetworkShoot = useCallback((
    weapon: WeaponType,
    origin: Vector3D,
    targetPos?: Vector3D,
    targetId?: string,
    hitZone?: 'head' | 'body'
  ) => {
    if (targetPos && vfxRef.current) {
      vfxRef.current.spawnTracer(
        new THREE.Vector3(origin.x, origin.y, origin.z),
        new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z)
      );
    }

    sendMessage({
      type: 'PLAYER_SHOOT',
      weapon,
      origin,
      targetPos,
      targetId,
      hitZone,
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const handleNetworkThrowGrenade = useCallback((startPos: Vector3D, initialVel: Vector3D) => {
    sendMessage({ type: 'PLAYER_THROW_GRENADE', startPos, initialVel });
  }, [sendMessage]);

  const isGameActive = netState.status === 'playing' || netState.status === 'countdown' || netState.status === 'round-end';
  const localPlayer = netState.players.find((p) => p.id === netState.playerId);
  const opponent = netState.players.find((p) => p.id !== netState.playerId);

  const handleGrenadeExplode = useCallback((id: string, explodePos: THREE.Vector3) => {
    if (vfxRef.current) {
      vfxRef.current.spawnImpact(explodePos, false);
    }

    if (opponent) {
      const oppPos = new THREE.Vector3(opponent.x, opponent.y + 0.8, opponent.z);
      const dist = explodePos.distanceTo(oppPos);
      const blastRadius = 7.0;

      if (dist <= blastRadius) {
        const falloff = 1 - dist / blastRadius;
        const damage = Math.round(20 + falloff * 55);

        sendMessage({
          type: 'PLAYER_GRENADE_DAMAGE',
          targetId: opponent.id,
          damage,
        });
      }
    }
  }, [opponent, sendMessage]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} castShadow />

        <Suspense fallback={null}>
          <Physics gravity={[0, -28, 0]}>
            <Arena />
            <VFXManager ref={vfxRef} />

            {/* Local Player */}
            {isGameActive && (
              <Player
                spawnSide={netState.spawnSide || 'alpha'}
                resetTrigger={roundResetCounter}
                onSpeedUpdate={handleSpeedUpdate}
                onWeaponStateUpdate={handleWeaponUpdate}
                onNetworkMove={handleNetworkMove}
                onNetworkShoot={handleNetworkShoot}
                onNetworkThrowGrenade={handleNetworkThrowGrenade}
                onGrenadeExplode={handleGrenadeExplode}
              />
            )}

            {/* Remote Opponent */}
            {isGameActive && opponent && (
              <RemotePlayer
                key={opponent.id}
                player={opponent}
                onHit={(_targetId, part, hitPoint) => {
                  if (vfxRef.current) {
                    vfxRef.current.spawnImpact(hitPoint, part === 'head');
                  }
                }}
              />
            )}

            {remoteGrenades.map((g) => (
              <GrenadeProjectile
                key={g.id}
                id={g.id}
                startPosition={g.startPos}
                initialVelocity={g.initialVel}
                onExplode={(id, pos) => {
                  if (vfxRef.current) {
                    vfxRef.current.spawnImpact(pos, false);
                  }
                  setTimeout(() => {
                    setRemoteGrenades((prev) => prev.filter((item) => item.id !== id));
                  }, 500);
                }}
              />
            ))}
          </Physics>
        </Suspense>

        {isGameActive && (
          <PointerLockControls
            onLock={() => setIsLocked(true)}
            onUnlock={() => setIsLocked(false)}
          />
        )}
      </Canvas>

      {/* TOP HUD: ROUND TRACKER & SCOREBOARD */}
      {isGameActive && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          padding: '10px 24px',
          borderRadius: '16px',
          border: '1px solid #334155',
          fontFamily: 'sans-serif',
          pointerEvents: 'none'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.1em' }}>
            ROUND {netState.currentRound} OF 3
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8' }}>{localPlayer?.username}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: idx < (localPlayer?.roundsWon ?? 0) ? '#38bdf8' : '#334155',
                      boxShadow: idx < (localPlayer?.roundsWon ?? 0) ? '0 0 6px #38bdf8' : 'none'
                    }}
                  />
                ))}
              </div>
            </div>

            <span style={{ color: '#64748b', fontWeight: 900, fontSize: '14px' }}>VS</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: idx < (opponent?.roundsWon ?? 0) ? '#ef4444' : '#334155',
                      boxShadow: idx < (opponent?.roundsWon ?? 0) ? '0 0 6px #ef4444' : 'none'
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444' }}>{opponent?.username ?? 'Waiting...'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ROUND COUNTDOWN OVERLAY */}
      {netState.status === 'countdown' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          fontFamily: 'sans-serif'
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#38bdf8', letterSpacing: '0.15em', marginBottom: '8px' }}>
            ROUND {netState.currentRound}
          </h2>
          <div style={{ fontSize: '80px', fontWeight: 900, color: 'white', textShadow: '0 0 20px rgba(56, 189, 248, 0.8)' }}>
            {netState.countdown}
          </div>
        </div>
      )}

      {/* ROUND END BANNER */}
      {netState.status === 'round-end' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            padding: '24px 48px',
            borderRadius: '20px',
            border: '2px solid #334155',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '36px',
              fontWeight: 900,
              color: netState.roundWinnerId === netState.playerId ? '#22c55e' : '#ef4444'
            }}>
              {netState.roundWinnerId === netState.playerId ? 'ROUND WON!' : 'ROUND LOST'}
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px' }}>Preparing next round...</p>
          </div>
        </div>
      )}

      {/* MATCH OVER OVERLAY */}
      {netState.status === 'match-over' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 60,
          fontFamily: 'sans-serif'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '40px',
            borderRadius: '24px',
            border: '2px solid #334155',
            textAlign: 'center',
            color: 'white',
            maxWidth: '400px'
          }}>
            <h1 style={{
              fontSize: '44px',
              fontWeight: 900,
              letterSpacing: '0.05em',
              color: netState.matchWinnerId === netState.playerId ? '#22c55e' : '#ef4444',
              marginBottom: '8px'
            }}>
              {netState.matchWinnerId === netState.playerId ? 'VICTORY!' : 'DEFEAT'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
              {netState.matchWinnerId === netState.playerId ? 'You won the match!' : 'Better luck next time!'}
            </p>
            <button
              onClick={restartMatch}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: '#10b981',
                color: 'white',
                fontWeight: 'bold',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '15px'
              }}
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Crosshair */}
      {isLocked && isGameActive && (
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

      {/* Speedometer */}
      {isLocked && isGameActive && (
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

      {/* Health Bar (Bottom Left) */}
      {isGameActive && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '32px',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          padding: '12px 20px',
          borderRadius: '12px',
          border: '1px solid #334155',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>HEALTH</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '140px', height: '12px', backgroundColor: '#1e293b', borderRadius: '6px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${localPlayer?.hp ?? 100}%`,
                  height: '100%',
                  backgroundColor: (localPlayer?.hp ?? 100) > 50 ? '#22c55e' : (localPlayer?.hp ?? 100) > 20 ? '#eab308' : '#ef4444',
                  transition: 'width 0.15s ease-out',
                }}
              />
            </div>
            <span style={{ color: '#f8fafc', fontSize: '20px', fontWeight: 900 }}>{localPlayer?.hp ?? 100}</span>
          </div>
        </div>
      )}

      {/* Combat & Weapon Status HUD (Bottom Right) */}
      {isGameActive && (
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

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            padding: '12px 20px',
            borderRadius: '12px',
            border: '1px solid #334155'
          }}>
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

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: weaponState.ammo === 0 ? '#ef4444' : '#f8fafc', lineHeight: 1 }}>
                {weaponState.isReloading ? (
                  <span style={{ fontSize: '16px', color: '#f59e0b' }}>RELOADING...</span>
                ) : (
                  `${weaponState.ammo} / ${WEAPON_CONFIG.PISTOL.MAG_SIZE}`
                )}
              </div>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'bold' }}>[R] RELOAD</span>
            </div>
          </div>
        </div>
      )}

      {/* LOBBY MODAL: MENU */}
      {netState.status === 'menu' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(8px)',
          zIndex: 50,
          fontFamily: 'sans-serif',
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '36px',
            borderRadius: '20px',
            width: '420px',
            border: '1px solid #334155',
            color: 'white',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)'
          }}>
            <h1 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '0.05em', textAlign: 'center', marginBottom: '4px' }}>
              1V1<span style={{ color: '#10b981' }}>.IO</span>
            </h1>
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginBottom: '24px' }}>
              Fast-Paced Slide-Hop FPS 1v1
            </p>

            {netState.error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
                {netState.error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>YOUR USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontWeight: 'bold', outline: 'none' }}
              />
            </div>

            <button
              onClick={() => joinRoom(username)}
              style={{ width: '100%', padding: '12px', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', borderRadius: '10px', border: 'none', cursor: 'pointer', marginBottom: '16px', fontSize: '15px' }}
            >
              FIND PUBLIC MATCH
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 'bold' }}>OR PRIVATE LOBBY</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#334155' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Optional Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '13px' }}
              />
              <button
                onClick={() => createRoom(username, true, password || undefined)}
                style={{ padding: '10px 16px', backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
              >
                CREATE
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Room Code (e.g. ABCDE)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontSize: '13px' }}
              />
              <button
                onClick={() => joinRoom(username, joinCode, password || undefined)}
                style={{ padding: '10px 16px', backgroundColor: '#64748b', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px' }}
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAITING SCREEN */}
      {netState.status === 'waiting' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 50,
          fontFamily: 'sans-serif'
        }}>
          <div style={{ backgroundColor: '#1e293b', padding: '36px', borderRadius: '20px', width: '380px', border: '1px solid #334155', color: 'white', textAlign: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Waiting for Opponent...</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>Share this code with your friend to join:</p>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155', fontSize: '28px', fontWeight: 900, letterSpacing: '0.2em', color: '#38bdf8', marginBottom: '20px' }}>
              {netState.roomId}
            </div>
          </div>
        </div>
      )}

      {/* POINTER LOCK RESUME OVERLAY */}
      {isGameActive && !isLocked && (
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
          <div style={{ backgroundColor: '#1e293b', padding: '24px 36px', borderRadius: '16px', textAlign: 'center', color: 'white', border: '1px solid #334155' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px' }}>MATCH IN PROGRESS</h2>
            <button
              onClick={() => {
                const canvas = document.querySelector('canvas');
                canvas?.requestPointerLock();
              }}
              style={{ padding: '12px 24px', backgroundColor: '#10b981', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px' }}
            >
              CLICK TO LOCK MOUSE & PLAY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;