# Backlog

## Up Next

| # | Title | Type | Priority | Notes |
|---|-------|------|----------|-------|
| 91 | Improve terrain visuals — detailed, smoother textures + elevation | feat | HIGH | Replace flat tile colors with richer terrain rendering: grass/dirt variation, rock textures, water with animated waves, smooth tile transitions (no hard grid edges), subtle noise/detail per tile type. Add elevation system with ramps — high/low ground tiles with visual height difference (parallax shading, cliff edges). SC2-style high ground gives vision advantage. Ramps connect elevation levels. |
| 92 | Continue unit visual polish — remaining Terran/Zerg animations | feat | MED | Thor walking, Viking transform, Ultralisk charge, Corruptor hover, etc. |
| 93 | Recreate iconic SC2 LotV ladder map | feat | HIGH | Faithful recreation of a famous competitive map (e.g. Eternal Empire, King's Cove, or Catalyst). True-to-scale with correct: natural expansion locations, ramp/choke positions, Xel'Naga towers, destructible rocks, mineral lines, gas geysers, high/low ground elevation, island expansions if applicable. Use SC2 Liquipedia map images as reference for layout accuracy. Start with one map, add more as a map pool. |
| 94 | Advanced AI Commander — strategy profiles, build orders, tactics | feat | HIGH | Overhaul AISystem with multiple strategy profiles: (1) Timing attack — scripted build order into specific timing push (e.g. 2-base Roach timing, 6-pool Zergling rush, macro Hydra/Lurker). (2) Macro play — expand, tech up, build army, attack when maxed. (3) Cheese/rush — all-in early aggression. (4) Harassment — Mutalisk/Baneling run-bys while teching. Each profile has: scripted build order → unit composition target → attack triggers (supply count, tech timing, enemy scout). AI should scout, react to player composition, and choose counter-strategies. Iterate over many sessions — start with 3-4 profiles, expand to 8-10. |

## Completed
All previous Tier 0/1/2 sprints shipped. See PROGRESS.md history.
| # | Title | Type | Completed | Commit |
|---|-------|------|-----------|--------|
| 90 | Apply SC2 audit corrections from AUDIT_CORRECTIONS.md | fix | 2026-04-02 | 1ddc359 |
