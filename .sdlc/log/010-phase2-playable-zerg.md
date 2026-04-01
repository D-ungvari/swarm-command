# Log: Phase 2 — Playable Zerg Faction
Started: 2026-04-02T00:00:00Z

## PLAN
14-step implementation:
1. Constants: Queen=16, Overlord=17 in UnitType
2. Unit defs: Queen and Overlord stats in units.ts; Hatchery produces Queen+Overlord
3. Faction select UI on start screen + main.ts wiring
4. Game.ts: playerFaction field, resource inversion, base swap
5. InputProcessor: snapshotSelection uses playerFaction
6. SelectionSystem: all faction filters use playerFaction parameter
7. CommandSystem: enemy detection uses playerFaction
8. Larva system: larvaCount/larvaRegenTimer components, ProductionSystem regen
9. Terran AI module in AISystem (most complex)
10. HudRenderer: Zerg-colored resource display
11. Drone morph build placement in Game.ts
12. InfoPanel: Larva count on Hatchery, Queen energy
13. BuildMenuRenderer: Zerg building menu mode
14. AbilitySystem: Queen energy regen + InjectLarva command

## DEV
