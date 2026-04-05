# Swarm Command — Plan

> SC2 mechanics practice tool. Browser-based. True unit stats. No install.

## Vision

Practice StarCraft 2 mechanics in your browser. True unit stats, real keybindings, instant load. Complements SC2 — doesn't replace it. Target audience: SC2 players warming up between ladder games.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Rendering | PixiJS v8 (WebGL2) |
| Camera | pixi-viewport (pan, zoom, edge-scroll) |
| Architecture | Hand-rolled ECS (TypedArray SoA, bitmask queries) |
| Pathfinding | `pathfinding` npm (A* grid) |
| Language | TypeScript (strict) |
| Build | Vite |
| Testing | Vitest |

## What's Built (Shipped)

### Core Engine
- Fixed timestep game loop (60 UPS, variable render)
- ECS with TypedArrays, bitmask component queries
- A* pathfinding with grid rebuild on map changes
- Fog of war (per-tile visibility)
- Minimap with unit dots and camera rect
- Replay recording/playback
- Touch support (mobile)

### Units (13 types)
- **Terran:** SCV, Marine, Marauder, Siege Tank, Medivac, Ghost, Hellion
- **Zerg:** Drone, Zergling, Baneling, Hydralisk, Roach, Mutalisk, Queen
- All stats match SC2 LotV Liquipedia values (Faster speed)
- Per-unit base armor, multi-shot attacks, abilities

### Buildings & Economy
- Terran: CC, Supply Depot, Barracks, Factory, Starport, Engineering Bay, Bunker
- Zerg: Hatchery, Spawning Pool, Roach Warren, Hydralisk Den, Spire, Evolution Chamber
- Worker gathering (minerals + gas), supply system, tech tree
- Building placement with ghost preview, construction progress
- Upgrades (weapons, armor, vehicle weapons)

### Combat & Abilities
- Target acquisition, attack-move, hold position, patrol
- Stim Pack, Siege Mode, Medivac healing, Ghost cloak/snipe
- Queen inject larva, Baneling explosion (AoE)
- Concussive shells (Marauder slow)
- Control groups (Ctrl+1-9, recall 1-9)

### AI System
- APM-based difficulty (Easy 30, Normal 80, Hard 180, Brutal 400 APM)
- Tactical micro (Hard+): kiting, Baneling targeting, Zergling surround, wounded pullback
- Engagement positioning: concave formation, flanking
- Adaptive strategy: anti-bio, anti-mech, timing attack, economy punish
- Combat awareness (Hard+): splash avoidance, low-HP sniping, threat zone pathing
- Base defense, scouting, wave scaling, harassment

### Maps (10 total)
- Plains, Canyon, Islands (original 3)
- Crossfire, Fortress, Archipelago, Deadlock, Desert Storm, Frozen Tundra, Volcano (new 7)
- SC2 LOTV design: 3-tier expansions, 2 gas per base, watchtowers, back-door rocks
- Overlook cliffs, pocket expansions, terrain debris, elevated main platforms

### UI
- Practice mode with 14 scenario drills
- Skirmish vs AI with difficulty/map/faction selection
- HUD: resources, supply, build menu, info panel, hotkey overlay
- Game over screen with stats, replay save
- Achievement system

## Roadmap (What's Next)

### High Priority — SC2 Mechanics Parity
- ~~Fix practice scenario black screen~~ — fixed
- ~~Fair-play AI~~ — AI now mines resources, builds buildings, produces units through production queues, respects supply. All tactical/micro AI preserved.
- **Bunker + unit loading** — Terran Bunker building, load/unload Marines (core defensive mechanic)
- **Protoss faction** — shields, pylon power, warp-in, Gateway/Nexus/Pylon, ~10 units (Zealot, Stalker, Sentry, Immortal, Colossus, Phoenix, Void Ray, High Templar, Dark Templar, Observer)

### Medium Priority — SC2 Mechanics Completion
- **MULE / Orbital Command** — CC upgrades to Orbital, call down MULE for accelerated mining
- **Addon attach/detach UI** — Tech Lab / Reactor buildable from Barracks/Factory/Starport, swappable
- **Queen Creep Tumor** — manual creep spread ability, tumors spread autonomously
- **Multi-SCV speed build** — multiple SCVs repairing a building under construction to speed it up
- **Viper Abduct polish** — pull/teleport animation and targeting
- **Shift-queue abilities** — queue multiple commands with shift

### Medium Priority — Polish
- Sound design (Web Speech API voice lines, positional audio)
- Multiplayer foundation (WebRTC, lockstep)

### Low Priority / Future
- Procedural map generation
- Replay spectator mode
- ELO/MMR system
- Community map sharing

### Completed (This Sprint)
- ~~Fix Zerg skirmish faction~~ — activePlayerFaction system
- ~~Terrain visuals upgrade~~ — elevation system, tile transitions, fog vision
- ~~Remaining unit animations~~ — all 24 units have detailed rendering
- ~~SC2 stat accuracy~~ — Siege Tank, Zergling, Corrosive Bile corrected
- ~~Zerg creep requirement~~ — buildings require creep (except Hatchery)
- ~~SCV Repair~~ — right-click damaged building/mech
- ~~Ghost Snipe~~ — 170 damage, 75 energy
- ~~Queen Transfuse~~ — 75 HP heal, 50 energy
- ~~Overkill prevention~~ — pendingDamage tracking in combat
- ~~Supply Depot lowering~~ — L key toggle, updates walkability
- ~~Production UI overhaul~~ — 14-key command card, SC2-style buttons
- ~~Building system alignment~~ — B from workers, SCV orbit, Zerg auto-build
- ~~Fair-play AI~~ — real economy (workers mine, production queues, supply limits), macro management, difficulty scaling via APM + worker caps
- ~~Unit iteration pass~~ — 15 new abilities, 3 defensive buildings, 14 bug fixes, per-unit supply costs, SC2 stat corrections (~70% → ~93% completeness)

## Architecture

```
src/
├── main.ts              # Entry, menu, scenario browser
├── Game.ts              # PixiJS app, game loop, init
├── constants.ts         # Enums, balance numbers
├── ecs/
│   ├── world.ts         # ECS core (TypedArrays, bitmasks)
│   └── components.ts    # All component definitions (SoA)
├── systems/             # Game logic (AI, combat, movement, etc.)
├── rendering/           # PixiJS renderers (tilemap, units, UI)
├── map/                 # Map generation, pathfinding, editor (vaulted)
├── data/                # Unit/building stat definitions
├── input/               # Mouse, keyboard, touch handling
├── scenarios/           # Practice drills, campaign (vaulted)
└── stats/               # Achievements, score tracking
```

## Key Patterns
- **SoA layout**: `posX[eid]`, `posY[eid]` — cache-friendly iteration
- **Fixed timestep**: 60 tick/sec simulation, variable render
- **Faction rendering**: Terran = rectangles (angular), Zerg = ellipses (organic)
- **Screen vs world space**: Selection in screen space, everything else in viewport
- **180° rotational symmetry**: All maps mirror about center (64,64)
