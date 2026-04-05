---
scope: Unit commanding system sophistication — group movement, auto-attack, individual pathfinding
created: 2026-04-05
backlog_items: new (unit commanding improvements)
task_count: 3
status: READY
---

## Ultraplan: Unit Commanding System Sophistication

### Vision Alignment
These fixes address the core "feel" of the game — responsive unit control is what separates a practice tool from a toy. Group movement, auto-attack, and individual pathfinding are the mechanics SC2 players will notice first.

### Player Feedback Confirmation
Playtesting confirmed these issues:
- **"Sometimes my units stop killing an enemy and then I have to target attack to get rid of them"** → validates Task 1 (commandMode reset) and Task 3 (auto-acquire timing). Units arrive in Move mode and never switch to Idle for auto-attack.
- **"Tanks have a hard time auto acquiring their target"** → may be related to Task 1 (commandMode stays Move), plus siege mode specific issues tracked in sc2-skirmish-audit F2.

### Root Cause Analysis

**Bug 1: "Units group up before moving to new location"**
- `CommandSystem.ts:1340-1357` — Shared-path offset interpolation is inverted: `wp + offset * t` where t=0→1 along path. At path START offset is 0 → all units converge to lead's position. At path END offset is full → units spread. This is backwards.
- Affects groups >24 (always) and ≤24 (when individual pathfinding fails).

**Bug 2: "Inconsistent auto-attack"**
- `MovementSystem.ts:169-174` — When Move path completes, `commandMode` stays `Move` (never resets to `Idle`).
- `CombatSystem.ts:201` — Auto-acquire explicitly skips `Move` mode.
- `CombatSystem.ts:451` — Retaliation also skips `Move` mode.
- Result: arrived units sit idle but never attack. Fresh-spawned Idle units DO attack → inconsistency.

**Bug 3: "Want individual movement"**
- `CommandSystem.ts:1348-1357` — Groups >24 share lead's A* path with blended offsets instead of computing individual paths.

### Execution Order
| # | Task | Size | Depends on | Files |
|---|------|------|-----------|-------|
| 1 | Fix commandMode reset on path completion | S | — | MovementSystem.ts |
| 2 | Individual pathfinding for all group sizes | M | — | CommandSystem.ts |
| 3 | Tune idle auto-attack timing after arrival | S | 1 | CombatSystem.ts |

### Risk Register
| Risk | Impact | Mitigation |
|------|--------|------------|
| Patrol/AttackMove resumption broken by Idle reset | High | Only reset for Move mode, not AttackMove/Patrol |
| Perf regression from per-unit A* on large groups | Med | A* on 128x128 is fast; 48-unit cap with shared fallback |
| Units stacking at destination | Low | Keep formation offset at destination |

---

## Task Specs

### Task 1: Fix commandMode reset on path completion
**Size:** S
**Depends on:** none
**Unblocks:** Task 3

#### Goal
When a unit completes its Move path, reset `commandMode` from `Move` to `Idle` so it enters the auto-attack/retaliation state. This is the root cause of inconsistent auto-attack — arrived units stay in Move mode forever.

#### Prerequisites
None — standalone fix.

#### Changes (in execution order)

**Step 1: Reset commandMode to Idle when Move path completes**
- File: `src/systems/MovementSystem.ts`
- Lines: 169-174 (the `else` branch when path completes for non-Patrol units)
- Change: After `movePathIndex[eid] = -1; velX[eid] = 0; velY[eid] = 0;`, add:
  ```typescript
  // Reset Move to Idle so units auto-attack and retaliate (SC2 behavior)
  if (commandMode[eid] === CommandMode.Move) {
    commandMode[eid] = CommandMode.Idle;
  }
  ```
- Pattern: Similar to Patrol path-complete at line 165 which sets `commandMode[eid] = CommandMode.Idle`
- Why: CombatSystem line 201 skips auto-acquire for Move mode. Units must be Idle to attack.

**Step 2: Also reset when stuck detection clears the path**
- File: `src/systems/MovementSystem.ts`
- Lines: 73-76 (stuck detection when repath fails, clears movePathIndex)
- Change: After `movePathIndex[eid] = -1;`, add same commandMode reset:
  ```typescript
  if (commandMode[eid] === CommandMode.Move) {
    commandMode[eid] = CommandMode.Idle;
  }
  ```
- Why: A stuck unit that can't repath should also become Idle and auto-attack.

#### Edge cases
- AttackMove units that complete path: should stay AttackMove (MovementSystem line 102-118 handles re-pathing). Do NOT reset AttackMove to Idle — the existing logic at lines 102-118 correctly resumes attack-move behavior.
- Patrol units: already have their own path-complete logic (swap endpoints). Not affected.
- Gather/Build workers: use workerState, not commandMode path completion. Not affected.

#### NOT in scope
- Changing auto-attack behavior DURING movement (Move mode correctly ignores enemies while walking — SC2 behavior)
- Changing AttackMove or Patrol completion behavior

#### Acceptance criteria
- [ ] Unit given Move command arrives at destination → commandMode is Idle
- [ ] Idle arrived unit auto-attacks enemies within aggro range
- [ ] Idle arrived unit retaliates when attacked
- [ ] AttackMove units still resume path after killing target
- [ ] Patrol units still swap endpoints correctly
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Manual: select 10 Marines, right-click to move near enemy units. After arriving, Marines should auto-engage.
- Manual: Move Marines past an enemy. They should NOT attack during movement. After stopping, they SHOULD attack if enemy is in range.
- Run `npm test` to verify no regressions.

#### Risk notes
- Do NOT reset AttackMove to Idle. The existing MovementSystem logic at lines 102-118 re-issues the path when an AttackMove unit's target dies. Resetting to Idle would break that flow.

---

### Task 2: Individual pathfinding for all group sizes
**Size:** M
**Depends on:** none
**Unblocks:** none

#### Goal
Remove the shared-path-with-interpolation approach for groups >24. Every unit in a group should compute its own A* path from its current position to its individual destination point. This fixes the "units group up before moving" bug and gives each unit independent movement.

#### Prerequisites
None — standalone fix in issuePathCommand().

#### Changes (in execution order)

**Step 1: Remove the large-group shared-path branch and extend individual pathfinding to all units**
- File: `src/systems/CommandSystem.ts`
- Function: `issuePathCommand()` (lines 1245-1393)
- Change: Replace the current dual-branch logic (lines 1315-1357) with a unified approach:

  Current code has:
  - Lines 1318-1347: Small groups (≤24) — individual pathfinding per unit (except lead)
  - Lines 1348-1357: Large groups (>24) — shared lead path with offset interpolation

  Replace with: ALL units (including lead) compute individual paths:
  ```typescript
  let unitPath: Array<[number, number]>;
  const unitStart = worldToTile(posX[eid], posY[eid]);
  const destX = tx + offsetX;
  const destY = ty + offsetY;
  let unitEnd = worldToTile(destX, destY);
  // Ensure destination is walkable
  if (unitEnd.col >= 0 && unitEnd.col < map.cols && unitEnd.row >= 0 && unitEnd.row < map.rows) {
    if (map.walkable[unitEnd.row * map.cols + unitEnd.col] !== 1) {
      const wk = findNearestWalkableTile(map, unitEnd.col, unitEnd.row);
      if (wk) unitEnd = wk;
    }
  }
  const indivPath = (unitStart.col === unitEnd.col && unitStart.row === unitEnd.row)
    ? [[unitEnd.col, unitEnd.row] as [number, number]]
    : findPath(map, unitStart.col, unitStart.row, unitEnd.col, unitEnd.row);
  if (indivPath.length > 0) {
    unitPath = simplifyPath(indivPath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    }));
  } else {
    // Fallback: direct line to destination (no path found)
    unitPath = [[destX, destY] as [number, number]];
  }
  ```
- Why: Eliminates the inverted offset interpolation that causes units to converge to the lead's position at the start of movement.

**Step 2: Remove dead-code lead path computation for the shared-path case**
- File: `src/systems/CommandSystem.ts`
- Lines: 1261-1293 (lead path computation)
- Change: The lead path was needed as a template for shared paths. Keep the lead path computation ONLY as a fallback reference (e.g., if the map is impassable for some units). Actually, the lead path can be removed entirely since each unit now paths individually. However, keep the `mainEndTile` walkability snap (lines 1264-1270) as a shared destination reference.
- Why: Clean up the code path that's no longer needed.

**Step 3: Widen formation offset for comfortable spacing at destination**
- File: `src/systems/CommandSystem.ts`  
- Line: 1308
- Change: Adjust `maxSpread` formula to give more space:
  ```typescript
  // Scale spread: small groups (≤12) get 2 tiles, scaling up to 4 tiles for larger groups
  const maxSpread = Math.min(4, 1.5 + units.length / 15) * TILE_SIZE;
  ```
- Why: With individual pathfinding, units won't stack at destination. Slightly wider spread prevents the tight clustering that made groups feel unresponsive.

#### Edge cases
- Single unit: `units.length === 1`, offset is (0,0), individual path from own position to destination. Works correctly.
- Unit already at destination tile: `unitStart === unitEnd` → single-waypoint path. Fine.
- Unreachable destination: individual pathfinding returns empty → fallback to direct line (unit will get stuck and repath via MovementSystem stuck detection).
- Sieged tanks: already skipped at line 1298-1300. Not affected.
- Shift-queue: appendPath still works per-unit. Not affected.

#### NOT in scope
- Flow field pathfinding (architectural change, not needed for 4096 entities)
- Formation presets (diamond, line, box) — future feature
- Group speed synchronization (each unit already moves at own speed)

#### Acceptance criteria
- [ ] Group of 30+ units given Move command → each unit moves independently from own position
- [ ] No "grouping up" at the start of movement — units head straight to destination area
- [ ] Units arrive in a spread formation around the click point, not stacked
- [ ] Small groups (≤12) still work correctly with tight formation
- [ ] Shift-queue movement works
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Manual: spread 20 Marines across the map. Select all, right-click to a point. Each Marine should head directly there without converging first.
- Manual: group 40 units. Right-click to move. All should move individually, no "gather-then-move" behavior.
- Run `npm test`.

#### Risk notes
- Performance: A* on 128x128 grid for 40 units is ~40 pathfinding calls. Each A* call on a 128x128 grid is <1ms. Total <40ms — fine for a single tick.
- If pathfinding becomes a bottleneck with very large armies (100+), add staggered pathfinding in a future task.

---

### Task 3: Tune idle auto-attack timing after arrival
**Size:** S
**Depends on:** Task 1 (commandMode reset must exist)
**Unblocks:** none

#### Goal
After Task 1 resets commandMode to Idle on arrival, ensure the auto-attack scan fires promptly — not delayed by the 0.15s cooldown that was set during movement. Also ensure the Idle→attack transition is smooth when enemies are already nearby.

#### Prerequisites
Task 1 must be complete (commandMode resets to Idle on path completion).

#### Changes (in execution order)

**Step 1: Reset auto-acquire cooldown on path completion**
- File: `src/systems/MovementSystem.ts`
- Location: Same block as Task 1's commandMode reset (line ~170)
- Change: After resetting `commandMode` to Idle, also reset the auto-acquire timer:
  ```typescript
  if (commandMode[eid] === CommandMode.Move) {
    commandMode[eid] = CommandMode.Idle;
    nextAutoAcquireTime[eid] = 0; // Scan for targets immediately
  }
  ```
- Requires importing `nextAutoAcquireTime` from CombatSystem (or exposing it from components).
- Why: The `nextAutoAcquireTime` cooldown (CombatSystem line 206, 226) could delay the first auto-attack scan by up to 0.15s after arrival. Resetting it ensures instant response.

**Step 2: Expose nextAutoAcquireTime for cross-system access**
- File: `src/systems/CombatSystem.ts`
- Lines: 59-64 (where `nextAutoAcquireTime` is declared as module-local)
- Change: Export `nextAutoAcquireTime` array, or better — move it to `src/ecs/components.ts` alongside other per-entity state.
- Pattern: Same as other per-entity Float32Arrays in components.ts (e.g., `lastMovedTime`, `lastCombatTime`)
- Why: MovementSystem needs to reset this value when a unit arrives. Cross-system state belongs in components.

#### Edge cases
- Units arriving during a fight (enemies already in range): instant auto-acquire fires on the next tick. Perfect.
- Patrol units returning to origin: NOT affected (Patrol has its own path-complete logic, doesn't reset to Idle).
- AttackMove arrival: NOT affected (AttackMove stays in AttackMove mode, has its own resume logic).

#### NOT in scope
- Changing aggro range values
- Adding "stance" system (aggressive/passive/hold position)

#### Acceptance criteria
- [ ] Unit arrives at destination → attacks nearby enemy within 1-2 ticks (not delayed 0.15s)
- [ ] `nextAutoAcquireTime` is accessible from MovementSystem
- [ ] No circular import issues
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Manual: move Marines to stand right next to enemies. Marines should attack within a fraction of a second of stopping.
- Run `npm test`.

---

## Cross-Cutting Concerns

### New component exposure
- `nextAutoAcquireTime` (Float32Array) moves from CombatSystem.ts module scope to components.ts exports. This follows the existing pattern of per-entity state in components.ts (like `lastMovedTime`, `lastCombatTime`).

### Constant changes
- `maxSpread` formula change in Task 2 (1.5+units/15 instead of 1+units/20). Small groups get slightly more spread (2 tiles vs 1.5 tiles).

### No new enums or component bits needed
All changes use existing CommandMode enum values and component arrays.

---

## Architecture Model (snapshot)

### System execution order (relevant)
1. `spatialHash.rebuild()` — spatial index
2. `commandSystem()` — processes Move/AttackMove/Patrol → `issuePathCommand()` sets per-unit paths
3. `movementSystem()` — follows paths, separation steering, path completion
4. `combatSystem()` — auto-acquire based on `commandMode`, chase, attack

### Key data flow
```
InputProcessor → simulationQueue → CommandSystem.issuePathCommand()
  → sets paths[eid], commandMode[eid], moveTargetX/Y[eid]
  → MovementSystem follows paths, resets commandMode on arrival
  → CombatSystem checks commandMode for auto-acquire eligibility
```

### Component registry (relevant)
| Component | Type | Read by | Written by |
|-----------|------|---------|------------|
| commandMode | Uint8Array | CombatSystem, MovementSystem | CommandSystem, MovementSystem, CombatSystem |
| movePathIndex | Int16Array | MovementSystem | CommandSystem (setPath), MovementSystem, CombatSystem |
| targetEntity | Int16Array | CombatSystem, MovementSystem | CommandSystem, CombatSystem |
| paths[] | Float32Array[] | MovementSystem | CommandSystem (setPath/appendPath) |
| nextAutoAcquireTime | Float32Array | CombatSystem | CombatSystem, MovementSystem (after Task 3) |
| moveTargetX/Y | Float32Array | MovementSystem | CommandSystem |

### Extension points
- `issuePathCommand()` in CommandSystem.ts is the single entry point for all group movement
- CombatSystem auto-acquire at lines 198-232 is the single gate for idle targeting
- MovementSystem path completion at lines 141-177 is where arrival behavior is defined
