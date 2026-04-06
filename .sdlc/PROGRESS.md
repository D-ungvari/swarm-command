# Progress

## Product Vision
**Two parallel products:**
1. **Swarm Command** (this repo) — SC2 Mechanics Practice Tool, feature-complete, portfolio piece
2. **rts.io** (D-ungvari/rts.io) — Multiplayer .io battle arena, original IP, 4+ factions, the active development target

## Current Phase
PIVOT — Swarm Command is feature-complete. Active development moves to rts.io.

## What was completed (Swarm Command)
All 8 ultraplans shipped:
- **SC2 Skirmish Audit** (16 tasks): stat fixes, Extractor, tech gates, Lair/Hive, tech buildings, research, detection, elevation, morphs, Medivac, unit abilities, Vehicle Armor, missing units, polish
- **Gameplay Loop Improvements** (11 tasks): macro hotkeys, last-alert camera, multi-building select, supply block, shift-queue, worker saturation, rally points, auto-gather, watchtower, idle production, attack indicators
- **Enemy AI Overhaul** (7 tasks): build order engine, production/economy fix, composition targeting, attack intelligence, queen inject, building schedule, difficulty scaling
- **AI Resilience & Cohesion** (3 tasks): defensive structures, building rebuild, expansion defense
- **Unit Commanding Sophistication**: individual pathfinding, auto-attack, idle reset
- **Unit Visual Overhaul** (8 tasks): Carbot palette alignment across all units/buildings
- **Map Visual Overhaul** (10 tasks): procedural terrain textures, elevation, water, creep, decorations
- **UI Look and Feel** (6 tasks): design token system, panel frames, button factories, faction theming

219 tests passing. All type checks clean.

## rts.io fork status
Engine forked to D-ungvari/rts.io. Foundation complete:
- Phase 0: Headless Simulation extracted ✅
- Phase 1: WebSocket server skeleton ✅
- Phase 1.5: 4 original factions data defined ✅
- Phase 2 (partial): NodeEconomy, MatchManager, ArenaMap, HexGrid ✅
- SC2 content stripped from all systems ✅
- Systems in stripped-but-not-rebuilt state — needs full rebuild for new factions

## What to do next
Execute full-backlog-expansion.md ultraplan in the rts.io repo (17 tasks).
Start with Phase A: rebuild core systems (T1-T7) to make the game playable locally with new factions.
