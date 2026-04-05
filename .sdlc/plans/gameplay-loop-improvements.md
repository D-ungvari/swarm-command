---
scope: Gameplay Loop Improvements — Holistic Review & Strategic Plan
created: 2026-04-05
updated: 2026-04-05
backlog_items: 94, 102, 103-118, 119-130
task_count: 21 new tasks (11 features + 10 bug fixes) + 23 existing (referenced)
status: READY
---

# Ultraplan: Gameplay Loop Improvements

## Vision Alignment

Swarm Command promises "practice SC2 mechanics in your browser." The gameplay loop IS the product — gather → build → produce → scout → fight → expand. Right now the loop is structurally present but strategically hollow: every unit is available from the start, the AI poses no timing pressure, combat has mechanical inaccuracies that undermine muscle memory, and macro management lacks the SC2 UX tools players rely on. This plan identifies every gap in the loop, cross-references with existing plans, and adds the missing macro/UX improvements that tie it all together.

## Current Gameplay Loop Assessment

### What Works Well
- **Core ECS engine**: 60Hz fixed timestep, cache-friendly SoA, spatial hash — performance is solid
- **Unit variety**: 28 units, 25+ abilities, faction rendering differentiation (rect vs ellipse)
- **Resource gathering**: Worker state machine, saturation penalty, mineral spreading
- **Combat fundamentals**: Target acquisition with priority scoring, splash damage 3-zone model, overkill prevention
- **Control groups**: Full 0-9 system with assign/recall/add/steal, subgroup cycling
- **Maps**: 10 variants with SC2 LOTV design (3-tier expansions, ramps, destructible rocks)
- **Production system**: Fair-play AI using same queues as player, larva/inject system

### What Breaks the Loop (by player experience minute)

**0:00-2:00 — Opening (should be: economy decisions, scouting)**
- No scouting pressure — AI doesn't rush reliably (AI overhaul addresses this)
- No tech decisions — flat tech tree, everything available immediately
- Spacebar jumps to hardcoded base (15,15) instead of last alert location
- F1 idle worker select exists as a function but has no key binding

**2:00-5:00 — Early/Mid Game (should be: tech choices, harassment, expansion timing)**
- All units buildable without research (Stim, Siege Tech, etc. all free)
- No TechLab/Reactor decisions on production buildings
- AI sends trickle of random composition units
- No detection system — cloaked units have zero counter AND zero threat
- No Lair/Hive progression — all Zerg tech available immediately

**5:00-10:00 — Mid/Late Game (should be: army trades, multitasking, map control)**
- Combat inaccuracies: Siege Tank fires 2.5× too fast, no minimum range
- No Medivac transport drops — core Terran mechanic missing
- No morph mechanics — Banelings produced from Hatchery, not morphed from Zerglings
- No elevation combat penalty — high ground positioning doesn't matter
- No shift-queue for abilities — only movement queuing works
- No multi-building production select — can't Tab through all Barracks

**Macro Management (continuous)**
- `selectIdleWorkers()` exists but not bound to F1 (no key binding at all)
- Supply block only shows red text — no alert flash or audio
- No shift+click on production buttons to queue multiple units
- No camera save/recall hotkeys (F5-F8)
- No "last attack" camera jump — Spacebar is hardcoded to base

- Rally points only issue `CommandMode.Move` — no auto-gather on mineral rally, no attack-move rally
- No production idle alert — buildings with empty queues give zero feedback
- No auto-gather when new base (CC/Hatchery) finishes construction
- Watchtowers are terrain-only — no vision-granting mechanic despite being on every map
- No screen-edge directional indicator for off-screen attacks

---

## Target Player Experience (After All Improvements)

### 0:00-1:00 — Opening
Player spawns with CC, 6 SCVs, 50 minerals. SCVs auto-gather (already works). Player queues SCVs, builds Supply Depot. **F1** reveals no idle workers (good). Rally point set to mineral patch → new SCVs **auto-gather on arrival** (N7). AI is executing a real build order (AI T1) — early Spawning Pool or Hatchery expand depending on profile. Player scouts with an SCV to see what the AI is doing (scouting matters because tech tree exists).

### 1:00-3:00 — Early Game Decisions
Player must choose: fast expand or early pressure? Tech Lab on Barracks for Marauders, or Reactor for double Marines? (Audit T4). Supply Depot built → Barracks can start (tech gate). The AI's **time-gated building schedule** (AI T6) means Spawning Pool comes early, potential Zergling rush. If rushed, **Spacebar jumps to last attack location** (N2). Player splits Marines (combat is accurate — Siege Tank fires at correct 2.14s in siege, Audit T1). Player **saves camera location on natural** with Ctrl+F5, base with Ctrl+F6 (N1).

### 3:00-5:00 — Mid Game / Tech Choices
Player builds Factory (requires Barracks, Audit T3). Decides: Armory for Thors? Ghost Academy for cloaked Ghosts? These require **tech gate buildings** (Audit T3). Meanwhile, AI is massing a coherent army composition (AI T3) — all Roaches, not random mix. Player researches **Stim Pack at Barracks TechLab** (Audit T7) — Stim doesn't work until research completes (timing window). **Ctrl+click Barracks** selects all 3, **Tab** cycles through to check queues (N3). **Shift+click Marine** queues 5 at once (N4). Supply blocked? **"SUPPLY BLOCKED" flash** on HUD (N4).

### 5:00-8:00 — Mid-Late Transition
AI launches its first real attack wave — 12+ Roaches with Ravagers (AI T4). **Spacebar** → camera jumps to attack location (N2). Player engages: Siege Tanks have **minimum range** (Audit T1) so positioning matters. **Elevation penalty** means attacking uphill = 30% miss chance (Audit T9). Medivacs **load Marines, boost to enemy mineral line** for a drop (Audit T11). Ghost cloaks → AI has **Spore Crawlers that detect** (Audit T8) near its base. Player needs Scanner Sweep. **Watchtower at map center grants extra vision** (N9) — controlling it reveals army movements.

### 8:00-12:00 — Late Game
Player expanding to third base. New CC finishes → **nearby idle workers auto-gather** (N8). Player checks saturation: **"Workers: 16/16"** display on CC (N6). Time to transfer excess workers. AI upgrades to **Lair, builds Hydralisk Den** (Audit T5) — tech progression creates timing pressure. Player **shift-queues** attack-move → patrol route for army (N5). **Idle production buildings pulse subtly** (N10) reminding player to spend resources. Zerglings **morph into Banelings** (Audit T10) — player must split Marines.

### Victory/Defeat
All systems combine: tech decisions, scouting reactions, macro management with proper UX tools, accurate combat mechanics, and a challenging AI opponent that executes real build orders. The game FEELS like SC2 warmup.

---

## Existing Plan Cross-Reference

### `.sdlc/plans/sc2-skirmish-audit.md` — 16 Tasks
Covers: stat fixes, tech tree (Extractor, gate buildings, TechLab, Lair/Hive, Zerg tech buildings), unit research, detection, elevation, morphs, transport, missing units, polish.
**Status:** READY. Backlog items #103-118.

### `.sdlc/plans/enemy-ai-overhaul.md` — 7 Tasks
Covers: build order engine, production fix, army composition, attack intelligence, queen management, building schedule, difficulty scaling.
**Status:** READY. Backlog item #94.

### `.sdlc/plans/unit-commanding-sophistication.md`
Covers: unit pathfinding improvements, auto-attack on arrival, idle reset.
**Status:** COMPLETED (commit 11a1151).

### What's NOT Covered by Existing Plans
1. **Macro hotkeys** — F1 idle worker, Spacebar last-alert, camera save/recall
2. **Multi-building production select** — Select all of building type, Tab between
3. **Production QoL** — Shift+click queue, supply block warning
4. **Shift-queue abilities** — Backlog #102 exists but has no detailed task spec
5. **Worker-per-base display** — Saturation visualization per expansion
6. **Game phase pacing indicators** — No sense of timing progression
7. **Smart rally points** — Rally to mineral = auto-gather, rally to enemy = attack-move
8. **Auto-gather on base complete** — Nearby idle workers start mining when CC/Hatchery finishes
9. **Watchtower vision mechanic** — Towers exist on every map but grant zero functional benefit
10. **Production idle indicator** — No feedback when buildings have empty queues
11. **Screen-edge attack indicators** — No directional arrows for off-screen attacks

---

## Scope Summary

- **Items planned:** 21 new tasks (11 features + 10 bug fixes from playtesting) + 23 existing tasks (referenced from 2 plans)
- **New tasks generated:** 21
- **Estimated new task size:** 15S + 5M + 1M = ~16S + 5M total
- **Critical path (new):** Phase 0 bug fixes should ship first (all independent, can parallelize), then feature tasks in any order
- **Critical path (full loop):** Phase 0 (bug fixes) → Audit T1-T7 → AI T1-T4 → New feature tasks (parallel)
- **New patterns needed:** Camera location storage, last-alert tracking, building-type multi-select, smart rally context detection, watchtower entity type, production idle tracking, post-game stat counters

## Dependency Graph

```
EXISTING (sc2-skirmish-audit):
T1: Stat Fixes ←── no deps
T2: Zerg Extractor ←── no deps
T3: Tech Gate Buildings ←── no deps
T4: TechLab/Reactor ←── T3
T5: Lair/Hive ←── no deps
T6: Zerg Tech Buildings ←── T5
T7: Unit Research ←── T4, T6
T8: Detection ←── no deps
T9: Elevation Combat ←── no deps
T10: Morphs ←── T6
T11: Medivac Transport ←── no deps
T12: BC Jump, Reaper Cliff ←── no deps
T13: Vehicle Armor ←── T3
T14: Missing Terran Units ←── T3, T4, T8
T15: Missing Zerg Units ←── T5, T6, T8
T16: Polish Pass ←── no deps

EXISTING (enemy-ai-overhaul):
AI-T1: Build Order Engine ←── no deps
AI-T2: Production Fix ←── AI-T1
AI-T3: Army Composition ←── AI-T2
AI-T4: Attack Intelligence ←── AI-T3
AI-T5: Queen Management ←── AI-T2
AI-T6: Building Schedule ←── AI-T1
AI-T7: Difficulty Scaling ←── AI-T4

NEW (this plan):
N1: Macro Hotkeys ←── no deps
N2: Last-Alert Camera System ←── no deps
N3: Multi-Building Select + Tab ←── no deps
N4: Production QoL ←── no deps
N5: Shift-Queue Abilities ←── no deps
N6: Worker Saturation Display ←── no deps
N7: Smart Rally Points ←── no deps
N8: Auto-Gather on Base Complete ←── no deps
N9: Watchtower Vision Mechanic ←── no deps
N10: Production Idle Indicator ←── no deps
N11: Screen-Edge Attack Indicators ←── no deps
```

## Execution Order (Recommended — Full Loop Improvement)

**Phase 0: Critical Bug Fixes** (from playtesting — blocks core loops)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 0a | Workers stuck in minerals / mined nodes | S | BF1 | HIGH — economy broken |
| 0b | Gas mining persistence (SCVs wander off) | S | BF3 | HIGH — economy broken |
| 0c | Any SCV continue another's build | S | BF2 | HIGH — building flow |
| 0d | Eng Bay / Evo Chamber upgrades not clickable | S | BF4 | HIGH — upgrade path blocked |
| 0e | Win condition doesn't trigger | S | BF5 | HIGH — game never ends |
| 0f | Control groups broken | S | BF7 | HIGH — micro broken |
| 0g | Zerglings don't attack Terran structures | S | BF8 | HIGH — Zerg combat broken |
| 0h | Gas extractor misalignment | S | BF6 | MED — visual |
| 0i | Double-click select all of same type | S | BF9 | MED — selection UX |
| 0j | Post-game statistics recap | M | BF10 | MED — completeness |

**Phase 1: Combat Foundation** (make existing combat feel right)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 1 | Stat & Behavior Fixes | S | Audit T1 | HIGH — every fight is wrong |
| 2 | Elevation Combat Penalty | S | Audit T9 | MED — positioning matters |

**Phase 2: Tech Tree** (make strategic decisions exist)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 3 | Zerg Extractor | S | Audit T2 | HIGH — unblocks Zerg gas |
| 4 | Tech Gate Buildings | M | Audit T3 | HIGH — gates Thor/Ghost/BC |
| 5 | Lair/Hive Progression | M | Audit T5 | HIGH — Zerg tech timing |
| 6 | TechLab/Reactor | M | Audit T4 | HIGH — production decisions |
| 7 | Zerg Tech Buildings | M | Audit T6 | MED — gates morphs/ultras |
| 8 | Unit Research System | M | Audit T7 | MED — Stim timing windows |

**Phase 3: AI Overhaul** (make the opponent challenging)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 9 | Build Order Engine | M | AI T1 | HIGH — real AI behavior |
| 10 | Production Fix | M | AI T2 | HIGH — AI masses units |
| 11 | Army Composition | M | AI T3 | MED — coherent armies |
| 12 | Attack Intelligence | M | AI T4 | HIGH — meaningful pressure |
| 13 | Queen Management | S | AI T5 | MED — inject cycle |
| 14 | Building Schedule | S | AI T6 | MED — tech timing |
| 15 | Difficulty Scaling | S | AI T7 | MED — replayability |

**Phase 4: Core Missing Mechanics** (complete the loop)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 16 | Detection System | M | Audit T8 | HIGH — counter cloaked |
| 17 | Morph Mechanics | M | Audit T10 | MED — Zerg identity |
| 18 | Medivac Transport | L | Audit T11 | HIGH — Terran drops |

**Phase 5a: Macro Management UX** (SC2 muscle memory — NEW tasks)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 19 | Macro Hotkeys (F1, camera locs) | S | NEW — N1 | HIGH — muscle memory |
| 20 | Last-Alert Camera System | S | NEW — N2 | HIGH — situational awareness |
| 21 | Multi-Building Select + Tab | M | NEW — N3 | MED — macro speed |
| 22 | Production QoL | S | NEW — N4 | MED — reduce friction |
| 23 | Shift-Queue Abilities | M | NEW — N5 | MED — command fluency |
| 24 | Worker Saturation Display | S | NEW — N6 | LOW — information |

**Phase 5b: Gameplay Systems Polish** (NEW tasks — fix structural loop gaps)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 25 | Smart Rally Points | M | NEW — N7 | HIGH — core macro mechanic |
| 26 | Auto-Gather on Base Complete | S | NEW — N8 | MED — expansion flow |
| 27 | Watchtower Vision Mechanic | M | NEW — N9 | MED — map control incentive |
| 28 | Production Idle Indicator | S | NEW — N10 | MED — economy awareness |
| 29 | Screen-Edge Attack Indicators | S | NEW — N11 | LOW — situational awareness |

**Phase 6: Roster & Polish** (completeness)
| # | Task | Size | Source | Impact |
|---|------|------|--------|--------|
| 30 | BC Jump, Reaper Cliff | M | Audit T12 | MED |
| 31 | Vehicle Armor | S | Audit T13 | MED |
| 32 | Missing Terran Units | L | Audit T14 | MED |
| 33 | Missing Zerg Units | L | Audit T15 | MED |
| 34 | Polish Pass | S | Audit T16 | LOW |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tech tree changes break AI build orders | HIGH | Phase 3 (AI overhaul) should run after Phase 2, or AI must be updated in each tech tree task |
| Multi-building select conflicts with existing Tab subgroup cycling | MED | Tab behavior switches based on selection type (units vs buildings) |
| Last-alert camera conflicts with Spacebar base-jump muscle memory | MED | Use Spacebar for last alert (SC2 standard), add Home key for base jump |
| Shift-queue abilities may interact with shift+number (add to control group) | LOW | Abilities consume shift context before control group check |
| Phase 5 tasks are all independent — risk of inconsistent UX patterns | LOW | Group N1+N2 together for consistent camera/hotkey pass |
| Smart rally auto-gather changes worker flow expectations | MED | Only auto-gather when rally target IS a mineral/gas entity, not just nearby |
| Watchtower vision may reveal too much, reducing fog-of-war strategy | MED | Use 12-tile radius (same as Scanner Sweep) — enough to see armies, not bases |
| Production idle indicator may be annoying if always pulsing | LOW | Only show after 5s idle + player has 200+ unspent minerals |
| Screen-edge indicators may clash with edge-scrolling input zone | LOW | Render indicators 30px inward from edge (edge-scroll zone is 20px) |

---

## Task Specs (NEW — Not Covered by Existing Plans)

---

### Task N1: Macro Hotkeys — F1 Idle Worker + Camera Location Save/Recall
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Bind the existing `selectIdleWorkers()` function to F1 (SC2 standard) and add camera location save/recall hotkeys (Ctrl+F5-F8 to save, F5-F8 to recall). These are core SC2 macro hotkeys that every player uses.

#### Prerequisites
- `Game.selectIdleWorkers()` already exists at `src/Game.ts:1543-1562` — selects idle workers and centers camera
- F1 key currently triggers the HotkeyPanelRenderer toggle (src/rendering/HotkeyPanelRenderer.ts)
- F5-F8 and Ctrl+F5-F8 are unbound
- Camera center via `this.viewport.moveCenter(x, y)`

#### Changes (in execution order)

**Step 1: Bind F1 to select idle workers**
- File: `src/Game.ts` ~line 982 (where F2/F3 are handled)
- Change: Add `if (this.input.state.keysJustPressed.has('F1') && this.scenarioCountdown <= 0) { this.selectIdleWorkers(); }`
- Move HotkeyPanel toggle from F1 to F11 (or remove — it's a dev tool)
- Why: F1=idle worker is the most-used SC2 macro hotkey. Currently the function exists but can't be triggered.

**Step 2: Add camera location storage**
- File: `src/Game.ts` — add `private cameraLocations: Array<{x: number, y: number} | null> = [null, null, null, null];`
- Ctrl+F5: Save viewport center to slot 0. Same for F6/F7/F8 → slots 1/2/3.
- F5: If slot 0 has a saved location, `viewport.moveCenter(loc.x, loc.y)`. Same for F6/F7/F8.
- Pattern: Same keyboard handling as F2/F3 at `Game.ts:982-988`
- Why: Camera locations are essential for multi-base management — jump between main, natural, army.

**Step 3: Update hotkey panel display**
- File: `src/rendering/HotkeyPanelRenderer.ts` — update the hotkey list to show F1, F5-F8 bindings
- Why: Players need to know the keys exist

#### Edge cases
- F1 with no idle workers: do nothing (current selectIdleWorkers behavior — `found` stays false)
- F5-F8 with no saved location: do nothing
- Ctrl+F5 should NOT bubble to browser (prevent default already handled for Ctrl+1-9 in InputManager)

#### NOT in scope
- Idle worker counter in HUD (could add later but not needed for the hotkey to work)
- Camera location minimap indicators

#### Acceptance criteria
- [ ] F1 selects idle workers and centers camera on first one
- [ ] Ctrl+F5 saves camera position, F5 recalls it
- [ ] Same for F6/F7/F8
- [ ] HotkeyPanel shows new bindings
- [ ] Existing F2/F3 still work
- [ ] Type-check passes clean

#### Test plan
- Manual: Have idle workers → press F1 → verify selection and camera jump
- Manual: Save camera location with Ctrl+F5 → pan away → F5 → verify recall
- `npm test` passes
- `npm run build` passes

---

### Task N2: Last-Alert Camera System (Spacebar)
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Change Spacebar from "jump to base" to "jump to last alert/attack location" (SC2 standard). Add alert position tracking so the game remembers where the last enemy attack happened.

#### Prerequisites
- Spacebar currently hardcoded to `tileToWorld(15, 15)` at `src/Game.ts:977-980`
- `MinimapRenderer.showAttackPing(wx, wy)` already receives attack positions
- `CombatSystem` emits `damageEvents[]` with positions
- `AlertRenderer.show()` displays "UNDER ATTACK" text
- `SoundManager.lastAttackTime` tracks timing but not position

#### Changes (in execution order)

**Step 1: Track last alert position**
- File: `src/Game.ts` — add `private lastAlertX = -1; private lastAlertY = -1; private lastAlertTime = -1;`
- In the existing code where `minimapRenderer.showAttackPing()` is called (when player units take damage), also set `this.lastAlertX/Y = attackWorldX/Y; this.lastAlertTime = gameTime;`
- Pattern: Find where attack pings are generated — likely in the render loop where damageEvents are processed
- Why: Need a position to jump the camera to

**Step 2: Change Spacebar behavior**
- File: `src/Game.ts:977-980` — replace hardcoded base jump:
  ```
  if (this.lastAlertTime > 0 && this.gameTime - this.lastAlertTime < 15) {
    this.viewport.moveCenter(this.lastAlertX, this.lastAlertY);
  } else {
    // Fallback: jump to main base
    this.viewport.moveCenter(tileToWorld(15, 15).x, tileToWorld(15, 15).y);
  }
  ```
- Why: SC2 Spacebar cycles through recent alerts. Simplified version: jump to most recent alert within 15s, else jump home.

**Step 3: Add Home key for base jump**
- File: `src/Game.ts` — add `if (keysJustPressed.has('Home')) { viewport.moveCenter(baseX, baseY); }`
- Why: Preserves base-jump functionality on a dedicated key (Backspace or Home)

#### Edge cases
- No alerts yet: Spacebar falls through to base jump (15,15)
- Alert older than 15s: Falls through to base jump
- Multiple rapid attacks: Only stores most recent position (SC2 actually has a ring buffer — this is simplified)

#### NOT in scope
- Alert ring buffer cycling (SC2 cycles through last N alerts with repeated Spacebar)
- Per-alert minimap flash (already exists via showAttackPing)

#### Acceptance criteria
- [ ] When player units take damage, alert position is stored
- [ ] Spacebar within 15s of attack jumps camera to attack location
- [ ] Spacebar with no recent attack jumps to base
- [ ] Home key always jumps to base
- [ ] Existing tests pass

#### Test plan
- Manual: Let enemy attack → press Space → camera jumps to attack site
- Manual: Wait 20s → press Space → camera jumps to base
- `npm test` passes

---

### Task N3: Multi-Building Production Select + Tab Cycling
**Parent:** Gameplay Loop Improvements
**Size:** M
**Depends on:** none
**Unblocks:** none

#### Goal
Allow selecting all buildings of the same type (e.g., Ctrl+click a Barracks to select all Barracks), and use Tab to cycle between individual buildings of that type for production management. This is essential for mid/late-game macro when managing 3+ production buildings.

#### Prerequisites
- `SelectionSystem.ts` handles selection logic, `CycleSubgroup` command exists
- `cycleSubgroup()` at `SelectionSystem.ts:308` cycles through unit types in a multi-unit selection
- `InputProcessor.ts:187-192` sends CycleSubgroup on Tab press
- `InfoPanelRenderer.ts` displays production buttons for selected building

#### Changes (in execution order)

**Step 1: Ctrl+click building → select all of same type**
- File: `src/systems/SelectionSystem.ts` — in single-click handler, detect Ctrl held. If clicking a building and Ctrl is held, instead of selecting just that building, iterate all entities and select every building with the same `buildingType` belonging to the player's faction.
- Pattern: Similar to how double-click selects all of a unit type on screen (already implemented)
- Why: SC2 players Ctrl+click a Barracks to select all Barracks for mass-producing Marines

**Step 2: Tab cycles through individual buildings when buildings selected**
- File: `src/systems/SelectionSystem.ts` — modify `cycleSubgroup()`:
  - If current selection contains ONLY buildings of the same type, Tab should cycle through them individually (deselect all, select next one in sequence, center camera on it)
  - If current selection contains mixed units, keep existing behavior (cycle by unit type)
- Add a module-level `lastBuildingCycleIndex` to track position in the cycle
- Why: After Ctrl+click all Barracks, Tab lets you quickly check each one's queue and add units

**Step 3: Production commands apply to focused building**
- File: `src/Game.ts` `handleProductionButtonClick()` — when multiple buildings of same type are selected, production commands should target the building with the shortest queue (or the focused building after Tab cycling)
- Pattern: Already `findShortestQueueBuilding()` or similar logic may exist; if not, iterate selected buildings, pick one with `prodQueueLen` minimum
- Why: When 3 Barracks are selected, clicking Marine should queue on the least-busy one

**Step 4: UI shows aggregate production**
- File: `src/rendering/InfoPanelRenderer.ts` — when multiple same-type buildings are selected:
  - Show building count (e.g., "3 × Barracks")
  - Show production buttons once (shared)
  - Show individual queues stacked or summarized
- Pattern: Extend existing `updateProductionButtons()` logic
- Why: Player needs to see production state across all selected buildings

#### Edge cases
- Ctrl+click on a unit (not building): existing behavior (select all of unit type on screen) should remain
- Tab with single building selected: do nothing (no cycle needed)
- Tab with mixed building types: cycle by building type, then within type
- Building destroyed while in multi-select: prune from selection on next frame

#### NOT in scope
- Cross-type building groups (e.g., Tab from Barracks to Factory) — defer
- Warp-in mechanic (Protoss) — not implemented yet

#### Acceptance criteria
- [ ] Ctrl+click Barracks selects all player Barracks
- [ ] Tab cycles through individual Barracks, centering camera on each
- [ ] Production click targets least-busy building in multi-select
- [ ] Info panel shows "3 × Barracks" when multiple selected
- [ ] Ctrl+click on a unit still selects all of that unit type on screen
- [ ] Existing Tab subgroup cycling still works for mixed unit selections
- [ ] Type-check passes clean

#### Test plan
- Manual: Build 3 Barracks → Ctrl+click one → verify all 3 selected
- Manual: Tab through them → verify camera cycles to each
- Manual: Click Marine production → verify it queues on shortest-queue Barracks
- `npm test` passes

#### Risk notes
- Tab dual-use (unit subgroup vs building cycle) needs clean mode detection: check if all selected entities are buildings of same type → building cycle mode; else → unit subgroup mode.

---

### Task N4: Production QoL — Supply Block Warning + Shift-Click Queue
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Add a visible supply block warning when production is blocked by insufficient supply, and allow shift+clicking production buttons to queue 5 units at once. These are small but high-frequency quality-of-life improvements.

#### Prerequisites
- HUD supply display turns red when at cap (`HudRenderer.ts:135`)
- Production buttons in `InfoPanelRenderer.ts` fire `productionCallback`
- Supply check at `CommandSystem.ts:1191` and `Game.ts:1935`
- `AlertRenderer.show()` can display timed messages

#### Changes (in execution order)

**Step 1: Supply block warning**
- File: `src/Game.ts` — in `handleProductionButtonClick()` (~line 1913), when production is rejected due to supply, call `this.alertRenderer.show('SUPPLY BLOCKED', 2, this.gameTime)` and flash the supply counter
- File: `src/rendering/HudRenderer.ts` — add `flashSupply()` method that pulses the supply text with a CSS animation (scale up + bright red for 0.5s)
- Pattern: Similar to existing alert system
- Why: SC2 has a prominent audio+visual supply block warning. Players need to know WHY production isn't working.

**Step 2: Shift+click to queue 5 units**
- File: `src/rendering/InfoPanelRenderer.ts` — in production button click handler, check if shift key is held. If yes, fire the production callback 5 times (or until queue is full / resources exhausted).
- File: `src/Game.ts` `handleProductionButtonClick()` — accept a `count` parameter (default 1). Loop `count` times, checking resources and supply each iteration.
- Pattern: Standard RTS convention. SC2 uses shift+click for 5×queue.
- Why: Queuing 5 Marines one click at a time is tedious. Shift+click is expected.

#### Edge cases
- Shift+click with only enough resources for 2: queue 2, stop (don't show error for remaining 3)
- Shift+click with full queue: queue as many as fit (up to PROD_QUEUE_MAX=5)
- Supply block warning: only show once per production attempt (don't spam)

#### NOT in scope
- Audio for supply block (sound system exists but adding specific sounds is separate)
- Right-click to dequeue (already exists or not — check; if not, defer)

#### Acceptance criteria
- [ ] When production blocked by supply, "SUPPLY BLOCKED" alert appears and supply counter flashes red
- [ ] Shift+clicking Marine button queues up to 5 Marines (resources permitting)
- [ ] Queue respects PROD_QUEUE_MAX (5) — doesn't overflow
- [ ] Works for both Terran and Zerg production
- [ ] Type-check passes clean

#### Test plan
- Manual: Use all supply → try to produce → verify warning appears
- Manual: Shift+click Marine with 500 minerals → verify 5 queue up
- `npm test` passes

---

### Task N5: Shift-Queue Abilities & Commands
**Parent:** Gameplay Loop Improvements (Backlog #102 — detailed spec)
**Size:** M
**Depends on:** none
**Unblocks:** none

#### Goal
Allow holding Shift while issuing move, attack-move, patrol, and ability commands to queue them in sequence. Units execute queued commands in order. This is essential for worker management (shift-queue workers to minerals after building) and army micro (shift-queue patrol routes).

#### Prerequisites
- Movement shift-queue already works: `CommandSystem.ts:1252` has `shiftQueue` param, `appendPath()` at `components.ts:283`
- `InputProcessor.ts` already passes `shiftHeld` in GameCommand objects
- `CommandSystem.ts` handles `shiftHeld` for Move commands (appends path instead of replacing)
- NOT implemented for: Attack-Move, Patrol, Stop, Hold, or any abilities
- Waypoint renderer shows shift-queued paths (`WaypointRenderer.ts`)

#### Changes (in execution order)

**Step 1: Extend shift-queue to Attack-Move and Patrol**
- File: `src/systems/CommandSystem.ts` — in AttackMove handler (~line 75) and Patrol handler (~line 118), check `cmd.shiftHeld`. If true, call `issuePathCommand(world, units, wx, wy, map, CommandMode.AttackMove, true)` with shiftQueue=true instead of replacing the current command.
- Pattern: Exact same as Move shift-queue handling
- Why: Attack-move shift-queue is used for leapfrog advances, patrol shift-queue for scout routes

**Step 2: Queue system for abilities**
- File: `src/ecs/components.ts` — add command queue per entity: `commandQueue: Array<Array<{type: number, wx: number, wy: number, targetEid: number}>>` — one queue per entity. Max 8 queued commands.
- Alternative simpler approach: Instead of per-entity queues, when shift+ability is issued, store as a waypoint with an attached action. When unit reaches that waypoint, execute the action.
- Recommended: Use the simpler "action waypoint" approach — append a waypoint to the path, and annotate it with an ability/command to execute on arrival.
- File: `src/ecs/components.ts` — add `waypointAction: Array<Array<{waypointIdx: number, commandType: number, targetEid: number}>>` — sparse annotations on path waypoints
- File: `src/systems/MovementSystem.ts` — on waypoint arrival, check if that waypoint has an annotated action. If yes, execute it (switch commandMode, set target, etc.)
- Why: Full command queue is complex. Action-on-arrival covers 90% of shift-queue use cases.

**Step 3: Shift+ability targeting**
- File: `src/input/InputProcessor.ts` — when an ability is issued with shift held:
  - Don't clear the ability targeting mode after issuing
  - Allow continued targeting (shift+Stim should stim, then stay in normal mode ready for next command)
  - For move-to-and-then-act patterns: issue a move command to the target position with a waypoint action
- Why: SC2 shift-queue lets you chain: move here → attack-move there → patrol back

**Step 4: Visual feedback for queued commands**
- File: `src/rendering/WaypointRenderer.ts` — already shows shift-held paths. Extend to show command icons at annotated waypoints (attack symbol for attack-move waypoints, etc.)
- Pattern: Existing waypoint circles + color coding
- Why: Player needs visual confirmation of what's queued

#### Edge cases
- Shift+Stop: Should NOT queue — Stop is immediate (clears queue)
- Shift+Hold: Should NOT queue — Hold Position is a mode change, not a movement
- Shift+Build: Queue a move to location + build action on arrival (common SCV pattern)
- Death clears queue: When entity dies, no further processing needed (DeathSystem handles)
- Max queue length: 8 waypoints (existing path limit is 64 waypoints, but 8 distinct command segments is reasonable)

#### NOT in scope
- Shift+right-click on building for SCV auto-return after build (nice but complex)
- Visual queue display in info panel (show queued commands as a list)

#### Acceptance criteria
- [ ] Shift+right-click queues move after current command
- [ ] Shift+A+click queues attack-move after current path
- [ ] Shift+P+click queues patrol waypoint after current path
- [ ] Queued commands execute in order
- [ ] Waypoint renderer shows queued command paths with Shift held
- [ ] Existing non-shift commands replace current command (no regression)
- [ ] Type-check passes clean

#### Test plan
- Manual: Select Marine → right-click point A → shift+right-click point B → verify Marine goes A then B
- Manual: Select Marine → right-click → shift+A+click → verify move then attack-move
- `npm test` passes

#### Risk notes
- Action-on-arrival approach may have edge cases with pathfinding (what if unit gets stuck before reaching annotated waypoint). Mitigation: stuck detection already repaths, annotated action persists on the new path's final waypoint.

---

### Task N6: Worker Saturation Display Per Base
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Show per-base worker saturation (e.g., "16/16" for optimal mineral mining, "24/16" for oversaturated) on the HUD or near base buildings. This helps players know when to expand — a core strategic decision.

#### Prerequisites
- `workerCountOnResource` component tracks workers per patch
- `GatherSystem.ts` manages worker assignments
- Each base has ~8 mineral patches (16 optimal workers) + 2 gas (6 optimal workers)
- `HudRenderer.ts` already shows global worker count

#### Changes (in execution order)

**Step 1: Count workers per base building**
- File: `src/Game.ts` or new utility — each tick (or every 30 ticks for performance), for each player CC/Hatchery, count workers within ~15 tile radius that have `workerState !== Idle`. Compare to mineral patch count × 2 for optimal saturation.
- Store as `baseSaturation: Array<{eid: number, current: number, optimal: number}>`

**Step 2: Display on info panel when base selected**
- File: `src/rendering/InfoPanelRenderer.ts` — when CC/Hatchery selected, show "Workers: 14/16 (minerals) + 3/3 (gas)" below the building info
- Color: Green if ≤ optimal, Yellow if 1-4 over, Red if 5+ over
- Pattern: Extend existing building info display
- Why: Glanceable saturation info when you click your base

**Step 3: Display in HUD (optional — consider HUD clutter)**
- File: `src/rendering/HudRenderer.ts` — add per-base saturation indicators next to worker count
- Format: "W: 16/16 | 14/16" (main base | natural)
- Only show if player has 2+ bases (no clutter in early game)
- Why: Passive awareness without clicking each base

#### Edge cases
- Worker assigned to distant mineral patch (not near any base): count toward nearest base
- Base destroyed: remove from saturation tracking
- Expansion with no workers yet: show "0/16"

#### NOT in scope
- Saturation-aware auto-transfer (auto-move excess workers to new expansion)
- Gas saturation display (simpler: just show mineral saturation)

#### Acceptance criteria
- [ ] Selecting CC/Hatchery shows worker saturation ("Workers: 14/16")
- [ ] Green/yellow/red color coding based on saturation level
- [ ] Updates when workers are added/removed
- [ ] Type-check passes clean

#### Test plan
- Manual: Build base, assign workers → select CC → verify saturation display
- Manual: Transfer workers away → verify count decreases
- `npm test` passes

---

### Task N7: Smart Rally Points — Auto-Gather and Attack-Move Rally
**Parent:** Gameplay Loop Improvements
**Size:** M
**Depends on:** none
**Unblocks:** none

#### Goal
Make rally points context-aware: rallying to a mineral patch auto-assigns workers to gather, rallying to an enemy unit issues attack-move. Currently rally points only issue `CommandMode.Move` regardless of target — workers rally to minerals but stand idle when they arrive.

#### Prerequisites
- Rally point set at `src/systems/CommandSystem.ts` via SetRally command → stores `rallyX[eid]`/`rallyY[eid]`
- New units consume rally at `src/systems/ProductionSystem.ts:100-113` — always `CommandMode.Move`
- Workers auto-gather only when NO rally is set (lines 116-138)
- `findResourceAt(world, wx, wy)` exists in `queries.ts` — finds mineral/gas entity at position
- `findEnemyAt(world, wx, wy, faction)` exists in `queries.ts` — finds enemy entity at position

#### Changes (in execution order)

**Step 1: Store rally target entity**
- File: `src/ecs/components.ts` — add `rallyTargetEid: Int16Array` (default -1). When rally is set on a resource entity, store the entity ID in addition to the world position.
- File: `src/systems/CommandSystem.ts` — in SetRally handler, after setting `rallyX/Y`, check if target position has a mineral/gas entity (`findResourceAt`). If yes, set `rallyTargetEid[eid] = resourceEid`.
- Why: Need to distinguish "rally to mineral" from "rally to empty ground near mineral"

**Step 2: Auto-gather when rallied to resource**
- File: `src/systems/ProductionSystem.ts` — after line 113 (existing rally move code), add check: if the spawned unit has WORKER component AND `rallyTargetEid[buildingEid] > 0` AND the target entity is a resource:
  ```
  workerTargetEid[newEid] = rallyTargetEid[buildingEid];
  workerState[newEid] = WorkerState.MovingToResource;
  commandMode[newEid] = CommandMode.Gather;
  workerBaseX[newEid] = posX[buildingEid];
  workerBaseY[newEid] = posY[buildingEid];
  ```
- Pattern: Same as existing no-rally auto-gather code at lines 116-138, just uses rally target instead of nearest
- Why: Workers rallied to minerals should start mining on arrival, not stand idle

**Step 3: Attack-move when rallied past enemies**
- File: `src/systems/ProductionSystem.ts` — for non-worker combat units with a rally set, change `commandMode[newEid] = CommandMode.Move` to `commandMode[newEid] = CommandMode.AttackMove`
- Why: In SC2, rallied army units use attack-move so they engage enemies en route to the rally point. Currently they walk past enemies without fighting.

**Step 4: Visual rally point differentiation**
- File: `src/rendering/UnitRenderer.ts` — when drawing rally point lines from buildings, use different colors:
  - Blue line: move rally (default)
  - Green line: gather rally (target is resource)
  - Red line: attack-move rally (army units)
- Pattern: Rally lines already drawn for selected buildings
- Why: Visual feedback about rally behavior

#### Edge cases
- Rally to depleted mineral patch: fall through to nearest mineral (existing findNearestMineral behavior)
- Rally to enemy building: still attack-move (not targeted attack — just engage on the way)
- Overlords: exempt from attack-move rally (they're supply, not combat)
- Queens: exempt from attack-move rally (should stay near Hatchery)

#### NOT in scope
- Rally to specific unit (follow command) — SC2 supports this but adds complexity
- Rally point auto-update when mineral patch depletes

#### Acceptance criteria
- [ ] Worker rallied to mineral patch auto-gathers on arrival
- [ ] Combat unit rallied past enemies engages them (attack-move, not just move)
- [ ] Rally line color reflects behavior (green for gather, red for attack-move)
- [ ] Non-worker rally to empty ground still works as basic move
- [ ] Existing no-rally auto-gather still works
- [ ] Type-check passes clean

#### Test plan
- Manual: Set Barracks rally → build SCV → verify auto-gather when it arrives at mineral
- Manual: Set Barracks rally → build Marine → verify attack-move (engages enemy en route)
- `npm test` passes

---

### Task N8: Auto-Gather on Base Complete
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
When a new Command Center or Hatchery finishes construction, nearby idle workers should automatically start mining the nearest minerals. Currently the BuildSystem grants supply and releases the builder SCV, but doesn't dispatch nearby idle workers.

#### Prerequisites
- BuildSystem completion handler at `src/systems/BuildSystem.ts:68-99`
- `findNearestMineral(world, wx, wy)` in `queries.ts`
- Worker state management: `workerState`, `workerTargetEid`, `commandMode`, `workerBaseX/Y`
- Builder SCV is released to idle at line 102-117

#### Changes (in execution order)

**Step 1: Dispatch idle workers on base completion**
- File: `src/systems/BuildSystem.ts` — after the completion block (after line 99), add:
  ```
  // Auto-gather: if this is a base building (CC/Hatchery/Lair/Hive), assign nearby idle workers
  const bt = buildingType[eid];
  if (bt === BuildingType.CommandCenter || bt === BuildingType.Hatchery || bt === BuildingType.Lair || bt === BuildingType.Hive) {
    const fac = faction[eid];
    const bx = posX[eid], by = posY[eid];
    const radius = 15 * TILE_SIZE; // ~15 tiles
    for (let w = 1; w < world.nextEid; w++) {
      if (!hasComponents(world, w, WORKER | POSITION)) continue;
      if (faction[w] !== fac) continue;
      if (hpCurrent[w] <= 0) continue;
      if (workerState[w] !== WorkerState.Idle || commandMode[w] !== CommandMode.Idle) continue;
      const dx = posX[w] - bx, dy = posY[w] - by;
      if (dx * dx + dy * dy > radius * radius) continue;
      // Assign to nearest mineral near new base
      const mineral = findNearestMineral(world, bx, by);
      if (mineral > 0) {
        workerTargetEid[w] = mineral;
        workerState[w] = WorkerState.MovingToResource;
        commandMode[w] = CommandMode.Gather;
        workerBaseX[w] = bx;
        workerBaseY[w] = by;
        // Path to mineral
        // ... (same pathfinding pattern as ProductionSystem:124-136)
      }
    }
  }
  ```
- Pattern: Same auto-gather pattern as `ProductionSystem.ts:116-138`
- Why: In SC2, transferring workers to a new base is manual but expected. Auto-dispatching idle workers is a QoL improvement that reduces busywork without removing strategic decisions (player still decides HOW MANY workers to transfer).

**Step 2: Also auto-gather the released builder SCV**
- File: `src/systems/BuildSystem.ts` — after releasing the builder SCV to idle (line 102-117), instead of just setting `commandMode = Idle`, immediately assign it to gather nearest mineral near the new building.
- Why: The builder SCV is always idle after construction. Auto-gathering saves one click per building.

#### Edge cases
- Only dispatch truly idle workers (workerState=Idle AND commandMode=Idle) — don't steal workers from mining
- If no minerals nearby (e.g., building in weird location): do nothing
- Zerg: Drone is consumed during construction, so no builder to release — but nearby idle Drones should still auto-gather

#### NOT in scope
- Automatic worker transfer from oversaturated bases — that's a strategic decision

#### Acceptance criteria
- [ ] Nearby idle workers auto-gather when new CC/Hatchery completes
- [ ] Builder SCV auto-gathers after finishing construction
- [ ] Workers already mining are NOT reassigned
- [ ] Only affects workers within ~15 tile radius
- [ ] Type-check passes clean

#### Test plan
- Manual: Build CC at expansion → have 2 idle workers nearby → verify they start mining
- Manual: SCV finishes building → verify it auto-gathers instead of standing idle
- `npm test` passes

---

### Task N9: Watchtower Vision Mechanic
**Parent:** Gameplay Loop Improvements
**Size:** M
**Depends on:** none
**Unblocks:** none

#### Goal
Make Xel'Naga watchtowers grant a 12-tile vision radius to the faction that has a unit standing on the tower platform. Every map has 2-3 watchtowers placed at strategic locations (map center, third base approaches) — currently they're just elevated terrain with zero functional benefit. In SC2, controlling watchtowers is a key scouting mechanic.

#### Prerequisites
- `placeWatchtower()` at `MapData.ts:1376-1402` creates 3x3 elevated platforms at specific locations per map
- Tower center tiles are `TileType.Ramp` with `elevation = 1`
- `FogSystem.ts` manages per-tile visibility for Terran
- Fog updates every 10 ticks (~167ms)
- Watchtower center positions are deterministic per map (hardcoded in each map generator)

#### Changes (in execution order)

**Step 1: Track watchtower positions in MapData**
- File: `src/map/MapData.ts` — add `watchtowerPositions: Array<{col: number, row: number}>` to the returned map data. In `placeWatchtower()`, push each center position to this array.
- Why: Need to know where towers are without scanning the entire map each tick

**Step 2: Detect tower control**
- File: `src/systems/FogSystem.ts` (or new small function in Game.ts) — every 30 ticks (~500ms), for each watchtower position, check if any entity with POSITION stands within 1.5 tiles of center. If yes, that entity's faction controls the tower.
- Store as `towerControl: Array<Faction>` (one per watchtower)
- Why: Need to determine which faction gets the vision bonus

**Step 3: Grant vision radius**
- File: `src/systems/FogSystem.ts` — when computing fog visibility, for each controlled tower, reveal all tiles within 12-tile radius around the tower center for the controlling faction.
- Pattern: Same as unit-based fog reveal, just centered on tower position instead of unit position
- Why: 12 tiles = same as Scanner Sweep. Enough to see approaching armies on major paths.

**Step 4: Visual indicator**
- File: `src/rendering/TilemapRenderer.ts` — draw a subtle faction-colored ring around controlled watchtowers (blue for Terran, purple for Zerg, neutral gray if unclaimed)
- File: `src/rendering/MinimapRenderer.ts` — show watchtower dots with controlling faction's color
- Why: Players need to see at a glance who controls each tower

**Step 5: Both factions benefit**
- Zerg doesn't normally have fog of war in this game. Options:
  - A) Only grant fog reveal for Terran (Zerg sees everything anyway) — simpler
  - B) Show a visual "controlled" state for both factions — adds map control incentive even for Zerg
- Recommended: Option A for now (Terran fog reveal only), Option B visual for both.

#### Edge cases
- Two opposing units on same tower: no faction controls it (contested — no vision granted)
- Unit moves off tower: immediately lose control (next fog tick clears vision)
- Dead unit on tower: doesn't count (hp <= 0 check)
- Air units: should NOT control towers (ground presence only, matching SC2)

#### NOT in scope
- Watchtower capture animation
- Audio notification on tower capture/loss

#### Acceptance criteria
- [ ] Unit standing on watchtower platform grants 12-tile fog reveal
- [ ] Moving off the tower removes the vision
- [ ] Contested tower (both factions present) grants vision to neither
- [ ] Watchtower has visible faction-colored indicator
- [ ] Minimap shows tower control state
- [ ] Air units do not control towers
- [ ] Type-check passes clean

#### Test plan
- Manual: Move Marine to watchtower → verify fog clears in 12-tile radius
- Manual: Move Marine away → verify fog returns
- Manual: Both factions on tower → verify no vision granted
- `npm test` passes

---

### Task N10: Production Idle Indicator
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
Add a subtle visual indicator when player production buildings have empty queues and the player has enough resources to produce. This prevents the common mistake of floating resources while buildings sit idle — a key macro skill in SC2.

#### Prerequisites
- `prodUnitType[eid] === 0` means building is not producing anything (`ProductionSystem.ts:68`)
- `prodQueueLen[eid] === 0` means queue is empty
- `resources[faction].minerals` available in Game.ts
- Info panel shows production state when building is selected
- No existing idle production feedback

#### Changes (in execution order)

**Step 1: Track idle production buildings**
- File: `src/Game.ts` — every 60 ticks (~1s), count player production buildings where `buildState === Complete && prodUnitType === 0 && prodQueueLen === 0`. If count > 0 AND player has >= 100 minerals (enough for at least one basic unit), set `this.hasIdleProduction = true`.
- Why: Only alert when the player CAN produce but ISN'T — not when they're broke

**Step 2: HUD idle production indicator**
- File: `src/rendering/HudRenderer.ts` — add a small pulsing icon/text near the resource display: "⚠ Idle" or a flashing factory icon. Only visible when `hasIdleProduction === true` for > 3 seconds (debounce to avoid flickering during queue transitions).
- Color: Subtle amber/yellow — noticeable but not alarming
- Pattern: Similar to worker saturation indicator (already turns orange)
- Why: Passive reminder without being intrusive

**Step 3: Building visual indicator (optional)**
- File: `src/rendering/UnitRenderer.ts` — on idle production buildings, draw a subtle amber "!" or pulsing outline. Only when: idle > 5s, player minerals > 200.
- Why: Helps identify WHICH building is idle without selecting each one
- This step is lower priority — the HUD indicator alone provides most value

#### Edge cases
- Building just completed construction: 3s grace period before counting as idle
- Upgrade buildings (Engineering Bay, Evo Chamber): only flag if no upgrade in progress
- Supply blocked: don't flag as idle (it's a supply problem, not a production problem — handled by N4)
- All resources spent: don't flag (player can't produce anyway)

#### NOT in scope
- Audio alert for idle production
- Auto-production (that would remove player agency)

#### Acceptance criteria
- [ ] HUD shows "Idle" indicator when production buildings have empty queues and player has resources
- [ ] Indicator has 3s debounce (doesn't flicker on queue transitions)
- [ ] Not shown when player is supply blocked or broke
- [ ] Type-check passes clean

#### Test plan
- Manual: Build Barracks, don't queue anything, have 200 minerals → verify "Idle" appears after ~3s
- Manual: Queue a Marine → verify indicator disappears
- Manual: Spend all minerals → verify indicator doesn't show
- `npm test` passes

---

### Task N11: Screen-Edge Attack Indicators
**Parent:** Gameplay Loop Improvements
**Size:** S
**Depends on:** none
**Unblocks:** none

#### Goal
When player units are under attack off-screen, show a directional arrow/indicator at the screen edge pointing toward the attack location. This supplements the existing minimap ping and center-screen "UNDER ATTACK" text with spatial direction information.

#### Prerequisites
- Attack detection at `Game.ts:932-946` — tracks `hit.x`, `hit.y` from `getLastTerranHit()`
- `lastUnderAttackAlert` throttles to every 10s
- Viewport center: `this.viewport.center.x/y`
- Viewport bounds: `this.viewport.left/right/top/bottom`

#### Changes (in execution order)

**Step 1: Compute attack direction relative to viewport**
- File: `src/Game.ts` — when an under-attack event fires (line 934), compute the angle from viewport center to attack position:
  ```
  const angle = Math.atan2(hit.y - camY, hit.x - camX);
  ```
- Store as `this.attackIndicatorAngle`, `this.attackIndicatorTime = gameTime`
- Why: Need the direction to place the arrow

**Step 2: Render edge indicator**
- File: `src/rendering/AlertRenderer.ts` or new small renderer — each frame, if `gameTime - attackIndicatorTime < 5`:
  - Project the attack angle to the nearest screen edge
  - Draw a red triangle/chevron (pointing outward) at that edge position
  - Fade over 5 seconds (alpha from 1.0 to 0.0)
- Position: Inset 30px from screen edge (outside edge-scroll zone of 20px)
- Size: ~20x15px triangle
- Pattern: Pure screen-space rendering (add to app.stage, not viewport)
- Why: Quick glance tells player WHERE the attack is coming from without looking at minimap

**Step 3: Multiple concurrent indicators**
- Support up to 3 simultaneous indicators (different attack locations)
- Each has independent angle + fade timer
- Merge indicators within 30° of each other (same direction)
- Why: Multiple prongs should show multiple arrows

#### Edge cases
- Attack happening ON screen (within viewport bounds): no indicator needed (player can see it)
- Attack at exact viewport center: no meaningful direction — skip
- Edge scroll: indicator renders inside scroll zone (30px inset) so it doesn't interfere
- Multiple attacks from same direction: merge into single brighter indicator

#### NOT in scope
- Clicking the indicator to jump camera (Spacebar handles this via N2)
- Audio directional panning

#### Acceptance criteria
- [ ] Red directional arrow appears at screen edge when under attack off-screen
- [ ] Arrow points toward attack location
- [ ] Fades over 5 seconds
- [ ] No indicator for on-screen attacks
- [ ] Up to 3 concurrent indicators for multi-prong attacks
- [ ] Type-check passes clean

#### Test plan
- Manual: Position camera away from base → let enemy attack → verify arrow appears at correct edge
- Manual: Multiple attacks from different directions → verify multiple arrows
- `npm test` passes

---

## Cross-Cutting Concerns

### Hotkey Map Consistency
After all tasks complete, the hotkey map should be:
| Key | Action | Source |
|-----|--------|--------|
| F1 | Select idle workers | N1 |
| F2 | Select all army | Existing |
| F3 | Select all workers | Existing |
| F5-F8 | Camera recall (save with Ctrl+) | N1 |
| F11 | Hotkey panel (moved from F1) | N1 |
| F12 | Debug overlay | Existing |
| Space | Jump to last alert (or base if none) | N2 |
| Home | Jump to base | N2 |
| Tab | Cycle subgroup / cycle buildings | N3 |
| Shift+click prod | Queue 5× | N4 |
| Shift+move/A/P | Queue commands | N5 |

### InputManager Key Prevention
`InputManager.ts` prevents browser defaults for Ctrl+1-9. Extend to prevent Ctrl+F5-F8 (browser cache bypass on some browsers).

### Info Panel Mode Detection
InfoPanelRenderer needs to detect context:
- Single unit selected → unit info
- Single building selected → building info + production
- Multiple same-type buildings → aggregate info (N3)
- Multiple units → existing multi-unit display

---

## Architecture Model (snapshot)

### System Execution Order (per tick)
1. spatialHash.rebuild → 2. commandSystem → 3. buildSystem → 4. productionSystem → 5. upgradeSystem → 6. movementSystem → 7. fogSystem → 8. combatSystem → 9. abilitySystem → 10. gatherSystem → 11. deathSystem → 12. aiSystem → 13. creepSystem

### Key Extension Points for New Tasks
- **N1 (Hotkeys)**: Game.ts key handling block (~line 975-988) — add F1/F5-F8
- **N2 (Last Alert)**: Game.ts:932-946 where damageEvents/attack pings processed — track position
- **N3 (Multi-Building)**: SelectionSystem.ts click handler + cycleSubgroup():308 — mode detection
- **N4 (Production QoL)**: InfoPanelRenderer production button handlers + Game.ts:1913 handleProductionButtonClick
- **N5 (Shift-Queue)**: CommandSystem.ts command handlers + components.ts waypoint annotations + MovementSystem.ts:169 arrival
- **N6 (Saturation)**: InfoPanelRenderer.ts building display + Game.ts per-tick base counting
- **N7 (Smart Rally)**: ProductionSystem.ts:100-113 rally consumption + CommandSystem.ts SetRally handler + queries.ts findResourceAt
- **N8 (Auto-Gather Base)**: BuildSystem.ts:68-99 completion handler — add worker dispatch loop
- **N9 (Watchtower)**: MapData.ts placeWatchtower() — store positions; FogSystem.ts — add tower-based reveal
- **N10 (Idle Production)**: Game.ts tick loop — scan production buildings; HudRenderer.ts — add indicator
- **N11 (Edge Indicators)**: Game.ts:932-946 attack handler — compute angle; AlertRenderer.ts or new — render arrow

### Component Registry (relevant to new tasks)
| Component | Type | Read by | Written by |
|-----------|------|---------|-----------|
| selected | Uint8Array | SelectionSystem, InfoPanel | SelectionSystem |
| buildingType | Uint8Array | InfoPanel, ProductionSystem | Game.spawnBuilding |
| workerState | Uint8Array | GatherSystem, selectIdleWorkers | GatherSystem, CommandSystem |
| commandMode | Uint8Array | CombatSystem, MovementSystem | CommandSystem |
| posX/posY | Float32Array | All renderers | MovementSystem |
| prodQueueLen | Uint8Array | ProductionSystem, InfoPanel | CommandSystem, ProductionSystem |

---

## Player Feedback — Bug Fixes (Priority: HIGH)

The following bugs were reported from playtesting. These should be addressed before new feature work since they break core gameplay loops.

---

### Task BF1: Workers Stuck in Minerals / Mined-Out Nodes
**Size:** S
**Depends on:** none
**Priority:** HIGH — breaks economy loop

#### Problem
SCVs sometimes get stuck under mineral patches. Drones also get stuck on fully mined-out mineral nodes — when a node is depleted, workers assigned to it never reassign and remain stuck.

#### Acceptance criteria
- [ ] Workers never overlap/get stuck inside mineral patch sprites
- [ ] When a mineral node is fully mined, all workers assigned to it immediately reassign to the nearest available mineral patch
- [ ] Workers pathfind around mineral patches, not through them
- [ ] Type-check passes clean

---

### Task BF2: Any SCV Should Continue Another SCV's Build
**Size:** S
**Depends on:** none
**Priority:** HIGH — SC2 standard behavior

#### Problem
If an SCV starts building and the player sends another SCV to the same building-in-progress, the second SCV should automatically continue construction. Currently only the original builder can continue.

#### Acceptance criteria
- [ ] Right-clicking an in-progress building with a different SCV causes it to take over construction
- [ ] Original builder is released when a new SCV takes over
- [ ] Multiple SCVs near a building-in-progress can all assist (SC2 multi-SCV build)
- [ ] Type-check passes clean

---

### Task BF3: Gas Mining Persistence
**Size:** S
**Depends on:** none
**Priority:** HIGH — breaks resource loop

#### Problem
SCVs assigned to gas extractors do not continuously mine gas. After one or two trips they wander off and become idle instead of repeatedly mining gas.

#### Acceptance criteria
- [ ] Workers assigned to gas continuously cycle: move to extractor → harvest → return to CC → repeat
- [ ] Workers stay on gas until manually reassigned or extractor is depleted
- [ ] Works for both Terran (Refinery) and Zerg (Extractor, once built)
- [ ] Type-check passes clean

---

### Task BF4: Engineering Bay / Evo Chamber Upgrades Not Clickable
**Size:** S
**Depends on:** none
**Priority:** HIGH — blocks upgrade path

#### Problem
Engineering Bay upgrade buttons are not clickable from the info panel UI. Evo Chamber also has no available upgrades. Players cannot research Infantry Weapons/Armor or Zerg Melee/Ranged/Carapace.

#### Acceptance criteria
- [ ] Selecting Engineering Bay shows clickable upgrade buttons (Infantry Weapons, Infantry Armor, Hi-Sec Auto Tracking)
- [ ] Selecting Evolution Chamber shows clickable upgrade buttons (Melee Attacks, Missile Attacks, Ground Carapace)
- [ ] Clicking an upgrade button starts the research with correct cost deduction
- [ ] Research progress is visible in the UI
- [ ] Type-check passes clean

---

### Task BF5: Win Condition Does Not Properly Trigger
**Size:** S
**Depends on:** none
**Priority:** HIGH — game literally never ends

#### Problem
The game does not end when the last enemy building is destroyed. The win condition check is either missing or not firing correctly.

#### Acceptance criteria
- [ ] Game ends with "VICTORY" when all enemy buildings are destroyed
- [ ] Game ends with "DEFEAT" when all player buildings are destroyed
- [ ] Game over screen appears with stats
- [ ] Works for both Terran and Zerg as player faction
- [ ] Type-check passes clean

---

### Task BF6: Gas Extractor Misalignment
**Size:** S
**Depends on:** none
**Priority:** MED — visual correctness

#### Problem
Gas extractors (Refinery) do not visually align with gas geyser patches on the map. The building snaps to a grid position that doesn't match where the gas actually is.

#### Acceptance criteria
- [ ] Gas buildings snap to the exact position of the gas geyser entity
- [ ] Building preview (ghost) aligns correctly over the geyser before placement
- [ ] Works on all 10 maps
- [ ] Type-check passes clean

---

### Task BF7: Control Groups Broken — Re-adding Instead of Switching
**Size:** S
**Depends on:** none
**Priority:** HIGH — breaks core micro mechanic

#### Problem
Control groups seem to be re-adding units to new groups instead of switching the current selection to match the stored control group. Pressing a control group number should recall that exact set of units, not add to the current selection.

#### Acceptance criteria
- [ ] Pressing 1-9 (without Ctrl) replaces current selection with control group contents
- [ ] Ctrl+1-9 assigns current selection to that group (replacing previous contents)
- [ ] Shift+1-9 adds current selection to existing control group
- [ ] Double-pressing a number key centers camera on the group
- [ ] Type-check passes clean

---

### Task BF8: Zerglings Don't Attack Terran Structures (Player as Zerg)
**Size:** S
**Depends on:** none
**Priority:** HIGH — breaks Zerg combat

#### Problem
When playing as Zerg against Terran AI, Zerglings do not attack Terran structures even when attack-moved into them. They may be ignoring buildings as valid targets or have a targeting filter issue.

#### Acceptance criteria
- [ ] Zerglings attack-move correctly engages Terran buildings
- [ ] All Zerg melee/ranged units can target enemy buildings
- [ ] Works for both player-controlled and AI-controlled Zerg units
- [ ] Type-check passes clean

---

### Task BF9: Double-Click / Ctrl+Click to Select All of Same Type
**Size:** S
**Depends on:** none
**Priority:** MED — core selection UX
**Note:** Ctrl+click for buildings is covered by Task N3. This task covers double-click for units.

#### Problem
Double-clicking a unit should select all visible units of the same type (SC2 standard). Ctrl+clicking a unit should also select all of that unit type on screen.

#### Acceptance criteria
- [ ] Double-clicking a unit selects all player units of that type currently visible on screen
- [ ] Ctrl+clicking a unit adds all on-screen units of that type to the current selection
- [ ] Works for both Terran and Zerg units
- [ ] Does not conflict with existing selection behavior
- [ ] Type-check passes clean

---

### Task BF10: Post-Game Statistics Recap
**Size:** M
**Depends on:** none
**Priority:** MED — completeness

#### Problem
There is no post-game statistics screen. After a game ends, players want to see total minerals mined, units trained, units lost, units killed, etc.

#### Acceptance criteria
- [ ] Game over screen shows statistics: total minerals mined, gas mined, units trained, units lost, units killed, buildings constructed, buildings lost
- [ ] Stats tracked incrementally during the game (per-faction counters)
- [ ] Both player and AI stats shown side-by-side for comparison
- [ ] Type-check passes clean
