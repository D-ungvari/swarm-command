# Progress

## Product Vision
**SC2 Mechanics Practice Tool** — true SC2 numbers, browser-based, no install.

## Current Phase
DEVELOP — Backlog #92: Continue unit visual polish

## Working On
**#92 — Continue unit visual polish — remaining Terran/Zerg animations**
Thor walking, Viking transform, Ultralisk charge, Corruptor hover, etc.

## What was completed
Terrain visuals upgrade (commit 021f7ff):
- Elevation data layer (Uint8Array: 0=low, 1=high, 2=ramp) threaded through all 10 maps
- Tile transitions (shoreline, cliff edges), ground sub-variants (grass/dirt/mixed)
- Elevation shading (high-ground brightness, cliff shadows)
- SC2-style fog vision: low-ground can't see high-ground beyond adjacent
- Minimap elevation tinting
- 214 tests passing

## What to do next
Implement backlog #92: remaining unit animations.
