# Swarm Command — Development Guide

Simplified StarCraft 2-inspired RTS — Terran vs Zerg, web-based, portfolio piece.

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
swarm-command/
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
│   │   └── units.ts             # Unit stat definitions (all 10 unit types)
│   ├── input/
│   │   └── InputManager.ts      # Mouse + keyboard state tracking
│   └── types/
│       └── pathfinding.d.ts     # Type declarations for pathfinding lib
├── tests/
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Key Patterns
- **Hand-rolled ECS**: Entities are integer IDs, components are parallel TypedArrays, queries use bitmasks. See `ecs/world.ts`.
- **Fixed timestep**: Game logic runs at 60 ticks/sec, rendering runs every frame. See `Game.ts:loop()`.
- **SoA layout**: Component data in struct-of-arrays (`posX[eid]`, `posY[eid]`) for cache-friendly iteration.
- **Faction rendering**: Terran = rectangles (angular), Zerg = ellipses (organic).
- **Screen vs world space**: SelectionRenderer is in screen space (on stage), everything else is in the viewport (world space).

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
- Always update PLAN.md status after implementing features
- Always update .sdlc/PROGRESS.md after completing any phase
- Pathfinding grid must be rebuilt when map changes
- Component data lives in TypedArrays — no object allocation in hot paths
- Range/speed values in data files use tile units; convert to px in Game.spawnUnit
