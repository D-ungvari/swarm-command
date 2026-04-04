# Log: Improve terrain visuals — detailed, smoother textures + elevation
Started: 2026-04-04T00:00:00Z

## PLAN

### Phase 1: Elevation Data Layer
1. Add `elevation: Uint8Array` to MapData interface + generateMap()
2. Populate elevation data in all 10 map generators via markBaseElevation/placeWatchtower helpers
3. Add elevation-aware utility functions (getElevation, isOnHighGround, isRampTile)

### Phase 2: Terrain Rendering Upgrade
4. Extract tile-transition blending helper into TilemapRenderer
5. Enhance ground tile rendering with terrain sub-variation (biome variants, more detail)
6. Add elevation visual shading (brightness overlay, cliff shadow edges)
7. Improve water rendering with shoreline and depth
8. Enhance unbuildable cliff and destructible rock rendering
9. Reduce grid line visibility, add transition polish

### Phase 3: Gameplay — Elevation Vision Advantage
10. Integrate elevation into fog of war system
11. Update minimap to show elevation tinting
12. Add elevation-based combat visibility (via fog, no extra combat code needed)

### Key Edge Cases
- Ramp tile type overloaded: decoration vs real ramp disambiguated by elevation array
- Base interior must be elevation=1 (not just perimeter)
- Water tiles always elevation=0
- Pathfinding unaffected (uses walkable[], not elevation)
- Test helpers need elevation array added

## DEV
### Step 1-3: Elevation data layer
- Files: src/map/MapData.ts, src/Game.ts, tests/helpers.ts
- Result: done
- Notes: Added elevation Uint8Array to MapData, threaded through all 10 generators, updated markBaseElevation (interior=1, perimeter=2), placeWatchtower, placeRampTiles. Added getElevation/getElevationAtWorld utilities.

### Step 4-9: Terrain rendering upgrade
- Files: src/rendering/TilemapRenderer.ts
- Result: done
- Notes: Tile transitions (drawTransitions), ground sub-variants (grass/dirt/mixed), elevation shading (high-ground brightness, ramp gradient), cliff shadow edges (drawElevationEdges), water shoreline, unbuildable bevel, grid alpha reduced.

### Step 10-12: Elevation gameplay
- Files: src/systems/FogSystem.ts, src/Game.ts, src/rendering/MinimapRenderer.ts
- Result: done
- Notes: FogSystem accepts optional MapData; low-ground units can't see high-ground beyond 1.5 tiles. Minimap brightens high-ground tiles.

## TEST
- Run: npx vitest run
- Result: PASS
- Output: 17 test files, 214 tests, all passing
- Fix attempts: 0

## REVIEW
- Result: APPROVED
- Feedback: Minor nit about empty if-block in drawTransitions (fixed). Pre-existing createTestMap missing fields (fixed).
- Fix rounds: 1

## COMMIT
- Hash: 021f7ff
- Message: feat: terrain visuals upgrade — elevation system, tile transitions, fog vision
- Files: src/map/MapData.ts, src/rendering/TilemapRenderer.ts, src/rendering/MinimapRenderer.ts, src/systems/FogSystem.ts, src/Game.ts, tests/helpers.ts, tests/map/elevation.test.ts, tests/systems/FogElevation.test.ts, .sdlc/PROGRESS.md, .sdlc/log/012-terrain-visuals.md
- Timestamp: 2026-04-04
