# Iteration Plan 2 — Selection UI & AI Behavior Overhaul

## Audit Summary

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
```
```
