---
subsystem: Unit Commanding — Movement, Auto-Attack, Pathfinding
last_verified: 2026-04-05
created_for: Unit commanding sophistication — group movement, auto-attack, individual pathfinding
files_in_scope: src/systems/MovementSystem.ts, src/systems/CommandSystem.ts, src/systems/CombatSystem.ts, src/ecs/components.ts, src/input/InputProcessor.ts
---

## Recon: Unit Commanding

**Codebase patterns:** ECS with SoA TypedArrays (components.ts), fixed-timestep game loop at 60Hz. Systems communicate via shared component state — no events. Commands flow: InputProcessor → CommandQueue → CommandSystem → sets paths/commandMode → MovementSystem follows paths → CombatSystem reads commandMode for auto-attack eligibility.

### Files in scope
| File | Purpose | Key patterns |
|------|---------|-------------|
| MovementSystem.ts (308 lines) | Path following, separation steering, patrol/attack-move resumption | Iterates POSITION\|MOVEMENT entities, 8px arrival threshold, 1.5s stuck detection, separationPass() |
| CommandSystem.ts (1393 lines) | Command dispatch, smart right-click reclassification, issuePathCommand() | Switch on CommandType, issuePathCommand() at line 1245 handles all group movement |
| CombatSystem.ts (617 lines) | Target acquisition, attack execution, chase, retaliation | Auto-acquire at line 198-232 checks commandMode; Move/Gather/Build skip; aggro = range + 2 tiles |
| components.ts (411 lines) | All SoA TypedArrays for ECS state | commandMode (Uint8Array), paths[] (Float32Array[]), movePathIndex (Int16Array), targetEntity (Int16Array) |
| InputProcessor.ts (528 lines) | Mouse/keyboard → GameCommand with unit snapshots | Right-click → CommandType.Move with units array |

### Architecture context
- **System order**: spatialHash → commandSystem → buildSystem → productionSystem → upgradeSystem → **movementSystem** → fogSystem → **combatSystem** → abilitySystem → gatherSystem → deathSystem → aiSystem
- **issuePathCommand()** (CommandSystem.ts:1245-1393): Computes lead path, calculates formation offsets, assigns per-unit paths. Two branches: ≤24 units get individual A*, >24 share lead's path with offset interpolation.
- **Auto-acquire gate** (CombatSystem.ts:201): `if (commandMode === Move || Gather || Build) continue;` — skips targeting entirely.
- **Path completion** (MovementSystem.ts:169-174): Sets movePathIndex=-1, zeros velocity, but does NOT reset commandMode.
- **Retaliation** (CombatSystem.ts:449-454): Also skips Move and Gather modes.
- **nextAutoAcquireTime** (CombatSystem.ts:59): Module-local Float32Array, 0.15s cooldown between auto-acquire scans.

### Adjacent files (DO NOT MODIFY)
- SelectionSystem.ts — handles selection logic
- AISystem.ts — AI decision-making
- GatherSystem.ts — worker mining state machine
- Pathfinder.ts — A* implementation (used, not modified)

### Existing test coverage
- Tests exist for AI production (AISystem.test.ts)
- No direct unit tests for MovementSystem, CommandSystem, or CombatSystem
- Test command: `npm test`
