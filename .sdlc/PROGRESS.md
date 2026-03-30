# Progress

## Current Phase
DEVELOP — Backlog #3: Economy (minerals, gas, workers, resource HUD)

## Current Work
### Backlog #3: Economy System
**Phase:** Development

#### Implementation Plan
1. [ ] Add economy constants (CommandMode.Gather, ResourceType, WorkerState, balance values)
2. [ ] Add RESOURCE and WORKER component bits + data arrays
3. [ ] Add PlayerResources type and state to Game
4. [ ] Spawn resource nodes (mineral patches as entities)
5. [ ] Add resource entity rendering in UnitRenderer
6. [ ] Add findResourceAt query
7. [ ] Extend CommandSystem for gather command
8. [ ] Implement GatherSystem (worker AI state machine)
9. [ ] Wire GatherSystem into game loop
10. [ ] Update worker spawning for WORKER component
11. [ ] Add resource HUD
12. [ ] Write tests

## What's Next
Backlog #4: Buildings & production queues

## Notes
- Resource nodes use HEALTH component for depletion tracking (DeathSystem removes depleted patches)
- Workers return to fixed "base position" (spawn location) since buildings don't exist yet
- Gas gathering skipped (requires Refinery from Backlog #4)
- Mineral tiles are unwalkable — workers path to adjacent tile and mine within range
