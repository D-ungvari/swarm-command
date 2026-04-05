---
scope: SC2 Skirmish vs AI — Expert Gameplay Audit & Implementation Plan
created: 2026-04-05
backlog_items: 94, 95, 96, 97, 98, 99, 100, 102, 103-118
task_count: 18
status: READY
related_plans:
  - .sdlc/plans/enemy-ai-overhaul.md (7 tasks, backlog #94)
  - .sdlc/plans/gameplay-loop-improvements.md (21 tasks, backlog #119-124 + bug fixes)
  - .sdlc/plans/ui-look-and-feel.md (10 tasks, backlog #125 + feedback items)
---

# Ultraplan: SC2 Skirmish vs AI — Full Gameplay Audit

## Vision Alignment

Swarm Command targets SC2 players warming up between ladder games. For that promise to hold, a Diamond+ player needs to feel "this is SC2" within their first skirmish. Right now the game has impressive breadth (28 units, 17 buildings, 25+ abilities, 10 maps) but critical SC2 systems are missing or incorrectly implemented. This audit identifies every gap between the current codebase and an authentic SC2 LotV skirmish vs AI experience, then produces a prioritized implementation plan.

## Methodology

Full codebase analysis across all 4 layers (ECS/engine, systems/logic, rendering/UI, data/config) plus line-level verification of specific mechanics against SC2 LotV Liquipedia values.

---

## Gap Inventory

### TIER 1: CRITICAL GAPS — Any SC2 player notices immediately

| # | Gap | Impact | Effort | Status |
|---|-----|--------|--------|--------|
| C1 | **Siege Tank siege mode fires 2.5× too fast** — cooldown not set on transition (stays 860ms, should be 2140ms) | HIGH | S | NEW |
| C2 | **No Siege Tank minimum range** — sieged tanks should not fire at targets within 2 tiles | HIGH | S | NEW |
| C3 | **No Zerg Extractor** — player-as-Zerg cannot build gas; Refinery is Terran-only. AI hacks around this | HIGH | S | NEW |
| C4 | **No detection system** — cloaked/burrowed units are permanently invisible with zero counter (no Scanner Sweep, no Overseer, no detector buildings) | HIGH | M | NEW |
| C5 | **No TechLab unit gating** — Marauder, Ghost, Siege Tank, Thor, Battlecruiser all buildable without TechLab | HIGH | S | Backlog #98 partial |
| C6 | **Reactor produces faster, not dual** — should produce 2 units simultaneously, not 2× speed | HIGH | M | Backlog #98 partial |
| C7 | **Missing tech gate buildings** — no Armory (gates Thor, vehicle armor), Ghost Academy (gates Ghost), Fusion Core (gates BC) | HIGH | M | NEW |
| C8 | **No Lair/Hive tech progression** — all Zerg buildings available immediately, no tech timing pressure | HIGH | M | NEW |
| C9 | **No Medivac transport** — drops are core Terran gameplay; Medivac only heals | HIGH | L | NEW |

### TIER 2: IMPORTANT GAPS — Veterans notice within a few games

| # | Gap | Impact | Effort | Status |
|---|-----|--------|--------|--------|
| I1 | **Multi-hit attacks wrong** — Reaper (4×2), Queen ground (4×2), Thor Javelin (6×4) treated as single hits; armor applied once instead of per-hit | MED | S | NEW |
| I2 | **Fungal Growth slows 75% instead of rooting** — SC2 LotV Fungal is a full root (0% speed, 2.85s) | MED | S | NEW |
| I3 | **Widow Mine splash doesn't hit friendlies** — SC2 splash hits all units including your own | MED | S | NEW |
| I4 | **No elevation combat penalty** — no high-ground miss chance (SC2: ~30% miss from low ground) | MED | S | NEW |
| I5 | **No unit-specific research** — Stim, Combat Shield, Siege Tech, Concussive Shells, Metabolic Boost all work without research | MED | M | NEW |
| I6 | **No morph mechanics** — Baneling/Ravager/Lurker produced from Hatchery, not morphed from base units | MED | M | NEW |
| I7 | **Missing Zerg tech buildings** — Baneling Nest, Ultralisk Cavern, Lurker Den (tech gates for morphs) | MED | M | Depends on C8 |
| I8 | **No Medivac Boost** — core bio micro ability | MED | S | NEW |
| I9 | **No BC Tactical Jump** — signature ability, basis of BC rush | MED | S | NEW |
| I10 | **No Reaper cliff jump** — Reaper's defining feature | MED | M | NEW |
| I11 | **Vehicle/Ship Armor upgrade missing** — only 6 upgrade types; mech has no armor upgrade path | MED | S | NEW |
| I12 | **Snipe targeting outdated** — filters out mechanical units (old behavior); SC2 LotV Steady Targeting hits everything, is channeled/interruptible | MED | S | NEW |
| I13 | **Roach fast regen not gated to burrowed** — gives 7 HP/s any time out of combat; SC2 requires burrowed state + Tunneling Claws | LOW | S | NEW |
| I14 | **Missing Terran units: Banshee, Liberator, Raven** — Raven especially critical as only Terran mobile detector | MED | L | NEW |
| I15 | **Missing Zerg units: Overseer, Brood Lord, Swarm Host** — Overseer critical as Zerg's only detector | MED | L | NEW |

### TIER 2.5: PLAYER-REPORTED GAPS (from playtesting)

| # | Gap | Impact | Effort | Status |
|---|-----|--------|--------|--------|
| F1 | **Zerg units should morph instantly from larva** — spending a larva should immediately start all unit morphs simultaneously, not queue them one at a time. Larva count IS the production cap, not a sequential queue. | HIGH | M | NEW |
| F2 | **Tanks have a hard time auto-acquiring targets** — siege mode auto-acquire is slow or fails. Related to C1/C2 (siege stats) but may also be a CombatSystem targeting priority issue for sieged units. | MED | S | NEW |

### TIER 3: POLISH GAPS — Nice-to-have for authenticity

| # | Gap | Impact | Effort | Status |
|---|-----|--------|--------|--------|
| P1 | No autocast toggle (Medivac heal, SCV repair) | LOW | S | NEW |
| P2 | No Terran building burning (<33% HP auto-damage) | LOW | S | NEW |
| P3 | No Overlord speed upgrade / generate creep / transport morph | LOW | M | NEW |
| P4 | No Spine/Spore Crawler uprooting | LOW | S | NEW |
| P5 | No Nydus Network | LOW | L | NEW |
| P6 | No Sensor Tower | LOW | S | NEW |
| P7 | Mineral patches all 1500 (should be 1800/1500 mix) | LOW | S | NEW |
| P8 | Veterancy system is non-SC2 (should be optional/off for practice) | LOW | S | NEW |
| P9 | No multi-building production select (Tab through same-type buildings) | LOW | M | NEW |
| P10 | Hellbat bonus damage +11 vs Light (should be +12) | LOW | S | NEW |
| P11 | Cyclone missing +12 vs Armored on normal attack | LOW | S | NEW |

### VERIFIED CORRECT
- Supply Depot lowering updates walkability ✓
- Starting minerals 50 ✓
- Baneling damage 16 (+19 vs Light) ✓
- Lurker bonus +10 vs Armored ✓
- Ghost attack cooldown 1500ms ✓
- Marauder Concussive Shells 1.07s slow ✓
- Splash damage 3-zone model (inner/mid/outer) ✓
- Mutalisk glaive bounce ✓
- Overkill prevention via pendingDamage ✓
- Larva system (3 natural, inject +3/+4, 11s regen) ✓
- Creep speed bonus +30% ✓

---

## Dependency Graph

```
T1: Stat/Behavior Fixes ←── no deps (pure fixes)
T2: Zerg Extractor ←── no deps
T3: Tech Gate Buildings (Armory, Ghost Academy, Fusion Core) ←── no deps
T4: TechLab Unit Gating + Reactor Dual-Prod ←── T3
T5: Lair/Hive Tech Progression ←── no deps
T6: Zerg Tech Buildings (Baneling Nest, Ultra Cavern, Lurker Den) ←── T5
T7: Unit-Specific Research System ←── T4, T6
T8: Detection System ←── no deps (but benefits from T14/T15)
T9: Elevation Combat Penalty ←── no deps
T10: Morph Mechanics (Baneling, Ravager, Lurker) ←── T6
T11: Medivac Transport + Boost ←── no deps
T12: Unit Ability Additions (BC Jump, Reaper Cliff) ←── no deps
T13: Vehicle/Ship Armor Upgrade ←── T3 (Armory)
T14: Missing Terran Units (Banshee, Liberator, Raven) ←── T3, T4, T8
T15: Missing Zerg Units (Overseer, Brood Lord, Swarm Host) ←── T5, T6, T8
T16: Polish Pass (autocast, building burning, mineral mix, stat fixes) ←── no deps
```

## Execution Order

| # | Task | Size | Depends on | Impact |
|---|------|------|-----------|--------|
| 1 | Stat & Behavior Fixes | S | — | HIGH (6 combat accuracy fixes) |
| 2 | Zerg Extractor Building | S | — | HIGH (unblocks Zerg gas) |
| 3 | Tech Gate Buildings | M | — | HIGH (Armory, Ghost Academy, Fusion Core) |
| 4 | TechLab Gating + Reactor Fix | M | 3 | HIGH (production accuracy) |
| 5 | Lair/Hive Tech Progression | M | — | HIGH (Zerg tech timing) |
| 6 | Zerg Tech Buildings | M | 5 | MED (Baneling Nest, Ultra Cavern, Lurker Den) |
| 7 | Unit-Specific Research | M | 4, 6 | MED (Stim research, Combat Shield, etc.) |
| 8 | Detection System | M | — | HIGH (counter to cloak/burrow) |
| 9 | Elevation Combat Penalty | S | — | MED (high-ground miss chance) |
| 10 | Morph Mechanics | M | 6 | MED (Baneling/Ravager/Lurker morph from base) |
| 11 | Medivac Transport + Boost | L | — | HIGH (core Terran mechanic) |
| 12 | Unit Ability Additions | M | — | MED (BC Jump, Reaper cliff) |
| 13 | Vehicle/Ship Armor Upgrade | S | 3 | MED (mech armor path) |
| 14 | Missing Terran Units | L | 3, 4, 8 | MED (Banshee, Liberator, Raven) |
| 15 | Missing Zerg Units | L | 5, 6, 8 | MED (Overseer, Brood Lord, Swarm Host) |
| 16 | Polish Pass | S | — | LOW (stat tweaks, autocast, building burn) |
| 17 | Zerg Instant Larva Morph (F1) | M | 2 | HIGH — Zerg production model is fundamentally wrong |
| 18 | Tank Auto-Acquire Fix (F2) | S | 1 | MED — siege tanks feel broken |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tech tree changes break AI build orders | HIGH | Task 1-6 must update AISystem build orders to match new requirements |
| Detection system makes cloaked units useless before detector units exist | MED | Ship Task 8 alongside Task 14/15 (Raven/Overseer) |
| Morph mechanics change unit costs/availability, breaking balance | MED | Keep direct-production as fallback until morph is tested |
| TechLab gating makes AI unable to produce advanced units | HIGH | Update AI to build TechLabs before advanced units |
| Multi-hit attack system changes DPS calculations across all combat | MED | Verify total DPS unchanged; only armor interaction changes |

---

## Task Specs

---

### Task 1: Stat & Behavior Fixes
**Parent:** SC2 Skirmish Audit
**Size:** S
**Depends on:** none
**Unblocks:** none (standalone quality fix)

#### Goal
Fix 8 verified combat inaccuracies that affect every single engagement. These are pure number/logic fixes with no architectural changes needed.

#### Changes (in execution order)

**Step 1: Siege Tank siege mode attack cooldown**
- File: `src/systems/AbilitySystem.ts` line 134-139
- Change: After setting `atkDamage`, `atkRange`, `atkSplash`, `bonusDmg` on siege transition, add `atkCooldown[eid] = 2.14` (2140ms in seconds). On pack-to-mobile (line 142-150), restore cooldown from UNIT_DEFS.
- Why: Siege Tank fires at 860ms in siege mode (mobile cooldown). Should be 2140ms. 2.5× too fast — breaks all TvZ engagement math.

**Step 2: Siege Tank minimum range**
- File: `src/ecs/components.ts` — add `export const atkMinRange = new Float32Array(MAX_ENTITIES);` (and reset in resetComponents)
- File: `src/systems/AbilitySystem.ts` — set `atkMinRange[eid] = 2 * TILE_SIZE` on siege, reset to 0 on mobile
- File: `src/systems/CombatSystem.ts` — in attack execution, after range check passes, add: `if (atkMinRange[eid] > 0 && distSq < atkMinRange[eid] * atkMinRange[eid]) { targetEntity[eid] = -1; continue; }`
- Why: Siege Tanks in SC2 cannot fire at targets within 2 tiles. Core positioning mechanic.

**Step 3: Multi-hit attack system**
- File: `src/ecs/components.ts` — add `export const atkHitCount = new Uint8Array(MAX_ENTITIES);` (default 1)
- File: `src/Game.ts` spawnUnitAt — set `atkHitCount[eid]` for: Reaper=2, Queen=2 (ground only special case already exists), Thor=4 (Javelin mode)
- File: `src/systems/CombatSystem.ts` — in damage application, loop `atkHitCount[eid]` times, applying `baseDmg / hitCount` per hit with armor subtracted each time
- Why: Reaper (4×2), Queen ground (4×2), Thor Javelin (6×4) — armor applies per-hit in SC2, not per-attack.

**Step 4: Fungal Growth root (not slow)**
- File: `src/systems/AbilitySystem.ts` — find Fungal Growth application, change `slowFactor[other] = 0.75` to `slowFactor[other] = 1.0` and duration from 3.0 to 2.85
- Why: SC2 LotV Fungal is a full root, not a 75% slow.

**Step 5: Widow Mine friendly fire**
- File: `src/systems/AbilitySystem.ts` — in Widow Mine sentinel missile splash loop, remove the `faction[other] === myFac` skip check
- Why: SC2 Widow Mine splash hits all units including friendlies. Core micro element.

**Step 6: Roach regen gated to burrowed**
- File: `src/systems/AbilitySystem.ts` — in Roach regen section, change idle regen condition from `gameTime - lastCombatTime[eid] > ROACH_COMBAT_TIMEOUT` to also require `burrowed[eid] === 1`
- Why: SC2 fast regen (7 HP/s) only while burrowed with Tunneling Claws. Currently too generous.

**Step 7: Snipe targeting fix**
- File: `src/systems/CommandSystem.ts` ~line 524 — remove the filter that excludes mechanical units from Snipe targeting
- Why: SC2 LotV Steady Targeting hits all unit types, not just biological.

**Step 8: Minor stat corrections**
- File: `src/data/units.ts` or relevant constant — Hellbat bonus vs Light: change +11 to +12. Cyclone: add `bonusDamage: 12, bonusVsTag: ArmorClass.Armored` to normal attack.

#### Edge cases
- Multi-hit: Queen has 2 different attack modes (ground 4×2, air 9×1). The existing special case in CombatSystem handles ground; just ensure hitCount applies correctly.
- Siege min range: If only target is inside min range, tank should hold fire (not switch to mobile mode automatically).
- Widow Mine friendly fire: AI should be made aware to not clump units near own mines (future AI improvement).

#### NOT in scope
- Snipe channel/interrupt mechanic (would need channeling state machine — defer)
- Thor Explosive Payload hit count (single hit splash is correct for that mode)

#### Acceptance criteria
- [ ] Siege Tank in siege mode fires every ~2.14s, not 0.86s
- [ ] Siege Tank in siege mode cannot hit targets within 2 tiles
- [ ] Reaper attack vs 3-armor target deals (4-3)×2 = 2 damage, not max(0.5, 8-3) = 5
- [ ] Fungal Growth immobilizes targets completely for 2.85s
- [ ] Widow Mine splash damages friendly units in radius
- [ ] Roach gets 7 HP/s regen only while burrowed
- [ ] Ghost Snipe can target mechanical units
- [ ] Existing tests still pass
- [ ] Type-check passes clean

#### Test plan
- Manual: Siege a tank, verify fire rate visually (~2s between shots)
- Manual: Move a Zergling adjacent to sieged tank, verify it doesn't get shot
- Manual: Attack a 3-armor unit with a Reaper, verify reduced damage
- `npm test` passes

#### Risk notes
- Multi-hit changes DPS vs armored targets for 3 unit types. Total unmitigated DPS stays the same (8 per cycle for Reaper, 8 per cycle for Queen ground, 24 per cycle for Thor Javelin), but effective DPS vs armor changes significantly.

---

### Task 2: Zerg Extractor Building
**Parent:** SC2 Skirmish Audit
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Add the Extractor building so player-as-Zerg can harvest vespene gas. Currently only Refinery exists (Terran-only). The AI already hacks around this by using Refinery for Zerg, but the player build menu has no gas building.

#### Changes (in execution order)

**Step 1: Add Extractor to BuildingType enum**
- File: `src/constants.ts`
- Change: Add `Extractor = 33` to BuildingType enum (slot 33 is unused between EvolutionChamber=32 and RoachWarren=34)

**Step 2: Add Extractor building definition**
- File: `src/data/buildings.ts`
- Change: Add `[BuildingType.Extractor]: { type: BuildingType.Extractor, name: 'Extractor', faction: Faction.Zerg, hp: 500, costMinerals: 25, costGas: 0, buildTime: 21, tileWidth: 2, tileHeight: 2, supplyProvided: 0, produces: [], color: 0x226644, requires: null }`
- Pattern: Same as Refinery definition but faction=Zerg, costMinerals=25 (SC2 value)

**Step 3: Add to Zerg build menu**
- File: `src/rendering/BuildMenuRenderer.ts`
- Change: In `ZERG_BUILDING_TYPES`, insert `BuildingType.Extractor` at position appropriate (after Hatchery/SpawningPool, probably index 2 or move SporeCrawler down)

**Step 4: Placement validation — treat Extractor like Refinery**
- File: `src/Game.ts` ~line 1239 — the gas geyser placement check currently checks `=== BuildingType.Refinery`. Change to `=== BuildingType.Refinery || === BuildingType.Extractor`
- File: `src/Game.ts` ~line 1280 — gas resource data storage on building entity, same check

**Step 5: Worker gathering — recognize Extractor as gas building**
- File: `src/systems/GatherSystem.ts` — search for `BuildingType.Refinery` checks and add `|| buildingType[b] === BuildingType.Extractor`

**Step 6: AI uses Extractor for Zerg**
- File: `src/systems/AISystem.ts` — in build order steps and building schedule, when `currentAIFaction === Faction.Zerg`, use `BuildingType.Extractor` instead of `BuildingType.Refinery`

**Step 7: Rendering**
- File: `src/rendering/UnitRenderer.ts` — add Extractor rendering case (can share Refinery visual with Zerg tint)
- File: `src/rendering/InfoPanelRenderer.ts` — add Extractor to building info display

#### Edge cases
- Extractor placement: must be on gas geyser, same as Refinery
- Zerg building on creep: Extractor, like Refinery, should NOT require creep (gas geysers are off-creep)

#### Acceptance criteria
- [ ] Player-as-Zerg can build Extractor on gas geyser via build menu
- [ ] Workers assigned to Extractor harvest gas correctly
- [ ] AI Zerg builds Extractor (not Refinery) when playing as Zerg
- [ ] Type-check passes clean

---

### Task 3: Tech Gate Buildings (Armory, Ghost Academy, Fusion Core)
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** none
**Unblocks:** Tasks 4, 13, 14

#### Goal
Add 3 missing Terran tech gate buildings that are required before certain units and upgrades can be produced. Without these, the tech tree is flat — BC from a naked Starport, Ghost from a naked Barracks.

#### Changes (in execution order)

**Step 1: Add BuildingType enum values**
- File: `src/constants.ts`
- Change: Add `Armory = 28`, `GhostAcademy = 29`, `FusionCore = 44` to BuildingType enum

**Step 2: Add building definitions**
- File: `src/data/buildings.ts`
- Armory: HP 750, cost 150M/100G, build time 46s, 2×2, requires Factory. Enables: Vehicle/Ship Armor upgrades, Thor, Hellbat
- Ghost Academy: HP 1250, cost 150M/50G, build time 29s, 2×2, requires Barracks. Enables: Ghost, Nuke (future)
- Fusion Core: HP 850, cost 150M/150G, build time 46s, 2×2, requires Starport. Enables: Battlecruiser, Yamato Cannon research (future)

**Step 3: Update tech requirements**
- File: `src/data/buildings.ts` — no building requires these yet (they ARE requirements for units)
- File: Logic in `InfoPanelRenderer.ts` and `BuildMenuRenderer.ts` — add tech gating display
- File: `ProductionSystem.ts` or `CommandSystem.ts` — add prerequisite checks: Ghost requires Ghost Academy, Thor requires Armory, BC requires Fusion Core

**Step 4: Add to Terran build menu**
- File: `src/rendering/BuildMenuRenderer.ts` — expand TERRAN_BUILDING_TYPES. May need more than 9 slots (currently 9). Options: second page, or replace unused slot.

**Step 5: AI builds these**
- File: `src/systems/AISystem.ts` — add Armory, Ghost Academy, Fusion Core to building schedule for Terran AI

**Step 6: Rendering**
- File: `src/rendering/UnitRenderer.ts` — add building rendering (simple rectangles matching faction style)

#### Acceptance criteria
- [ ] Armory, Ghost Academy, Fusion Core buildable by Terran player
- [ ] Ghost unbuildable without Ghost Academy
- [ ] Thor unbuildable without Armory
- [ ] Battlecruiser unbuildable without Fusion Core
- [ ] AI Terran builds required tech buildings before advanced units
- [ ] Existing tests pass

---

### Task 4: TechLab Unit Gating + Reactor Dual Production
**Parent:** SC2 Skirmish Audit (Backlog #98 refinement)
**Size:** M
**Depends on:** Task 3
**Unblocks:** Task 7, 14

#### Goal
Fix the two addon mechanics: (1) TechLab must be present to produce advanced units; (2) Reactor produces 2 units simultaneously (not 2× speed).

#### Changes

**Step 1: TechLab unit gating**
- File: `src/systems/ProductionSystem.ts` — before starting production, check if unit requires TechLab. Define a set: `TECHLAB_UNITS = new Set([Marauder, Ghost, Reaper(?), SiegeTank, Thor, Cyclone, WidowMine(?), Battlecruiser, Viking(?)])`. If unit is in set and building's `addonType[eid] !== AddonType.TechLab`, reject production.
- File: `src/rendering/InfoPanelRenderer.ts` — show "Requires TechLab" on locked production buttons

**Step 2: Reactor dual production**
- File: `src/ecs/components.ts` — add `prodSlot2UnitType`, `prodSlot2Progress`, `prodSlot2TimeTotal` arrays for the second simultaneous production slot
- File: `src/systems/ProductionSystem.ts` — when building has `addonType === Reactor`, run a second production slot in parallel. Both slots dequeue from the same prodQueue independently. Remove the current "2× speed" hack.
- Reactor-eligible units only (basic units: Marine, Hellion, Medivac, Viking, etc.)

**Step 3: UI for dual production**
- File: `src/rendering/InfoPanelRenderer.ts` — show two progress bars when Reactor is producing

**Step 4: AI addon building**
- File: `src/systems/AISystem.ts` — ensure AI builds TechLab on first Barracks (for Marauder), Reactor on second

#### Acceptance criteria
- [ ] Marauder cannot be produced from Barracks without TechLab
- [ ] Reactor Barracks can produce 2 Marines simultaneously
- [ ] Reactor does NOT speed up production (each unit takes normal time)
- [ ] AI correctly builds addons

---

### Task 5: Lair/Hive Tech Progression
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** none
**Unblocks:** Tasks 6, 15

#### Goal
Add Lair and Hive as upgrade-in-place buildings from Hatchery. These gate mid/lategame Zerg tech — without them, all Zerg buildings are available immediately, removing tech timing pressure.

#### Changes

**Step 1: Add Lair and Hive to BuildingType**
- File: `src/constants.ts` — add `Lair = 41`, `Hive = 42` (or appropriate free slots)

**Step 2: Building definitions**
- File: `src/data/buildings.ts`
- Lair: upgrade from Hatchery, 150M/100G, 57s. HP 1800. Requires Spawning Pool. Keeps all Hatchery functionality (larva, production).
- Hive: upgrade from Lair, 200M/150G, 71s. HP 2500. Requires Infestation Pit.

**Step 3: Upgrade-in-place mechanic**
- File: `src/systems/ProductionSystem.ts` or `src/systems/BuildSystem.ts` — add building upgrade command that transforms Hatchery→Lair→Hive. During upgrade: building still produces units but cannot upgrade again. On completion: change buildingType, increase HP.

**Step 4: Update tech requirements**
- Hydralisk Den requires Lair
- Spire requires Lair
- Infestation Pit requires Lair
- Ultralisk Cavern (Task 6) requires Hive
- Lurker Den (Task 6) requires Lair + Hydralisk Den

**Step 5: UI — upgrade button on Hatchery**
- File: `src/rendering/InfoPanelRenderer.ts` — when Hatchery selected and Spawning Pool exists, show "Upgrade to Lair" button. When Lair selected and Infestation Pit exists, show "Upgrade to Hive."

**Step 6: AI Lair/Hive timing**
- File: `src/systems/AISystem.ts` — add Lair upgrade to build orders around 3-4 min mark. Hive at 8-10 min.

#### Acceptance criteria
- [ ] Hatchery upgradeable to Lair (requires Spawning Pool)
- [ ] Lair upgradeable to Hive (requires Infestation Pit)
- [ ] Hydralisk Den, Spire require Lair
- [ ] Hatchery continues producing during upgrade
- [ ] AI upgrades tech appropriately

---

### Task 6: Zerg Tech Buildings (Baneling Nest, Ultralisk Cavern, Lurker Den)
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** Task 5 (Lair/Hive)
**Unblocks:** Tasks 7, 10, 15

#### Goal
Add 3 missing Zerg tech gate buildings that are required before morph units can be produced. Currently Banelings, Ultralisks, and Lurkers have no tech requirements.

#### Changes

**Step 1: Add BuildingType values**
- `BanelingNest = 43`, `UltraliskCavern = 45`, `LurkerDen = 46`

**Step 2: Building definitions**
- Baneling Nest: HP 850, 50M/50G, 43s, 2×2, requires Spawning Pool
- Ultralisk Cavern: HP 850, 150M/200G, 46s, 2×2, requires Hive
- Lurker Den: HP 850, 100M/150G, 57s, 2×2, requires Lair + Hydralisk Den

**Step 3: Update production requirements**
- Baneling morph (or production) requires Baneling Nest
- Ultralisk requires Ultralisk Cavern
- Lurker morph requires Lurker Den

**Step 4: Add to Zerg build menu**
- Expand menu slots or add second page

**Step 5: AI building schedule**
- Add to AI build orders at appropriate timings

#### Acceptance criteria
- [ ] Baneling Nest buildable, required for Baneling production
- [ ] Ultralisk Cavern buildable (requires Hive), required for Ultralisk
- [ ] Lurker Den buildable (requires Lair), required for Lurker
- [ ] AI builds these at correct times

---

### Task 7: Unit-Specific Research System
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** Tasks 4, 6
**Unblocks:** none

#### Goal
Add research requirements for unit abilities and stat buffs that are currently available for free. In SC2, Stim must be researched at a Tech Lab, Combat Shield at a Tech Lab, etc.

#### Changes

**Step 1: Research registry**
- File: `src/constants.ts` — add ResearchType enum with: StimPack, CombatShield, ConcussiveShells, SiegeTech, InfernalPreIgniter, MetabolicBoost, AdrenalGlands, GroovedSpines, MuscularAugments, ChitinousPlating, TunnelingClaws, CentrifugalHooks, GlialReconstitution
- File: `src/types.ts` — add `researched: Uint8Array` (bitmask or boolean array) to PlayerResources

**Step 2: Research at buildings**
- StimPack: Barracks TechLab, 100M/100G, 100s
- CombatShield: Barracks TechLab, 100M/100G, 79s (+10 Marine HP)
- ConcussiveShells: Barracks TechLab, 50M/50G, 36s
- MetabolicBoost: Spawning Pool, 100M/100G, 79s (+0.87 Zergling speed)
- AdrenalGlands: Spawning Pool (requires Hive), 200M/200G, 93s (+18% Zergling attack speed)
- GroovedSpines: Hydralisk Den, 100M/100G, 57s (+1 Hydra range)
- MuscularAugments: Hydralisk Den, 100M/100G, 57s (+0.5 Hydra speed)

**Step 3: Gate abilities behind research**
- Stim Pack: check `researched[StimPack]` before allowing Stim command
- Concussive Shells: check before applying slow in CombatSystem
- Siege Tech: already works, but should require research (at Factory TechLab)

**Step 4: Apply stat buffs on research completion**
- Combat Shield: +10 to hpMax/hpCurrent for all existing and future Marines
- Metabolic Boost: +0.87 speed to all Zerglings
- etc.

**Step 5: UI — research buttons at tech buildings**
- Extend existing UpgradeSystem pattern to handle unit-specific research

**Step 6: AI researches upgrades**
- Add to AI build order profiles at appropriate timings

#### Acceptance criteria
- [ ] Stim Pack does not work until researched
- [ ] Marines have 45 HP until Combat Shield researched (then 55)
- [ ] Zerglings speed increases after Metabolic Boost
- [ ] Research buttons visible on appropriate buildings
- [ ] AI researches key upgrades

---

### Task 8: Detection System
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** none (but most valuable after Task 14/15 add detector units)
**Unblocks:** Tasks 14, 15

#### Goal
Implement detection so cloaked/burrowed units have a counter. Currently they are permanently invisible to auto-targeting with zero counterplay.

#### Changes

**Step 1: Detector component**
- File: `src/ecs/components.ts` — add `isDetector: Uint8Array`, `detectionRange: Float32Array`

**Step 2: Mark detector buildings**
- Missile Turret: detector, range 11
- Spore Crawler: detector, range 11
- (Future: Raven, Overseer will also be detectors)

**Step 3: Detection system**
- File: `src/systems/FogSystem.ts` or new `DetectionSystem.ts` — each tick, for each detector entity, mark cloaked/burrowed enemies within detection range as "revealed." Add `revealed: Uint8Array` component that is set per-tick.

**Step 4: Update auto-targeting**
- File: `src/ecs/queries.ts` line 374 — change `if (cloaked[other] === 1) continue;` to `if ((cloaked[other] === 1 || burrowed[other] === 1) && revealed[other] === 0) continue;`

**Step 5: Visual indicator**
- File: `src/rendering/UnitRenderer.ts` — show detection shimmer/outline on revealed cloaked units

**Step 6: Scanner Sweep (Orbital Command preview)**
- If Orbital Command exists (backlog #97), Scanner Sweep reveals area for 12s. Otherwise, defer.

#### Acceptance criteria
- [ ] Cloaked Ghost near Missile Turret can be auto-targeted
- [ ] Burrowed Roach near Spore Crawler can be auto-targeted
- [ ] Cloaked Ghost far from any detector cannot be auto-targeted
- [ ] Visual indicator shows detection state

---

### Task 9: Elevation Combat Penalty
**Parent:** SC2 Skirmish Audit
**Size:** S
**Depends on:** none

#### Goal
Add ~30% miss chance when attacking from low ground to high ground. Elevation data already exists in MapData.

#### Changes

**Step 1: Miss chance in CombatSystem**
- File: `src/systems/CombatSystem.ts` — before damage application, check attacker elevation vs target elevation. If attacker is on low ground (elevation 0) and target is on high ground (elevation 1) and attacker does not have vision of high ground, apply 30% miss chance (RNG roll, skip damage on miss).
- Use `map.elevation[tile]` to check elevation at entity positions.

**Step 2: Visual "MISS" indicator**
- File: `src/rendering/UnitRenderer.ts` — on miss, show floating "MISS" text (similar to damage numbers)

#### Acceptance criteria
- [ ] Units on low ground miss ~30% of attacks against high ground targets
- [ ] No miss penalty on same elevation or high-to-low
- [ ] "MISS" text appears on missed attacks

---

### Task 10: Morph Mechanics
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** Task 6 (Zerg tech buildings)
**Unblocks:** none

#### Goal
Implement unit morphing: Baneling from Zergling, Ravager from Roach, Lurker from Hydralisk. Currently these are produced directly from Hatchery, which is incorrect.

#### Changes

**Step 1: Morph command type**
- File: `src/input/CommandQueue.ts` — add `CommandType.Morph`
- File: `src/systems/CommandSystem.ts` — handle morph: consume source unit, begin morph timer, spawn target unit on completion

**Step 2: Morph data**
- Baneling: from Zergling, 25M/25G, 14s, requires Baneling Nest
- Ravager: from Roach, 25M/75G, 9s, requires Roach Warren
- Lurker: from Hydralisk, 50M/100G, 18s, requires Lurker Den

**Step 3: Morph state**
- During morph: unit is immobile, shown as cocoon, vulnerable. On completion: remove source entity, spawn target entity at same position.

**Step 4: UI — morph button on unit**
- When Zergling selected and Baneling Nest exists, show "Morph to Baneling" ability button
- Same for Roach→Ravager, Hydralisk→Lurker

**Step 5: Remove direct production**
- Remove Baneling, Ravager, Lurker from Hatchery's `produces[]` array

**Step 6: AI morph logic**
- Update AI to select appropriate source units and issue morph commands

#### Acceptance criteria
- [ ] Zergling can morph to Baneling (consumes Zergling, spawns Baneling)
- [ ] Baneling, Ravager, Lurker no longer directly produced from Hatchery
- [ ] Morph has cocoon state (immobile, vulnerable)
- [ ] AI correctly morphs units

---

### Task 11: Medivac Transport + Boost
**Parent:** SC2 Skirmish Audit
**Size:** L
**Depends on:** none
**Unblocks:** none

#### Goal
Implement Medivac as a transport: load/unload biological units, cargo display, drop micro. Also add Medivac Afterburner boost. Drops are the most practiced Terran mechanic at all skill levels.

#### Changes

**Step 1: Cargo component**
- File: `src/ecs/components.ts` — add cargo system: `cargoCapacity: Uint8Array` (Medivac=8), `cargoCount: Uint8Array`, `cargoUnits: Array<Int16Array>` (array of loaded entity IDs per transport), `loadedInto: Int16Array` (which transport this unit is loaded into, -1 = none)

**Step 2: Load command**
- Select Medivac, right-click on friendly bio unit → load. Or select unit, right-click on Medivac → load.
- Loaded units removed from map but kept alive. Set `loadedInto[eid] = medivacEid`.

**Step 3: Unload command**
- D hotkey or click unload button → unload all at Medivac position
- Right-click ground with Medivac selected and units loaded → move to position, then unload

**Step 4: Cargo display in UI**
- File: `src/rendering/InfoPanelRenderer.ts` — show cargo contents when Medivac selected

**Step 5: Loaded unit dies if transport dies**
- In DeathSystem, when transport dies, kill all loaded units

**Step 6: Medivac Boost**
- Ability: 50% speed boost for 5.71s, 14s cooldown. Hotkey: B.
- File: `src/systems/AbilitySystem.ts` — implement boost as temporary speed multiplier

#### Acceptance criteria
- [ ] Can load Marines into Medivac (up to 8)
- [ ] Loaded units invisible on map, visible in cargo UI
- [ ] Unload drops units at Medivac position
- [ ] Loaded units die when Medivac dies
- [ ] Boost ability gives ~50% speed for ~5.7s
- [ ] AI can execute drop tactics

---

### Task 12: Unit Ability Additions (BC Jump, Reaper Cliff)
**Parent:** SC2 Skirmish Audit
**Size:** M
**Depends on:** none

#### Goal
Add 2 missing signature abilities: Battlecruiser Tactical Jump and Reaper cliff jumping.

#### Changes

**Step 1: BC Tactical Jump**
- Targeted ability: click any visible point on map → BC teleports there after 1s channel
- Cost: 0 energy, 71s cooldown
- During channel: BC is immobile, vulnerable
- File: `src/systems/CommandSystem.ts` — add TacticalJump command
- File: `src/systems/AbilitySystem.ts` — handle channel + teleport

**Step 2: Reaper Cliff Jump**
- File: `src/map/Pathfinder.ts` — for Reaper units, allow pathing across cliff tiles (elevation transitions). Pathfinder needs a flag or callback that says "this unit can traverse cliffs."
- Visual: Reaper arc/jump animation when crossing elevation boundary

#### Acceptance criteria
- [ ] BC can teleport to any map location with 71s cooldown
- [ ] Reaper can path across cliffs/elevation changes
- [ ] Other units cannot path across cliffs

---

### Task 13: Vehicle/Ship Armor Upgrade
**Parent:** SC2 Skirmish Audit
**Size:** S
**Depends on:** Task 3 (Armory)

#### Goal
Add Vehicle/Ship Armor as a 7th upgrade type, researchable at the Armory. Currently mech units have no armor upgrade path.

#### Changes

**Step 1: Add UpgradeType.VehicleArmor**
- File: `src/constants.ts` — add to UpgradeType enum, update COUNT to 7

**Step 2: Research at Armory**
- File: `src/systems/UpgradeSystem.ts` — add Armory as research building for VehicleWeapons and VehicleArmor

**Step 3: Apply in damage formula**
- File: `src/systems/CombatSystem.ts` — check VehicleArmor upgrade level for mech units (Hellion, SiegeTank, WidowMine, Cyclone, Thor, BC, Viking)

#### Acceptance criteria
- [ ] VehicleArmor researchable at Armory (3 levels)
- [ ] Mech units gain +1 armor per level
- [ ] Existing upgrade system still works

---

### Task 14: Missing Terran Units (Banshee, Liberator, Raven)
**Parent:** SC2 Skirmish Audit
**Size:** L
**Depends on:** Tasks 3, 4, 8

#### Goal
Add 3 important Terran units. Raven is critical (only Terran mobile detector). Banshee enables cloaked harassment. Liberator defines TvZ lategame.

#### Changes

**Step 1: Banshee**
- Stats: 140 HP, 12 dmg (+12 vs Light), range 6, speed 3.85, 2 supply. Air unit, targets ground only.
- Ability: Cloak (same system as Ghost). Requires Starport + TechLab.
- Cost: 150M/100G, 43s build time.

**Step 2: Liberator**
- Stats: 180 HP, 5×2 dmg (air mode, targets air), speed 4.72, 3 supply. Air unit.
- Ability: Defender Mode — siege mode that targets ground, 5+3 range, single target, massive damage (75). Cannot move while sieged.
- Requires: Starport + TechLab.
- Cost: 150M/150G, 43s.

**Step 3: Raven**
- Stats: 140 HP, 0 dmg, speed 3.85, 2 supply. Air unit, detector (range 11).
- Ability: Interference Matrix — disables target unit abilities for 8s. Anti-Armor Missile — -3 armor debuff in AoE.
- Requires: Starport + TechLab.
- Cost: 100M/200G, 43s.

**Step 4: Add to data, constants, rendering, AI**

#### Acceptance criteria
- [ ] All 3 units buildable from Starport with TechLab
- [ ] Raven detects cloaked/burrowed units
- [ ] Banshee can cloak
- [ ] Liberator can siege (Defender Mode)

---

### Task 15: Missing Zerg Units (Overseer, Brood Lord, Swarm Host)
**Parent:** SC2 Skirmish Audit
**Size:** L
**Depends on:** Tasks 5, 6, 8

#### Goal
Add 3 important Zerg units. Overseer is critical (only Zerg detector). Brood Lord defines lategame siege.

#### Changes

**Step 1: Overseer** (morph from Overlord)
- Stats: 200 HP, 0 dmg, speed 2.62, detector range 11. Air unit.
- Ability: Contaminate — disables building production for 17s.
- Morph: Overlord → Overseer, 50M/50G, 12s. Requires Lair.

**Step 2: Brood Lord** (morph from Corruptor)
- Stats: 225 HP, 20 dmg, range 9.5, speed 1.97, 4 supply. Air unit, targets ground only.
- Spawns 2 Broodlings on attack (short-lived ground melee units).
- Requires: Greater Spire (Spire upgrade, requires Hive).

**Step 3: Swarm Host**
- Stats: 160 HP, 0 direct dmg, speed 3.15, 3 supply. Ground unit.
- Ability: Spawn Locusts — creates 2 timed-life flying/ground attack units every 43s.
- Requires: Infestation Pit.
- Cost: 100M/75G, 29s.

#### Acceptance criteria
- [ ] Overseer morphable from Overlord, detects cloaked units
- [ ] Brood Lord morphable from Corruptor with Greater Spire
- [ ] Swarm Host spawns Locusts periodically

---

### Task 16: Polish Pass
**Parent:** SC2 Skirmish Audit
**Size:** S
**Depends on:** none (can be done anytime)

#### Goal
Bundle of small polish fixes that each take minutes but collectively improve SC2 authenticity.

#### Changes
1. **Mineral patch variety**: Vary initial amounts — 4 patches at 1800, 4 at 1500 per base (update map generation)
2. **Terran building burn**: Buildings below 33% HP lose 2 HP/s until repaired or destroyed (DeathSystem or AbilitySystem)
3. **Veterancy toggle**: Add option to disable veterancy system in skirmish settings (or disable by default)
4. **Autocast toggle**: Add autocast flag for Medivac heal, SCV repair (visual indicator on ability button)
5. **Spine/Spore Crawler uprooting**: Allow Spine/Spore to uproot on creep, move slowly, re-root

#### Acceptance criteria
- [ ] Mineral patches have mixed 1800/1500 amounts
- [ ] Terran buildings burn below 33% HP
- [ ] Veterancy can be toggled off

---

## Cross-Cutting Concerns

### Build Menu Expansion
Multiple tasks add buildings (Tasks 2, 3, 5, 6). The current build menu has 9 fixed slots per faction. With new buildings:
- Terran needs: CC, Supply, Barracks, Refinery, Factory, Starport, EngBay, Armory, Ghost Academy, Fusion Core, Missile Turret, Sensor Tower = 12 buildings
- Zerg needs: Hatchery, Extractor, Spawning Pool, Baneling Nest, Roach Warren, Hydralisk Den, Lurker Den, Spire, Evo Chamber, Infestation Pit, Ultralisk Cavern, Spine, Spore = 13 buildings

**Solution:** Either implement a paginated build menu (Tab to switch pages) or a scrollable grid. This is a prerequisite for Tasks 3+5+6 and should be handled as part of Task 3.

### AI Build Order Updates
Tasks 2-7 all change what's required before units can be built. Each task must update AISystem build orders to build required tech buildings before attempting unit production. The AI currently hacks around missing requirements — each task should fix the AI for that specific requirement.

### New Component Additions
Tasks 1, 8, 11 add new ECS components. All must:
- Add to `components.ts` with appropriate TypedArray type
- Add reset in `resetComponents()`
- Not exceed 32 component bits (currently at 13, so plenty of room — new data arrays don't need bits unless they define a new entity archetype)

---

## Architecture Model (Snapshot)

### System Execution Order (per tick)
1. spatialHash.rebuild → 2. commandSystem → 3. buildSystem → 4. productionSystem → 5. upgradeSystem → 6. movementSystem → 7. fogSystem → 8. combatSystem → 9. abilitySystem → 10. gatherSystem → 11. deathSystem → 12. aiSystem → 13. creepSystem

### Key Extension Points
- **New unit**: Add to UnitType enum → UNIT_DEFS → spawnUnitAt → UnitRenderer → InfoPanelRenderer → PortraitRenderer
- **New building**: Add to BuildingType enum → BUILDING_DEFS → build menu → UnitRenderer → InfoPanelRenderer → AI building schedule
- **New ability**: Add command type → CommandSystem handler → AbilitySystem tick logic → InputProcessor hotkey → InfoPanelRenderer button
- **New upgrade**: Add to UpgradeType enum → UPGRADE_COSTS → UpgradeSystem → CombatSystem damage formula

### Component Budget
13/32 component bits used. New parallel arrays (like atkMinRange, atkHitCount, isDetector) do NOT consume bits — they're just additional data on existing archetypes.

### Entity Budget
MAX_ENTITIES = 4096. Typical skirmish: ~200-400 entities at peak. Plenty of headroom for new unit types.
