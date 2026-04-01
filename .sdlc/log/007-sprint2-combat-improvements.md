# Log: Sprint 2 — Core Combat Improvements
Started: 2026-04-01T00:00:00Z

## PLAN

### Goal
Add damage types, armor classes, focus fire fix, target priority, overkill prevention, and kill tracking.

### Steps
1. Add DamageType/ArmorClass const enums to constants.ts
2. Add 5 new TypedArrays to components.ts (atkDamageType, armorClass, baseArmor, pendingDamage, killCount)
3. Add damageType/armorClass fields to UnitDef interface in types.ts
4. Populate damageType/armorClass in all 10 unit definitions in units.ts
5. Create src/combat/damageCalc.ts — getDamageMultiplier(dmgType, armorCls)
6. Set new arrays in Game.ts spawnUnitAt
7. Update tests/helpers.ts — new arrays, SpawnOpts fields, enum mirrors
8. Update CombatSystem.ts — direct hit formula, kill tracking, pendingDamage commit
9. Update CombatSystem.ts — splash damage formula
10. Explicit AttackTarget invariant (comment + test guard)
11. Add findBestTarget to queries.ts; replace findClosestEnemy in CombatSystem
12. Overkill prevention in CombatSystem auto-acquire
13. Kill count display in InfoPanelRenderer.ts
14. proactively zero pendingDamage on death in CombatSystem kill path
16. New test file: tests/systems/CombatSystem.damage-types.test.ts

### Key Design Decisions
- Damage formula: max(1, (baseDmg * typeMultiplier) - targetArmor)
- Armored units start with 1 base armor; Light units with 0
- pendingDamage cleared immediately at kill time (not waiting for DeathSystem)
- AttackTarget mode bypasses overkill prevention filter
- findBestTarget priority: retaliation > armed > unarmed > buildings

## DEV
