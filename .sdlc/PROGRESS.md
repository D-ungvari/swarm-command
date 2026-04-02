# Progress

## Current Phase
IDLE — Ready for Sprint 1 (Tech tree UI)

## What to do next
Run `/go` inside `swarm-command/` to start Sprint 1 (item #53 in BACKLOG.md).

Sprint 1 = Iteration F (Tech tree UI + Zerg buildings):
- F.1: Prerequisite labels in build menu ("Req: Barracks" text on locked slots)
- F.2: Locked building flash + tooltip when pressing a locked building's key
- F.4: Add missing Zerg tech buildings (RoachWarren, HydraliskDen, Spire, InfestationPit)
- F.5: Gate production buttons by tech availability

## Master Plan
See `ITERATION_PLAN_2.md` for the full 104-sprint / ~120-day roadmap.
Iterations A–AA cover: Selection UI, AI overhaul, Visual overhaul, Audio,
Game systems, Multiplayer, Campaign, Map editor, Protoss faction,
Spectator, PWA, Leaderboard, Modding, Ranked MMR, AI Director,
Start menu redesign, and 7 new maps.

## Architecture Notes (current state)
- 29 units across 2 factions (Terran + Zerg), air/ground targeting
- Input: command queue + frame-rate selection (zero click loss)
- AI: build orders (12-pool, Roach push, Lair macro, Terran bio) + harassment + expansion
- Deterministic seeded RNG + command recorder + replay save/load
- 197 tests passing, 0 TypeScript errors
- Mobile touch support (tap select, two-finger tap to move, portrait overlay)
- Tech tree logic correct; UI does not communicate prerequisites
