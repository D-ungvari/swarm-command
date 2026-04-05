---
scope: Unit & Building Visual Overhaul + UI Theme Alignment — Carbot-Inspired Cohesive Visuals
created: 2026-04-05
backlog_items: new (unit visual overhaul), 125 (UI look and feel update)
task_count: 8
status: READY
---

# Ultraplan: Unit & Building Visual Overhaul + UI Theme Alignment

## Vision Alignment

The map terrain was just overhauled to bright, vibrant Carbot-inspired visuals (commit 0e1e73d). Ground is lush green (0x5aa830), water is bright blue (0x2288dd), minerals glow cyan. But units and buildings still use the old dark/muted palette — Terran are dark blue (0x3399ff) on bright green grass, Zerg are dark red (0xcc3333), buildings are navy (0x2266aa). The contrast is jarring. This plan brings units, buildings, portraits, and the UI theme into visual harmony with the new terrain.

The Carbot aesthetic for units: **brighter, rounder, more expressive**. Not photorealistic — bold colors, clear silhouettes, visible eyes/details, personality. Units should pop against the terrain without clashing.

## Visual Design Target

### Unit Color Philosophy

| Element | Current | Target | Why |
|---------|---------|--------|-----|
| Terran primary | `0x3399ff` (medium blue) | `0x55aaff` (brighter sky blue) | Pops on green grass, more Carbot |
| Terran metal | `0x445566` (dark gray) | `0x667788` (lighter steel) | Visible detail on bright ground |
| Terran dark | `0x112244` (navy) | `0x223355` (lighter navy) | Depth without disappearing |
| Terran highlight | `0x6699cc` (muted blue) | `0x88bbee` (brighter highlight) | Visible accent |
| Terran visor | `0x00eeff` (cyan) | `0x22ffff` (brighter cyan) | Eye-catching tech glow |
| Terran warning | `0xff6622` (orange) | `0xff7733` (brighter orange) | Visible on green terrain |
| Zerg primary | `0xcc3333` (dark red) | `0xee4444` (brighter red) | Stands out on green/brown |
| Zerg flesh | `0x882244` (dark purple-red) | `0xaa3355` (brighter flesh) | Biological detail visible |
| Zerg acid | `0x88ff22` (acid green) | `0x99ff44` (brighter acid) | Ability indicator pops |
| Zerg eye | `0xff2200` (red) | `0xff4422` (brighter red-orange) | Carbot-style big expressive eyes |
| Building color | `0x2266aa` (navy) | `0x3377bb` (brighter blue) | Buildings visible on terrain |
| Selection | `0x00ff00` (lime) | `0x00ff00` (unchanged) | SC2 iconic, already bright |

### Building Color Updates

| Building | Current | Target |
|----------|---------|--------|
| SupplyDepot | `0x224488` | `0x3366aa` |
| Refinery | `0x226644` | `0x338855` |
| SpawningPool | `0x882222` | `0xaa3333` |
| Ghost (unit) | `0x4488cc` | `0x55aadd` |
| Hellion | `0xff6600` | `0xff7722` |
| Reaper | `0x88aacc` | `0x99bbdd` |
| Viking | `0x6699bb` | `0x77aacc` |
| WidowMine | `0x443322` | `0x665544` |
| Cyclone | `0x335577` | `0x447788` |
| Thor | `0x445566` | `0x557788` |
| Battlecruiser | `0x334455` | `0x445577` |
| Baneling | `0x44cc44` | `0x55ee55` |
| Mutalisk | `0xaa66dd` | `0xbb77ee` |
| Queen | `0xbb44bb` | `0xcc55cc` |
| Overlord | `0x886622` | `0xaa8833` |
| Ravager | `0xcc4422` | `0xdd5533` |
| Lurker | `0x664422` | `0x886644` |
| Infestor | `0x446622` | `0x558833` |
| Ultralisk | `0x332211` | `0x554433` |
| Corruptor | `0x884488` | `0xaa55aa` |
| Viper | `0x669944` | `0x77bb55` |

### Portrait Color Updates

PortraitRenderer.ts line 5-15 constants:
| Constant | Current | Target |
|----------|---------|--------|
| BG | `#1a1a2a` | `#1a2235` (slightly brighter, bluer) |
| T_BLUE | `#3399ff` | `#55aaff` |
| T_STEEL | `#445566` | `#667788` |
| T_DARK | `#112244` | `#223355` |
| T_VISOR | `#00eeff` | `#22ffff` |
| T_HIGHLIGHT | `#6699cc` | `#88bbee` |
| Z_RED | `#cc3333` | `#ee4444` |
| Z_FLESH | `#882244` | `#aa3355` |
| Z_ACID | `#88ff22` | `#99ff44` |

### UI Theme Color Updates

The existing UI plan (`.sdlc/plans/ui-look-and-feel.md`) references old resource colors. These need updating:
| Token | Old Value | New Value | Reason |
|-------|-----------|-----------|--------|
| mineral | `#44bbff` | `#55ddff` | Matches new MINERAL_COLOR |
| mineralHex | `0x44bbff` | `0x55ddff` | Matches constants.ts |
| gas | `#44ff66` | `#66ff88` | Matches new GAS_COLOR |
| gasHex | `0x44ff66` | `0x66ff88` | Matches constants.ts |
| Terran primary | `#3399ff` | `#55aaff` | Matches unit visual overhaul |
| Terran primaryHex | `0x3399ff` | `0x55aaff` | Matches unit visual overhaul |
| Zerg primary | `#cc4444` | `#ee4444` | Matches unit visual overhaul |
| Zerg primaryHex | `0xcc4444` | `0xee4444` | Matches unit visual overhaul |

---

## Scope Summary
- **Items planned:** 2 (unit/building visual overhaul, UI theme alignment)
- **Tasks generated:** 8
- **Estimated total size:** 3S + 3M + 1L + 1S = ~1800 lines touched
- **Critical path:** Task 1 (colors) → Task 2 (unit data) → Tasks 3-5 (parallel rendering) → Task 6 (portraits) → Task 7 (UI plan) → Task 8 (effects polish)
- **New patterns needed:** None — all extends existing rendering patterns. Colors become brighter, no architectural change.

## Dependency Graph

```
Task 1: Faction Color Constants ──────────────────────┐
                                                       │
Task 2: Unit & Building Data Colors ──────────────────┤
                                                       │
                              ┌────────────────────────┤
                              v                        v
      Task 3: Terran Unit     Task 4: Zerg Unit    Task 5: Building
      Rendering Brighten      Rendering Brighten   Rendering Brighten
                              │
                              v
                    Task 6: Portrait Renderer Color Update
                              │
                              v
                    Task 7: UI Theme Plan Alignment
                              │
                              v
                    Task 8: Effects & Health Bar Polish
```

## Execution Order

| # | Task | Size | Depends on | Summary |
|---|------|------|-----------|---------|
| 1 | Faction Color Constants | S | — | Update TERRAN_COLOR, ZERG_COLOR, palette constants to brighter values |
| 2 | Unit & Building Data Colors | S | 1 | Update color fields in units.ts and buildings.ts |
| 3 | Terran Unit Rendering Brighten | M | 1 | Update hardcoded Terran hex values in UnitRenderer.ts |
| 4 | Zerg Unit Rendering Brighten | M | 1 | Update hardcoded Zerg hex values in UnitRenderer.ts |
| 5 | Building Rendering Brighten | M | 1 | Update hardcoded building hex values in UnitRenderer.ts |
| 6 | Portrait Renderer Color Update | S | 1 | Update CSS color constants in PortraitRenderer.ts |
| 7 | UI Theme Plan Alignment | S | 1 | Update ui-look-and-feel.md plan with corrected color values |
| 8 | Effects & Health Bar Polish | L | 3, 4, 5 | Update attack flash, death halos, selection, waypoint, worker indicator colors |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Color changes affect unit readability at distance | HIGH | Test at max zoom-out — silhouettes and faction identity must remain clear |
| Portrait colors mismatch unit colors | MED | Task 6 explicitly syncs portrait constants to the new faction colors |
| UI plan references become stale | LOW | Task 7 updates the plan file; future /dev sessions will read corrected values |
| PixiJS vs CSS color format mismatch | LOW | Plan specifies both hex (0x) and CSS (#) values for every color |
| Mineral/gas sparkle colors in UnitRenderer | LOW | Already updated in previous commit (Task 5 of map overhaul) — verify, don't redo |

---

## Task Specs

---

### Task 1: Faction Color Constants
**Parent:** Unit Visual Overhaul
**Size:** S
**Depends on:** none
**Unblocks:** Tasks 2-8

#### Goal
Update the centralized faction and building color constants in `constants.ts` to brighter Carbot-inspired values. This is the single source of truth — units.ts and buildings.ts import these.

#### Prerequisites
None — foundational task.

#### Changes (in execution order)

**Step 1: Update faction color constants**
- File: `src/constants.ts` (lines 319-342)
- Change: Update these color values:
  ```typescript
  export const TERRAN_COLOR = 0x55aaff;    // was 0x3399ff — brighter sky blue
  export const ZERG_COLOR = 0xee4444;      // was 0xcc3333 — brighter red
  export const BUILDING_COLOR = 0x3377bb;  // was 0x2266aa — brighter building blue
  export const SELECTION_COLOR = 0x00ff00; // unchanged
  
  export const TERRAN_VISOR     = 0x22ffff;  // was 0x00eeff
  export const TERRAN_METAL     = 0x667788;  // was 0x445566
  export const TERRAN_DARK      = 0x223355;  // was 0x112244
  export const TERRAN_HIGHLIGHT = 0x88bbee;  // was 0x6699cc
  export const TERRAN_WARNING   = 0xff7733;  // was 0xff6622
  export const ZERG_ACID        = 0x99ff44;  // was 0x88ff22
  export const ZERG_EYE         = 0xff4422;  // was 0xff2200
  export const ZERG_FLESH       = 0xaa3355;  // was 0x882244
  export const MINERAL_CRYSTAL  = 0x55ddff;  // was 0x44aaff (sync with MINERAL_COLOR)
  export const GAS_GREEN        = 0x66ff88;  // was 0x44ff88 (sync with GAS_COLOR)
  export const NEUTRAL_STONE    = 0xaaaaaa;  // was 0x888888 — brighter neutral
  ```
- Why: These constants are imported by UnitRenderer, PortraitRenderer, SelectionRenderer, WaypointRenderer, and more. Changing them here brightens all dependents automatically.

#### Edge cases
- TERRAN_COLOR and ZERG_COLOR are used in UnitRenderer for attack flash, health bar faction indicators, waypoint colors — all auto-update.
- units.ts imports TERRAN_COLOR and ZERG_COLOR — all units using these get brighter automatically.
- buildings.ts imports BUILDING_COLOR — most buildings get brighter automatically.

#### NOT in scope
- Changing unit-specific colors in units.ts (that's Task 2)
- Changing hardcoded hex values in UnitRenderer.ts (Tasks 3-5)

#### Acceptance criteria
- [ ] TERRAN_COLOR = 0x55aaff
- [ ] ZERG_COLOR = 0xee4444
- [ ] BUILDING_COLOR = 0x3377bb
- [ ] All palette constants updated to brighter values
- [ ] Type-check passes
- [ ] Existing tests pass

#### Test plan
- `npm run build` succeeds
- `npm test` passes
- Visual: launch game — Terran/Zerg units should already look noticeably brighter

---

### Task 2: Unit & Building Data Colors
**Parent:** Unit Visual Overhaul
**Size:** S
**Depends on:** Task 1
**Unblocks:** Tasks 3-6

#### Goal
Update the per-unit and per-building color overrides in `units.ts` and `buildings.ts` for units that use custom colors (not TERRAN_COLOR/ZERG_COLOR). Most units auto-update from Task 1, but ~15 units and ~3 buildings have unique hardcoded colors.

#### Prerequisites
- Task 1 complete (constants updated)

#### Changes (in execution order)

**Step 1: Update unit custom colors**
- File: `src/data/units.ts`
- Change: Update color fields for units with custom colors (not TERRAN_COLOR/ZERG_COLOR):
  ```
  Ghost:         0x4488cc → 0x55aadd
  Hellion:       0xff6600 → 0xff7722
  Reaper:        0x88aacc → 0x99bbdd
  Viking:        0x6699bb → 0x77aacc
  WidowMine:     0x443322 → 0x665544
  Cyclone:       0x335577 → 0x447788
  Thor:          0x445566 → 0x557788
  Battlecruiser: 0x334455 → 0x445577
  Baneling:      0x44cc44 → 0x55ee55
  Mutalisk:      0xaa66dd → 0xbb77ee
  Queen:         0xbb44bb → 0xcc55cc
  Overlord:      0x886622 → 0xaa8833
  Ravager:       0xcc4422 → 0xdd5533
  Lurker:        0x664422 → 0x886644
  Infestor:      0x446622 → 0x558833
  Ultralisk:     0x332211 → 0x554433
  Corruptor:     0x884488 → 0xaa55aa
  Viper:         0x669944 → 0x77bb55
  ```
- Pattern: Each entry is `color: 0xNNNNNN` in the unit definition object.

**Step 2: Update building custom colors**
- File: `src/data/buildings.ts`
- Change:
  ```
  SupplyDepot:   0x224488 → 0x3366aa
  Refinery:      0x226644 → 0x338855
  SpawningPool:  0x882222 → 0xaa3333
  ```
  (All other buildings use BUILDING_COLOR or ZERG_COLOR which auto-update from Task 1)

#### Edge cases
- `renderTint[eid]` is set from `def.color` during `spawnUnit`/`spawnBuilding` in Game.ts — so changing data auto-propagates to rendering.

#### NOT in scope
- Changing render dimensions (width/height) — Carbot units are bright, not bigger.

#### Acceptance criteria
- [ ] All 18 unit custom colors updated
- [ ] All 3 building custom colors updated
- [ ] Type-check passes
- [ ] Tests pass

#### Test plan
- `npm run build` + `npm test`
- Visual: Ghost should be brighter, Ultralisk less near-black, etc.

---

### Task 3: Terran Unit Rendering Brighten
**Parent:** Unit Visual Overhaul
**Size:** M
**Depends on:** Task 1
**Unblocks:** Task 8

#### Goal
Update all hardcoded Terran hex color values in `UnitRenderer.ts` to brighter equivalents. UnitRenderer has extensive per-unit drawing code with inline hex values for details, accents, shadows, and effects.

#### Prerequisites
- Task 1 complete (TERRAN_COLOR etc. updated)

#### Changes (in execution order)

**Step 1: Search and update Terran drawing sections**
- File: `src/rendering/UnitRenderer.ts` (Terran section: approximately lines 2408-3646)
- Change: For each Terran unit drawing section, find hardcoded hex values and brighten them:
  - Metal accents: `0x445566` → `0x667788` (match TERRAN_METAL)
  - Dark shadows: `0x112244` → `0x223355` (match TERRAN_DARK)
  - Highlight details: `0x6699cc` → `0x88bbee` (match TERRAN_HIGHLIGHT)
  - Visor glow: `0x00eeff` → `0x22ffff` (match TERRAN_VISOR)
  - Orange accents: `0xff6622` → `0xff7733` (match TERRAN_WARNING)
  - Medivac blue: `0x6699cc` → `0x88bbdd`
  - Blue glow effects: `0x4488ff` → `0x55aaff`
  - Building detail: `0x1a3a5a` → `0x2a4a6a`
  - Engine glow: keep cyan (`0x00eeff` → `0x22ffff`)
- Approach: Use find-and-replace for each hex value, reviewing context. NOT blind replace — some values like `0x000000` (black) or `0xffffff` (white) should remain.
- Why: Hundreds of inline hex values make Terran units look dark against bright terrain.

**Step 2: Update power indicator lights on buildings**
- File: `src/rendering/UnitRenderer.ts` (building rendering section)
- Change: Power light glow `0x44aaff` → `0x55bbff` (brighter blue indicator)
- Why: Building power lights should match the brighter palette.

#### Edge cases
- Don't change alpha values — those control transparency, not color brightness.
- Don't change values used in `darken()` calls — the darken function already derives from the tint.
- Preserve the color imported from constants (TERRAN_VISOR etc.) — those already changed in Task 1.

#### NOT in scope
- Zerg unit rendering (Task 4)
- Building-specific colors (Task 5)

#### Acceptance criteria
- [ ] All Terran unit drawing uses brighter hex values
- [ ] No hardcoded `0x112244`, `0x445566`, `0x6699cc` remain in Terran sections
- [ ] SCV, Marine, Marauder, Tank, Medivac, Ghost, Hellion, Reaper, Viking, WidowMine, Cyclone, Thor, BC all visually brighter
- [ ] Type-check passes

#### Test plan
- Visual: All Terran units clearly visible against green terrain
- Visual: Unit silhouettes still distinct at zoom-out

---

### Task 4: Zerg Unit Rendering Brighten
**Parent:** Unit Visual Overhaul
**Size:** M
**Depends on:** Task 1
**Unblocks:** Task 8

#### Goal
Update all hardcoded Zerg hex color values in `UnitRenderer.ts` to brighter equivalents.

#### Prerequisites
- Task 1 complete

#### Changes (in execution order)

**Step 1: Search and update Zerg drawing sections**
- File: `src/rendering/UnitRenderer.ts` (Zerg section: approximately lines 1323-2406)
- Change: For each Zerg unit drawing section:
  - Flesh accents: `0x882244` → `0xaa3355` (match ZERG_FLESH)
  - Acid green: `0x88ff22` → `0x99ff44` (match ZERG_ACID)
  - Eye color: `0xff2200` → `0xff4422` (match ZERG_EYE)
  - Dark organic: `0x332211` → `0x554433`
  - Purple bio: `0xaa66dd` → `0xbb77ee`
  - Queen pink: `0xbb44bb` → `0xcc55cc`, `0xcc44cc` → `0xdd55dd`
  - Overlord brown: `0x886622` → `0xaa8833`
  - Orange bio: `0xff8866` → `0xff9977`
  - Chitinous dark: `0x440066` → `0x660088`
  - Vein purple: `0x6600aa` → `0x8822cc`
  - Bio-membrane: general brighten by +0x111111 to +0x222222
- Why: Zerg units need to pop against the bright green terrain.

**Step 2: Enhance Zerg eye visibility**
- File: `src/rendering/UnitRenderer.ts`
- Change: For Zergling, Hydralisk, Queen, Roach, Viper — increase eye size slightly (radius +0.5-1px) and make eye glow alpha 0.6→0.8. Carbot Zerg have big expressive eyes.
- Why: Eyes give Zerg units personality and are a signature Carbot feature.

#### Edge cases
- Baneling glow (0x44cc44 → 0x55ee55) must stay clearly GREEN to distinguish from other Zerg.
- Ultralisk is currently very dark (0x332211) — brighten to 0x554433 but keep it darker than other Zerg (it's massive and armored).

#### Acceptance criteria
- [ ] All Zerg unit drawing uses brighter hex values
- [ ] Zerg eyes are slightly larger and brighter
- [ ] Zergling, Hydralisk, Roach, Queen, Mutalisk, Overlord all clearly visible on green terrain
- [ ] Faction color identity preserved (Zerg = warm/red/organic, Terran = cool/blue/angular)
- [ ] Type-check passes

#### Test plan
- Visual: Zerg army clearly visible against green/brown terrain
- Visual: Eyes visible on zoom-in

---

### Task 5: Building Rendering Brighten
**Parent:** Unit Visual Overhaul
**Size:** M
**Depends on:** Task 1
**Unblocks:** Task 8

#### Goal
Update all hardcoded building rendering hex values in `UnitRenderer.ts` — both Terran and Zerg buildings.

#### Prerequisites
- Task 1 complete

#### Changes (in execution order)

**Step 1: Brighten Terran building rendering**
- File: `src/rendering/UnitRenderer.ts` (Terran building section: ~lines 675-1111)
- Change: Update building-specific hardcoded colors:
  - Building borders: darker variants → brighter by ~+0x111111
  - CommandCenter octagon: stroke/fill brighter
  - SupplyDepot bevel: brighter highlight edges
  - Barracks L-shape: brighter extension color
  - Refinery turbines: brighter arm color
  - Factory smokestack: `darken(tint, 30)` → `darken(tint, 20)` (less dark)
  - Starport wings: brighter angle fills
  - MissileTurret barrel: brighter metal
  - Engineering Bay details: brighter tool icons
  - Construction frame lines: `0x112244` → `0x223355`
  - Power indicator: `0x44aaff` → `0x55bbff`

**Step 2: Brighten Zerg building rendering**
- File: `src/rendering/UnitRenderer.ts` (Zerg building section: ~lines 289-674)
- Change:
  - Hatchery core: `0xff2200` → `0xff4422`
  - Hatchery veins: brighter purple/red
  - SpawningPool glow: brighter bio-green
  - EvolutionChamber helix: brighter mutation glow
  - All organic membranes: +10-20% brightness
  - Spire organic growths: brighter
  - InfestationPit neural nodes: brighter purple

**Step 3: Brighten fire/damage effects on buildings**
- File: `src/rendering/UnitRenderer.ts`
- Change: Critical HP fire effect colors:
  - `0xff4400` → `0xff6622` (brighter flame)
  - `0xffaa00` → `0xffbb22` (brighter yellow)
  - Keep alpha values unchanged

#### Edge cases
- Construction animation (progress bar) should keep yellow `0xffaa22` → `0xffbb33`
- Rally point color should match faction (already uses TERRAN_COLOR/ZERG_COLOR → auto-update)

#### Acceptance criteria
- [ ] All Terran buildings brighter and visible on green terrain
- [ ] All Zerg buildings brighter with visible organic detail
- [ ] Fire effects visible on damaged buildings
- [ ] Construction progress bar visible
- [ ] Type-check passes

#### Test plan
- Visual: Build all Terran buildings — verify each is clearly visible
- Visual: Build Zerg Hatchery + buildings — verify organic details show

---

### Task 6: Portrait Renderer Color Update
**Parent:** Unit Visual Overhaul
**Size:** S
**Depends on:** Task 1
**Unblocks:** Task 7

#### Goal
Update the CSS color constants in `PortraitRenderer.ts` to match the new faction colors. Portraits must match unit rendering colors for visual consistency.

#### Prerequisites
- Task 1 complete

#### Changes (in execution order)

**Step 1: Update portrait color constants**
- File: `src/rendering/PortraitRenderer.ts` (lines 4-15)
- Change:
  ```typescript
  const BG = '#1a2235';       // was '#1a1a2a' — slightly brighter, bluer
  const T_BLUE = '#55aaff';   // was '#3399ff'
  const T_STEEL = '#667788';  // was '#445566'
  const T_DARK = '#223355';   // was '#112244'
  const T_VISOR = '#22ffff';  // was '#00eeff'
  const T_HIGHLIGHT = '#88bbee'; // was '#6699cc'
  const Z_RED = '#ee4444';    // was '#cc3333'
  const Z_FLESH = '#aa3355';  // was '#882244'
  const Z_ACID = '#99ff44';   // was '#88ff22'
  ```
- Why: Portrait colors must sync with unit colors for info panel consistency.

**Step 2: Clear the portrait cache**
- File: `src/rendering/PortraitRenderer.ts`
- Change: Verify the cache clears on construction or add a `clearCache()` method if needed. Since portraits are generated on first access, changed constants will automatically produce new portraits.
- Why: Stale cached portraits would show old colors.

#### Edge cases
- Portraits are Canvas 2D, not PixiJS — CSS hex strings (#RRGGBB), not 0xRRGGBB.
- Portrait border uses faction color — auto-updates from T_BLUE/Z_RED change.

#### Acceptance criteria
- [ ] All 9 portrait color constants updated
- [ ] Portraits match brighter unit rendering
- [ ] Info panel portraits look correct for both factions
- [ ] Type-check passes

#### Test plan
- Visual: Select a Marine — info panel portrait should be brighter blue
- Visual: Select a Zergling — info panel portrait should be brighter red

---

### Task 7: UI Theme Plan Alignment
**Parent:** UI Look and Feel (#125)
**Size:** S
**Depends on:** Task 1
**Unblocks:** none (plan update only)

#### Goal
Update the existing `ui-look-and-feel.md` plan file with corrected color values that match the new visual overhaul. This ensures when `/dev` executes the UI plan, it uses the right colors.

#### Prerequisites
- Task 1 complete (new color values established)

#### Changes (in execution order)

**Step 1: Update common colors section**
- File: `.sdlc/plans/ui-look-and-feel.md`
- Change: In the "Common Colors" table (around line 175-190):
  ```
  mineral:    '#44bbff' → '#55ddff'
  mineralHex: 0x44bbff  → 0x55ddff
  gas:        '#44ff66' → '#66ff88'
  gasHex:     0x44ff66  → 0x66ff88
  ```

**Step 2: Update faction palette values**
- File: `.sdlc/plans/ui-look-and-feel.md`
- Change: In the Terran palette table:
  ```
  primary:    '#3399ff' → '#55aaff'
  primaryHex: 0x3399ff  → 0x55aaff
  ```
  In the Zerg palette table:
  ```
  primary:    '#cc4444' → '#ee4444'
  primaryHex: 0xcc4444  → 0xee4444
  ```

**Step 3: Update resource icon design**
- File: `.sdlc/plans/ui-look-and-feel.md`
- Change: In the Resource Icon Design section:
  ```
  Mineral: background '#44bbff' → '#55ddff'
  Gas:     background '#44ff66' → '#66ff88'
  ```

**Step 4: Update theme.ts code block**
- File: `.sdlc/plans/ui-look-and-feel.md`
- Change: In the Task 1 spec's `theme.ts` code block, update the TERRAN_PALETTE, ZERG_PALETTE, and colors objects with the new values.

**Step 5: Update minimap frame spec**
- File: `.sdlc/plans/ui-look-and-feel.md`
- Change: In the Minimap Frame section, update `FACTION_PRIMARY_HEX` to note it now uses the brighter values.

#### Edge cases
- CSS border colors (`rgba(80, 140, 220, ...)`) are independent of the primaryHex value — these are hand-tuned for the dark panel aesthetic and should NOT change just because the faction primary changed. The border colors are designed for contrast against dark panels.

#### NOT in scope
- Actually implementing the UI theme (that's its own backlog item)
- Changing HUD/info panel code (that's the UI plan execution)

#### Acceptance criteria
- [ ] All color references in ui-look-and-feel.md match new palette
- [ ] Theme code block uses 0x55aaff for Terran, 0xee4444 for Zerg
- [ ] Resource colors use new mineral/gas values
- [ ] Plan file is self-consistent

#### Test plan
- Read through the plan file — all hex values should match constants.ts

---

### Task 8: Effects & Health Bar Polish
**Parent:** Unit Visual Overhaul
**Size:** L
**Depends on:** Tasks 3, 4, 5
**Unblocks:** none

#### Goal
Update universal rendering effects — attack flash, death animations, selection highlights, waypoint colors, worker carry indicators, stim/slow effects, ability landing zones — to match the brighter palette.

#### Prerequisites
- Tasks 3-5 complete (unit rendering sections already brighter)

#### Changes (in execution order)

**Step 1: Update attack flash colors**
- File: `src/rendering/UnitRenderer.ts` (attack flash section, ~lines 3730-3760)
- Change:
  - Terran weapon glow line: `0x4488ff` → `0x55aaff`
  - Hit spark base: keep white `0xffffff` (already bright)
  - Muzzle flash: scale with faction primary (auto from constants)

**Step 2: Update death animation halos**
- File: `src/rendering/UnitRenderer.ts` (death section, ~lines 3858-3899)
- Change:
  - Terran halo: `0xff8844` → `0xffaa66` (brighter orange)
  - Zerg halo: `0x88ff22` → `0x99ff44` (brighter green, matches ZERG_ACID)

**Step 3: Update stim/slow visual effects**
- File: `src/rendering/UnitRenderer.ts`
- Change:
  - Stim body tint: `0x66ddff` → `0x77eeff` (brighter)
  - Stim ring: `0xff8800` → `0xffaa22`
  - Slow fill: keep blue `0x88ccff` (already visible)
  - Slow sparkle: `0xffffff` (keep white)

**Step 4: Update cloaked unit visual**
- File: `src/rendering/UnitRenderer.ts`
- Change:
  - Shimmer ring: keep existing alpha behavior
  - Dark overlay: `0x000033` → `0x000044` (slightly brighter dark blue, less black)

**Step 5: Update worker carrying indicator**
- File: `src/rendering/UnitRenderer.ts`
- Change:
  - Mineral carry glow: `0x44bbff` → `0x55ddff` (matches new MINERAL_COLOR)
  - Gas carry glow: `0x44ff66` → `0x66ff88` (matches new GAS_COLOR)

**Step 6: Update WaypointRenderer colors**
- File: `src/rendering/WaypointRenderer.ts`
- Change:
  - Terran move line: `0x44aaff` → `0x55bbff`
  - Zerg move line: `0x44ff88` → `0x55ffaa`
  - Attack move line: `0xff4444` → `0xff5555`
  - Waypoint marker Terran: `0x66ccff` → `0x77ddff`
  - Waypoint marker Zerg: `0x66ffaa` → `0x77ffbb`

**Step 7: Update ability landing zone colors**
- File: `src/rendering/UnitRenderer.ts` (ability zones section)
- Change:
  - Corrosive Bile: `0xff4444` → `0xff5555`
  - Fungal Growth: `0x44ff88` → `0x55ffaa`
  - Blinding Cloud: `0x6622aa` → `0x8844cc`
  - Parasitic Bomb: `0xff4422` → `0xff5533`

#### Edge cases
- SelectionRenderer.ts: Uses SELECTION_COLOR from constants (green, unchanged) — verify it still looks good on bright terrain.
- HP bar colors (green/orange/red gradient) are already bright — no change needed.
- Veterancy star colors (gold/cyan/blue) — already bright, no change.

#### NOT in scope
- Changing animation timing or sizes
- Adding new visual effects

#### Acceptance criteria
- [ ] All effect colors match the new brighter palette
- [ ] Attack flashes visible on bright terrain
- [ ] Death halos visible
- [ ] Worker carry indicators match resource colors
- [ ] Waypoint lines visible against green terrain
- [ ] Ability zones clearly visible
- [ ] Type-check passes
- [ ] Tests pass

#### Test plan
- Visual: Attack with Marines — muzzle flash bright and visible
- Visual: Kill a unit — death halo visible against green terrain
- Visual: Stim a Marine — teal glow clearly visible
- Visual: Right-click move — waypoint line visible on green terrain
- `npm test` passes

---

## Cross-Cutting Concerns

### Color Value Format
- `constants.ts`: `0xRRGGBB` (PixiJS number format)
- `PortraitRenderer.ts`: `'#RRGGBB'` (CSS string format)
- `ui-look-and-feel.md`: Both formats specified for each color
- `UnitRenderer.ts`: `0xRRGGBB` inline (PixiJS)
- `WaypointRenderer.ts`: `0xRRGGBB` inline (PixiJS)

### Brightness Strategy
The general approach is **+0x111111 to +0x222222** per color channel:
- Dark values (0x11, 0x22, 0x33): add +0x11 (one step brighter)
- Medium values (0x44-0x88): add +0x11 to +0x22
- Already bright values (0xaa+): add +0x11 or leave unchanged
- Pure/maximum values (0xff): leave at 0xff

This preserves relative color relationships while lifting the entire palette to match the vibrant terrain.

### Files Modified Summary
| File | Tasks | Scope |
|------|-------|-------|
| `src/constants.ts` | 1 | 14 color constant updates |
| `src/data/units.ts` | 2 | 18 unit color updates |
| `src/data/buildings.ts` | 2 | 3 building color updates |
| `src/rendering/UnitRenderer.ts` | 3, 4, 5, 8 | ~200 inline hex value updates (largest task) |
| `src/rendering/PortraitRenderer.ts` | 6 | 9 CSS color constant updates |
| `src/rendering/WaypointRenderer.ts` | 8 | 6 color updates |
| `.sdlc/plans/ui-look-and-feel.md` | 7 | Plan text color corrections |

---

## Architecture Model (snapshot)

### Rendering Data Flow
```
constants.ts (TERRAN_COLOR, ZERG_COLOR, etc.)
  → units.ts / buildings.ts (unit.color = TERRAN_COLOR or custom hex)
  → Game.ts spawnUnit() (renderTint[eid] = def.color)
  → UnitRenderer.render() (reads renderTint[eid] as `tint`, uses inline hex for details)
  → PortraitRenderer (CSS color constants, independent)
  → WaypointRenderer (inline hex, faction-dependent)
```

### Key Pattern
UnitRenderer reads `renderTint[eid]` as the base unit color, then draws details using **hardcoded inline hex values** for metallic accents, shadows, highlights, eyes, and effects. The base tint changes automatically from constants/data updates, but detail colors require manual update in the drawing code.

### Performance Note
No performance impact. All changes are color value swaps — same Graphics API calls, same number of draw operations. No new Sprites or textures.
