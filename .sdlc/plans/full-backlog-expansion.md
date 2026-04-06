---
scope: RTS.io Multiplayer Arena — Full Implementation Plan
created: 2026-04-06
backlog_items: rts.io pivot phases 2-5
task_count: 17
status: READY
target_repo: D-ungvari/rts.io
---

## Ultraplan: RTS.io Multiplayer Arena — Complete Implementation

### Vision Alignment
Swarm Command's engine forks into **rts.io** — a browser-based multiplayer .io battle arena with original IP. 4 launch factions (Iron Legion, The Swarm, Arcane Covenant, Automata), ~8 units each, node-based economy, 8-16 player FFA/team matches, permanent elimination. The rts.io fork has completed the foundation: headless Simulation, WebSocket server skeleton, faction data definitions, arena map generator, hex-grid capture zones, and SC2 content stripping. The game is in a **stripped-but-not-rebuilt** state — systems are hollowed out and need to be rebuilt for the new factions and economy model.

### What's Already Done (rts.io fork)
| Phase | Status | Key Deliverables |
|-------|--------|-----------------|
| Phase 0: Extract Simulation | DONE | `src/simulation/Simulation.ts` (314 lines), `Game.ts` refactored |
| Phase 1: WebSocket Server | DONE | `server/GameServer.ts`, `server/GameRoom.ts`, `server/NetProtocol.ts` |
| Phase 1.5: Faction Data | DONE | `src/data/factions.ts`, `src/data/arena-units.ts`, `src/data/arena-buildings.ts` |
| Phase 2: Arena Foundation | PARTIAL | `NodeEconomy.ts`, `MatchManager.ts`, `ArenaMap.ts`, `HexGrid.ts` + 325 tests |
| SC2 Stripping | DONE | AISystem deleted, GatherSystem deleted, scenarios/replay deleted, all systems stripped |
| System Rebuild | NOT STARTED | AbilitySystem, CombatSystem, CommandSystem, ProductionSystem all stripped to stubs |

### What Remains (this plan)
The game needs to go from "stripped engine with data files" to "playable multiplayer .io arena." This plan covers:
1. **Rebuild core systems** for new factions (abilities, combat, production, upgrades)
2. **Faction rendering** — new visual identities for 4 factions
3. **Node economy integration** — wire extractors/income into game loop
4. **Client-server networking** — make multiplayer actually work
5. **Match gameplay** — join, play, eliminate, score, win
6. **Polish** — interpolation, UI, kill feed

### Scope Summary
- **Tasks generated:** 17
- **Estimated total size:** 3M + 8L + 6XL
- **Critical path:** T1 → T2 → T3 → T4 → T5 → T6 → T7 (single-player playable) → T8 → T9 (networked) → T10 → T11 (match gameplay)
- **New patterns needed:** Data-driven ability system, node economy (no workers), client interpolation, server-authoritative state, per-player fog culling
- **Target repo:** D-ungvari/rts.io (main branch)

### Dependency Graph
```
PHASE A: Rebuild Core (local playability)
T1 (Data-driven abilities) ──┐
T2 (Combat rework) ──────────┤
T3 (Production + economy) ───┤──→ T7 (Arena gameplay integration)
T4 (Upgrade system) ─────────┤
T5 (Faction rendering) ──────┤
T6 (UI rebuild) ─────────────┘

PHASE B: Networking
T7 ──→ T8 (Client-server wiring) ──→ T9 (Interpolation + fog)

PHASE C: Match & Multiplayer
T8 ──→ T10 (Match lifecycle)
T8 ──→ T11 (Multi-player spawning)
T10 ──→ T12 (Elimination + scoring)

PHASE D: Faction Depth
T7 ──→ T13 (Iron Legion abilities)
T7 ──→ T14 (Swarm faction abilities)
T7 ──→ T15 (Arcane Covenant abilities)
T7 ──→ T16 (Automata abilities)

PHASE E: Polish
T12 ──→ T17 (Kill feed, leaderboard, announcements)
```

### Execution Order
| # | Task | Size | Depends on | Phase |
|---|------|------|-----------|-------|
| 1 | Data-driven ability framework | L | -- | A |
| 2 | Combat system rework — generic armor/damage | L | -- | A |
| 3 | Production + node economy wiring | L | -- | A |
| 4 | Upgrade system — per-faction upgrade trees | M | -- | A |
| 5 | Faction unit + building rendering (4 factions) | XL | -- | A |
| 6 | UI rebuild — build menu, info panel, HUD for arena | L | -- | A |
| 7 | Arena gameplay integration — wire everything, playable locally | XL | T1-T6 | A |
| 8 | Client-server wiring — commands over WebSocket, snapshot rendering | XL | T7 | B |
| 9 | Client interpolation + per-player fog culling | L | T8 | B |
| 10 | Match lifecycle — lobby, countdown, play, victory | L | T8 | C |
| 11 | Multi-player spawning + faction selection | M | T8 | C |
| 12 | Elimination mechanics + scoring + kill bounties | L | T10 | C |
| 13 | Iron Legion abilities — Medic heal, Stim, Siege, Transport | L | T7 | D |
| 14 | Swarm abilities — Broodmother spawns, Burrower ambush, Ravager bile | L | T7 | D |
| 15 | Arcane Covenant abilities — Shield regen, Blink, Storm, Force Field | L | T7 | D |
| 16 | Automata abilities — Self-repair, Wreckage reclaim, EMP, Anchor mode | L | T7 | D |
| 17 | Kill feed, leaderboard, announcements, HUD polish | M | T12 | E |

### Risk Register
| Risk | Impact | Mitigation |
|------|--------|------------|
| Systems stripped too aggressively — lost patterns needed for rebuild | HIGH | Cross-reference swarm-command master branch for patterns |
| Data-driven abilities may not cover all faction mechanics | MED | Allow escape-hatch per-faction hooks alongside data-driven defs |
| Server at 20Hz may feel sluggish for combat-heavy RTS | MED | Interpolation in T9; can increase to 30Hz if needed |
| 4 factions × 8 units = 32 unique renderings | HIGH (art bottleneck) | Use procedural geometric shapes (existing Carbot-style), faction palette differentiation |
| Node economy balance untested | MED | Start with simple flat income, tune after playtesting |
| ComponentStore refactor may break imports | HIGH | Use setActiveStore() swap pattern first, avoid rewriting every import |

---

## Task Specs

---

### Task 1: Data-Driven Ability Framework
**Parent:** Pivot Phase 1.5 — ability rework
**Size:** L
**Depends on:** none
**Unblocks:** T7, T13-T16

#### Goal
Replace the hardcoded SC2 ability system with a data-driven framework. Each ability is defined as an `AbilityDef` object. The AbilitySystem reads these defs and applies effects generically — no per-unit-type switch statements. This enables adding faction abilities by adding data, not code.

#### Prerequisites
- AbilitySystem.ts is currently stripped to a stub (SC2 abilities removed)
- arena-units.ts defines units but doesn't specify abilities yet
- The component arrays for ability state (energy, cooldowns) still exist in components.ts

#### Changes

**Step 1: Define AbilityDef type**
- File: src/types.ts
- Add:
```typescript
interface AbilityDef {
  id: number;
  name: string;
  type: 'self_buff' | 'targeted' | 'aoe' | 'toggle' | 'passive' | 'summon';
  energyCost: number;
  hpCost: number;
  cooldown: number;         // seconds
  range: number;            // tiles (0 = self only)
  radius: number;           // tiles (0 = single target)
  duration: number;         // seconds (0 = instant)
  effect: 'speed_mult' | 'damage_buff' | 'heal' | 'damage' | 'stun' | 'slow'
        | 'cloak' | 'transform' | 'shield' | 'pull' | 'root' | 'spawn';
  effectValue: number;      // multiplier or flat value
  effectTarget: 'self' | 'target' | 'aoe_enemies' | 'aoe_allies' | 'aoe_all';
  requiresResearch?: number; // UpgradeType that must be completed
}
```

**Step 2: Define UNIT_ABILITIES mapping**
- File: src/data/abilities.ts (NEW)
- Map each unit type to its available abilities:
```typescript
export const UNIT_ABILITIES: Record<number, AbilityDef[]> = {
  [UnitType.Trooper]: [STIM_PACK],
  [UnitType.Medic]: [HEAL_AURA],
  [UnitType.SiegeTank]: [SIEGE_MODE],
  // ... all 4 factions
};
```
- Define ~16-20 ability defs across 4 factions (3-5 per faction)

**Step 3: Add ability component arrays**
- File: src/ecs/components.ts
- Ensure these arrays exist (some may survive the strip):
  - `ability1CooldownEnd: Float32Array` — cooldown for ability slot 1
  - `ability2CooldownEnd: Float32Array` — cooldown for ability slot 2
  - `abilityActiveEndTime: Float32Array` — duration of active buff/debuff
  - `abilityActiveType: Uint8Array` — which ability is currently active

**Step 4: Rebuild AbilitySystem as data-driven processor**
- File: src/systems/AbilitySystem.ts
- Generic tick loop:
  1. For each entity with ABILITY component:
     - Check abilityActiveEndTime: if expired, remove effect (restore speed, damage, etc.)
     - Energy regen (for caster units)
  2. No per-unit-type logic — effects are applied/removed based on AbilityDef.effect field

**Step 5: Ability execution in CommandSystem**
- File: src/systems/CommandSystem.ts
- Generic ability command handler:
  - Look up AbilityDef from UNIT_ABILITIES[unitType][abilityIndex]
  - Validate: energy/HP cost, cooldown, range, target validity
  - Apply: deduct cost, set cooldown, execute effect based on AbilityDef.type
  - self_buff: modify caster's components
  - targeted: modify target's components
  - aoe: iterate entities within radius, apply effect
  - toggle: swap mode flag
  - summon: spawn unit at location

**Step 6: Ability hotkeys**
- File: src/input/InputProcessor.ts
- Q = ability 1, W = ability 2, E = ability 3 (generic slots, not per-unit hardcoded)
- Ability mode (targeted/aoe): enter placement mode, click to cast

#### Edge cases
- Unit with no abilities: UNIT_ABILITIES entry is empty array — skip
- Passive abilities (like self-repair): type='passive', processed every tick without command
- Transform toggle (Siege Mode): toggle between two stat sets stored in AbilityDef
- AoE friendly fire: determined by effectTarget ('aoe_enemies' vs 'aoe_all')

#### NOT in scope
- Specific faction ability implementations (Tasks 13-16)
- Visual effects for abilities (handled per-faction in T13-T16)

#### Acceptance criteria
- [ ] AbilityDef type defined with all fields
- [ ] UNIT_ABILITIES mapping created for all 4 factions (placeholder defs OK)
- [ ] AbilitySystem processes active buffs/debuffs generically
- [ ] CommandSystem executes abilities from data defs (no unit-type switches)
- [ ] Energy regen works for caster units
- [ ] Cooldowns enforced per ability slot
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Unit test: Ability execution with mock AbilityDef, cooldown enforcement, energy deduction
- Type-check: `npm run build`
- Verify: `npm test`

---

### Task 2: Combat System Rework — Generic Armor & Damage
**Parent:** Pivot — combat rework
**Size:** L
**Depends on:** none
**Unblocks:** T7

#### Goal
Rebuild CombatSystem for generic faction combat. Replace SC2-specific armor classes with generic tags (Light, Heavy, Armored, Organic, Mechanical, Massive, Flying). Keep the proven damage calculation, splash, overkill prevention. Remove all unit-type-specific combat behaviors (Mutalisk bounce, Queen dual-attack, Thor modes, etc.).

#### Prerequisites
- CombatSystem.ts is stripped of SC2 specifics but core structure remains
- arena-units.ts defines new unit stats
- Armor class component exists (armorClass Uint8, bonusDmg Float32, bonusVsTag Int8)

#### Changes

**Step 1: Define generic armor tags**
- File: src/constants.ts
- Replace ArmorClass enum:
```typescript
enum ArmorTag {
  Light = 0, Heavy = 1, Armored = 2,
  Organic = 3, Mechanical = 4, Massive = 5
}
```
- Units can have multiple tags (use bitfield: `armorTags: Uint8Array`)

**Step 2: Update unit data with armor tags**
- File: src/data/arena-units.ts
- Each unit gets `armorTags: number` (bitfield of ArmorTag values)
- Each unit gets `bonusDamage: number` and `bonusVsTag: ArmorTag` (single bonus, like SC2)
- Example: Iron Legion Trooper: armorTags = Light|Organic, bonusVsTag = -1 (none)
- Example: Iron Legion Siege Tank: armorTags = Heavy|Armored|Mechanical, bonusDamage = 10, bonusVsTag = Armored

**Step 3: Rebuild damage calculation**
- File: src/systems/CombatSystem.ts
- Generic damage formula (same as SC2 but with new tag system):
```
damage = max(0.5, baseDmg + bonusDmg(if target has bonusVsTag) + upgradeBonus - (baseArmor + armorUpgrade))
```
- Multi-hit weapons: atkHitCount > 1 applies armor per hit (same pattern)
- Splash: keep 3-zone model (inner 100%, mid 50%, outer 25%)

**Step 4: Simplify target acquisition**
- File: src/ecs/queries.ts
- Replace SC2 4-tier priority (retaliation > armed > unarmed > buildings) with simpler:
  - Tier 0: Enemy attacking self (retaliation)
  - Tier 1: Closest enemy in range (prefer units over buildings)
- Keep overkill prevention (pendingDamage check)

**Step 5: Remove SC2-specific combat behavior**
- File: src/systems/CombatSystem.ts
- Remove: Mutalisk glaive bounce, Queen dual-attack mode, Thor anti-air mode switching, Baneling suicide, Widow Mine sentinel mode, elevation miss chance (may re-add later as arena terrain feature)
- Keep: chase logic, attack cooldown, splash damage, air/ground targeting

**Step 6: Chase and leash behavior**
- Keep chase mechanics but simplify:
  - Units chase up to 8 tiles from original command position (leash)
  - Air units use straight-line pursuit
  - Ground units path to target

#### Edge cases
- Units with 0 damage (Medic, Observer equivalents): skip combat entirely
- Multi-tag bonus (unit has both Light and Armored): bonusDmg applies if target has the specific tag
- Splash damage respects air/ground targeting
- Self-damage from AoE abilities handled by ability system, not combat

#### Acceptance criteria
- [ ] Generic ArmorTag enum with 6 tags
- [ ] Bitfield-based armor tags on all units
- [ ] Damage calculation works with new tag system
- [ ] Splash damage works (3-zone model)
- [ ] Overkill prevention works
- [ ] No SC2 unit-type-specific code remains
- [ ] Target acquisition uses simplified 2-tier priority
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Unit test: Damage calculation with various armor tag combinations, bonus damage application
- Unit test: Splash damage distribution across 3 zones
- Verify: `npm test`

---

### Task 3: Production System + Node Economy Wiring
**Parent:** Pivot Phase 2 — node economy
**Size:** L
**Depends on:** none
**Unblocks:** T7

#### Goal
Rebuild production for the arena model: simplified 3-slot queue, no larva/inject/reactor mechanics, 4-tier tech chain per faction. Wire the NodeEconomy system (extractors on resource nodes, passive income) into the game loop as the sole income source. No workers.

#### Prerequisites
- ProductionSystem.ts stripped of larva/inject/reactor code
- NodeEconomy.ts exists (255 lines) with extractor and income logic
- arena-buildings.ts defines building chains per faction
- GatherSystem.ts deleted (no workers)

#### Changes

**Step 1: Simplify ProductionSystem**
- File: src/systems/ProductionSystem.ts
- Single production model for all factions:
  - 3-slot queue (down from 5)
  - One unit at a time from slot 0
  - Dequeue next on completion
  - Rally point: trained units attack-move to rally
- Remove: larva consumption, Reactor parallel slot, Zerg parallel morphing
- Keep: buildProgress ticking, queue management, unit spawning on completion

**Step 2: Wire NodeEconomy into game loop**
- File: src/simulation/Simulation.ts (or src/Game.ts)
- Add NodeEconomy.tick(dt) call in the tick loop after productionSystem
- NodeEconomy handles:
  - Extractor buildings on resource nodes generate income per tick
  - Income amount based on node tier/value (from ArenaMap zone data)
  - Killing enemy extractors cuts their income
  - No workers — purely passive

**Step 3: Starting economy**
- File: src/simulation/MatchManager.ts or Simulation.ts
- On player spawn: grant 1-2 pre-claimed starter nodes + 100 mineral bank
- Starter extractors auto-built and start generating income immediately

**Step 4: Extractor building**
- File: src/data/arena-buildings.ts
- Ensure Extractor building def exists per faction (e.g., Iron Legion "Refinery", Swarm "Hive Node", etc.)
- Cost: ~75 minerals, fast build time (~10s)
- Must be placed on an unclaimed resource node

**Step 5: Resource node claiming**
- File: src/systems/BuildSystem.ts
- When Extractor is placed on a resource node: claim the node for that player
- When Extractor is destroyed: unclaim the node (available for anyone)
- File: src/simulation/NodeEconomy.ts
- Track claimedBy per node, income rate per node

**Step 6: Kill bounties**
- File: src/systems/DeathSystem.ts
- On unit death: award mineral bounty to killer's owner
- Bounty = unit supply cost × 10 (e.g., Trooper supply 1 = 10 minerals)
- On building death: award larger bounty (cost × 0.5)

**Step 7: Supply system simplification**
- Supply cap based on HQ tier (auto-scales with tech progression):
  - Tier 1 HQ: 50 supply cap
  - Tier 2 HQ (upgraded): 100 supply cap
  - Tier 3 HQ: 150 supply cap
  - Tier 4 HQ: 200 supply cap
- No separate supply buildings needed

**Step 8: Tech chain validation**
- File: src/systems/CommandSystem.ts
- Enforce 4-tier building chain per faction:
  - Tier 1: HQ (Command Center / Hatchery / Citadel / Forge)
  - Tier 2: Primary production (requires HQ)
  - Tier 3: Advanced production (requires Tier 2)
  - Tier 4: Ultimate tech (requires Tier 3)
- Building prerequisites from arena-buildings.ts `requires` field

#### Edge cases
- Multiple extractors on same node — prevent (one extractor per node)
- Extractor destroyed while producing income — income stops immediately
- Player has 0 income and 0 minerals — they're stuck, can only wait for bounties
- Starting nodes must be close enough to HQ to defend

#### Acceptance criteria
- [ ] Simplified 3-slot production queue works for all factions
- [ ] No larva/inject/reactor mechanics remain
- [ ] NodeEconomy generates passive income from claimed resource nodes
- [ ] Extractors claim/unclaim nodes on build/destroy
- [ ] Kill bounties award minerals on unit/building death
- [ ] Supply cap scales with HQ tier (no supply buildings)
- [ ] 4-tier tech chain enforced per faction
- [ ] Starting economy: 2 pre-claimed nodes + 100 minerals
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Unit test: Income generation rate, node claiming/unclaiming, kill bounty amounts
- Unit test: Production queue (3-slot, dequeue, tech gate)
- Verify: `npm test`

---

### Task 4: Upgrade System — Per-Faction Upgrade Trees
**Parent:** Pivot — upgrade rework
**Size:** M
**Depends on:** none
**Unblocks:** T7

#### Goal
Rebuild UpgradeSystem with per-faction upgrade trees. Each faction gets ~4-6 unique upgrades: 2-3 leveled stat upgrades (weapons/armor) + 2-3 boolean research unlocks (abilities/passives).

#### Prerequisites
- UpgradeSystem.ts stripped of SC2-specific upgrades
- Faction data defined in arena-buildings.ts with research buildings

#### Changes

**Step 1: Define per-faction upgrade data**
- File: src/data/upgrades.ts (NEW)
- Structure:
```typescript
interface UpgradeDef {
  id: number;
  name: string;
  faction: number;
  maxLevel: number;          // 1 for boolean, 3 for leveled
  costs: { minerals: number; gas: number; time: number }[];  // per level
  building: number;          // BuildingType that researches this
  effect: 'weapon_damage' | 'armor' | 'speed' | 'ability_unlock' | 'special';
  effectValue: number;       // per level (+1 damage, +1 armor, etc.)
  affectedUnits: number[];   // UnitType[] that benefit
}
```

**Step 2: Define upgrades for each faction (~4-6 each)**
- File: src/data/upgrades.ts
- **Iron Legion**: Weapons 1-3, Armor 1-3, Stim Research, Advanced Targeting
- **Swarm**: Carapace 1-3, Claws 1-3, Adrenal Surge, Broodmother Capacity
- **Arcane Covenant**: Shield Regen Rate, Spell Power 1-3, Blink Range, Mana Efficiency
- **Automata**: Self-Repair Rate, Weapon Calibration 1-3, Salvage Efficiency, Overcharge

**Step 3: Rebuild UpgradeSystem to read from data**
- File: src/systems/UpgradeSystem.ts
- Generic loop: find buildings researching, advance timer, on completion apply effect
- Effect application: iterate all entities of affectedUnits types, apply stat change
- No per-upgrade switch statements — data-driven

**Step 4: Research UI buttons**
- File: src/rendering/InfoPanelRenderer.ts
- When research building selected: show available upgrades from UPGRADE_DEFS filtered by faction + building
- Show current level, cost, time

#### Edge cases
- Upgrade building destroyed mid-research — cancel, no refund
- Multiple research buildings of same type — each researches independently
- Upgrade applies to existing units AND newly trained ones

#### Acceptance criteria
- [ ] Per-faction upgrade definitions (4-6 per faction)
- [ ] Data-driven UpgradeSystem applies effects generically
- [ ] Leveled upgrades (weapons/armor) up to level 3
- [ ] Boolean research unlocks (ability prerequisites)
- [ ] Research UI shows correct upgrades per building per faction
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Unit test: Research completion, stat application, level progression
- Verify: `npm test`

---

### Task 5: Faction Unit + Building Rendering (4 Factions)
**Parent:** Pivot Phase 1.5 — visual identity
**Size:** XL
**Depends on:** none
**Unblocks:** T7

#### Goal
Create distinct visual identities for all 4 launch factions. Each faction needs unique unit shapes, building shapes, color palettes, and portraits for ~8 units + ~5 buildings. Use the existing procedural geometric rendering style (no sprites/art assets).

#### Prerequisites
- UnitRenderer.ts exists but has SC2-specific rendering stripped
- PortraitRenderer.ts exists with SC2 portraits
- Rendering is Canvas 2D / PixiJS Graphics based (procedural shapes)

#### Changes

**Step 1: Define faction palettes**
- File: src/rendering/factionPalettes.ts (NEW)
- 4 distinct color palettes:
  - **Iron Legion**: Military olive/steel gray, blue accents, red warning lights
  - **Swarm**: Dark red/purple bio-organic, green acid highlights, pulsing veins
  - **Arcane Covenant**: Royal blue/gold, white energy glow, crystal highlights
  - **Automata**: Chrome silver/dark gray, orange LED highlights, geometric precision

**Step 2: Iron Legion rendering (~7 units + 4 buildings)**
- File: src/rendering/UnitRenderer.ts
- Units: Trooper (square with visor), Grenadier (bulky square), Medic (square with cross), Humvee (rectangle with turret), Siege Tank (tracked rectangle), Gunship (angular air shape), Titan Walker (tall rectangle with legs)
- Buildings: Command Center (large rectangle with antenna), Barracks (medium rectangle), Factory (large rectangle with chimney), Starport (rectangle with landing pad)
- Style: Angular, boxy, military industrial

**Step 3: Swarm rendering (~7 units + 4 buildings)**
- File: src/rendering/UnitRenderer.ts
- Units: Drone (small ellipse), Spitter (medium ellipse with mandibles), Burrower (wide ellipse), Broodmother (large oval), Ravager (angular organic), Flyer (wing-shape), Leviathan (massive organic blob)
- Buildings: Hatchery (pulsing organic blob), Spawning Pool (bubbling pit), Warren (mound), Spire (tall organic tower)
- Style: Rounded, organic, pulsing, veiny textures

**Step 4: Arcane Covenant rendering (~7 units + 5 buildings)**
- File: src/rendering/UnitRenderer.ts
- Units: Acolyte (robed diamond), Warden (shielded diamond), Enchanter (floating diamond with glow), Blink Assassin (slim diamond), Storm Caller (hovering diamond with lightning), Golem (large hexagon), Archmage (ornate diamond)
- Buildings: Citadel (crystal pyramid), Obelisk/Pylon (energy pillar), Gateway (frame shape), Arcane Library (book shape), Sanctum (dome)
- Style: Geometric, crystalline, ethereal glow effects

**Step 5: Automata rendering (~7 units + 4 buildings)**
- File: src/rendering/UnitRenderer.ts
- Units: Sentinel (small octagon), Shredder (gear-toothed circle), Repair Drone (floating octagon with beam), Crawler (low wide octagon), Disruptor (sphere with rings), Harvester (claw-arm shape), Colossus (massive octagon with legs)
- Buildings: Core Forge (octagonal base), Assembly Line (rectangular with gears), Replicator (sphere), Power Matrix (grid shape)
- Style: Precise geometric, chrome/metallic, LED accents, rotating elements

**Step 6: Portraits for all units (4 × ~8 = 32 portraits)**
- File: src/rendering/PortraitRenderer.ts
- 44×44 Canvas 2D portraits using faction palette and simplified unit shapes
- Each portrait: faction-colored border, unit silhouette, name tooltip

**Step 7: Building rendering for all factions**
- File: src/rendering/UnitRenderer.ts (buildings render alongside units)
- Follow existing pattern: buildings are larger shapes with construction animation (grow from 10% to 100%)
- Each faction's buildings share palette but have unique shapes

**Step 8: Health bar faction colors**
- Health bars use faction accent color for border/background
- Shields (Arcane Covenant): blue bar above health bar (reuse from existing pattern)

#### Edge cases
- Fog of war: enemy units render as silhouettes (gray) when in explored-but-not-visible tiles
- Death animation: faction-specific (Iron Legion = explosion, Swarm = splatter, Covenant = shimmer, Automata = sparks)
- Selection highlight color matches faction

#### Acceptance criteria
- [ ] Each faction has visually distinct unit shapes (not just color swaps)
- [ ] Each faction has distinct building shapes
- [ ] All 32 unit portraits rendered at 44×44
- [ ] Faction palettes clearly differentiate teams in combat
- [ ] Death animations per faction
- [ ] Health bars render with faction-appropriate styling
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Spawn units from each faction, verify visual distinctness
- Manual: Mixed-faction combat, verify units are distinguishable
- Verify: `npm test`

---

### Task 6: UI Rebuild — Build Menu, Info Panel, HUD for Arena
**Parent:** Pivot — UI rework
**Size:** L
**Depends on:** none
**Unblocks:** T7

#### Goal
Rebuild the UI for the arena context. Build menu shows faction-appropriate buildings with tech gate indicators. Info panel shows selected unit/building info with ability buttons. HUD shows minerals, income rate, supply, nodes held, kill count. No worker count, no gas (simplified to single resource: minerals).

#### Changes

**Step 1: HUD for arena economy**
- File: src/rendering/HudRenderer.ts
- Display: Minerals (current), Income rate (minerals/min from nodes), Supply (used/cap), Nodes held (X/total), Kill count, Game timer
- Remove: Gas display, worker count, upgrade progress (move to separate panel)

**Step 2: Build menu per faction**
- File: src/rendering/BuildMenuRenderer.ts
- Show buildings available to current faction (from arena-buildings.ts)
- Tech gate indicators: grayed out if prerequisite building missing
- Hotkeys: 1-6 for buildings (fewer buildings per faction in arena)

**Step 3: Info panel for arena units**
- File: src/rendering/InfoPanelRenderer.ts
- Unit info: name, HP, damage, range, speed, armor tags, shields (if applicable)
- Ability buttons: from UNIT_ABILITIES data (generic slots, not hardcoded)
- Production buttons: for production buildings
- Extractor info: income rate, node value

**Step 4: Faction selection UI**
- New: src/rendering/FactionSelectRenderer.ts
- Pre-game faction picker: show 4 faction cards with name, description, key stats
- Player clicks to select, confirms ready

**Step 5: Minimap for arena**
- File: src/rendering/MinimapRenderer.ts
- Show: capture zones (colored by owner), resource nodes, unit positions
- Arena-specific: circular map shape, zone ring indicators

**Step 6: Match HUD**
- New overlay elements:
  - Player count alive (top center)
  - "X players remaining"
  - Kill feed (right side, scrolling)
  - Elimination announcements (center, fading)

#### Edge cases
- Faction selection timeout — auto-assign random faction
- Build menu with no available buildings (no HQ) — show "Build HQ" prompt
- Info panel with mixed-faction selection — show nothing (shouldn't happen in arena)

#### Acceptance criteria
- [ ] HUD shows minerals, income, supply, nodes, kills, timer
- [ ] Build menu shows faction-specific buildings with tech gates
- [ ] Info panel shows unit stats + ability buttons from data
- [ ] Faction selection UI with 4 faction cards
- [ ] Minimap shows arena zones and capture status
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Play as each faction, verify UI shows correct buildings/abilities
- Verify: `npm test`

---

### Task 7: Arena Gameplay Integration — Wire Everything, Playable Locally
**Parent:** Pivot — playability milestone
**Size:** XL
**Depends on:** T1-T6
**Unblocks:** T8, T13-T16

#### Goal
This is the integration task. Wire all rebuilt systems together so the game is playable locally as a single-player arena match (vs simple AI or vs no one). Player spawns with HQ + starting nodes, builds buildings, trains units, expands to new nodes, and fights. This is the "it works!" milestone.

#### Changes

**Step 1: Arena game mode in Game.ts**
- File: src/Game.ts
- Add arena game mode: load ArenaMap, spawn player at designated position, start NodeEconomy, start MatchManager
- Wire: Simulation.tick() calls all rebuilt systems in order

**Step 2: System execution order for arena**
- File: src/simulation/Simulation.ts
- Order: spatialHash → commandSystem → buildSystem → productionSystem → upgradeSystem → movementSystem → fogSystem → detectionSystem → combatSystem → abilitySystem → deathSystem → nodeEconomy → matchManager
- Remove: creepSystem, morphSystem, gatherSystem (cut)

**Step 3: Player spawn**
- File: src/simulation/MatchManager.ts
- Spawn sequence: place HQ at spawn position, place 2 extractors on nearest nodes, grant 100 starting minerals
- No workers — player immediately starts building

**Step 4: Building placement integration**
- File: src/systems/CommandSystem.ts
- Building placement: use ArenaMap tile data for walkability
- Extractor placement: only on resource nodes (check ArenaMap node positions)

**Step 5: Simple arena AI (temporary)**
- File: src/systems/SimpleAI.ts (NEW, <200 lines)
- Bare-minimum AI for local testing:
  - Build production buildings in tech chain order
  - Train units when affordable
  - Attack-move army toward player when army reaches threshold
  - Claim nearby resource nodes with extractors
- NOT the full 3500-line AI — just enough to test against

**Step 6: Win condition**
- File: src/simulation/MatchManager.ts
- Check each tick: if only one player's HQ remains → victory
- Display victory/defeat screen

**Step 7: Integration smoke test**
- Play a full local game: spawn → build → train → expand → fight → win/lose
- Verify all systems interact correctly

#### Edge cases
- All nodes claimed — no more expansion possible, must raid
- Player HQ destroyed — immediate elimination
- Multiple buildings placed on same tick — process sequentially

#### Acceptance criteria
- [ ] Game loads arena map with resource nodes and spawn positions
- [ ] Player spawns with HQ + 2 starter nodes + 100 minerals
- [ ] Building placement works on arena map
- [ ] Production trains units from buildings
- [ ] Node economy generates income from extractors
- [ ] Combat works between player and AI units
- [ ] Simple AI builds and attacks
- [ ] Victory/defeat detected and displayed
- [ ] Full game loop is playable locally
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Play full arena game locally, verify all mechanics
- Integration test: spawn → build → produce → combat → victory path
- Verify: `npm test`

---

### Task 8: Client-Server Wiring — Commands over WebSocket, Snapshot Rendering
**Parent:** Pivot Phase 1 — networking
**Size:** XL
**Depends on:** T7
**Unblocks:** T9, T10, T11

#### Goal
Make the game actually multiplayer. Client sends GameCommand objects to server via WebSocket. Server runs authoritative Simulation, broadcasts state snapshots. Client renders from server snapshots instead of local simulation. Two browser tabs should be able to fight each other.

#### Prerequisites
- server/GameServer.ts exists (146 lines) — WebSocket server skeleton
- server/GameRoom.ts exists (189 lines) — room management skeleton
- server/NetProtocol.ts exists (87 lines) — serialization skeleton
- Simulation.ts runs headlessly

#### Changes

**Step 1: Server-side command validation**
- File: server/GameRoom.ts
- Receive GameCommand from WebSocket → validate:
  - Player owns the units in command.units[]
  - Player can afford building/production costs
  - Command type is valid for game state
- Inject validated commands into Simulation.commandQueue

**Step 2: Server tick loop**
- File: server/GameRoom.ts
- Run Simulation.tick() at 20Hz (50ms interval)
- After each tick: build state snapshot for each player

**Step 3: State snapshot serialization**
- File: server/NetProtocol.ts
- Binary snapshot format:
  - Header: tick number, player resources, game time
  - Entity list: for each visible entity → eid, x, y, hp, shields, unitType, faction, commandMode, selected, etc.
  - Only include entities visible to this player (fog culling)
- Use ArrayBuffer for compact encoding (~2-5KB per snapshot per player)

**Step 4: Client receives and renders snapshots**
- File: src/Game.ts
- New mode: `networked` — client doesn't run Simulation.tick()
- Instead: receive snapshot → decode → update a local "render world" with entity positions/states
- UnitRenderer/TilemapRenderer render from this snapshot world
- Local systems still run: SelectionSystem, InputProcessor (client-only)

**Step 5: Client sends commands to server**
- File: src/input/InputProcessor.ts or new NetworkClient.ts
- Instead of pushing to local simulationQueue: serialize GameCommand → send via WebSocket
- Commands: Move, AttackMove, Stop, Build, Produce, UseAbility, etc.

**Step 6: Connection management**
- File: src/networking/NetworkClient.ts (NEW)
- Connect to server URL (ws://localhost:PORT/room/ROOM_ID)
- Handle: open, message, close, error
- Reconnect logic: attempt 3 reconnects with exponential backoff
- Expose: sendCommand(), onSnapshot callback

**Step 7: Two-player proof of concept**
- File: server/GameServer.ts
- Room creation: first player creates room, second joins
- Both players spawn on opposite sides of arena
- Both can build/fight/interact

**Step 8: Dev server setup**
- File: package.json
- Add `dev:server` script to run server alongside Vite dev server
- Or: integrate server into Vite dev server for single-process development

#### Edge cases
- Client disconnects — server pauses for 30s, then eliminates player
- Invalid commands (hacked client) — server rejects and logs
- Client behind on snapshots — just render latest, skip interpolation (T9 adds smoothing)
- Server crash — all clients disconnected (no persistence needed for .io)

#### Acceptance criteria
- [ ] Server runs Simulation at 20Hz
- [ ] Client sends commands over WebSocket
- [ ] Server validates and executes commands
- [ ] Server broadcasts per-player snapshots
- [ ] Client renders from server snapshots (not local simulation)
- [ ] Two browser tabs can connect and fight
- [ ] Move/attack/build all work over network
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Open two tabs, connect to same room, issue commands, verify both see results
- Measure: Round-trip command latency
- Verify: `npm test`

---

### Task 9: Client Interpolation + Per-Player Fog Culling
**Parent:** Pivot Phase 3 — client polish
**Size:** L
**Depends on:** T8
**Unblocks:** none

#### Goal
Smooth client rendering by interpolating between server snapshots (buffer 2-3 snapshots, lerp positions). Implement per-player fog of war on the server — clients only receive data for entities they can see. This is anti-cheat critical.

#### Changes

**Step 1: Snapshot buffering**
- File: src/networking/Interpolation.ts (NEW)
- Buffer incoming snapshots (ring buffer of 3)
- Render at snapshot[t-1] interpolated toward snapshot[t] based on elapsed time since last snapshot
- Render delay: ~50-100ms behind real server state (one snapshot interval)

**Step 2: Entity position interpolation**
- File: src/networking/Interpolation.ts
- For each entity present in both snapshot[t-1] and snapshot[t]: lerp posX, posY
- For entities appearing in snapshot[t] but not [t-1]: snap to position (new entity, just appeared)
- For entities in [t-1] but not [t]: fade out (entity died or left fog)

**Step 3: Health bar smoothing**
- Interpolate HP/shield values to avoid sudden jumps
- Damage events: show floating damage numbers at moment of change

**Step 4: Server-side fog of war per player**
- File: server/GameRoom.ts
- Each player has their own fog grid (computed from their units' vision)
- When building snapshot: only include entities where player's fog[entity tile] === VISIBLE
- Exception: send entity death events even if not currently visible (for kill feed)

**Step 5: Fog computation on server**
- File: src/systems/FogSystem.ts (refactor for multi-player)
- Instead of single global fogGrid: accept playerId parameter
- Compute per-player fog based on that player's units' vision ranges
- Server runs fog for all players each tick

**Step 6: Client fog rendering**
- File: src/rendering/FogRenderer.ts
- Client renders fog based on which tiles have received entity data
- Tiles never sent by server: unexplored (black)
- Tiles with entities in current snapshot: visible (clear)
- Tiles with entities in past but not current: explored (dark)

**Step 7: Command feedback (instant visual)**
- File: src/Game.ts (client mode)
- When player issues a move command: immediately show a move ping at target location (green circle)
- When player issues an attack command: show attack ping (red X)
- These disappear when server snapshot confirms the action

#### Edge cases
- Server hiccup (missed snapshot): hold previous render state, don't interpolate into nothing
- Entity teleports (Blink ability): detect large position delta, snap instead of lerp
- Player loses all units (no vision): fog closes entirely, only HQ area visible

#### Acceptance criteria
- [ ] Client interpolates between snapshots (smooth movement)
- [ ] Entity appear/disappear handled (snap/fade)
- [ ] Server only sends entities visible to each player
- [ ] Client can't see fog-hidden entities (anti-cheat)
- [ ] Command feedback pings appear instantly
- [ ] Health bar changes are smooth
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Play with artificial 100ms latency, verify movement smoothness
- Manual: Verify fog of war hides enemies correctly
- Verify: `npm test`

---

### Task 10: Match Lifecycle — Lobby, Countdown, Play, Victory
**Parent:** Pivot Phase 2 — match system
**Size:** L
**Depends on:** T8
**Unblocks:** T12

#### Goal
Implement full match lifecycle: players join a lobby, select factions, match starts with countdown, play until victory condition, results screen.

#### Changes

**Step 1: Lobby state**
- File: server/GameRoom.ts
- Room states: LOBBY → COUNTDOWN → PLAYING → FINISHED
- LOBBY: players join, select faction, mark ready
- Start when: all players ready OR minimum 2 ready + 30s timeout

**Step 2: Faction selection phase**
- File: server/GameRoom.ts + client
- Server broadcasts available factions and which players have selected what
- Client shows FactionSelectRenderer (from T6)
- Duplicate factions allowed (multiple Iron Legions can fight)

**Step 3: Countdown**
- 5-second countdown: server broadcasts countdown ticks
- Client shows countdown overlay (5... 4... 3... 2... 1... FIGHT!)
- During countdown: camera centers on spawn, buildings pre-placed, no commands accepted

**Step 4: Playing state**
- Server ticks Simulation at 20Hz
- Match timer starts
- Players can issue commands

**Step 5: Victory conditions**
- Option A: Last player standing (all other HQs destroyed)
- Option B: Timed (highest score after 20 min)
- Server checks each tick: count alive players (HQ exists and HP > 0)
- If 1 remaining: FINISHED state, that player wins

**Step 6: Results screen**
- Server broadcasts match results: winner, per-player stats (kills, deaths, nodes held, income earned)
- Client shows GameOverRenderer with stats
- "Play Again" button: return to lobby or join new room

**Step 7: Spectator mode (basic)**
- After elimination: player transitions to spectator
- Spectator receives full-map snapshot (no fog culling)
- Spectator can't issue commands

#### Edge cases
- All players disconnect — room closes
- Only 1 player in lobby — wait indefinitely (or start vs AI)
- Player disconnects during match — 30s grace period, then eliminate
- Tie (last two HQs destroyed same tick) — both eliminated, highest score wins

#### Acceptance criteria
- [ ] Room transitions through LOBBY → COUNTDOWN → PLAYING → FINISHED
- [ ] Faction selection works during lobby
- [ ] Countdown overlay displays on all clients
- [ ] Victory detected when 1 HQ remains
- [ ] Results screen shows per-player stats
- [ ] Spectator mode after elimination
- [ ] Disconnected players eliminated after grace period
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: 2+ players join lobby, select factions, play match, verify victory
- Manual: Test disconnect/reconnect behavior
- Verify: `npm test`

---

### Task 11: Multi-Player Spawning + Faction Selection
**Parent:** Pivot Phase 2 — player management
**Size:** M
**Depends on:** T8
**Unblocks:** T12

#### Goal
Support 8-16 players in a single arena. Each player gets a spawn position based on arena map layout, with balanced resource access. Handle player join/leave gracefully.

#### Changes

**Step 1: Spawn position assignment**
- File: src/simulation/ArenaMap.ts
- Arena map defines 16 spawn positions (symmetric/balanced)
- Assign positions based on join order, maximizing distance between players
- Each spawn position has 2 nearby resource nodes guaranteed

**Step 2: Player entity ownership**
- File: src/ecs/components.ts
- Add or verify: `ownerPlayerId: Uint8Array` — tracks which player owns each entity
- All faction checks now use ownerPlayerId → faction mapping (not raw faction component)

**Step 3: Player state tracking**
- File: server/GameRoom.ts
- Track per player: id, name, faction, alive/eliminated, resources, spawn position, connection state

**Step 4: Late join handling**
- During first 2 minutes of match: late joins allowed
- Late joiners get fresh spawn with starter economy
- After 2 minutes: no more joins (or join as spectator only)

**Step 5: Player disconnect**
- On disconnect: start 30s timer
- If reconnect within 30s: restore control
- If not: eliminate player (destroy all their entities)
- Disconnected player's extractors remain until destroyed (free income for others to raid)

#### Edge cases
- 16 players join — map must support 16 spawn positions
- All resource nodes near a spawn claimed by adjacent player — allow building in neutral territory
- Player reconnects to different browser tab — reauth via session token

#### Acceptance criteria
- [ ] 8-16 players can join a single room
- [ ] Each player gets balanced spawn position with nearby resources
- [ ] ownerPlayerId correctly tracks entity ownership
- [ ] Late join works within 2-minute window
- [ ] Disconnect → 30s grace → elimination
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: 4+ players join, verify spawn positions and starting resources
- Verify: `npm test`

---

### Task 12: Elimination Mechanics + Scoring + Kill Bounties
**Parent:** Pivot Phase 2 — .io gameplay
**Size:** L
**Depends on:** T10
**Unblocks:** T17

#### Goal
Implement permanent elimination (HQ destroyed = out), live scoring (kills + nodes + time alive), and kill bounties that reward aggressive play.

#### Changes

**Step 1: Elimination on HQ death**
- File: src/systems/DeathSystem.ts
- When a player's HQ building dies: trigger elimination
- Elimination: destroy all remaining player entities (buildings + units) with explosion effects
- Award kill credit to the player who destroyed the HQ

**Step 2: Scoring system**
- File: src/simulation/Scoring.ts (NEW)
- Per-player score computed live:
  - +10 per enemy unit killed
  - +50 per enemy building destroyed
  - +100 per player eliminated (HQ kill)
  - +1 per resource node held per minute
  - +1 per 10 seconds survived
- Displayed on HUD and in leaderboard

**Step 3: Kill bounties (minerals)**
- File: src/systems/DeathSystem.ts
- On entity death: award minerals to killer's owner
  - Unit bounty: supply cost × 8 minerals
  - Building bounty: mineral cost × 0.25
  - HQ bounty: 200 minerals
- Bounty creates income spike that rewards aggression

**Step 4: Elimination cascade effects**
- When eliminated: all buildings explode in sequence (staggered 0.2s each for visual drama)
- Resource nodes freed — any player can now claim them
- Eliminated player's area becomes "ruins" on minimap

**Step 5: Victory announcement**
- Last player alive: "VICTORY" screen with full match stats
- All eliminated players see final standings

**Step 6: Score display**
- File: src/rendering/HudRenderer.ts
- Live score counter (top of screen)
- Minimap shows score-ranked player colors

#### Edge cases
- Two HQs destroyed same tick — both eliminated, credit goes to attacker with higher score
- HQ destroyed by environmental damage (none currently, but future-proof)
- Player with 0 entities but HQ alive — they survive (can rebuild)

#### Acceptance criteria
- [ ] HQ destruction triggers player elimination
- [ ] All player entities destroyed on elimination
- [ ] Kill bounties award minerals to attackers
- [ ] Live scoring system with kills + nodes + survival
- [ ] Victory declared for last player standing
- [ ] Elimination cascade visual effect
- [ ] Score displayed on HUD
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Destroy enemy HQ, verify elimination + bounty + scoring
- Verify: `npm test`

---

### Task 13: Iron Legion Abilities
**Parent:** Pivot — faction depth
**Size:** L
**Depends on:** T7
**Unblocks:** none

#### Goal
Implement Iron Legion's unique abilities: Medic heal aura, Trooper Stim Pack, Siege Tank deploy mode, Gunship transport + boost.

#### Changes
- Define 4 AbilityDefs in src/data/abilities.ts for Iron Legion
- **Stim Pack** (Trooper): self_buff, 10 HP cost, +50% speed +25% attack speed, 15s duration
- **Siege Mode** (Siege Tank): toggle, immobilize, +50% damage +50% range, 3s transition
- **Heal Aura** (Medic): passive, heal nearest injured ally at 8 HP/s within 6 tile range
- **Transport Boost** (Gunship): self_buff, +50% speed for 3s, 20s cooldown
- Add visual effects: stim glow (red), siege deploy animation, heal beam (green), boost trail

#### Acceptance criteria
- [ ] All 4 Iron Legion abilities functional
- [ ] Visual feedback for each
- [ ] Abilities executable via Q/W hotkeys
- [ ] Type-check + tests pass

---

### Task 14: Swarm Faction Abilities
**Parent:** Pivot — faction depth
**Size:** L
**Depends on:** T7
**Unblocks:** none

#### Goal
Implement Swarm's unique abilities: Broodmother auto-spawn, Burrower ambush, Ravager corrosive bile, Flyer acid spray.

#### Changes
- Define 4 AbilityDefs for Swarm
- **Brood Spawn** (Broodmother): passive, spawns 2 free Drones every 30s (limited to 6 active)
- **Burrow** (Burrower): toggle, invisible + immobile, unburrow = 2s stun to nearby enemies
- **Corrosive Bile** (Ravager): targeted AoE, 2s travel time, 60 damage in 1.5 tile radius
- **Acid Spray** (Flyer): AoE, 8 DPS for 3s in radius, slows 30%
- Visual: spawn cocoons, burrow dirt mound, bile projectile arc, green acid cloud

#### Acceptance criteria
- [ ] All 4 Swarm abilities functional with visuals
- [ ] Broodmother passive spawns tracked + capped
- [ ] Type-check + tests pass

---

### Task 15: Arcane Covenant Abilities
**Parent:** Pivot — faction depth
**Size:** L
**Depends on:** T7
**Unblocks:** none

#### Goal
Implement Arcane Covenant's unique abilities: Shield regen burst, Blink teleport, Psi Storm AoE, Force Field terrain blocker.

#### Changes
- Define 4 AbilityDefs for Arcane Covenant
- **Shield Burst** (Warden): self + nearby allies, restore 50 shields instantly, 30s cooldown
- **Blink** (Blink Assassin): targeted movement, teleport 8 tiles, 7s cooldown, requires research
- **Arcane Storm** (Storm Caller): AoE, 80 damage over 3s in 1.5 tile radius, friendly fire
- **Force Wall** (Enchanter): targeted terrain, 2×1 impassable barrier for 11s, 50 energy
- Visual: blue shield pulse, blink shimmer, purple storm cloud, blue energy wall

#### Acceptance criteria
- [ ] All 4 Arcane Covenant abilities functional with visuals
- [ ] Force Wall blocks pathing and rebuilds pathfinder grid
- [ ] Arcane Storm friendly-fire works
- [ ] Type-check + tests pass

---

### Task 16: Automata Faction Abilities
**Parent:** Pivot — faction depth
**Size:** L
**Depends on:** T7
**Unblocks:** none

#### Goal
Implement Automata's unique abilities: Self-repair passive, Wreckage reclaim, EMP burst, Anchor mode.

#### Changes
- Define 4 AbilityDefs for Automata
- **Self-Repair** (all Automata units): passive, regen 2 HP/s out of combat (after 5s)
- **Wreckage Reclaim** (Harvester): targeted, move to destroyed mechanical unit wreckage, reclaim for 25 minerals, 15s channel
- **EMP Burst** (Disruptor): AoE, drain shields + energy in 2 tile radius, 75 energy cost
- **Anchor Mode** (Crawler): toggle, immobilize, +100% range +50% damage, 2s transition
- Visual: green repair sparks, wreckage glow during reclaim, blue EMP pulse, anchor clamp animation
- Wreckage system: on Automata mechanical unit death, leave wreckage entity for 30s

#### Acceptance criteria
- [ ] All 4 Automata abilities functional with visuals
- [ ] Self-repair passive works for all Automata units
- [ ] Wreckage entities spawn on mechanical unit death, reclaimable
- [ ] EMP drains shields + energy
- [ ] Type-check + tests pass

---

### Task 17: Kill Feed, Leaderboard, Announcements, HUD Polish
**Parent:** Pivot Phase 4 — .io features
**Size:** M
**Depends on:** T12
**Unblocks:** none

#### Goal
Add the .io social layer: live kill feed showing who killed what, in-match leaderboard, dramatic announcements for eliminations, and final HUD polish.

#### Changes

**Step 1: Kill feed**
- File: src/rendering/KillFeedRenderer.ts (NEW)
- Right side of screen, scrolling
- Format: "[PlayerA] killed [PlayerB]'s Trooper" (for units)
- Format: "[PlayerA] destroyed [PlayerB]'s Barracks" (for buildings)
- Format: "[PlayerA] ELIMINATED [PlayerB]!" (for HQ kills, bold + colored)
- Max 8 entries visible, fade after 10s

**Step 2: In-match leaderboard**
- File: src/rendering/LeaderboardRenderer.ts (NEW)
- Tab key toggles leaderboard overlay
- Show: rank, player name, faction icon, score, kills, nodes, status (alive/eliminated)
- Auto-show during final 2 players

**Step 3: Elimination announcements**
- File: src/rendering/AlertRenderer.ts (existing)
- Center screen: "[PlayerName] has been eliminated!" with faction-colored text
- Sound effect: dramatic elimination sound
- Duration: 3 seconds, fade out

**Step 4: Player name display**
- Player names float above their HQ building
- Minimap shows player name initials at base locations

**Step 5: Node capture announcements**
- "[PlayerA] claimed Node #7" (subtle, small text)
- "[PlayerA] lost Node #3" (when extractor destroyed)

**Step 6: Match timer**
- Prominent timer in top center
- For timed mode: countdown timer, flashes red in final 2 minutes

#### Edge cases
- Kill feed overflow — old entries scroll out
- Spectator sees all kill feed entries
- Player name too long — truncate to 12 chars

#### Acceptance criteria
- [ ] Kill feed shows unit kills, building destroys, and eliminations
- [ ] Leaderboard shows scores, toggled with Tab
- [ ] Elimination announcements are dramatic and visible
- [ ] Player names displayed above HQ
- [ ] Match timer visible and accurate
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- Manual: Play match, verify all announcements and feed entries
- Verify: `npm test`

---

## Cross-Cutting Concerns

### New Files to Create
| File | Task | Purpose |
|------|------|---------|
| src/data/abilities.ts | T1 | AbilityDef definitions for all factions |
| src/data/upgrades.ts | T4 | UpgradeDef definitions per faction |
| src/rendering/factionPalettes.ts | T5 | Color palettes for 4 factions |
| src/rendering/FactionSelectRenderer.ts | T6 | Pre-game faction picker UI |
| src/systems/SimpleAI.ts | T7 | Minimal AI for local testing |
| src/networking/NetworkClient.ts | T8 | WebSocket client wrapper |
| src/networking/Interpolation.ts | T9 | Snapshot buffering + entity lerping |
| src/simulation/Scoring.ts | T12 | Live scoring computation |
| src/rendering/KillFeedRenderer.ts | T17 | Kill feed display |
| src/rendering/LeaderboardRenderer.ts | T17 | In-match leaderboard |

### Key Architecture Decisions
1. **No workers** — economy is node-based extractors with passive income
2. **Single resource** — minerals only (no gas), simplifies economy decisions
3. **3-slot production queue** — faster pace than SC2's 5-slot
4. **Supply from HQ tier** — no supply buildings, fewer building types
5. **Data-driven abilities** — AbilityDef objects, not hardcoded switch statements
6. **Server authoritative** — client sends commands, renders snapshots, no prediction
7. **20Hz server tick** — interpolation hides the gap on client
8. **Permanent elimination** — HQ death = out of match, creates tension
9. **Kill bounties** — reward aggression, prevent passive turtling

### Component Changes (from swarm-command baseline)
| Removed | Added/Modified |
|---------|---------------|
| workerState, workerCarrying, workerTargetEid, workerMineTimer, workerBaseX/Y | ownerPlayerId (Uint8) |
| larvaCount, larvaRegenTimer, injectTimer | ability1CooldownEnd, ability2CooldownEnd (Float32) |
| addonType, depotLowered | abilityActiveEndTime, abilityActiveType |
| Various SC2-specific ability timers | wreckageExpireTime (Float32, Automata) |
| | armorTags (Uint8, bitfield) |
| | nodeClaimedBy (Uint8, on resource entities) |
| | incomeRate (Float32, on extractor buildings) |

### Rendering Palettes
| Faction | Primary | Secondary | Accent | Unit Style |
|---------|---------|-----------|--------|------------|
| Iron Legion | #5B7744 (olive) | #8899AA (steel) | #FF3333 (red warning) | Angular rectangles |
| Swarm | #8B2252 (dark red) | #553366 (purple) | #44FF44 (acid green) | Organic ellipses |
| Arcane Covenant | #2244BB (royal blue) | #FFD700 (gold) | #FFFFFF (white glow) | Diamond/crystal |
| Automata | #C0C0C0 (chrome) | #333333 (dark gray) | #FF8800 (orange LED) | Octagon/geometric |

---

## Architecture Model (snapshot for /dev)

### System Execution Order (Arena)
1. spatialHash.rebuild → 2. commandSystem → 3. buildSystem → 4. productionSystem → 5. upgradeSystem → 6. movementSystem → 7. fogSystem → 8. detectionSystem → 9. combatSystem → 10. abilitySystem → 11. deathSystem → 12. nodeEconomy.tick → 13. matchManager.tick

**Removed from SC2**: gatherSystem, creepSystem, morphSystem, aiSystem (replaced by SimpleAI in T7)

### Key Extension Points
- **New faction**: Add to factions.ts + arena-units.ts + arena-buildings.ts + abilities.ts + upgrades.ts + factionPalettes.ts + UnitRenderer (shapes)
- **New ability**: Add AbilityDef to abilities.ts, no system code changes
- **New unit**: Add to arena-units.ts, rendering shape in UnitRenderer
- **New building**: Add to arena-buildings.ts, rendering in UnitRenderer, build menu entry

### File Size Reference (rts.io fork)
| File | Lines | Notes |
|------|-------|-------|
| Simulation.ts | 314 | Headless simulation (extracted from Game.ts) |
| Game.ts | ~2000 | Client-side rendering + input (reduced from 2300) |
| CommandSystem.ts | ~430 | Stripped from 1486, needs rebuild |
| CombatSystem.ts | ~330 | Stripped from 665, needs rebuild |
| AbilitySystem.ts | ~90 | Stripped from 774, needs rebuild |
| ProductionSystem.ts | ~106 | Stripped from 298, needs rebuild |
| ArenaMap.ts | 385 | Arena map generation |
| HexGrid.ts | 208 | Hex grid for capture zones |
| NodeEconomy.ts | 255 | Node-based economy |
| MatchManager.ts | 193 | Match lifecycle |
| GameServer.ts | 146 | WebSocket server |
| GameRoom.ts | 189 | Room management |
| UnitRenderer.ts | ~4500 | Needs faction rendering rewrite |
