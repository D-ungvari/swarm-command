---
scope: AI Resilience & Army Cohesion — Make the Zerg AI feel dangerous and robust
created: 2026-04-05
backlog_items: 94
task_count: 5
status: READY
---

# Ultraplan: AI Resilience & Army Cohesion

## Vision Alignment
The Zerg AI overhaul gave it real build orders and composition targeting, but the army still dribbles in piecemeal, harassment attacks empty ground, destroyed buildings are never rebuilt, and the base has zero static defense. These 5 quick wins make the AI feel like a real opponent that's hard to exploit.

## Scope Summary
- **Items planned:** 1 (continuation of Backlog #94)
- **Tasks generated:** 5
- **Estimated total size:** 3S + 2M
- **Critical path:** T1 → T3 (defensive buildings enable expansion defense)
- **New patterns needed:** None — all extend existing AI patterns

## Dependency Graph
```
T1: Defensive Structures (Spine/Spore)
  └──→ T3: Expansion Defense
T2: Critical Building Rebuild ──(independent)
T4: Dynamic Harassment Targets ──(independent)
T5: Army Staging & Cohesion ──(independent)
```

## Execution Order

| # | Task | Size | Depends on | What it fixes |
|---|------|------|-----------|---------------|
| 1 | Defensive structure placement | S | — | AI builds Spine/Spore Crawlers at base |
| 2 | Critical building rebuild | S | — | AI replaces destroyed tech buildings + Refineries |
| 3 | Expansion defense | M | 1 | Stations defenders and crawlers at expansions |
| 4 | Dynamic harassment targets | S | — | Harassment squads find actual enemy workers/buildings |
| 5 | Army staging & cohesion | M | — | Army regroups before attacking; no more dribbling |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Defensive buildings placed on unwalkable tiles | MED | Use existing placement validation in aiBuildBuilding |
| Army staging delays attacks too long | MED | Timeout: attack after 10s even if not fully regrouped |
| Rebuild logic burns minerals needed for army | LOW | Only rebuild if minerals > 200 |

---

## Task Specs

---

### Task 1: Defensive Structure Placement
**Parent:** Backlog #94 — AI Resilience
**Size:** S
**Depends on:** none
**Unblocks:** Task 3

#### Goal
AI builds 2 Spine Crawlers and 1 Spore Crawler near its main base by ~2-3 minutes. Adds base-level static defense the AI currently completely lacks.

#### Prerequisites
- SpineCrawler (BuildingType.SpineCrawler) and SporeCrawler (BuildingType.SporeCrawler) exist in BUILDING_DEFS
- `aiBuildBuilding()` handles building placement
- `AI_BUILDING_SCHEDULE` is time-gated (from Task 6 of previous overhaul)

#### Changes (in execution order)

**Step 1: Add Spine/Spore Crawlers to building schedule**
- File: `src/systems/AISystem.ts`
- Change: Add entries to `AI_BUILDING_SCHEDULE`:
  - `{ minTime: 60, type: BuildingType.SpineCrawler, colOffset: -2, rowOffset: -4 }` (natural entrance)
  - `{ minTime: 75, type: BuildingType.SpineCrawler, colOffset: 2, rowOffset: -4 }` (natural entrance other side)
  - `{ minTime: 150, type: BuildingType.SporeCrawler, colOffset: 0, rowOffset: -3 }` (anti-air at base)
- Pattern: Follows existing schedule entries at line 836
- Why: Static defense at the natural choke makes early rushes less free

#### Edge cases
- Building placement fails (tile occupied) → `aiBuildBuilding` returns false, `aiBuildingsPlaced` not marked, retries next tick
- AI on different map where offsets land on unwalkable → existing placement validation handles this

#### NOT in scope
- Dynamic placement based on enemy approach direction (Task 3 partially covers this for expansions)
- Spore Crawler at expansions (Task 3)

#### Acceptance criteria
- [ ] AI builds 2 Spine Crawlers by ~75 seconds
- [ ] AI builds 1 Spore Crawler by ~150 seconds
- [ ] Buildings appear near main base entrance area
- [ ] Existing tests pass, type-check clean

#### Test plan
- `npm test` + `npx tsc --noEmit`
- Manual: skirmish Normal, observe defensive buildings appear near base

---

### Task 2: Critical Building Rebuild
**Parent:** Backlog #94 — AI Resilience
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
AI detects when critical buildings (Spawning Pool, Roach Warren, Hydralisk Den, Refinery, Hatchery) are destroyed and queues replacements. Currently if player snipes a tech building, the AI's tech tree is permanently broken.

#### Changes (in execution order)

**Step 1: Add `checkCriticalBuildings()` function**
- File: `src/systems/AISystem.ts`
- Change: New function called from the main Zerg AI decision tick (after macro management). Scans for each critical building type. If one existed (tracked via `aiBuildingsPlaced`) but no longer has a living instance, queue a rebuild via `aiBuildBuilding` with the same offset. Only rebuild if minerals > 200 (don't starve army production).
```typescript
function checkCriticalBuildings(world: World, map: MapData, resources: Record<number, PlayerResources>, spawnBuildingFn: SpawnBuildingFn): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;
  const res = resources[currentAIFaction];
  if (!res || res.minerals < 200) return;

  const hatch = findZergHatchery(world);
  if (hatch === 0) return;
  const hatchTile = worldToTile(posX[hatch], posY[hatch]);

  // Check each critical building type
  const criticals: Array<{ type: number; colOffset: number; rowOffset: number }> = [
    { type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 },
    { type: BuildingType.Refinery, colOffset: 4, rowOffset: -3 },
    { type: BuildingType.RoachWarren, colOffset: 5, rowOffset: 0 },
    { type: BuildingType.HydraliskDen, colOffset: 5, rowOffset: 5 },
  ];

  for (const crit of criticals) {
    // Check if we ever built one (any schedule entry of this type was placed)
    let wasBuilt = false;
    for (let i = 0; i < AI_BUILDING_SCHEDULE.length; i++) {
      if (AI_BUILDING_SCHEDULE[i].type === crit.type && aiBuildingsPlaced.has(i)) {
        wasBuilt = true;
        break;
      }
    }
    if (!wasBuilt) continue; // Never built this type, don't need to rebuild

    // Check if a living instance exists
    let exists = false;
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, BUILDING | POSITION)) continue;
      if (faction[eid] !== currentAIFaction) continue;
      if (buildingType[eid] !== crit.type) continue;
      if (hpCurrent[eid] <= 0) continue;
      exists = true;
      break;
    }
    if (exists) continue;

    // Rebuild it
    aiBuildBuilding(world, crit.type, hatchTile.col + crit.colOffset, hatchTile.row + crit.rowOffset, map, resources, spawnBuildingFn);
  }
}
```
- Pattern: Follows `checkAIBuildingSchedule()` pattern
- Why: Prevents permanent tech death from a single building snipe

**Step 2: Call from main AI loop**
- File: `src/systems/AISystem.ts`
- Change: Add `checkCriticalBuildings(world, map, resources, spawnBuildingFn);` after `runMacroManagement()` in the main Zerg decision tick.

#### Edge cases
- Building under construction when check runs → `hpCurrent > 0` and `buildState !== Complete` — function checks HP only, so under-construction buildings count as "exists". This is correct.
- Multiple buildings of same type (2 Refineries) → only checks if at least one exists. If both die, rebuilds one.

#### Acceptance criteria
- [ ] Destroying the Spawning Pool causes AI to rebuild it within ~30 seconds
- [ ] Destroying the Refinery causes rebuild
- [ ] Rebuild only happens if AI has 200+ minerals
- [ ] Existing tests pass, type-check clean

#### Test plan
- `npm test` + `npx tsc --noEmit`
- Manual: skirmish, destroy AI's Spawning Pool, observe rebuild

---

### Task 3: Expansion Defense
**Parent:** Backlog #94 — AI Resilience
**Size:** M
**Depends on:** Task 1
**Unblocks:** none

#### Goal
AI stations a small guard force (3-4 units) at each expansion and builds a Spine Crawler there. Currently expansions are completely undefended — player can snipe them for free.

#### Changes (in execution order)

**Step 1: Add expansion defense tracking**
- File: `src/systems/AISystem.ts`
- Change: Add `let expansionDefenseEids: Map<number, Set<number>> = new Map();` (maps expansion index to defender set). Reset in `initAI()`.

**Step 2: Build defensive structure at expansion**
- File: `src/systems/AISystem.ts`
- Change: In `attemptExpansion()`, after successfully placing a Hatchery, also place a Spine Crawler at `col+2, row+2` offset from the expansion location (if affordable).

**Step 3: Station defenders at expansions**
- File: `src/systems/AISystem.ts`
- Change: Add `defendExpansions()` function called from main loop. For each expansion location with a living Hatchery, ensure 3-4 army units are stationed there (pulled from `armyEids`). Defenders attack-move to expansion position. If expansion is destroyed, return defenders to main army.

**Step 4: Prune dead expansion defenders**
- File: `src/systems/AISystem.ts`
- Change: Add pruning of `expansionDefenseEids` in `pruneDeadUnits()`.

#### Edge cases
- Not enough army to defend all expansions → only station defenders if armyEids.size > 10 (don't weaken main force below critical mass)
- Expansion Hatchery killed → defenders return to armyEids, defense set cleared

#### Acceptance criteria
- [ ] Each new expansion gets a Spine Crawler
- [ ] 3-4 units stationed near each expansion
- [ ] Defenders return to army if expansion dies
- [ ] No defenders pulled if army is too small (< 10)
- [ ] Existing tests pass, type-check clean

#### Test plan
- `npm test` + `npx tsc --noEmit`
- Manual: let AI expand, observe defenders + Spine at expansion

---

### Task 4: Dynamic Harassment Targets
**Parent:** Backlog #94 — AI Resilience
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Harassment squads find actual enemy workers and buildings instead of attacking hardcoded tile coordinates. Currently they attack (12,18) even if nobody's there.

#### Changes (in execution order)

**Step 1: Replace HARASS_TARGET constants with dynamic lookup**
- File: `src/systems/AISystem.ts`
- Change: Replace `HARASS_TARGET_1` and `HARASS_TARGET_2` usage in `runHarassSquads()`. New logic:
  - `findHarassTarget()`: Scan for enemy workers (WORKER component) near known enemy base. If found, target their position. If not found, use `intel.lastKnownEnemyX/Y` if available. Final fallback: `playerBaseTile`.
  - Squad 1 targets the primary worker cluster (player's main mineral line)
  - Squad 2 targets secondary location (if player has expansion, target that; otherwise flank route)
- Pattern: Follows `findAttackTarget()` pattern (line ~2080)
- Why: Harassment that hits actual workers is dramatically more impactful than attacking empty ground

**Step 2: Update moveHarassSquadToTarget to use dynamic positions**
- File: `src/systems/AISystem.ts`
- Change: `runHarassSquads()` calls `findHarassTarget()` each decision tick instead of using constants. Pass result to `moveHarassSquadToTarget()`.

#### Edge cases
- No enemy workers visible → fallback to playerBaseTile (always valid)
- Player has no expansion → both squads target main base from different angles
- All enemy workers dead → squads target buildings instead

#### Acceptance criteria
- [ ] Harassment squads path toward actual enemy worker clusters
- [ ] Squads adapt when player moves workers or takes expansions
- [ ] Fallback to player base when nothing visible
- [ ] Existing tests pass, type-check clean

#### Test plan
- `npm test` + `npx tsc --noEmit`
- Manual: move workers to non-standard location, observe AI harass follows

---

### Task 5: Army Staging & Cohesion
**Parent:** Backlog #94 — AI Resilience
**Size:** M
**Depends on:** none
**Unblocks:** none

#### Goal
Army regroups at a staging point before attacking so all units arrive together instead of Zerglings dying first while Hydralisks are still walking. The single biggest improvement to make attacks feel dangerous.

#### Changes (in execution order)

**Step 1: Add staging state variables**
- File: `src/systems/AISystem.ts`
- Change: Add `let isStaging = false; let stagingX = 0; let stagingY = 0; let stagingStartTime = 0;` near AI state. Reset in `initAI()`.

**Step 2: Add staging phase before attack launch**
- File: `src/systems/AISystem.ts`
- Change: In `decideAttack()`, when attack is approved, instead of immediately calling `sendUnitsToAttack()`, first enter staging phase:
  1. Set `isStaging = true`, compute staging point (halfway between AI base and target, or map center)
  2. Send all army units to staging point with `CommandMode.AttackMove`
  3. Set `stagingStartTime = gameTime`

**Step 3: Add staging completion check**
- File: `src/systems/AISystem.ts`
- Change: In the main loop, when `isStaging`:
  1. Count how many army units are within 6 tiles of staging point
  2. If >= 70% of army is staged OR 10 seconds have elapsed (timeout): launch attack
  3. Launch = call `sendUnitsToAttack()` from staging point to target, set `isStaging = false`
- Pattern: Similar to `checkRegroupComplete()` which checks if 60% of units are near regroup point

**Step 4: Rally newly produced units to staging point**
- File: `src/systems/AISystem.ts`
- Change: In `claimNewUnits()`, if `isStaging`, path new army units to staging point instead of leaving them idle at Hatchery.

#### Edge cases
- Army too small to be worth staging (< 6 units) → skip staging, attack immediately
- Staging point is unwalkable → use `findNearestWalkableTile()` fallback
- Base under attack during staging → cancel staging, handle defense (existing defense logic)
- Timeout prevents infinite staging if pathfinding fails

#### Acceptance criteria
- [ ] Army gathers at staging point before attacking
- [ ] Attack launches when 70% gathered OR 10s timeout
- [ ] Fast and slow units arrive together at enemy base
- [ ] Newly spawned units rally to staging point during staging
- [ ] Small armies (< 6) skip staging for responsiveness
- [ ] Existing tests pass, type-check clean

#### Test plan
- `npm test` + `npx tsc --noEmit`
- Manual: skirmish Normal, observe army groups up before attacking (visible gathering behavior)
- Manual: verify attack isn't delayed more than ~10s

---

## Cross-Cutting Concerns

### New Module State Added
Tasks 1-5 add these variables (all reset in initAI):
- `expansionDefenseEids: Map<number, Set<number>>` (Task 3)
- `isStaging`, `stagingX`, `stagingY`, `stagingStartTime` (Task 5)

### Building Schedule Changes
Task 1 adds 3 entries to `AI_BUILDING_SCHEDULE` (SpineCrawler x2, SporeCrawler x1).

### Files Modified
- `src/systems/AISystem.ts` — all 5 tasks (only file modified)

---

## Architecture Model (snapshot)

### AI Decision Tick Order (Zerg, current)
```
defense → refillAPM → prune → claim → intel → baseDefense → macro →
emergency overlord → buildOrder → spawn → scout → strategy → retreat →
vanguard → harassSquads → decideAttack → harassment → micro → engagement →
combatAwareness → manageQueens → abilities → upgrades
```

After this plan:
```
defense → refillAPM → prune → claim → intel → baseDefense → macro →
checkCriticalBuildings [T2] → emergency overlord → buildOrder → spawn →
scout → strategy → retreat → vanguard → harassSquads [T4: dynamic] →
staging check [T5] → decideAttack [T5: staging phase] → harassment →
micro → engagement → combatAwareness → manageQueens →
defendExpansions [T3] → abilities → upgrades
```
