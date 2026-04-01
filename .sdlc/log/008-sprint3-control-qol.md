# Log: Sprint 3 — Control QoL
Started: 2026-04-01T00:00:00Z

## PLAN

### Steps
1. constants.ts — add CommandMode.HoldPosition=6 and CommandMode.Patrol=7
2. components.ts — add patrolOriginX/Y Float32Arrays + resetComponents
3. InputProcessor.ts — split S/H, add P key patrolPending, leftclick patrol routing
4. CommandSystem.ts — HoldPosition case (stops + sets HoldPosition mode), Patrol case (records origin, issues path)
5. CombatSystem.ts — HoldPosition: drop target on out-of-range (no chase), narrow aggro range
6. MovementSystem.ts — patrol turnaround on path complete, re-path toward origin
7. Game.ts — F2 → selectAllCombatUnits(), F3 → selectAllWorkers()
8. Create WaypointRenderer.ts + wire into Game.ts
9. SelectionSystem.ts — findUnitAt: 12px tolerance, two-pass (units > buildings)
10. queries.ts + CommandSystem.ts — findFriendlyAt, Medivac right-click routing

### Key Design Decisions
- HoldPosition: narrower aggro range (atkRange only, not 6-tile minimum)
- Patrol: origin recorded at command time; turnaround handled in MovementSystem
- Patrol stall after kill: MovementSystem detects commandMode=Patrol + movePathIndex=-1 + no target → re-issues path
- WaypointRenderer: only renders when shiftHeld, world space
- Two-pass findUnitAt: units first, buildings fallback

## DEV
