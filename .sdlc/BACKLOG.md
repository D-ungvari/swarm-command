# Backlog

## Up Next

| # | Title | Type | Priority | Notes |
|---|-------|------|----------|-------|
| 132 | Unit & Building Visual Overhaul — Carbot Palette Alignment | polish | HIGH | **ULTRAPLANNED** → `.sdlc/plans/unit-visual-overhaul.md` (8 tasks). Brighten all unit/building colors to match vibrant terrain. Update constants, unit data, UnitRenderer hardcoded hex, portraits, waypoints, effects. |
|    | ↳ T1: Faction Color Constants | polish | — | Update TERRAN_COLOR, ZERG_COLOR, palette constants to brighter values |
|    | ↳ T2: Unit & Building Data Colors | polish | — | Update custom color fields in units.ts and buildings.ts |
|    | ↳ T3: Terran Unit Rendering Brighten | polish | — | Update hardcoded Terran hex in UnitRenderer |
|    | ↳ T4: Zerg Unit Rendering Brighten | polish | — | Update hardcoded Zerg hex in UnitRenderer |
|    | ↳ T5: Building Rendering Brighten | polish | — | Update hardcoded building hex in UnitRenderer |
|    | ↳ T6: Portrait Renderer Color Update | polish | — | Sync portrait CSS constants with new faction colors |
|    | ↳ T7: UI Theme Plan Alignment | polish | — | Update ui-look-and-feel.md with corrected color values |
|    | ↳ T8: Effects & Health Bar Polish | polish | — | Attack flash, death halos, waypoints, carry indicators |
| 95 | Bunker building + unit loading | feat | HIGH | Terran Bunker: 400 HP, 100 minerals, 2x2. Load up to 4 Marines (or 2 Marauders). Loaded units fire from inside with +1 range. Salvage for 75% refund. Hotkey to load/unload. |
| 96 | Protoss faction — core units + buildings | feat | HIGH | Shields, pylon power, warp-in. Buildings: Nexus, Pylon, Gateway, Cybernetics Core, Robotics Facility, Stargate, Twilight Council. Units: Probe, Zealot, Stalker, Sentry, Immortal, Colossus, Phoenix, Void Ray, High Templar (Psi Storm), Dark Templar, Observer. Photon Overcharge. |
| 97 | MULE / Orbital Command | feat | MED | CC upgrades to Orbital Command (150 minerals). Abilities: Call Down MULE (accelerated mining, 90s duration), Scanner Sweep (temporary vision), Extra Supplies (+8 supply to depot). |
| 98 | Addon attach/detach system | feat | MED | Barracks/Factory/Starport can build Tech Lab or Reactor addon. Tech Lab unlocks advanced units from that building. Reactor allows double production. Addons can be swapped by lifting building. |
| 99 | Queen Creep Tumor ability | feat | MED | Queen places Creep Tumor on creep (25 energy). Tumors spread creep autonomously in a radius. Can spawn one child tumor before expiring. Zerg units get +30% move speed on creep. |
| 100 | Multi-SCV speed build | feat | MED | Additional SCVs can assist construction, each adding repair-rate progress. Max 3 SCVs per building. Costs additional minerals proportional to repair rate. |
| 101 | Viper Abduct polish | feat | LOW | Abduct pulls target unit to Viper's location. Animation: tentacle lash, target slides to Viper. Range 9. Cost 75 energy. |
| 102 | Shift-queue abilities | feat | LOW | Hold Shift while issuing commands to queue them. Units execute queued commands in order. Works for move, attack-move, patrol, abilities. |
| 103 | Stat & behavior fixes (siege cooldown, min range, multi-hit, fungal root, widow friendly fire) | fix | CRITICAL | **ULTRAPLANNED** → `.sdlc/plans/sc2-skirmish-audit.md` (Task 1). 8 verified combat inaccuracies. |
| 104 | Zerg Extractor building | feat | CRITICAL | **ULTRAPLANNED** → Task 2. Player-as-Zerg has no gas building. |
| 105 | Tech gate buildings (Armory, Ghost Academy, Fusion Core) | feat | CRITICAL | **ULTRAPLANNED** ��� Task 3. BC/Ghost/Thor producible without tech requirement. |
| 106 | TechLab unit gating + Reactor dual production | feat | CRITICAL | **ULTRAPLANNED** → Task 4. Depends on #105. Replaces/refines backlog #98. |
| 107 | Lair/Hive tech progression | feat | CRITICAL | **ULTRAPLANNED** → Task 5. All Zerg tech available immediately. |
| 108 | Zerg tech buildings (Baneling Nest, Ultralisk Cavern, Lurker Den) | feat | HIGH | **ULTRAPLANNED** → Task 6. Depends on #107. |
| 109 | Unit-specific research system (Stim, Combat Shield, Met Boost, etc.) | feat | HIGH | **ULTRAPLANNED** → Task 7. Depends on #106, #108. |
| 110 | Detection system | feat | CRITICAL | **ULTRAPLANNED** → Task 8. Cloaked/burrowed units have zero counter. |
| 111 | Elevation combat penalty (high ground miss chance) | feat | MED | **ULTRAPLANNED** → Task 9. |
| 112 | Morph mechanics (Baneling/Ravager/Lurker from base units) | feat | MED | **ULTRAPLANNED** → Task 10. Depends on #108. |
| 113 | Medivac transport + boost | feat | HIGH | **ULTRAPLANNED** → Task 11. Core Terran mechanic. |
| 114 | Unit ability additions (BC Tactical Jump, Reaper cliff jump) | feat | MED | **ULTRAPLANNED** → Task 12. |
| 115 | Vehicle/Ship Armor upgrade | feat | MED | **ULTRAPLANNED** → Task 13. Depends on #105. |
| 116 | Missing Terran units (Banshee, Liberator, Raven) | feat | MED | **ULTRAPLANNED** → Task 14. Depends on #105, #106, #110. |
| 117 | Missing Zerg units (Overseer, Brood Lord, Swarm Host) | feat | MED | **ULTRAPLANNED** → Task 15. Depends on #107, #108, #110. |
| 118 | Polish pass (mineral variety, building burn, veterancy toggle) | fix | LOW | **ULTRAPLANNED** → Task 16. |
| 119 | Macro hotkeys (F1 idle worker, camera save/recall F5-F8) | feat | HIGH | **ULTRAPLANNED** → `.sdlc/plans/gameplay-loop-improvements.md` (Task N1). Bind selectIdleWorkers to F1, add Ctrl+F5-F8 camera locations. |
| 120 | Last-alert camera system (Spacebar) | feat | HIGH | **ULTRAPLANNED** → Task N2. Change Space from base-jump to last-attack-jump. Add Home for base. |
| 121 | Multi-building production select + Tab cycling | feat | MED | **ULTRAPLANNED** ��� Task N3. Ctrl+click building selects all of type. Tab cycles individual buildings. Production targets shortest queue. |
| 122 | Production QoL (supply block warning, shift+click queue 5) | feat | MED | **ULTRAPLANNED** → Task N4. "SUPPLY BLOCKED" alert + supply flash. Shift+click production = queue 5. |
| 123 | Shift-queue abilities & commands | feat | MED | **ULTRAPLANNED** → Task N5. Extends existing shift-move to attack-move, patrol, abilities. Backlog #102 detailed spec. |
| 124 | Worker saturation display per base | feat | LOW | **ULTRAPLANNED** → Task N6. Show "Workers: 14/16" when CC/Hatchery selected. Color-coded saturation. |
| 126 | Smart rally points (auto-gather, attack-move) | feat | HIGH | **ULTRAPLANNED** → Task N7. Rally to mineral = auto-gather. Rally past enemies = attack-move. Color-coded rally lines. |
| 127 | Auto-gather on base complete | feat | MED | **ULTRAPLANNED** → Task N8. Nearby idle workers auto-mine when CC/Hatchery finishes. Builder SCV auto-gathers. |
| 128 | Watchtower vision mechanic | feat | MED | **ULTRAPLANNED** → Task N9. Xel'Naga towers grant 12-tile fog reveal to controlling faction. Visual faction indicator. |
| 129 | Production idle indicator | feat | MED | **ULTRAPLANNED** → Task N10. HUD "Idle" warning when production buildings empty + player has resources. 3s debounce. |
| 130 | Screen-edge attack indicators | feat | LOW | **ULTRAPLANNED** → Task N11. Red directional arrows at screen edges pointing toward off-screen attacks. 5s fade. |
| 125 | UI Look and Feel Upgrade — Skirmish Mode | polish | HIGH | **ULTRAPLANNED** → `.sdlc/plans/ui-look-and-feel.md` (6 tasks). Design token system, panel frames, button factories, faction-aware theming. |
|    | ↳ T1: Design Token System | polish | — | `src/ui/theme.ts` — centralized colors, fonts, spacing, faction palettes |
|    | ↳ T2: Panel Frame & Button Factories | polish | — | `src/ui/panelFrame.ts`, `src/ui/button.ts` — reusable SC2-style components |
|    | ↳ T3: HUD Renderer Upgrade | polish | — | Apply theme + panel frame to resource HUD |
|    | ↳ T4: Info Panel Overhaul | polish | — | Apply theme + panel frame + buttons to command card (largest task) |
|    | ↳ T5: Build Menu, Control Groups & Minimap | polish | — | Apply theme to remaining panels |
|    | ↳ T6: Alerts, Mode Indicator & Game Over | polish | — | Theme + entrance animations for overlays |
| 131 | Map Visual Overhaul — Carbot-Inspired Vibrant Terrain | polish | HIGH | **ULTRAPLANNED** → `.sdlc/plans/map-visual-overhaul.md` (10 tasks). Procedural texture pipeline (Canvas 2D → PixiJS Texture), bright Carbot-style palette, Sprite-based tilemap, elevation/cliff overhaul, mineral/gas glow, animated water, organic creep edges, terrain decorations, auto-tiling transitions. |
|    | ↳ T1: Color Palette Module | polish | — | Centralized bright terrain palette + neighbor mask utility |
|    | ↳ T2: Texture Generation System | polish | — | Canvas 2D → PixiJS Texture pipeline for all tile types |
|    | ↳ T3: TilemapRenderer Switchover | polish | — | Graphics → Sprites with viewport culling |
|    | ↳ T4: Elevation & Cliff Overhaul | polish | — | Visible cliff faces, shadows, directional ramp indicators |
|    | ↳ T5: Mineral & Gas Visual Upgrade | polish | — | Bright crystals, glow aura, pulsing gas vents |
|    | ↳ T6: Water Overhaul | polish | — | Bright animated water, shore foam, depth variation |
|    | ↳ T7: Creep Visual Upgrade | polish | — | Vibrant purple with organic blobby edges |
|    | ↳ T8: Map Decoration System | polish | — | Scattered rocks, grass clumps, pebbles on ground |
|    | ↳ T9: Auto-Tiling Transitions | polish | — | Smooth terrain blending via bitmask tile selection |
|    | ↳ T10: Minimap Sync + Performance Pass | polish | — | Color sync, creep on minimap, sprite count audit |
| 93 | Recreate iconic SC2 LotV ladder map | feat | MED | Faithful recreation of a famous competitive map. |
| 94 | Advanced AI Commander — Zerg AI Overhaul | feat | HIGH | **ULTRAPLANNED** → `.sdlc/plans/enemy-ai-overhaul.md` (7 tasks). Build order engine with 5 SC2-style Zerg profiles, production/economy fix, composition targeting, attack intelligence, Queen inject management, time-gated building schedule, difficulty rebalance. |
|    | ↳ T1: Build Order Engine + 5 Zerg Profiles | feat | — | Replace 3-step build orders with 15-25 step SC2-style sequences |
|    | ↳ T2: Production & Economy Fix | feat | — | Larva priority, supply management, APM cost rebalance |
|    | ↳ T3: Army Composition Targeting | feat | — | Replace weighted random with ratio-based composition goals |
|    | ↳ T4: Attack Intelligence & Wave System | feat | — | Time-based phases, composition readiness, proper wave sizing |
|    | ↳ T5: Queen & Inject Management | feat | — | Dedicated queen roster, auto-inject, keep home |
|    | ↳ T6: Building Schedule Overhaul | feat | — | Time-gated buildings, Spawning Pool first, multi-expansion |
|    | ↳ T7: Difficulty Scaling Pass | feat | — | Retune APM, delays, profiles, income per difficulty |

## Completed
All previous Tier 0/1/2 sprints shipped. See PROGRESS.md history.
| # | Title | Type | Completed | Commit |
|---|-------|------|-----------|--------|
| 131 | Map Visual Overhaul — Carbot-Inspired Vibrant Terrain | polish | 2026-04-05 | 0e1e73d |
| — | SC2 mechanics parity: repair, snipe, transfuse, overkill, depot lower | feat | 2026-04-04 | 532245c |
| — | Zerg faction fix, building system SC2 alignment, production UI overhaul | fix | 2026-04-04 | 0948882 |
| 92 | Continue unit visual polish — remaining Terran/Zerg animations | feat | 2026-04-04 | N/A (already done) |
| 91 | Improve terrain visuals — detailed, smoother textures + elevation | feat | 2026-04-04 | 021f7ff |
| 90 | Apply SC2 audit corrections from AUDIT_CORRECTIONS.md | fix | 2026-04-02 | 1ddc359 |
