# Progress

## Current Phase
SESSION HANDOFF — Sprints 1 & 2 complete, Sprint 3 next

## Completed This Session
### Sprint 1: Input Architecture Overhaul (commit 231be70)
- Command queue + frame-rate selection, zero click loss, multi-event buffering
- New files: CommandQueue.ts, InputProcessor.ts
- Modified: InputManager.ts, Game.ts, SelectionSystem.ts, CommandSystem.ts
- 24 new tests

### Sprint 2: Core Combat Improvements (commit a41fd6c)
- Damage types (Normal/Concussive/Explosive) + armor classes (Light/Armored)
- Base armor flat reduction (min 1 damage), getDamageMultiplier()
- findBestTarget priority: retaliation > armed > unarmed > buildings
- Overkill prevention via pendingDamage tracking
- Kill counter per unit, shown in info panel
- New files: src/combat/damageCalc.ts
- 19 new tests, 157 total passing

## What's Next: Sprint 3 — Control QoL
Steps:
- 3.1: Hold Position (real) — new CommandMode.HoldPosition in constants.ts; InputProcessor emits it on H key; CombatSystem skips chase when in HoldPosition mode; CommandSystem handles the Stop-like state
- 3.2: Patrol command — new CommandMode.Patrol; patrolOriginX/Y Float32Arrays in components.ts; InputProcessor emits Patrol on P key; MovementSystem bounces between origin and target when path completes
- 3.3: F2 = select all army (all Terran combat units, not workers); F3 = select all workers — update Game.ts render() section
- 3.4: Shift-queue visualization — new WaypointRenderer (dashed lines from unit to waypoints when shift held)
- 3.5: Improved click tolerance — findUnitAt in SelectionSystem: increase from 8px to 12px, prefer units over buildings, prefer damaged
- 3.6: Smart right-click — Medivac selected + right-click own damaged unit = follow+heal intent

## Architecture (current state)
- Input: DOM → pendingMouseEvents[] → InputProcessor.processFrame() → selectionQueue (frame-rate) + simulationQueue (tick-rate)
- Attack flow: atkDamageType + armorClass → getDamageMultiplier → max(1, dmg*mult - baseArmor) → pendingDamage tracking
- killCount per entity, displayed in InfoPanelRenderer
- 11 test files, 157 tests passing
- See ITERATION_PLAN.md for full 13-sprint roadmap
