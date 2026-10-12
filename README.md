# 1v1.io — Real-Time Browser FPS Arena

A 1v1 tactical first-person shooter running natively in the browser. Powered by **React Three Fiber**, **Rapier Physics**, and a stateful **WebSocket server engine** with authoritative matchmaking and round management.

---

> [!WARNING]
> ### TWO PLAYERS REQUIRED TO INITIATE A MATCH
> **1v1.io is strictly a multiplayer game.** You cannot start a match or enter the countdown sequence alone. 
> 
> To test or play:
> 1. Open the deployed application (or `localhost`) in **two separate browser windows/tabs** (or share the URL with a friend).
> 2. Have **Player 1** create a Public or Private lobby.
> 3. Have **Player 2** join the active room from the server browser (or enter the 5-digit PIN).
> 4. The match, round timers, and pointer locks will initialize simultaneously for both combatants.

---

## Tech Stack & Architecture

This project is organized as an **npm workspaces monorepo** with shared TypeScript contracts between client and server.

```
1v1-io/
├── packages/
│   ├── shared/   # Universal contracts, shared physics constants, weapon stats & protocol schemas
│   ├── server/   # Stateful Node.js WebSocket engine with room lifecycle & hit validation
│   └── client/   # React Three Fiber frontend with Rapier 3D physics & tactical HUD
├── .github/      # CI/CD verification workflows & automated deployment pipelines
├── Dockerfile    # Multi-stage container definition for Fly.io deployment
└── fly.toml      # Persistent container & edge networking topology
```

### Frontend (`@1v1/client`)
- **Core Framework:** [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + TypeScript
- **3D Graphics & Scene Graph:** [Three.js](https://threejs.org/) via [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) & [@react-three/drei](https://github.com/pmndrs/drei)
- **Physics Simulation:** [@react-three/rapier](https://github.com/pmndrs/react-three-rapier) (WebAssembly-based physics engine for character kinematics, sliding mechanics, and grenade trajectories)
- **VFX & Combat Systems:** Instanced bullet tracers, dynamic impact particles, floating damage indicators, and custom CRT visor post-processing overlays
- **Hosting:** [Vercel](https://vercel.com) Edge CDN

### Backend (`@1v1/server`)
- **Runtime:** [Node.js](https://nodejs.org/) (ESModules)
- **Real-Time Transport:** [ws](https://github.com/websockets/ws) (High-throughput raw WebSockets)
- **Room Engine:** Custom in-memory lobby manager featuring auto-discovery, PIN-protected lobbies, round lifecycle loops, and disconnect cleanup
- **Deployment & Hosting:** [Fly.io](https://fly.io) running persistent Firecracker VMs with automatic SSL/TLS termination (`wss://`)

### Shared Contract (`@1v1/shared`)
- **Zero-Drift Networking:** Unified type definitions for client-to-server and server-to-client message schemas
- **Shared Constants:** Authoritative weapon damage parameters, projectile velocities, explosion radiuses, and movement friction values

---

## License

MIT License. Designed and built for low-latency web-based competitive gaming.