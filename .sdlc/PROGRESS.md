# Progress

## Current Phase
IN PROGRESS — Sprint 1: Tech Tree UI (Iteration F, Tier 0)

## Current Work
### Sprint 1: F.1-F.2-F.4-F.5
- [ ] F.1: "Req: Barracks" text on locked build menu slots
- [ ] F.2: Flash + tooltip when pressing digit key for locked building
- [ ] F.4: Add Zerg tech buildings (RoachWarren, HydraliskDen, Spire, InfestationPit) + Zerg build menu
- [ ] F.5: Gate production buttons by tech (Infestor needs InfestationPit, etc.)

## Scope
Tier 0, 1, 2 only (Sprints 1–55). Tier 3/4 out of scope.

## Architecture notes
- `isTechAvailable()` and `hasCompletedBuilding()` are correct and working
- `getTechAvailability()` returns 7 booleans; Zerg branch always returns all-true (needs fixing)
- `BuildMenuRenderer.update()` already styles locked slots grey+red-tint but shows NO text explanation
- Zerg: RoachWarren=34, HydraliskDen=35, Spire=36, InfestationPit=37 need to be defined in buildings.ts
- 197 tests passing
