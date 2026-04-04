---
subsystem: Worker Gathering & Mining
last_verified: 2026-04-05
created_for: Worker mineral spread + stuck prevention
files_in_scope: src/systems/GatherSystem.ts, src/systems/CommandSystem.ts, src/ecs/queries.ts, src/ecs/components.ts
---

## Recon: Worker Gathering

**Codebase patterns:** Worker state machine in GatherSystem (Idle→MovingToResource→Mining→ReturningToBase). Commands flow: InputProcessor→CommandQueue→CommandSystem→sets workerState/workerTargetEid. Queries use spatialHash for spatial lookups. Components are SoA TypedArrays.

### Files in scope
| File | Purpose | Key patterns |
|------|---------|-------------|
| GatherSystem.ts | Worker state machine, mining, return, saturation penalty | tickMovingToResource, tickMining, tickReturningToBase |
| CommandSystem.ts | Right-click mineral → assign workers to gather | Lines 809-835: all workers get same target |
| queries.ts | findResourceAt, findNearestMineral | Distance-only, no saturation awareness |
| components.ts | workerState, workerTargetEid, workerCountOnResource | SoA TypedArrays |

### Architecture context
- Right-click mineral: CommandSystem finds single resource at click, assigns ALL workers to it
- workerCountOnResource tracks saturation per patch (incremented on mine start, decremented on leave)
- Efficiency penalty: >2 workers on patch → carry amount reduced by 2/totalOnPatch
- findNearestMineral: pure distance, ignores saturation
- After deposit: worker returns to SAME patch (patch loyalty)
- Stuck detection: 1.5s threshold in MovementSystem, auto-repaths

### Root cause of reported bugs
1. **No spreading:** CommandSystem assigns all selected workers to the clicked patch entity
2. **No saturation-aware reassignment:** findNearestMineral ignores workerCountOnResource
3. **Stuck in patch:** Mineral tiles are unwalkable; workers path to nearest walkable tile but can block each other in tight spaces around patches
