/**
 * ArenaMap — Map layout generation for multiplayer .io arena.
 *
 * Layout:
 * - Players spawn around the perimeter (evenly spaced)
 * - Resource zones scattered from edge to center
 * - Edge zones: low value (~50/min), safe near spawns
 * - Center zones: high value (~250/min), heavily contested
 * - 70% mineral zones, 30% gas zones
 * - Each player gets 2 starter zones pre-captured near their base
 */

// ─── Spawn Positions ─────────────────────────────────────────────────────

export interface SpawnPosition {
  col: number;
  row: number;
  /** Starter zones assigned to this spawn (pre-captured) */
  starterZones: Array<{ col: number; row: number; type: 'mineral' | 'gas' }>;
}

/**
 * Generate spawn positions for N players around the map perimeter.
 * Each player gets 2 nearby starter zones (1 mineral, 1 mineral — or 1 mineral + 1 gas).
 */
export function generateSpawnPositions(
  mapCols: number,
  mapRows: number,
  playerCount: number,
): SpawnPosition[] {
  const positions: SpawnPosition[] = [];
  const margin = 12;
  const cx = mapCols / 2;
  const cy = mapRows / 2;
  const rx = cx - margin;
  const ry = cy - margin;

  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    const col = Math.round(cx + rx * Math.cos(angle));
    const row = Math.round(cy + ry * Math.sin(angle));

    // 2 starter zones offset from spawn toward center
    const inwardAngle = angle + Math.PI; // toward center
    const nodeOffset = 8;

    positions.push({
      col,
      row,
      starterZones: [
        {
          col: Math.round(col + nodeOffset * Math.cos(inwardAngle + 0.4)),
          row: Math.round(row + nodeOffset * Math.sin(inwardAngle + 0.4)),
          type: 'mineral',
        },
        {
          col: Math.round(col + nodeOffset * Math.cos(inwardAngle - 0.4)),
          row: Math.round(row + nodeOffset * Math.sin(inwardAngle - 0.4)),
          type: 'mineral',
        },
      ],
    });
  }

  return positions;
}

// ─── Contested Zone Generation ───────────────────────────────────────────

export interface ZonePlacement {
  col: number;
  row: number;
  type: 'mineral' | 'gas';
}

/**
 * Generate contested resource zones across the map.
 * Zones are distributed in rings from center outward.
 * 70% mineral, 30% gas.
 *
 * @param mapCols Map width in tiles
 * @param mapRows Map height in tiles
 * @param totalZones Total contested zones (excludes starter zones)
 * @param seed Simple seed for deterministic placement
 */
export function generateContestedZones(
  mapCols: number,
  mapRows: number,
  totalZones: number = 20,
  seed: number = 42,
): ZonePlacement[] {
  const zones: ZonePlacement[] = [];
  const cx = mapCols / 2;
  const cy = mapRows / 2;
  const maxRadius = Math.min(cx, cy) - 16; // Stay away from map edges

  // Simple seeded random
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s >>> 0) / 4294967296; };

  // Distribute zones in 3 rings: center (30%), mid (40%), outer (30%)
  const centerCount = Math.round(totalZones * 0.3);
  const midCount = Math.round(totalZones * 0.4);
  const outerCount = totalZones - centerCount - midCount;

  const rings = [
    { count: centerCount, minR: 0, maxR: maxRadius * 0.3 },
    { count: midCount, minR: maxRadius * 0.3, maxR: maxRadius * 0.65 },
    { count: outerCount, minR: maxRadius * 0.65, maxR: maxRadius * 0.9 },
  ];

  let mineralBudget = Math.round(totalZones * 0.7);
  let gasBudget = totalZones - mineralBudget;

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (2 * Math.PI * i) / ring.count + rand() * 0.5;
      const r = ring.minR + rand() * (ring.maxR - ring.minR);

      const col = Math.round(cx + r * Math.cos(angle));
      const row = Math.round(cy + r * Math.sin(angle));

      // Clamp to map bounds
      const clampedCol = Math.max(4, Math.min(mapCols - 4, col));
      const clampedRow = Math.max(4, Math.min(mapRows - 4, row));

      // 70/30 mineral/gas split
      let type: 'mineral' | 'gas';
      if (gasBudget > 0 && (mineralBudget <= 0 || rand() < 0.3)) {
        type = 'gas';
        gasBudget--;
      } else {
        type = 'mineral';
        mineralBudget--;
      }

      zones.push({ col: clampedCol, row: clampedRow, type });
    }
  }

  return zones;
}

/**
 * Generate the full arena zone layout: starter zones + contested zones.
 * Returns all zone placements with ownership info.
 */
export function generateArenaLayout(
  mapCols: number,
  mapRows: number,
  playerCount: number,
  contestedZoneCount: number = 20,
  seed: number = 42,
): {
  spawns: SpawnPosition[];
  contestedZones: ZonePlacement[];
  totalZones: number;
} {
  const spawns = generateSpawnPositions(mapCols, mapRows, playerCount);
  const contestedZones = generateContestedZones(mapCols, mapRows, contestedZoneCount, seed);

  const starterZoneCount = spawns.reduce((sum, s) => sum + s.starterZones.length, 0);

  return {
    spawns,
    contestedZones,
    totalZones: starterZoneCount + contestedZones.length,
  };
}
