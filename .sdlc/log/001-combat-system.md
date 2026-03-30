# Log: Combat system — attack, damage, death
Started: 2026-03-30T00:00:00Z

## PLAN
### Steps
1. Add combat target component arrays + fix bitmask gaps (components.ts)
2. Fix spawnUnit to set ATTACK bit + init combat state (Game.ts)
3. Add CommandMode enum + update types (constants.ts, types.ts)
4. Extract shared query utilities (ecs/queries.ts)
5. Create CombatSystem — target acquisition, attack execution, splash, chase
6. Create DeathSystem — remove dead entities, death events
7. Add attack flash visual + death effect rendering (UnitRenderer.ts, components.ts)
8. Extend CommandSystem for right-click-on-enemy
9. Implement attack-move command (A + click)
10. Integrate new systems into Game.tick()
11. Add range visualization on hover
12. Write tests for CombatSystem and DeathSystem

### Key decisions
- Baneling dies on attack (suicide unit) — handled in CombatSystem
- Medivac has damage:0, gets ATTACK bit but CombatSystem skips entities with atkDamage===0
- Chase re-pathing throttled to avoid A* spam (only re-path if target moved >32px)
- commandMode Uint8Array tracks Idle/Move/AttackMove/AttackTarget per entity
- Attack-move: A key sets flag, next left-click issues attack-move to ground position
- System run order: selection → command → movement → combat → death

## DEV
### Step 1-3: Components, constants, spawnUnit fixes
- Files: src/ecs/components.ts, src/constants.ts, src/Game.ts
- Result: done
- Notes: Added targetEntity (Int16Array), commandMode (Uint8Array), atkFlashTimer (Float32Array). Fixed addUnitComponents to include ATTACK|VELOCITY bits. Added CommandMode enum.

### Step 4: Shared query utilities
- Files: src/ecs/queries.ts (new)
- Result: done
- Notes: findUnitAt, findEnemyAt, findClosestEnemy extracted as shared utilities

### Step 5: CombatSystem
- Files: src/systems/CombatSystem.ts (new)
- Result: done
- Notes: Auto-acquire targets, cooldown-based attacks, splash damage, chase with re-path throttling, Baneling suicide

### Step 6: DeathSystem
- Files: src/systems/DeathSystem.ts (new)
- Result: done
- Notes: Remove entities with hp<=0, record death events with bounded array

### Step 7: Visual effects
- Files: src/rendering/UnitRenderer.ts
- Result: done
- Notes: Attack flash (white body), projectile lines for ranged, expanding death circles, range visualization for selected units

### Step 8-9: CommandSystem extensions
- Files: src/systems/CommandSystem.ts
- Result: done
- Notes: Right-click enemy = attack command, A+click = attack-move, S = stop, H = hold. Extracted getSelectedUnits and issuePathCommand helpers.

### Step 10: Game.tick integration
- Files: src/Game.ts
- Result: done
- Notes: Added gameTime tracking, integrated combatSystem and deathSystem. System order: selection→command→movement→combat→death

### Step 11: Range visualization
- Files: src/rendering/UnitRenderer.ts
- Result: done (included in step 7)

## TEST
- Run: npm test
- Result: PASS
- Output: 3 test files, 48 tests, 0 failures (269ms)
- Fix attempts: 0

## REVIEW
- Result: CHANGES_REQUESTED → fixed → APPROVED
- Feedback:
  1. Hardcoded 2048 in chase arrays → replaced with MAX_ENTITIES (fixed)
  2. No-op ternary scanRange → removed (fixed)
  3. Misleading "Ring buffer" comment → changed to "Bounded array" (fixed)
  4. Chase condition simplified to `!== CommandMode.Move` (fixed)
- Fix rounds: 1

## COMMIT
- Hash: (no git repo — uncommitted)
- Message: feat: add combat system with attack, damage, death, and attack-move
- Files: src/ecs/components.ts, src/ecs/queries.ts, src/constants.ts, src/Game.ts, src/systems/CombatSystem.ts, src/systems/DeathSystem.ts, src/systems/CommandSystem.ts, src/rendering/UnitRenderer.ts, tests/helpers.ts, tests/ecs/world.test.ts, tests/systems/CombatSystem.test.ts, tests/systems/DeathSystem.test.ts
- Timestamp: 2026-03-30
