# Progress

## Current Phase
SESSION HANDOFF — Backlog #1, #2, #3 complete

## Current Work
(none — session ending, context window filling up)

## Session Handoff
- **Completed this session:** Backlog #1 (Combat), #2 (Special abilities), #3 (Economy)
- **Next session should:** Pick up Backlog #4 (Buildings & production queues)
- **No blockers**
- **Git initialized.** Two commits: 79ac303 (initial), 520faeb (economy)

## Completed
### Backlog #1: Combat System (Phase 3)
- CombatSystem, DeathSystem, attack-move, visual effects
- Commit: 79ac303

### Backlog #2: Special Abilities (Phase 4)
- Stim, Concussive Shells, Siege Mode, Medivac Heal, Roach Regen
- Commit: 79ac303

### Backlog #3: Economy (Phase 5 partial)
- Mineral patches as ECS entities, worker gather AI, resource HUD
- GatherSystem with FSM: MovingToResource → Mining → ReturningToBase → loop
- 87 tests total
- Commit: 520faeb

## Architecture Notes
- System order: selection → command → movement → combat → ability → gather → death
- 11 component bits used (POSITION, VELOCITY, HEALTH, ATTACK, MOVEMENT, SELECTABLE, RENDERABLE, UNIT_TYPE, ABILITY, RESOURCE, WORKER), 21 remaining
- PlayerResources is a plain object on Game, not ECS
- Workers return to fixed base position (spawn point) — will need updating when buildings exist
- Gas gathering not implemented (needs Refinery building from Backlog #4)
