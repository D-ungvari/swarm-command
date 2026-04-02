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
```
