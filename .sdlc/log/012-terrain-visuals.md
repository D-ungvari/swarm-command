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
