# Swarm Command

A StarCraft-inspired real-time strategy game running entirely in the browser. Command Terran forces against a Zerg AI across a procedurally generated map.

**Live demo:** https://YOUR_GITHUB_USERNAME.github.io/swarm-command/

![Swarm Command gameplay](screenshot.png)

![CI](https://github.com/YOUR_GITHUB_USERNAME/swarm-command/actions/workflows/deploy.yml/badge.svg)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict) |
| Renderer | PixiJS v8 (WebGL2) |
| Camera | pixi-viewport (pan, zoom, edge-scroll) |
| Pathfinding | A* via pathfinding.js |
| Build | Vite |
| Tests | Vitest |
| ECS | Hand-rolled (TypedArrays + bitmask queries) |

---

## Key Features

- 10 unit types across two factions (Terran and Zerg)
- Unit abilities: Stim Pack (Marine), Siege Mode (Tank)
- Building queue and unit production
- Resource gathering and base economy
- Fog of war
- Four AI difficulty levels (Easy / Normal / Hard / Brutal)
- Drag-box multi-unit selection and control groups (Ctrl+0–9)
- Attack-move and hold-position commands

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

## License

MIT
