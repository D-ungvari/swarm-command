# Backlog

## Up Next — rts.io Pivot (target repo: D-ungvari/rts.io)

Full ultraplan: `.sdlc/plans/full-backlog-expansion.md` (17 tasks)

| # | Title | Type | Priority | Phase | Notes |
|---|-------|------|----------|-------|-------|
| T1 | Data-driven ability framework | feat | CRITICAL | A | AbilityDef type, UNIT_ABILITIES mapping, generic AbilitySystem |
| T2 | Combat system rework — generic armor/damage | feat | CRITICAL | A | ArmorTag bitfield, simplified targeting, no SC2 unit-specific code |
| T3 | Production + node economy wiring | feat | CRITICAL | A | 3-slot queue, extractor income, kill bounties, supply from HQ tier |
| T4 | Upgrade system — per-faction trees | feat | HIGH | A | ~5 upgrades per faction, data-driven |
| T5 | Faction rendering (4 factions × 8 units) | feat | CRITICAL | A | Procedural geometric shapes, 4 palettes, 32 portraits |
| T6 | UI rebuild — arena HUD, build menu, info panel | feat | HIGH | A | Minerals/income/nodes/kills HUD, faction select UI |
| T7 | Arena gameplay integration — playable locally | feat | CRITICAL | A | Wire all systems, simple AI, full local game loop |
| T8 | Client-server wiring — WebSocket commands + snapshots | feat | CRITICAL | B | Authoritative server at 20Hz, client renders snapshots |
| T9 | Client interpolation + per-player fog culling | feat | HIGH | B | Snapshot buffering, entity lerp, anti-cheat fog |
| T10 | Match lifecycle — lobby, countdown, play, victory | feat | HIGH | C | Room states, faction select, victory conditions |
| T11 | Multi-player spawning + faction selection | feat | HIGH | C | 8-16 player support, balanced spawns |
| T12 | Elimination + scoring + kill bounties | feat | HIGH | C | Permanent elimination, live scoring, bounty economy |
| T13 | Iron Legion abilities | feat | MED | D | Stim, Siege Mode, Medic Heal, Transport Boost |
| T14 | Swarm abilities | feat | MED | D | Brood Spawn, Burrow, Corrosive Bile, Acid Spray |
| T15 | Arcane Covenant abilities | feat | MED | D | Shield Burst, Blink, Arcane Storm, Force Wall |
| T16 | Automata abilities | feat | MED | D | Self-Repair, Wreckage Reclaim, EMP, Anchor Mode |
| T17 | Kill feed, leaderboard, announcements | feat | MED | E | .io social layer |

## Parked — Swarm Command SC2 Features (deprioritized)

These are valid features for the SC2 practice tool but not on the critical path.

| # | Title | Type | Priority | Notes |
|---|-------|------|----------|-------|
| 95 | Bunker building + unit loading | feat | PARKED | Terran Bunker: 400 HP, 100 minerals, 2x2. |
| 96 | Protoss faction — core units + buildings | feat | PARKED | Shields, pylon power, warp-in. |
| 97 | MULE / Orbital Command | feat | PARKED | CC upgrades to Orbital Command. |
| 98 | Addon attach/detach system | feat | PARKED | Tech Lab/Reactor addons with lift/land. |
| 99 | Queen Creep Tumor ability | feat | PARKED | Creep Tumor + child tumors. |
| 100 | Multi-SCV speed build | feat | PARKED | Additional SCVs assist construction. |
| 101 | Viper Abduct polish | feat | PARKED | Abduct animation polish. |
| 93 | Recreate iconic SC2 LotV ladder map | feat | PARKED | Famous competitive map recreation. |

## Completed
All previous Tier 0/1/2 sprints shipped. All ultraplans implemented.
| # | Title | Type | Completed | Commit |
|---|-------|------|-----------|--------|
| 125 | UI Look and Feel Upgrade — Skirmish Mode (6 tasks) | polish | 2026-04-06 | 97acb98 |
| 131 | Map Visual Overhaul — Carbot-Inspired Vibrant Terrain (10 tasks) | polish | 2026-04-05 | 0e1e73d |
| 132 | Unit & Building Visual Overhaul — Carbot Palette Alignment (8 tasks) | polish | 2026-04-05 | cafa39a |
| 119-130 | Gameplay Loop Improvements (11 tasks: N1-N11) | feat | 2026-04-05 | a33c003 |
| 103-118 | SC2 Skirmish Audit (16 tasks) | fix/feat | 2026-04-05 | 6d2b076 |
| 94 | Advanced AI Commander — Zerg AI Overhaul (7 tasks) | feat | 2026-04-04 | 8c8d77f |
| — | AI Resilience & Cohesion (3 tasks) | feat | 2026-04-05 | 19e34c5 |
| — | Unit Commanding Sophistication | fix | 2026-04-04 | 11a1151 |
| — | SC2 mechanics parity: repair, snipe, transfuse, overkill, depot lower | feat | 2026-04-04 | 532245c |
| — | Zerg faction fix, building system SC2 alignment, production UI overhaul | fix | 2026-04-04 | 0948882 |
| 92 | Continue unit visual polish — remaining Terran/Zerg animations | feat | 2026-04-04 | N/A |
| 91 | Improve terrain visuals — detailed, smoother textures + elevation | feat | 2026-04-04 | 021f7ff |
| 90 | Apply SC2 audit corrections from AUDIT_CORRECTIONS.md | fix | 2026-04-02 | 1ddc359 |
