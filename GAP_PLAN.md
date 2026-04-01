# Swarm Command — Gap Plan
*Based on post-sprint audit, 2026-04-01*

## Tier 1 — Broken / Non-functional (fix before showing anyone)

### 1.1 — Q/W Production Hotkeys Don't Fire
**Problem:** `InputProcessor` correctly emits `CommandType.Produce` with `data: 0` (Q) or `data: 1` (W), but the command is only processed if the player has a building in their selection. When the player presses Q while a Barracks is selected, the `cmd.units` snapshot contains the building EID — but `handleProductionCommand` in CommandSystem currently reads `getSelectedBuildings(world)` instead of using `cmd.units`. Debug and confirm the exact break point, then fix.

**Files:** `src/systems/CommandSystem.ts`, `src/input/InputProcessor.ts`  
**Effort:** 30 min

---

### 1.2 — No Upgrade Research UI (Engineering Bay unusable)
**Problem:** `UpgradeSystem` and `encodeResearch()` are complete. The Engineering Bay can be built. But the player has no way to queue research — there's no button in the info panel and no hotkey path. The building is a dead end.

**Fix:**
- In `InfoPanelRenderer`, detect when selected building is `BuildingType.EngineeringBay`
- Render 3 research buttons: "W+1 (100m/100g)", "A+1 (100m/100g)", "V+1 (100m/100g)"
- Grey out if already level 3 or can't afford
- On click, deduct resources and set `prodUnitType[eid] = encodeResearch(upgradeType)`, `prodProgress/prodTimeTotal` from `getUpgradeCost()`
- Show in-progress research as a progress bar (reuse existing prod bar), label "Researching: Inf Weapons +2"

**Files:** `src/rendering/InfoPanelRenderer.ts`, `src/systems/UpgradeSystem.ts`  
**Effort:** 2–3 hours

---

### 1.3 — No Restart Button on Game-Over Screen
**Problem:** Victory/defeat screen shows stats but the only way to play again is `F5`. This kills demo-ability entirely.

**Fix:** Add a "Play Again" button to `GameOverRenderer` that calls `window.location.reload()`. One `<button>` element, 10 lines.

**Files:** `src/rendering/GameOverRenderer.ts`  
**Effort:** 15 min

---

### 1.4 — Stim Pack Can Kill Marines
**Problem:** `AbilitySystem` applies 10 HP cost before checking if it would be lethal. A Marine at 10 HP or less dies instantly when stimmed.

**Fix:** Already partially guarded (`if (hpCurrent[eid] <= STIM_HP_COST) continue`) — verify this check is present and firing correctly. If not, the guard is there but the condition may be wrong (`<=` vs `<`).

**Files:** `src/systems/AbilitySystem.ts`  
**Effort:** 10 min

---

### 1.5 — Tab Subgroup Cycling Not Wired
**Problem:** `SelectionSystem.ts:129` has `// TODO: Tab subgroup cycling — needs command queue integration`. The original SC2-style Tab subgroup cycling was removed when input was refactored.

**Fix:** Add `CommandType.CycleSubgroup` to `CommandQueue.ts`. Emit it from `InputProcessor` on `Tab` key. Handle in `SelectionSystem` to cycle through unit types in current selection.

**Files:** `src/input/CommandQueue.ts`, `src/input/InputProcessor.ts`, `src/systems/SelectionSystem.ts`  
**Effort:** 1 hour

---

## Tier 2 — High-Impact Polish (makes it feel like a real RTS)

### 2.1 — Patrol / Hold Position Visual Indicators
**Problem:** Patrol and Hold Position modes work correctly but give zero visual feedback. A player has no idea if a unit is patrolling or holding.

**Fix:**
- `ModeIndicatorRenderer` currently shows "ATTACK MOVE" mode. Extend it to also show "PATROL" when any selected unit has `commandMode === Patrol`.
- In `UnitRenderer`, add a small visual badge on patrolling units: a small circular arrow icon (drawn with `Graphics` arcs). On hold-position units: a tiny shield shape.
- Waypoints for patrol routes already render when shift is held — ensure the patrol origin point is also shown.

**Files:** `src/rendering/UnitRenderer.ts`, `src/rendering/ModeIndicatorRenderer.ts`  
**Effort:** 2 hours

---

### 2.2 — Rally Point Visualization
**Problem:** Right-clicking on the map while a building is selected sets a rally point, but there's zero visual confirmation. Players won't know it worked.

**Fix:**
- Render a small flag/marker at `rallyX[eid], rallyY[eid]` for each selected building
- Draw a dashed line from building center to rally point
- Color it the faction color (blue for Terran)
- Only render when the building is selected

**Files:** `src/rendering/UnitRenderer.ts` or new `RallyRenderer.ts`  
**Effort:** 1–2 hours

---

### 2.3 — Ability Visual Feedback
**Problem:** Several abilities fire but have no visual confirmation:
- Marauder Concussive Shells: targets get slowed but no visual effect
- Stim Pack: existing stim glow effect — verify it's rendering
- Siege Mode transition: verify animation plays
- Medivac healing: verify glow on healed units

**Fix:**
- For slow (Concussive Shells): add a blue tint or particle trail to units with `slowEndTime[eid] > gameTime`
- For Stim: already has `stimEndTime` check in UnitRenderer — verify it's showing correctly
- Add a brief flash effect (white alpha overlay) when an ability activates

**Files:** `src/rendering/UnitRenderer.ts`  
**Effort:** 2 hours

---

### 2.4 — Ability Cooldown/Active Timer in Info Panel
**Problem:** When a Marine is selected, there's no indication of whether Stim is on cooldown or how long it lasts.

**Fix:**
- In `InfoPanelRenderer` unit section, check `stimEndTime[eid] > gameTime` → show "STIM: Xs" countdown
- Check `siegeMode[eid]` → show current mode (Mobile/Sieged/Transitioning)
- Check `slowEndTime[eid] > gameTime` → show slow timer for affected units

**Files:** `src/rendering/InfoPanelRenderer.ts`  
**Effort:** 1 hour

---

### 2.5 — Slow/Debuff Visual Effect
**Problem:** Marauder's Concussive Shells slow enemies but there's no visual. In SC2, slowed units have a blue ice-crystal effect.

**Fix:** In `UnitRenderer`, for units with `slowFactor[eid] > 0` (actively slowed), apply a `renderTint` overlay of light blue (`0x88ccff`) at partial alpha, or draw a blue circle at reduced radius.

**Files:** `src/rendering/UnitRenderer.ts`  
**Effort:** 1 hour

---

### 2.6 — Path Invalidation on Dynamic Obstacles
**Problem:** When a Rock entity is destroyed and the tile becomes walkable, units that already have a cached path through that tile will work fine. But units with paths that used to route *around* the rock will keep routing around it until their next command. More critically — if a unit is pathing and a Rock spawns (on map load), units can step through it.

**Fix:**
- On rock destruction (in `DeathSystem`), scan for units with `movePathIndex >= 0` whose path passes through the now-clear tile and clear their path to force a re-path on next move command
- Alternatively: when `commandMode === AttackMove` or `Patrol`, re-path every 3s as a general correction mechanism

**Files:** `src/systems/DeathSystem.ts`, `src/systems/MovementSystem.ts`  
**Effort:** 2 hours

---

## Tier 3 — Content Gaps (makes it more interesting)

### 3.1 — Ghost Cloaking
**Problem:** Ghost unit exists but has no signature ability. It's just a long-range Marine.

**Plan:**
- New `CommandType.Cloak` in `CommandQueue.ts`
- `KeyC` hotkey in `InputProcessor`
- New component arrays: `cloaked: Uint8Array`, `cloakEnergy: Float32Array` (energy drains while cloaked)
- In `FogSystem`: cloaked Zerg units are invisible to Terran fog queries
- In `CombatSystem`: cloaked units can't be auto-targeted unless a detector is nearby (simplified: skip if cloaked and no CommandCenter within 10 tiles)
- Visual: cloaked units render at 30% alpha with a shimmer effect
- In `AbilitySystem`: drain energy while cloaked, uncloak if energy hits 0

**Files:** `src/constants.ts`, `src/ecs/components.ts`, `src/systems/AbilitySystem.ts`, `src/systems/CombatSystem.ts`, `src/rendering/UnitRenderer.ts`  
**Effort:** 4–6 hours

---

### 3.2 — Mutalisk Glaive Bounce
**Problem:** Mutalisk attacks but projectile doesn't bounce (SC2 signature mechanic where damage bounces to 2 nearby targets at reduced damage: 100%, 30%, 9%).

**Plan:**
- In `CombatSystem`, when `unitType[eid] === UnitType.Mutalisk` fires, find up to 2 additional nearby enemies within 3 tiles
- Apply: primary target = full damage, bounce 1 = 30% damage, bounce 2 = 9% damage
- Emit separate projectile events for each bounce from `ProjectileRenderer`

**Files:** `src/systems/CombatSystem.ts`, `src/rendering/ProjectileRenderer.ts`  
**Effort:** 2 hours

---

### 3.3 — AI Expansion
**Problem:** AI only uses its starting base. No expansion means the game always plays the same way and the AI never recovers from economic damage.

**Plan:**
- After wave 5, AI checks if `aiMinerals < 200` and `waveCount > 5` → attempts to spawn a second Hatchery at a predetermined location (tile 100, 100 on Plains map)
- Second Hatchery produces units independently
- Creates a second attack vector for the AI

**Files:** `src/systems/AISystem.ts`, `src/map/MapData.ts`  
**Effort:** 3 hours

---

### 3.4 — Hellion unit (light Terran harasser)
**Problem:** Factory currently produces SiegeTank and Ghost. Factory is the only vehicle building and deserves a fast harassment unit earlier in the game.

**Plan:**
- `UnitType.Hellion = 7`, produces from Factory as Q hotkey (SiegeTank moves to W, Ghost to E)
- Stats: 90 HP, 8 damage (Explosive), 5 range, 4.5 speed, 1200ms cooldown
- Special: flamethrower — line AoE in a cone (2-tile width) instead of point target
- ArmorClass: Light
- Costs: 100m/0g, builds in 21s

**Files:** `src/data/units.ts`, `src/data/buildings.ts`, `src/constants.ts`, `src/systems/CombatSystem.ts`  
**Effort:** 3 hours

---

## Tier 4 — Game Feel & UX

### 4.1 — Pause with `Escape` / `P`
**Problem:** No pause. In a game with siege tanks and micro-management, pause is expected.

**Fix:**
- `private paused = false` in `Game.ts`
- `Escape` key toggles pause (unless in build mode, where it cancels)
- When paused: `accumulator` stops accumulating, render shows "PAUSED" overlay
- `ModeIndicatorRenderer` shows PAUSED state

**Files:** `src/Game.ts`, `src/rendering/ModeIndicatorRenderer.ts`  
**Effort:** 1 hour

---

### 4.2 — Better Visual Unit Differentiation
**Problem:** All units are colored rectangles/ellipses. At a glance, a Marine and a Marauder look the same (both blue rectangles, different size).

**Fix:** Add unit-type-specific shape details to `UnitRenderer`:
- **Marine**: small rectangle with a white helmet stripe
- **Marauder**: wider rectangle with two side struts
- **SiegeTank (mobile)**: rectangle with a triangular turret on top
- **Medivac**: rectangle with a red cross
- **Ghost**: thin tall rectangle
- **Zergling**: small circle with 2 tiny spike lines (mandibles)
- **Hydralisk**: oval with vertical spine lines
- **Roach**: wide flat ellipse with ridge bumps

These are all done with `Graphics.rect()`, `Graphics.circle()`, `Graphics.lineTo()` — no assets needed.

**Files:** `src/rendering/UnitRenderer.ts`  
**Effort:** 3–4 hours

---

### 4.3 — Selection Sound Variety (Unit Acknowledgment Lines)
**Problem:** Unit selection plays a generic tone. A real RTS has unit-specific responses ("Yes sir!", "Ready to fight!"). Without voice acting, we can still vary the audio more.

**Fix:** In `SoundManager.playSelectUnit(unitType)`, expand pitch/waveform variety:
- Marine: quick double-blip (like "ready!")
- Medivac: rising warm chord (healing feel)
- SiegeTank: deep bass thud
- Zergling: fast chittering noise burst
- Hydralisk: long low hiss

**Files:** `src/audio/SoundManager.ts`  
**Effort:** 1 hour

---

### 4.4 — Building Fire Effect at Low HP
**Problem:** Buildings at low HP should show visible damage (fire/smoke) like in SC2.

**Fix:** In `UnitRenderer`, for buildings with `hpCurrent[eid] / hpMax[eid] < 0.25`:
- Draw 2–3 small flickering orange circles at random offsets from the building center
- Flicker using `Math.sin(gameTime * 8 + eid) > 0` as a frame gate
- No new component needed — just conditional rendering

**Files:** `src/rendering/UnitRenderer.ts`  
**Effort:** 1 hour

---

### 4.5 — Camera Shake on Large Explosions
**Problem:** Siege tank splash and Baneling explosions have no impact feedback.

**Fix:**
- Add `private cameraShake = 0` to `Game.ts`
- When Siege Tank fires or Baneling explodes (detectable in `CombatSystem` via `atkSplash[eid] > 1`), increment `cameraShake += 3`
- In `render()`, if `cameraShake > 0`: offset viewport position by `Math.sin(gameTime * 40) * cameraShake`, decay by `dt * 20`
- Subtle — max 3px offset, decays in 0.15s

**Files:** `src/Game.ts`, `src/systems/CombatSystem.ts` (emit event)  
**Effort:** 1 hour

---

## Tier 5 — Portfolio Presentation

### 5.1 — Screenshot / GIF in README
**Problem:** README has a `![Swarm Command gameplay](screenshot.png)` placeholder. No actual screenshot exists. GitHub preview shows a broken image.

**Fix:** Take a screenshot during a mid-game moment (multiple units engaged, fog visible, HUD active), save as `screenshot.png` in repo root.

**Effort:** 5 min

---

### 5.2 — Live Demo URL in README
**Problem:** README has `YOUR_GITHUB_USERNAME` placeholder for the GitHub Pages URL.

**Fix:** Replace with actual URL after first successful CI deploy.

**Effort:** 2 min after deploy

---

### 5.3 — Portfolio Terminal Integration
**Problem:** The portfolio site (portfolio/ directory) doesn't reference Swarm Command yet.

**Fix:** Add an entry to the portfolio terminal project list with:
- Live URL
- Tech stack: TypeScript, PixiJS v8, Hand-rolled ECS, Vitest
- Description: SC2-inspired browser RTS, 12 units, upgrades, fog of war, AI
- GitHub link

**Files:** `portfolio/` project files  
**Effort:** 30 min

---

## Priority Order (if doing one sprint at a time)

| # | Item | Why |
|---|------|-----|
| 1 | 1.3 Restart button | 15 min, unblocks demos |
| 2 | 1.4 Stim pack fix | 10 min, prevents unit death bugs |
| 3 | 1.1 Q/W hotkeys | Core RTS feel, breaks frequently |
| 4 | 1.2 Upgrade research UI | Engineering Bay dead without it |
| 5 | 2.1 Patrol visual | Players confused without it |
| 6 | 2.2 Rally point visual | Standard RTS expectation |
| 7 | 4.1 Pause | Essential for micro-management |
| 8 | 3.2 Mutalisk bounce | 2h, high payoff for a fun mechanic |
| 9 | 4.4 Building fire effect | 1h, makes low-HP fights tense |
| 10 | 3.1 Ghost cloaking | Big new mechanic, changes late-game |
| 11 | 4.5 Camera shake | 1h, huge feel improvement |
| 12 | 1.5 Tab subgroup cycling | SC2 players will expect this |
| 13 | 4.2 Better unit shapes | Visual identity for portfolio |
| 14 | 3.3 AI expansion | Longer games, more interesting late-game |
| 15 | 5.1 Screenshot for README | Portfolio presentation |
