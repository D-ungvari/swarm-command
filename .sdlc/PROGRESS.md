# Progress

## Current Phase
SESSION HANDOFF — Backlog #1 and #2 complete

## Current Work
(none — session ending, context window filling up)

## Session Handoff
- **Completed this session:** Backlog #1 (Combat system) and #2 (Special abilities)
- **Next session should:** Pick up Backlog #3 (Economy — minerals, gas, workers, resource HUD)
- **No blockers**
- **No git repo exists** — all changes are uncommitted on disk. Next session should `git init` + initial commit.

## Completed
### Backlog #1: Combat System (Phase 3)
- CombatSystem: auto-target acquisition, cooldown-based attacks, splash damage, chase pathing, Baneling suicide
- DeathSystem: entity removal on hp<=0, death events for visual effects
- CommandSystem: right-click-on-enemy, A+click attack-move, S/H stop/hold
- UnitRenderer: attack flash, projectile lines, death circles, range visualization
- 48 tests (ECS world, CombatSystem, DeathSystem)

### Backlog #2: Special Abilities (Phase 4)
- Stim Pack (Marine, T key): +50% speed, 2x attack speed, costs 10 HP, 7s duration
- Concussive Shells (Marauder, passive): attacks slow target 50% for 1.5s
- Siege Mode (Siege Tank, E key): 2s transition, damage 35, range 13, splash 1.5 when sieged
- Medivac Heal (passive): auto-heals nearby bio allies 3 HP/s within 4 tiles
- Roach Regen (passive): 2 HP/s idle, 0.5 HP/s in combat
- Visual feedback: stim glow, frost ring, siege shape, heal beams, regen pulse
- 72 tests total (24 new ability tests + 3 new combat tests)

## Architecture Notes
- System order: selection → command → movement → combat → ability → death
- 9 component bits used (POSITION, VELOCITY, HEALTH, ATTACK, MOVEMENT, SELECTABLE, RENDERABLE, UNIT_TYPE, ABILITY), 23 remaining
- All ability state in TypedArrays following SoA pattern
- Stim/siege modify component values directly, restore from UNIT_DEFS on expiry
- Slow applied as multiplier in MovementSystem, not baked into moveSpeed
