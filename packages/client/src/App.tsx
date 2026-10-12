import React, { useState, useCallback, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { PointerLockControls } from '@react-three/drei';
import { Arena } from './components/Arena';
import { Player } from './components/Player';
import type { WeaponState } from './components/Player';
import { RemotePlayer } from './components/RemotePlayer';
import { GrenadeProjectile } from './components/GrenadeProjectile';
import { useNetwork } from './hooks/useNetwork';
import { WEAPON_CONFIG, type WeaponType, type Vector3D } from '@1v1/shared';
import * as THREE from 'three';

export const App: React.FC = () => {
  const { state: netState, createRoom, joinRoom, sendMessage, setOnRemoteGrenade } = useNetwork();

  // Lobby Inputs
  const [username, setUsername] = useState('Player_' + Math.floor(Math.random() * 900 + 100));
  const [joinCode, setJoinCode] = useState('');
  const [password, setPassword] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  // In-Game States
  const [isLocked, setIsLocked] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [remoteGrenades, setRemoteGrenades] = useState<{ id: string; startPos: THREE.Vector3; initialVel: THREE.Vector3 }[]>([]);

  const [weaponState, setWeaponState] = useState<WeaponState>({
    currentWeapon: 'PISTOL',
    ammo: WEAPON_CONFIG.PISTOL.MAG_SIZE,
    isReloading: false,
    grenadeCharges: WEAPON_CONFIG.GRENADE.MAX_CHARGES,
  });

  const handleSpeedUpdate = useCallback((s: number) => setSpeed(s), []);
  const handleWeaponUpdate = useCallback((w: WeaponState) => setWeaponState(w), []);

  // Listen for remote grenades
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

  // Network Callbacks
  const handleNetworkMove = useCallback((x: number, y: number, z: number, yaw: number, pitch: number, isSliding: boolean) => {
    sendMessage({ type: 'PLAYER_MOVE', x, y, z, yaw, pitch, isSliding });
  }, [sendMessage]);

  const handleNetworkShoot = useCallback((weapon: WeaponType, targetId?: string, hitZone?: 'head' | 'body') => {
    sendMessage({ type: 'PLAYER_SHOOT', weapon, targetId, hitZone });
  }, [sendMessage]);

  const handleNetworkThrowGrenade = useCallback((startPos: Vector3D, initialVel: Vector3D) => {
    sendMessage({ type: 'PLAYER_THROW_GRENADE', startPos, initialVel });
  }, [sendMessage]);

  // Identify local vs opponent player
  const localPlayer = netState.players.find((p) => p.id === netState.playerId);
  const opponent = netState.players.find((p) => p.id !== netState.playerId);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#0f172a' }}>
      {/* 3D Battlefield */}
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

            {/* Local Player */}
            {netState.status === 'playing' && (
              <Player
                spawnSide={netState.spawnSide || 'alpha'}
                onSpeedUpdate={handleSpeedUpdate}
                onWeaponStateUpdate={handleWeaponUpdate}
                onNetworkMove={handleNetworkMove}
                onNetworkShoot={handleNetworkShoot}
                onNetworkThrowGrenade={handleNetworkThrowGrenade}
              />
            )}

            {/* Remote Opponent */}
            {netState.status === 'playing' && opponent && (
              <RemotePlayer
                key={opponent.id}
                player={opponent}
                onHit={(targetId, part) => {
                  handleNetworkShoot('PISTOL', targetId, part);
                }}
              />
            )}

            {/* Opponent's grenades */}
            {remoteGrenades.map((g) => (
              <GrenadeProjectile
                key={g.id}
                id={g.id}
                startPosition={g.startPos}
                initialVelocity={g.initialVel}
                onExplode={(id) => {
                  setRemoteGrenades((prev) => prev.filter((item) => item.id !== id));
                }}
              />
            ))}
          </Physics>
        </Suspense>

        {netState.status === 'playing' && (
          <PointerLockControls
            onLock={() => setIsLocked(true)}
            onUnlock={() => setIsLocked(false)}
          />
        )}
      </Canvas>

      {/* Crosshair */}
      {isLocked && netState.status === 'playing' && (
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
      {isLocked && netState.status === 'playing' && (
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
      {netState.status === 'playing' && (
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
      {netState.status === 'playing' && (
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
                  `${weaponState.ammo} / 6`
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
              Real-Time FPS 1v1 Arena
            </p>

            {netState.error && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px', textAlign: 'center' }}>
                {netState.error}
              </div>
            )}

            {/* Username Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>YOUR USERNAME</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', backgroundColor: '#0f172a', border: '1px solid #334155', color: 'white', fontWeight: 'bold', outline: 'none' }}
              />
            </div>

            {/* Quick Match / Join Public */}
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

            {/* Create Room */}
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

            {/* Join by Code */}
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

      {/* LOBBY MODAL: WAITING FOR OPPONENT */}
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
            <div style={{ width: '48px', height: '48px', border: '4px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto 20px', animation: 'spin 1s linear infinite' }} />
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>Waiting for Opponent...</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '20px' }}>Share this code with your friend to join:</p>
            <div style={{ backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', border: '1px solid #334155', fontSize: '28px', fontWeight: 900, letterSpacing: '0.2em', color: '#38bdf8', marginBottom: '20px' }}>
              {netState.roomId}
            </div>
          </div>
        </div>
      )}

      {/* Click-to-Lock Overlay when Game is Active but cursor not locked */}
      {netState.status === 'playing' && !isLocked && (
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