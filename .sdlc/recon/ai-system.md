---
subsystem: AI System — Decision Making, Production, Army Management
last_verified: 2026-04-05
created_for: Enemy AI Overhaul (Backlog #94, Task 1 — Build Order Engine)
files_in_scope: src/systems/AISystem.ts, src/constants.ts, src/data/units.ts, src/data/buildings.ts, src/ecs/components.ts
---

## Recon: AI System

**Codebase patterns:** All AI logic lives in a single 2748-line file (AISystem.ts). Module-level mutable state (Sets, numbers, objects) tracks army rosters, wave count, strategies, personality. Functions are plain (no classes). AI issues commands by directly writing component arrays (commandMode[], targetEntity[], setPath()) — NOT through the player's simulationQueue. Production uses the same fair-play system as the player (aiQueueUnit → prodUnitType/prodQueue on Hatchery entities). RNG via imported `rng` module (seeded).

### Files in scope
| File | Purpose | Key patterns |
|------|---------|-------------|
| AISystem.ts (2748 lines) | All AI logic: build orders, macro, army management, micro, abilities | Module-level state, exported: initAI(), aiSystem(), getAIState(), setAIMinerals() |
| constants.ts (339 lines) | Enums (UnitType, BuildingType, Faction, Difficulty, etc.), DIFFICULTY_CONFIGS, all numeric constants | const enums, exported Record<Difficulty, Config> |
| data/units.ts (305 lines) | UNIT_DEFS: Record<UnitType, UnitDef> — all 25 unit stats | Flat object keyed by UnitType enum |
| data/buildings.ts (291 lines) | BUILDING_DEFS: Record<BuildingType, BuildingDef> — all 17 building stats, produces[] | Flat object keyed by BuildingType enum |
| ecs/components.ts (412 lines) | SoA TypedArrays: larvaCount, larvaRegenTimer, injectTimer, prodUnitType, prodQueue, prodQueueLen, etc. | Parallel arrays indexed by entity ID |

### Architecture context

**Build Order System (lines 36-47, 52-71, 739-803):**
- `BuildOrderStep` has trigger (supply/time/unit_count/always) + action (unit/attack/expand/upgrade)
- 3 Zerg profiles: ZERG_12_POOL (4 steps), ZERG_ROACH_PUSH (4 steps), ZERG_LAIR_MACRO (4 steps)
- 1 Terran profile: TERRAN_BIO (5 steps)
- `executeBuildOrder()` iterates steps sequentially, checks trigger, executes action
- Steps marked `done: true` when completed; `buildOrderIndex` advances

**Production (lines 96-160, aiQueueUnit):**
- Finds first completed Hatchery with larva > 0 and queue not full
- Deducts resources, consumes larva, starts production or adds to queue
- PROD_QUEUE_MAX = 5 per building
- Larva: 3 max natural, 11s regen, inject adds 3 bonus (29s cast)

**Army Management:**
- `armyEids` (main army), `harassEids`, `scoutEids`, `defenseEids`, `harassSquad1/2`, `vanguardEids` — all Set<number>
- `claimNewUnits()` puts non-worker, non-Overlord units into armyEids
- Queens currently go into armyEids (bug — should stay home)

**Attack Decision (lines 1886-1942, decideAttack):**
- Threshold: FIRST_WAVE_SIZES[diff] + waveCount * WAVE_SIZE_GROWTH (growth=4)
- Normal first wave = 4 units. Attacks when armyEids.size >= threshold
- APM-gated at cost 5
- Multi-prong on Hard/Brutal (30% harass squad to alternate entry)

**Building Schedule (lines 614-621):**
- Wave-gated: Refinery at wave 0, RoachWarren wave 1, EvoChamber wave 2, SpawningPool wave 3 (!), HydraliskDen wave 5, Spire wave 7
- `checkAIBuildingSchedule()` checks waveCount >= entry.minWave

**Macro Management (lines 351-397):**
- Assign idle workers to minerals/gas
- Build Overlord when within 4 supply of cap
- Build workers until 16 per base
- Check building schedule

**APM System (lines 418-450):**
- Budget refills: pointsPerSecond = maxApm / 60; cap = maxApm / 4
- Costs: spawn=2, move=1, micro=3, ability=2, scout=1, attack_decision=5
- Normal (80 APM): cap=20, 1.33 pts/sec

**Decision Tick (lines 1248-1365, main aiSystem):**
- Runs every DECISION_INTERVAL=15 ticks (~250ms)
- Order: defense → refillAPM → prune → claim → intel → baseDefense → macro → expansion → buildOrder → spawn(1+floor(wave/2)) → scout → strategy → retreat → vanguard → harassSquads → decideAttack → harassment → micro → engagement → combatAwareness → abilities → upgrades

**Module-level state variables (all reset in initAI, lines 587-720):**
currentDifficulty, currentAIFaction, enemyFaction, playerBaseTile, waveCount, tickCounter, lastDecisionTime, isAttacking, attackEndTime, retreating, lastRetreatTime, regroupX/Y, armyEids, harassEids, scoutEids, defenseEids, lastDefenseTime, defenseAreaClearSince, aiBuildingsPlaced, personality, intel, apmBudget, apmSpentTotal, currentStrategy, strategySetTime, lastTechSwitchTime, activeBuildOrder, buildOrderIndex, hasExpanded, currentMap, cachedResources, harassSquad1/2, vanguardEids, terranArmyEids, terranLastSpawnTime, lastBuildingWaveCheck, lastAIUpgradeWave, nextAIUpgradeType, lastHarassTime, lastScoutSendTime, workerCap (to be added)

### Adjacent files (DO NOT MODIFY)
- ProductionSystem.ts — handles timer ticking and queue advancement (correct as-is)
- CombatSystem.ts — target acquisition, damage
- CommandSystem.ts — player input command processing
- MovementSystem.ts — path following
- GatherSystem.ts — worker mining state machine
- Game.ts — system wiring, spawnUnit/spawnBuilding callbacks

### Existing test coverage
- tests/systems/AISystem.test.ts: initial delay, production queuing, unit claiming, dead pruning, attack triggering
- Test command: `npm test`
- Build/typecheck: `npm run build`
