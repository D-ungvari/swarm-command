---
subsystem: Combat System
last_verified: 2026-04-05
created_for: Task 1 — Stat & Behavior Fixes (sc2-skirmish-audit)
files_in_scope: src/ecs/components.ts, src/systems/CombatSystem.ts, src/systems/AbilitySystem.ts, src/systems/CommandSystem.ts, src/data/units.ts, src/Game.ts, src/constants.ts
---

## Recon: Combat System

**Codebase patterns:** SoA ECS — component data in parallel TypedArrays. Attack stats stored in ms for cooldowns, px for ranges (converted from tile units at spawn via `* TILE_SIZE`). Damage calculated inline in CombatSystem with bonus damage, weapon upgrades, armor, veterancy. Constants for siege/regen in `src/constants.ts`.

### Files in scope
| File | Purpose | Key patterns |
|------|---------|-------------|
| `src/ecs/components.ts:31-36` | Attack component arrays (atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash) | Float32Array, MAX_ENTITIES sized. resetComponents at line 327. |
| `src/systems/CombatSystem.ts:240-515` | Range checks (240), damage calc (302-327), splash (463-515) | Cooldown ms→s conversion at 274. Faction skip in splash at 477. |
| `src/systems/AbilitySystem.ts:122-152` | Siege mode transitions — sets damage/range/splash/bonus but NOT cooldown | SIEGE_* constants from constants.ts |
| `src/systems/AbilitySystem.ts:193-206` | Roach regen — no burrowed check | ROACH_REGEN_IDLE = 7.0 HP/s |
| `src/systems/AbilitySystem.ts:248-340` | Widow Mine sentinel — faction skip at lines 277, 314 | 125 raw damage, 2.0 tile splash |
| `src/systems/AbilitySystem.ts:444-482` | Fungal Growth — slowFactor 0.75, duration 3s | Should be root (1.0) for 2.85s |
| `src/systems/CommandSystem.ts:507-554` | Snipe — mechanical filter at lines 526-528 | Excludes SiegeTank/Hellion/Thor/BC/Viking/WidowMine/Medivac |
| `src/systems/CommandSystem.ts:1057-1090` | Hellion↔Hellbat transform — bonusDmg=11 at line 1073 | Should be 12 |
| `src/data/units.ts:116-126` | Cyclone — bonusDamage: 0 | Should be 12 vs Armored |
| `src/Game.ts:1839-1841` | spawnUnitAt sets atkCooldown from def.attackCooldown (ms) | No atkMinRange/atkHitCount |
| `src/constants.ts:200-205` | SIEGE_* constants — missing SIEGE_COOLDOWN | Need to add 2140ms |

### Architecture context
- `atkCooldown` stored in ms, converted to seconds at CombatSystem:274 (`/ 1000`)
- Queen dual-attack handled inline at CombatSystem:306-308 (baseDmg = 8 for ground)
- Thor modes handled inline at CombatSystem:311-317 (Javelin=24, Explosive=6+splash)
- Splash damage uses 3-zone model (inner/mid/outer) at CombatSystem:463-515
- Widow Mine attacks via AbilitySystem sentinel, NOT CombatSystem (skipped at CombatSystem:163)
- `burrowed` component already exists at components.ts:225 area, used in resetComponents

### Adjacent files (DO NOT MODIFY)
- `src/systems/AISystem.ts` — AI targeting/engagement (has ROACH_REGEN_PULL_RATIO but not in scope)
- `src/rendering/UnitRenderer.ts` — visual rendering of units
- `src/combat/damageCalc.ts` — getBonusDamage helper

### Existing test coverage
- `npm test` via Vitest. Need to verify what combat tests exist.
