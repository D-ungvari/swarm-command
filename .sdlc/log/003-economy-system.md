# Log: Economy — minerals, gas, workers, resource HUD
Started: 2026-03-30

## PLAN
### Scope
- Mineral patches as ECS entities (clickable, depletable)
- Worker gather AI: walk to patch → mine → walk back → deposit → repeat
- Per-player resource tracking (minerals, gas)
- Resource HUD (minerals + gas placeholder)
- Skip gas gathering (needs Refinery from Backlog #4)

### Key decisions
- Resource nodes use HEALTH for depletion (DeathSystem removes empty patches for free)
- RESOURCE bit (bit 9) + WORKER bit (bit 10) — 2 new component bits
- PlayerResources as plain object on Game, not ECS
- Workers return to fixed base position (spawn location) — no buildings yet
- CommandMode.Gather = 4 for gather command
- WorkerState FSM: Idle → MovingToResource → Mining → ReturningToBase → loop
- Mineral tiles unwalkable; workers path to adjacent tile, mine within range
- HUD as HTML overlay div (crisp text, simple)

## DEV
### Step 1-2: Constants + Components
- Files: src/constants.ts, src/ecs/components.ts
- Result: done
- Notes: RESOURCE/WORKER bits (9,10), 8 new TypedArrays, addWorkerComponent, addResourceComponents

### Step 3-4: Resource spawning + Map utilities
- Files: src/Game.ts, src/map/MapData.ts
- Result: done
- Notes: getResourceTiles, findNearestWalkableTile, spawnResourceNodes, PlayerResources state

### Step 5-6: Resource rendering + queries
- Files: src/rendering/UnitRenderer.ts, src/ecs/queries.ts
- Result: done
- Notes: Diamond minerals, pulsing gas, findResourceAt, findNearestMineral

### Step 7: CommandSystem gather extension
- Files: src/systems/CommandSystem.ts
- Result: done
- Notes: Right-click mineral → workers gather, non-workers move. Mixed selection handled.

### Step 8: GatherSystem
- Files: src/systems/GatherSystem.ts (new)
- Result: done
- Notes: Worker FSM: MovingToResource → Mining → ReturningToBase → loop. Retargets on depletion.

### Step 9-10: Game wiring + HUD
- Files: src/Game.ts, src/rendering/HudRenderer.ts (new)
- Result: done
- Notes: gatherSystem in tick loop after ability/before death. HTML HUD overlay.

## TEST
- Run: npm test
- Result: PASS
- Output: 5 test files, 87 tests, 0 failures (317ms)
- Fix attempts: 0

## REVIEW
- Result: CHANGES_REQUESTED → fixed → APPROVED
- Feedback:
  1. findNearestMineral missing ResourceType.Mineral filter (bug, fixed)
  2. tickReturningToBase used WORKER_MINE_RANGE instead of ARRIVAL_THRESHOLD (bug, fixed)
- Fix rounds: 1

## COMMIT
- Hash: 520faeb
- Message: feat: add economy system with mineral gathering, worker AI, and resource HUD
- Files: 14 files (components, constants, queries, Game, GatherSystem, CommandSystem, UnitRenderer, HudRenderer, MapData, types, helpers, tests)
- Timestamp: 2026-03-30
