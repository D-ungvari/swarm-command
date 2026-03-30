# Swarm Command — Implementation Plan

> Simplified StarCraft 2-inspired RTS. Terran vs Zerg, top-down, web-based.
> Last updated: 2026-03-30

---

## Vision

A browser-based real-time strategy game featuring iconic Terran and Zerg units in a simplified, stylized top-down view. Built as a portfolio centerpiece demonstrating complex systems engineering: ECS architecture, GPU-accelerated rendering, pathfinding, AI, and real-time game state management.

The game should feel responsive and satisfying — snappy unit selection, smooth movement, clear visual feedback. StarCraft's micro-heavy gameplay distilled into something approachable.

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Rendering | PixiJS v8 | WebGL2 2D renderer, sprite batching, handles 200+ entities |
| Camera | pixi-viewport | Pan, zoom, edge-scroll, coordinate transforms |
| Architecture | Hand-rolled ECS | TypedArray SoA, bitmask queries, zero deps |
| Pathfinding | `pathfinding` npm → flow fields later | Grid-based A* for v1, upgrade path exists |
| Language | TypeScript (strict) | Portfolio requirement, catches bugs early |
| Build | Vite | Fast HMR, native TS support |
| Audio | Howler.js | Web Audio abstraction (Phase 5+) |
| Testing | Vitest | Fast, Vite-native, TS out of the box |

---

## Game Design

### Factions

#### Terran
Tough, ranged, defensive. Fewer but stronger individual units.

| Unit | Role | HP | Damage | Range | Speed | Special |
|------|------|-----|--------|-------|-------|---------|
| SCV | Worker | 45 | 5 | melee | 2.8 | Gathers resources, builds structures |
| Marine | Infantry | 45 | 6 | 5 | 2.8 | Stim Pack (temporary speed + attack boost, costs HP) |
| Marauder | Anti-armor | 125 | 10 | 6 | 2.3 | Concussive shells (slows target) |
| Siege Tank | Artillery | 160 | 15/35 | 7/13 | 2.3 | Siege mode: immobile, massive range + splash |
| Medivac | Support | 150 | 0 | 4 | 3.5 | Flying, heals nearby bio units |

#### Zerg
Fast, melee-heavy, swarm tactics. Cheap and expendable.

| Unit | Role | HP | Damage | Range | Speed | Special |
|------|------|-----|--------|-------|-------|---------|
| Drone | Worker | 40 | 5 | melee | 2.8 | Gathers resources, morphs into buildings (consumed) |
| Zergling | Swarm | 35 | 5×2 | melee | 4.0 | Fast, attacks twice, spawns in pairs |
| Baneling | Suicide | 30 | 20 splash | melee | 3.5 | Explodes on contact, AoE damage |
| Hydralisk | Ranged | 80 | 12 | 6 | 2.8 | Solid ranged DPS |
| Roach | Tank | 145 | 8 | 4 | 2.8 | Regenerates HP quickly when burrowed/idle |

### Buildings

#### Terran
| Building | Cost | Produces | Requirement |
|----------|------|----------|-------------|
| Command Center | 400m | SCV | — |
| Supply Depot | 100m | +8 supply | — |
| Barracks | 150m | Marine, Marauder | Supply Depot |
| Factory | 150m, 100g | Siege Tank | Barracks |
| Starport | 150m, 100g | Medivac | Factory |

#### Zerg
| Building | Cost | Produces | Requirement |
|----------|------|----------|-------------|
| Hatchery | 300m | Drone, Overlord, Queen | — |
| Overlord | 100m | +8 supply (unit, not building) | — |
| Spawning Pool | 200m | Zergling, Baneling | Hatchery |
| Roach Warren | 150m | Roach | Spawning Pool |
| Hydralisk Den | 100m, 100g | Hydralisk | Roach Warren |

### Resources
- **Minerals** — blue crystal patches, 8 per base location, 1500 each
- **Vespene Gas** — green geyser, 1 per base, requires Refinery/Extractor building, 2500 capacity
- Workers carry 5 minerals or 4 gas per trip
- Starting resources: 50 minerals, 0 gas

### Win Condition
Destroy all enemy buildings.

---

## Architecture

### ECS (bitECS)

**Components:**
```
Position      { x, y }
Velocity      { vx, vy }
Health        { current, max }
Attack        { damage, range, cooldown, lastAttack, splashRadius }
Movement      { speed, targetX, targetY, pathIndex }
Selectable    { selected, faction }
Renderable    { spriteType, width, height, tint }
Worker        { carrying, carryType, gatherTarget, returnTarget }
Building      { type, buildProgress, rallyX, rallyY, productionQueue }
Supply        { provides, consumes }
Special       { type, cooldown, active }
Flying        { altitude }
```

**Systems (run order per tick):**
1. `InputSystem` — process mouse/keyboard, update selection state
2. `CommandSystem` — translate player commands to entity actions
3. `AISystem` — enemy decision making
4. `ProductionSystem` — building queues, unit spawning
5. `MovementSystem` — pathfinding, velocity updates, position integration
6. `CombatSystem` — target acquisition, attack execution, damage application
7. `SpecialSystem` — stim, siege mode, burrow, healing
8. `GatherSystem` — worker resource collection loop
9. `HealthSystem` — death checks, removal, corpse spawning
10. `RenderSystem` — sync ECS state → PixiJS sprites

### Map
- Tile-based grid, 128×128 tiles (each tile = 32px)
- Tile types: ground, minerals, gas, ramp, unbuildable, water (impassable)
- Fog of war: per-tile visibility based on unit sight ranges
- Map stored as flat Uint8Array for cache-friendly access

### Rendering Approach
Phase 1: Geometric shapes (circles, rectangles) with faction colors
- Terran: blue tint, angular shapes
- Zerg: red/purple tint, organic rounded shapes
- Clear silhouette distinction per unit type (size, shape)
- Health bars above units
- Selection circles below selected units

Phase 2+: Pixel art sprites (future iteration)

### Camera
- pixi-viewport with these controls:
  - Edge scroll (mouse near screen edge)
  - Middle-mouse drag to pan
  - Scroll wheel zoom (min 0.5×, max 2×)
  - Keyboard arrow keys
  - Double-click minimap to jump

### Selection & Commands
- Left click: select single unit
- Shift+click: add to selection
- Left drag: box select
- Right click ground: move command
- Right click enemy: attack command
- Right click mineral/gas: gather command
- A + click: attack-move
- S: stop
- H: hold position
- Ctrl+1-9: assign control group
- 1-9: recall control group

---

## Phased Implementation

### Phase 1: Engine Foundation
**Goal:** Rendered map, camera controls, one unit type moving around.

1. Project scaffold (Vite + TS + PixiJS + bitECS)
2. Game loop with fixed timestep (60 UPS, variable render)
3. Tilemap renderer (ground tiles, resource patches)
4. Camera system (pixi-viewport: pan, zoom, edge-scroll)
5. ECS world setup, Position + Renderable components
6. Spawn a unit, render it, sync sprite position
7. Click-to-move (no pathfinding yet, direct movement)

### Phase 2: Selection & Pathfinding
**Goal:** Select units, move them intelligently.

1. Selection system (click, shift-click, drag-box)
2. Selection visuals (circles, health bars)
3. Grid-based pathfinding (A* via `pathfinding` lib)
4. Movement system following path waypoints
5. Group movement (offset destinations so units don't stack)
6. Unit collision avoidance (steering separation)

### Phase 3: Combat
**Goal:** Units fight each other.

1. Attack component + target acquisition (closest enemy in range)
2. Attack animation (flash/projectile visual)
3. Damage application + health bars updating
4. Death + removal from ECS world
5. Attack-move command
6. Range visualization on hover

### Phase 4: Full Unit Roster
**Goal:** All 10 unit types with distinct behaviors.

1. Unit data definitions (stats table → component values)
2. Terran: Marine (stim), Marauder (slow), Siege Tank (siege mode), Medivac (heal, flying)
3. Zerg: Zergling (fast, double-attack), Baneling (explode), Hydralisk, Roach (regen)
4. Unit-specific rendering (distinct shapes/sizes per type)
5. Sound effects per unit action (Howler.js)

### Phase 5: Economy & Production
**Goal:** Gather resources, build stuff, produce units.

1. Resource nodes on map (mineral patches, gas geysers)
2. Worker AI: gather → return → gather loop
3. Resource display HUD
4. Building placement system (ghost preview, validity check)
5. Building construction (progress bar, SCV stays, Drone morphs)
6. Production queue per building
7. Supply system (cap, depots/overlords)
8. Rally points

### Phase 6: AI Opponent
**Goal:** Computer player that builds and attacks.

1. AI resource management (worker production, expansion)
2. AI build order (scripted opening → adaptive)
3. AI army composition
4. AI attack timing (attack when army value exceeds threshold)
5. AI target selection (focus fire, priority targets)
6. Difficulty levels (Easy: slow, no micro; Hard: good macro + micro)

### Phase 7: UI & Polish
**Goal:** Game feels complete and polished.

1. Minimap with unit dots and camera rectangle
2. Unit info panel (portrait, stats, abilities)
3. Production panel for selected buildings
4. Fog of war rendering
5. Death animations / particle effects
6. Victory/defeat screen
7. Main menu + faction select
8. Game speed controls
9. Hotkey reference overlay

### Phase 8: Portfolio Integration
**Goal:** Playable from portfolio site.

1. Embed as iframe or route in portfolio
2. Loading screen with brief instructions
3. Responsive layout / mobile detection (show "desktop only" message)
4. Performance profiling and optimization
5. README with gameplay GIF
6. GitHub Pages deployment

---

## File Structure

```
swarm-command/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── PLAN.md
├── CLAUDE.md
├── .sdlc/
│   ├── PROGRESS.md
│   ├── BACKLOG.md
│   └── log/
├── src/
│   ├── main.ts                  # Entry point
│   ├── Game.ts                  # Game class, PixiJS app, loop
│   ├── constants.ts             # Game constants, balance numbers
│   ├── types.ts                 # Shared TypeScript types
│   ├── ecs/
│   │   ├── world.ts             # bitECS world setup
│   │   ├── components.ts        # All component definitions
│   │   └── queries.ts           # Reusable entity queries
│   ├── systems/
│   │   ├── InputSystem.ts
│   │   ├── CommandSystem.ts
│   │   ├── AISystem.ts
│   │   ├── ProductionSystem.ts
│   │   ├── MovementSystem.ts
│   │   ├── CombatSystem.ts
│   │   ├── SpecialSystem.ts
│   │   ├── GatherSystem.ts
│   │   ├── HealthSystem.ts
│   │   └── RenderSystem.ts
│   ├── rendering/
│   │   ├── TilemapRenderer.ts   # Tile grid rendering
│   │   ├── UnitRenderer.ts      # Unit shape/sprite drawing
│   │   ├── SelectionRenderer.ts # Selection box, circles
│   │   ├── UIRenderer.ts        # HUD, resource bar, minimap
│   │   └── FogOfWar.ts          # Visibility overlay
│   ├── map/
│   │   ├── MapData.ts           # Tile grid, resource placement
│   │   ├── MapGenerator.ts      # Procedural map generation
│   │   └── Pathfinder.ts        # A* wrapper
│   ├── data/
│   │   ├── units.ts             # Unit stat definitions
│   │   ├── buildings.ts         # Building definitions
│   │   └── abilities.ts         # Special ability definitions
│   ├── input/
│   │   ├── InputManager.ts      # Mouse + keyboard state
│   │   ├── SelectionManager.ts  # Unit selection logic
│   │   └── CommandHandler.ts    # Right-click, hotkeys → commands
│   └── ui/
│       ├── Minimap.ts
│       ├── UnitPanel.ts
│       └── ResourceBar.ts
├── public/
│   └── (sprites, audio later)
└── tests/
    ├── systems/
    └── ecs/
```

---

## Balance Philosophy

Keep it simple for v1:
- Marines beat Zerglings 1v1 but lose in swarms (3+ zerglings)
- Siege Tanks dominate ground but die to Banelings
- Medivacs keep bio alive but are fragile
- Zerg wins by swarming, Terran wins by positioning
- Games should last 5-10 minutes

---

## Performance Targets

- 60 FPS with 200 units on screen
- < 100ms input-to-visual-response latency
- < 3 second initial load
- Works in Chrome, Firefox, Edge (latest versions)
