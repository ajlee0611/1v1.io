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
  const {
    state: netState,
    registerUsername,
    refreshLobbies,
    createRoom,
    cancelRoom,
    joinRoom,
    sendMessage,
    setOnRemoteGrenade,
  } = useNetwork();

  const [usernameInput, setUsernameInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createIsPrivate, setCreateIsPrivate] = useState(false);
  const [privateLobbyToJoin, setPrivateLobbyToJoin] = useState<string | null>(null);
  const [privateCodeInput, setPrivateCodeInput] = useState('');

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
    if (netState.status === 'match-over' || netState.status === 'home') {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
    }
  }, [netState.status]);

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

  useEffect(() => {
    if (netState.status === 'home') {
      refreshLobbies();
      const interval = setInterval(refreshLobbies, 2500);
      return () => clearInterval(interval);
    }
  }, [netState.status, refreshLobbies]);

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

  const isGameActive = netState.status === 'playing' || netState.status === 'countdown' || netState.status === 'round-end' || netState.status === 'match-over';
  const localPlayer = netState.players.find((p) => p.id === netState.playerId);
  const opponent = netState.players.find((p) => p.id !== netState.playerId);

  const handleGrenadeExplode = useCallback((_id: string, explodePos: THREE.Vector3) => {
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
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden', backgroundColor: '#020617', fontFamily: '"Chakra Petch", "JetBrains Mono", monospace, sans-serif' }}>
      
      {/* SOFTENED TACTICAL VISOR OVERLAY */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 40,
        backgroundImage: 'linear-gradient(rgba(0, 0, 0, 0) 65%, rgba(0, 0, 0, 0.15) 65%), linear-gradient(90deg, rgba(6, 182, 212, 0.015), transparent 80%)',
        backgroundSize: '100% 4px, 8px 100%',
        opacity: 0.22,
      }} />

      {/* 3D ARENA & GAME CANVAS */}
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 1000 }}
        shadows
        style={{ width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[12, 24, 12]} intensity={1.6} castShadow />

        <Suspense fallback={null}>
          <Physics gravity={[0, -28, 0]}>
            <Arena />
            <VFXManager ref={vfxRef} />

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

      {/* 1. LOGIN SCREEN WITH BIG 1v1.io TITLE */}
      {netState.status === 'username_prompt' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.88)',
          backdropFilter: 'blur(16px)',
          zIndex: 100,
        }}>
          {/* Large Hero Title */}
          <div style={{ textAlign: 'center', marginBottom: '24px', position: 'relative' }}>
            <h1 style={{
              fontSize: '84px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              margin: 0,
              color: '#f8fafc',
              textShadow: '0 0 40px rgba(6, 182, 212, 0.4)',
              lineHeight: 1,
            }}>
              1V1<span style={{ color: '#06b6d4', textShadow: '0 0 35px #06b6d4' }}>.IO</span>
            </h1>
            <span style={{
              fontSize: '13px',
              letterSpacing: '0.35em',
              color: '#64748b',
              fontWeight: 800,
              display: 'block',
              marginTop: '8px',
            }}>
              FIRST-PERSON MULTIPLAYER ARENA
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (usernameInput.trim()) {
                registerUsername(usernameInput.trim());
              }
            }}
            style={{
              position: 'relative',
              backgroundColor: '#090d16',
              padding: '40px',
              width: '420px',
              clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))',
              border: '1px solid rgba(6, 182, 212, 0.35)',
              boxShadow: '0 0 50px rgba(6, 182, 212, 0.2)',
            }}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: '40px', height: '4px', backgroundColor: '#06b6d4' }} />
            <div style={{ position: 'absolute', top: 0, right: '24px', width: '30px', height: '4px', backgroundColor: '#06b6d4' }} />

            <h2 style={{
              fontSize: '26px',
              fontWeight: 900,
              color: '#f8fafc',
              letterSpacing: '0.06em',
              margin: '0 0 6px 0',
            }}>
              CHOOSE <span style={{ color: '#06b6d4' }}>USERNAME</span>
            </h2>

            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
              Enter your username to access live lobbies.
            </p>

            {netState.error && (
              <div style={{
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderLeft: '4px solid #ef4444',
                color: '#fca5a5',
                padding: '10px 14px',
                fontSize: '12px',
                marginBottom: '18px',
              }}>
                {netState.error}
              </div>
            )}

            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input
                type="text"
                autoFocus
                placeholder="USERNAME..."
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '14px 18px',
                  backgroundColor: '#030712',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  color: '#38bdf8',
                  fontSize: '16px',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={!usernameInput.trim()}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: usernameInput.trim() ? '#06b6d4' : '#1e293b',
                color: usernameInput.trim() ? '#020617' : '#64748b',
                fontWeight: 900,
                fontSize: '14px',
                letterSpacing: '0.15em',
                border: 'none',
                cursor: usernameInput.trim() ? 'pointer' : 'not-allowed',
                boxShadow: usernameInput.trim() ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
              }}
            >
              CONTINUE →
            </button>
          </form>
        </div>
      )}

      {/* 2. LOBBY BROWSER / HOME SCREEN */}
      {netState.status === 'home' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(2, 6, 23, 0.82)',
          backdropFilter: 'blur(12px)',
          zIndex: 80,
          padding: '24px 48px',
          boxSizing: 'border-box',
        }}>
          {/* Top Status Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            paddingBottom: '14px',
            marginBottom: '28px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '0.1em', color: '#f8fafc' }}>
                1V1<span style={{ color: '#06b6d4' }}>.IO</span>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                fontSize: '11px',
                color: '#34d399',
                fontWeight: 800,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#34d399' }} />
                SERVER ONLINE
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '10px', color: '#64748b', display: 'block', letterSpacing: '0.1em' }}>LOGGED IN AS</span>
                <span style={{ fontSize: '15px', color: '#38bdf8', fontWeight: 900 }}>{netState.username}</span>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#06b6d4',
                  color: '#020617',
                  fontWeight: 900,
                  fontSize: '13px',
                  letterSpacing: '0.1em',
                  border: 'none',
                  cursor: 'pointer',
                  clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
                }}
              >
                + CREATE GAME
              </button>
            </div>
          </div>

          {/* Main Layout Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '32px', flex: 1, minHeight: 0 }}>
            {/* Left: Active Lobbies */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'rgba(9, 13, 22, 0.75)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '14px 20px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                borderBottom: '1px solid rgba(56, 189, 248, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.15em', color: '#94a3b8' }}>
                  ACTIVE LOBBIES ({netState.lobbies.length})
                </span>
                <span style={{ fontSize: '11px', color: '#06b6d4' }}>AUTO-REFRESHING</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {netState.lobbies.length === 0 ? (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#475569',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, marginBottom: '6px' }}>NO ACTIVE LOBBIES</div>
                    <div style={{ fontSize: '12px' }}>Click <strong>+ CREATE GAME</strong> to host a match.</div>
                  </div>
                ) : (
                  netState.lobbies.map((lobby) => (
                    <div
                      key={lobby.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '16px 20px',
                        backgroundColor: '#0c1220',
                        border: '1px solid rgba(56, 189, 248, 0.15)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{
                          padding: '4px 10px',
                          backgroundColor: lobby.isPrivate ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                          border: `1px solid ${lobby.isPrivate ? '#f59e0b' : '#06b6d4'}`,
                          color: lobby.isPrivate ? '#f59e0b' : '#38bdf8',
                          fontSize: '11px',
                          fontWeight: 900,
                        }}>
                          {lobby.isPrivate ? 'PRIVATE' : 'PUBLIC'}
                        </div>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 900, color: '#f8fafc' }}>
                            {lobby.hostName}&apos;S MATCH
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            ROOM CODE: <span style={{ color: '#94a3b8' }}>{lobby.id}</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 800,
                          color: lobby.status === 'in-game' ? '#f59e0b' : '#34d399',
                        }}>
                          {lobby.status === 'in-game' ? 'IN MATCH' : `${lobby.playerCount} / 2`}
                        </span>

                        {lobby.status === 'waiting' && (
                          <button
                            onClick={() => {
                              if (lobby.isPrivate) {
                                setPrivateLobbyToJoin(lobby.id);
                                setPrivateCodeInput('');
                              } else {
                                joinRoom(lobby.id);
                              }
                            }}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: lobby.isPrivate ? '#f59e0b' : '#06b6d4',
                              color: '#020617',
                              fontWeight: 900,
                              fontSize: '12px',
                              border: 'none',
                              cursor: 'pointer',
                              clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                            }}
                          >
                            {lobby.isPrivate ? 'ENTER CODE' : 'JOIN →'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right: Weapon Info & Tips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{
                backgroundColor: 'rgba(9, 13, 22, 0.75)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                padding: '24px',
                clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 900, letterSpacing: '0.15em', color: '#06b6d4', marginBottom: '14px' }}>
                  WEAPON STATS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>PISTOL</span>
                    <span style={{ color: '#f8fafc', fontWeight: 800 }}>10 MAG / 15 BODY / 60 HEAD</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>TACTICAL KNIFE</span>
                    <span style={{ color: '#f8fafc', fontWeight: 800 }}>50 DAMAGE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
                    <span style={{ color: '#94a3b8' }}>FRAG GRENADE</span>
                    <span style={{ color: '#f8fafc', fontWeight: 800 }}>2 CHARGES PER ROUND</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
                    <span style={{ color: '#94a3b8' }}>MATCH FORMAT</span>
                    <span style={{ color: '#38bdf8', fontWeight: 800 }}>FIRST TO 2 ROUNDS</span>
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: 'rgba(9, 13, 22, 0.75)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '20px',
                fontSize: '12px',
                color: '#94a3b8',
                lineHeight: 1.6,
              }}>

                <div style={{
                backgroundColor: 'rgba(9, 13, 22, 0.75)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '20px',
                fontSize: '12px',
                color: '#94a3b8',
                lineHeight: 1.6,
              }}>
                <div style={{ color: '#f59e0b', fontWeight: 900, letterSpacing: '0.1em', marginBottom: '6px' }}>
                  MOVEMENT TIP
                </div>
                Hold <strong style={{ color: '#f8fafc' }}>[Shift]</strong> while sprinting to slide. Jump mid-slide to preserve your horizontal momentum.

                <div style={{
                    borderTop: '1px solid rgba(51, 65, 85, 0.6)',
                    marginTop: '14px',
                    paddingTop: '12px',
                  }}>
                    <div style={{ color: '#38bdf8', fontWeight: 900, letterSpacing: '0.1em', marginBottom: '8px' }}>
                      CONTROLS
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[W, A, S, D]</span> Move</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[SPACE]</span> Jump</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[SHIFT]</span> Slide</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[M1]</span> Fire / Slash</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[1]</span> Pistol</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[2]</span> Tactical Knife</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[G]</span> Frag Grenade</div>
                      <div><span style={{ color: '#f8fafc', fontWeight: 800 }}>[R]</span> Reload</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE GAME MODAL */}
      {showCreateModal && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 90,
        }}>
          <div style={{
            backgroundColor: '#090d16',
            padding: '36px',
            width: '420px',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', margin: '0 0 20px 0' }}>
              CREATE LOBBY
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setCreateIsPrivate(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: !createIsPrivate ? 'rgba(6, 182, 212, 0.2)' : '#030712',
                    border: !createIsPrivate ? '2px solid #06b6d4' : '1px solid #1e293b',
                    color: !createIsPrivate ? '#38bdf8' : '#64748b',
                    fontWeight: 900,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  PUBLIC
                </button>
                <button
                  type="button"
                  onClick={() => setCreateIsPrivate(true)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: createIsPrivate ? 'rgba(245, 158, 11, 0.2)' : '#030712',
                    border: createIsPrivate ? '2px solid #f59e0b' : '1px solid #1e293b',
                    color: createIsPrivate ? '#f59e0b' : '#64748b',
                    fontWeight: 900,
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  PRIVATE (CODE)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  createRoom(createIsPrivate);
                  setShowCreateModal(false);
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#06b6d4',
                  color: '#020617',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                CREATE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRIVATE CODE PROMPT MODAL */}
      {privateLobbyToJoin && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.88)',
          backdropFilter: 'blur(10px)',
          zIndex: 90,
        }}>
          <div style={{
            backgroundColor: '#090d16',
            padding: '36px',
            width: '380px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            textAlign: 'center',
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0' }}>
              ENTER ROOM CODE
            </h2>
            <input
              type="text"
              autoFocus
              maxLength={5}
              placeholder="•••••"
              value={privateCodeInput}
              onChange={(e) => setPrivateCodeInput(e.target.value.toUpperCase())}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px',
                textAlign: 'center',
                letterSpacing: '0.35em',
                fontSize: '26px',
                fontWeight: 900,
                backgroundColor: '#030712',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                color: '#f59e0b',
                outline: 'none',
                marginBottom: '20px',
              }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setPrivateLobbyToJoin(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#1e293b',
                  color: '#94a3b8',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  if (privateCodeInput.length === 5) {
                    joinRoom(privateLobbyToJoin, privateCodeInput);
                    setPrivateLobbyToJoin(null);
                  }
                }}
                disabled={privateCodeInput.length !== 5}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: privateCodeInput.length === 5 ? '#f59e0b' : '#334155',
                  color: '#020617',
                  border: 'none',
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: privateCodeInput.length === 5 ? 'pointer' : 'not-allowed',
                }}
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. LOBBY QUEUE STANDBY WITH CANCEL BUTTON */}
      {netState.status === 'waiting' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.88)',
          backdropFilter: 'blur(12px)',
          zIndex: 80,
        }}>
          <div style={{
            backgroundColor: '#090d16',
            padding: '40px',
            width: '420px',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            textAlign: 'center',
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#f8fafc', margin: '0 0 16px 0' }}>
              WAITING FOR OPPONENT...
            </h2>
            {netState.isPrivate ? (
              <>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>ROOM CODE:</div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 900,
                  letterSpacing: '0.3em',
                  color: '#f59e0b',
                  backgroundColor: '#030712',
                  padding: '14px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  marginBottom: '20px',
                }}>
                  {netState.roomId}
                </div>
              </>
            ) : (
              <p style={{ color: '#38bdf8', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                Lobby is public. Match will start automatically when a player joins.
              </p>
            )}

            {/* Cancel Button */}
            <button
              onClick={cancelRoom}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid #ef4444',
                color: '#fca5a5',
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '0.1em',
                cursor: 'pointer',
                clipPath: 'polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)',
                transition: 'all 0.15s ease',
              }}
            >
              ✕ CANCEL LOBBY
            </button>
          </div>
        </div>
      )}

      {/* TOP HUD: ROUND TRACKER */}
      {isGameActive && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: 'rgba(9, 13, 22, 0.85)',
          padding: '10px 32px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          clipPath: 'polygon(12px 0, calc(100% - 12px) 0, 100% 100%, 0 100%)',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '11px', fontWeight: 900, color: '#06b6d4', letterSpacing: '0.15em' }}>
            ROUND {netState.currentRound} / 3
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#38bdf8' }}>
                {localPlayer?.username}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: idx < (localPlayer?.roundsWon ?? 0) ? '#38bdf8' : '#1e293b',
                      boxShadow: idx < (localPlayer?.roundsWon ?? 0) ? '0 0 8px #38bdf8' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <span style={{ color: '#475569', fontWeight: 900, fontSize: '12px' }}>VS</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[0, 1].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      width: '10px',
                      height: '10px',
                      backgroundColor: idx < (opponent?.roundsWon ?? 0) ? '#ef4444' : '#1e293b',
                      boxShadow: idx < (opponent?.roundsWon ?? 0) ? '0 0 8px #ef4444' : 'none',
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '14px', fontWeight: 900, color: '#ef4444' }}>
                {opponent?.username ?? 'SEARCHING...'}
              </span>
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
        }}>
          <div style={{ fontSize: '20px', fontWeight: 900, color: '#06b6d4', letterSpacing: '0.2em', marginBottom: '4px' }}>
            ROUND {netState.currentRound}
          </div>
          <div style={{ fontSize: '96px', fontWeight: 900, color: '#f8fafc', textShadow: '0 0 30px #06b6d4' }}>
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
        }}>
          <div style={{
            backgroundColor: 'rgba(9, 13, 22, 0.9)',
            padding: '24px 60px',
            border: `2px solid ${netState.roundWinnerId === netState.playerId ? '#22c55e' : '#ef4444'}`,
            textAlign: 'center',
            boxShadow: `0 0 40px ${netState.roundWinnerId === netState.playerId ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          }}>
            <h2 style={{
              fontSize: '40px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              margin: 0,
              color: netState.roundWinnerId === netState.playerId ? '#22c55e' : '#ef4444',
            }}>
              {netState.roundWinnerId === netState.playerId ? 'ROUND WON' : 'ROUND LOST'}
            </h2>
          </div>
        </div>
      )}

      {/* MATCH OVER BANNER */}
      {netState.status === 'match-over' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(2, 6, 23, 0.88)',
          backdropFilter: 'blur(10px)',
          zIndex: 60,
        }}>
          <div style={{
            backgroundColor: '#090d16',
            padding: '48px',
            border: `2px solid ${netState.matchWinnerId === netState.playerId ? '#22c55e' : '#ef4444'}`,
            textAlign: 'center',
            color: 'white',
            clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 24px 100%, 0 calc(100% - 24px))',
          }}>
            <h1 style={{
              fontSize: '52px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              color: netState.matchWinnerId === netState.playerId ? '#22c55e' : '#ef4444',
              margin: '0 0 12px 0',
            }}>
              {netState.matchWinnerId === netState.playerId ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <p style={{ color: '#06b6d4', fontSize: '13px', letterSpacing: '0.1em' }}>
              DELETING LOBBY & RETURNING TO HOME...
            </p>
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
          backgroundColor: '#06b6d4',
          borderRadius: '50%',
          pointerEvents: 'none',
          boxShadow: '0 0 10px #06b6d4',
        }}>
          <div style={{ position: 'absolute', width: '12px', height: '2px', left: '-14px', top: '2px', backgroundColor: '#06b6d4' }} />
          <div style={{ position: 'absolute', width: '12px', height: '2px', right: '-14px', top: '2px', backgroundColor: '#06b6d4' }} />
          <div style={{ position: 'absolute', height: '12px', width: '2px', top: '-14px', left: '2px', backgroundColor: '#06b6d4' }} />
          <div style={{ position: 'absolute', height: '12px', width: '2px', bottom: '-14px', left: '2px', backgroundColor: '#06b6d4' }} />
        </div>
      )}

      {/* Speedometer */}
      {isLocked && isGameActive && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(9, 13, 22, 0.85)',
          padding: '6px 20px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
          color: '#38bdf8',
          fontSize: '13px',
          fontWeight: 900,
          letterSpacing: '0.15em',
          pointerEvents: 'none',
        }}>
          VELOCITY // <span style={{ color: speed > 18 ? '#4ade80' : '#f8fafc' }}>{speed.toFixed(1)}</span> M/S
        </div>
      )}

      {/* Health Bar (Bottom Left) */}
      {isGameActive && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '32px',
          backgroundColor: 'rgba(9, 13, 22, 0.85)',
          padding: '14px 24px',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)',
        }}>
          <div style={{ color: '#06b6d4', fontSize: '10px', fontWeight: 900, letterSpacing: '0.2em', marginBottom: '6px' }}>HEALTH</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '160px', height: '10px', backgroundColor: '#030712', overflow: 'hidden', border: '1px solid #1e293b' }}>
              <div
                style={{
                  width: `${localPlayer?.hp ?? 100}%`,
                  height: '100%',
                  backgroundColor: (localPlayer?.hp ?? 100) > 50 ? '#22c55e' : (localPlayer?.hp ?? 100) > 20 ? '#eab308' : '#ef4444',
                  transition: 'width 0.15s ease-out',
                }}
              />
            </div>
            <span style={{ color: '#f8fafc', fontSize: '22px', fontWeight: 900, letterSpacing: '0.05em' }}>{localPlayer?.hp ?? 100}</span>
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
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            backgroundColor: 'rgba(9, 13, 22, 0.85)',
            padding: '6px 14px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)',
          }}>
            <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', color: weaponState.currentWeapon === 'PISTOL' ? '#38bdf8' : '#475569' }}>
              [1] PISTOL
            </span>
            <span style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.1em', color: weaponState.currentWeapon === 'KNIFE' ? '#f59e0b' : '#475569' }}>
              [2] KNIFE
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            backgroundColor: 'rgba(9, 13, 22, 0.85)',
            padding: '14px 24px',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', color: '#06b6d4', fontWeight: 900, letterSpacing: '0.15em', marginBottom: '4px' }}>[G] FRAG</span>
              <div style={{ display: 'flex', gap: '5px' }}>
                {[0, 1].map((index) => (
                  <div
                    key={index}
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: index < weaponState.grenadeCharges ? '#22c55e' : '#1e293b',
                      boxShadow: index < weaponState.grenadeCharges ? '0 0 8px #22c55e' : 'none',
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ width: '1px', height: '26px', backgroundColor: '#1e293b' }} />

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '28px', fontWeight: 900, color: weaponState.ammo === 0 ? '#ef4444' : '#f8fafc', lineHeight: 1 }}>
                {weaponState.isReloading ? (
                  <span style={{ fontSize: '14px', color: '#f59e0b', letterSpacing: '0.1em' }}>RELOADING...</span>
                ) : (
                  `${weaponState.ammo} / ${WEAPON_CONFIG.PISTOL.MAG_SIZE}`
                )}
              </div>
              <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 900, letterSpacing: '0.15em' }}>[R] RELOAD</span>
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
          backgroundColor: 'rgba(2, 6, 23, 0.75)',
          zIndex: 50,
        }}>
          <div style={{
            backgroundColor: '#090d16',
            padding: '28px 48px',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            textAlign: 'center',
            clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px))',
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.15em', marginBottom: '14px' }}>
              Are you ready?
            </h2>
            <button
              onClick={() => {
                const canvas = document.querySelector('canvas');
                canvas?.requestPointerLock();
              }}
              style={{
                padding: '12px 28px',
                backgroundColor: '#06b6d4',
                color: '#020617',
                fontWeight: 900,
                fontSize: '13px',
                letterSpacing: '0.2em',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              START
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;