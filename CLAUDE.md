# RTS.io — Development Guide

Browser-based multiplayer .io RTS battle arena. Original IP with 12 pop-culture-inspired factions.

## Quick Start
```bash
npm install
npm run dev      # → http://localhost:3000
```

## Tech Stack
- TypeScript (strict)
- PixiJS v8 (WebGL2 rendering)
- pixi-viewport (camera: pan, zoom, edge-scroll)
- pathfinding (A* grid pathfinding)
- Vite (build + dev server)
- Vitest (testing)

## Project Structure
```
rts.io/
├── src/
│   ├── main.ts              # Entry point
│   ├── Game.ts              # Game class, PixiJS init, game loop
│   ├── constants.ts         # All game constants, enums
│   ├── types.ts             # Shared TypeScript types
│   ├── ecs/
│   │   ├── world.ts         # Hand-rolled ECS (TypedArrays, bitmask queries)
│   │   └── components.ts    # All component definitions (SoA TypedArrays)
│   ├── systems/
│   │   ├── MovementSystem.ts    # Path-following, velocity
│   │   ├── SelectionSystem.ts   # Click + drag-box selection
│   │   └── CommandSystem.ts     # Player input → unit commands
│   ├── rendering/
│   │   ├── TilemapRenderer.ts   # Tile grid (static, drawn once)
│   │   ├── UnitRenderer.ts      # Unit shapes + health bars
│   │   └── SelectionRenderer.ts # Drag box (screen space)
│   ├── map/
│   │   ├── MapData.ts           # Tile grid, generation, coordinate helpers
│   │   └── Pathfinder.ts        # A* wrapper over pathfinding lib
│   ├── data/
│   │   └── units.ts             # Unit stat definitions per faction
│   ├── input/
│   │   └── InputManager.ts      # Mouse + keyboard state tracking
│   └── types/
│       └── pathfinding.d.ts     # Type declarations for pathfinding lib
├── server/                      # (planned) Authoritative game server
├── tests/
├── .sdlc/plans/                 # Design docs and roadmap
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key Patterns
- **Hand-rolled ECS**: Entities are integer IDs, components are parallel TypedArrays, queries use bitmasks. See `ecs/world.ts`.
- **Fixed timestep**: Game logic runs at 60 ticks/sec (client), 20 ticks/sec (server, planned). See `Game.ts:loop()`.
- **SoA layout**: Component data in struct-of-arrays (`posX[eid]`, `posY[eid]`) for cache-friendly iteration.
- **Screen vs world space**: SelectionRenderer is in screen space (on stage), everything else is in the viewport (world space).
- **Authoritative server** (planned): Node.js WebSocket server owns simulation; clients render + interpolate.

## Architecture
- **Forked from**: Swarm Command (SC2-inspired single-player RTS)
- **Design doc**: `.sdlc/plans/multiplayer-arena-pivot.md`
- **Launch factions**: Iron Legion, The Swarm, Arcane Covenant, Automata
- **Target**: 12 factions total, 8 units each, 4-tier tech tree

## Test Command
```bash
npm test
```

## Build Command
```bash
npm run build
```

## Rules
- All new code must be TypeScript (strict)
- Never use `git add -A` — stage specific files
- Pathfinding grid must be rebuilt when map changes
- Component data lives in TypedArrays — no object allocation in hot paths
- Range/speed values in data files use tile units; convert to px in Game.spawnUnit
- This is a **separate project** from Swarm Command — do not reference SC2 lore
