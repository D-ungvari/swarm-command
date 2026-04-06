# RTS.io

Browser-based multiplayer .io RTS battle arena. Command armies, raid economies, crush opponents.

## Vision

Drop into a shared arena, pick a faction, build an army, and fight other players in real-time. 12 unique factions with distinct playstyles — from swarming bio-hordes to shielded arcane warriors to self-repairing machine armies.

## Status

**Early development** — forked from [Swarm Command](https://github.com/D-ungvari/swarm-command) engine.

See `.sdlc/plans/multiplayer-arena-pivot.md` for the full design doc.

## Run Locally

```bash
npm install
npm run dev
```

## Tech Stack

- TypeScript (strict)
- PixiJS v8 (WebGL2 rendering)
- Node.js WebSocket server (planned)
- Hand-rolled ECS with TypedArrays
- A* pathfinding

## License

Private
