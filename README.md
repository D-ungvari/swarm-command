# Swarm Command

SC2 mechanics practice tool in the browser. True unit stats. No install.

**[Play now](https://d-ungvari.github.io/swarm-command/)**

![CI](https://github.com/D-ungvari/swarm-command/actions/workflows/deploy.yml/badge.svg)

## Features

- 14 practice scenarios (micro drills, build order trainers, timing attacks)
- Skirmish vs AI with 4 difficulty levels and 10 maps
- 13 unit types (7 Terran, 6 Zerg) with SC2 LotV-accurate stats
- Abilities: Stim, Siege Mode, Medivac heal, Ghost cloak, Queen inject
- Full SC2 keybindings, control groups, fog of war, replay system
- AI with APM-based difficulty, tactical micro, adaptive strategy

## Run Locally

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # 198 tests
npm run build    # production build
```

## Tech

TypeScript (strict) / PixiJS v8 / Vite / Vitest / hand-rolled ECS with TypedArrays + bitmask queries / A* pathfinding / fixed 60Hz tick with variable render

## License

MIT
