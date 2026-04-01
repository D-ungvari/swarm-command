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
