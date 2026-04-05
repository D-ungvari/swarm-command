---
scope: Enemy AI Overhaul — Sophisticated Zerg AI with Real Build Orders
created: 2026-04-05
backlog_items: 94
task_count: 7
status: READY
---

# Ultraplan: Enemy AI Overhaul

## Vision Alignment

The Zerg AI is the primary opponent in skirmish mode — a bad AI experience kills replayability. Right now the AI dribbles zerglings one-by-one because of a perfect storm of production, building, and wave-sizing bottlenecks. This overhaul transforms it into a fun, challenging opponent that executes real SC2 build orders, masses proper army compositions, and attacks with purpose.

## Root Cause Analysis

**Why the AI only sends zerglings 1-by-1:**

1. **Larva starvation (worst bottleneck):** Single Hatchery, 3 larva max, 11s regen = ~0.09 units/sec. Workers and army compete for the same larva pool. Even queuing 3 units, the next can't start until a larva regens.

2. **Building schedule is wave-gated, not time-gated:** Spawning Pool isn't built until wave 3 (!). Roach Warren at wave 1 but needs resources the AI doesn't have yet. No early tech = no unit variety.

3. **Build orders are trivially short (3-4 steps):** `ZERG_12_POOL` just says "queue a Zergling at supply 12, 14, 16, then attack." No worker production, no building construction, no Overlord timing — just single unit spawns at supply thresholds.

4. **Wave threshold too low + random composition:** First wave = 4 units (Normal). Units are chosen by weighted random from a phase pool — no coherent army composition goal. AI may build 1 Zergling, 1 Roach, 1 Hydra, 1 Baneling instead of 4 Roaches.

5. **Queen mismanagement:** Queens get claimed into `armyEids` and sent to attack. They should stay home injecting Hatcheries for bonus larva (+3 every 29s).

6. **Single expansion at wave 5:** Only 1 Hatchery for the first 5+ minutes. In SC2, Zerg typically has 2 Hatcheries by 1:30 and 3 by 4:00.

7. **APM budget caps at maxApm/4:** Normal's 80 APM caps at 20 accumulated points. With spawn cost 2, that's only 10 spawn attempts even if everything else is free.

8. **Phase system tied to waves, not game time:** Stuck in "EarlyGame" (waves 0-1) for minutes because waves happen slowly. No natural game time progression.

## Scope Summary

- **Items planned:** 1 (Backlog #94 — Advanced AI Commander)
- **Tasks generated:** 7
- **Estimated total size:** 1 XL feature decomposed into 4M + 3S tasks
- **Critical path:** Task 1 → Task 2 → Task 3 → Task 4 (build orders → production fix → army management → attack intelligence)
- **New patterns needed:** Build order state machine (replaces current 3-step system), composition target system (replaces weighted random)

## Dependency Graph

```
Task 1: Build Order Engine + 5 Zerg Profiles
  │
  ├──→ Task 2: Production & Economy Fix
  │      │
  │      ├──→ Task 3: Army Composition Targeting
  │      │      │
  │      │      └──→ Task 4: Attack Intelligence & Wave System
  │      │             │
  │      │             └──→ Task 7: Difficulty Scaling Pass
  │      │
  │      └──→ Task 5: Queen & Inject Management
  │
  └──→ Task 6: Building Schedule Overhaul (time-gated)
```

## Execution Order

| # | Task | Size | Depends on | Summary |
|---|------|------|-----------|---------|
| 1 | Build Order Engine + 5 Zerg Profiles | M | — | Replace 3-step build orders with full SC2-style sequences |
| 2 | Production & Economy Fix | M | 1 | Fix larva spending, supply management, worker/army priority |
| 3 | Army Composition Targeting | M | 2 | Replace weighted random with target compositions per build order |
| 4 | Attack Intelligence & Wave System | M | 3 | Time-based attacks, composition readiness, proper wave sizing |
| 5 | Queen & Inject Management | S | 2 | Keep Queens home, auto-inject, don't send to army |
| 6 | Building Schedule Overhaul | S | 1 | Time-gated building construction matching build orders |
| 7 | Difficulty Scaling Pass | S | 4 | Tune APM, timing, and production rates per difficulty |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Build orders are too rigid — AI gets stuck if a step fails | HIGH | Each step has a timeout fallback; skip stuck steps after N seconds |
| Over-producing workers starves army | MED | Build orders specify exact worker count targets per phase |
| Queens in army set breaks inject cycle | MED | Task 5 creates dedicated queen management outside army roster |
| APM budget too restrictive for complex macro | MED | Task 7 adjusts APM costs for macro vs micro actions |
| Zerglings don't attack Terran structures (player as Zerg) | HIGH | Likely a CombatSystem targeting filter excluding buildings for melee units — investigate in gameplay-loop BF8 |
| Tech buildings not ready for build order units | HIGH | Task 6 ensures buildings are time-gated to precede unit production |

---

## Task Specs

---

### Task 1: Build Order Engine + 5 Zerg Strategy Profiles
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** M
**Depends on:** none
**Unblocks:** Tasks 2, 5, 6

#### Goal
Replace the simplistic 3-4 step `BuildOrderStep[]` with a full build order engine that can execute real SC2-style build orders. Define 5 distinct Zerg strategy profiles based on actual SC2 ZvT build orders.

#### Prerequisites
- Current build order types at `AISystem.ts:36-47` (BuildOrderAction, BuildOrderStep)
- Current build orders at `AISystem.ts:52-71` (ZERG_12_POOL, ZERG_ROACH_PUSH, ZERG_LAIR_MACRO)
- Build order selection at `AISystem.ts:700-720` (initAI)
- Build order execution at `AISystem.ts:739-803` (executeBuildOrder)

#### Changes (in execution order)

**Step 1: Define new BuildOrderStep type**
- File: `src/systems/AISystem.ts`
- Change: Replace `BuildOrderAction` and `BuildOrderStep` (lines 36-47) with an expanded type that supports all SC2 build order actions:
```typescript
type BOAction =
  | { kind: 'worker' }                              // Build a Drone
  | { kind: 'overlord' }                             // Build an Overlord
  | { kind: 'unit'; type: number; count?: number }   // Build N units (default 1)
  | { kind: 'building'; type: number }               // Build a specific building
  | { kind: 'queen' }                                // Build a Queen
  | { kind: 'attack' }                               // Launch attack with current army
  | { kind: 'expand' }                               // Build expansion Hatchery
  | { kind: 'upgrade'; upgradeType: number }          // Research an upgrade
  | { kind: 'transition'; nextProfile: string }       // Switch to a different profile's mid/late game
  | { kind: 'set_worker_cap'; count: number }         // Stop making workers above this count
  | { kind: 'set_army_target'; comp: CompositionTarget } // Set target army composition

interface BuildOrderStep {
  trigger: 'supply' | 'time' | 'unit_count' | 'worker_count' | 'building_done' | 'minerals_above' | 'always';
  triggerValue: number;
  triggerBuildingType?: number;   // for 'building_done' trigger
  action: BOAction;
  done: boolean;
  timeout?: number;              // seconds — skip this step if stuck longer than this
  startedAt?: number;            // gameTime when step was first attempted
}
```
- Pattern: Follows existing type at `AISystem.ts:42-47`, just expanded
- Why: The current 4-action type can't express "build a building", "stop workers at 16", or "switch compositions"

**Step 2: Define 5 Zerg strategy profiles**
- File: `src/systems/AISystem.ts`
- Change: Replace `ZERG_12_POOL`, `ZERG_ROACH_PUSH`, `ZERG_LAIR_MACRO` (lines 52-71) with 5 complete build orders. Each profile is a named constant with 15-25 steps covering the opening through first attack timing:

**Profile 1: ZERG_12_POOL_RUSH** (Early aggression, ~2:00-2:30 attack)
```
supply 12 → Spawning Pool
supply 13 → Overlord
supply 13 → 6x Zerglings (when pool finishes)
supply 16 → Queen
supply 18 → set_worker_cap 14
supply 18 → attack (all-in with lings)
```
Strategic purpose: Punish greedy openings. Mass cheap lings, attack before opponent has defenses.

**Profile 2: ZERG_LING_BANE_BUST** (Aggressive timing, ~4:00-4:30 attack)
```
supply 13 → Overlord
supply 16 → Hatchery (expand)
supply 17 → Spawning Pool
supply 18 → Extractor
supply 19 → Overlord
supply 20 → 2x Queens
supply 24 → set_worker_cap 24
supply 24 → Baneling Nest (needs: add to building defs if missing, or use existing Spawning Pool)
supply 28 → Overlord
supply 28-36 → mass Zerglings
supply 36 → morph 6 Banelings (unit kind with Baneling type)
supply 40 → attack
```
Strategic purpose: Break Terran wall-offs. Banelings splash clustered Marines.

**Profile 3: ZERG_ROACH_RAVAGER_TIMING** (Mid-game timing, ~5:00-5:30 attack)
```
supply 13 → Overlord
supply 16 → Hatchery (expand)
supply 17 → Spawning Pool
supply 18 → Extractor
supply 19 → Overlord
supply 20 → 2x Queens
supply 24 → Roach Warren
supply 26 → 2nd Extractor
supply 28 → Overlord
supply 30 → set_worker_cap 22
supply 30 → continuous Roach production
supply 44 → morph 3-4 Ravagers
supply 52 → attack
```
Strategic purpose: Ravager bile breaks siege positions and walls.

**Profile 4: ZERG_ROACH_HYDRA_PUSH** (Standard mid-game, ~6:30-7:00 attack)
```
supply 13 → Overlord
supply 16 → Hatchery (expand)
supply 17 → Spawning Pool
supply 18 → Extractor
supply 19 → Overlord
supply 20 → 2x Queens
supply 24 → 2x Zerglings (safety)
supply 28 → Roach Warren
supply 30 → 2nd Extractor
supply 36 → Overlord
time 180 → Hydralisk Den
supply 40 → 3rd + 4th Extractors
supply 44 → continuous Roach production
supply 50 → Evolution Chamber + start +1 Ranged
supply 58 → mix Hydras into production
supply 80 → attack (12 Roach + 8 Hydra target)
```
Strategic purpose: Balanced ranged army. Roaches tank, Hydras DPS. Anti-air capable.

**Profile 5: ZERG_MACRO_HATCH_FIRST** (Greedy economy, ~8:00+ reactive attack)
```
supply 13 → Overlord
supply 16 → Hatchery (expand)
supply 18 → Extractor
supply 17 → Spawning Pool
supply 19 → Overlord
supply 20 → 2x Queens
supply 24 → 2x Zerglings
supply 28 → Overlord
supply 30 → 3rd Hatchery (expand)
time 210 → Lair (Evolution Chamber)
supply 44 → Evolution Chamber(s)
supply 50 → choose tech path based on intel
supply 60 → set_worker_cap 50
time 480 → attack (when 3-base economy kicks in, large army)
```
Strategic purpose: Economy-focused. Takes 3 bases early, builds massive army late.

- Pattern: Follows existing `BuildOrderStep[]` pattern, just longer
- Why: Real SC2 build orders interleave workers, buildings, supply, and army. The current 3-step versions skip everything except unit production.

**Step 3: Update build order selection logic**
- File: `src/systems/AISystem.ts`
- Change: Update `initAI()` (lines 700-720) to select from 5 profiles. Distribution:
  - Easy: 60% Macro, 20% Roach-Hydra, 20% Roach-Ravager (slower, gives player time)
  - Normal: 20% each profile (diverse experience)
  - Hard: 30% Ling-Bane, 30% Roach-Ravager, 20% Roach-Hydra, 10% Rush, 10% Macro
  - Brutal: 30% Rush, 30% Ling-Bane, 20% Roach-Ravager, 20% Roach-Hydra (aggressive)
- Why: Difficulty affects which strategies the AI uses, making harder difficulties more aggressive

**Step 4: Update executeBuildOrder() for new action kinds**
- File: `src/systems/AISystem.ts`
- Change: Expand the `switch (step.action.kind)` in `executeBuildOrder()` (lines 773-802) to handle all new BOAction kinds: 'worker', 'overlord', 'queen', 'building', 'set_worker_cap', 'set_army_target', 'transition'. Add timeout logic: if `step.startedAt` is set and `gameTime - step.startedAt > step.timeout`, mark step done and advance.
- Pattern: Follows existing switch cases at line 773
- Why: The build order engine needs to execute all action types, not just 'unit' and 'attack'

**Step 5: Add a module-level workerCap variable**
- File: `src/systems/AISystem.ts`
- Change: Add `let workerCap = 16;` near the AI state variables (line 591). The 'set_worker_cap' action updates this. `runMacroManagement()` (line 383) uses `workerCap` instead of hardcoded `baseCount * 16`. Reset in `initAI()`.
- Why: Build orders control worker count — rushes want 14 workers, macro wants 50.

#### Edge cases
- Build order step that requires resources the AI doesn't have yet → existing behavior: `aiQueueUnit` returns false, step retries next decision tick. Add timeout (30s default) to prevent infinite stall.
- Build order step that requires a building not yet constructed → 'building_done' trigger waits naturally. Timeout skips if building was destroyed.
- Overlord production competes with army for larva → Overlords are supply-critical; build order steps produce them explicitly at the right supply counts.

#### NOT in scope
- Terran AI build orders — separate task, Terran AI uses a different code path (`runTerranAI`)
- AI scouting and reactive transitions mid-game — existing `updateStrategy()` handles this, refined in Task 3
- Multi-prong attack routing — already implemented, refined in Task 4

#### Acceptance criteria
- [ ] 5 distinct Zerg build order profiles defined with 15-25 steps each
- [ ] Build orders include workers, overlords, buildings, queens, and army units in proper sequence
- [ ] `executeBuildOrder()` handles all new BOAction kinds
- [ ] Steps timeout after configurable seconds to prevent infinite stalls
- [ ] `initAI()` selects from 5 profiles based on difficulty
- [ ] `workerCap` module variable controls worker production limit
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test` — existing AISystem tests must pass
- Manual: start skirmish on Normal, observe AI builds Spawning Pool early, produces workers and overlords in sequence
- Manual: restart several times, verify different build orders are selected (observe different opening timings)

#### Risk notes
- The build orders reference buildings that must exist in `BUILDING_DEFS`. Verify Baneling Nest equivalent exists (may need to use SpawningPool as proxy since game doesn't have a separate Baneling Nest building).
- `aiQueueUnit` doesn't check tech requirements — it only checks `bDef.produces.includes(uType)`. Since Hatchery produces all Zerg units, the AI can technically queue any unit. Tech buildings are "honor system" in the current code. Build orders enforce tech timing by ordering buildings before the units that need them.

---

### Task 2: Production & Economy Fix
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** M
**Depends on:** Task 1
**Unblocks:** Tasks 3, 5

#### Goal
Fix the production bottleneck: larva spending priority, supply management timing, and worker/army balance so the AI can actually mass units instead of trickling them.

#### Prerequisites
- Task 1 complete (build order engine with workerCap)
- `aiQueueUnit()` at `AISystem.ts:96-160`
- `runMacroManagement()` at `AISystem.ts:351-397`
- `trySpawnUnit()` at `AISystem.ts:1855-1884`
- Spawn loop at `AISystem.ts:1301-1306`
- `refillAPM()` at `AISystem.ts:436-441`
- ProductionSystem at `src/systems/ProductionSystem.ts`

#### Changes (in execution order)

**Step 1: Fix supply management — build Overlords BEFORE getting blocked**
- File: `src/systems/AISystem.ts`
- Change: In `runMacroManagement()` (line 365), change supply check from `res.supplyProvided - res.supplyUsed < 4` to `res.supplyProvided - res.supplyUsed < 6`. Also, if supply gap is < 2, queue TWO overlords (emergency). This prevents supply blocks that stall all production.
- Why: Current threshold of 4 is too late — by the time the Overlord finishes, the AI is supply-blocked for 20+ seconds

**Step 2: Implement larva spending priority system**
- File: `src/systems/AISystem.ts`
- Change: Create a new function `spendLarvaByPriority()` that replaces the scattered calls to `aiQueueUnit` in the main loop. Priority order:
  1. **Overlord** — if within 2 supply of cap (absolute highest priority, can't build anything if supply-blocked)
  2. **Workers** — if below `workerCap` and not in attack mode (economy sustains everything)
  3. **Army units** — from build order or composition targets
  
  Call this once per decision tick instead of the current scattered approach where `runMacroManagement` queues workers, `executeBuildOrder` queues units, AND `trySpawnUnit` queues more units — all competing for the same larva.
- Pattern: Replaces current lines 1301-1306 (spawn loop) + lines 383-388 (worker production in macro management)
- Why: Workers and army fighting over 3 larva is the #1 production bottleneck

**Step 3: Increase MAX_SPAWNS_PER_DECISION and reduce APM cost for macro**
- File: `src/systems/AISystem.ts`
- Change: Increase `MAX_SPAWNS_PER_DECISION` from 3 to 6 (line 462). Reduce `APM_COST_SPAWN` from 2 to 1 for production actions (line 426). Production is "muscle memory" in SC2 — it shouldn't cost as much APM as tactical micro. Add `APM_COST_MACRO = 1` for production actions, keep `APM_COST_MICRO = 3`.
- Why: At Normal difficulty (80 APM), spending 2 APM per spawn means only 0.67 spawns/sec. Reducing to 1 doubles throughput without affecting micro APM budget.

**Step 4: Fix APM budget cap to be more generous**
- File: `src/systems/AISystem.ts`
- Change: In `refillAPM()` (line 440), change cap from `maxApm / 4` to `maxApm / 2`. The current quarter-cap means Normal can only accumulate 20 points, which gets exhausted by 10 spawn attempts. Half-cap (40 points) allows a burst of production after saving up.
- Why: The AI needs to be able to burst-produce when larva is available. Real SC2 players spend accumulated larva in bursts.

**Step 5: Track per-Hatchery larva availability and spread production**
- File: `src/systems/AISystem.ts`
- Change: Modify `aiQueueUnit()` (lines 114-133) to find the Hatchery with the MOST larva (currently picks the first one found). When multiple Hatcheries exist, distribute production across them.
```typescript
// Replace: prodBuilding = eid; break;
// With: track best building by larva count, pick highest
if (larvaCount[eid] > bestLarva) {
  bestLarva = larvaCount[eid];
  prodBuilding = eid;
}
```
- Why: After expansion, the AI has 2+ Hatcheries but always queues in the first one found, leaving the expansion idle.

**Step 6: Add Overlord auto-production outside build order**
- File: `src/systems/AISystem.ts`
- Change: At the START of the decision tick (before build order execution), add a supply check: if `supplyProvided - supplyUsed <= 2`, immediately queue an Overlord bypassing the build order. This is an emergency safety net on top of the build order's planned Overlords.
- Why: If the build order's Overlord step was already consumed but the AI is still growing, it needs a fallback to prevent supply lock.

#### Edge cases
- Two Hatcheries both at 0 larva → production stalls naturally, AI waits. This is correct — can't conjure larva.
- Overlord queued but no larva available → `aiQueueUnit` returns false, retry next tick. With higher MAX_SPAWNS_PER_DECISION it'll retry quickly.
- Worker cap reached but build order says 'worker' → step completes (skip), advances to next step.

#### NOT in scope
- Queen inject management (Task 5)
- Multiple expansion timing (Task 6)
- Changing ProductionSystem.ts itself — production mechanics are correct, just need better input

#### Acceptance criteria
- [ ] Supply management triggers at 6-supply gap instead of 4, emergency double-Overlord at 2
- [ ] Larva spending follows priority: Overlord > Worker (if below cap) > Army
- [ ] `MAX_SPAWNS_PER_DECISION` = 6, `APM_COST_MACRO` = 1
- [ ] APM budget cap raised to maxApm/2
- [ ] `aiQueueUnit` distributes across Hatcheries by larva count
- [ ] Emergency Overlord auto-production outside build order
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test`
- Manual: skirmish Normal, observe AI doesn't get supply-blocked (watch AI state overlay)
- Manual: observe AI produces units in batches of 3-6 instead of singles
- Manual: after AI expands, observe both Hatcheries producing

#### Risk notes
- Reducing APM costs makes all difficulties easier to macro with. Task 7 rebalances difficulty scaling after all production changes are in.

---

### Task 3: Army Composition Targeting
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** M
**Depends on:** Task 2
**Unblocks:** Task 4

#### Goal
Replace weighted random unit selection with a target composition system. Each build order defines what army it's building toward, and the AI produces units to fill gaps in the target.

#### Prerequisites
- Task 1 complete (build orders with `set_army_target` action)
- Task 2 complete (production fixes)
- `trySpawnUnit()` at `AISystem.ts:1855-1884`
- Unit weight pools at `AISystem.ts:1817-1840` (EARLY/MID/LATE_GAME_UNITS)
- Strategy weights at `AISystem.ts:2479-2521` (getStrategyWeights)
- Reactive weights at `AISystem.ts:1439-1472` (getReactiveWeights)

#### Changes (in execution order)

**Step 1: Define CompositionTarget type**
- File: `src/systems/AISystem.ts`
- Change: Add near the build order types (after line 47):
```typescript
interface CompositionTarget {
  units: Array<{ type: UnitType; ratio: number; minCount?: number }>;
  targetArmySize: number;   // total supply worth of army to aim for
}
```
Each build order profile includes a composition target. Examples:
- Ling Rush: `[{Zergling, ratio: 1.0}], targetArmySize: 12`
- Ling-Bane: `[{Zergling, ratio: 0.6}, {Baneling, ratio: 0.4}], targetArmySize: 20`
- Roach-Ravager: `[{Roach, ratio: 0.7}, {Ravager, ratio: 0.3}], targetArmySize: 26`
- Roach-Hydra: `[{Roach, ratio: 0.5}, {Hydralisk, ratio: 0.4}, {Zergling, ratio: 0.1}], targetArmySize: 40`
- Macro: `[{Roach, ratio: 0.3}, {Hydralisk, ratio: 0.3}, {Mutalisk, ratio: 0.2}, {Zergling, ratio: 0.2}], targetArmySize: 60`
- Why: Gives the AI a coherent army goal instead of random unit soup

**Step 2: Add module-level composition target state**
- File: `src/systems/AISystem.ts`
- Change: Add `let activeComposition: CompositionTarget | null = null;` near AI state (line 591). Reset in `initAI()`. Updated by `set_army_target` build order action.
- Why: The composition target changes as the build order progresses

**Step 3: Rewrite trySpawnUnit() to fill composition gaps**
- File: `src/systems/AISystem.ts`
- Change: Replace `trySpawnUnit()` (lines 1855-1884). New logic:
```typescript
function trySpawnUnit(world: World, resources: Record<number, PlayerResources>): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  // If we have a composition target, build toward it
  if (activeComposition) {
    const current = countArmyComposition(world);
    const needed = findMostNeededUnit(activeComposition, current, resources);
    if (needed) {
      aiQueueUnit(world, needed, resources);
      return;
    }
  }

  // Fallback: strategy weights → reactive weights → phase weights (existing behavior)
  const stratWeights = getStrategyWeights();
  const options = stratWeights ?? getReactiveWeights();
  // ... existing weighted random logic
}
```
- Pattern: Existing trySpawnUnit at line 1855
- Why: Composition targeting produces coherent armies; weighted random is the fallback for mid-game adaptation

**Step 4: Implement countArmyComposition() helper**
- File: `src/systems/AISystem.ts`
- Change: Add function that counts current army by unit type:
```typescript
function countArmyComposition(world: World): Map<UnitType, number> {
  const counts = new Map<UnitType, number>();
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    const ut = unitType[eid] as UnitType;
    counts.set(ut, (counts.get(ut) || 0) + 1);
  }
  return counts;
}
```
- Why: Need to compare current army vs target to know what to build

**Step 5: Implement findMostNeededUnit() helper**
- File: `src/systems/AISystem.ts`
- Change: Add function that finds the unit type furthest below its target ratio:
```typescript
function findMostNeededUnit(
  target: CompositionTarget,
  current: Map<UnitType, number>,
  resources: Record<number, PlayerResources>
): UnitType | null {
  let bestType: UnitType | null = null;
  let bestDeficit = -Infinity;
  const totalArmy = Array.from(current.values()).reduce((a, b) => a + b, 0);

  for (const entry of target.units) {
    const have = current.get(entry.type) || 0;
    const want = Math.max(entry.minCount || 0, Math.round(target.targetArmySize * entry.ratio));
    const deficit = want - have;
    if (deficit > bestDeficit) {
      // Check affordability
      const def = UNIT_DEFS[entry.type];
      const res = resources[currentAIFaction];
      if (res && res.minerals >= def.costMinerals && res.gas >= def.costGas) {
        bestDeficit = deficit;
        bestType = entry.type;
      }
    }
  }
  return bestType;
}
```
- Why: Fills the biggest gap in the target composition first

**Step 6: Add composition transitions for mid/late game**
- File: `src/systems/AISystem.ts`
- Change: When `updateStrategy()` detects intel changes (anti-bio, anti-mech), update `activeComposition` to a counter-composition instead of just changing weight tables. Define counter-compositions:
  - Anti-bio: `[{Baneling, 0.4}, {Hydralisk, 0.3}, {Roach, 0.2}, {Zergling, 0.1}]`
  - Anti-mech: `[{Zergling, 0.35}, {Hydralisk, 0.3}, {Ravager, 0.2}, {Roach, 0.15}]`
  - Timing-attack: `[{Zergling, 0.5}, {Roach, 0.3}, {Baneling, 0.2}]`
- Pattern: Follows existing `getStrategyWeights()` pattern at line 2479
- Why: Composition targets produce coherent counter-armies instead of random mixes

#### Edge cases
- Target composition includes units the AI can't afford (no gas buildings) → `findMostNeededUnit` checks affordability, skips to next-most-needed
- All units at target ratio → falls through to weighted random (existing behavior)
- activeComposition is null (before build order sets it) → uses existing weighted random path

#### NOT in scope
- Changing unit stats or costs
- Adding new unit types
- Protoss composition support

#### Acceptance criteria
- [ ] `CompositionTarget` type defined with ratio-based unit targeting
- [ ] Each of the 5 build orders sets a composition target via `set_army_target`
- [ ] `trySpawnUnit()` prioritizes filling composition gaps over random selection
- [ ] `countArmyComposition()` and `findMostNeededUnit()` correctly identify production needs
- [ ] Strategy switches (anti-bio, anti-mech) update composition target
- [ ] Fallback to weighted random when no composition target or all targets met
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test`
- Manual: skirmish Normal with Roach-Hydra profile, verify army is ~50% Roach ~40% Hydra (not random soup)
- Manual: build lots of Marines → verify AI switches to anti-bio composition (more Banelings)

#### Risk notes
- If `findMostNeededUnit` always picks the same unit (e.g., always Roach because it has highest deficit), armies may be lopsided early. The `minCount` field helps — set `minCount: 2` for Zerglings in Roach-Hydra so there's always some melee screen.

---

### Task 4: Attack Intelligence & Wave System
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** M
**Depends on:** Task 3
**Unblocks:** Task 7

#### Goal
Replace threshold-based attack waves with a time-and-composition-based system. The AI attacks when its build order says to and when it has the right army, not when it has N random units.

#### Prerequisites
- Tasks 1-3 complete
- `decideAttack()` at `AISystem.ts:1886-1942`
- Wave constants at `AISystem.ts:464-472` (FIRST_WAVE_SIZES, WAVE_SIZE_GROWTH, etc.)
- `AIPhase` enum at `AISystem.ts:1805-1815`
- `sendUnitsToAttack()` at `AISystem.ts:2020-2083`

#### Changes (in execution order)

**Step 1: Replace wave-based phase system with time-based**
- File: `src/systems/AISystem.ts`
- Change: Replace `getPhase()` (lines 1811-1815). Current: wave-based (0-1 = Early, 2-4 = Mid, 5+ = Late). New: time-based with composition check:
```typescript
function getPhase(gameTime: number): AIPhase {
  if (gameTime < 180) return AIPhase.EarlyGame;      // First 3 minutes
  if (gameTime < 420) return AIPhase.MidGame;          // 3-7 minutes
  return AIPhase.LateGame;                              // 7+ minutes
}
```
- Why: The wave-based system keeps the AI in "EarlyGame" forever because waves happen slowly. Time-based progression matches SC2 game flow.

**Step 2: Add composition readiness check**
- File: `src/systems/AISystem.ts`
- Change: Add function that checks if the army meets a minimum % of the composition target:
```typescript
function isArmyReady(threshold: number = 0.7): boolean {
  if (!activeComposition) return armyEids.size >= 4; // fallback
  const current = countArmyComposition(currentWorld);
  let totalHave = 0, totalWant = 0;
  for (const entry of activeComposition.units) {
    const have = current.get(entry.type) || 0;
    const want = Math.round(activeComposition.targetArmySize * entry.ratio);
    totalHave += Math.min(have, want);
    totalWant += want;
  }
  return totalWant > 0 && (totalHave / totalWant) >= threshold;
}
```
- Why: The AI should attack with 12 Roaches, not with 4 random units

**Step 3: Rewrite decideAttack() for build-order-driven timing**
- File: `src/systems/AISystem.ts`
- Change: The build order's 'attack' action now just sets `shouldAttackWhenReady = true`. `decideAttack()` checks:
  1. If `shouldAttackWhenReady` AND `isArmyReady(0.7)` → launch attack
  2. If NOT from build order: use existing threat-based logic but with composition readiness instead of raw unit count
  3. Keep existing retreat, multi-prong, and focus fire logic
  4. After attacking, increment `waveCount` and set `shouldAttackWhenReady = false`
- Why: Build orders control attack timing; composition readiness prevents attacking with 4 zerglings

**Step 4: Add continuous production after build order completes**
- File: `src/systems/AISystem.ts`
- Change: When `buildOrderIndex >= activeBuildOrder.length` (build order exhausted), the AI should:
  1. Keep producing toward the active composition target
  2. Continue expanding (every 3 minutes after first expansion)
  3. Upgrade automatically (existing logic is fine)
  4. Attack whenever army reaches 70%+ of composition target
- This happens naturally: `trySpawnUnit` already uses composition targets, and `decideAttack` uses `isArmyReady`
- Why: Build orders cover the first 5-8 minutes. After that, the AI needs autonomous behavior.

**Step 5: Scale wave attack strength over time**
- File: `src/systems/AISystem.ts`
- Change: Each successive attack after the build order's first push should target a larger army:
```typescript
// In composition target update after each wave:
if (activeComposition) {
  activeComposition.targetArmySize = Math.min(
    activeComposition.targetArmySize + 8,
    60 // max army size target
  );
}
```
- Why: Late-game attacks should be larger than early game. Growing the target by 8 per wave gives the AI escalating pressure.

**Step 6: Improve attack routing — remove mandatory center waypoint**
- File: `src/systems/AISystem.ts`
- Change: In `sendUnitsToAttack()` (line 2032), remove the mandatory route through map center (64,64). Instead, path directly to the target with the optional angle waypoint. The center routing makes the AI predictable and slow — real SC2 attacks go straight for the enemy base.
- Why: Routing through center wastes 15-20 seconds of walk time and makes every attack come from the same direction

#### Edge cases
- Build order says 'attack' but army is tiny → `isArmyReady` prevents attacking until 70% of target composition reached
- All Hatcheries dead → no production, army size won't grow. Existing behavior: AI attacks with whatever it has.
- Player turtles and never attacks → AI composition target keeps growing, eventually hits with overwhelming force

#### NOT in scope
- Micro behavior improvements (kiting, splitting — already implemented)
- New attack formations
- Multi-base attack coordination

#### Acceptance criteria
- [ ] Phase system uses game time (180/420s thresholds) instead of wave count
- [ ] `isArmyReady()` checks composition target fulfillment
- [ ] AI only attacks when build order triggers AND army is 70%+ ready
- [ ] After build order exhausted, AI continues producing and attacking autonomously
- [ ] Wave attack target grows by +8 per wave (capped at 60)
- [ ] Attack routing goes directly to enemy, not through map center
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test`
- Manual: skirmish Normal, observe AI attacks with a coherent army (10+ units of matching types) instead of 4 random units
- Manual: observe second attack is larger than first
- Manual: verify attacks arrive faster (no center routing)

#### Risk notes
- Removing center routing means attacks arrive faster — player has less time to prepare. This is intentional (more fun/challenging) but needs difficulty tuning in Task 7.

---

### Task 5: Queen & Inject Management
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** S
**Depends on:** Task 2
**Unblocks:** none

#### Goal
Keep Queens at home injecting Hatcheries instead of sending them to attack. Proper inject management nearly doubles larva production (3 base + 3 inject every 29s per Hatch).

#### Prerequisites
- Task 2 complete (production fixes)
- `claimNewUnits()` at `AISystem.ts:165-181`
- `runAIAbilities()` at `AISystem.ts:1112-1136`
- Queen inject constants: `INJECT_LARVA_COST = 25`, `INJECT_LARVA_TIME = 29s`, `INJECT_LARVA_BONUS = 3`

#### Changes (in execution order)

**Step 1: Create dedicated queen management set**
- File: `src/systems/AISystem.ts`
- Change: Add `let queenEids: Set<number> = new Set();` near army state (line 604). Clear in `initAI()`. Prune dead queens in `pruneDeadUnits()`.
- Why: Queens need their own roster separate from army to prevent them being sent to attack

**Step 2: Exclude Queens from army claiming**
- File: `src/systems/AISystem.ts`
- Change: In `claimNewUnits()` (line 172), add Queens to the exclusion: `if (unitType[eid] === UnitType.Overlord || unitType[eid] === UnitType.Queen) continue;`. Instead, claim Queens into `queenEids`.
- Why: Currently Queens go into `armyEids` and get sent to attack waves

**Step 3: Move Queen inject logic to dedicated function**
- File: `src/systems/AISystem.ts`
- Change: Extract Queen inject from `runAIAbilities()` (lines 1118-1134) into `manageQueens()`. New behavior:
  1. For each Queen in `queenEids`, check if any Hatchery within 7 tiles needs inject (`injectTimer <= 0`)
  2. If Queen has energy >= 25 AND a Hatchery needs inject: inject it
  3. If Queen is too far from any Hatchery: path it back home
  4. If no inject needed: Queen idles near Hatchery (don't send it anywhere)
  5. APM-gated at `APM_COST_MACRO` (1 point, not 2)
- Why: Dedicated management keeps Queens home and injecting instead of wandering with the army

**Step 4: Build Queens from build order + auto-produce**
- File: `src/systems/AISystem.ts`
- Change: Build orders already have 'queen' action (Task 1). Additionally, in macro management, auto-produce Queens if: `queenEids.size < baseCount` (one Queen per Hatchery) AND Queen not already in production. Queen production doesn't compete with army larva priority — Queens should be produced from the Hatchery with the most larva.
- Why: SC2 standard is 1 Queen per Hatchery for continuous inject

#### Edge cases
- Queen killed → queenEids prunes it, macro management builds a replacement
- Multiple Hatcheries → each Queen assigned to nearest Hatchery. If 2 Queens and 3 Hatcheries, one Hatch goes un-injected (correct — need to produce more Queens)
- Queen energy below inject cost → Queen idles, energy regens at 0.7875/sec (takes ~32s from 0 to 25)

#### NOT in scope
- Queen Transfuse (healing ability) — existing logic in `runAIAbilities` handles this for army Queens, but home Queens won't have targets to heal. Could add building healing later.
- Creep Tumor spreading — separate backlog item #99

#### Acceptance criteria
- [ ] `queenEids` set created and managed separately from `armyEids`
- [ ] Queens NOT claimed into army; NOT sent to attack waves
- [ ] Queens auto-inject nearest Hatchery when energy >= 25 and no active inject
- [ ] Queens path home if too far from any Hatchery
- [ ] Macro management auto-produces Queens (1 per base)
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test`
- Manual: skirmish Normal, observe Queens stay near Hatcheries
- Manual: observe inject cycle happening (Hatchery produces bonus larva batches)
- Manual: verify army attacks WITHOUT Queens

#### Risk notes
- Removing Queens from the army reduces army size. This is correct — Queens are terrible fighters (slow, melee range effectively). The extra larva from injects more than compensates.

---

### Task 6: Building Schedule Overhaul
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** S
**Depends on:** Task 1
**Unblocks:** none

#### Goal
Replace wave-gated building schedule with time-gated schedule that aligns with build order needs. Buildings must exist before the build order tries to produce units that depend on them.

#### Prerequisites
- Task 1 complete (build orders reference buildings)
- `AI_BUILDING_SCHEDULE` at `AISystem.ts:614-621`
- `checkAIBuildingSchedule()` at `AISystem.ts:927-953`

#### Changes (in execution order)

**Step 1: Replace wave-gated schedule with time-gated**
- File: `src/systems/AISystem.ts`
- Change: Replace `AI_BUILDING_SCHEDULE` (lines 614-621) with:
```typescript
const AI_BUILDING_SCHEDULE: Array<{
  minTime: number;        // seconds
  type: number;
  colOffset: number;
  rowOffset: number;
  requiredProfile?: string[]; // only build if current profile matches
}> = [
  { minTime: 0,   type: BuildingType.SpawningPool,     colOffset: -4, rowOffset: 0 },
  { minTime: 30,  type: BuildingType.Refinery,          colOffset: 4,  rowOffset: -3 },
  { minTime: 90,  type: BuildingType.RoachWarren,       colOffset: 5,  rowOffset: 0 },
  { minTime: 120, type: BuildingType.EvolutionChamber,  colOffset: 0,  rowOffset: 5 },
  { minTime: 180, type: BuildingType.HydraliskDen,      colOffset: 5,  rowOffset: 5 },
  { minTime: 240, type: BuildingType.Refinery,          colOffset: 7,  rowOffset: -3 }, // 2nd gas
  { minTime: 300, type: BuildingType.Spire,             colOffset: -5, rowOffset: 5 },
  { minTime: 360, type: BuildingType.InfestationPit,    colOffset: -5, rowOffset: -3 },
];
```
- Why: Spawning Pool must come FIRST (currently at wave 3!). Time-gating ensures tech buildings exist before units need them.

**Step 2: Update checkAIBuildingSchedule to use game time**
- File: `src/systems/AISystem.ts`
- Change: Replace `checkAIBuildingSchedule()` (lines 927-953). Instead of checking `waveCount >= entry.minWave`, check `gameTime >= entry.minTime`. Remove `lastBuildingWaveCheck` guard — check every decision tick since time progresses continuously.
- Why: Wave-gating created chicken-and-egg: need units for waves, need buildings for units, need waves for buildings

**Step 3: Allow build orders to override building timing**
- File: `src/systems/AISystem.ts`
- Change: The 'building' action in `executeBuildOrder()` (from Task 1) can build specific buildings ahead of the schedule. When a build order builds a building, mark it in `aiBuildingsPlaced` so the schedule doesn't double-build it.
- Why: Rush profiles want Pool at time 0; macro profiles want Hatch at supply 16. Both override the default schedule.

**Step 4: Add expansion auto-timing**
- File: `src/systems/AISystem.ts`
- Change: Replace `attemptExpansion()` (lines 1760-1777) and the `waveCount >= 5` gate (line 1294). New logic: track `expansionCount` and `lastExpansionTime`. Attempt expansion every 3 minutes after the first expansion (which comes from build order or after 4 minutes auto). Use predefined expansion locations (not just one).
```typescript
const EXPANSION_LOCATIONS = [
  { col: 100, row: 110 },  // natural
  { col: 15, row: 100 },   // 3rd base
  { col: 80, row: 80 },    // 4th base
];
```
- Why: Single expansion at wave 5 is too late and too few. SC2 Zerg has 3 bases by minute 4.

#### Edge cases
- AI can't afford building at scheduled time → skip, retry next tick (same as current behavior)
- Building schedule builds a Refinery but no gas geyser nearby → existing `aiBuildBuilding` handles gas snapping (lines 325-343)
- Profile requires building not in schedule → build order action handles it directly

#### NOT in scope
- Defensive building placement (Spine/Spore Crawlers — could add later)
- Creep requirement for Zerg buildings (existing system handles this)

#### Acceptance criteria
- [ ] Building schedule is time-gated, not wave-gated
- [ ] Spawning Pool built within first 30 seconds
- [ ] Refinery built at ~30 seconds
- [ ] Tech buildings (Roach Warren, Hydra Den) built at appropriate times
- [ ] Build order can override schedule for early/late buildings
- [ ] Expansion logic supports multiple expansions every 3 minutes
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test`
- Manual: skirmish Normal, observe Spawning Pool built immediately (not at wave 3)
- Manual: observe AI takes natural expansion within first 3 minutes
- Manual: observe AI takes 3rd base by minute 6

#### Risk notes
- Multiple expansions means more Hatcheries, more larva, more production. This cascades with Task 2's production fixes to significantly increase AI output. Intended — but Task 7 needs to tune difficulty scaling accordingly.

---

### Task 7: Difficulty Scaling Pass
**Parent:** Backlog #94 — Advanced AI Commander
**Size:** S
**Depends on:** Task 4
**Unblocks:** none

#### Goal
Rebalance difficulty settings after all AI improvements. The production/economy fixes will make the AI much stronger — need to ensure Easy is still beatable by beginners and Brutal is still challenging for experienced players.

#### Prerequisites
- Tasks 1-6 complete (all AI improvements in place)
- Difficulty configs at `AISystem.ts:418-423` (APM_BUDGETS)
- `DIFFICULTY_CONFIGS` in `constants.ts`
- `INITIAL_DELAYS` at `AISystem.ts:455-460`

#### Changes (in execution order)

**Step 1: Adjust APM budgets for new macro system**
- File: `src/systems/AISystem.ts`
- Change: Retune APM budgets now that macro costs 1 APM instead of 2:
```typescript
const APM_BUDGETS: Record<Difficulty, number> = {
  [Difficulty.Easy]:   20,    // Reduced from 30 — slower macro, minimal micro
  [Difficulty.Normal]: 60,    // Reduced from 80 — decent macro, some micro
  [Difficulty.Hard]:   150,   // Reduced from 180 — good macro + active micro
  [Difficulty.Brutal]: 350,   // Reduced from 400 — full macro + aggressive micro
};
```
- Why: Since macro now costs 1 APM instead of 2, the same budgets would double macro throughput. Reduce budgets to keep similar effective output while redistributing more toward micro at higher difficulties.

**Step 2: Tune initial delays per difficulty**
- File: `src/systems/AISystem.ts`
- Change: With better build orders, the AI gets dangerous faster. Increase Easy delay:
```typescript
const INITIAL_DELAYS: Record<Difficulty, number> = {
  [Difficulty.Easy]: 30,      // Up from 20 — give beginners more time
  [Difficulty.Normal]: 10,    // Unchanged
  [Difficulty.Hard]: 3,       // Down from 5 — faster start
  [Difficulty.Brutal]: 0,     // Unchanged
};
```
- Why: Easy players need more breathing room; Hard AI should feel aggressive

**Step 3: Adjust build order profile selection for difficulty**
- File: `src/systems/AISystem.ts`
- Change: Verify/tune the profile distributions from Task 1 Step 3 after playtesting. Key principle:
  - Easy: NEVER gets rush or ling-bane bust profiles. Always macro or roach-hydra.
  - Normal: Balanced mix. Occasionally gets a rush (keeps it interesting).
  - Hard: Biased toward timings. Often gets aggressive profiles.
  - Brutal: Heavily biased toward rushes and all-ins.
- Why: Difficulty should affect strategy choice, not just speed

**Step 4: Tune composition readiness thresholds by difficulty**
- File: `src/systems/AISystem.ts`
- Change: `isArmyReady()` threshold varies by difficulty:
  - Easy: 0.9 (won't attack until nearly full army — gives player more time)
  - Normal: 0.7 (attacks at 70% — balanced)
  - Hard: 0.5 (attacks at 50% — constant pressure)
  - Brutal: 0.4 (attacks early and often with partial armies)
- Why: Higher difficulty = more aggressive attack timing

**Step 5: Adjust income multiplier for DIFFICULTY_CONFIGS**
- File: `src/constants.ts`
- Change: Review `DIFFICULTY_CONFIGS` income multipliers. With better macro management, the AI mines more efficiently:
  - Easy: reduce from 0.7 to 0.5 (even slower economy)
  - Normal: reduce from 1.33 to 1.0 (fair play — no income bonus)
  - Hard: keep 1.68 (slight advantage)
  - Brutal: keep 2.34 (clear economy advantage)
- Why: With proper worker management and multiple bases, the AI doesn't need as much income bonus to have a functioning economy

**Step 6: Add difficulty-specific micro limits**
- File: `src/systems/AISystem.ts`
- Change: Easy AI should not use tactical micro at all (already gated at line 2090). Verify Normal only gets basic kiting, Hard gets full micro, Brutal gets everything + faster decision intervals. Consider reducing `DECISION_INTERVAL` for Brutal:
  - Normal: 15 ticks (unchanged)
  - Hard: 10 ticks
  - Brutal: 6 ticks
- Why: Faster decisions = more responsive AI = harder opponent

#### Edge cases
- Player selects Easy but AI still feels too hard → income multiplier 0.5 + macro delay 30s should provide enough buffer. Can further reduce APM if needed.
- Brutal feels too easy after tuning → APM budget of 350 + fast decisions + aggressive profiles should be challenging. Can increase income multiplier if needed.

#### NOT in scope
- Adding new difficulty levels
- Per-map difficulty adjustments
- Dynamic difficulty adjustment (rubber banding)

#### Acceptance criteria
- [ ] APM budgets retuned for new macro costs
- [ ] Easy AI is clearly beatable by beginners (30s delay, slow macro, macro profiles only)
- [ ] Normal AI is a fair challenge (balanced profiles, decent macro)
- [ ] Hard AI is aggressive and technically skilled (timings, fast decisions, full micro)
- [ ] Brutal AI is overwhelming (rushes, economy advantage, fastest decisions)
- [ ] All 4 difficulties feel distinct and progressively harder
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Run `npm test`
- Manual: play 1 game on each difficulty, verify progression feels correct
- Manual: Easy — player should reach mid-game comfortably
- Manual: Brutal — player should feel pressure from minute 1

#### Risk notes
- This task is the final tuning pass. Numbers here will need iteration after the first round of playtesting. Get them approximately right, then adjust based on feel.

---

## Cross-Cutting Concerns

### New Pattern: Build Order State Machine
The build order engine (Task 1) introduces a multi-step state machine that replaces the current trivial 3-step system. All subsequent tasks assume this engine exists. Key design decisions:
- Steps execute sequentially (no parallel branches)
- Failed steps retry until timeout
- Build order sets module-level state (`workerCap`, `activeComposition`, `shouldAttackWhenReady`)
- After build order exhausts, AI runs autonomously using the last set state

### Module-Level State Variables Added
Tasks 1-5 add several module-level variables that must all be reset in `initAI()`:
- `workerCap` (Task 1) — controls worker production limit
- `activeComposition` (Task 3) — current army composition target
- `shouldAttackWhenReady` (Task 4) — build order triggered attack flag
- `queenEids` (Task 5) — dedicated queen roster
- `expansionCount` / `lastExpansionTime` (Task 6) — expansion tracking

### Constant/Enum Additions
- `APM_COST_MACRO = 1` (Task 2) — new cheaper cost for production actions
- `AI_BUILDING_SCHEDULE` rewritten (Task 6) — time-based instead of wave-based
- `EXPANSION_LOCATIONS` array (Task 6) — predefined expansion positions
- `DECISION_INTERVAL` may become difficulty-dependent (Task 7)

### Files Modified Across Tasks
- `src/systems/AISystem.ts` — all 7 tasks modify this file (the AI brain)
- `src/constants.ts` — Task 7 adjusts `DIFFICULTY_CONFIGS`
- No other files need modification — the AI overhaul is entirely within AISystem + constants

---

## Architecture Model (snapshot)

### System Execution Order (per tick)
1. spatialHash.rebuild()
2. commandSystem() — player input → unit commands
3. buildSystem() — construction progress
4. productionSystem() — unit production timers, larva regen, queue advance
5. upgradeSystem()
6. movementSystem() — path following
7. fogSystem()
8. combatSystem() — target acquisition, attacks, damage
9. abilitySystem()
10. gatherSystem() — worker mining
11. deathSystem()
12. **aiSystem()** — AI decisions ← THIS IS WHAT WE'RE OVERHAULING
13. creepSystem()

### AI Decision Flow (current → after overhaul)

**Current (broken):**
```
Every 15 ticks:
  macro → executeBuildOrder (3 steps) → trySpawnUnit (random) → decideAttack (threshold=4)
Result: 1 zergling at a time, attacks with 4 random units
```

**After overhaul:**
```
Every 15 ticks (6 for Brutal):
  manageQueens → spendLarvaByPriority (Overlord > Worker > Army) →
  executeBuildOrder (25 steps, buildings+units+composition) →
  trySpawnUnit (composition-targeted) → decideAttack (build-order-timed + composition-ready)
Result: Proper economy → massed army of correct composition → attack at planned timing
```

### Key Component Dependencies for AI
- **Reads:** posX/Y, faction, hpCurrent/Max, unitType, buildingType, buildState, commandMode, energy, larvaCount, injectTimer, atkDamage/Range/Cooldown/LastTime, prodUnitType/Progress/Queue, workerState, resourceRemaining, movePathIndex
- **Writes:** commandMode, targetEntity, energy, injectTimer, larvaCount, larvaRegenTimer, prodUnitType/Progress/TimeTotal, prodQueue/QueueLen, workerState/TargetEid/BaseX/BaseY + calls setPath()
- **External calls:** findPath(), findNearestMineral(), worldToTile(), tileToWorld(), findNearestWalkableTile(), rng methods
