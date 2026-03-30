# Log: Economy — minerals, gas, workers, resource HUD
Started: 2026-03-30

## PLAN
### Scope
- Mineral patches as ECS entities (clickable, depletable)
- Worker gather AI: walk to patch → mine → walk back → deposit → repeat
- Per-player resource tracking (minerals, gas)
- Resource HUD (minerals + gas placeholder)
- Skip gas gathering (needs Refinery from Backlog #4)

### Key decisions
- Resource nodes use HEALTH for depletion (DeathSystem removes empty patches for free)
- RESOURCE bit (bit 9) + WORKER bit (bit 10) — 2 new component bits
- PlayerResources as plain object on Game, not ECS
- Workers return to fixed base position (spawn location) — no buildings yet
- CommandMode.Gather = 4 for gather command
- WorkerState FSM: Idle → MovingToResource → Mining → ReturningToBase → loop
- Mineral tiles unwalkable; workers path to adjacent tile, mine within range
- HUD as HTML overlay div (crisp text, simple)

## DEV
