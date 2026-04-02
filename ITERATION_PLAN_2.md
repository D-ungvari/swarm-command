# Iteration Plan 2 — SC2 Mechanics Trainer

## Product Vision (updated)

**Swarm Command is an SC2 mechanics practice tool — not a standalone RTS.**

The closest analogy: [Mechanics.gg](https://mechanics.gg) for League of Legends, where players dodge champion skillshots in a browser tab to warm up before ladder games. That site is enormously popular with LoL players because it loads instantly, practices one real skill, and uses simple shapes intentionally.

**Swarm Command's positioning:**
> "Practice StarCraft 2 mechanics in your browser. True unit stats. No install. No account. Open a tab between ladder games."

**Why this framing wins:**
- Simple graphics are a **feature**, not a limitation — they load in 2 seconds and remove distractions
- Doesn't compete with SC2 — it *complements* it. SC2 players are the target audience.
- Mechanical accuracy matters more than visual fidelity — Marine vs Zergling must behave exactly like in SC2
- Clear portfolio story: "I understood SC2's mechanics deeply enough to recreate them accurately in TypeScript"
- Specific practice modes (build order drill, micro trainer, timing scenarios) give it clear utility

**What this means for priorities:**
1. **Mechanical accuracy** before visual polish — stats must match SC2 wiki values exactly
2. **Practice modes** are Tier 1, not Tier 3 — a scenario trainer is core functionality
3. **Quick-load design** — minimize bundle size, no account walls, single URL shareable
4. **True SC2 keybindings** — players who already know SC2 hotkeys should feel at home

---

## Audit Summary — Previous State

### What already works (don't re-implement)
- Double-click: selects all on-screen units of same type ✓
- Tab cycling: cycles through unit types in current selection ✓
- Control groups 0-9: assign (Ctrl+digit) and recall (digit) ✓
- Harassment squad (every 45s, 2-4 Zerglings) ✓
- Retreat + regroup at 35% army HP ✓
- Build-order system (12-pool, Roach push, Lair macro) ✓

### What's broken / missing
**UI:** No control group indicators, no portraits, no per-type ability panel in multi-select.
**AI:** No base defense — units stand idle while player attacks their buildings. Wave timers too slow early. Insufficient map presence. Only 2 buildings feel empty. AI doesn't respond dynamically when player army is spotted approaching.

---

# Iteration A — Selection UI Overhaul

## Goal
Make the selection and control group experience feel like SC2: visual group indicators, unit portraits, per-type subgroup ability bar that casts on the whole group.

---

## A.1 — Ctrl+Click Type-Select Enhancement

**Current behavior:** Double-click selects all on-screen units of the same type.

**New behavior:**
- **Ctrl+click** on a unit: select all units of the same type *within current selection* (deselect other types). Useful when you've box-selected a mixed army and want to quickly isolate one type for an ability.
- **Double-click** (unchanged): selects all *on-screen* units of same type (existing behavior stays)

**Implementation:**
In `InputProcessor.processMouseEvents()`, the `leftup` handler produces `CommandType.Select` or `CommandType.DoubleClickSelect`. Extend `GameCommand` with an optional `modifiers?: { ctrl: boolean }` field. When `ctrl` is held during a single click that hits a unit, emit `CommandType.Select` with `data = SELECT_SAME_TYPE_IN_SELECTION_FLAG` (a constant, e.g. `data: 1`).

In `SelectionSystem`, handle `CommandType.Select` with `cmd.data === 1`: find the unit at `sx/sy`, get its `unitType`, then deselect all other types from current selection (keep only those with matching `unitType`).

**Files:** `src/input/CommandQueue.ts`, `src/input/InputProcessor.ts`, `src/systems/SelectionSystem.ts`

---

## A.2 — Control Group Indicator Strip

A horizontal strip of group slots (1-9) near the bottom of the screen, always visible, showing which groups contain units.

**Visual spec:**
```
[1] [2] [3] [4] [5] [6] [7] [8] [9]
 ■   ·   ■   ·   ·   ·   ·   ·   ·
```
- Each slot is 32×32px, located above the info panel bottom-left
- Slot shows a colored icon (faction color + dominant unit type icon) if the group contains units
- Active group (last recalled) has a highlighted border
- Empty groups show a dim dot
- Hovering shows a tooltip with unit type counts

**Implementation:**
Create `src/rendering/ControlGroupRenderer.ts` as an HTML-based overlay (same pattern as HudRenderer). It reads from the module-level `controlGroups: Set<number>[]` array in `SelectionSystem.ts`.

Problem: `controlGroups` is currently module-level private in `SelectionSystem.ts`. Expose it via a new export:
```typescript
export function getControlGroupInfo(world: World): Array<{ count: number; dominantType: number }> {
  return controlGroups.map(group => {
    const types: Record<number, number> = {};
    for (const eid of group) {
      const t = unitType[eid];
      types[t] = (types[t] || 0) + 1;
    }
    const dominant = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    return { count: group.size, dominantType: dominant ? Number(dominant[0]) : 0 };
  });
}
```

Also track `lastActiveGroup: number` (which group was most recently recalled). Export `getLastActiveGroup()`.

**Wire into Game.ts:**
- Create `ControlGroupRenderer` in `init()` 
- Call `controlGroupRenderer.update(getControlGroupInfo(world), getLastActiveGroup())` in `render()`

**Files:** `src/rendering/ControlGroupRenderer.ts` (new), `src/systems/SelectionSystem.ts`, `src/Game.ts`

---

## A.3 — Unit Portraits in Info Panel

Replace the generic colored rectangles in the info panel with proper unit portraits. Since we have no pixel art assets, portraits are drawn with PixiJS `Graphics` in a small thumbnail canvas.

**Single-unit selected:** Show a 48×48 portrait in the top-left of the info panel. The portrait is a simplified version of the unit's geometric rendering (using the same `UnitRenderer` patterns but in miniature).

**Multi-unit / subgroup selected (after Tab cycling):** Show a row of portrait thumbnails for each unit of the currently focused type. Up to 8 portraits shown; excess count shown as "+N".

**Implementation:**
Create `src/rendering/PortraitRenderer.ts`:
- Uses PixiJS `RenderTexture` to pre-render each unit type's portrait once (cache invalidated only on zoom/scale change)
- The portrait is drawn by calling a `drawUnitPortrait(g: Graphics, unitType: number)` function that renders the unit at a fixed scale in a 44×44 space
- Alternatively (simpler): use HTML5 `<canvas>` elements drawn with 2D context — no PixiJS needed for portraits

The HTML portrait approach: each portrait is a `<canvas width="44" height="44">` element drawn once per unit type and cached. A `Map<UnitType, HTMLCanvasElement>` stores pre-drawn portraits.

**Portrait rendering for each unit type** — draw the geometric shapes from `UnitRenderer.ts` scaled to fit 44×44px using Canvas 2D API. Each portrait gets a background color (dark grey) and the unit geometry centered.

**In InfoPanelRenderer:**
- Add a `portraitContainer: HTMLDivElement` row above the existing name/detail row
- Single unit: one 44px portrait
- Multi-select: row of portrait thumbnails per type, count badge on each
- After Tab cycle: highlight the active subgroup's portrait with a bright border

**Files:** `src/rendering/PortraitRenderer.ts` (new), `src/rendering/InfoPanelRenderer.ts`

---

## A.4 — Subgroup Ability Panel (The Key Feature)

When Tab is used to cycle to a specific unit type (e.g., Marines), the info panel's bottom section transforms to show:
1. That unit type's stats (damage, armor, range, speed)
2. That unit type's abilities as clickable buttons
3. Clicking an ability button applies it to **ALL units of that type in the current selection** (not just one)

**Current state:** When Tab is pressed, `cycleSubgroup()` deselects all units except one type. The info panel then shows the single-unit view for the first matching entity. This is correct but incomplete — abilities should apply group-wide.

**What needs to change:**
- The info panel must detect the "subgroup mode" (after Tab cycle)
- Show a title: "Marines ×8" (count of that type in selection)
- Show the unit's abilities as full-width buttons
- Clicking an ability triggers it for ALL selected units of that type (not just one)

**SubgroupAbilityPanel implementation:**

Add a `subgroupMode: boolean` and `subgroupType: UnitType` state to `SelectionSystem` (exported). When `CycleSubgroup` command executes, record the active subgroup type.

In `InfoPanelRenderer.update()`, detect subgroup mode:
```
if (subgroupMode) {
  show: "[unit name] ×N"
  show: stat line (dmg / armor / range)  
  show: ability buttons for this type
}
```

The ability buttons dispatch commands to the `simulationQueue` the same way existing production buttons do — via a registered callback `setSubgroupAbilityCallback`.

**Ability button → group dispatch:**
The callback is called with `(abilityType: CommandType, unitType: UnitType)`. In `Game.ts`, the callback:
1. Collects all selected units of `unitType`
2. Dispatches the ability command to `simulationQueue` with those units as `cmd.units`

This means: pressing "Stim" on the subgroup panel stimulates ALL selected Marines simultaneously. This is the correct SC2 behavior — you press T once and all Marines in the group stim.

**Ability definitions per unit type:**

| Unit | Ability 1 | Key | Ability 2 | Key |
|------|-----------|-----|-----------|-----|
| Marine | Stim Pack | T | — | — |
| Marauder | (passive slow, no button) | — | — | — |
| SiegeTank | Siege Mode | E | — | — |
| Medivac | (heals automatically) | — | — | — |
| Ghost | Cloak | C | — | — |
| Battlecruiser | Yamato Cannon | Y | — | — |
| Viking | Transform | E | — | — |
| Widow Mine | (auto-burrow) | — | — | — |
| Zergling | (no active ability) | — | — | — |
| Hydralisk | (no active ability) | — | — | — |
| Queen | Inject Larva | V | — | — |
| Infestor | Fungal Growth | F | — | — |
| Ravager | Corrosive Bile | R | — | — |
| Viper | Abduct | G | — | — |

**Files:** `src/systems/SelectionSystem.ts` (export subgroup state), `src/rendering/InfoPanelRenderer.ts` (subgroup panel section), `src/Game.ts` (callback wiring)

---

## A.5 — Tab Cycling with Count Display

When Tab is pressed, the current behavior deselects all but one type. Improve to:
1. Show which type is focused: "**Marines** | Marauders | SiegeTanks" at the top of the panel, with the active type bolded/highlighted
2. Show count per type: "Marines ×8 | Marauders ×3 | Tanks ×2"
3. Use arrow keys (← →) as alternative to Tab for cycling

**Implementation:**
- Export `getSubgroupTypes(world: World): Array<{unitType: number, count: number}>` from SelectionSystem
- Export `currentSubgroupIndex: number`
- InfoPanelRenderer displays the type breadcrumb row in multi-select mode
- InputProcessor: add `ArrowLeft` / `ArrowRight` as aliases for CycleSubgroup (with direction flag)

**Files:** `src/systems/SelectionSystem.ts`, `src/input/InputProcessor.ts`, `src/rendering/InfoPanelRenderer.ts`

---

## A.6 — Updated Hotkey Panel

Add missing abilities to the hotkey reference panel:
```
V   Inject Larva (Queen)
Y   Yamato Cannon (Battlecruiser)
R + click  Corrosive Bile (Ravager)
F + click  Fungal Growth (Infestor)
G   Abduct (Viper)
Tab Cycle Subgroup
←/→ Prev/Next Subgroup
```

**File:** `src/rendering/HotkeyPanelRenderer.ts`

---

## Iteration A — Sprint Order

| # | Item | Effort | Dependency |
|---|------|--------|------------|
| A.1 | Ctrl+click type-select | 1h | — |
| A.2 | Control group indicator strip | 2–3h | — |
| A.3 | Unit portraits | 3–4h | — |
| A.5 | Tab cycling with count display | 1h | — |
| A.4 | Subgroup ability panel | 3–4h | A.3, A.5 |
| A.6 | Hotkey panel updates | 30min | — |

Total: ~1–1.5 days

---

---

# Iteration B — AI Behavior Overhaul

## Root Causes of the Problem

Based on the audit:

1. **No base defense** — `decideAttack()` is the only way units move. When a player attacks the Zerg base, units stand idle until the next wave timer fires. This is the main complaint.

2. **Wave timers feel slow** — `waveIntervalBase` is 30s (Normal), meaning a wave attack fires at most every 30s. But first wave requires accumulating 6 units, which at 3-minerals-per-tick takes 1–2 minutes. Player can reach max army before seeing any pressure.

3. **No map presence** — Between waves, AI units are not on the map. They spawn, accumulate, then teleport-attack (attack-move from base). There are no units visibly threatening the player outside of waves.

4. **2-building base** — Only Hatchery + SpawningPool. This looks empty. A real Zerg base has 5-8 buildings. Empty base = underwhelming experience.

5. **No response to player approach** — AI has intel (`intel.lastSeenEnemyUnits[]`) but only uses it to adjust unit composition. It does NOT react to a player army approaching by deploying defenders.

---

## B.1 — Active Base Defense

**Trigger:** When any enemy unit enters within 12 tiles of any AI building (detected in `aiSystem()` via spatial queries).

**Response:**
- If AI has 3+ units in `armyEids`: peel off 30–50% (minimum 3, maximum 8) to defend. These become a `defenseEids: Set<number>` group.
- Defense units attack-move to the AI base entry point (the tile nearest the attacking player's path).
- Defense units rejoin `armyEids` after repelling (no more enemy in 15-tile radius for 10s).
- If AI has < 3 units: immediately spawn 2 Zerglings and send them to intercept.

**Implementation:**
Add `defenseEids: Set<number>` and `lastDefenseActivation = 0` to module state.

New function `checkBaseUnderAttack(world, gameTime)`:
```
1. For each AI building, check spatial hash for enemies within 12 tiles
2. If enemies found AND gameTime - lastDefenseActivation > 15s (cooldown):
   - Pull 40% of armyEids into defenseEids
   - Send defenseEids on attack-move to the point halfway between AI base and the closest enemy
   - Set lastDefenseActivation = gameTime
3. Retire defenseEids back to armyEids when area is clear (check every 5s)
```

**Files:** `src/systems/AISystem.ts`

---

## B.2 — Roaming Aggression (Map Presence)

Between waves, AI should have units visibly on the map. Currently units wait at base.

**New behavior: Vanguard units**
After the army reaches 50% of wave threshold, split off 2–4 "vanguard" units. These move to a position 30–40 tiles toward the player (map midpoint or natural expansion area). They don't attack unless engaged. This creates visible map pressure.

**Implementation:**
```
vanguardEids: Set<number> = new Set()

In trySpawnUnit():
  If armyEids.size >= waveThreshold * 0.5 AND vanguardEids.size < 4:
    Take 2 units from armyEids → vanguardEids
    Move them to tileToWorld(MAP_CENTER_COL, MAP_CENTER_ROW)
    (they'll auto-engage if player units come near via CombatSystem)

In decideAttack():
  Merge vanguardEids back into armyEids when launching a wave
```

**Also:** Vanguard units that come under fire and survive will fight their way back toward the player base — this makes the AI feel like it's probing. This happens naturally via `CombatSystem`'s auto-acquire + chase behavior.

**Files:** `src/systems/AISystem.ts`

---

## B.3 — Faster Initial Pressure & Scaling

The first wave is too slow. Fix:
- **Easy:** Keep current timing (first wave ~3:00)
- **Normal:** First Zergling rush triggered at 45s supply threshold (not 12 supply — starts smaller but earlier). `INITIAL_DELAY` reduced from 20s to 10s.
- **Hard:** `INITIAL_DELAY = 5s`. First attack when army = 4 units (was 6). Harassment starts at 20s intervals (was 45s).
- **Brutal:** `INITIAL_DELAY = 0`. Immediate aggression. Harassment at 10s intervals. Sends scouts immediately to attack mineral line workers.

Also: mineral income scaling adjusted. Current base is 3/tick. Increase slightly:
- Easy: 2.5/tick (unchanged)
- Normal: 3.5/tick (was 3.0)
- Hard: 5.0/tick (was 4.2)
- Brutal: 7.0/tick (was 5.4)

This makes late game waves more dangerous and keeps pace with a competent player economy.

**Files:** `src/constants.ts` or `src/systems/AISystem.ts` (difficulty configs)

---

## B.4 — Expanded AI Base (Living Base)

Currently 2 buildings. Make the base feel like a functioning hive.

**Auto-spawn AI buildings on a timer:**

| Wave # | Building added | Location |
|--------|---------------|----------|
| 0 (start) | Hatchery + SpawningPool (existing) | 117,117 |
| Wave 1 | RoachWarren (34) OR HydraliskDen (if Lair macro) | 120,117 |
| Wave 2 | EvolutionChamber | 117,120 |
| Wave 3 | Second SpawningPool | 113,117 |
| Wave 5 | Expansion Hatchery (existing) | 15,100 |
| Wave 7 | Spire (if Lair macro picked) | 120,120 |

**Implementation:**
Add `buildingBuildQueue: Array<{wave: number, type: BuildingType, col: number, row: number}>` checked in `aiSystem()` each wave. When `waveCount >= item.wave`, spawn the building via `spawnBuildingFn`.

Also add `Creep Tumors` spreading from Hatchery — already partially implemented in `CreepSystem`. Set a timer to call `spawnBuilding(BuildingType.EvolutionChamber, ...)` at game start automatically.

**Files:** `src/systems/AISystem.ts`

---

## B.5 — Reactive Intel-Driven Response

Current: AI sees player army via `gatherIntelFromUnits()` → adjusts unit type weights. 
Missing: AI doesn't **react to player army movement** (only unit presence).

**New: proximity threat response**

When `intel.lastSeenEnemyX/Y` is within 40 tiles of the AI base (currently only 64-tile map distance would be relevant):
1. Cancel any current wave cooldown — attack immediately if army > threshold × 0.7
2. Pull vanguard units back to reinforce base
3. If player army > AI army value (by estimated HP sum): go defensive (don't attack, wait to build up)
4. If player army < AI army value: launch attack even if slightly below threshold

**Threat level computation:**
```typescript
function estimateThreatLevel(world): number {
  let playerStrength = 0;
  let aiStrength = 0;
  for (const eid of intel.lastSeenEnemyUnits) {
    const def = UNIT_DEFS[unitType[eid]];
    if (def) playerStrength += def.hp * def.damage;
  }
  for (const eid of armyEids) {
    const def = UNIT_DEFS[unitType[eid]];
    if (def) aiStrength += hpCurrent[eid] * atkDamage[eid];
  }
  return playerStrength / Math.max(1, aiStrength); // > 1 = player stronger
}
```

When threat level > 1.5: go fully defensive (B.1 defense + pull vanguard).
When threat level < 0.7: opportunistic — attack even at 60% wave threshold.

**Files:** `src/systems/AISystem.ts`

---

## B.6 — Persistent Harassment (Never-Idle Aggression)

Current harassment: 2-4 Zerglings every 45s. Too weak and too infrequent.

**New harassment doctrine:**
- **Mineral-line harassment:** Directly target player workers (SCVs at mineral patches). This is devastating economically and forces the player to react.
- **Multi-point harassment:** Maintain 2 simultaneous harass squads at different map positions.
- **Harassment never stops:** Even during main waves, harassment continues independently.

**Implementation:**
- `harassSquad1Eids: Set<number>` and `harassSquad2Eids: Set<number>` — each 3-4 units
- `harassTarget1`: Random point near player mineral line `{col: 12, row: 18}` (near CC/minerals)
- `harassTarget2`: Alternate entry point (flanking from side)
- Harass squads are topped-up from newly spawned units — when a harass unit dies, the next spawn goes to replace it
- Harass squads ALWAYS have units; they're never "empty"

On Normal: 2-4 harassers per squad. Hard/Brutal: 4-6. 

**Files:** `src/systems/AISystem.ts`

---

## B.7 — AI Ability Usage

Current: AI units attack but never use their special abilities (Banelings do explode, but other abilities are never triggered by AI).

**Add AI ability casting:**

| Unit | Ability | AI trigger condition |
|------|---------|---------------------|
| Baneling | Explode on contact | Already implemented (auto) |
| Roach | Regen | Already passive |
| Queen | Inject Larva | After 20s, inject nearest Hatchery if energy ≥ 25 |
| Ravager | Corrosive Bile | If 3+ enemy units clustered in 2-tile radius: cast bile |
| Infestor | Fungal Growth | If 4+ enemy bio units clustered: cast fungal |
| Mutalisk | Glaive bounce | Already implemented |
| Viper | Abduct | If enemy Siege Tank or Battlecruiser visible: abduct it |

**Implementation in AISystem:**
Add `runAIAbilities(world, gameTime)` function called from `aiSystem()`:
- For each AI Zerg unit in `armyEids`, check ability cooldown and trigger condition
- For Queen: check `energy[eid] >= INJECT_LARVA_COST` and nearest Hatchery needs larva
- For Ravager/Infestor: use spatial hash to find clustered enemies
- For Viper: find high-value targets

**Files:** `src/systems/AISystem.ts`

---

## B.8 — Escalating Late Game

As waveCount grows, the AI should feel increasingly threatening:

- **Wave 5+:** AI sends units in 3 simultaneous groups (not just 2 on Hard/Brutal)
- **Wave 8+:** AI always has 2 harassment squads active + 1 main wave
- **Wave 10+:** AI units benefit from max upgrades (+3 weapons/armor via existing upgrade system)
- **Wave 12+:** AI can produce Ultralisks and Vipers (from the expanded building set in B.4)

Also: post-wave 8, the AI should no longer fully retreat. It keeps a "perma-harassment" force of 3–5 units that stays near the player's base perimeter permanently.

**Files:** `src/systems/AISystem.ts`

---

## B.9 — Better Attack Routing (Units Actually Cross the Map)

**Current problem:** Attack-move from AI base goes directly to player CC tile. Units get stuck on terrain or take a predictable path.

**Fix:**
- Use multiple rally points: units move to `ATTACK_RALLY = tileToWorld(64, 64)` (map center) first as a waypoint, then attack-move to player base
- This makes units visibly cross the map center — the player sees them coming from further away
- On multi-prong (Hard/Brutal): main force routes through center, harass force routes through flank

**Implementation:**
In `sendAttackWave()`, instead of:
```typescript
setPath(eid, directPathToPlayerBase)
commandMode[eid] = AttackMove
```

Use:
```typescript
// Move to map center first
setPath(eid, [mapCenter, playerBase])
commandMode[eid] = AttackMove
```
The existing `appendPath` function already supports waypoint chains.

**Files:** `src/systems/AISystem.ts`

---

## Iteration B — Sprint Order

| # | Item | Effort | Priority |
|---|------|--------|----------|
| B.1 | Active base defense | 2h | **Critical** |
| B.3 | Faster initial pressure + scaling | 1h | **Critical** |
| B.9 | Better attack routing (cross the map) | 1h | **Critical** |
| B.6 | Persistent multi-point harassment | 2h | High |
| B.4 | Expanded AI base (auto-build buildings) | 2h | High |
| B.2 | Roaming vanguard (map presence) | 1h | High |
| B.5 | Reactive intel-driven response | 2h | Medium |
| B.7 | AI ability usage | 2h | Medium |
| B.8 | Escalating late-game | 1h | Medium |

Total: ~1.5 days

---

## Combined Sprint Recommendation

**Day 1 — Critical fixes (highest visible impact):**
- B.1: Base defense (units no longer stand idle while attacked)
- B.3: Faster initial pressure
- B.9: Units cross the map visibly
- A.2: Control group indicator strip
- A.1: Ctrl+click type-select

**Day 2 — Major features:**
- B.6: Persistent harassment
- B.4: Expanded AI base
- B.2: Vanguard map presence
- A.3: Unit portraits
- A.5: Tab cycling with count display

**Day 3 — Polish:**
- B.5: Reactive intel response
- B.7: AI ability usage
- A.4: Subgroup ability panel
- A.6: Hotkey panel
- B.8: Escalating late game

---

---

# Iteration C — Major Visual Overhaul

## Current State Assessment

The game uses PixiJS `Graphics` throughout — no sprite sheets, no pixel art. Every visual is geometry: full programmatic control over shape, colour, animation, and dynamic state.

**What is already good:**
- Zergling: elongated body, spine ridge, mandibles, legs, tail — clear organic silhouette
- Baneling: pulsing glow, vein cracks, inner glow — feels explosive
- Siege Tank (sieged): stabilizer legs, ultra-long barrel, muzzle pulse — very readable
- Marauder: shoulder pads, grenade launchers, chest plate — clear heavy armour
- Siege Tank (mobile): tread links, turret, cannon — distinct vehicle look

**What needs the most work:**
1. Marine — body proportions too small, visor is a single line, shoulder pauldrons entirely missing
2. Buildings — functional but flat. No volumetric depth. Too similar to each other.
3. Resource nodes — mineral patches are simple diamonds. Could feel more crystalline and alive.
4. Tile environment — ground is flat colour. Water animation exists but is basic.
5. Effects — deaths are shrink+fade. No unit-type-specific particles, no directional explosions.
6. UI panels — HUD and info panel use default browser styling. No cohesive visual language.

---

## C.1 — The Marine: A Complete Redesign

The Marine is SC2's mascot. It must immediately communicate "CMC powered combat armour, Terran military, dangerous". The current rendering has 8 draw calls. The redesign uses 22 layered draw calls — every layer adds character without affecting performance (all simple shapes).

### The 5 iconic SC2 Marine features (in visual priority order)

1. **Massive pauldrons (shoulder armour)** — extend nearly to the width of the torso on each side. The #1 most recognisable feature. Currently missing entirely.
2. **T-shaped visor** — NOT a horizontal slit. Two strokes: a wide horizontal bar + a narrow vertical drop from center. Glowing cyan. Currently just a horizontal line.
3. **Barrel chest** — the chest plate bows outward with a visible division line down the center. Currently a flat trapezoid.
4. **Gauss Rifle** — 5 elements: stock, action, magazine box, barrel, muzzle. Currently 2 lines.
5. **Heavy boots** — wide, square, armoured feet. Currently absent.

### Draw order (bottom to top, 22 draw calls)

**Layer 1 — Drop shadow**
Soft ellipse beneath the feet (y offset +h*0.55):
```
g.ellipse(x, y + h*0.55, w*0.7, h*0.2)  fill: 0x000000 alpha:0.35
```

**Layer 2 — Boots (two wide rects)**
```
Left:  rect(x - w*0.28, y + h*0.32, w*0.22, h*0.25)  fill: bodyColor darken 0x222222
Right: rect(x + w*0.06, y + h*0.32, w*0.22, h*0.25)
Both:  stroke 0x334466 width:1
```

**Layer 3 — Shin guards**
```
Left:  rect(x - w*0.26, y + h*0.05, w*0.18, h*0.3)   fill: bodyColor
Right: rect(x + w*0.08, y + h*0.05, w*0.18, h*0.3)
Both:  stroke 0x4466aa width:1
```

**Layer 4 — Torso trapezoid (barrel chest shape)**
```
moveTo(x - w*0.38, y - h*0.08)
lineTo(x + w*0.38, y - h*0.08)   // wide at shoulders
lineTo(x + w*0.28, y + h*0.12)
lineTo(x - w*0.28, y + h*0.12)   // narrower at waist
closePath
fill: bodyColor   stroke: 0x5588cc width:1.2 alpha:0.8
```

**Layer 5 — Chest plate (slightly raised, slightly brighter)**
```
rect(x - w*0.22, y - h*0.06, w*0.44, h*0.16)
fill: bodyColor + 0x111111 (lighter)   stroke: 0x6699cc width:0.8
```

**Layer 6 — Chest division seam (vertical center line)**
```
moveTo(x, y - h*0.07)   lineTo(x, y + h*0.1)
stroke: 0x3355aa width:1 alpha:0.6
```

**Layer 7 — Waist band (darker, narrower)**
```
rect(x - w*0.24, y + h*0.1, w*0.48, h*0.06)
fill: bodyColor - 0x222222 (darker)
```

**Layer 8 — LEFT PAULDRON (the iconic big shoulder pad)**
```
// Extends to x - w*0.62 — significantly wider than torso!
moveTo(x - w*0.35, y - h*0.18)
lineTo(x - w*0.62, y - h*0.18)
lineTo(x - w*0.65, y + h*0.0)
lineTo(x - w*0.38, y + h*0.04)
closePath
fill: bodyColor slightly blue   stroke: 0x5577bb width:1
// Ridge line on top edge:
moveTo(x - w*0.35, y - h*0.18)  lineTo(x - w*0.62, y - h*0.18)
stroke: 0x7799cc width:1
```

**Layer 9 — RIGHT PAULDRON (mirror)**
```
moveTo(x + w*0.35, y - h*0.18)
lineTo(x + w*0.62, y - h*0.18)
lineTo(x + w*0.65, y + h*0.0)
lineTo(x + w*0.38, y + h*0.04)
closePath  fill: bodyColor   stroke: 0x5577bb width:1
```

**Layer 10 — Elbow joints**
```
Left:  circle(x - w*0.3, y + h*0.04, w*0.06)  fill: 0x223355  stroke: 0x445577
Right: circle(x + w*0.3, y + h*0.04, w*0.06)
```

**Layer 11 — Helmet dome (wider than torso)**
```
moveTo(x - w*0.34, y - h*0.13)
lineTo(x - w*0.34, y - h*0.42)
arc(x, y - h*0.42, w*0.34, Math.PI, 0)   // semicircle top
lineTo(x + w*0.34, y - h*0.13)
closePath   fill: bodyColor   stroke: 0x5588cc width:1
```

**Layer 12 — Helmet antenna/ridge**
```
rect(x - w*0.18, y - h*0.57, w*0.08, h*0.1)
fill: bodyColor   stroke: 0x4466aa width:0.8
```

**Layer 13 — Chin guard**
```
moveTo(x - w*0.28, y - h*0.13)  lineTo(x - w*0.18, y - h*0.05)
lineTo(x + w*0.18, y - h*0.05)  lineTo(x + w*0.28, y - h*0.13)
fill: bodyColor darken   stroke: 0x4466aa width:0.8
```

**Layer 14 — Visor dark interior (behind the glow)**
```
rect(x - w*0.22, y - h*0.43, w*0.44, h*0.18)
fill: 0x001122 alpha:0.85
```

**Layer 15 — T-VISOR (the iconic feature, two strokes)**
```
// Horizontal bar:
moveTo(x - w*0.24, y - h*0.36)  lineTo(x + w*0.24, y - h*0.36)
stroke: 0x00eeff width:2.5

// Vertical drop from center:
moveTo(x, y - h*0.36)  lineTo(x, y - h*0.22)
stroke: 0x00eeff width:1.5

// Soft outer glow (wider, lower alpha):
moveTo(x - w*0.24, y - h*0.36)  lineTo(x + w*0.24, y - h*0.36)
stroke: 0x44ffff width:5 alpha:0.25
```

**Layer 16 — Gauss Rifle (5 elements)**
```
// Stock at right hip:
rect(x + w*0.26, y + h*0.0, w*0.12, h*0.14)   fill: 0x334455

// Receiver/action (main body):
rect(x + w*0.3, y - h*0.06, w*0.32, h*0.1)    fill: 0x445566   stroke: 0x556677 width:0.8

// Magazine box (distinctive box below):
rect(x + w*0.36, y + h*0.04, w*0.14, h*0.12)  fill: 0x2a3a4a   stroke: 0x445566 width:0.8

// Barrel (slight downward angle):
moveTo(x + w*0.62, y - h*0.02)  lineTo(x + w*0.95, y + h*0.1)
stroke: 0x778899 width:2.5

// Muzzle:
circle(x + w*0.95, y + h*0.1, 2)  fill: 0x556677
```

**Layer 17 — Muzzle flash (when atkFlashTimer > 0)**
```
const fa = atkFlashTimer[eid] / FLASH_DURATION
circle(x + w*0.95, y + h*0.1, 4 + fa*3)   fill: 0xffdd44 alpha: fa*0.9
circle(x + w*0.95, y + h*0.1, 2 + fa*2)   fill: 0xffffff alpha: fa
```

**Layer 18 — Support arm (left arm bracing rifle)**
```
// Thick line from left body toward rifle
moveTo(x - w*0.22, y + h*0.06)  lineTo(x + w*0.28, y + h*0.0)
stroke: bodyColor width:4
```

**Layer 19 — Stim Pack ring (when active)**
```
if (stimEndTime[eid] > gameTime):
  const p = 0.55 + Math.sin(gameTime * 8) * 0.3
  circle(x, y, max(w,h) * 0.85)   stroke: 0xff8800 width:2.5 alpha:p
  circle(x, y, max(w,h) * 0.65)   stroke: 0xffaa44 width:1   alpha:p*0.5
```

**Layer 20 — Idle breathing (micro-animation)**
```
// Very subtle: apply sin(gameTime * 1.2 + eid * 2.3) * 0.4 as Y offset to all layers
// Units desync because eid differs. Makes the army feel alive.
const breathY = Math.sin(gameTime * 1.2 + eid * 2.3) * 0.4
// Add breathY to all layer y-coordinates above
```

### What this achieves
- **Pauldrons at ±0.62×width** — they visibly dominate the silhouette
- **T-visor** — 3 strokes (H bar + V drop + soft glow) = unmistakably SC2
- **Rifle has 5 named elements** — readable at normal zoom, impressive up close
- **22 draw calls** vs 7 currently — but all simple rects/lines/circles, negligible GPU cost
- **Breathing animation** desync'd by EID — the army has organic life

---

## C.2 — Terran Unit Visual Pass

### SCV
- Cockpit canopy dome (small circle, glass-blue fill) on top
- Two hover/thruster circles at the rear
- Mining arm: L-shaped articulated arm (2 segments with joint circle) instead of single line
- Treads/hover pads at the bottom as parallel dark rects
- Construction welding: orange spark dot at arm tip when `workerState === Mining`

### Marauder
- Grenade launcher tubes: two short side-by-side rects per shoulder (not circles)
- Heavy foot pods: wider rectangular feet
- Chin strap: line from helmet base to shoulder plates
- Visor: red-orange horizontal slit (distinguishes from Marine cyan at a glance)
- Extra wrist detail: small circle on right wrist (grenade release mechanism)

### Medivac
- Complete rethink: rear-swept dropship profile (wider than tall)
- Engine pods: two side rectangles with orange thruster-glow circles
- Medical cross: larger, raised, with subtle inner fill
- Landing lights: 3 pulsing circles on underside
- Air elevation shadow: shadow offset slightly below and to side, suggesting altitude

### Ghost
- Cloaked shimmer: 3 vertical shimmer lines at random x offsets using sin waves (more visible shimmer)
- Sniper scope ring: small circle on rifle barrel
- Visor: narrow horizontal green line (distinct from Marine cyan)

### Hellion
- Flame trail when moving fast: 3 orange-to-transparent arcs behind the vehicle
- Wheel rotation animation based on travel distance
- Driver cockpit: small dark rect with tiny circle windshield

### Viking
- **Assault mode**: completely different silhouette — two leg struts with flat foot plates, cannon arms extending forward
- **Fighter mode**: existing delta wing (already good)
- Engine glow in fighter mode: blue circle at rear
- Transformation pulse: yellow flash during state transition

### Battlecruiser
- Bridge superstructure: raised rect on top center
- Side weapons: 3 small rects per side
- Engine array: 3 blue-glow circles at rear (not 1)
- Hull plating lines: 4 horizontal lines across the triangle body
- Running lights: 2 tiny red/green dots blinking slowly (port/starboard)

---

## C.3 — Zerg Unit Visual Pass

### Zergling
- Speed lines: 3 short trailing lines when moving fast
- Clawed legs: each leg ends in 2-3 short diverging lines
- Eye glow: small red dot near front, pulsing with sin wave

### Baneling
- Acid drip: teardrop shape hanging from bottom
- Pre-explosion warning: when HP < 25%, faster pulse + red tinge to inner glow

### Hydralisk
- Scale texture: overlapping arc shapes along body
- Attack lunge: neck extends forward 3px when atkFlashTimer > 0
- Back spines: 2-3 small triangular spines along dorsal line

### Roach
- Regen glow: subtle green inner glow when regenerating (lastCombatTime > 3s)
- Armour segments: 3 vertical lines across carapace
- Eye stalks: 2 small circles with red dots above body

### Mutalisk
- Banking animation: slight roll based on velocity direction
- Glaive attack trail: brief green arc from beak to target when attacking
- Eye: single orange circle with pupil slit

### Queen
Currently falls through to default rendering. Full redesign:
- Tall upright body (taller than wide)
- Long scythe arms: two long curved lines extending upward from mid-body
- Crown of spines: 5-6 short triangular spines at top
- Egg sac abdomen: lower body is bulbous circle blending into rect
- Single large glowing purple eye at center

### Ultralisk
- Kaiser blades: proper blade shapes (wide base, tapering point, slight inward curve) replacing simple arc
- Four legs: 2 front + 2 rear, each ending in claw
- Dorsal spine ridge: raised fin along top
- Two bright red eyes near front

### Infestor
- Pulsing body: 0.5Hz sine wave on radius
- 4 tentacles in different directions, varying lengths
- Floating spore particles: 3-4 small circles drifting outward
- Dark arc mouth on front

---

## C.4 — Building Visual Pass

### Universal depth system for all buildings
Every building gets 3 layers:
1. Drop shadow (dark ellipse below, slight offset)
2. Wall face (base faction color)
3. Roof/upper face (base color + 0x111111 lighter, suggesting top surface)
4. Window/port details (small dark rects or circles)

### Terran buildings

**Command Center**: Orbital ring (thin ellipse around upper portion); landing pad guide lines on roof; antenna array (3-4 vertical lines of varying height); vents on sides.

**Barracks**: Door arch at base center; window row (3-4 dark rects along upper wall); production glow (subtle blue pulse at door when unit training).

**Factory**: Exposed gear shape on one side; smoke stack (thin rect with rising circle particles); loading dock at base.

**Starport**: Runway lights (alternating small circles on landing strip); control tower (thin vertical rect from center); radar dish on tower.

### Zerg buildings

**Hatchery** (biggest change needed):
- Organic mound: irregular polygon instead of rectangle
- Pulsing membrane top: animated ellipse with wavy outline
- Larva eggs: 1-3 small ellipses clustered near base when larvaCount > 0
- Creep veins: 3-4 branching thin lines extending from base

**Spawning Pool**:
- Bubbling liquid: 3-4 rising circle particles at different sizes
- Organic walls: wavy polygon outline
- Dark red inner fluid glow

---

## C.5 — Resource Node Visual Pass

### Mineral Patches
- Crystal cluster: 3-5 overlapping diamonds of varying heights instead of single shape
- Refraction shimmer: thin white highlight line on one edge
- Soft blue glow beneath cluster
- Depletion stages: crystal cluster loses height as `resourceRemaining` decreases (above 50% = full cluster, 25-50% = medium, <25% = stubby remnants)

### Vespene Geyser
- Irregular polygon mouth (not perfect circle)
- Gas jets: 3-4 small circles rising from mouth, alpha fading upward
- Larger ambient green halo

---

## C.6 — Environmental Visual Pass

### Ground tiles
- Subtle tile brightness variation (±5% random per tile, computed once at map gen, stored in tileVariation array)
- Very subtle dot pattern overlay at 0.04 alpha
- Darker edge shading on tiles adjacent to water

### Water
- Foam edges at water-ground boundaries
- Depth variation: tiles further from land are slightly darker
- Faint terrain color reflection at 0.15 alpha

### Creep
- Organic edge blending: tiles at creep boundary are lighter, deep creep is darker
- Vein network: thin branching lines connecting creep patches
- Very slow pulse (0.3Hz sine on overall alpha)

---

## C.7 — Effects Pass

### Death effects (unit-type specific)

**Mechanical** (SCV, Tank, Hellion, Cyclone, Thor, BC, Widow Mine, Viking):
- Expansion flash: large orange circle expanding to 2x unit size over 0.2s then fading
- Debris: 4-6 small dark rectangles flying outward at random angles, decelerating
- Smoke cloud: 2-3 expanding circles decreasing in opacity after flash

**Biological Terran** (Marine, Ghost, Reaper, Marauder, Medivac):
- Blood splatter: 4-6 small dark red circles at random offsets
- Forward collapse: slight forward translation while shrinking

**Zerg**:
- Acid splatter: 3-4 yellow-green dots around death position
- Dissolve: unit darkens and flattens (squish then fade)

**Baneling** (upgrade the existing explosion):
- Larger initial flash
- More debris (8-10 particles)
- Green acid circles radiating outward

### Explosion effects (Siege Tank, Baneling AoE)
- Screen-space shockwave ring: expanding circle from impact, fading over 0.3s
- Debris cloud at impact center
- Brief tile brightening within splash radius (0.1s)

### Ability effects
- **Fungal Growth**: pulsing green concentric rings from center with spike protrusions at ring edges
- **Corrosive Bile**: visible glowing green sphere in flight (use ProjectileRenderer extension)
- **Yamato Cannon**: thick orange beam (width 6) with bright white core (width 2), flashes and fades over 0.5s
- **Stim activation**: brief white flash before the orange ring settles

---

## C.8 — UI Visual Pass

### Health bars
- Segmented into 5 equal sections with thin gaps — losing a full segment is visually dramatic
- Brief white pulse when unit takes damage (damage flash on the bar itself)
- Upward arrow icon next to bar for regenerating units (Roach, Medivac-healed)

### Selection indicator
Replace the circle ring with SC2-style corner brackets (4 L-shapes at compass points):
```
Top-left:    moveTo(x - hw, y - hh + 4)  lineTo(x - hw, y - hh)  lineTo(x - hw + 4, y - hh)
Top-right:   symmetric
Bottom-left: symmetric
Bottom-right:symmetric
```
- Active subgroup (after Tab cycle): brighter color, slightly larger brackets

### Info panel
- Left border accent: changes color to faction primary (TERRAN_PRIMARY or ZERG_PRIMARY)
- Ability cooldown arc: pie-chart wedge on ability buttons showing remaining cooldown
- Stat icons: small geometric shapes instead of text labels (sword = dmg, shield = armor)
- Panel fade-in: content fades in over 0.15s on selection change (CSS transition)

### HUD resource bar
- Mineral icon: small blue diamond shape (Canvas 2D drawn once)
- Gas icon: small green hexagon
- Supply bar: visual fill bar showing percentage to supply cap
- Low supply warning: supply bar turns red + pulses when >= 85% full

---

## C.9 — Colour Palette Codification

Add these constants to `src/constants.ts` and use throughout (replace inline hex values):

```typescript
// Terran
export const TERRAN_PRIMARY   = 0x2266aa; // armour base
export const TERRAN_LIGHT     = 0x4488cc; // highlights
export const TERRAN_DARK      = 0x112244; // shadows
export const TERRAN_VISOR     = 0x00eeff; // Marine visor, energy effects
export const TERRAN_WARNING   = 0xff6622; // damage, alerts
export const TERRAN_METAL     = 0x445566; // weapons, machinery

// Zerg
export const ZERG_FLESH       = 0x882244; // unit base
export const ZERG_LIGHT       = 0xaa4466; // highlights
export const ZERG_SHADOW      = 0x330011; // deep shadow
export const ZERG_ACID        = 0x88ff22; // Baneling, Bile, Fungal effects
export const ZERG_CREEP_COLOR = 0x6600aa; // creep overlay
export const ZERG_EYE_COLOR   = 0xff2200; // eye glow

// Resources / neutral
export const MINERAL_CRYSTAL  = 0x44aaff;
export const GAS_GREEN        = 0x44ff88;
export const NEUTRAL_STONE    = 0x888888;
```

---

## Iteration C — Sprint Order

| # | Item | Effort | Visual Impact |
|---|------|--------|--------------|
| C.9 | Colour palette codification | 1h | ★★★★ (cohesion throughout) |
| C.1 | Marine complete redesign (22-layer) | 4h | ★★★★★ |
| C.8 | Health bar segments + selection brackets | 2h | ★★★★ |
| C.2 | Terran unit pass (SCV, Marauder, Medivac, Viking, BC) | 3h | ★★★★ |
| C.3 | Zerg unit pass (Queen, Ultralisk, Infestor priority) | 3h | ★★★★ |
| C.4 | Building visual pass | 3h | ★★★ |
| C.7 | Effects (death particles, explosions, ability visuals) | 3h | ★★★★ |
| C.5 | Resource node visual pass | 1h | ★★★ |
| C.6 | Environmental pass (tiles, water, creep) | 2h | ★★★ |
| C.8 | Info panel + HUD icons | 2h | ★★★ |

**Total: ~2.5 days**

---

## Combined 3-Iteration Roadmap (5 days)

```
Day 1: B.1 base defense + B.3 faster pressure + B.9 cross-map routing
       + A.2 control group UI strip + A.1 Ctrl+click type-select

Day 2: B.6 persistent harassment + B.4 expanded AI base + B.2 vanguard
       + C.9 colour palette + C.1 Marine redesign (22-layer)

Day 3: A.3 portraits + A.5 Tab count display + A.4 subgroup ability panel
       + C.8 health bar segments + selection brackets

Day 4: B.5 reactive intel + B.7 AI abilities + B.8 escalating late-game
       + C.2 Terran visual pass + C.3 Zerg visual pass

Day 5: C.4 buildings + C.7 effects + C.5 resources + C.6 environment
       + C.8 UI polish + A.6 hotkey panel

---

---

# Iteration D — Sound Design & Audio Depth

## D.1 — Unit Voice Lines (Web Speech API)

The game has procedural audio but no voice feedback. SC2's unit voices ("Hell, it's about time!", "Nuclear launch detected") are a core part of feel.

Use the browser's `speechSynthesis` API to generate unit acknowledgment lines. No audio assets needed.

**Per-unit acknowledgment lines (on selection):**

| Unit | Lines (cycle randomly) |
|------|----------------------|
| Marine | "Sir, yes sir." / "Ready to rock." / "Need something?" |
| Marauder | "That all you got?" / "Locked and loaded." |
| SiegeTank | "Tank online." / "Locked in position." |
| Ghost | "Orders received." / "Silent and deadly." |
| Medivac | "Medical support standing by." / "All hands, report." |
| SCV | "Yes? What?" / "I'm on it." |
| Zergling | (chittering sound via oscillator — no speech) |
| Hydralisk | (hissing breath — no speech) |
| Queen | "The brood calls." / "By the Swarm." |
| Overlord | (low rumble — no speech) |

**On command (RMB move):**
- Marine: "Move it!" / "Affirmative." / "Roger that."
- SCV: "You got it." / "Right away."
- Ghost: "Acknowledged." (whispered, low volume)

**Implementation:**
Add `voiceSystem(unitTypeId: number, eventType: 'select' | 'command'): void` to `SoundManager.ts`. Use `speechSynthesis.speak(new SpeechSynthesisUtterance(line))` with rate 1.1, pitch 0.9, volume 0.6. Throttle to 1 utterance per 1.5s to prevent overlap. Pick random line from the unit's pool each call.

**Files:** `src/audio/SoundManager.ts`, `src/systems/SelectionSystem.ts`, `src/input/CommandQueue.ts` (CommandSystem move handling)

---

## D.2 — Ambient Battlefield Sounds

The map should feel alive even when nothing is happening.

**Ambient tracks (Web Audio API, generated procedurally):**

- **Terran base ambient**: low industrial hum (50Hz sine + slight noise, volume 0.03). Plays when camera is near CC.
- **Zerg base ambient**: organic breathing pulse (0.4Hz LFO on noise, 80-200Hz band-pass). Plays near Hatchery.
- **Combat ambient**: when any unit within 15 tiles is in combat, layer a bass rumble (layered sine waves 40-80Hz, random amplitude modulation).
- **Mineral mining loop**: faint rhythmic tap when workers are active (short noise burst every 2.2s).

**Implementation:** Add `ambientAudioSystem(world, gameTime)` to `SoundManager.ts`. Uses `AudioContext.createOscillator` and `createBufferSource` with looping noise buffers. Called from `Game.render()` — ambient is render-rate, not tick-rate.

---

## D.3 — Positional Audio Fade

Currently sounds play at constant volume regardless of camera position. Real positional audio would use `PannerNode` but that requires knowing screen position — complex.

**Simplified solution:** For attack sounds, scale volume by proximity of the attack to the camera center:
```
distance = sqrt((posX - cameraX)^2 + (posY - cameraY)^2)
volume = max(0, 1 - distance / (15 * TILE_SIZE))
```
Pass this as a volume multiplier to `soundManager.playAttack()`. Attacks far off-screen are barely audible; nearby fights are full volume.

**Files:** `src/audio/SoundManager.ts`, `src/systems/CombatSystem.ts`

---

## D.4 — Ability Sound Effects

Most abilities are silent. Add:

| Ability | Sound |
|---------|-------|
| Stim Pack | Sharp rising hiss (filtered noise, 0.15s) |
| Siege Mode | Heavy clunk + hydraulic hiss (two tones, 0.4s) |
| Yamato Cannon | Deep bass boom + high-pitched zap (0.8s) |
| Corrosive Bile (impact) | Wet splat + sizzle (noise burst, 0.3s) |
| Fungal Growth | Rising organic tone + root sound (0.6s) |
| Inject Larva | Soft wet thud (0.15s) |
| Ghost Cloak | Phase-shift shimmer (short chorus effect, 0.2s) |
| Abduct | Wind rush + thud (0.4s) |

**Files:** `src/audio/SoundManager.ts`, `src/systems/AbilitySystem.ts`, `src/systems/CommandSystem.ts`

---

## D.5 — Music System (Adaptive Layer Approach)

SC2's music intensifies during combat. Implement a 3-layer adaptive system:

**Layer 1 — Base layer (always playing):** Slow, atmospheric drone. 3 sustained oscillators at 80Hz, 120Hz, 160Hz with very slight detuning and slow LFO (0.05Hz). Volume 0.06.

**Layer 2 — Tension layer (when enemy spotted or wave approaching):** Rhythmic percussive element. Short noise bursts at 2.5 beats/sec with high-pass filter. Fades in over 3s when `aiState.isAttacking || distanceToEnemy < 20 tiles`. Volume 0.04.

**Layer 3 — Combat layer (active fighting):** Higher-frequency saw wave (200Hz), rhythmically gated with `combatIntensity > 0`. Fades in as `damageEvents.length` increases. Volume 0.03.

**Smooth crossfading:** Each layer uses a `GainNode` with `gain.linearRampToValueAtTime()` for smooth 2-3s transitions. No abrupt changes.

**Files:** `src/audio/SoundManager.ts`, `src/Game.ts`

---

---

# Iteration E — Game Systems Depth

## E.1 — Camera System Improvements

### Smart Camera Framing
When a unit is attacked and the player is not looking at it, the current system shows a text alert. Add:
- **Soft nudge**: if the alert point is within 15 tiles of current camera center, gently pan toward it (not a jump) over 0.8s
- **Combat zoom-out**: when 10+ units are in combat within the current view, gradually zoom out to show more of the battle (reduce zoom to max(currentZoom - 0.2, MIN_ZOOM) over 1s)
- **Idle zoom-in**: when camera is stationary with nothing happening nearby, slowly creep toward normal zoom over 3s

### Camera Shake Improvements
Current camera shake applies to `app.stage`. Extend:
- **Directional shake**: nuclear explosion at top-right → camera shakes more up-right
- **Decay curve**: instead of linear decay, use a smooth exponential decay
- **Screen-edge vignette**: when camera shake > 2px, darken the screen edges slightly (CSS vignette on overlay div)

**Files:** `src/Game.ts`, `src/rendering/CameraShake.ts`

---

## E.2 — Unit Interaction Depth

### Medivac Load/Unload
Currently Medivacs can "follow" units. Add proper load/unload:
- `CommandType.Load = 26`: target-click on a biological unit while Medivac selected → unit enters Medivac, invisible, Medivac carries capacity up to 8 supply
- `CommandType.Unload = 27`: press U key while Medivac selected → drops all cargo at current position
- Medivac shows cargo count on its unit icon

**Files:** `src/ecs/components.ts` (cargoEids array), `src/systems/CommandSystem.ts`, `src/rendering/UnitRenderer.ts`

### Unit Stacking Prevention
Currently separation physics prevents units from stacking but it's reactive. Add:
- When a move order is issued to a position occupied by friendly units, automatically offset the destination by 1-2 tiles for each unit in the group (already partially done via formation spacing in CommandSystem — improve the formation algorithm)
- **Concave formation**: when attacking, units form a semi-circle facing the target (not a square grid), maximising the number of units that can fire simultaneously

### Friendly Fire Toggle
A `ffEnabled: boolean` game option — when true, splash damage (Siege Tank, Baneling) also damages friendly units. Off by default. This adds a strategic layer: friendly banelings can kill friendly marines. Already partially works since splash doesn't check faction.

---

## E.3 — Fog of War Improvements

### Last Known Position
When an enemy unit was visible but moves into fog, leave a ghost (semi-transparent, frozen) at its last known position for 3s. This is how SC2 handles it.

**Implementation:**
- New array: `lastKnownX: Float32Array`, `lastKnownY: Float32Array`, `lastKnownTime: Float32Array`
- In `FogSystem`, when a unit transitions from visible → not visible: record `lastKnownX/Y/Time[eid] = current position/gameTime`
- In `UnitRenderer`, render "ghost" units at `lastKnownX/Y` at 20% alpha when `!isTileVisible` and `gameTime - lastKnownTime < 3`

**Files:** `src/ecs/components.ts`, `src/systems/FogSystem.ts`, `src/rendering/UnitRenderer.ts`

### Vision Blockers
Cliffs and rock formations should block line of sight, not just limit range. This is complex to implement fully, but a simplified version:
- Tiles adjacent to rocks have 50% reduced vision range (pass through the blocker check in FogSystem)
- Units standing ON a high-ground tile (if elevation system were added) see further

---

## E.4 — Game Modes

### Sudden Death Mode
When enabled: mineral and gas income is doubled but all buildings are destructible in 2 hits (HP reduced 80%). Creates fast, explosive games. Toggle in Advanced Settings.

### Fog of War Off
Already implemented (`fogEnabled` flag). Make it more prominent in the UI with a label "Fog: ON/OFF" in the game HUD and a toggle key (`F9`).

### Turbo Mode
Game speed locked to 2x (no player adjustment). Banner at top: "TURBO". Useful for quick AI testing. Accessible from Advanced Settings.

### Mirror Match
Force both factions to be the same race (both Terran or both Zerg). The AI plays the same faction as the player, making it a true skill test against the same unit set.

---

## E.5 — Minimap Intelligence

The minimap currently shows unit dots and buildings. Add:

**Threat overlay:** When AI units are visible to the player, draw their projected attack path as a faint arrow on the minimap pointing from AI base toward player base. Updates when AI army moves.

**Economic overlay toggle (Tab on minimap):** Cycle through minimap display modes:
1. Normal (unit dots + buildings)
2. Economy (mineral income per patch, worker coverage)
3. Military (army value indicators, control zone circles)

**Ping system:** Teammate-style pings (for future multiplayer). Press `G` while hovering over minimap to place a ping at that location. Pings appear as expanding circles on both minimap and main viewport.

---

## E.6 — Unit Veterancy System

Units that survive and accumulate kills should become more powerful. This already partially works (`killCount` is tracked) but nothing uses it.

**Veterancy levels:**
| Level | Kills required | Bonus |
|-------|---------------|-------|
| Novice | 0 | base stats |
| Veteran | 4 | +10% HP, damage +1 |
| Elite | 10 | +20% HP, damage +2, +1 armor |
| Hero | 20 | +30% HP, damage +3, +2 armor, speed +10% |

**Visual indicator:** A small star badge next to the unit's health bar (1-3 stars based on level). In the info panel: "Elite Marine ★★★".

**Implementation:**
- `veterancyLevel: Uint8Array` computed from `killCount` in a new system or lazily in `InfoPanelRenderer`
- Bonuses applied in `spawnUnitAt` are base stats — veterancy applies on-top via multipliers checked in `CombatSystem` damage calculation
- The star badges are simple 5-pointed star paths drawn in `UnitRenderer`

**Files:** `src/ecs/components.ts` (veterancyLevel), `src/systems/CombatSystem.ts`, `src/rendering/UnitRenderer.ts`, `src/rendering/InfoPanelRenderer.ts`

---

## E.7 — Creep Highway System (Zerg QoL)

Zerg units on creep get +30% speed (already implemented). But creep only spreads from buildings slowly. Add a **Creep Highway** mechanic:

The Queen can place **Creep Tumors** (C key while Queen selected, click target):
- Cost: 25 energy
- A Creep Tumor entity spawns at the target
- After 11s it becomes active and starts spreading creep (6-tile radius)
- Active tumors can spawn additional tumors within their creep radius (C key on the tumor)

This creates an expanding Zerg creep network that the player can build intentionally as a movement highway, which also reveals terrain (tumors have 2-tile vision).

**Files:** `src/input/CommandQueue.ts` (`CreepTumor = 28`), `src/input/InputProcessor.ts`, `src/systems/CommandSystem.ts`, `src/systems/CreepSystem.ts`, `src/rendering/UnitRenderer.ts`

---

## Combined 5-Iteration Roadmap (8 days)

```
Day 1: B.1-B.3-B.9 (AI critical: defense, pressure, cross-map routing)
       + A.2 (control group UI) + A.1 (Ctrl+click)

Day 2: B.6-B.4-B.2 (persistent harassment, expanded base, vanguard)
       + C.9 (palette) + C.1 (Marine redesign)

Day 3: A.3-A.5-A.4 (portraits, tab display, subgroup abilities)
       + C.8 (health bars, selection brackets)

Day 4: B.5-B.7-B.8 (reactive AI, ability usage, escalation)
       + C.2-C.3 (Terran + Zerg unit passes)

Day 5: C.4-C.7-C.5-C.6 (buildings, effects, resources, environment)
       + C.8-A.6 (UI polish, hotkeys)

Day 6: D.1-D.2-D.3 (voice lines, ambient, positional audio)
       + D.4-D.5 (ability sounds, adaptive music)

Day 7: E.1-E.2-E.3 (camera, unit depth, fog improvements)
       + E.6 (veterancy system)

Day 8: E.4-E.5-E.7 (game modes, minimap intelligence, creep highway)
       + Final QA pass + push

---

---

# Iteration F — Tech Tree UI & Build Menu Clarity

## Audit Findings

The tech tree logic itself is **correct and bug-free** — prerequisites gate buildings properly through `isTechAvailable()` → `hasCompletedBuilding()`. The problem is purely **UI communication**:

- Locked buildings show as greyed-out text with a subtle red border tint — **not obvious enough**
- No text tells the player WHY a building is locked
- No tooltip or label says "Requires: Barracks"
- The Zerg build menu always shows all 3 buildings as available (no dynamic prerequisites)
- Missing Zerg tech buildings: RoachWarren, HydraliskDen, Spire, InfestationPit are not defined

---

## F.1 — Build Menu Prerequisite Labels

**Problem:** When Factory is locked (grey, red tint), there is no text explaining why. Players don't know they need to build a Barracks first.

**Fix:** In `BuildMenuRenderer.ts`, when a building's tech is not available, append a "Req: [BuildingName]" line below the cost:

```
5: Factory (150m/100g)
   Req: Barracks
```

**Implementation:**
- In `update()`, for each slot where `!techOk`, look up `BUILDING_DEFS[bType].requires`
- Map the required `BuildingType` to its name via `BUILDING_DEFS[requiresType].name`
- Update the option element's innerHTML to include a second smaller line:
  ```html
  5: Factory (150m/100g)<br><span style="color:#884444;font-size:9px">Req: Barracks</span>
  ```

**Files:** `src/rendering/BuildMenuRenderer.ts`

---

## F.2 — Build Menu Ghost Preview on Locked Buildings

**Problem:** Pressing `5` when Factory is locked does nothing silently. Players think the key doesn't work.

**Fix:** When the player presses a digit key for a locked building, flash the menu slot briefly red and show a tooltip "Build Barracks first" for 2 seconds.

**Implementation:**
- In `Game.handleBuildPlacement()`, when `!this.isTechAvailable(bType)`, set a `lockedFlashTimer` and `lockedFlashMessage` on `BuildMenuRenderer`
- `BuildMenuRenderer` shows the flash via a brief red border pulse and a tooltip div that appears for 2s then fades

**Files:** `src/Game.ts`, `src/rendering/BuildMenuRenderer.ts`

---

## F.3 — Tech Tree Visual Diagram in Build Menu

Add a small visual tech tree indicator at the top of the build menu showing the current unlock progression:

```
CC → Supply → Barracks → Factory → Starport
                       ↘ Eng Bay
```

Each building in the tree is a small colored dot: green = built, yellow = affordable but not built, grey = locked. The current hover/selected building is highlighted.

**Implementation:**
- New `renderTechTree()` method in `BuildMenuRenderer` using HTML/CSS
- A `<div>` row at the top of the menu panel with 7 small circles connected by lines
- Updates every frame via `update()`

**Files:** `src/rendering/BuildMenuRenderer.ts`

---

## F.4 — Missing Zerg Tech Buildings

**Problem:** RoachWarren, HydraliskDen, Spire, and InfestationPit are not defined in `buildings.ts`, so Roach/Hydralisk/Mutalisk/Infestor units are only buildable via Hatchery with no tech gate.

**Fix:** Add these buildings to `buildings.ts` and wire them into the Zerg build menu.

| Building | BuildingType | Prereq | Unlocks | Cost | Size |
|----------|-------------|--------|---------|------|------|
| RoachWarren | 34 | SpawningPool | Roach, Ravager | 150m/0g | 2×2 |
| HydraliskDen | 35 | Hatchery | Hydralisk, Lurker | 100m/100g | 2×2 |
| Spire | 36 | Hatchery | Mutalisk, Corruptor | 200m/200g | 2×2 |
| InfestationPit | 37 | Lair (→ Hive) | Infestor, Viper | 100m/100g | 2×2 |

For Lair (BuildingType 38): Hatchery morphs into Lair for 150m/100g. This unlocks T2 Zerg tech. Simplification: make Lair a separate building instead of a morph, placed on top of an existing Hatchery tile.

**Zerg build menu update:** Replace the 3-slot always-available menu with a proper 7-slot menu:
- 1: Hatchery
- 2: SpawningPool
- 3: RoachWarren (req: SpawningPool)
- 4: HydraliskDen (req: Hatchery)
- 5: Spire (req: Hatchery)
- 6: EvolutionChamber (req: SpawningPool)
- 7: InfestationPit (req: SpawningPool)

In `getTechAvailability()`, update the Zerg branch to check actual prerequisites instead of always returning `true`.

**Production gating:** Update Hatchery's produces array to only show units the player has tech for:
- Roach/Ravager: only if RoachWarren is built
- Hydralisk/Lurker: only if HydraliskDen is built
- Mutalisk/Corruptor: only if Spire is built
- Infestor/Viper: only if InfestationPit is built
- Queen/Overlord/Zergling/Drone: always available

In `InfoPanelRenderer.updateProductionButtons()`, filter the `produces` array by tech availability before showing buttons.

**Files:** `src/constants.ts`, `src/data/buildings.ts`, `src/Game.ts`, `src/rendering/BuildMenuRenderer.ts`, `src/rendering/InfoPanelRenderer.ts`

---

## F.5 — Production Button Tech Gating

**Problem:** Even with no tech buildings, a player can click the Infestor button on the Hatchery info panel and queue one (the button shows but produces nothing useful without InfestationPit).

**Fix:** In `InfoPanelRenderer.updateProductionButtons()`, for each unit in `def.produces`, check if the unit's tech prerequisite is met before showing the button. Units whose tech building isn't built should show as locked (grey, no hover) with tooltip "Requires InfestationPit".

The check: define a `getUnitTechReq(uType: UnitType): BuildingType | null` lookup table mapping each unit to its required building. If the requirement isn't met, render the button as locked.

**Files:** `src/rendering/InfoPanelRenderer.ts`, new `src/data/unitTechReqs.ts` lookup

---

## F Sprint Order

| # | Item | Effort | Why |
|---|------|--------|-----|
| F.1 | Prerequisite labels in build menu | 1h | Most important UX fix — tells player what to build |
| F.2 | Locked building flash + tooltip | 30min | Silences the "my keys don't work" confusion |
| F.4 | Missing Zerg tech buildings | 3h | Zerg has no tech tree without these |
| F.5 | Production button tech gating | 1h | Prevents confusing locked production |
| F.3 | Tech tree visual diagram | 2h | Nice-to-have — visual guide to the tree |

**Total: ~7.5 hours (1 day)**

---

---

# Iteration G — Multiplayer Foundation

## G.1 — Deterministic Validation & Lockstep Harness

The deterministic RNG (seeded LCG) and command recorder already exist from Phase 9. Before WebRTC, validate determinism locally with a split-screen test mode:

- Start two `Game` instances in the same browser tab, side by side
- Both seeded with the same value
- Player 1 input → broadcast to both instances simultaneously
- After 60s, compare `world.nextEid` and a hash of all `posX`/`posY`/`hpCurrent` arrays
- If identical: determinism confirmed, safe to proceed to networking

**New `DeterminismTestHarness.ts`:** Runs the comparison and displays a pass/fail overlay.

## G.2 — WebRTC Signaling Server (Node.js)

A minimal signaling server to exchange WebRTC offer/answer. Deployable to Railway or Render free tier.

**`server/signaling.ts`** — ~80 lines:
```
Express app + ws (WebSocket library)
POST /room/:id/offer   → stores SDP offer
GET  /room/:id/offer   → retrieves SDP offer
POST /room/:id/answer  → stores SDP answer
GET  /room/:id/answer  → retrieves SDP answer
POST /room/:id/ice     → appends ICE candidate
GET  /room/:id/ice     → returns all ICE candidates
```

**Client-side `src/network/WebRTCClient.ts`:**
- `createRoom()` → generates 6-char alphanumeric code, creates RTCPeerConnection, posts offer
- `joinRoom(code)` → fetches offer, creates answer, posts it
- Once data channel is open: `send(GameCommand[])` / `onReceive(callback)`

## G.3 — Lockstep Game Loop Integration

Replace the single-player input loop with a lockstep loop:

```
Frame:
  1. Collect local commands this frame (already in simulationQueue)
  2. Serialize + send to remote peer via data channel
  3. Wait for remote commands (with 2-tick input delay buffer)
  4. Execute both players' commands deterministically (sorted by type+eid for consistency)
  5. Advance simulation
```

**`src/network/LockstepManager.ts`:**
- `INPUT_DELAY = 2` ticks (33ms at 60 UPS — imperceptible)
- `pendingLocal[][]` and `pendingRemote[][]` ring buffers (8 slots each)
- `update(tick)` returns merged command set for this tick or `null` if remote not arrived (freeze simulation)
- Handles desync detection: hash world state every 30 ticks, compare with peer

## G.4 — Lobby UI

**Start screen additions:**
- "Multiplayer" section below single-player options
- "Create Game" button → shows 6-char room code + "Waiting for opponent..."
- "Join Game" input → enter code, click Join
- Faction/map selection before both players ready
- "Ready" button → both must click before game starts
- Connection status indicator (pulsing dot: yellow=connecting, green=connected)

## G.5 — Reconnection & Desync Recovery

- If connection drops mid-game: 10s reconnection window with countdown
- On desync detection: request full state snapshot from peer, re-apply
- Replay system already records all commands — desync recovery replays from last checkpoint

---

# Iteration H — Campaign Mode

## H.1 — Campaign Framework

**`src/scenarios/CampaignManager.ts`:**
```typescript
interface CampaignMission {
  id: string;
  faction: Faction;
  mapType: MapType;
  objectives: MissionObjective[];
  startingUnits: { type: UnitType, col: number, row: number }[];
  startingResources: { minerals: number, gas: number };
  scriptedEvents: ScriptedEvent[];
  dialogue: DialogueLine[];
  rewards: { unlocks?: string[], story?: string };
}
```

All missions defined in `src/scenarios/missions/` as data files (no code logic in mission files).

## H.2 — Terran Campaign (5 missions)

| # | Name | Premise | Key mechanic taught |
|---|------|---------|-------------------|
| T1 | First Contact | Defend 3 waves with a small squad — no build | Combat micro, hold position, attack-move |
| T2 | Establish Base | Build a base under pressure; first Barracks | Economy, production, build order |
| T3 | Break the Line | Enemy has a defended choke — use Siege Tanks | Siege positioning, slow push |
| T4 | Air Superiority | Enemy has Mutalisks — must build Vikings/Thors | Air defense, mixed armies |
| T5 | Total War | Full tech, full army — destroy all 3 Zerg bases | Everything |

## H.3 — Zerg Campaign (5 missions)

| # | Name | Premise | Key mechanic taught |
|---|------|---------|-------------------|
| Z1 | Hatching | 1 Hatchery, 4 Larva, survive first wave | Larva inject, Zergling flood |
| Z2 | Consume | Destroy a Terran expansion before they fortify | Aggression timing, map control |
| Z3 | The Swarm Rises | Build RoachWarren, mass Roach-Ravager push | Corrosive Bile, formation attack |
| Z4 | Infestation | Use Infestors to capture Terran units | Fungal Growth, Neural Parasite |
| Z5 | Final Evolution | Full tech, all unit types — total annihilation | Creep highways, Ultralisk, Viper |

## H.4 — Scripted Events System

**`src/scenarios/ScriptedEvent.ts`:**
```typescript
type EventTrigger =
  | { type: 'time'; at: number }
  | { type: 'unitDied'; unitType: UnitType; faction: Faction }
  | { type: 'buildingBuilt'; buildingType: BuildingType }
  | { type: 'allObjectivesComplete' };

interface ScriptedEvent {
  trigger: EventTrigger;
  action: 'spawnUnits' | 'showDialogue' | 'panCamera' | 'lockControls' | 'winMission' | 'loseMission';
  data: unknown;
}
```

**Dialogue system:** Fullscreen-bottom text box with speaker portrait (geometric shape per character), character name, auto-advance after 4s or on click. 2-3 dialogue lines per mission at key moments.

## H.5 — Mission Select Screen

Branching mission tree (SC2-style):
- Terran/Zerg campaign tabs
- Missions unlock sequentially (complete T1 → T2 available)
- Each mission shows: status (locked/available/completed), objectives preview, best time
- Completion rewards shown: "Unlocks: Viking unit" for context

---

# Iteration I — Map Editor

## I.1 — In-Game Map Editor Mode

Accessible from the start screen: "Edit Map" button. Opens the game in editor mode.

**Editor tools (keyboard shortcuts):**
- `1-9`: paint tile type (ground, water, cliff, mineral, gas, destructible, creep)
- `Shift+click`: place/remove unit spawn points
- `Ctrl+S`: save map to `localStorage` as JSON
- `Ctrl+L`: load map from `localStorage`
- `E`: export map JSON to clipboard
- `I`: import map JSON from clipboard
- `R`: reset to blank map

**Editor HUD overlay:**
- Current tool indicator (top-left)
- Tile coordinate display (cursor position)
- Minimap showing current painted terrain
- Undo/redo (Ctrl+Z / Ctrl+Y) — store up to 50 tile edits in history stack

## I.2 — Custom Map Format

```typescript
interface CustomMap {
  version: 1;
  cols: number;
  rows: number;
  tiles: number[];           // flat Uint8Array serialized
  mineralPatches: { col: number, row: number, amount: number }[];
  gasGeysers: { col: number, row: number }[];
  startPositions: { faction: number, col: number, row: number }[];
  name: string;
  author: string;
  createdAt: string;
}
```

Maps stored in `localStorage['swarm_maps']` as a JSON array. Up to 10 custom maps supported.

## I.3 — Community Map Sharing

Via URL hash: encode map JSON as base64, append to URL as `?map=<base64>`. Shareable link opens the game with that map loaded automatically. No server required.

`src/map/MapSerializer.ts`: `toBase64(map) / fromBase64(b64)` using `btoa` / `atob`.

---

# Iteration J — Advanced Unit Mechanics

## J.1 — Burrowing (Roach, Lurker, Widow Mine generalization)

Currently Widow Mine and Lurker auto-burrow. Generalize into a proper burrowing system:

- New `CommandType.Burrow = 30` / `CommandType.Unburrow = 31`
- `burrowToggle: Uint8Array` component — 0=unburrowed, 1=burrowing, 2=burrowed
- `burrowTimer: Float32Array` — time to complete burrow/unburrow (1s)
- Burrowed units: invisible to enemies, cannot move, regenerate HP faster
- `D` key → burrow/unburrow selected Zerg units

**Units that can burrow:** Roach, Hydralisk, Zergling (with upgrade), Infestor, Lurker.

## J.2 — Morph System (Zerg)

Generalise Baneling morphing (Zergling → Baneling) and Ravager (Roach → Ravager) into a proper morph system:

```typescript
interface MorphDef {
  fromType: UnitType;
  toType: UnitType;
  costMinerals: number;
  costGas: number;
  morphTime: number;  // seconds
  requires?: BuildingType;
}
```

New `CommandType.Morph = 32` — right-clicking a morph option on the info panel triggers it. During morphing, unit shows a construction-style animation (pulsing + partial transparency). Unit is immobile during morph.

**Active morphs:** Zergling→Baneling (already works), Roach→Ravager (already works), Hydralisk→Lurker, Corruptor→Brood Lord (future).

## J.3 — Flying Unit Landing

Vikings switch between air/ground. Extend to allow Medivacs to "land" (transition to a stationary healing pad that heals faster but can't move). Toggle with `E` while Medivac selected.

## J.4 — Unit Abilities: Second Pass

Missing ability buttons for several units that have passive abilities but no active ones. Add actives:

| Unit | New Ability | Key | Effect |
|------|------------|-----|--------|
| Reaper | KD8 Grenade | D | Throw grenade at target location: 10 dmg in 1.5 tile radius, 14s cooldown |
| Thor | Strike Cannons | W | Switch between ground attack (30 dmg Explosive vs Armored) and anti-air (25 dmg splash to 6 air targets) |
| Battlecruiser | Tactical Jump | T | Teleport to any visible location, 71s cooldown |
| Hydralisk | Muscular Augments | (passive) | Upgrade at HydraliskDen: +0.7 speed on creep off-creep too |
| Ultralisk | Chitinous Plating | (passive) | 2 extra armor on top of base |

---

# Iteration K — Economy Depth

## K.1 — Orbital Command

Terran Command Center upgrades to Orbital Command for 150m. This is Terran's equivalent of Queen inject — critical macro ability.

**Orbital Command abilities:**
- **MULE (Ctrl+Click mineral patch):** Drops a worker robot that mines 30 minerals/trip for 90s (total ~270 minerals). Costs 50 energy.
- **Scanner Sweep (V):** Reveals a large area of fog for 12s. Costs 50 energy.
- **Extra Supply (passive if not using other calldowns):** Saves energy for MULE spam.

**Implementation:**
- New `orbitalMode: Uint8Array` per building entity (0=CC, 1=Orbital)
- New `CommandType.Upgrade = 33` for CC→Orbital
- `orbitalEnergy: Float32Array` (same `energy[]` component reuse)
- MULE spawns a temporary SCV entity with TTL timer (`muleExpiry: Float32Array`)

## K.2 — Multiple Expansions

The map has one natural expansion (close to player base). Add a proper expansion flow:

- Natural expansion: (col 30, row 15) for Terran player — 6 mineral patches pre-placed
- Third base: (col 50, row 50) — 8 patches, farther and more exposed
- Game notifies "Expansion available" when player army is large enough to defend one

**Expansion HUD indicator:** Small icon on minimap at expansion locations. Pulsing yellow when uncontested, green when player has a building there, red when AI has claimed it.

## K.3 — Worker Efficiency Improvements

Current: workers mine forever at constant rate. Add SC2-style saturation dynamics:

- **Optimal saturation:** 2 workers per mineral patch = 16 per base (already tracked)
- **Over-saturation penalty:** Already implemented. Make more visible: show "SATURATED" label in amber on the worker count HUD element.
- **Auto-transfer:** New button in HUD — "Balance Workers" — redistributes workers between bases to optimal saturation
- **Mining rate display:** Show actual minerals/min rate next to the mineral count (already partially implemented in income display)

## K.4 — Vespene Gas Refineries

Current: Refinery just provides gas. Add proper gas mechanics:

- Maximum 3 workers per Refinery (currently uncapped for gas)
- Show worker count on Refinery in info panel: "Workers: 2/3"
- Add a hotkey to auto-assign workers to gas (right-click refinery with workers selected already works — polish the feedback)

---

# Iteration L — Competitive Features

## L.1 — ELO / MMR System (Local)

Single-player against AI earns "Skill Points" stored in localStorage:

```typescript
interface PlayerProfile {
  skillPoints: number;
  wins: Record<Difficulty, number>;
  losses: Record<Difficulty, number>;
  avgAPM: number;
  totalGames: number;
  bestWinTime: number;  // seconds
  favoriteUnit: UnitType;  // most killed
}
```

Display in a "Profile" panel accessible from the start screen. Skill Points increase on win (more on Hard/Brutal), decrease on loss.

## L.2 — Win Conditions Variety

Beyond "destroy all enemy buildings":

- **Time Attack:** Destroy main base within N minutes (timed leaderboard)
- **Economic Victory:** Reach 5000 total minerals gathered before opponent
- **Survival:** Survive N waves without losing your Command Center
- **Skirmish:** Preset armies, no building, micro-only — whoever kills all enemy units wins

Selectable from Advanced Settings via a "Victory Condition" dropdown.

## L.3 — Achievements

25 in-game achievements stored in localStorage:

| Achievement | Condition |
|------------|-----------|
| "Hell, it's about time!" | Win first game |
| "Speed Runner" | Win in under 3 minutes |
| "Fortress" | Survive 10 waves without losing a building |
| "Stimmy" | Use Stim Pack 50 times in one game |
| "Swarm" | Have 30 Zerglings alive at once |
| "Tank Commander" | Kill 100 enemies with Siege Tanks |
| "APM Machine" | Achieve 200+ APM in a game |
| "Economic Miracle" | Gather 10,000 minerals in one game |
| "No Mercy" | Win on Brutal difficulty |
| "Micromanager" | Win without losing a single unit |

Show unlock toast notification + persist to localStorage.

---

# Iteration M — Content Expansion (New Units)

## M.1 — Terran: Banshee

Cloaked air-to-ground attack aircraft.

- **Stats:** HP 140, 12 dmg (Normal, air-to-ground only), range 6, speed 3.75, cooldown 800ms, isAir=1
- **Ability — Cloak:** Same as Ghost, costs 1 energy/s while cloaked
- **Produces from:** Starport (add to produces array)
- **Tech requirement:** Starport + Tech Lab

## M.2 — Terran: Liberator

Anti-air fighter that transforms into an area-denial siege weapon.

- **Fighter mode:** Air-to-air only, 75 dmg Normal, range 5
- **Defender mode (E):** Becomes stationary, attacks a targeted circle on the ground with 85 dmg Explosive in a 1.5 tile radius. No-fly zone for AI.
- **Produces from:** Starport

## M.3 — Zerg: Brood Lord

Corruptor morphs into Brood Lord (heavy siege flyer).

- **Stats:** HP 225, 20 dmg Normal, range 9 (ranged air-to-ground), speed 1.875, isAir=1
- **Broodlings:** Each attack spawns 2 Broodling units (small weak melee) at impact point
- **Morph from:** Corruptor (costs 150m/150g, 34s)
- **Requires:** Spire + Hive (late-game unit)

## M.4 — Zerg: Swarm Host

Stationary burrower that produces Locusts.

- **Stats:** HP 160, no direct attack, speed 2.25, burrowing unit
- **Ability — Spawn Locust (passive):** Every 30s while burrowed, spawns 2 Locust units (melee, last 25s, cost 0)
- **Produces from:** Hatchery (requires Infestation Pit)

## M.5 — Neutral: Xel'Naga Watchtower

A map structure that grants vision. Already mentioned in ULTRAPLAN.md — implement now:

- BuildingType.Watchtower = 42, neutral entity at map center
- Any unit within 2 tiles → that faction gains 12-tile shared vision from watchtower
- Visible on minimap as gold/yellow icon
- AI scouts watchtower and sends 1 unit to hold it

---

# Master Sprint Calendar

```
Sprint 1  (1d): F.1-F.2-F.4-F.5     — Tech tree UI + Zerg buildings
Sprint 2  (1d): A.1-A.2-A.5         — Ctrl+click, control group strip, Tab display
Sprint 3  (2d): A.3-A.4             — Portraits, subgroup ability panel
Sprint 4  (1d): B.1-B.3-B.9         — AI: base defense, faster pressure, cross-map
Sprint 5  (1.5d): B.4-B.6-B.2       — AI: expanded base, harassment, vanguard
Sprint 6  (1d): B.5-B.7-B.8         — AI: reactive intel, abilities, escalation
Sprint 7  (2d): C.1-C.9             — Marine redesign + colour palette
Sprint 8  (2d): C.2-C.3             — Terran + Zerg unit visual passes
Sprint 9  (1.5d): C.4-C.5-C.6       — Buildings, resources, environment
Sprint 10 (1.5d): C.7-C.8           — Effects, UI polish
Sprint 11 (1d): D.1-D.2-D.3         — Voice lines, ambient, positional audio
Sprint 12 (1d): D.4-D.5             — Ability sounds, adaptive music
Sprint 13 (1d): E.1-E.2             — Camera, unit interaction
Sprint 14 (1d): E.3-E.6-E.7         — Fog, veterancy, creep highway
Sprint 15 (1d): F.3-E.4-E.5         — Tech diagram, game modes, minimap intel
Sprint 16 (2d): G.1-G.2             — Determinism test + signaling server
Sprint 17 (2d): G.3-G.4             — Lockstep loop + lobby UI
Sprint 18 (1d): G.5                  — Reconnection + desync recovery
Sprint 19 (2d): H.1-H.2             — Campaign framework + Terran missions
Sprint 20 (2d): H.3-H.4-H.5         — Zerg missions + scripted events + select screen
Sprint 21 (1d): I.1-I.2             — Map editor + custom format
Sprint 22 (1d): I.3-J.1             — Map sharing + burrowing system
Sprint 23 (1.5d): J.2-J.4           — Morph system + ability second pass
Sprint 24 (1d): K.1-K.2             — Orbital Command + expansions
Sprint 25 (1d): K.3-K.4             — Worker efficiency + gas refineries
Sprint 26 (1d): L.1-L.2-L.3         — ELO profile + win conditions + achievements
Sprint 27 (2d): M.1-M.2-M.3         — Banshee, Liberator, Brood Lord
Sprint 28 (1d): M.4-M.5             — Swarm Host + Watchtower
Sprint 29 (1d): Final polish + README + screenshots + portfolio sync
```

**Total: ~40 days / 8 weeks of focused development (Iterations A–M)**
**Extended roadmap below continues to full platform parity.**

---

---

# Iteration N — Protoss Faction

## Why Protoss

Three factions is the core SC2 identity. Protoss plays completely differently from both Terran and Zerg:
- **Shields** recharge fully after 10s out of combat (separate HP bar)
- **Warp-in mechanic** — units warp in anywhere on the map that has a Pylon power field
- **Chrono Boost** — spend energy from Nexus to speed up any building's production by 50%
- **No supply cap on Pylons** (they provide supply but also power buildings)
- **Expensive but powerful** — fewer units, each hits hard

## N.1 — Shield System

New component arrays: `shieldCurrent: Float32Array`, `shieldMax: Float32Array`, `shieldRegenTimer: Float32Array`.

**Shield rules:**
- Shields absorb damage first, then HP takes damage
- Shields regen fully after `SHIELD_REGEN_DELAY = 10s` since last hit
- Regen rate: `SHIELD_REGEN_RATE = 2 HP/s` (slow regen, not instant)
- In `CombatSystem`: `if (shieldCurrent[tgt] > 0) { shieldCurrent[tgt] -= dmg; dmg = max(0, -shieldCurrent[tgt]); shieldCurrent[tgt] = max(0, shieldCurrent[tgt]); }` then apply remaining `dmg` to `hpCurrent`

**Visual:** Two stacked health bars — blue (shields) above green/yellow/red (HP). Shield bar shows full blue, depletes to nothing, then slowly refills.

## N.2 — Pylon Power Field

Pylons are the core Protoss building:
- BuildingType.Pylon = 50, 2×2 tiles, 8 supply, 100m cost, no prereq
- Each Pylon has a `powerRadius = 7 tiles`
- All other Protoss buildings must be within a Pylon's power radius to function
- Powered buildings: normal color. Unpowered buildings: red tint, production halted

**Power grid computation:** New `PylonSystem.ts` — each tick, for each Protoss building, check if any completed Pylon is within `powerRadius`. Set `powered: Uint8Array` component.

In `ProductionSystem`: skip buildings where `!powered[eid]`.

**Visual:** Pylon power radius shown as a soft circular gradient on the ground (blue-tinted overlay) when a Pylon is selected.

## N.3 — Warp-In Mechanic

Instead of training units at the Gateway and waiting, Protoss uses **Warp Gates**:
1. Gateway → upgrade to Warp Gate (morph, 7s)
2. Warp Gates don't queue units — they have a `warpCooldown` timer
3. When cooldown expires, player can "warp in" a unit ANYWHERE on the map within a Pylon's power field
4. Warp-in animation: 3s hologram effect at the target location, then unit appears

**Implementation:**
- `CommandType.WarpIn = 34` — player selects unit type on Warp Gate panel, left-clicks a target location within a powered tile
- `InputProcessor` enters warp-in mode (similar to patrol/bile pending modes)
- `WarpInRenderer`: draws pulsing blue hexagon at cursor over powered tiles; red outside power range
- On placement: deduct cost, start `warpTimer[warpGateEid]` countdown, record `warpTargetX/Y/Type`
- When timer expires in `ProductionSystem`: spawn unit at target location (teleport)

## N.4 — Chrono Boost (Nexus Ability)

Nexus is the Protoss CC equivalent. It has `nexusEnergy: Float32Array` (max 200, +0.5625/s regen, starts at 50).

**Chrono Boost (C key while Nexus selected, then click target building):**
- Costs 50 energy
- Target building produces/researches at 2× speed for 20s
- Component: `chronoBoostTimer: Float32Array` per building — while > 0, `ProductionSystem` uses double speed
- Visual: target building gets a bright blue shimmer ring + "CHRONO" text in info panel

## N.5 — Protoss Unit Roster (Phase 1)

Starting roster — 8 units covering all roles:

| Unit | HP | Shield | Role | Unique |
|------|----|--------|------|--------|
| Probe | 20 | 20 | Worker | Warps buildings (doesn't get consumed like Drone) |
| Zealot | 100 | 50 | Melee tank | Charge ability (+1.5 speed when targeting enemy) |
| Stalker | 80 | 80 | Ranged anti-all | Blink (E) — short-range teleport, 10s CD |
| Sentry | 40 | 40 | Support | Force Field (F) — impassable barrier for 11s |
| Immortal | 200 | 100 | Heavy anti-armored | Hardened Shield: absorbs max 10 dmg per hit |
| Colossus | 200 | 150 | AoE ground | Thermal Lance: long beam attack hitting all units in a line |
| Phoenix | 120 | 60 | Air-to-air | Graviton Beam (G): lifts a ground unit into the air, helpless, 4s |
| Carrier | 300 | 150 | Capital ship | Launches 8 Interceptors (tiny fighters) that attack independently |

## N.6 — Protoss Building Roster

| Building | Prereq | Produces | Notes |
|----------|--------|---------|-------|
| Nexus | — | Probe | Command centre + Chrono Boost |
| Pylon | — | — | Supply + power field |
| Gateway | Pylon | Zealot, Stalker, Sentry | → upgrades to Warp Gate |
| Forge | Pylon | — | Weapon/armor upgrades |
| Cybernetics Core | Gateway | — | Unlocks Stalker, Sentry, air |
| Robotics Facility | Cybernetics Core | Immortal, Colossus | — |
| Stargate | Cybernetics Core | Phoenix, Carrier | — |
| Templar Archives | Cybernetics Core | High Templar | (future) |

---

# Iteration O — Spectator & Replay System

## O.1 — Full Replay Playback UI

The command recorder exists. Build a proper replay viewer:

- **Timeline scrub bar** at the bottom — drag to any point in the replay
- **Play/Pause/Fast-forward (2×/4×/8×)** controls
- **Rewind to start** button
- **Camera follows action**: auto-pans to the most active area of the map (highest `damageEvents` density)

**Implementation:**
- `ReplayPlayer.ts` extends the existing command record playback
- Timeline = `<input type="range">` mapped to `totalTicks`
- Scrubbing re-simulates from nearest checkpoint (save world snapshots every 300 ticks)
- World snapshot: serialize all relevant TypedArray slices to a `Float32Array` blob

## O.2 — Spectator Mode

For multiplayer games, allow a third browser tab to watch in real-time:

- Spectator connects to the signaling server with role "spectator"
- Both players send their command streams to the spectator's data channel (broadcast)
- Spectator runs the same deterministic simulation but applies both players' commands
- Spectator has no input — only camera controls (WASD/drag/scroll)
- Spectator UI: shows both players' resource panels side by side at top

## O.3 — Highlight Reel Generation

After a game, automatically generate a "highlight clip" from the replay:

- Scan replay for peak `damageEvents` density periods → mark as "exciting moments"
- Top 3 moments: show as a 3-panel preview on the game-over screen
- "Share Moment": encode the 5s window around the moment as a replay URL fragment

---

# Iteration P — Performance & Scale

## P.1 — Web Worker Simulation

Move the entire tick simulation to a Web Worker thread. The main thread only handles:
- Input collection
- Rendering (PixiJS on main thread — required)
- Audio

The simulation worker receives input commands, runs all systems, and posts back the world state diff (only changed entity positions/HPs/states) each tick.

**Benefits:** Rendering never stalls during AI computation. Large battles (200 units) compute off the main thread, preventing frame drops.

**Challenge:** TypedArrays are transferable (zero-copy) but PixiJS renders from shared memory. Use `SharedArrayBuffer` for the main component arrays so both main thread (rendering) and worker thread (simulation) can read/write without message passing overhead.

**Files:** `src/workers/SimulationWorker.ts`, `src/Game.ts` restructure

## P.2 — GPU-Accelerated Particle System

Current particles (death effects, explosions) are drawn via PixiJS `Graphics` per frame. At 50+ simultaneous deaths, this gets expensive.

Replace with a PixiJS `ParticleContainer` + custom particle shader:
- Particles are tiny sprites (1×1 white pixel texture, tinted per particle)
- `ParticleContainer` uses GPU instancing — 10,000 particles at 60fps with near-zero CPU cost
- Particle physics on GPU via custom vertex shader: position += velocity * dt, alpha -= fadeRate * dt

## P.3 — Lazy Terrain Rendering

The `TilemapRenderer` currently draws all ~16,000 tiles every frame the water animates. Optimize:

- Static tiles (ground, cliff) rendered once to a `RenderTexture` — never redrawn
- Only water tiles and creep overlay redraw each frame
- Destructible tiles redraw only when their state changes (rock destroyed)
- Expected speedup: 5× fewer draw calls for terrain

## P.4 — Network Delta Compression

For multiplayer: instead of sending full `GameCommand[]` arrays, send binary-encoded deltas:

- Each command: 1 byte type + 1 byte unit count + 2 bytes per unit EID + 4 bytes wx + 4 bytes wy = ~15 bytes per command
- Batch: frame number (2 bytes) + command count (1 byte) + commands
- ~200 bytes per frame at 60 FPS = ~12KB/s per player — negligible bandwidth

Use a `CommandSerializer.ts` with `DataView` for binary packing/unpacking.

---

# Iteration Q — Platform & Accessibility

## Q.1 — Progressive Web App (PWA)

Install the game on phone/desktop like a native app:

- `manifest.json`: name, icons, display: standalone, theme_color
- `service-worker.js`: cache all assets for offline play (single-player only when offline)
- App icon: the SC2-inspired Swarm Command logo (drawn as SVG, no external assets)
- On iOS Safari: "Add to Home Screen" prompt after 3rd visit

## Q.2 — Keyboard Remapping

Allow players to change any hotkey binding:

- New settings panel: "Controls" tab with all hotkeys listed
- Each binding: `<key-capture-input>` that listens for a keypress and stores it
- Bindings stored in `localStorage['keybindings']`
- `InputProcessor` reads from the stored bindings at init instead of hardcoded strings
- Conflict detection: warn if two actions share the same key

## Q.3 — Colourblind Modes

Three accessibility modes selectable from settings:

| Mode | Terran | Zerg | Resource/UI |
|------|--------|------|-------------|
| Default | Blue | Red/Purple | Blue minerals, Green gas |
| Deuteranopia | Blue | Orange | Blue minerals, Yellow gas |
| Tritanopia | Green | Red | Yellow minerals, Red gas |
| High Contrast | White | Black | Bright yellow minerals |

Units also gain a small shape-based identifier overlay (already partly in place with distinct unit shapes).

## Q.4 — Screen Reader Support

For accessibility compliance:

- All HTML UI panels get `aria-label` attributes
- Key game events announced via `aria-live="polite"` region: "Wave 3 incoming", "Marine produced", "Under attack"
- HUD values readable by screen reader: minerals/gas/supply with proper `aria-label`

## Q.5 — Internationalisation (i18n) Foundation

All display strings extracted to `src/i18n/en.ts`:

```typescript
export const strings = {
  UNIT_Marine: "Marine",
  UNIT_Zergling: "Zergling",
  ABILITY_Stim: "Stim Pack",
  HUD_Minerals: "Minerals",
  ALERT_UnderAttack: "Under Attack",
  // ...
} as const;
```

Replace all hardcoded strings in renderers with `strings.KEY`. Adding a language is then just a new file `src/i18n/de.ts`, `src/i18n/fr.ts` etc.

---

# Iteration R — Meta & Social

## R.1 — In-Game Screenshot Tool

`Shift+F12` captures the current frame as a PNG:
- Temporarily hide all HTML UI overlays (HUD, panels, minimap)
- Use `app.renderer.extract.canvas()` → `canvas.toBlob()` → download link
- Optional: add a "Share" button that uploads to a free image service (imgbb.com free API or similar)

## R.2 — Twitch/Stream Integration

- OBS browser source: add `?obs=1` URL param to enable a stream-friendly layout
  - Larger fonts, higher contrast UI
  - No HUD clutter, minimal panels
  - Overlay showing both players' army values (for caster perspective)
- Twitch Extension placeholder: iframe embedded in Twitch channel showing live game stats

## R.3 — Discord Rich Presence (via Web API)

When playing, update Discord status via the Discord Game SDK web overlay:
- "Playing Swarm Command — Terran vs Zerg — Wave 7"
- "Watching Replay — 4:32 APM 187"
- Invite button: opens the game URL with the current lobby code as a URL param

## R.4 — Leaderboard (Serverless)

Global leaderboard using a free serverless backend:

- **Supabase free tier**: table `scores(player_id, difficulty, time_seconds, waves, apm, faction, created_at)`
- On game end: POST score if `difficulty >= Normal` and `!fogEnabled === false` (no cheating)
- Leaderboard page: top 100 scores per difficulty, filterable by faction
- Anonymous player IDs: `localStorage` UUID generated at first run
- Optional: add a name (stored in localStorage, sent with score)

---

# Extended Master Sprint Calendar (Sprints 30–55)

```
Sprint 30 (2d): N.1-N.2         — Protoss shields + Pylon power field
Sprint 31 (2d): N.3-N.4         — Warp-in mechanic + Chrono Boost
Sprint 32 (3d): N.5-N.6         — Protoss unit + building roster
Sprint 33 (1d): O.1             — Full replay playback UI + scrub bar
Sprint 34 (2d): O.2-O.3         — Spectator mode + highlight reel
Sprint 35 (2d): P.1             — Web Worker simulation offload
Sprint 36 (1d): P.2-P.3         — GPU particles + lazy terrain render
Sprint 37 (1d): P.4             — Network delta compression
Sprint 38 (1d): Q.1-Q.2         — PWA install + keyboard remapping
Sprint 39 (1d): Q.3-Q.4-Q.5     — Colourblind modes + accessibility + i18n foundation
Sprint 40 (1d): R.1-R.2         — Screenshot tool + stream layout
Sprint 41 (1d): R.3-R.4         — Discord presence + global leaderboard
Sprint 42 (2d): N.5 ext         — Protoss units: High Templar (Psionic Storm), Dark Templar (permanent cloak)
Sprint 43 (2d): N.5 ext         — Protoss Tier 3: Void Ray (prismatic beam), Mothership (mass recall, time stop)
Sprint 44 (2d): M ext           — Terran Tier 3: Thor upgrade (Odin), SCV auto-repair on structures, Planetary Fortress (turret CC)
Sprint 45 (2d): M ext           — Zerg Tier 3: Nydus Network (army teleport), Spine Crawler/Spore Crawler (static defence that can uproot and walk)
Sprint 46 (3d): AI ext          — Protoss AI: build order, warp-in aggression, Colossus push, Blink Stalker micro
Sprint 47 (2d): Campaign ext    — 5 Protoss campaign missions (Warp Gate tutorial → Colossus deploy → Psionic Storm finale)
Sprint 48 (1d): Balance pass    — Full unit cost/stat balance review against SC2 values, community playtesting feedback
Sprint 49 (2d): Map pack        — 5 new competitive maps (by hand-coding MapData patterns): Daybreak, Frost, Abyssal Reef, Merry Go Round, Alterzim
Sprint 50 (1d): Automated tests — Unit tests for all new systems (shield regen, warp-in, chrono boost, morph, burrow)
Sprint 51 (1d): Load testing    — 400-entity stress test, profile & fix frame-time spikes
Sprint 52 (2d): Tutorial        — Interactive tutorial overlay for first-time players (step-by-step: gather → build → train → attack)
Sprint 53 (1d): SEO & meta      — Proper OpenGraph tags, Twitter card, structured data for search indexing
Sprint 54 (1d): Final QA pass   — Cross-browser test (Chrome/Firefox/Safari/Edge), mobile device test, performance budget
Sprint 55 (1d): Launch v1.0     — Tag release, push to GitHub Pages, update portfolio, post to Hacker News / Reddit SC2 community
```

**Grand Total: ~55 sprints / 75 days / 15 weeks**
**End state: A fully playable 3-faction SC2 browser clone — Terran, Zerg, Protoss — with multiplayer, campaign, map editor, PWA install, spectator mode, leaderboard, and accessibility support. The most complete RTS ever built in a browser.**

---

## Priority Stack (if only shipping 10 sprints)

The 10 sprints with the highest return-on-investment for playability and portfolio impact:

```
1.  Sprint 1:  F.1-F.4   — Tech tree UI + Zerg buildings (makes it immediately more playable)
2.  Sprint 4:  B.1-B.3   — AI base defense + faster pressure (fixes the biggest gameplay complaint)
3.  Sprint 7:  C.1-C.9   — Marine redesign + palette (portfolio first impression)
4.  Sprint 2:  A.1-A.2   — Ctrl+click + control group UI (core SC2 feel)
5.  Sprint 19: H.1-H.2   — Campaign framework + Terran missions (gives the game purpose)
6.  Sprint 26: L.3       — Achievements (replayability, portfolio talking point)
7.  Sprint 8:  C.2-C.3   — Unit visual passes (every unit looks great)
8.  Sprint 16: G.1-G.2   — Multiplayer foundation (the biggest feature gap)
9.  Sprint 30: N.1-N.2   — Protoss shields + Pylon (third faction foundation)
10. Sprint 55: Launch    — Deploy, portfolio sync, community post
```

---

---

# Iteration S — AI Director System

## S.1 — The Director (Left 4 Dead–Inspired)

Rather than fixed wave timers, implement an **AI Director** that reads the player's current stress level and adjusts spawning in real time. This creates pacing that always feels fair but threatening.

**Stress level formula:**
```
stress = (recentDamageReceived / maxHP) * 40
       + (armyLostValue / totalArmyValue) * 30
       + (timeWithoutAction / 60) * 20   // boredom increases stress
       + (currentAPM / 200) * 10         // high APM = player is engaged, Director can push harder
```
Range: 0 (relaxed) → 100 (overwhelmed).

**Director states:**
| State | Stress | Behaviour |
|-------|--------|-----------|
| **Build-up** | 0–30 | Spawn slowly, scout, let player get established |
| **Pressure** | 30–55 | Normal wave cadence, harassment active |
| **Relentless** | 55–75 | Shorter cooldowns, double harassment squads |
| **Peak** | 75–90 | Simultaneous 3-prong attack, max army size |
| **Relief** | 90–100 | Back off — send retreat signal, let player breathe 30s |

**Relief valve:** When stress > 90, the Director deliberately pauses spawning and pulls army back 5 tiles. This prevents the game from feeling unfair — it always gives the player a window to recover.

## S.2 — Director Awareness Events

The Director tracks and reacts to specific player actions:

| Player action | Director response |
|--------------|-------------------|
| Player expands | Within 45s, harassment targets the new expansion |
| Player builds air units | Within 2 waves, AI adds anti-air composition |
| Player uses all supply | Director holds back for 20s ("you're about to be overwhelmed anyway") |
| Player's economy drops below 8 workers | Director reduces income (mercy — don't snowball losses) |
| Player casts Yamato / Psionic Storm | Director notes this tech; adds Zerglings specifically to rush the caster |
| Player never builds anti-air | After wave 4, Director adds Mutalisks/Phoenix to the spawn pool |

## S.3 — Named Scenario Events ("Special Forces")

Occasionally the Director spawns a "named encounter" — a special unit composition with a 5-second warning:

| Event | Composition | Warning text |
|-------|------------|--------------|
| Baneling Bust | 12 Banelings + 8 Zerglings | "BANELING BUST DETECTED" |
| Mutalisk Harass | 6 Mutalisks strike mineral line | "MUTALISK FLOCK INCOMING" |
| Ultralisk Charge | 2 Ultralisks + escort | "ULTRALISK DETECTED — EVACUATE" |
| Drop Pod | 8 Zerglings appear INSIDE player base | "NYDUS WORM DETECTED" |
| Roach Swarm | 15 Roaches mass | "ROACH WARREN FLOODING" |

Each event has a dedicated sound cue and alert banner. These make the game feel cinematic.

---

# Iteration T — Ranked Matchmaking

## T.1 — Rank Tiers (Bronze → Grandmaster)

| Tier | Points required | Icon colour |
|------|----------------|-------------|
| Bronze | 0–999 | Brown |
| Silver | 1,000–1,999 | Grey |
| Gold | 2,000–3,499 | Yellow |
| Platinum | 3,500–5,499 | Cyan |
| Diamond | 5,500–8,499 | Blue |
| Master | 8,500–11,999 | Red/Gold |
| Grandmaster | 12,000+ | Purple |

Point delta per game: +/−50 at Bronze, scaling to +/−15 at Master (smaller swings at the top).

## T.2 — Matchmaking Pool

For a single-player game with no real opponents: matchmaking against AI profiles that simulate different skill levels.

**AI opponent profiles** (named, with avatar icons):
- "CommanderBlue" — Bronze AI: slow build order, no harassment
- "ZergRush99" — Silver: 12-pool aggressive, one-dimensional
- "TacticalOmega" — Gold: Normal AI + occasional multi-prong
- "ApexPredator" — Platinum: Hard AI full behaviour
- "NightmareX" — Diamond: Brutal AI + Director System active
- "VoidReaper" — Master: Brutal AI + Protoss composition + Director

Players queue for "Ranked Match" and are matched to the profile closest to their current points. This simulates the MMR ladder feel without needing real opponents.

## T.3 — Season System

Seasons last 30 days (tracked via localStorage date). At season end:
- Current rank and season high-water mark displayed on profile
- Seasonal icon (badge) awarded per tier reached
- Points soft-reset to 70% of current (prevents rank decay but keeps the ladder fresh)
- Season history: profile shows all past seasons

## T.4 — Ranked Restrictions

To prevent boosting/abuse:
- Ranked requires playing 5 placement matches first
- Replays mandatory for all ranked games (automatically saved)
- If fog-of-war is disabled: game is "unranked" regardless of setting

---

# Iteration U — Advanced Campaign Features

## U.1 — Branching Narrative

The linear 5-mission campaign becomes a branching tree. After Mission 2, the player chooses one of two paths:

**Terran Path A (Aggressive):** Missions focused on offensive pushes, SCV drops behind enemy lines, siege line advances.

**Terran Path B (Defensive):** Missions focused on holding positions, bunker lines, Planetary Fortress mechanics, surviving waves.

Both paths merge at Mission 5 (final assault). Different dialogue, different unit rewards.

## U.2 — Commander Abilities (SC2 Co-op Inspired)

Each campaign mission rewards a "Commander Ability" permanently unlocked for the player:

| Mission completed | Ability unlocked | Effect |
|-----------------|-----------------|--------|
| T1 | Drop Pod | Once per game: drop 6 Marines at any visible location |
| T2 | Orbital Strike | Once per game: 150 damage AoE anywhere on map |
| T3 | Fortify | All buildings gain +50% HP for 30s |
| Z2 | Swarm Call | Spawn 20 free Zerglings at map centre |
| Z4 | Neural Hijack | Permanently take control of one enemy unit |

Commander abilities use a separate energy bar (top-right corner). Not tied to individual units.

## U.3 — Persistent Campaign Progression

Between missions: a "War Room" screen showing:
- Current mission briefing (text + map thumbnail)
- Carried-over veteran units (units that survived the last mission appear in the next one)
- Upgrade screen: spend "credits" (earned during missions) on passive upgrades:
  - +1 starting minerals (150 credits)
  - All Marines start stimmed (300 credits)
  - Hatcheries spawn with 6 larva instead of 3 (300 credits)
  - All units gain Veteran status from start (500 credits)

## U.4 — Mission Modifiers

Optional extra difficulty modifiers per mission (cosmetic rewards for completion):

| Modifier | Effect | Reward |
|----------|--------|--------|
| Iron Man | No unit can die | Gold portrait frame |
| Speed Run | Complete in under N minutes | Bronze trophy |
| No Build | Cannot build new structures | Silver icon |
| Elite | Enemy units have +50% HP | Diamond icon |

---

# Iteration V — Modding Support

## V.1 — Mod Loader

Allow players to inject custom unit definitions via a JSON mod file loaded from URL:

```json
{
  "name": "Marine Corps Pack",
  "version": "1.0",
  "units": [
    {
      "id": 100,
      "name": "Heavy Marine",
      "hp": 120,
      "damage": 9,
      "range": 5,
      "speed": 2.2,
      "cooldown": 1000,
      "costMinerals": 75,
      "costGas": 25,
      "color": "#ff4400",
      "isAir": false,
      "canTargetGround": true,
      "canTargetAir": true,
      "abilities": ["stim"]
    }
  ],
  "buildings": [],
  "balanceOverrides": {
    "Marine.hp": 50,
    "Marine.damage": 7
  }
}
```

Load via `?mod=<base64-encoded-json>` URL param. Mods apply on top of base definitions. "Vanilla mode" button resets.

## V.2 — Custom Ability Scripts

Allow simple ability definitions via a mini scripting language embedded in mod JSON:

```json
"abilities": [{
  "id": "napalm",
  "name": "Napalm Drop",
  "key": "N",
  "energyCost": 50,
  "cooldown": 20,
  "effect": {
    "type": "aoe_damage",
    "damage": 40,
    "radius": 2.5,
    "delay": 1.0,
    "damageType": "Explosive"
  }
}]
```

Parsed by `AbilityScriptEngine.ts` — a safe interpreter that only exposes: `deal_damage`, `apply_slow`, `teleport`, `spawn_unit`, `set_flag`.

## V.3 — Mod Gallery

An in-game mod gallery showing available community mods loaded from a GitHub-hosted JSON index:

```json
[
  { "name": "Marines Only", "url": "...", "downloads": 142, "rating": 4.2 },
  { "name": "Giant Units", "url": "...", "downloads": 89, "rating": 3.8 }
]
```

Clicking a mod loads it immediately. Rating stored in Supabase with the leaderboard.

---

# Iteration W — Esports & Tournament Infrastructure

## W.1 — Tournament Bracket System

Host an 8 or 16-player single-elimination bracket entirely within the browser:

- Tournament organiser creates a bracket room with a room code
- Players join, organiser seeds them, starts bracket
- Match results auto-reported when a player wins a ranked game in that lobby
- Bracket displayed as an HTML bracket tree, live-updating

## W.2 — Casting Mode

When in spectator mode, add a casting overlay:
- Large army value comparison bar (top-center): "Terran 847  vs  Zerg 1,243"
- Unit composition pie charts per player
- "Interesting event" text feed: "NightmareX: Siege Tank sieged x3", "Player: Yamato fired!"
- "Casting UI" toggle — hides minimap, enlarges main view for streaming

## W.3 — VOD Review Integration

After a multiplayer game, both players can load the replay into a shared review session:
- One player controls the timeline scrub
- Both players see the same view (shared state via data channel)
- "Annotation mode": click anywhere on map to draw a temporary arrow/circle (visible to partner for 3s)
- Used for post-game analysis

---

# Iteration X — Data & Analytics

## X.1 — Telemetry (Privacy-first, opt-in)

On game end, with explicit consent, send anonymous game data to Supabase:

```json
{
  "version": "1.0",
  "faction": "Terran",
  "difficulty": "Hard",
  "duration": 342,
  "outcome": "victory",
  "apm": 87,
  "wavesDefeated": 6,
  "unitsProduced": { "Marine": 24, "SiegeTank": 4 },
  "unitsLost": { "Marine": 11, "SCV": 2 },
  "techPath": ["Barracks", "Factory", "EngineeringBay"],
  "firstAttackWave": 3
}
```

## X.2 — Analytics Dashboard

A public-facing page (GitHub Pages `/analytics`) showing aggregated stats from all opt-in players:

- Most popular units by faction
- Average game length by difficulty
- Win rate by faction
- Most common tech path
- APM distribution histogram

Built with Chart.js (CDN import, no build step).

## X.3 — Balance Report

Auto-generated weekly balance report from telemetry:

- Units with < 30% win rate when used: flagged as "under-powered"
- Units appearing in > 80% of winning compositions: flagged as "dominant"
- Difficulty curves: if Hard has > 70% win rate, it's too easy; flag for tuning

Displayed in a `BALANCE.md` file auto-committed to the repo by a GitHub Action.

---

# Iteration Y — Long-Term Engine Improvements

## Y.1 — Entity Component System v2

The current hand-rolled ECS uses parallel TypedArrays. Upgrade to a proper archetype-based ECS:

- **Archetypes:** Entities with the same component mask share a tightly-packed array (no sparse slots)
- **Query performance:** Instead of iterating all 4096 entities and checking masks, iterate only the archetypes that match the query
- **Expected speedup:** 3–5× for systems with < 10% entity coverage (e.g., BurrowSystem only processes 5% of entities)
- **API compatibility:** Keep the same `posX[eid]` interface — archetype storage is an internal optimization

## Y.2 — WebGPU Renderer

When WebGPU becomes widely available (Chrome 113+ already supports it), replace the PixiJS WebGL2 renderer with a WebGPU renderer:

- Compute shaders for separation physics (currently O(n²) CPU)
- GPU-driven occlusion culling for fog of war
- Bindless texture arrays for sprite rendering
- Expected: 2–3× render throughput for 200-unit battles

Feature-detect and fall back to WebGL2 if WebGPU unavailable.

## Y.3 — WASM Physics Module

Move the separation pass and pathfinding to WebAssembly via AssemblyScript:

- Compile `separation.ts` → `separation.wasm` via AssemblyScript compiler
- The WASM module receives pointer to the `posX`/`posY` SharedArrayBuffers
- Runs at near-native speed for O(n²) separation (10× faster than JS for tight loops)

## Y.4 — Persistent World (Experimental)

An opt-in mode where the map persists between sessions via `localStorage`:

- Buildings remain between play sessions
- Resources deplete permanently
- "Day N" counter — the war has been ongoing for N days
- Each session = 10-minute battle. Between sessions, AI "rebuilds" according to its build order
- Long-term strategic layer: player slowly expands and eliminates AI one base at a time

---

# Iteration Z — The Complete Vision

## Z.1 — Full SC2 Unit Parity Checklist

**Terran (target: 21 units)**
```
Implemented: SCV, Marine, Marauder, Reaper, Ghost, Hellion, Widowmine,
             Cyclone, Siegetank, Thor, Viking, Medivac, Liberator, Banshee,
             Raven, Battlecruiser                                [16/21]
Remaining:   Hellbat (Hellion transform), MULE (Orbital drop),
             Planetary Fortress (CC transform), Bunker (static defense),
             Missile Turret (anti-air structure)                  [5 todo]
```

**Zerg (target: 19 units)**
```
Implemented: Drone, Queen, Overlord, Zergling, Baneling, Roach, Ravager,
             Hydralisk, Lurker, Infestor, Viper, Mutalisk, Corruptor,
             Brood Lord, Swarm Host, Ultralisk                   [16/19]
Remaining:   Changeling (Overseer morph), Overseer (Overlord morph),
             Nydus Worm (Nydus Network unit)                      [3 todo]
```

**Protoss (target: 17 units)**
```
Implemented: Probe, Zealot, Stalker, Sentry, Immortal, Colossus,
             Phoenix, Carrier                                      [8/17]
Remaining:   High Templar, Dark Templar, Archon (HT+DT merge),
             Adept, Disruptor, Oracle, Tempest, Void Ray,
             Mothership                                            [9 todo]
```

## Z.2 — Feature Parity Matrix

```
Feature                         | Implemented | Target Sprint
--------------------------------|-------------|---------------
3 factions                      | 2/3         | Sprint 32
Shield system                   | 0%          | Sprint 30
Warp-in                         | 0%          | Sprint 31
Chrono Boost                    | 0%          | Sprint 31
Multiplayer P2P                 | 0%          | Sprint 17
Campaign (10 missions)          | 0%          | Sprint 20
Map editor                      | 0%          | Sprint 21
Replay system                   | 80%         | Sprint 33
Spectator mode                  | 0%          | Sprint 34
Leaderboard                     | 0%          | Sprint 41
PWA install                     | 0%          | Sprint 38
Burrowing                       | 60%         | Sprint 22
Morph system                    | 60%         | Sprint 23
Orbital Command                 | 0%          | Sprint 24
AI Director                     | 0%          | Sprint S
Ranked MMR                      | 0%          | Sprint T
Modding support                 | 0%          | Sprint V
```

## Z.3 — The Grand Unified Sprint Plan (Sprints 56–100)

```
Sprint 56 (2d): S.1-S.2         — AI Director stress system + awareness events
Sprint 57 (1d): S.3             — Named scenario events (Baneling Bust etc.)
Sprint 58 (2d): T.1-T.2         — Rank tiers + AI matchmaking profiles
Sprint 59 (1d): T.3-T.4         — Season system + ranked restrictions
Sprint 60 (2d): U.1-U.2         — Branching narrative + Commander abilities
Sprint 61 (2d): U.3-U.4         — War Room progression + mission modifiers
Sprint 62 (2d): V.1-V.2         — Mod loader + ability scripting engine
Sprint 63 (1d): V.3             — Mod gallery + community index
Sprint 64 (2d): W.1-W.2         — Tournament brackets + casting mode
Sprint 65 (1d): W.3             — VOD review + annotation mode
Sprint 66 (1d): X.1-X.2         — Telemetry + analytics dashboard
Sprint 67 (1d): X.3             — Auto-generated balance report CI action
Sprint 68 (3d): Y.1             — ECS v2 archetype-based storage
Sprint 69 (2d): Y.2-Y.3         — WebGPU renderer feature flag + WASM separation
Sprint 70 (1d): Y.4             — Persistent world experimental mode
Sprint 71 (3d): N ext           — Protoss Tier 2: High Templar (Psionic Storm), Dark Templar (perma-cloak)
Sprint 72 (2d): N ext           — Protoss Tier 3: Void Ray (charging beam), Tempest (capital anti-air), Mothership
Sprint 73 (2d): M ext           — Terran full parity: Hellbat, Bunker, Missile Turret, Planetary Fortress
Sprint 74 (2d): Zerg ext        — Zerg full parity: Overseer, Changeling, Nydus Worm
Sprint 75 (2d): N AI            — Protoss AI: Gateway expand, Colossus push, Blink Stalker micro
Sprint 76 (3d): Balance v2      — Full 3-faction balance pass with telemetry data
Sprint 77 (2d): Campaign ext    — Protoss 5-mission campaign
Sprint 78 (2d): Map pack 2      — 5 more competitive maps (Lost Temple, Crossfire, etc.)
Sprint 79 (1d): Replay polish   — Bookmark timestamps, sharable replay clips
Sprint 80 (2d): UI v2           — Full UI redesign pass — cohesive SC2-inspired aesthetic
Sprint 81 (1d): Sound v2        — Full audio pass — voice acting (TTS for all unit types)
Sprint 82 (1d): Tutorial v2     — Context-sensitive hints during first 10 games (not just first game)
Sprint 83 (1d): Analytics v2    — Live telemetry dashboard, heatmap of player losses
Sprint 84 (1d): Community tools — Clan/group system, custom room names, invite links
Sprint 85 (2d): Mobile v2       — Full mobile layout redesign for tablet-first experience
Sprint 86 (1d): Social v2       — Twitter/X integration, auto-tweet win screenshots
Sprint 87 (1d): SEO v2          — Blog posts about architecture (ECS, lockstep, WebRTC)
Sprint 88 (1d): Open source     — Clean up code, write CONTRIBUTING.md, first community PR
Sprint 89 (2d): Plugin system   — Register custom renderers, systems, commands without forking
Sprint 90 (1d): API docs        — Full JSDoc + auto-generated docs site (TypeDoc)
Sprint 91 (1d): Performance v3  — WebAssembly pathfinding, memory pool allocator
Sprint 92 (3d): Ladder season 1 — First real-time multiplayer event with leaderboard prizes
Sprint 93 (2d): Observer tools  — In-game stats overlay, unit hotkeys visible to observers
Sprint 94 (1d): Accessibility v2— Motor accessibility: dwell-click, switch access, reduced motion
Sprint 95 (1d): Edge cases      — Handle all degenerate states (0 resources, max entities, fog edge)
Sprint 96 (2d): Regression suite— Automated end-to-end tests for campaign missions, multiplayer lobby
Sprint 97 (1d): CDN & delivery  — Asset preloading, HTTP/2 push, 90+ Lighthouse score
Sprint 98 (1d): Security audit  — Input sanitisation for mod JSON, XSS checks in analytics
Sprint 99 (1d): Legal & licences— MIT licence check on all dependencies, attribution page
Sprint 100 (1d): v2.0 launch   — Tag v2.0, write full retrospective blog post, submit to GitHub Trending
```

## Z.4 — The 100-Sprint Vision Statement

```
v0.1  (Sprint 1–10):   Polished single-player RTS. 2 factions. AI feels alive.
v0.5  (Sprint 11–30):  Full audio, visual overhaul, campaign foundation.
v1.0  (Sprint 31–55):  3 factions. Multiplayer. Campaign. Map editor. Launch.
v1.5  (Sprint 56–70):  AI Director. Ranked MMR. Modding. Analytics.
v2.0  (Sprint 71–100): Full unit parity. Esports tools. Open source. Community.
```

**100 sprints. ~120 days. 24 weeks. The most fully-featured SC2 browser clone ever built.**

---

---

# Iteration AA — Proper Start Menu & Map Selection

## Current State

The start screen is functional but looks like a settings form. It has:
- Faction: two plain buttons (TERRAN / ZERG)
- Difficulty: a `<select>` dropdown
- Map: a `<select>` dropdown (3 options: Plains, Canyon, Islands)
- Advanced settings collapsed in a `<details>` element
- No map previews, no faction art, no visual differentiation between choices

This feels like a debug menu, not a game launcher. SC2's lobby is visually stunning — faction portraits, animated map previews, glowing selected states. We need to close that gap.

---

## AA.1 — Full Start Menu Redesign

Replace the current form-style layout with a proper game lobby with three distinct panels.

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  SWARM COMMAND                              [v1.0] [Credits] │
│  ─────────────────────────────────────────────────────────── │
│                                                             │
│  ┌─── FACTION ───┐  ┌──────── MAP ────────┐  ┌── SETTINGS ─┐ │
│  │  [TERRAN]  ◄  │  │  ┌──────────────┐  │  │ Difficulty  │ │
│  │  [ZERG]       │  │  │ Map preview  │  │  │ ○ Easy      │ │
│  │  [PROTOSS]*   │  │  │ (geometric)  │  │  │ ● Normal    │ │
│  │               │  │  └──────────────┘  │  │ ○ Hard      │ │
│  │  [Portrait]   │  │  Plains            │  │ ○ Brutal    │ │
│  │  description  │  │  ◄ ──────── ►      │  │             │ │
│  └───────────────┘  └────────────────────┘  │ Enemy Faction│ │
│                                              │ ○ Zerg      │ │
│                     ┌── RECENT ──────────┐  │ ● Random    │ │
│                     │ Last: Normal W 4:32│  └─────────────┘ │
│                                                             │
│                     [  START GAME  ]                        │
│                     [  CAMPAIGN    ]                        │
│                     [WATCH REPLAY  ]                        │
└─────────────────────────────────────────────────────────────┘
```

*Protoss panel disabled (greyed, "Coming Soon") until Iteration N ships.

### Faction Panel

Three faction cards, each a `<div>` that acts as a radio button:
- **Terran card**: Blue-tinted, title "TERRAN", sub "Resilient. Adaptive. Human." — geometric Marine portrait (the 22-layer design rendered on a `<canvas>` element)
- **Zerg card**: Red/purple-tinted, "ZERG", sub "Relentless. Organic. Overwhelming." — Queen portrait
- **Protoss card**: Gold-tinted, "PROTOSS", sub "Ancient. Powerful. Proud." — Zealot portrait — greyed overlay "Coming Soon"

Selected card: bright border, background lighten. Hover: subtle scale(1.02) transform.

Each faction card also shows a small tooltip on hover: key mechanics summary.
- Terran: "Build anywhere. Upgrade to Orbital. Siege tanks and air superiority."
- Zerg: "Larva inject. Creep highways. Queen, Overlord supply. Swarm and overwhelm."

### Enemy Faction Selector

When playing single-player vs AI, choose what the enemy plays:
- **Random** (default) — AI picks based on difficulty
- **Zerg** — always face Zerg (current default behaviour)
- **Terran** — Terran AI (already implemented in AISystem)
- **Mirror** — same faction as you

New `enemyFaction` field in Game, passed to `initAI()`.

---

## AA.2 — Map Selection with Visual Previews

Replace the dropdown with a **map card carousel**. Each map is a clickable card showing:

1. **Geometric preview** (80×80px canvas) — a simplified bird's-eye representation of the map topology:
   - Ground tiles = dark grey
   - Water tiles = dark blue
   - Cliffs/rocks = dark brown
   - Mineral patches = tiny blue dots
   - Gas geysers = tiny green dots
   - Start positions = coloured triangles (blue = player, red = enemy)
   
   Drawn once at map-select render time by calling a `renderMapPreview(canvas, mapType)` function that iterates the map's tile array at 1px-per-tile resolution.

2. **Map name** ("Plains", "Canyon", "Islands") in large text

3. **Descriptor tags**: 2-3 small badges describing the map's character:
   - Plains: `[Open Field]` `[Air Friendly]` `[Economic]`
   - Canyon: `[Choke Points]` `[Siege Favored]` `[Defensive]`
   - Islands: `[Water Crossing]` `[Medivac Essential]` `[Isolated Bases]`

4. **Playstyle note**: One sentence beneath the name:
   - Plains: "Wide open map. Air units dominate. Expand early."
   - Canyon: "Narrow passages. Siege Tanks are king. Control the gaps."
   - Islands: "Separated bases. Medivac drops decide games. Turtles win."

Cards laid out horizontally. Click to select (highlighted card). Arrow keys to cycle. Preview canvas updates in real time.

---

## AA.3 — 7 New Maps with Distinct Topography

The current 3 maps (Plains, Canyon, Islands) are a start but need more variety. Add 7 new maps covering every strategic playstyle:

### Map 4 — Crossfire (MapType.Crossfire = 3)
**Playstyle:** Skirmish. Constant early pressure. No turtling.
- **Shape:** Two diagonal corridors crossing at the map center. No natural expansion — bases are exposed.
- **Features:** 4 small mineral patches per base (resource-poor, forces quick aggression), no gas until center expansion
- **Favours:** Fast units, Zerglings, Reapers, early pressure builds

### Map 5 — Fortress (MapType.Fortress = 4)
**Playstyle:** Defensive. Long macro games. Turtle to late game.
- **Shape:** Each base is surrounded by cliff walls with only 2 narrow entrance ramps.
- **Features:** Very rich mineral patches (12 per base), multiple gas geysers, a fortified neutral "fortress" structure at the center that grants +5 armor to nearby units when controlled
- **Favours:** Siege Tanks, defensive builds, Spine/Spore Crawlers, bio-ball compositions

### Map 6 — Archipelago (MapType.Archipelago = 5)
**Playstyle:** Air-heavy. Drop-heavy. Map control via flying.
- **Shape:** 5 islands connected by narrow land bridges (2 tiles wide). Bridges destructible.
- **Features:** Each island has a small mineral patch. Controlling 3+ islands wins on resources.
- **Favours:** Medivacs, Mutalisks, Carriers, Phoenix — any air unit is premium here

### Map 7 — Deadlock (MapType.Deadlock = 6)
**Playstyle:** Symmetric choke. Pure army vs army.
- **Shape:** Two bases connected by a single 6-tile-wide corridor. No expansions at all.
- **Features:** Extremely rich starting minerals (unlimited for the game's duration), no gas, all units are ground-only relevant. Perfect for learning unit compositions without economic pressure.
- **Favours:** Marine/Marauder, Roach/Ravager, Zealot/Stalker — pure unit combat

### Map 8 — Desert Storm (MapType.DesertStorm = 7)
**Playstyle:** Aggressive early game, contested center.
- **Shape:** Large open center with only desert ground (fast movement), bases in corners with cliffs for protection.
- **Features:** Xel'Naga Watchtower at center grants vision bonus. Three neutral expansion bases in the center (contested). Sand terrain type: ground units on sand have -10% speed (adds strategic weight to terrain position).
- **Favours:** Fast harassment, Hellion/Zergling early pressure, map control over resource denial

### Map 9 — Frozen Tundra (MapType.FrozenTundra = 8)
**Playstyle:** Slow, methodical. Defensive positions matter.
- **Shape:** Maze-like with multiple branching paths through ice cliff formations. Multiple small "room" areas.
- **Features:** Ice tile type: units on ice have -15% speed but +10% range (slower but sight lines open). Frozen geysers must be "broken" (attack them like rocks) before harvesting.
- **Favours:** Siege Tanks, Hydralisks, Stalkers — ranged units that want controlled engagements

### Map 10 — Volcano (MapType.Volcano = 9)
**Playstyle:** High-risk, dynamic. Terrain changes mid-game.
- **Shape:** Circular map with a volcano at the center. Bases on the outer ring.
- **Features:** Every 90 seconds, lava erupts from the center for 15 seconds — any unit in the lava zone takes 50 damage per second. This forces both players to pull back and creates natural lulls in fighting.
- **Favours:** Mobile armies, Medivacs for healing, armies that can engage and disengage quickly

---

## AA.4 — Map Preview Canvas Rendering

`src/rendering/MapPreviewRenderer.ts`:

```typescript
export function renderMapPreview(
  canvas: HTMLCanvasElement,
  mapType: MapType,
  playerFaction: Faction,
): void {
  const map = generateMap(mapType);  // generate a fresh map instance for preview
  const ctx = canvas.getContext('2d')!;
  const scale = canvas.width / map.cols;  // typically 80/128 ≈ 0.625px per tile
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const tile = map.tiles[row * map.cols + col];
      ctx.fillStyle = TILE_PREVIEW_COLORS[tile];
      ctx.fillRect(col * scale, row * scale, scale, scale);
    }
  }
  
  // Mineral patches
  for (const patch of getResourceTiles(map)) {
    ctx.fillStyle = '#44aaff';
    ctx.fillRect(patch.col * scale, patch.row * scale, scale * 1.5, scale * 1.5);
  }
  
  // Start positions
  ctx.fillStyle = playerFaction === Faction.Terran ? '#4488ff' : '#cc2244';
  ctx.beginPath();
  ctx.arc(15 * scale, 15 * scale, scale * 3, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#cc4422';  // enemy
  ctx.beginPath();
  ctx.arc(112 * scale, 112 * scale, scale * 3, 0, Math.PI * 2);
  ctx.fill();
}
```

---

## AA.5 — Menu State Machine

The start screen becomes a proper state machine with distinct screens:

```
MAIN_MENU
├── PLAY → GAME_SETUP → LOADING → IN_GAME
├── CAMPAIGN → CAMPAIGN_SELECT → MISSION_BRIEF → LOADING → IN_GAME
├── WATCH_REPLAY → REPLAY_SELECT → IN_GAME(replay mode)
├── SETTINGS → SETTINGS_SCREEN → MAIN_MENU
└── CREDITS → CREDITS_SCREEN → MAIN_MENU
```

Each screen is a full-screen `<div>` with CSS transitions (slide left/right, fade). Proper back-navigation via `Escape` key.

**Game Setup screen** (the current start screen, redesigned per AA.1-AA.2) shows:
- Faction picker
- Map carousel
- Difficulty selector (visual radio buttons not a dropdown)
- Enemy faction picker
- Advanced settings (collapsed by default)
- Prominent "START GAME" button

---

## AA.6 — Difficulty Visual Redesign

Replace the `<select>` dropdown with visual difficulty cards:

```
[ EASY ]    [ NORMAL ]    [ HARD ]    [ BRUTAL ]
  ★☆☆☆       ★★☆☆          ★★★☆        ★★★★
  Relaxed    Balanced      Challenging  Merciless
  Waves      Waves &       Aggressive   Director AI
  only       Harassment    AI + Tech    + All Modes
```

Each card shows:
- Star rating
- Name
- 3 bullet points of what changes
- A colour: Easy=green, Normal=blue, Hard=orange, Brutal=red

Selected card: glowing border in its accent colour. Hover: slight lift effect.

---

## AA.7 — Map Playstyle Tags System

Each map registers a set of tags that inform both the UI and the AI Director:

```typescript
export const MAP_METADATA: Record<MapType, MapMetadata> = {
  [MapType.Plains]:      { tags: ['open', 'air-friendly', 'economic'],  aiPreference: 'balanced' },
  [MapType.Canyon]:      { tags: ['choke', 'siege-favored', 'defensive'], aiPreference: 'mech' },
  [MapType.Islands]:     { tags: ['water', 'drop-heavy', 'isolated'],   aiPreference: 'air' },
  [MapType.Crossfire]:   { tags: ['skirmish', 'early-pressure', 'fast'], aiPreference: 'rush' },
  [MapType.Fortress]:    { tags: ['defensive', 'macro', 'turtle'],       aiPreference: 'macro' },
  [MapType.Archipelago]: { tags: ['air', 'islands', 'drop'],             aiPreference: 'air' },
  [MapType.Deadlock]:    { tags: ['symmetric', 'army-fight', 'no-expand'], aiPreference: 'bio' },
  [MapType.DesertStorm]: { tags: ['aggressive', 'contested', 'mobile'], aiPreference: 'harass' },
  [MapType.FrozenTundra]:{ tags: ['methodical', 'ranged', 'maze'],       aiPreference: 'mech' },
  [MapType.Volcano]:     { tags: ['dynamic', 'risky', 'mobile'],         aiPreference: 'skirmish' },
};
```

The AI Director uses `aiPreference` to bias its unit composition and timing. On "rush" maps, it skips macro and goes aggressive immediately. On "turtle" maps, it builds up slowly for a devastating late push.

---

## AA Sprint Order

| # | Item | Effort |
|---|------|--------|
| AA.1 | Full start menu redesign (faction cards, layout) | 4h |
| AA.6 | Difficulty visual cards | 1h |
| AA.2 | Map selection carousel + descriptor tags | 3h |
| AA.4 | Map preview canvas renderer | 2h |
| AA.3 | 7 new maps (Crossfire through Volcano) | 4h |
| AA.7 | Map metadata tags + AI Director integration | 1h |
| AA.5 | Menu state machine (Campaign/Settings/Credits screens) | 3h |

**Total: ~18 hours (2–3 days)**
**Impact: The game's first impression is transformed from debug form to proper game launcher.**

Add to **Sprint Calendar**:
```
Sprint 101 (2d): AA.1-AA.6       — Start menu redesign + difficulty visual cards
Sprint 102 (2d): AA.2-AA.4       — Map carousel + preview canvas renderer
Sprint 103 (2d): AA.3             — 7 new maps with distinct topography
Sprint 104 (1d): AA.7-AA.5        — Map metadata + menu state machine
```

---

## Architecture Evolution Map

```
Current (v0.1):
  PixiJS Graphics → TypedArray ECS → Fixed-step tick → A* pathfinding

v1.0 target:
  PixiJS Graphics → TypedArray ECS → Fixed-step tick → A* pathfinding
  + Seeded RNG    + Command queue  + Replay system  + Spatial hash
  + WebRTC P2P    + Lockstep      + 3 factions     + Campaign engine

v2.0 target:
  PixiJS (WebGPU) → Archetype ECS → Worker tick → WASM pathfinding
  + Full mod API  + Analytics    + Tournament    + Open plugin system
  + Persistent world + CDN delivery + Community tools
```

---

---

# Iteration BB — Competitive Balance & Metagame

## BB.1 — Unit Interaction Matrix

A formal "rock-paper-scissors" interaction map for every matchup, documented and enforced in unit stats:

```
Terran vs Zerg:
  Marines → Zerglings ✓ (splash from grenade/stimmed DPS)
  Banelings → Marines ✓ (splash kills clumped bio)
  Marauders → Roaches ✓ (Concussive + Armored bonus)
  Roaches → Marines ✓ (tankier, survives longer per-mineral)
  Siege Tanks → Roach/Ravager ground pushes ✓ (splash + range)
  Mutalisks → Siege Tanks ✓ (air, tanks can't respond)
  Vikings → Mutalisks ✓ (air-to-air counter)
  Hydralisks → Vikings ✓ (anti-air ground unit)

Terran vs Protoss:
  Marines → Zealots ✓ (kite with stim)
  Marauders → Stalkers ✓ (Armored bonus, suppresses Blink)
  Siege Tanks → Immortals ✓ (siege range > Hardened Shield threshold)
  Ghosts → High Templar ✓ (EMP drains shield before storm)
  Vikings → Carriers ✓ (air-to-air vs capital ship)

Zerg vs Protoss:
  Zerglings + Banelings → Zealot/Stalker wall ✓ (Baneling breaks force fields)
  Roach-Ravager → Immortal ✓ (Bile bypasses Hardened Shield)
  Mutalisk → Stalker/Sentry ✓ (Blink wasted chasing Mutalisks)
  Infestor → Colossus ✓ (Fungal roots Colossus, army surrounds)
  Corruptor → Carrier ✓ (pure air-to-air counter)
```

Codified into a `MATCHUP_GUIDE.md` and used to tune unit stats in the balance pass.

## BB.2 — Dynamic Balance Patch System

A JSON balance file (`src/data/balance.json`) that can be updated without redeploying:

```json
{
  "version": "1.2.0",
  "date": "2026-04-15",
  "changes": {
    "Marine.hp": 45,
    "Marine.damage": 6,
    "Zergling.speed": 4.1,
    "Baneling.damage": 20,
    "SiegeTank.atkRange_sieged": 13
  }
}
```

`Game.ts` fetches this file on startup (with a fallback to hardcoded defaults). Players always play the latest balance without a cache bust. GitHub Actions auto-commits balance changes from the telemetry balance report (Iteration X.3).

## BB.3 — Unit Win-Rate Dashboard

A public `/balance` page (GitHub Pages) showing real-time win rates per unit from telemetry:

- Unit used vs win rate (bar chart per unit)
- Most common counter-composition (what units were in winning armies that beat each unit)
- "Tier list" auto-generated from data: S/A/B/C/D tiers based on >55%/>50%/>45%/<45%/<40% win rates
- Updated weekly from Supabase aggregates

---

# Iteration CC — Advanced AI Personalities

## CC.1 — Named AI Commanders (15 profiles)

Replace the single "personality" with 15 distinct named AI commanders, each with unique playstyle:

| Commander | Race | Style | Signature |
|-----------|------|-------|-----------|
| **Kerrigan** | Zerg | Aggressive macro | Mass Zerglings + Banelings at 3:00, never stops pushing |
| **Abathur** | Zerg | Bio-focus | Roach-Ravager-Corruptor, tech-rushes Infestation Pit |
| **Izsha** | Zerg | Creep spread | Maximises creep network, Ultralisk finisher |
| **Raynor** | Terran | Bio-heavy | Mass Marine/Marauder, constant Medivac support |
| **Tychus** | Terran | Hellion harass | Opens with Hellion mineral-line harassment, Battlecruiser close |
| **Mengsk** | Terran | Bunker turtle | Masses bunkers + missile turrets, Planetary Fortress, then BC push |
| **Nova** | Terran | Ghost ops | Drops Ghosts behind enemy lines, EMP then army |
| **Artanis** | Protoss | Warp-gate swarm | Masses Zealots + Stalkers via Warp-in |
| **Vorazun** | Protoss | Dark Templar | Permanent cloak harassment, Shadow Fury |
| **Alarak** | Protoss | Death march | Small elite army, max upgrade bonuses, never retreats |
| **Zagara** | Zerg | Baneling bus | Constant Baneling drops, Scourge vs air |
| **Stukov** | Terran | Infested | Hybrid units (placeholder for future content) |
| **Swann** | Terran | Mech | All vehicles, no bio, Thor + Tank + Hellbat |
| **Fenix** | Protoss | Colossus push | Colossus + Immortal spine, no harassment |
| **Ji'nara** | Protoss | Void Ray swarm | Air-only composition, skips ground entirely |

Each commander has: a distinct `buildOrder[]`, specific `unitWeights{}`, a `personality` multiplier set, and a unique `specialEvent` (e.g., Tychus always drops a "ODIN is go!" message when reaching wave 5 and deploying a Thor).

## CC.2 — Commander Select Screen

On the start screen, after choosing difficulty, select the AI commander:
- Grid of commander portraits (geometric avatars in faction colour)
- Each shows: name, faction icon, 3 trait tags (e.g., "Aggressive / Bioball / No retreat")
- "Random" option selects a commander appropriate for the chosen difficulty
- Commander portrait shown in bottom-right corner during the game ("You are facing: Raynor")

## CC.3 — Commander Dialogue

Each commander has 5 voice lines triggered at key moments (via Web Speech API in different voices):

| Moment | Example (Raynor) |
|--------|-----------------|
| Game start | "Battlecruiser operational. Let's roll." |
| Wave 3 | "Time to show 'em what we're made of." |
| 50% army lost | "Pull back! Regroup!" |
| Expansion spotted | "They're expanding. Hit 'em now." |
| Victory | "Hell of a fight. Good work, soldier." |

Distinct voices per commander via `SpeechSynthesisUtterance.voice` selection (browser provides 10+ voices).

---

# Iteration DD — Spectator League & Esports

## DD.1 — League Mode

A persistent weekly "league" using the signaling server:

- Every Sunday, 8 players are automatically seeded into a bracket
- Games are played throughout the week at the players' convenience
- Results automatically submitted when a ranked game is completed between two bracket participants
- Final standings posted to the leaderboard on Saturday

## DD.2 — Observer Pack

Spectator tools for competitive play:

- **Army strength bars**: two horizontal bars at top of screen showing Terran vs Zerg army value in real time
- **Resource graph**: live line graph of both players' mineral rates
- **Unit count table**: side-by-side table showing each player's army composition (Marines: 24 | Zerglings: 38)
- **F9 toggle**: switch between normal view and "caster view" (above spectator UI, larger minimap, no HUD)

## DD.3 — Auto-Commentary (Experimental)

Real-time text commentary generated from game events:

```
[3:42] Terran player pulls 8 Marines from mineral line
[3:45] Zerg wave incoming! 12 Zerglings + 4 Banelings
[3:47] CRITICAL: Banelings connect — Terran loses 6 Marines
[3:48] Terran counter-attacks with Marauders — Zerg retreats
```

Shown as a scrolling feed on the spectator screen. Triggered by event thresholds in the existing `GameStats` and `damageEvents` systems.

---

# Iteration EE — Procedural Map Generation

## EE.1 — Fully Procedural Maps

Beyond the hand-crafted maps, generate random maps at game start using a procedural algorithm:

**Generation algorithm (Cellular Automata + Constraints):**
1. Fill a 128×128 grid with 60% ground, 40% water randomly
2. Run 4 iterations of cellular automata (tile becomes water if 5+ neighbours are water)
3. Enforce: player base area (25×25 around start point) is fully walkable
4. Mirror: copy the top-left quadrant to bottom-right for symmetric competitive play
5. Place mineral patches + gas geysers at optimal locations (connected to base, reachable)
6. Validate: A* path exists between start positions; if not, regenerate

**Seeded generation:** The same seed always produces the same map. Multiplayer players both generate from the shared game seed — guaranteed identical maps without transmitting tile data.

## EE.2 — Map Generation Parameters

Expose sliders on the start screen (under Advanced Settings):
- **Water density** (10%–60%): how much of the map is water
- **Choke factor** (0–100%): tendency to form narrow corridors vs open spaces
- **Resource richness** (low/medium/high): mineral patch count and per-patch amounts
- **Symmetry** (2-player symmetric, 4-player, asymmetric)
- **Feature injection**: toggle each of: destructible rocks, Xel'Naga towers, neutral expansion bases

## EE.3 — Daily Challenge Map

Every day a new procedurally-generated "Daily Challenge" map is available:
- Seeded from the UTC date (`seed = Math.floor(Date.now() / 86400000)`)
- Same map for all players worldwide that day
- Score submitted to a daily leaderboard (win time + APM + units lost)
- Badge awarded for completing the daily challenge

---

# Iteration FF — Tutorial & Onboarding

## FF.1 — Interactive Tutorial (5 lessons)

Replaces the first-run hint system with a full guided tutorial:

| Lesson | Title | Teaches |
|--------|-------|---------|
| 1 | Workers & Minerals | Select SCVs, right-click mineral patches, watch income grow |
| 2 | Supply & Production | Build Supply Depot, build Barracks, train first Marine |
| 3 | Attack & Defend | Select Marines, attack-move, retreat wounded units |
| 4 | Tech & Upgrades | Build Factory, research upgrade at Engineering Bay |
| 5 | The Full Loop | Complete a game vs Easy AI using everything learned |

Each lesson: triggered UI lock (can only do the highlighted action), arrow indicators, voice narration via Web Speech API, completion checkmarks.

## FF.2 — Contextual In-Game Tips

A non-intrusive tip system that triggers once per unique situation:

| Situation | Tip shown |
|-----------|-----------|
| First time under attack while camera elsewhere | "You're under attack! Press Space to jump to base." |
| First time supply-capped | "Supply blocked! Build more Supply Depots (B→2)." |
| Worker count drops below 8 | "Low worker count. Train more SCVs to maintain income." |
| Enemy Mutalisks appear, player has no anti-air | "Mutalisks incoming! Build Vikings (Starport) or Thors (Factory)." |
| Player hasn't used control groups by minute 3 | "Tip: Ctrl+1 assigns units to group 1. Press 1 to recall." |

Tips shown once per session, stored in `localStorage['seen_tips']`.

## FF.3 — Unit Encyclopedia

A full in-game encyclopedia accessible from the main menu (keyboard shortcut: E from start screen):

Each unit has a dedicated page showing:
- Large portrait (the 22-layer portrait renderer)
- Stats table (HP, shield, damage, range, speed, cost, build time)
- Ability descriptions with cooldowns and costs
- "Strong against / Weak against" section using the interaction matrix (BB.1)
- Lore flavour text (2–3 sentences per unit)
- Video clip placeholder (replaced by animated GIF of the unit in action, captured from gameplay)

---

# Iteration GG — Full Sound Redesign

## GG.1 — Procedural Music Composer

Upgrade the adaptive music system (Iteration D.5) to a full procedural composer:

**Instruments (all Web Audio oscillators):**
- Bass: 80Hz square wave, pattern-driven (16-step sequencer at 120 BPM)
- Harmony: 4 oscillators (root + 3rd + 5th + 7th), chord progression engine
- Lead: sawtooth oscillator with portamento, melodic patterns
- Drums: noise burst (kick) + mid-noise (snare) + high-noise (hi-hat)
- Strings: 6 detuned sawtooth oscillators, reverb

**Musical states:**
- **Terran theme:** Minor key, industrial feel, 4/4 tempo, bass-heavy
- **Zerg theme:** Odd time signatures (7/8, 5/4), organic swells, no clear beat
- **Protoss theme:** Major pentatonic, ethereal pads, crystalline arpeggios
- **Combat:** Tempo increases, percussion adds, dissonant notes increase
- **Victory:** Bright major resolution, full orchestra swell
- **Defeat:** Slow minor descent, sustained bass

## GG.2 — Sound Effects Library Expansion

50 additional sound effects covering every game event:

| Category | New sounds |
|----------|-----------|
| Building | Construction start (each building unique), placement invalid, upgrade complete |
| Combat | Per-weapon-type fire (Gauss rifle vs Baneling acid vs Psionic bolt), unit collision thud |
| Abilities | Each of 20 abilities has a unique sound signature |
| UI | Menu navigation clicks, hotkey press confirm, error buzz |
| Environment | Water lapping, wind on cliffs, lava bubbling (Volcano map) |
| Zerg | Creep expansion sound, Larva hatching, Hatchery pulse |

## GG.3 — 3D Audio Positioning

Full WebAudio `PannerNode` implementation (not the simplified distance-fade):

- Every sound source is a `PannerNode` positioned in 3D space matching the unit's world coordinates
- Listener position = camera center
- Sounds from left of camera pan left, sounds from right pan right
- Distance attenuation model: `inverse` (SC2-standard)
- This makes the soundscape genuinely spatial — the player feels the battle around them

---

# Iteration HH — Post-Launch Growth

## HH.1 — Plugin Marketplace

Allow community-created plugins distributed as ES modules loaded from URL:

```typescript
// Community plugin: "Marine Corps" — replaces all Terran infantry models
import MarineCorps from 'https://swarm-mods.github.io/marine-corps/index.js';
game.plugins.register(MarineCorps);
```

Plugins can override: unit renderers, sound effects, building definitions, UI panels.
Safety: plugins run in a sandboxed iframe with `postMessage` API — no direct DOM/game access.

## HH.2 — User-Generated Missions

A mission editor built on top of the map editor (Iteration I):

- Script simple objectives via a node graph UI (no code)
- Share missions via URL (same base64 approach as maps)
- Community mission rating system

## HH.3 — Localisation (4 Languages)

Full game translation into:
- **German** (de): large European gaming market
- **French** (fr): second-largest EU market
- **Spanish** (es): Latin America growth market
- **Korean** (ko): RTS heartland, SC2 is most popular in Korea

All UI strings use the i18n system (Iteration Q.5). Community translators can submit PRs to `src/i18n/`.

## HH.4 — Console & Native Wrappers

**Electron wrapper (desktop app):**
- Packages the game as a native Windows/Mac/Linux app via Electron
- Adds: native file save/load for replays, system tray integration, offline support
- CI/CD auto-builds installers via GitHub Actions + `electron-builder`

**Tauri alternative (smaller bundle, Rust runtime):**
- 10× smaller than Electron (~5MB vs ~50MB)
- Better performance (no Node.js overhead)
- Native OS notifications for "Daily Challenge available"

---

# Extended Grand Sprint Calendar (Sprints 105–150)

```
Sprint 105 (2d): BB.1-BB.2       — Interaction matrix + dynamic balance JSON
Sprint 106 (1d): BB.3             — Win-rate dashboard + tier list
Sprint 107 (2d): CC.1-CC.2        — 15 AI commanders + select screen
Sprint 108 (1d): CC.3             — Commander dialogue + voice lines
Sprint 109 (1d): DD.1             — League mode + weekly brackets
Sprint 110 (1d): DD.2-DD.3        — Observer pack + auto-commentary
Sprint 111 (2d): EE.1-EE.2        — Procedural map generation + parameters
Sprint 112 (1d): EE.3             — Daily challenge map + leaderboard
Sprint 113 (2d): FF.1             — Interactive tutorial (5 lessons)
Sprint 114 (1d): FF.2-FF.3        — Contextual tips + unit encyclopedia
Sprint 115 (2d): GG.1             — Procedural music composer (5 states)
Sprint 116 (2d): GG.2-GG.3        — Sound library expansion + 3D audio
Sprint 117 (1d): HH.1             — Plugin marketplace + sandboxed loader
Sprint 118 (2d): HH.2             — User-generated mission editor
Sprint 119 (2d): HH.3             — Localisation (de/fr/es/ko)
Sprint 120 (2d): HH.4             — Electron + Tauri native wrappers
Sprint 121 (2d): N ext            — Protoss Tier 2: High Templar + Dark Templar
Sprint 122 (2d): N ext            — Protoss Tier 3: Void Ray + Tempest + Mothership
Sprint 123 (2d): M ext            — Full Terran unit parity (Hellbat, Bunker, Missile Turret, Planetary Fortress)
Sprint 124 (2d): Zerg ext         — Full Zerg unit parity (Overseer, Changeling, Nydus Worm)
Sprint 125 (3d): AI balance       — Tune all 15 commanders with telemetry data
Sprint 126 (2d): 3rd faction AI   — Protoss AI build orders (Gateway, Colossus, Blink Stalker)
Sprint 127 (2d): Map pack 3       — 5 more competitive maps (procedurally seeded + hand-tuned)
Sprint 128 (1d): Social           — Clan system + friend list via Supabase
Sprint 129 (2d): Mobile v3        — Optimise TouchCommandBar for new units (Protoss abilities)
Sprint 130 (1d): Perf audit       — Profile 400-entity battle, fix regressions post-WebGPU
Sprint 131 (1d): Security v2      — Rate-limit leaderboard API, verify mod sandbox escape prevention
Sprint 132 (1d): Docs v2          — Full architectural docs: ECS guide, lockstep guide, mod SDK guide
Sprint 133 (2d): Tutorial v3      — Protoss tutorial (warp-in, Chrono Boost, Shield mechanics)
Sprint 134 (1d): Balance v3       — Full 3-faction balance sweep post-all-units
Sprint 135 (1d): Soundtrack       — Release OST as separate page/download (procedurally recorded)
Sprint 136 (2d): Editor v2        — Map editor supports Protoss power grids, Zerg creep zones
Sprint 137 (1d): Analytics v3     — Per-commander win-rate breakdown, map preference stats
Sprint 138 (1d): Legal v2         — Open-source assets audit, trademark checks
Sprint 139 (2d): Ladder Season 2  — First season with Protoss faction active
Sprint 140 (1d): QA blitz         — 100 manual test cases across all 3 factions
Sprint 141 (1d): Regression       — Expand automated test suite to 400+ tests
Sprint 142 (1d): Stress test      — 400-unit replay stress test, memory leak checks
Sprint 143 (2d): v3.0 prep        — Feature freeze, release notes, migration guide for mods
Sprint 144 (1d): v3.0 launch      — Tag, deploy, blog post, community announcement
Sprint 145 (2d): Post-launch      — Hotfix window, community Discord setup
Sprint 146 (1d): Retrospective    — Full retrospective blog: architecture decisions, lessons learned
Sprint 147 (2d): Hackathon        — Open "Mod Jam" event — community creates mods in 48h
Sprint 148 (1d): Plugin showcase  — Curate top 10 community mods into official gallery
Sprint 149 (2d): Engine OSS       — Extract ECS + game loop into a standalone OSS library ("swarm-engine")
Sprint 150 (1d): Legacy           — Archive, documentation, hand-off to community maintainers
```

---

## The Complete Vision: 150 Sprints, ~180 days, 36 weeks

```
Phase 1  (Sprints 1–10):    Polish & fix. 2 factions feel great. AI is alive.
Phase 2  (Sprints 11–30):   Audio, visuals, campaign foundation.
Phase 3  (Sprints 31–55):   3 factions. Multiplayer. Map editor. v1.0 launch.
Phase 4  (Sprints 56–70):   AI Director. Ranked. Modding. Analytics.
Phase 5  (Sprints 71–104):  Full unit parity. Esports. Start menu. Procedural maps.
Phase 6  (Sprints 105–120): Balance system. 15 AI commanders. 3D audio. Native apps.
Phase 7  (Sprints 121–144): Protoss complete. All units. v3.0 launch.
Phase 8  (Sprints 145–150): Community handoff. Engine OSS. Legacy.
```

**End state at Sprint 150: Not just a game — an open-source RTS engine. The game ships as a showcase. The engine lives on.**

---

## Dependency Graph: Critical Path

```
Sprint 1 (Tech UI) ──────────────────────────────────────────────────────────┐
Sprint 4 (AI Defense) ────────────────────────────────────────────────────── │
Sprint 7 (Marine visual) ──────────────────────────────────────────────────  │
  └─ Sprint 8 (All visuals) ─────────────────────────────────────────────── │
Sprint 16 (Determinism) → Sprint 17 (Lockstep) → Sprint 18 (Reconnect)      │
  └─ Sprint 34 (Spectator) → Sprint 110 (Observer) → Sprint 144 (v3.0 ship) │
Sprint 19 (Campaign) → Sprint 60 (Campaign) → Sprint 113 (Tutorial)         │
Sprint 30 (Protoss shields) → Sprint 31 (Warp-in) → Sprint 32 (Full Protoss)│
  └─ Sprint 121-122 (Tier2-3) → Sprint 134 (Balance v3) ──────────────────  │
Sprint 56 (AI Director) → Sprint 107 (15 commanders) → Sprint 125 (balance) │
Sprint 101 (Start menu) → Sprint 103 (7 maps) → Sprint 111 (Proc gen)       │
Sprint 62 (Mod loader) → Sprint 117 (Marketplace) → Sprint 149 (Engine OSS) │
All paths ───────────────────────────────────────────────────────────────────┘
                                                                              ▼
                                                            Sprint 150: Legacy
```

**Every feature feeds the next. The critical path is: Fix → Fight → Look → Sound → Multiplayer → 3 Factions → Community → Open Source.**

---

---

# Iteration II — Team Multiplayer (2v2 / 3v3 / 4v4)

## II.1 — Shared Vision & Allied Units

The biggest multiplayer leap after 1v1: team games fundamentally change strategy.

**Allied mechanics:**
- **Shared vision**: all teammates see everything each other sees (fog of war merged)
- **No friendly fire** (default): splashes from Siege Tanks / Banelings cannot hit allies
- **Allied building placement**: players can place structures anywhere on the map, not just near their own base
- **Shared resources** (optional setting): minerals pooled across the team vs individual

**Ally indicator**: allied units display a slightly different selection ring colour (teal vs blue for Terran-Terran) so players can distinguish their own units from allies.

## II.2 — Team Faction Drafting

Before the game starts, team players each independently choose:
1. Their faction (Terran / Zerg / Protoss)
2. Their role preference: **Macro** (economy focus) / **Harass** (early pressure) / **Army** (main force)

The AI director adjusts based on which roles are present — if both players picked Macro, pressure comes earlier.

**Lobby UI changes**: a 2×2 or 3×3 grid of player slots. Each row = one team. Each slot shows: player name, faction icon, chosen role. Colour-coded team rows (blue team vs red team).

## II.3 — 2v2 Specific Maps

Maps designed for team play have distinct zones:
- Each player has their own base pocket (not shared)
- A contested center large enough for multiple armies
- "Rotations" — paths connecting the two bases on each team (so teammates can reinforce each other)

**New 2v2 maps:**
- **Twin Peaks** (2v2): Each team shares a plateau. Opponents on the other plateau. One central bridge. Drop-heavy.
- **Chasm** (2v2): Teams on opposite sides of a massive chasm. Three narrow bridges, each defendable. Forces the fight onto the bridges.
- **Colosseum** (2v2/4v4): A circular arena. All 4 bases in the corners, open center. Constant skirmishing.

## II.4 — Team Communication

Simple in-game communication tools (no voice, no chat spam risk):

- **Quick pings**: press Alt+click anywhere to send a map ping visible to all teammates
- **Ping types**: Attack (red exclamation), Defend (blue shield), Expand (green flag), Retreat (yellow arrow)
- **Minimap callout**: pings show on minimap as coloured blinking dots
- **"On my way"**: press M to broadcast "On my way!" as a floating text notification near ally's ping

---

# Iteration JJ — Advanced Pathfinding & Movement

## JJ.1 — Hierarchical Pathfinding (HPA*)

Current A* recalculates the full path every time a unit needs to chase a moving target. At 200 units this means 200 A* searches per repath interval.

**Hierarchical A* (HPA*) implementation:**

1. Divide the 128×128 map into 8×8 **sectors** (256 sectors total)
2. Pre-compute **inter-sector edges**: for each pair of adjacent sectors, find all tile pairs that connect them and record their cost
3. **High-level path**: A* over sectors (fast — only 256 nodes vs 16,384)
4. **Low-level path**: A* within each sector to connect the waypoints from the high-level path

**Result**: 10–15× speedup for long-distance paths. Short paths (<3 tiles) use direct A* (no overhead). Falls back gracefully if sector graph is invalid.

**Files:** `src/map/HPAPathfinder.ts`, replaces `src/map/Pathfinder.ts`

## JJ.2 — Army Flocking (Reynolds Boids)

Replace the current O(n²) separation pass with a proper flocking algorithm for combat units in AttackMove mode:

**Three rules (applied in order):**
1. **Separation**: steer away from nearby flockmates (existing, improved)
2. **Alignment**: steer toward average heading of flockmates within 3 tiles (new)
3. **Cohesion**: steer toward average position of flockmates within 5 tiles (new)

This creates organic-looking army movement — armies don't just blob-march in a square; they spread naturally, fill space intelligently, and reform after obstacles.

**Tuning per unit type:**
- Zerglings: high cohesion, low separation → tight swarm feel
- Marines: balanced → orderly formation
- Mutalisks: high separation, low cohesion → spread harassment cloud

## JJ.3 — Terrain Weight Map

Different terrain types affect movement speed beyond walkable/not-walkable:

```typescript
const TERRAIN_SPEED_MULTIPLIER: Record<TileType, number> = {
  [TileType.Ground]:     1.0,
  [TileType.Cliff]:      0.0,  // impassable
  [TileType.Water]:      0.0,  // impassable (or 0.3 for air)
  [TileType.Sand]:       0.85, // Desert Storm map — already planned
  [TileType.Ice]:        0.9,  // Frozen Tundra — already planned
  [TileType.Creep]:      1.3,  // Zerg speed bonus — already exists
  [TileType.Lava]:       0.0,  // Volcano — lethal
  [TileType.Shallow]:    0.6,  // wading through ankle-deep water
  [TileType.Road]:       1.15, // paved paths inside Terran bases
};
```

Applied in `MovementSystem` as `effectiveSpeed *= TERRAIN_SPEED_MULTIPLIER[currentTile]`. The pathfinder's cost function is updated to weight tile types so units naturally prefer roads and avoid sand.

## JJ.4 — Collision Resolution (Circle-Circle)

Current separation is position-based pushing. Add proper velocity-based collision resolution:

When two units overlap:
1. Compute penetration depth (distance between centers minus sum of radii)
2. Compute collision normal (normalized vector from center A to center B)
3. Apply impulse: `velocity += normal * penetrationDepth * RESTITUTION_FACTOR`

This makes units physically push each other out of the way rather than teleporting apart, giving melee fights a visceral feel when masses collide.

---

# Iteration KK — Terrain Deformation & Environmental Hazards

## KK.1 — Crater System

When a Siege Tank shell or Baneling explodes on the ground, it leaves a **crater**:

- The tile at the impact point becomes `TileType.Crater`
- Crater: passable but speed 0.75× (rough terrain), visually a dark depressed circle
- Craters persist until end of game
- After 12 craters in a small area, the terrain becomes "blasted" — that zone is visually darker

**Visual:** At the explosion impact point, a dark circle rendered under units, plus 4-6 small debris sprites (short line segments) radiating outward.

**Implementation:** New `craterMap: Uint8Array` (like `creepMap`). Updated in `AbilitySystem` when splash damage fires. `TilemapRenderer` draws craters as a dark overlay layer.

## KK.2 — Destructible Terrain (Bridges)

On Islands and Archipelago maps, the narrow land bridges can be **destroyed** by concentrated fire:

- Bridge tile type: `TileType.Bridge = 10`, HP: 500
- When bridge HP drops to 0: all bridge tiles become water tiles, pathfinder cache invalidated
- Bridge rebuilding: SCVs / Drones can repair bridges (B+right-click on broken bridge tile), takes 60s

This creates a strategic decision: destroy the bridge to cut off reinforcements, or preserve it for your own advance.

## KK.3 — Environmental Hazard Events

Dynamic hazard events triggered on specific maps:

**Volcano Eruption (Volcano map):** Already planned (every 90s, lava zone). Extend:
- Visual: actual red-orange lava tiles spreading from center, 3-tile radius
- Units in lava zone: 50 dmg/s, forced movement out of zone (AI units flee automatically)
- Screen effect: red vignette, camera shake, rumble sound

**Storm Front (Desert Storm map):** A sandstorm sweeps across the map every 3 minutes:
- Direction: random, announced 15s ahead with "SANDSTORM APPROACHING" alert
- During storm: vision range halved for all ground units, projectiles slower
- Lasts 30 seconds

**Tidal Wave (Archipelago map):** Every 4 minutes, one bridge submerges temporarily:
- Announced 20s ahead: "TIDAL SURGE WARNING — Bridge 2"
- That bridge becomes impassable for 45s
- Forces armies to reroute, creates tactical opportunity

---

# Iteration LL — Build Order Trainer & Educational Mode

## LL.1 — Build Order Database

A curated database of real SC2 build orders translated for Swarm Command:

```typescript
interface BuildOrder {
  name: string;
  faction: Faction;
  matchup: string;          // e.g. "TvZ", "ZvP"
  type: 'rush' | 'macro' | 'timing' | 'cheese';
  difficulty: 1 | 2 | 3;   // 1=beginner, 3=advanced
  steps: BuildOrderStep[];  // exact supply/time triggers
  tips: string[];
  counterTo: string[];      // what this beats
  weakTo: string[];         // what beats this
  videoUrl?: string;        // placeholder for future
}
```

30 build orders across all factions and matchups. Browsable from the main menu.

## LL.2 — Build Order Practice Mode

A mode where the player follows a specific build order in real-time:

- Target build order displayed as a HUD overlay: next action highlighted
- Timer showing how far ahead/behind optimal timing the player is
- "Ghost overlay": a ghost version of the ideal army/economy at this timestamp shown at 30% opacity
- Score: 0–100 based on how closely timing was followed

**Files:** `src/scenarios/BuildOrderPractice.ts` — a game mode that creates a special tick listener and compares the player's world state to the expected world state at each build order step.

## LL.3 — APM Trainer

A dedicated mode to improve actions-per-minute:

- Metronome tick sound with visual flash (sets a rhythm)
- "Action prompts": random highlighted unit + action type appears every 0.5–1s
- Player must click the correct unit and press the correct key before next prompt
- Score = (correct actions / total prompts) × APM achieved
- Difficulty: APM targets (60 / 90 / 120 / 150 / 200)

## LL.4 — Strategy Glossary

In-game glossary (accessible from tutorial screen) explaining RTS terminology:

| Term | Definition |
|------|-----------|
| APM | Actions Per Minute — how many commands you issue per minute |
| Macro | Managing your economy and production efficiently |
| Micro | Precise control of individual units in battle |
| All-in | Committing all resources to one attack — no fallback |
| Cheese | An unexpected early strategy designed to catch opponents off guard |
| Creep | Zerg terrain that boosts Zerg unit speed |
| Supply-blocked | Unable to train more units because supply is at cap |
| Kite | Moving units away while they attack to avoid return fire |
| AoE | Area of Effect — abilities that damage multiple units at once |
| Timing attack | Attacking at the exact moment your composition peaks |

50 terms total. Searchable. Links to relevant units/abilities where applicable.

---

# Iteration MM — API Ecosystem & Third-Party Tools

## MM.1 — Public Game Data API

A serverless REST API (Cloudflare Workers, free tier) exposing game data:

```
GET /api/units              — all unit definitions
GET /api/units/:id          — single unit with stats and abilities
GET /api/buildings          — all building definitions
GET /api/balance/current    — current balance.json values
GET /api/leaderboard?faction=Terran&difficulty=Hard&limit=100
GET /api/replays/:id        — fetch a shared replay by ID
POST /api/replays           — upload a replay (returns shareable ID)
POST /api/scores            — submit a game score
GET /api/stats/global       — aggregated telemetry data
```

JSON responses. No authentication for read-only endpoints. Rate-limited at 100 req/min per IP.

## MM.2 — Overlay SDK for Streamers

A JavaScript SDK (`swarm-overlay.js`) that streamers embed on their overlay page (e.g., StreamElements, Overwolf):

- Reads from `localStorage` (same origin as game)
- Exposes: `getCurrentGame()`, `getArmyValue()`, `getLastWave()`, `subscribeToEvents(callback)`
- Overlay can show: current game stats, live unit count, income rate
- Sample overlay template: a sleek bottom-bar showing both players' army values

## MM.3 — Replay Hosting Service

Integration with GitHub Gist for free replay hosting:

- "Share Replay" button on game-over screen
- Uploads the replay JSON to a new anonymous GitHub Gist
- Returns a URL: `swarm-command.github.io/replay?gist=abc123`
- That URL fetches the Gist content and loads the replay directly
- No server needed — Gist API is free and public

## MM.4 — Discord Bot Integration

A Discord bot (`@SwarmCommand`) for competitive communities:

```
/stats @Player         — shows player's win/loss, favourite faction, APM
/leaderboard top10     — shows top 10 players this season
/schedule match @p1 @p2 — schedules a match notification
/replay <URL>          — posts a replay summary with key stats
/quote                 — random unit voice line
```

Built on Discord.js, deployed on Railway free tier. Connects to the Supabase leaderboard.

---

# Iteration NN — Seasonal Events & Live Service

## NN.1 — Seasonal Content Calendar

A 4-season content calendar with unique maps, unit skins, and challenges:

| Season | Theme | Map | Unit Cosmetic | Challenge |
|--------|-------|-----|---------------|-----------|
| Spring | Renewal | Blossoming fields, cherry trees as resources | Marines in green armour | Win 3 games with all 3 factions |
| Summer | Inferno | Volcanic archipelago, heat waves | Hellions with chrome plating | Achieve 150+ APM in a game |
| Autumn | Harvest | Orange-tinted plains, pumpkin mineral patches | SCVs with harvest equipment | Win without losing any workers |
| Winter | Frozen | Snow-covered terrain, ice bridges | Ghost with white camouflage | Win on Brutal difficulty |

Seasons last 30 days. Cosmetics unlocked via challenge completion (stored in localStorage).

## NN.2 — Unit Skin System

Cosmetic alternate renders for units that don't change stats:

**Terran:**
- Marine "Dress Blues": Navy blue with gold trim instead of blue-grey
- SiegeTank "Demolisher": Red-and-black industrial colour scheme
- Ghost "Shadow Ops": All-black with red visor slit

**Zerg:**
- Zergling "Acid Strain": Bright yellow-green instead of red-purple
- Baneling "Crimson Sphere": Deep crimson instead of green

Skins stored as `renderTint` overrides in a skin profile. Selecting a skin changes the colour constants used in `UnitRenderer` for that unit type. The geometric shapes remain the same — just different colours.

## NN.3 — Weekly Mission

Every week a new mission challenge with a unique restriction:

| Week | Mission | Restriction |
|------|---------|-------------|
| 1 | Invasion | No building — only the units you start with |
| 2 | The Hive | Zerg only, no upgrades |
| 3 | Precision Strike | Win in under 5 minutes |
| 4 | Ghost Protocol | Ghosts only (+ SCVs for economy) |

Rewards: cosmetic title displayed on profile ("Ghost Protocol Veteran").

## NN.4 — Live Balance Events

Special 72-hour "meta shake-up" events:

- "Baneling Bonanza": Banelings deal 40 damage instead of 20 for 72 hours
- "Siege Supremacy": Siege Tanks fire 50% faster
- "Mutalisk Madness": Mutalisks have 6x speed but 50% HP

Communicated via the in-game news ticker at the top of the start menu. Opt-in only (toggle in settings: "Enable event balance overrides").

---

# Iteration OO — Team Economy & Shared Resources

## OO.1 — Resource Transfer

In team games, allow players to send minerals and gas to teammates:

- Select a mineral amount via a slider UI panel
- Click a teammate's portrait on the HUD to confirm transfer
- Transferred minerals instantly deducted from sender, added to receiver
- Visual: a floating credit icon animates from sender's base to receiver's

**Hotkey:** `Shift+M` opens the transfer panel.

## OO.2 — Shared Production Buildings

Ally units can be produced from your buildings (if you have idle production capacity):

- Right-click on an ally's unit training button → "Train for Ally"
- Produced unit spawns at ally's rally point
- Cost deducted from YOUR minerals
- Useful for: one player masses economy while the other masses military production

## OO.3 — Combined Army Control

In team games, option to give army control to a partner:

- `Ctrl+G` surrenders army control to your partner temporarily
- Your units appear as "guest units" in their control groups (different colour selection rings)
- Partner can command your units
- Revoke at any time with `Ctrl+G` again

---

# Iteration PP — Machine Learning AI

## PP.1 — Neural Network Training Framework

Long-term research track: train an AI using reinforcement learning against itself.

**Architecture:**
- **Observation space**: a 128×128 grid encoding (tile type, unit presence, unit HP, faction) at each cell + global features (resources, supply, waveCount, gameTime)
- **Action space**: discrete actions (build, train, attack-move to tile, research) + continuous (which tile, which unit type)
- **Reward function**: `+1` for each enemy unit killed, `+10` for each building destroyed, `+100` for game won, `-1` for each own unit lost

**Training setup:**
- Run 10,000 self-play games in headless mode (no rendering) using Node.js + the simulation worker (Iteration P.1)
- Record `(observation, action, reward, next_observation)` tuples
- Train a small neural network (TensorFlow.js, 3 hidden layers, 256 neurons each) on these tuples via DQN (Deep Q-Network)

**Files:** `src/ai/NeuralAI.ts` — wraps a trained TensorFlow.js model; called from `AISystem` as an alternative to the rule-based system.

## PP.2 — Behaviour Cloning Bootstrap

Before self-play, bootstrap the neural network by imitating existing rule-based AI:

- Record 1,000 games of the rule-based AI (Brutal difficulty) playing against itself
- Train the neural net via supervised learning to predict the rule-based AI's actions
- This gives the neural net a sensible starting point before expensive self-play

**Expected outcome**: a neural AI that initially plays like the existing Brutal AI, then improves beyond it through self-play.

## PP.3 — Human vs. Trained AI

The trained model is quantized to INT8 (dramatically smaller/faster) and bundled with the game (< 2MB). At Hard/Brutal difficulty, a toggle: "Classic AI" (rule-based) vs "Neural AI" (ML-trained).

The neural AI won't be perfect but it will feel genuinely surprising — it will occasionally discover unconventional strategies the rule-based AI never uses.

---

# Iteration QQ — Narrative Universe

## QQ.1 — Story Bible

A canonical backstory for the game universe (differentiated from Blizzard's SC2 lore to avoid IP issues):

**Setting:** The Outer Fringe, 2387. Three species clash over a dying star system.

- **The Confederation** (Terran): A military-industrial human faction. Pragmatic, adaptable, armed with repurposed mining equipment and improvised weapons. Their greatest strength: rebuilding faster than they're destroyed.
- **The Swarm** (Zerg): A hive-consciousness that integrates all lifeforms it encounters. Not evil — simply consuming. Their Queen drives them with a singular purpose: consume, evolve, grow.
- **The Forerunners** (Protoss): An ancient silicon-based species. They built civilisations when humans were still using fire. Now they're slowly dying — their birth rate is near zero. Every Protoss death is irreplaceable. Their technology compensates.

## QQ.2 — Unit Lore Pages

Each unit gets a 100-word lore entry in the Encyclopedia (Iteration FF.3):

**Marine:** "The backbone of Confederation ground forces. These men and women volunteered — or were conscripted — for the CMC-300 Powered Combat Suit programme. The suit's onboard stimulant injector is technically voluntary. Most Marines use it on the first day."

**Queen:** "The Swarm's first responder. A Queen is not a leader — she is a nerve junction. Through her, the Hive Mother feels the pulse of each base, injects vitality into new broods, and plants the seeds of expansion. She does not ask permission. The Swarm does not ask."

**Zealot:** "The Forerunners do not train soldiers. They elevate warriors. A Zealot has meditated for 40 years before their first battle. Their psi-blades are not weapons — they are extensions of the warrior's will. When a Zealot charges, they do not feel fear. They have forgotten the word."

## QQ.3 — Cinematics (Text-Based)

Each campaign mission opens with a 20-second text cinematic:

- Black screen
- Text appears line by line (typewriter effect at 40 characters/second)
- Atmospheric sound: faction-appropriate ambient audio
- A striking single image (geometric composition — no art assets needed): for example, a silhouette of a Marine helmet drawn with PixiJS Graphics at full resolution

**Example opening (T1):**
```
OUTER FRINGE — RELAY STATION ECHO-7
Day 1 of contact.

"They came at dawn.
 We had 8 Marines and a broken radio.
 The Commander said: hold until evac arrives.
 Evac never came.
 So we held."

— Corporal J. Rasmussen, after-action report
```

---

# Iteration RR — Sandbox & Custom Game Creator

## RR.1 — Scenario Editor

A node-graph-based scenario editor for creating custom one-off games:

**Conditions (left side of graph):**
- Time elapsed (> N seconds)
- Unit count (player has > N units)
- Building destroyed
- Wave number reached
- Resource threshold

**Actions (right side of graph):**
- Spawn units at location
- Change AI behaviour (aggressive / passive / retreat)
- Display message
- Grant resources
- Win / Lose the mission

Connect conditions to actions with arrows. Multiple conditions can feed one action (AND logic). Scenarios are JSON, shareable via URL.

## RR.2 — God Mode (Dev/Creator Mode)

Toggle in Advanced Settings: **God Mode**. Grants:

- Infinite minerals and gas (type doesn't deplete)
- Units cannot die (HP stays at 1 minimum)
- All tech immediately available (no prerequisites)
- Speed slider from 0.1× to 10× in real time
- "Instant build": all construction and training completes in 1 tick
- Enemy AI toggle: disable AI entirely for sandbox exploration
- Free camera (F11): removes all camera bounds, zoom from 0.1× to 20×

Perfect for: exploring map designs, creating screenshots/videos, testing unit compositions.

## RR.3 — Unit Sandbox

A dedicated "unit showroom" mode:
- Empty flat map
- Spawn any unit via a menu (no cost)
- Units of different factions fight each other
- Stats panel shows live DPS, HP remaining, time-to-kill calculations
- "Freeze time" (Escape): pauses simulation, lets you examine the battlefield
- Great for: testing the interaction matrix, recording ability demonstrations for the Encyclopedia

---

# Grand Sprint Calendar Extension (Sprints 151–200)

```
Sprint 151 (2d): II.1-II.2      — Team multiplayer: shared vision + faction drafting
Sprint 152 (2d): II.3-II.4      — 2v2 maps + team communication pings
Sprint 153 (2d): JJ.1           — HPA* hierarchical pathfinding
Sprint 154 (2d): JJ.2-JJ.3      — Army flocking (boids) + terrain weight map
Sprint 155 (1d): JJ.4           — Circle-circle collision resolution
Sprint 156 (2d): KK.1-KK.2      — Crater system + destructible bridges
Sprint 157 (2d): KK.3           — Environmental hazards (storm, tidal wave, eruption)
Sprint 158 (2d): LL.1-LL.2      — Build order database + practice mode
Sprint 159 (1d): LL.3-LL.4      — APM trainer + strategy glossary
Sprint 160 (2d): MM.1-MM.2      — Public REST API + streamer overlay SDK
Sprint 161 (1d): MM.3-MM.4      — Replay hosting via Gist + Discord bot
Sprint 162 (2d): NN.1-NN.2      — Seasonal content calendar + unit skin system
Sprint 163 (1d): NN.3-NN.4      — Weekly missions + live balance events
Sprint 164 (2d): OO.1-OO.2      — Resource transfer + shared production buildings
Sprint 165 (1d): OO.3           — Combined army control
Sprint 166 (3d): PP.1           — Neural network training framework + DQN setup
Sprint 167 (2d): PP.2-PP.3      — Behaviour cloning + bundled neural AI
Sprint 168 (2d): QQ.1-QQ.2      — Story bible + unit lore pages
Sprint 169 (2d): QQ.3           — Text cinematics for campaign
Sprint 170 (2d): RR.1           — Scenario editor node graph
Sprint 171 (1d): RR.2-RR.3      — God mode + unit sandbox
Sprint 172 (2d): Balance ext    — Full post-NN balance pass (does ML AI expose imbalance?)
Sprint 173 (2d): 2v2 campaign   — 5 co-op missions designed for two players
Sprint 174 (2d): EE ext         — Procedural scenario generation (random objectives)
Sprint 175 (2d): CC ext         — 10 more AI commanders (25 total) to cover all playstyles
Sprint 176 (1d): GG ext         — Faction-specific musical themes + victory/defeat stingers
Sprint 177 (2d): AA ext         — Commander select screen from main menu (replacing difficulty dropdown)
Sprint 178 (1d): QoL sweep      — Community-reported quality-of-life issues from Season 1
Sprint 179 (2d): VR prep        — Investigate WebXR API for an experimental VR spectator mode
Sprint 180 (1d): v4.0 vision    — Roadmap for the next 2 years, community input session
Sprint 181 (2d): Engine extract — Fully decouple game content from engine, publish `swarm-engine@1.0.0`
Sprint 182 (2d): Demo game      — Build a second demo game using swarm-engine (top-down RPG proof of concept)
Sprint 183 (1d): Engine docs    — Full `swarm-engine` documentation site (TypeDoc + hand-written guides)
Sprint 184 (2d): Grant app      — Apply for Open Source grants (GitHub Sponsors, NLNet, EU Horizon)
Sprint 185 (1d): Academic       — Write a paper: "Deterministic Game Simulation in TypeScript: Patterns for Browser RTS"
Sprint 186 (2d): Conference     — Submit talk proposal to JSConf / GDC / HackConf: "Building SC2 in a Browser"
Sprint 187 (1d): Mentorship     — Open "good first issue" labels, first-time contributor guide
Sprint 188 (2d): Codebase audit — Technical debt cleanup, dead code removal, dependency updates
Sprint 189 (1d): Perf budget    — Establish and enforce: 16ms frame budget, <100ms cold start, <5MB bundle
Sprint 190 (2d): AI paper       — Document the neural AI training process; publish results as a blog series
Sprint 191 (1d): Podcast        — Appear on a TypeScript or game-dev podcast to discuss the project
Sprint 192 (2d): 4v4 mode       — Full 4-player team support (2 per team), Colosseum map
Sprint 193 (2d): FFA mode       — Free For All: 4 players, no teams, last base standing wins
Sprint 194 (1d): Observer tools v2 — Replay timestamp bookmarks, highlight export as GIF
Sprint 195 (2d): Map editor v3  — Collaborative editing: two users edit the same map in real time via CRDTs
Sprint 196 (2d): Mod SDK v2     — TypeScript types for mod API, hot-reload in dev mode
Sprint 197 (1d): i18n complete  — Full translation of all 8 planned languages (add Portuguese, Japanese, Chinese)
Sprint 198 (2d): WASM complete  — Full simulation in WASM; JavaScript only for IO + rendering
Sprint 199 (1d): Final audit    — Security, performance, accessibility, legal — final sign-off
Sprint 200 (1d): v5.0 Release   — The definitive browser RTS. Community-maintained. 
```

---

## The 200-Sprint Complete Picture

```
v0.1  Sprints  1–10:  Polished 2-faction game. AI alive. Good visuals.
v1.0  Sprints 11–55:  3 factions. Multiplayer. Campaign. Map editor. First launch.
v1.5  Sprints 56–104: AI Director. Ranked MMR. Modding. Procedural maps. 15 commanders.
v2.0  Sprints 105–150: Balance system. 3D audio. Native apps. Engine OSS prep.
v3.0  Sprints 121–150: Full Protoss. All units. Esports. Season ladder.
v4.0  Sprints 151–180: Team modes. ML AI. Narrative universe. Live service. Creator tools.
v5.0  Sprints 181–200: Engine published. WASM sim. Conference. Academic paper. Legacy.
```

**200 sprints. ~250 days. ~50 weeks. One year.**
**The most complete RTS ever built as an open-source browser application.**
**From "fix the tech tree UI" to a landmark open-source project used as a reference implementation for browser game development.**

---

---

# Iteration SS — Game Feel & "Juice"

Game feel is the collection of micro-responses that make every action feel satisfying. SC2's game feel is legendary — every click, attack, and death has weight. This iteration is entirely about feel.

## SS.1 — Hit Stop (Frame Freeze on Impact)

When a high-damage hit lands (Yamato Cannon, Siege Tank shell, Baneling explosion), freeze the simulation for 2–4 frames. This is the same technique used in fighting games and makes large hits feel devastating.

**Implementation:**
- `hitStopFrames: number` variable in `Game.ts`
- When `rawDmg > 50` or `atkSplash[eid] >= 2.0`: set `hitStopFrames = 3`
- In `loop()`: while `hitStopFrames > 0`, skip the tick accumulator decrement and decrement `hitStopFrames` instead
- The render still runs (world is frozen, but screen updates) — this is the correct behaviour; the player sees the freeze

## SS.2 — Screen Flash on Massive Damage

When a player unit takes heavy damage (>50% max HP in a single hit), flash the screen edges with a red vignette:

```typescript
// In render(), add an overlay div that briefly shows
const vignette = document.getElementById('damage-vignette');
if (recentHeavyDamage) {
  vignette.style.opacity = '0.6';
  vignette.style.transition = 'opacity 0s';
  setTimeout(() => {
    vignette.style.opacity = '0';
    vignette.style.transition = 'opacity 0.4s';
  }, 50);
}
```

The vignette is a CSS radial gradient from transparent center to `rgba(255,0,0,0.6)` at edges.

## SS.3 — Ability Charge-Up Indicators

Before casting abilities with a wind-up time (Corrosive Bile 2s travel, Yamato 0.5s charge), show a visual charge indicator:

- **Circular charge arc**: a clockwise arc that fills over the cast time, centered on the unit
- **Colour**: ability-specific (Yamato = orange, Bile = green, Fungal = purple)
- **Flare at completion**: brief burst of particles when the ability fires

This gives the player visual feedback about what's about to happen.

## SS.4 — Unit Acknowledgment Animations

Beyond voice lines (Iteration D.1), add micro-animations when units are selected or given orders:

- **Selected**: unit briefly scales to 1.05× then snaps back (50ms)
- **Command received**: unit rotates slightly toward the target direction, then snaps forward (100ms)
- **Stim Pack**: Marine flinches backward 2px then snaps to position (represents the jab)
- **Siege Mode**: Tank rocks back 3px as it deploys (represents the recoil of anchoring)

All implemented in `UnitRenderer` as delta offsets applied for 2-3 frames on state change.

## SS.5 — Projectile Impact Sparks

When a bullet/projectile hits a unit, spawn 4–6 spark particles at the impact point:

- **Terran hit**: white/grey sparks (metal on metal)
- **Zerg hit**: yellow-green slime splash
- **Protoss hit**: blue-white shield energy dissipation

Particle lifetime: 0.25s. Direction: spread ±60° from the projectile travel direction. Size: 2–4px.

## SS.6 — Death Ragdoll

Instead of shrink-and-fade, biological unit deaths use a simplified ragdoll:

- When `deathTime[eid] > 0`: the unit sprite fractures into 3–4 body pieces (rectangles/ellipses representing torso, legs, head)
- Each piece flies outward in a different direction with random velocity
- Each piece fades over 0.4s while decelerating
- Mechanical units: explosion + debris rectangles (already planned in C.7 — ensure velocity-based spread)

---

# Iteration TT — Cross-Platform Profile Sync

## TT.1 — Cloud Save (Supabase Auth)

Allow players to create an account and sync their progress across devices:

- Email/password auth via Supabase Auth (no OAuth required)
- On login: sync from cloud → local (if cloud is newer)
- On game end: sync local → cloud (achievements, rank, settings, replays)
- Profile data: `{ player_id, username, created_at, ...PlayerProfile }`
- Guest mode: all data stays in localStorage (no account required, existing behaviour)

**UI:** "Sign In" link on the start screen (top-right corner). Minimal — just email + password. "Auto-sync enabled" indicator (small cloud icon) when logged in.

## TT.2 — Multi-Device Continuation

A player starts a campaign mission on their desktop, saves mid-mission, continues on their laptop:

- Campaign state is part of the cloud save: `{ missionId, completedObjectives[], unitRoster[], credits }`
- On loading, the game checks cloud save for any in-progress campaign state
- "Resume Campaign" option on the start screen when an in-progress state is found

## TT.3 — Social Profile Page

A public profile page at `/profile/:playerId`:
- Powered by GitHub Pages + Supabase read-only fetch
- Shows: username, total wins/losses, favourite faction (most played), best season rank, last 5 games (faction, opponent commander, outcome, duration)
- Shareable link: players post their profile to Discord
- "Challenge" button: generates a multiplayer room code and sends it to the profile owner

## TT.4 — Settings Sync

Game settings (keybindings, audio levels, display preferences, colourblind mode) sync to the cloud:
- Applied instantly on any new device the player logs into
- Override local settings on first sync (with a confirmation dialog)

---

# Iteration UU — Replay Deep Analysis

## UU.1 — Economy Graph

Post-game overlay (accessible from the game-over screen's "Analyse" button):

A `<canvas>` chart showing:
- **Y axis**: Minerals per minute, Gas per minute, Army value
- **X axis**: Game time
- **Two lines per resource**: Terran (blue) and Zerg (red)
- **Event markers**: vertical lines at wave attacks, unit deaths, building completions
- **Zoom**: scroll to zoom into any time window

Implemented with Chart.js (CDN) or a custom 200-line canvas renderer.

## UU.2 — Army Composition Timeline

A stacked area chart showing army composition over time:

```
          Marines ████████████████████
          Marauders  ████████████
          SiegeTanks      ████████████████
          Medivacs         ██████████
0m ─────────────────────────────────── 10m
```

This visualises how the tech transition looked in hindsight — when did the player switch from bio to mech? When did the Zerg player transition from Zerglings to Roach-Ravager?

## UU.3 — Heat Maps

After a replay, generate spatial heat maps:

- **Combat heat map**: where did most damage events occur? (bright spots = fights)
- **Death heat map**: where did most units die? (reveals dangerous terrain)
- **Movement heat map**: where did the player's army spend most time? (reveals patrolling patterns)

Generated by iterating the replay's command + damage event records, accumulating a 128×128 `Float32Array` grid, then rendering as a colour gradient overlay on the map preview canvas.

## UU.4 — Decision Moments

Automatically identify the 5 "decision moments" in a replay — points where a different choice might have changed the outcome:

**Detection criteria:**
- Army value swing > 30% in a single wave engagement
- A building was destroyed that changed available production
- Player supply-blocked for > 10 seconds (lost production time)
- A wave was defeated with < 20% of player army surviving

Each moment is marked on the timeline. Clicking it jumps the replay to that timestamp and shows a tooltip: "Your army dropped from 840 to 240 here. This was the turning point."

---

# Iteration VV — Community Hub

## VV.1 — In-Game News Ticker

A scrolling ticker at the top of the start screen showing:
- Recent community events ("Season 3 starts in 2 days!")
- Balance changes ("Patch 1.3: Mutalisk -5 HP")
- Featured content ("Map of the week: Desert Storm")
- Player achievements ("NightmareX just beat Brutal in 4:12!")

Data fetched from a GitHub-hosted `news.json` — updated by the developer, cached locally.

## VV.2 — Featured Map/Mod/Build of the Week

A "Community Spotlight" section on the start screen:

- **Map of the week**: highest-rated community map (from mod gallery rating)
- **Build of the week**: a featured build order from the database (LL.1) with commentary
- **Commander of the week**: stats showing which AI commander has the lowest win rate this week (to help players focus practice)

## VV.3 — Community Discord Integration

A live widget on the start screen showing:
- Current active players count (from Supabase `active_sessions` table)
- "Players online now" (anonymous count)
- A "Join Discord" button
- Most recent match result ("DesertFox just won a Hard game in 6:23!")

Updates every 60 seconds via a Supabase realtime subscription.

## VV.4 — Clan System

Simple group system for friends playing together:

- Create a clan: 4-character tag + full name + faction theme
- Members share a clan profile page on the stats site
- Clan leaderboard: total wins + average win time by member
- Clan tag displayed before player name in lobbies: `[SWRM] NightmareX`

---

# Iteration WW — Advanced Visual Effects

## WW.1 — Post-Processing Pipeline

Add a post-processing pass to the PixiJS render using custom GLSL shaders:

**Chromatic Aberration (combat only):**
- Slight RGB channel offset (2–3px) during active combat
- Fades out between waves
- Makes the screen feel "stressed" during intense moments

**Bloom (ability effects):**
- Bright ability effects (Yamato beam, Psionic Storm, Baneling explosion) get a bloom halo
- Implemented via a blur pass on high-luminosity pixels only
- Very subtle — max 0.3× contribution — should be barely noticeable but clearly "there"

**Scanline overlay (retro option):**
- Optional thin horizontal lines at 0.03 opacity
- Toggleable in settings: "CRT scanlines"
- Gives the game a classic RTS aesthetic

## WW.2 — Weather System

Per-map weather effects rendered as a particle layer above everything:

| Map | Weather | Visual | Effect |
|-----|---------|--------|--------|
| Frozen Tundra | Snow | White particles drifting downward | None (cosmetic only) |
| Desert Storm | Dust | Brown haze particles moving horizontally | Already: vision halved during storm |
| Volcano | Ash | Grey particles falling from sky | None (cosmetic only) |
| Crossfire | Rain | Blue streaks falling fast | None |
| Fortress | Fog | Slow-drifting white mist patches | Slightly reduces far-vision for flavour |

Weather particles rendered in a `WeatherRenderer.ts` using a simple particle emitter — 200–500 particles at 3–4px size.

## WW.3 — Dynamic Lighting

Each explosion, ability effect, and muzzle flash casts a brief dynamic light on nearby terrain:

- Rendered as a `RadialGradient` fill on a temporary `RenderTexture` overlay
- Light radius = 3× the explosion radius
- Colour: orange (explosions), cyan (Terran tech), green (Zerg), blue (Protoss)
- Duration: 0.15s, linear falloff

This makes night-time maps feel atmospheric and makes explosions light up the battlefield.

## WW.4 — Unit Shadow System

Every unit casts a soft drop shadow on the terrain below:

- Simple ellipse at `posX + shadow_offset, posY + shadow_height`, `alpha 0.25`
- Air units: shadow offset = `isAir ? 12 : 4` pixels below (suggests altitude)
- Shadow size scales with unit size
- Rendered in a dedicated "shadow pass" before units, after terrain

---

# Iteration XX — AI Coaching System

## XX.1 — Post-Game Coach Report

After every game, an AI coach analyses the replay and generates a structured feedback report:

**Report sections:**

**Economy:**
- "Your worker count peaked at 12 at 4:00. Optimal for Plains is 16. You left ~300 minerals/min on the table."
- "You ran out of gas at 6:30. Consider adding a second Refinery earlier."

**Production:**
- "Your Barracks was idle for 2:40 total (38% idle time). Queue units in advance."
- "You supply-blocked 3 times, losing 42 seconds of production."

**Army Management:**
- "Your army was on the offensive for 4:20 (44% of game). The Zerg army was threatening your mineral line for 1:15 while you were attacking — a defensive unit or Bunker at your base would have prevented 340 HP of worker damage."

**Tech Path:**
- "You built a Factory but never trained a SiegeTank. The Factory investment (150m/100g) was wasted."

## XX.2 — Mistake Detection System

Real-time mistake detection during play (shown as subtle hints, not intrusive popups):

| Mistake | Detection | Hint shown |
|---------|-----------|-----------|
| Supply blocked | `supplyUsed >= supplyProvided - 1` for > 8s | Small "⚠ SUPPLY" flash on HUD |
| Idle Barracks | `prodUnitType[barracks] === 0` for > 15s while enemy advancing | Barracks icon pulses |
| No anti-air with air threat | AI has Mutalisks, player has no Goliath/Viking/Thor | Small "! AIR THREAT" note |
| Oversaturated minerals | `workerCountOnResource > 2` on all patches | "EXPAND?" nudge |
| Workers not gathering | Worker in Idle state for > 20s | Small worker icon flashes |

Each hint shown once per game (doesn't repeat). Very unobtrusive.

## XX.3 — Personalised Training Plan

Based on 5+ games of play, the coach identifies the player's weakest area and recommends a specific training mode:

- Weak economy → "Try the Build Order Practice: 16-worker opener"
- Low APM → "Try the APM Trainer at 90 APM target"
- Losing to early rushes → "Play the Tutorial Mission: Defend the Rush"
- Never uses upgrades → "Try a game where you focus only on Engineering Bay upgrades"

Displayed on the start screen as a "Today's Training" card with one specific recommendation.

---

# Iteration YY — Physics & Destruction Depth

## YY.1 — Structural Physics for Buildings

When a building is destroyed, it doesn't just disappear — it **collapses**:

**Terran building collapse:**
- Building health bar hits 0
- The building sprite fractures into 5–8 rectangular chunks
- Each chunk flies outward with an initial velocity based on the last damage vector
- Chunks decelerate and fade over 1.5s
- A smoke cloud lingers at the death position for 3s

**Zerg building collapse:**
- Organic building "deflates" — the irregular polygon squishes downward over 0.5s
- 8–12 bio-chunks fly outward (ellipses of different sizes)
- Green acid pool remains at the death position (a semi-transparent ellipse that fades over 5s)

## YY.2 — Knockback

High-impact attacks have knockback:

- **Siege Tank shell**: pushes the primary target 2 tiles in the direction of travel
- **Yamato Cannon**: pushes target 4 tiles
- **Baneling explosion**: radial knockback — all units within 1.5 tiles pushed outward proportionally to proximity (closest = farthest pushed)

**Implementation**: `knockbackX/Y: Float32Array` component. Applied in `CombatSystem` after damage. `MovementSystem` applies knockback velocity as a decaying additional velocity term.

**Gameplay impact**: Banelings can push Marines off defensive walls. Yamato can push a Siege Tank out of its optimal fire position.

## YY.3 — Chain Reactions

When a mechanical unit explodes (Siege Tank, Battlecruiser), units within 1.5 tiles of the explosion take 30% of the unit's base HP as collateral damage:

- Terran: nearby SCVs get caught in the Siege Tank explosion
- Zerg: adjacent Banelings detonate in a chain (if they're alive, they're triggered by the nearby explosion)

Chain Baneling detonations are a feature of SC2 that creates spectacular "chain reaction" moments. **Implement as**: in `DeathSystem`, when a mechanical unit dies, check for nearby Banelings — trigger their explosion ability immediately.

---

# Iteration ZZ — The Engine's Open Future

## ZZ.1 — `swarm-engine` npm Package

Extract the following into a standalone publishable npm package:

```
@swarm-engine/core
  ├── ecs/          — World, components, archetypes, queries
  ├── input/        — CommandQueue, InputProcessor, InputManager
  ├── systems/      — Interfaces: ISystem, IRenderer
  ├── utils/        — SeededRng, SpatialHash, FixedTimestep
  └── network/      — LockstepManager, CommandSerializer

@swarm-engine/pixi
  └── PixiRenderer  — Wraps PixiJS with swarm-engine conventions

@swarm-engine/audio
  └── SoundManager  — Procedural Web Audio toolkit
```

Published to npm under MIT licence. Used by the game (`swarm-command`) as a consumer of its own engine. This proves the engine works in real conditions.

## ZZ.2 — Documentation Website

A dedicated documentation site at `swarm-engine.dev` (or `d-ungvari.github.io/swarm-engine`):

- **Getting Started**: 5-minute "Hello World" — spawn a unit that moves
- **Core Concepts**: ECS, fixed timestep, command queue
- **API Reference**: auto-generated from TSDoc comments
- **Guides**: multiplayer lockstep, pathfinding, custom renderers
- **Examples gallery**: 6 minimal demos (each <100 lines) showing specific features
- **Migration guide**: upgrading between engine versions

Built with Vitepress (static site generator, markdown-based).

## ZZ.3 — Second Game (Engine Proof)

Build a second small game using only `@swarm-engine/core` — proving the engine is genuinely reusable:

**"Colony Wars"** — a 3-minute top-down sci-fi shooter:
- Player controls a spaceship directly (WASD)
- Enemies are ECS entities with simple pursue+shoot behaviour
- Uses the ECS, SpatialHash, SeededRng, FixedTimestep from `@swarm-engine/core`
- Rendered with the PixiJS renderer wrapper

If this second game compiles cleanly against the engine package (no hacks, no copy-paste), the engine extraction is validated.

## ZZ.4 — Engine Roadmap Beyond v1.0

After open-sourcing `swarm-engine`, the community can contribute:

**Planned engine modules (community-driven):**
- `@swarm-engine/physics` — rigid body physics (Box2D WASM)
- `@swarm-engine/ai` — behaviour tree toolkit
- `@swarm-engine/networking` — WebRTC + WebSocket transport layer
- `@swarm-engine/tilemap` — Tiled map format loader

**Engine governance:**
- Semver with strict changelog
- RFC process for breaking changes (post GitHub issue, 2-week comment period)
- Core maintainers: 3 (project owner + 2 trusted community contributors)
- Plugin compatibility matrix (which engine version each plugin requires)

---

# Ultra-Extended Sprint Calendar (Sprints 201–250)

```
Sprint 201 (2d): SS.1-SS.3      — Hit stop + screen flash + charge-up indicators
Sprint 202 (2d): SS.4-SS.6      — Unit micro-animations + impact sparks + death ragdoll
Sprint 203 (2d): TT.1-TT.2      — Cloud save (Supabase auth) + multi-device continuation
Sprint 204 (1d): TT.3-TT.4      — Social profile page + settings sync
Sprint 205 (2d): UU.1-UU.2      — Economy graph + army composition timeline
Sprint 206 (2d): UU.3-UU.4      — Heat maps + decision moments detection
Sprint 207 (1d): VV.1-VV.2      — News ticker + community spotlight
Sprint 208 (1d): VV.3-VV.4      — Discord widget + clan system
Sprint 209 (2d): WW.1            — Post-processing pipeline (bloom, chromatic aberration)
Sprint 210 (2d): WW.2-WW.3      — Weather system + dynamic lighting
Sprint 211 (1d): WW.4            — Unit shadow system
Sprint 212 (2d): XX.1-XX.2      — Post-game coach report + mistake detection
Sprint 213 (1d): XX.3            — Personalised training plan
Sprint 214 (2d): YY.1-YY.2      — Building collapse physics + knockback
Sprint 215 (1d): YY.3            — Chain reactions (Baneling cascade)
Sprint 216 (3d): ZZ.1            — swarm-engine npm package extraction
Sprint 217 (2d): ZZ.2            — Documentation website (Vitepress)
Sprint 218 (2d): ZZ.3            — Colony Wars (engine proof game)
Sprint 219 (1d): ZZ.4            — Engine governance + community RFC process
Sprint 220 (2d): NN ext          — 4 more seasonal events (special maps + unit skins)
Sprint 221 (2d): CC ext          — AI commander voice lines for all 15 commanders (full set)
Sprint 222 (2d): II ext          — 3v3 and 4v4 mode + Colosseum map
Sprint 223 (2d): QQ ext          — Lore pages for all buildings + full animated intro cinematic
Sprint 224 (2d): FF ext          — Tutorial for Protoss warp-in + Chrono Boost
Sprint 225 (1d): LL ext          — 20 more build orders (full 3-faction coverage)
Sprint 226 (2d): PP ext          — Neural AI training run 2 (with Protoss faction)
Sprint 227 (1d): BB ext          — Balance patch 2.0 from ML AI telemetry
Sprint 228 (2d): RR ext          — Scenario editor: triggers for multiplayer games
Sprint 229 (1d): OO ext          — Alliance supply sharing in team games
Sprint 230 (2d): EE ext          — Procedural campaign: endless random missions
Sprint 231 (2d): KK ext          — Underground tunnels as map feature (Nydus network paths)
Sprint 232 (2d): JJ ext          — Smart waypoint smoothing (Bezier curve paths, no sharp corners)
Sprint 233 (1d): WW ext          — Full day/night cycle (dark maps at night, vision bonus at dawn)
Sprint 234 (2d): UU ext          — Live replay sharing: watch a friend's game in real time
Sprint 235 (1d): MM ext          — Webhooks API (notify Discord/Slack on game events)
Sprint 236 (2d): VV ext          — Community-curated "best plays" gallery (30-second highlight clips)
Sprint 237 (2d): TT ext          — Cross-platform tournaments (mobile vs desktop bracket)
Sprint 238 (1d): XX ext          — "Coach mode": AI analyses opponent's strategy in real time
Sprint 239 (2d): GG ext          — Full live orchestra recording of swarm-engine music themes
Sprint 240 (1d): HH ext          — App Store submission (Electron Tauri build for iOS via Capacitor)
Sprint 241 (2d): Performance v4  — Comprehensive profiling: <8ms frame time target for 400 units
Sprint 242 (2d): N ext final     — Complete Protoss unit roster (all 17 units fully implemented)
Sprint 243 (2d): M ext final     — Complete Terran unit roster (all 21 units fully implemented)
Sprint 244 (2d): Zerg ext final  — Complete Zerg unit roster (all 19 units fully implemented)
Sprint 245 (2d): Balance v4      — Full 3-faction parity balance pass (57 units total)
Sprint 246 (1d): Lore complete   — 57-unit encyclopedia + 3-faction story arc complete
Sprint 247 (2d): Campaign final  — 3-faction campaign complete (15 missions total, branching)
Sprint 248 (1d): Engine v2.0     — swarm-engine v2.0 with breaking API changes + migration guide
Sprint 249 (1d): v6.0 prep       — Feature freeze, changelog, community vote on v6 roadmap
Sprint 250 (1d): v6.0 Release    — The complete game. The mature engine. The community platform.
```

---

## The 250-Sprint Complete Vision

```
v0.1  Sprints   1–10:  Polish, fix bugs. AI lives. Looks great.
v1.0  Sprints  11–55:  3 factions. Multiplayer. Campaign. Map editor. Launch.
v1.5  Sprints  56–104: Director AI. MMR. Modding. Proc maps. 15 commanders.
v2.0  Sprints 105–150: Balance. 3D audio. Native apps. Engine OSS.
v3.0  Sprints 121–150: Full Protoss. All current units. Season ladder.
v4.0  Sprints 151–180: Team modes. ML AI. Lore. Live service. Creator tools.
v5.0  Sprints 181–200: WASM sim. Conference talks. Engine published.
v6.0  Sprints 201–250: Game feel mastery. Cloud saves. Coach AI. Full unit parity.
                       Complete campaigns. Mature engine ecosystem. Eternal legacy.
```

**250 sprints. ~300 days. ~60 weeks. 15 months.**
**End state:** A complete three-faction real-time strategy game, a published open-source engine, a living community platform, a documented architecture used as a teaching resource, and a codebase that outlives any single developer.

---

---

---

# Iteration PT — Practice Tool Core Modes

This is the **heart** of the product. Without dedicated practice modes, it's just a game. With them, it's a training tool.

## PT.1 — SC2 Stat Accuracy Audit

Before anything else: audit every unit's stats against the SC2 wiki and correct mismatches. The tool is worthless if Marine vs Zergling doesn't feel like SC2.

**Audit checklist per unit:**
- HP (base, not upgraded)
- Shield (Protoss only)
- Ground/Air attack damage and type (Normal/Concussive/Explosive)
- Attack cooldown (in seconds, not ms — convert carefully)
- Movement speed (in SC2 it's in "tiles per second" at 1.0 game speed)
- Range (in tiles)
- Armor (base, not upgraded)
- Sight range

**Known likely mismatches to verify:**
- Marine: 45 HP, 6 damage Normal, 0.8608s cooldown, 5 range, 2.8125 speed
- Zergling: 35 HP, 5 damage Normal, 0.697s cooldown, 0.1 range (melee), 4.1328 speed (pair attacks)
- Mutalisk: 120 HP, 9 dmg Normal (glaive bounce: 9/3/1), 1.7227s cooldown, 3 range, 5.4 speed
- SiegeTank (siege): 160 HP, 35 damage Explosive, 3.0135s cooldown, 13 range

**Files:** `src/data/units.ts` — systematic comparison against SC2wiki.fandom.com values

## PT.2 — Scenario Mode Framework

A scenario is a pre-configured game state with a specific objective. Scenarios are what make this a training tool.

**`src/scenarios/ScenarioLoader.ts`:**
```typescript
interface Scenario {
  id: string;
  title: string;
  description: string;
  category: 'micro' | 'macro' | 'build-order' | 'timing' | 'survival';
  difficulty: 1 | 2 | 3;
  setup: ScenarioSetup;
  objective: ScenarioObjective;
  tips: string[];
  relatedSC2Concept: string;  // e.g. "Marine splitting vs Banelings"
}

interface ScenarioSetup {
  playerFaction: Faction;
  mapType: MapType;
  playerUnits: { type: UnitType, col: number, row: number }[];
  enemyUnits:  { type: UnitType, col: number, row: number }[];
  playerResources?: { minerals: number, gas: number };
  noAI?: boolean;  // static scenario — enemy doesn't build
  disableBuilding?: boolean;
  disableProduction?: boolean;
}

interface ScenarioObjective {
  type: 'kill_all' | 'survive_seconds' | 'build_order' | 'reach_supply' | 'kill_without_losing';
  value?: number;
  label: string;
}
```

**Scenario browser on start screen**: a new "Practice" tab alongside single-player and (future) multiplayer.

## PT.3 — Marine Micro Scenarios (Most Popular SC2 Training)

The most-searched SC2 practice content. These are playable training scenarios, each 1–3 minutes long.

| # | Scenario | Setup | Objective | SC2 Skill |
|---|----------|-------|-----------|-----------|
| 1 | **Marine Split** | 20 Marines vs 8 Banelings (no AI) | Kill all Banelings, lose <4 Marines | Splitting bio vs Banelings |
| 2 | **Stimmed Push** | 16 Marines + 2 Medivacs vs Zerg wall | Push through in < 45s | Stim timing, Medivac micro |
| 3 | **Bunker Hold** | 1 Bunker + 4 Marines vs 30 Zerglings (3 waves) | Survive all 3 waves | Defensive positioning |
| 4 | **Tank Line** | 4 SiegeTanks + 8 Marines vs Roach-Ravager push | Kill all without losing tanks | Siege Tank placement |
| 5 | **Drop Defense** | 12 Marines scattered across map vs 4 Zergling drop pods | Catch all Zerglings before they kill workers | Reaction micro |
| 6 | **Perfect Stim** | 16 Marines vs 16 Marines (mirror) | Win the fight without losing all units | Stim timing vs opponent |

**Difficulty scaling per scenario**: Easy = more units for player / fewer for enemy. Normal = balanced. Hard = fewer for player / more for enemy.

## PT.4 — Build Order Trainer (The "Guitar Hero" of SC2)

A mode where the player follows a specific build order with real-time timing feedback.

**Display:**
- The next 5 actions shown in a vertical queue on the right side of the screen
- Each action has a countdown showing how many seconds ahead/behind optimal timing
- Colour: green if within 5s, yellow if 5–15s behind, red if >15s behind
- Example queue:
  ```
  ✓ 12 SCV
  ✓ 13 Supply Depot
  ► 15 Barracks         [on time]
    17 SCV
    19 Refinery
  ```

**Scoring:**
- Each action within 5s of optimal: +10 points
- Each action within 15s: +5 points
- Score multiplier increases with consecutive perfect timings ("streak")
- Final grade: S/A/B/C/D based on total points vs max possible

**Included build orders (10 to start):**
1. Terran 1-1-1 opener
2. Terran 3-Barracks Marine-Marauder
3. Terran Mech: 1-1 Tank opener
4. Zerg 12-Pool
5. Zerg 3-Hatchery before pool (macro)
6. Zerg Roach-Ravager all-in
7. Protoss 2-Gate aggressive expand
8. Protoss Gateway expand into Colossus
9. Terran 2-base Marine-Medivac push
10. Zerg Lair Mutalisk into macro

Each build order has a ghost worker/building sequence that the player matches.

## PT.5 — Mechanics Trainer (Individual SC2 Skills)

Isolated skill drills, each 30–90 seconds. Inspired by aim trainer modes.

**Inject Practice:** Queen + 3 Hatcheries. Timer counts down from 40s. When a Hatchery loses its inject (shown visually), the player must re-inject it. Score = total larva generated. Ideal = never miss an inject cycle.

**Mule Calldown Practice:** Orbital Command + mineral patches. An APM metronome plays every 90s. Player must MULE calldown at exact beat. Score = minerals gathered vs max possible MULE efficiency.

**Scanner Sweep Timing:** Enemy units appear hidden on map. Orbital Command with energy. Player must Scanner Sweep to reveal them and attack before they reach base. Score = threats detected before damage.

**Marine Split Drill (timed):** A Baneling rolls in. Player has 3 seconds to split 10 Marines into groups. Score = Marines alive after Baneling detonation. Repeat 10 times.

**Chrono Boost Rhythm:** Nexus + 3 buildings in production. The ideal is to Chrono every 20s per building. Player must Chrono boost at the right moments. Score = total production time saved vs max possible.

**Worker Saturation Speed:** Start with a base and 200 minerals. How fast can the player reach 22 workers (optimal saturation for a 2-base Terran)? Measured in seconds. Compare vs community leaderboard.

## PT.6 — Scenario Result Screen

After every scenario ends (win or lose):

- Large grade displayed (S/A/B/C/D)
- Key stats: time taken, units lost, efficiency percentage
- "What you did well" (2–3 bullet points based on performance)
- "What to improve" (1–2 actionable tips)
- "Try again" / "Next scenario" buttons
- Personal best tracking (localStorage)
- Share result: copy a text string to clipboard: "Scored A on Marine Split — Easy! Try it: [URL]"

## PT.7 — Quick Practice Menu on Start Screen

Replace or augment the main "START GAME" button with a more prominent practice entry point:

```
┌────────────────────────────────────────┐
│         SWARM COMMAND                  │
│   SC2 Mechanics Practice Tool          │
│                                        │
│  [  PRACTICE SCENARIOS  ]  ← primary  │
│  [  SKIRMISH VS AI      ]             │
│  [  BUILD ORDER DRILL   ]             │
│                                        │
│  Recent: Marine Split (A)  → replay   │
│  Streak: 3 days ●●●○○                 │
└────────────────────────────────────────┘
```

The scenario browser shows categories (Micro / Macro / Build Order / Timing / Survival) with a grid of scenario cards, each showing difficulty stars, a short description, and personal best.

## PT.8 — Scenario Pack: Iconic SC2 Moments

Famous SC2 community scenarios that every player knows:

| Scenario | Reference |
|----------|-----------|
| "Marine Split" | Standard BM practice |
| "The 4-Gate" | Classic Protoss early aggression |
| "The Zerg Rush" | 6-pool Zergling flood |
| "Ghost Nuke" | Hit a building with a tactical nuke (Ghost EMP + Nuke sequence) |
| "The Blinding Cloud" | Viper vs Terran bio — Blinding Cloud timing |
| "The Baneling Bust" | Zerg wall break vs Terran bunker |
| "Tank Drop" | Drop Siege Tanks in enemy base via Medivac |

Each references real competitive play situations. The practice tool teaches actual SC2 patterns.

---

## PT Sprint Order

| # | Item | Effort | Why |
|---|------|--------|-----|
| PT.1 | SC2 stat accuracy audit | 2h | Foundation — wrong stats = wrong training |
| PT.7 | Quick practice menu (start screen pivot) | 2h | Changes first impression to "practice tool" |
| PT.2 | Scenario mode framework | 3h | Enables all subsequent scenarios |
| PT.3 | Marine micro scenarios (6 scenarios) | 3h | Most popular SC2 practice content |
| PT.4 | Build order trainer | 4h | "Guitar Hero" mode — very engaging |
| PT.5 | Mechanics trainer (6 drills) | 3h | Isolated skill practice |
| PT.6 | Scenario result screen | 2h | Feedback loop makes it a training tool |
| PT.8 | Iconic SC2 moment scenarios | 2h | Marketing hook — recognisable names |

**Total: ~21 hours (~3 days)**
**This is the pivot that turns the game into a product.**

---

## Active Scope

**Tier 0, 1, and 2 are in scope. Tier 3 and 4 are explicitly out of scope for the foreseeable future.**

```
TIER 0 — Fix now (bugs blocking play):
  Sprint 1:  Tech tree UI labels          ← START HERE
  Sprint 4:  AI base defense
  Sprint 7:  Marine redesign

TIER 1 — Core game loop polish (next 2 weeks):
  Sprints 2–10: Selection UI, AI overhaul, visual passes

TIER 2 — Depth features (next 2 months):
  Sprints 11–55: Audio, campaign, multiplayer, map editor, 3rd faction

─────────────────────────────────────────
  TIER 3 and TIER 4: OUT OF SCOPE
  Everything from Sprint 56 onward is
  archived for future reference only.
  Do not plan or implement these.
─────────────────────────────────────────
```

**Working sprints: 1–55 only.**
All planning and implementation work stays within Sprints 1–55 (Iterations A–M and AA) until explicitly re-scoped.
```
