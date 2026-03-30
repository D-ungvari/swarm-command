# Log: Buildings & production queues
Started: 2026-03-30

## PLAN
### Scope
- 3 Terran buildings: Command Center, Supply Depot, Barracks
- Building placement (B key + number, ghost preview)
- SCV construction (walk to site, progress bar)
- Production queues (single unit per building)
- Supply system (10 start, +8 per depot, 1 per unit)
- Rally points (right-click with building selected)
- Workers return to nearest CC

### Key decisions
- BuildingType enum starts at 20 (CC=20, SupplyDepot=21, Barracks=22)
- BUILDING bit (11) + SUPPLY bit (12) — 2 new component bits
- Supply tracked on PlayerResources (supplyUsed, supplyProvided)
- Buildings are ECS entities with POSITION|HEALTH|SELECTABLE|RENDERABLE|BUILDING|SUPPLY
- Construction: building starts at 10% HP, gains HP as progress increments
- Production: timer counts down, spawns unit at building position when done
- Pathfinder cache invalidated when building placed/destroyed
- Terran only for now (Zerg drone morphing deferred)

## DEV
