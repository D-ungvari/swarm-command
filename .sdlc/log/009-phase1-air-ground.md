# Log: Phase 1 — Air/Ground Targeting
Started: 2026-04-01T00:00:00Z

## PLAN
- New arrays: isAir, canTargetAir, canTargetGround (Uint8Array, no bitmask)
- UnitDef gains 3 required fields; all 13 units populated
- findBestTarget + findClosestEnemy filter by air/ground capability
- findEnemyAt: post-filter at CombatSystem target validation
- Retaliation bypass fix: clear target on validation if type mismatch
- Air units bypass A* in chaseTarget (straight-line instead)
- separationPass: skip cross-layer (air vs ground) separation
- separationPass: air units not gated by walkability
- SpawnOpts gains optional isAirUnit/canTargetAirUnit/canTargetGroundUnit
- HotkeyPanelRenderer updated with current actual bindings

## DEV
