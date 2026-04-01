# Progress

## Current Phase
IN PROGRESS — Sprint 1: Input Architecture Overhaul

## Current Work
Sprint 1 steps:
- [ ] 1.1: Create `src/input/CommandQueue.ts` — CommandType enum, GameCommand interface, CommandQueue class
- [ ] 1.2: Update `src/input/InputManager.ts` — event array buffering (replace boolean flags)
- [ ] 1.3: Create `src/input/InputProcessor.ts` — converts raw input to GameCommand each frame
- [ ] 1.4: Update `src/Game.ts` — move selection out of tick(), wire command queue in frame loop
- [ ] 1.5: Update `src/systems/SelectionSystem.ts` — consume GameCommands instead of raw InputState
- [ ] 1.6: Update `src/systems/CommandSystem.ts` — consume GameCommands instead of raw InputState
- [ ] 1.7: Update tests — new command-based API

## Previously Completed
- Commit 79ac303: Engine foundation, combat system, full unit roster, special abilities
- Commit 520faeb: Economy system (minerals, gas, workers, resource HUD)
- Commit bad3b01: Buildings & production queues
- Commit 803a29d: AI opponent, minimap, fog of war, UI polish, alerts, victory screen

## Architecture Notes
- System order: selection → command → build → production → movement → combat → ability → gather → death → AI → fog
- 13 component bits used (POSITION, VELOCITY, HEALTH, ATTACK, MOVEMENT, SELECTABLE, RENDERABLE, UNIT_TYPE, ABILITY, RESOURCE, WORKER, BUILDING, SUPPLY)
- 123 tests across 8 test files (Vitest)
- Sprint 1 goal: input latency 16.7ms → ~0ms for selection, ~8ms avg for commands
- See ITERATION_PLAN.md for full 13-sprint roadmap
