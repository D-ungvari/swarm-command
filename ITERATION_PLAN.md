# Swarm Command — Ultra Roadmap

Multi-sprint roadmap taking Swarm Command from functional prototype to portfolio-grade browser RTS. Each sprint is independently shippable. Sprints are designed to build on each other — later sprints assume earlier ones are complete.

**Current state:** Phases 1-6 complete (engine, ECS, selection, pathfinding, combat, units, abilities, economy, buildings, production, AI, fog of war, minimap, basic UI). 123 passing tests.

---

## Sprint 1: Input Architecture Overhaul
**Theme:** Fix click loss. Make the game feel responsive at any frame rate.
**Why first:** Every subsequent sprint benefits from responsive controls. This is the foundation.

### Problem Analysis
Input is processed inside `tick()` at 60 UPS. On a 144Hz monitor, clicks wait up to 16.7ms before a tick processes them. On frames where `accumulator < MS_PER_TICK`, input flags persist but nothing acts on them. Rapid commands collapse because `bufferedRightClick` is a boolean flag, not a queue. Two right-clicks between frames → only one command issued.

### Why not increase tick rate?
Doubling to 120 UPS doubles CPU cost for ALL systems (movement, combat, AI, gathering, pathing, separation, fog). The simulation doesn't need it — units move at the same speed regardless of tick rate (it's `dt`-based). The only beneficiary is input polling, and the command queue approach achieves that at zero simulation cost.

### 1.1 — Command Queue & InputProcessor
Create `src/input/CommandQueue.ts`:
```typescript
export const enum CommandType {
  Move, AttackMove, AttackTarget, Stop, HoldPosition, Patrol,
  Stim, SiegeToggle, Gather, SetRally, BuildPlace, Produce, Cancel,
  Select, BoxSelect, AddSelect, DoubleClickSelect,
  ControlGroupAssign, ControlGroupRecall,
}

export interface GameCommand {
  type: CommandType;
  wx?: number; wy?: number;       // world-space target
  targetEid?: number;              // target entity
  units?: number[];                // affected unit IDs
  data?: number;                   // extra (unit type, group index, etc.)
}
```
New `InputProcessor` class: runs every frame after `InputManager.update()`, reads input state, produces `GameCommand[]`, pushes to a shared queue array. Systems consume from this queue instead of reading raw input.

### 1.2 — Multi-Event Buffering
Replace boolean flags in `InputManager` with event arrays:
```typescript
private pendingMouseEvents: { type: string; button: number; x: number; y: number; time: number }[] = [];
```
Guarantees zero event loss regardless of frame rate or tick alignment. `update()` processes the full array, then clears it.

### 1.3 — Decouple Selection from Tick
Move selection logic out of `tick()` into the frame loop:
```
loop():
  input.update()
  inputProcessor.processFrame()     // → GameCommand[]
  applySelectionCommands()          // instant visual feedback
  handleMinimapClick()
  handleEdgeScroll()
  handleBuildPlacement()
  while (accumulator >= MS_PER_TICK):
    tick()                          // consumes movement/combat/ability commands only
    accumulator -= MS_PER_TICK
  render()
  input.lateUpdate()
```
Selection is purely visual state — no reason to wait for a simulation tick.

### 1.4 — Refactor SelectionSystem & CommandSystem
Both systems consume `GameCommand[]` instead of raw `InputState`. The InputProcessor is the only thing that reads raw input. Systems become testable with synthetic command arrays.

### Expected Impact
- Input latency: 16.7ms worst → 0ms for selection, ~8ms avg for commands
- Click loss: eliminated
- CPU cost: negligible
- No tick rate change

### Files
| Action | File |
|--------|------|
| Create | `src/input/CommandQueue.ts` |
| Modify | `src/input/InputManager.ts` — event array |
| Modify | `src/Game.ts` — loop restructure |
| Modify | `src/systems/SelectionSystem.ts` — consume commands |
| Modify | `src/systems/CommandSystem.ts` — consume commands |
| Modify | tests — update to use command-based API |

### Tests
- Command queue: enqueue/dequeue ordering, multi-event buffering
- Selection at frame rate: verify selection applies before tick
- Regression: all existing selection/command tests pass with new architecture

---

## Sprint 2: Core Combat Improvements
**Theme:** Damage types, armor, focus fire, target priority. Make army composition matter.

### 2.1 — Damage Types & Armor Classes
SC2-style damage modifiers add strategic depth.

**Damage types:**
| Type | vs Light | vs Armored | Units |
|------|----------|------------|-------|
| Normal | 100% | 100% | Marine, Zergling, Hydralisk |
| Concussive | 100% | 50% | Marauder |
| Explosive | 50% | 100% | Siege Tank, Baneling |

**Armor classes:**
| Class | Units |
|-------|-------|
| Light | Marine, Zergling, Baneling, Hydralisk, Medivac, SCV, Drone |
| Armored | Marauder, Siege Tank, Roach |

New ECS arrays: `atkDamageType: Uint8Array`, `armorClass: Uint8Array`.
New enums in `constants.ts`: `DamageType`, `ArmorClass`.
Data added to `UnitDef` in `units.ts`.
`CombatSystem` computes: `finalDmg = baseDmg * getDamageMultiplier(atkType, armorClass)`.
Splash inherits attacker's damage type.

### 2.2 — Base Armor
Flat damage reduction (min 1 damage):
```
finalDmg = max(1, (baseDmg * typeMultiplier) - targetArmor)
```
New array: `baseArmor: Float32Array`. Initial values: 0 for light, 1 for armored.
Prepares the data model for upgrade bonuses in Sprint 4.

### 2.3 — Focus Fire Fix
Current bug: `CommandMode.AttackTarget` units re-acquire nearby targets when the focused target moves out of range. Fix:
- `AttackTarget` mode ONLY switches targets when the original target **dies**
- Units chase the focused target indefinitely until it dies or player issues a new command
- Explicit micro (player right-click) always takes priority

### 2.4 — Auto-Target Priority
Replace `findClosestEnemy` with `findBestTarget` that scores candidates:
1. Units currently attacking me (highest priority — retaliation)
2. Closest enemy unit that can attack me
3. Closest enemy unit overall
4. Buildings (lowest priority — don't waste DPS on structures when units are nearby)

### 2.5 — Overkill Prevention
Track pending damage to prevent wasted attacks:
- New array: `pendingDamage: Float32Array`
- When a unit commits to an attack (cooldown starts), add damage to `pendingDamage[target]`
- When damage applies, subtract from `pendingDamage`
- Auto-acquire skips targets where `pendingDamage >= hpCurrent`
- Explicit focus-fire commands override this (respect player micro)

### 2.6 — Kill Counter
New array: `killCount: Uint16Array`. Incremented in `CombatSystem` when damage kills a target (or in `DeathSystem`). Displayed in info panel.

### Files
| Action | File |
|--------|------|
| Modify | `src/ecs/components.ts` — atkDamageType, armorClass, baseArmor, pendingDamage, killCount |
| Modify | `src/constants.ts` — DamageType, ArmorClass enums |
| Modify | `src/data/units.ts` — damageType, armorClass per UnitDef |
| Modify | `src/types.ts` — UnitDef type update |
| Modify | `src/systems/CombatSystem.ts` — damage calc, priority targeting, overkill, focus fire |
| Modify | `src/ecs/queries.ts` — findBestTarget |
| Modify | `src/systems/DeathSystem.ts` — kill counter |
| Modify | `src/Game.ts` — populate new arrays in spawnUnit |
| Update | tests — damage type multipliers, priority targeting, overkill scenarios |

### Tests
- Damage type multipliers: Normal/Concussive/Explosive vs Light/Armored
- Armor reduction: flat reduction, min 1 damage
- Focus fire: target persists until death
- Priority: retaliating enemies selected over idle ones
- Overkill: pending damage prevents redundant targeting

---

## Sprint 3: Control QoL
**Theme:** SC2-grade control shortcuts and command feedback.

### 3.1 — Hold Position (Real)
Currently `H` = stop (identical to `S`). Real hold position:
- Unit stops and does NOT chase targets out of range
- Still auto-acquires + attacks enemies within range
- New `CommandMode.HoldPosition` — `CombatSystem` skips chase when in this mode
- Visual indicator: small shield icon on held units

### 3.2 — Patrol Command
- Key: `P` then left-click target
- Units bounce between origin and patrol target, attacking enemies in aggro range along the way
- New `CommandMode.Patrol` + `patrolOriginX/Y: Float32Array`
- `MovementSystem`: when path completes, swap origin ↔ target, repath

### 3.3 — Army Selection Shortcuts
| Key | Action |
|-----|--------|
| `F2` | Select all Terran combat units (not workers, not buildings) |
| `F3` | Select all SCVs |
| `F5-F8` | Camera locations: `Ctrl+Fn` saves, `Fn` recalls, double-tap centers |

Camera locations stored as `{ x: number, y: number, zoom: number }[]` in `Game.ts`.

### 3.4 — Shift-Queue Visualization
When shift is held and units are selected, render queued waypoints:
- Dashed lines: unit → waypoint 1 → waypoint 2 → ...
- Small circles at each waypoint
- New `WaypointRenderer` or integrated into `UnitRenderer`
- Uses existing `paths[]` and `pathLengths[]`

### 3.5 — Smart Right-Click Context
Smarter context-sensitive right-click:
- Enemy → attack (existing)
- Own damaged unit + Medivac selected → follow + heal
- Gas geyser + SCV selected + no Refinery → auto-build Refinery
- Own building → set rally (existing, verify)
- Additional branches in `CommandSystem`

### 3.6 — Improved Click Tolerance
`findUnitAt` bounding-box + 8px tolerance is tight for small units:
- Increase to 12px base, 16px for small units (Zerglings, Drones)
- Priority: units > buildings when overlapping
- Prefer damaged units when multiple overlap (SC2 focus-fire behavior)

### 3.7 — Minimap Right-Click Commands
- Right-click minimap → issue move command to that world position
- A + click minimap → attack-move
- Resource dots on minimap (blue = minerals, green = gas)
- Flash enemy ping on minimap when under attack

### Files
| Action | File |
|--------|------|
| Create | `src/rendering/WaypointRenderer.ts` |
| Modify | `src/systems/SelectionSystem.ts` — F2/F3, camera locations |
| Modify | `src/systems/CommandSystem.ts` — patrol, smart right-click, hold position |
| Modify | `src/systems/CombatSystem.ts` — hold position skip chase |
| Modify | `src/systems/MovementSystem.ts` — patrol bounce |
| Modify | `src/ecs/components.ts` — patrolOriginX/Y |
| Modify | `src/constants.ts` — CommandMode.Patrol, HoldPosition |
| Modify | `src/Game.ts` — camera locations, minimap commands |
| Modify | `src/rendering/MinimapRenderer.ts` — commands, resource dots, attack flash |

### Tests
- Hold position: unit attacks in range, does not chase
- Patrol: bounces between origin and target, engages enemies
- F2: selects army, excludes workers and buildings
- Smart right-click: Medivac heal, SCV auto-refinery

---

## Sprint 4: Upgrades & Tech Tree
**Theme:** Research system, upgrade buildings, progressive power scaling.

### 4.1 — Upgrade Data Model
```typescript
export const enum UpgradeType {
  InfantryWeapons, InfantryArmor, VehicleWeapons,
  ZergMelee, ZergRanged, ZergCarapace,
  COUNT
}
```
`PlayerResources` gains `upgrades: Uint8Array(UpgradeType.COUNT)` — values 0-3.
Global per faction, not per entity.

### 4.2 — Upgrade Buildings
| Building | Faction | Researches | Prereq |
|----------|---------|------------|--------|
| Engineering Bay | Terran | Infantry Weapons, Infantry Armor, Vehicle Weapons | Barracks |
| Evolution Chamber | Zerg (AI) | Zerg Melee, Zerg Ranged, Zerg Carapace | Spawning Pool |

Add to `buildings.ts`. New `BuildingType` enum values.
Buildings have a research queue (reuse production queue arrays — `prodUnitType` becomes `prodItemType`).

### 4.3 — UpgradeSystem
New `src/systems/UpgradeSystem.ts`:
- Runs every tick
- Checks buildings with `buildingType === EngineeringBay/EvoChamber` and active research
- Decrements timer, applies upgrade on completion
- Player queues research via new hotkey (e.g., `R` when upgrade building selected)

### 4.4 — Combat Integration
`CombatSystem` reads upgrade levels:
```
atkBonus = upgrades[faction][weaponUpgradeType]
armorBonus = upgrades[faction][armorUpgradeType]
finalDmg = max(1, ((baseDmg + atkBonus) * typeMultiplier) - (baseArmor + armorBonus))
```

### 4.5 — AI Auto-Upgrade
AI starts researching after wave 3. One upgrade level per 2 waves. Prioritizes weapons over armor (2:1 ratio). Evolution Chamber auto-placed by AI near Hatchery.

### 4.6 — Upgrade UI
- HUD shows current upgrade levels (small +1/+2/+3 icons next to resource bar)
- Info panel shows upgrade bonuses on selected units
- Building info panel shows research progress + queue
- Upgrade cost tooltip on hover

### Files
| Action | File |
|--------|------|
| Create | `src/systems/UpgradeSystem.ts` |
| Modify | `src/constants.ts` — UpgradeType enum, BuildingType additions |
| Modify | `src/data/buildings.ts` — Engineering Bay, Evolution Chamber |
| Modify | `src/types.ts` — PlayerResources upgrade field |
| Modify | `src/systems/CombatSystem.ts` — upgrade bonus in damage calc |
| Modify | `src/systems/AISystem.ts` — auto-upgrade logic |
| Modify | `src/systems/CommandSystem.ts` — research hotkey |
| Modify | `src/rendering/HudRenderer.ts` — upgrade level display |
| Modify | `src/rendering/InfoPanelRenderer.ts` — upgrade bonuses |
| Modify | `src/Game.ts` — UpgradeSystem in tick, building spawn |

### Tests
- Upgrade application: +1 damage/armor per level
- Damage formula with upgrades: verify correct calculation
- AI auto-upgrade timing: wave 3+
- Research queue: queue, progress, completion

---

## Sprint 5: Visual Combat Polish
**Theme:** Projectiles, death effects, attack animations. Make combat readable and satisfying.

### 5.1 — Projectile System
Currently damage is instant and visually hard to read. Add visual projectiles:

| Unit | Projectile | Speed | Visual |
|------|-----------|-------|--------|
| Marine | Bullet | Near-instant (800px/s) | Small white dot |
| Marauder | Grenade | Medium (400px/s) | Larger blue-white dot |
| Siege Tank | Shell | Slow (300px/s) | Orange dot with arc trajectory |
| Hydralisk | Spine | Medium (500px/s) | Green needle |

Projectiles are **visual only** — damage still applies on attack execution. Exception: Siege Tank shells optionally have real travel time (dodgeable), making siege micro more meaningful.

**Implementation:**
- New `ProjectileRenderer` — manages pooled Graphics objects (pre-allocate 64)
- `CombatSystem` emits projectile events: `{ fromX, fromY, toX, toY, type, speed }`
- Renderer interpolates position each frame, removes on arrival
- Pool reuse prevents GC pressure

### 5.2 — Death Effects
Currently units just disappear. Add:
- **Shrink + fade:** All units scale down + alpha fade over 0.3s
- **Mechanical explosion:** Brief orange flash + 4-8 particles (Siege Tank, Medivac, SCV)
- **Biological decay:** Brief green/red tint + fade (Marines, Zerglings, etc.)
- **Building destruction:** Longer animation (1s), debris particles, fire effect during low HP (<25%)

**Implementation:**
- `DeathSystem` doesn't immediately remove entities — sets `deathTime` and a death animation state
- New rendering pass in `UnitRenderer` handles shrinking/fading corpses
- After animation completes, entity is actually removed

### 5.3 — Attack Flash Improvements
Current attack flash is a simple timer. Improve:
- Flash color matches damage type (white=normal, blue=concussive, orange=explosive)
- Slight recoil animation (unit shifts 2px away from target, snaps back)
- Muzzle flash particle at attacker position

### 5.4 — Low HP Indicators
- Units below 25% HP get a persistent red tint pulse
- Buildings below 25% HP show fire particles
- Helps player identify units that need healing or retreat

### Files
| Action | File |
|--------|------|
| Create | `src/rendering/ProjectileRenderer.ts` |
| Create | `src/rendering/ParticleSystem.ts` — simple particle pool |
| Modify | `src/systems/CombatSystem.ts` — emit projectile events |
| Modify | `src/systems/DeathSystem.ts` — death animation state, delayed removal |
| Modify | `src/rendering/UnitRenderer.ts` — death anims, recoil, low HP |
| Modify | `src/ecs/components.ts` — deathTime array |
| Modify | `src/Game.ts` — ProjectileRenderer init + render call |

### Tests
- Projectile pool: allocate, release, reuse
- Death animation: entity persists during animation, removed after
- Low HP threshold: correct at 25%

---

## Sprint 6: Advanced AI
**Theme:** Smarter opponent with multiple strategies, difficulty levels, and reactive behavior.

### 6.1 — Difficulty Levels
| Difficulty | Income Rate | Upgrade Speed | Army Comp | Timing |
|------------|------------|---------------|-----------|--------|
| Easy | 2 minerals/tick | Never upgrades | Random | Slow waves (every 45s) |
| Normal | 3 minerals/tick | After wave 5 | Balanced | Medium (every 30s) |
| Hard | 4 minerals/tick | After wave 3 | Counter-comp | Fast (every 20s) |
| Brutal | 5 minerals/tick | Immediate | Optimal | Very fast (every 15s) |

Selectable from start screen. Stored in game state.

### 6.2 — Counter-Composition AI
On Hard+, AI analyzes player army composition and builds counters:
- Player has many Marines → AI builds more Banelings (splash vs Light)
- Player has Siege Tanks → AI builds Zerglings (fast, close gap before siege damage)
- Player has Marauders → AI builds Zerglings (Concussive does 50% vs Light — wait, Zerglings are Light so they take full. Actually Marauder does reduced vs Armored, so AI should build Light units like Zerglings/Hydras that take full damage)

Actually, with the damage type system from Sprint 2:
- Player heavy on Explosive (Tanks) → AI builds Light units (Zerglings, Hydras) that take 50% from Explosive
- Player heavy on Concussive (Marauders) → AI builds Light units that take full, but avoids Armored (Roaches take only 50%)
- Hmm, need to reconsider. The counter logic should be: scan player army → pick unit types that are most cost-effective against that composition.

Implementation: `AISystem` maintains a `playerArmySnapshot` updated every 10s. Scoring function evaluates each available Zerg unit type vs the player army. AI builds the highest-scoring types.

### 6.3 — Multi-Pronged Attacks
On Hard+, AI splits army for simultaneous attacks:
- Main force attacks player base
- Harass squad (4-6 Zerglings) attacks mineral line from a different angle
- Forces player to split attention and micro on two fronts

### 6.4 — AI Expansion (Optional)
AI builds a second Hatchery at the map's third base location after wave 5. Doubles income, adds new attack angle. Gives the player a strategic target to deny.

### 6.5 — Retreat & Regroup Improvements
Current retreat triggers at 35% army HP. Improve:
- Retreat to nearest safe position (not always home base)
- Regroup: units wait for stragglers before re-engaging
- Don't retreat if winning the fight (compare army values, not just HP %)
- Kite behavior: ranged units (Hydras) back up while attacking

### Files
| Action | File |
|--------|------|
| Modify | `src/systems/AISystem.ts` — difficulty, counter-comp, multi-prong, expansion |
| Modify | `src/constants.ts` — Difficulty enum, AI tuning constants |
| Modify | `src/Game.ts` — difficulty selection, pass to AI init |
| Modify | `index.html` — difficulty selector on start screen |
| Modify | `src/map/MapData.ts` — third base location for AI expansion |

### Tests
- Difficulty scaling: income rates, timing
- Counter-comp: AI switches unit types based on player army
- Multi-prong: army splits into 2+ groups
- Retreat: triggers correctly, regroups before re-engaging

---

## Sprint 7: Map & Terrain
**Theme:** Better maps, terrain variety, strategic terrain features.

### 7.1 — Ramp Tiles & High Ground
- New tile type: `TileType.Ramp` connecting elevation levels
- High ground gives +1 range and "miss chance" — units on low ground have 30% chance to miss (SC2-like)
- Vision restriction: units on low ground can't see up ramps unless a friendly unit is on high ground
- New component: `elevation: Uint8Array` per entity (set based on tile)

### 7.2 — Destructible Rocks
- New tile type: `TileType.Destructible`
- Blocks pathfinding until destroyed
- HP: 500. Attacks from units break them.
- Opens new attack paths and expansions
- Renders as gray boulder shapes

### 7.3 — Multiple Map Layouts
Currently one hardcoded symmetric map. Add 3 total:
| Map | Size | Features |
|-----|------|----------|
| Plains | 128×128 | Open with 2 ramps, current layout refined |
| Canyon | 96×128 | Narrow choke points, destructible rocks, high ground advantage |
| Islands | 128×128 | Bases separated by water, single land bridge (Medivac advantage) |

Map selection on start screen. `MapData.generateMap()` takes a `MapType` parameter.

### 7.4 — Xel'Naga Watchtower
- Neutral building at map center
- Any unit standing nearby gains shared vision in a large radius
- Incentivizes map control and early scouting
- Implemented as a special resource entity with large sight range that grants vision to the faction with units closest to it

### 7.5 — Expansion Bases
- 2-3 additional base locations per map with mineral patches
- Natural expansion (close to main) has 6 patches
- Third base (farther) has 8 patches but exposed position
- Adds macro gameplay: expand economy vs army composition

### Files
| Action | File |
|--------|------|
| Modify | `src/map/MapData.ts` — elevation, destructibles, multiple layouts |
| Modify | `src/map/Pathfinder.ts` — destructible blocking, elevation cost |
| Modify | `src/systems/CombatSystem.ts` — high ground miss chance, range bonus |
| Modify | `src/systems/FogSystem.ts` — elevation vision rules |
| Modify | `src/rendering/TilemapRenderer.ts` — ramp tiles, elevation shading |
| Modify | `src/ecs/components.ts` — elevation array |
| Modify | `src/constants.ts` — TileType additions, MapType enum |
| Modify | `src/Game.ts` — map selection |
| Modify | `index.html` — map selector |

### Tests
- High ground: miss chance applies, range bonus applies
- Destructible rocks: block pathing, destroyable, open path on death
- Vision: low ground can't see up ramp
- Multiple maps: all generate valid walkable grids

---

## Sprint 8: Audio & UX Polish
**Theme:** Sound design, cursor feedback, tutorial, accessibility.

### 8.1 — Procedural Audio (Web Audio API)
No asset files — generate all sounds with oscillators + noise:

| Sound | Method | Trigger |
|-------|--------|---------|
| Marine attack | Short white noise burst, high-pass filter | Attack event |
| Marauder attack | Low thump (sine 80Hz, 50ms decay) | Attack event |
| Siege Tank fire | Bass boom + high crackle | Attack event |
| Zergling attack | Quick saw wave chirp | Attack event |
| Hydralisk spine | Sharp click (noise, band-pass) | Attack event |
| Unit select | Soft ping (sine 800Hz, 100ms) | Selection |
| Command ack | Double blip (sine 600Hz → 800Hz) | Right-click command |
| Building complete | Rising chime (sine arpeggio) | Production done |
| Under attack | Alarm (square wave 440Hz, tremolo) | Existing alert |
| Upgrade complete | Fanfare (major chord) | Research done |
| Unit death | Low thud + fade | Death event |

### 8.2 — Cursor States
Change cursor based on context:
| Context | Cursor |
|---------|--------|
| Default | Arrow |
| Hovering enemy | Crosshair (red) |
| Hovering ally | Pointer (green) |
| Attack-move mode | Crosshair (orange) |
| Build placement | Grid snap cursor |
| Patrol mode | Circular arrows |

Use CSS `cursor` property with custom SVG data URLs (inline, no files).

### 8.3 — Tutorial / First Game Experience
Optional guided first game:
- Step 1: "Select your SCVs" (highlight workers)
- Step 2: "Right-click minerals to gather" (highlight patches)
- Step 3: "Build a Barracks" (highlight B key)
- Step 4: "Train Marines" (highlight Q key)
- Step 5: "Attack-move toward the enemy" (highlight A key)

Implemented as a state machine overlay. Shows hint text + highlights. Advances on action completion. Skippable with Escape. Stored as a `tutorialStep` in Game state.

### 8.4 — Game Speed Control
- `+` / `-` keys adjust game speed (0.5x, 1x, 1.5x, 2x)
- Multiplier applied to `MS_PER_TICK`: at 2x, `MS_PER_TICK = 1000 / 120`
- Display current speed in HUD
- Pause with `P` (when not in patrol mode — rebind patrol to `Shift+P` or `Ctrl+P` if conflict)

### 8.5 — Accessibility
- Color-blind friendly: use shapes + patterns in addition to colors for faction distinction (already have rectangles vs circles — add pattern fills)
- Tooltip on hover showing unit name + stats
- Keyboard-only mode: arrow keys pan camera, Tab cycles selection, Enter confirms

### Files
| Action | File |
|--------|------|
| Modify | `src/audio/SoundManager.ts` — full procedural audio implementation |
| Create | `src/rendering/CursorManager.ts` — context-sensitive cursors |
| Create | `src/systems/TutorialSystem.ts` — guided tutorial |
| Modify | `src/Game.ts` — cursor manager, tutorial, game speed |
| Modify | `src/constants.ts` — game speed constants |
| Modify | `src/rendering/HudRenderer.ts` — speed display, tutorial overlay |

---

## Sprint 9: Replay & Stats
**Theme:** Post-game analysis, replay system, player progression.

### 9.1 — Game Recorder
Record every tick's commands to a compact log:
```typescript
interface TickRecord {
  tick: number;
  commands: GameCommand[];       // player commands
  aiActions: AIAction[];         // AI spawns, attacks, retreats
}
```
Store as JSON blob. ~50KB for a 5-minute game.
Replay plays back by feeding recorded commands/AI actions tick by tick.

### 9.2 — Post-Game Stats Screen
After victory/defeat, show:
- Game duration
- Units produced / lost (by type)
- Resources gathered (minerals, gas)
- Damage dealt / taken
- APM (actions per minute) — based on command count
- Army value over time graph (simple canvas line chart)
- Upgrade timeline

Track stats in a `GameStats` object updated each tick by relevant systems.

### 9.3 — Army Value Graph
Simple canvas-based line graph:
- X axis: game time (0 to end)
- Y axis: army value (sum of unit costs)
- Two lines: Terran (blue) and Zerg (red)
- Sample every 5 seconds
- Shows momentum shifts — where you were winning/losing

### 9.4 — APM Counter
Live APM display in HUD (optional, toggle with `F1`):
- Track commands in a rolling 60-second window
- Display current APM
- Helps players improve their mechanics

### Files
| Action | File |
|--------|------|
| Create | `src/systems/ReplaySystem.ts` — recording + playback |
| Create | `src/rendering/StatsRenderer.ts` — post-game stats screen |
| Create | `src/stats/GameStats.ts` — stat tracking |
| Modify | `src/Game.ts` — replay integration, stats tracking |
| Modify | `src/rendering/GameOverRenderer.ts` — show stats button |
| Modify | `src/rendering/HudRenderer.ts` — APM counter |

---

## Sprint 10: Performance & Scale
**Theme:** Handle larger armies, bigger maps, smoother performance.

### 10.1 — Spatial Hash for Queries
Current combat/separation uses O(n^2) brute-force iteration. Replace with spatial hash:
- Grid of cells (4x4 tiles per cell = 128px cells)
- Entities register in cells based on position
- Queries only check entities in nearby cells
- Expected speedup: 5-10x for 200+ unit battles

### 10.2 — Pathfinding Worker Thread
A* on 128x128 grid can take 1-5ms per path. Multiple paths per tick stacks up. Move to Web Worker:
- Main thread sends path requests: `{ id, startX, startY, endX, endY }`
- Worker computes A* on a copy of the walkability grid
- Returns path asynchronously
- Units start moving toward target immediately (straight line), switch to A* path when it arrives
- Handles up to 20 concurrent path requests

### 10.3 — Entity Pool Expansion
Current `MAX_ENTITIES = 2048`. For large battles:
- Increase to 4096 (doubles TypedArray memory: ~512KB → ~1MB, trivial)
- Or implement entity recycling: freelist already exists, just increase cap
- Profile to verify no performance cliff

### 10.4 — Render Batching
Current UnitRenderer creates/destroys Graphics objects. Optimize:
- Pre-allocate sprite pool per unit type
- Reuse sprites when units die / spawn
- Batch health bars into a single Graphics draw call
- Use PixiJS ParticleContainer for projectiles (10x faster than Container)

### 10.5 — Frame Budget Monitor
Debug overlay (toggle with `F12`):
- Tick time (ms per tick average)
- Render time (ms per frame average)
- Entity count
- Active paths
- Draw calls
- Memory usage estimate

### Files
| Action | File |
|--------|------|
| Create | `src/ecs/SpatialHash.ts` |
| Create | `src/map/PathWorker.ts` — Web Worker |
| Create | `src/map/PathWorkerClient.ts` — main thread interface |
| Modify | `src/ecs/queries.ts` — spatial hash queries |
| Modify | `src/systems/CombatSystem.ts` — spatial hash for target finding |
| Modify | `src/systems/MovementSystem.ts` — async pathfinding, spatial hash separation |
| Modify | `src/rendering/UnitRenderer.ts` — sprite pooling |
| Modify | `src/rendering/ProjectileRenderer.ts` — ParticleContainer |
| Modify | `src/constants.ts` — MAX_ENTITIES increase |
| Create | `src/rendering/DebugOverlay.ts` — frame budget |

---

## Sprint 11: Content & Variety
**Theme:** More units, abilities, and strategic options.

### 11.1 — New Terran Units
| Unit | Role | Ability | Prereq |
|------|------|---------|--------|
| Ghost | Sniper | EMP (drains shields/energy in AoE) or Snipe (150 damage to bio) | Factory + Engineering Bay |
| Hellion | Harass | Line splash (cone-shaped damage) | Factory |

### 11.2 — New Zerg Units
| Unit | Role | Ability | Prereq |
|------|------|---------|--------|
| Mutalisk | Air harass | Bounce attack (hits 3 targets, 1/3 damage each bounce) | Spire building |
| Infestor | Support | Fungal Growth (AoE root for 3s, 30 damage over duration) | Infestation Pit |

### 11.3 — Building Add-Ons (Terran)
SC2-style add-ons that unlock advanced units:
- Tech Lab → unlocks Marauder (Barracks), Siege Tank (Factory)
- Reactor → allows 2 units produced simultaneously

### 11.4 — Creep (Zerg)
- Zerg buildings spread creep (purple tiles) over time
- Zerg units on creep get +30% movement speed
- Creep Tumors: buildable by AI, spread creep further
- Visual: purple overlay on affected tiles

### Files
| Action | File |
|--------|------|
| Modify | `src/data/units.ts` — Ghost, Hellion, Mutalisk, Infestor |
| Modify | `src/data/buildings.ts` — Spire, Infestation Pit, Tech Lab, Reactor |
| Modify | `src/systems/AbilitySystem.ts` — EMP, Snipe, Bounce, Fungal, Creep |
| Modify | `src/systems/CombatSystem.ts` — bounce attack logic |
| Modify | `src/systems/AISystem.ts` — new unit spawning |
| Create | `src/systems/CreepSystem.ts` — creep spread + speed bonus |
| Modify | `src/rendering/TilemapRenderer.ts` — creep overlay |
| Modify | `src/ecs/components.ts` — new ability arrays |
| Modify | `src/constants.ts` — new UnitType, BuildingType values |

---

## Sprint 12: Scenarios & Challenges
**Theme:** Replayable content beyond single skirmish.

### 12.1 — Challenge Modes
| Mode | Description | Win Condition |
|------|-------------|---------------|
| Survival | Endless waves, increasing difficulty | Survive as long as possible, high score |
| Rush Defense | 90s to build, then massive Zerg rush | Survive the rush |
| Micro Arena | Pre-set armies, no building | Destroy enemy with fewer losses |
| Economy Race | First to 2000 minerals wins | Gather fastest |

### 12.2 — Leaderboard (Local)
- Track best times / scores per challenge in `localStorage`
- Display personal bests on challenge select screen
- Track: time survived, units lost, resources gathered, APM

### 12.3 — Custom Game Settings
Start screen options:
- Starting resources (50/100/500/1000 minerals)
- Starting units (workers only / small army / large army)
- Map size (64×64, 96×96, 128×128)
- AI difficulty (Easy/Normal/Hard/Brutal)
- Game speed (0.5x / 1x / 1.5x / 2x)
- Fog of war (on / off)

### Files
| Action | File |
|--------|------|
| Create | `src/scenarios/ScenarioManager.ts` — scenario definitions |
| Create | `src/scenarios/challenges.ts` — challenge mode configs |
| Create | `src/rendering/ChallengeSelectRenderer.ts` — challenge UI |
| Modify | `src/Game.ts` — scenario init, custom settings |
| Modify | `index.html` — custom game settings UI |
| Modify | `src/rendering/GameOverRenderer.ts` — challenge scores |

---

## Sprint 13: Portfolio Integration & Deploy
**Theme:** Ship it. Make it presentable. Wire into portfolio.

### 13.1 — GitHub Pages Deploy
- GitHub Actions workflow: build + deploy on push to main
- Vite base path already set to `/swarm-command/`
- Automated build verification (tests + type check)

### 13.2 — Portfolio Terminal Integration
- Add Swarm Command entry to portfolio terminal
- Live playable embed or link
- Project description, tech stack, key features
- Screenshot / GIF preview

### 13.3 — README
- Project overview with screenshot
- Tech stack badges
- Architecture overview (ECS, systems, rendering)
- How to run locally
- Key features list
- Links to play

### 13.4 — Open Graph / Social Preview
- `<meta>` tags for social sharing
- Preview image (screenshot of gameplay)
- Description: "SC2-inspired browser RTS built with TypeScript + PixiJS"

### 13.5 — Mobile Detection
- Detect touch devices on load
- Show "Best played on desktop with keyboard + mouse" message
- Don't block — let them try, but set expectations

### Files
| Action | File |
|--------|------|
| Create | `.github/workflows/deploy.yml` |
| Create | `README.md` |
| Modify | `index.html` — meta tags, mobile detection |
| Modify | `portfolio/` — add Swarm Command entry |

---

## Sprint Summary

| Sprint | Theme | Key Deliverables | Depends On |
|--------|-------|-----------------|------------|
| **1** | Input Architecture | Command queue, frame-rate input, zero click loss | — |
| **2** | Core Combat | Damage types, armor, focus fire, target priority, overkill prevention | 1 |
| **3** | Control QoL | Hold position, patrol, F2/F3, shift-queue viz, smart right-click | 1 |
| **4** | Upgrades | Engineering Bay, research queue, +1/+2/+3 weapons/armor, AI upgrades | 2 |
| **5** | Visual Polish | Projectiles, death effects, attack animations, particles | 2 |
| **6** | Advanced AI | Difficulty levels, counter-comp, multi-prong attacks, expansion | 2, 4 |
| **7** | Map & Terrain | High ground, ramps, destructible rocks, 3 map layouts, watchtower | 3 |
| **8** | Audio & UX | Procedural audio, cursors, tutorial, game speed, accessibility | 5 |
| **9** | Replay & Stats | Game recorder, post-game stats, APM counter, army graph | 1 |
| **10** | Performance | Spatial hash, path worker thread, sprite pooling, debug overlay | 2, 5 |
| **11** | Content | Ghost, Hellion, Mutalisk, Infestor, add-ons, creep | 4, 6 |
| **12** | Scenarios | Challenge modes, local leaderboard, custom game settings | 6, 7 |
| **13** | Deploy | GitHub Actions, portfolio integration, README, social preview | All |

### Dependency Graph
```
Sprint 1 (Input) ──┬── Sprint 2 (Combat) ──┬── Sprint 4 (Upgrades) ── Sprint 6 (AI) ──┐
                    │                       ├── Sprint 5 (Visual) ──── Sprint 8 (Audio) │
                    │                       └── Sprint 10 (Perf)                        │
                    ├── Sprint 3 (Controls) ── Sprint 7 (Maps) ────────────────────────┤
                    └── Sprint 9 (Replay)                                               │
                                                                Sprint 11 (Content) ◄───┤
                                                                Sprint 12 (Scenarios) ◄─┘
                                                                Sprint 13 (Deploy) ◄── All
```

### Parallelizable Sprints
These pairs/groups can be worked in parallel if needed:
- Sprints 2 + 3 (combat + controls are independent after input overhaul)
- Sprints 4 + 5 (upgrades + visual polish are independent)
- Sprints 7 + 9 (maps + replay are independent)
- Sprint 10 can start anytime after Sprint 2

---

## Backlog Item Format
Each sprint decomposes into backlog items for the SDLC orchestrator:

```
| # | Title | Type | Project | Acceptance Criteria |
```

When starting a sprint, create backlog items in `.sdlc/BACKLOG.md` and run `/go`.
