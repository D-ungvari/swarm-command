# Progress

## Current Phase
SESSION HANDOFF — Backlog #1-4 complete

## Current Work
(none)

## Session Handoff
- **Completed this session:** Backlog #4 (Buildings & production queues)
- **Previously completed:** Backlog #1 (Combat), #2 (Abilities), #3 (Economy)
- **Next session should:** Pick up Backlog #5 (AI opponent)
- **No blockers**

## Completed
### Backlog #4: Buildings & Production (Phase 5)
- 3 Terran buildings: Command Center, Supply Depot, Barracks
- Building placement (B+1/2/3, ghost preview, validation)
- SCV construction (walk to site, progress bar, HP scaling)
- Production queues (Q/W hotkeys, timer-based spawning)
- Supply system (10 start, +8 per depot, units cost 1)
- Rally points (right-click building)
- 103 tests total
- Commit: bad3b01

## Architecture Notes
- System order: selection → command → build → production → movement → combat → ability → gather → death
- 13 component bits used (+ BUILDING, SUPPLY), 19 remaining
- PlayerResources has supplyUsed/supplyProvided
- Buildings are ECS entities with POSITION|HEALTH|SELECTABLE|RENDERABLE|BUILDING|SUPPLY
- spawnUnitAt handles supply tracking (single source of truth)
- Pathfinder cache auto-invalidated when building tiles marked/cleared
- Terran buildings only — Zerg deferred
