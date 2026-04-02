# Swarm Command — SC2 Mechanics Practice Tool

Practice StarCraft 2 mechanics in your browser. True unit stats. No install.

**Live demo:** https://d-ungvari.github.io/swarm-command/

![Swarm Command gameplay](screenshot.png)

![CI](https://github.com/D-ungvari/swarm-command/actions/workflows/deploy.yml/badge.svg)

---

## Features

- **14 practice scenarios** — micro, macro, build order, timing, and survival drills
- **10 campaign missions** — 5 Terran + 5 Zerg with progressive unlock
- **27 unit types** — 13 Terran, 14 Zerg with authentic stats and abilities
- **Build order trainer** — practice real SC2 openers against AI pressure
- **Veterancy system** — units gain kill-count stars and visual rank-ups
- **Achievements** — track milestones across sessions
- **4 difficulty levels** — Easy, Normal, Hard, Brutal
- **3 win conditions** — Destroy All, Timed Survival (10 min), Economy (5000 resources)
- **Fog of war** — toggle on/off
- **3 map layouts** — Plains, Canyon, Islands + custom map editor
- **Replay system** — save and watch replays
- **Survival mode** — endless waves
- **Stim Pack, Siege Mode, and more** — unit abilities with real cooldowns
- **Full control group support** — Ctrl+0-9 for SC2-style army management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| Renderer | PixiJS v8 (WebGL2) |
| Camera | pixi-viewport (pan, zoom, edge-scroll) |
| Pathfinding | A* via pathfinding.js |
| Build | Vite |
| Tests | Vitest (198 tests) |
| ECS | Hand-rolled (TypedArrays + bitmask queries) |

---

## Run Locally

```bash
npm install
npm run dev   # → http://localhost:3000
```

Other commands:

```bash
npm run build   # production build → dist/
npm test        # run Vitest suite
```

---

## Architecture

### Hand-rolled ECS

Entities are plain integer IDs. Components are stored as parallel TypedArrays in struct-of-arrays layout (`posX[eid]`, `posY[eid]`), keeping hot-path iteration cache-friendly. Queries use bitmasks — no object allocation per tick.

### Fixed Timestep Game Loop

Game logic ticks at a fixed 60 Hz regardless of frame rate. The render step interpolates between the previous and current game state, decoupling simulation accuracy from display refresh rate.

### Command Queue Input

All player input (move, attack, gather, ability) is translated into discrete command objects and pushed onto a per-unit queue. Systems drain the queue each tick, making input replay and undo straightforward to add.

---

## Controls

| Input | Action |
|-------|--------|
| LMB / Drag | Select units |
| RMB | Move / Attack / Gather |
| A + Click | Attack-move |
| B + 1–6 | Build structure |
| Q / W | Produce units |
| T | Stim Pack (Marine) |
| E | Siege Mode (Tank) |
| Ctrl+0–9 | Set control group |
| S / H | Stop / Hold position |
| Space | Jump to base |
| F2 | Select idle workers |
| F1 | Toggle help overlay |

---

## Project Structure

```
src/
├── ecs/           # Hand-rolled ECS — world, components (TypedArrays)
├── systems/       # Game systems — Combat, AI, Movement, Selection, Death, Abilities
├── rendering/     # PixiJS renderers — Units, Tilemap, Fog, Minimap, Projectiles, UI
├── input/         # Input manager, command queue, key bindings
├── map/           # Map generation, pathfinding, tile data
├── data/          # Unit and building stat definitions
├── scenarios/     # Practice scenarios, campaign missions, score tracking
├── audio/         # Procedural sound via Web Audio API
└── main.ts        # Entry point
```

---

## Why This Project

Built as a portfolio piece demonstrating:

- **TypeScript architecture** — strict mode, no `any`, clean module boundaries
- **Performance engineering** — SoA ECS with TypedArrays, bitmask queries, viewport culling
- **Game AI** — build orders, threat assessment, multi-prong attacks, base defense, harassment squads
- **SC2 domain knowledge** — accurate unit stats, proper ability mechanics, real build orders
- **Full product scope** — practice scenarios, campaign, achievements, replay, map editor

> "I understood SC2's mechanics deeply enough to recreate them accurately in TypeScript"

---

## License

MIT
