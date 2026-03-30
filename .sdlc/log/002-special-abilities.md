# Log: Full unit roster — special abilities
Started: 2026-03-30

## PLAN
### Abilities to implement
1. Stim Pack (Marine) — T key, +50% speed, 2x attack speed, costs 10 HP, 7s duration
2. Concussive Shells (Marauder) — passive, attacks slow target 50% for 1.5s
3. Siege Mode (Siege Tank) — E key toggle, 2s transition, changed stats when sieged
4. Medivac Heal — passive, auto-heals nearby bio allies 3 HP/s within 4 tiles
5. Roach Regen — passive, 2 HP/s idle, 0.5 HP/s in combat, 3s combat timeout

### Steps
1. Add ability component arrays (stimEndTime, slowEndTime/Factor, siegeMode, lastCombatTime)
2. Add ability constants to constants.ts
3. Create AbilitySystem.ts (stim expiry, slow expiry, siege transitions, heal, regen)
4. Add T/E hotkeys to CommandSystem.ts (+ gameTime param)
5. Update CombatSystem for concussive slow + roach combat tracking + siege restrictions
6. Update MovementSystem for slow debuff + siege immobilization
7. Update UnitRenderer for visual feedback
8. Wire AbilitySystem into Game.ts tick loop
9. Update test helpers + write tests

### Key decisions
- New ABILITY component bit for all units (any unit can be slowed)
- Stim modifies moveSpeed/atkCooldown directly, restores from UNIT_DEFS on expiry
- Slow applied as multiplier in MovementSystem, not baked into moveSpeed
- Siege mode mutates atkDamage/Range/Splash directly, restores on exit
- Medivac heals bio only (Marine, Marauder), not mechanical or self

## DEV
### Step 1-2: Components + Constants
- Files: src/ecs/components.ts, src/constants.ts
- Result: done
- Notes: ABILITY bit (bit 8), 6 new TypedArrays, SiegeMode enum, all ability constants

### Step 3: AbilitySystem
- Files: src/systems/AbilitySystem.ts (new)
- Result: done
- Notes: 5 sub-functions: processStimExpiry, processSlowExpiry, processSiegeTransitions, processMedivacHeal, processRoachRegen

### Step 4: Hotkeys (T=stim, E=siege)
- Files: src/systems/CommandSystem.ts
- Result: done
- Notes: Added gameTime param, applyStim + toggleSiegeMode functions, sieged tanks can't receive move commands

### Step 5: CombatSystem updates
- Files: src/systems/CombatSystem.ts
- Result: done
- Notes: Marauder concussive slow, lastCombatTime tracking for attacker+target+splash, siege transition blocks attack, sieged tank drops out-of-range targets

### Step 6: MovementSystem updates
- Files: src/systems/MovementSystem.ts
- Result: done
- Notes: slowFactor reduces effective speed, siege mode immobilizes

### Step 7: Visual feedback
- Files: src/rendering/UnitRenderer.ts
- Result: done
- Notes: Stim=teal tint, slow=frost ring, siege=wider shape+longer cannon+transition pulse, heal beams, roach regen pulse

### Step 8: Game.ts wiring
- Files: src/Game.ts
- Result: done
- Notes: abilitySystem added between combat and death, gameTime passed to commandSystem

## TEST
- Run: npm test
- Result: PASS
- Output: 4 test files, 72 tests, 0 failures (293ms)
- Fix attempts: 0

## REVIEW
- Result: APPROVED
- Feedback: Clean, consistent with codebase patterns, no issues found
- Fix rounds: 0

## COMMIT
- Hash: (no git repo — uncommitted)
- Message: feat: add special abilities (stim, concussive shells, siege mode, heal, regen)
- Files: src/ecs/components.ts, src/constants.ts, src/systems/AbilitySystem.ts, src/systems/CombatSystem.ts, src/systems/MovementSystem.ts, src/systems/CommandSystem.ts, src/rendering/UnitRenderer.ts, src/Game.ts, tests/helpers.ts, tests/systems/AbilitySystem.test.ts, tests/systems/CombatSystem.test.ts
- Timestamp: 2026-03-30
