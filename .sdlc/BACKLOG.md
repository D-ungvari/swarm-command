# Backlog

## Up Next

| # | Title | Type | Priority | Notes |
|---|-------|------|----------|-------|
| 91 | Improve terrain visuals — detailed, smoother textures + elevation | feat | HIGH | Replace flat tile colors with richer terrain rendering: grass/dirt variation, rock textures, water with animated waves, smooth tile transitions (no hard grid edges), subtle noise/detail per tile type. Add elevation system with ramps — high/low ground tiles with visual height difference (parallax shading, cliff edges). SC2-style high ground gives vision advantage. Ramps connect elevation levels. |
| 92 | Continue unit visual polish — remaining Terran/Zerg animations | feat | MED | Thor walking, Viking transform, Ultralisk charge, Corruptor hover, etc. |
| 93 | Recreate iconic SC2 LotV ladder map | feat | HIGH | Faithful recreation of a famous competitive map (e.g. Eternal Empire, King's Cove, or Catalyst). True-to-scale with correct: natural expansion locations, ramp/choke positions, Xel'Naga towers, destructible rocks, mineral lines, gas geysers, high/low ground elevation, island expansions if applicable. Use SC2 Liquipedia map images as reference for layout accuracy. Start with one map, add more as a map pool. |
| 94 | Advanced AI Commander — fair play, strategy profiles, build orders | feat | HIGH | **CRITICAL RULE: AI plays by the same rules as the player.** No free units, no bonus minerals, no instant spawns. AI must: build workers, mine resources, construct buildings, train units from buildings, respect supply cap, research upgrades — exactly like a human player. The current wave-based spawning system must be replaced entirely. Implementation: (1) AI controls a mirror base setup (Hatchery + Drones at game start). (2) AI executes scripted build orders step-by-step: "at 13 supply build Pool, at 16 supply build 3 Zerglings, at 21 supply expand" etc. (3) Strategy profiles: Zergling rush (6-pool), Roach timing (2-base), macro Hydra/Lurker, Mutalisk harassment. (4) AI issues commands to its units the same way a player does — move, attack-move, rally points. (5) Difficulty scales by: APM/reaction speed, build order tightness, multi-tasking quality — NOT by cheating resources. Iterate over many sessions — start with 1-2 basic build orders, expand to 8-10 with reactive scouting. |

## Completed
All previous Tier 0/1/2 sprints shipped. See PROGRESS.md history.
| # | Title | Type | Completed | Commit |
|---|-------|------|-----------|--------|
| 90 | Apply SC2 audit corrections from AUDIT_CORRECTIONS.md | fix | 2026-04-02 | 1ddc359 |
