# Backlog

## Up Next

| # | Title | Type | Priority | Notes |
|---|-------|------|----------|-------|
| 95 | Bunker building + unit loading | feat | HIGH | Terran Bunker: 400 HP, 100 minerals, 2x2. Load up to 4 Marines (or 2 Marauders). Loaded units fire from inside with +1 range. Salvage for 75% refund. Hotkey to load/unload. |
| 96 | Protoss faction — core units + buildings | feat | HIGH | Shields, pylon power, warp-in. Buildings: Nexus, Pylon, Gateway, Cybernetics Core, Robotics Facility, Stargate, Twilight Council. Units: Probe, Zealot, Stalker, Sentry, Immortal, Colossus, Phoenix, Void Ray, High Templar (Psi Storm), Dark Templar, Observer. Photon Overcharge. |
| 97 | MULE / Orbital Command | feat | MED | CC upgrades to Orbital Command (150 minerals). Abilities: Call Down MULE (accelerated mining, 90s duration), Scanner Sweep (temporary vision), Extra Supplies (+8 supply to depot). |
| 98 | Addon attach/detach system | feat | MED | Barracks/Factory/Starport can build Tech Lab or Reactor addon. Tech Lab unlocks advanced units from that building. Reactor allows double production. Addons can be swapped by lifting building. |
| 99 | Queen Creep Tumor ability | feat | MED | Queen places Creep Tumor on creep (25 energy). Tumors spread creep autonomously in a radius. Can spawn one child tumor before expiring. Zerg units get +30% move speed on creep. |
| 100 | Multi-SCV speed build | feat | MED | Additional SCVs can assist construction, each adding repair-rate progress. Max 3 SCVs per building. Costs additional minerals proportional to repair rate. |
| 101 | Viper Abduct polish | feat | LOW | Abduct pulls target unit to Viper's location. Animation: tentacle lash, target slides to Viper. Range 9. Cost 75 energy. |
| 102 | Shift-queue abilities | feat | LOW | Hold Shift while issuing commands to queue them. Units execute queued commands in order. Works for move, attack-move, patrol, abilities. |
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
| — | SC2 mechanics parity: repair, snipe, transfuse, overkill, depot lower | feat | 2026-04-04 | 532245c |
| — | Zerg faction fix, building system SC2 alignment, production UI overhaul | fix | 2026-04-04 | 0948882 |
| 92 | Continue unit visual polish — remaining Terran/Zerg animations | feat | 2026-04-04 | N/A (already done) |
| 91 | Improve terrain visuals — detailed, smoother textures + elevation | feat | 2026-04-04 | 021f7ff |
| 90 | Apply SC2 audit corrections from AUDIT_CORRECTIONS.md | fix | 2026-04-02 | 1ddc359 |
