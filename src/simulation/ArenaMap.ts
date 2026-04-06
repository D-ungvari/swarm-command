/**
 * ArenaMap — Map generation for multiplayer .io arena.
 *
 * Generates maps with:
 * - Player spawn zones around the perimeter
 * - Contested resource nodes between spawn zones
 * - 1-2 starter nodes per player (pre-claimed)
 * - Neutral nodes in the center worth fighting over
 */

// ─── Spawn Positions ─────────────────────────────────────────────────────

export interface SpawnPosition {
  col: number;
  row: number;
  /** Nearby resource node positions assigned to this spawn */
  starterNodes: Array<{ col: number; row: number; type: 'mineral' | 'gas' }>;
}

/**
 * Generate spawn positions for N players on a map.
 * Distributes players evenly around the map perimeter.
 */
export function generateSpawnPositions(
  mapCols: number,
  mapRows: number,
  playerCount: number,
): SpawnPosition[] {
  const positions: SpawnPosition[] = [];
  const margin = 12; // tiles from edge
  const cx = mapCols / 2;
  const cy = mapRows / 2;
  const rx = cx - margin; // horizontal radius
  const ry = cy - margin; // vertical radius

  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    const col = Math.round(cx + rx * Math.cos(angle));
    const row = Math.round(cy + ry * Math.sin(angle));

    // Place 2 starter mineral nodes near the spawn
    const nodeAngle1 = angle + 0.3;
    const nodeAngle2 = angle - 0.3;
    const nodeRadius = 8; // tiles from spawn

    positions.push({
      col,
      row,
      starterNodes: [
        {
          col: Math.round(col + nodeRadius * Math.cos(nodeAngle1)),
          row: Math.round(row + nodeRadius * Math.sin(nodeAngle1)),
          type: 'mineral',
        },
        {
          col: Math.round(col + nodeRadius * Math.cos(nodeAngle2)),
          row: Math.round(row + nodeRadius * Math.sin(nodeAngle2)),
          type: 'mineral',
        },
      ],
    });
  }

  return positions;
}

/**
 * Generate contested resource nodes in the center and between players.
 * These are unclaimed — players must build extractors to claim them.
 */
export function generateContestedNodes(
  mapCols: number,
  mapRows: number,
  playerCount: number,
  totalNodes: number = 20,
): Array<{ col: number; row: number; type: 'mineral' | 'gas' }> {
  const nodes: Array<{ col: number; row: number; type: 'mineral' | 'gas' }> = [];
  const cx = mapCols / 2;
  const cy = mapRows / 2;

  // Center cluster (3-5 nodes)
  const centerNodes = Math.min(5, Math.max(3, Math.floor(totalNodes * 0.25)));
  for (let i = 0; i < centerNodes; i++) {
    const angle = (2 * Math.PI * i) / centerNodes;
    const r = 6 + (i % 2) * 4;
    nodes.push({
      col: Math.round(cx + r * Math.cos(angle)),
      row: Math.round(cy + r * Math.sin(angle)),
      type: i < centerNodes - 1 ? 'mineral' : 'gas',
    });
  }

  // Ring nodes between players (halfway between spawn and center)
  const ringNodes = totalNodes - centerNodes;
  for (let i = 0; i < ringNodes; i++) {
    const angle = (2 * Math.PI * i) / ringNodes + Math.PI / ringNodes;
    const r = Math.min(cx, cy) * 0.5;
    nodes.push({
      col: Math.round(cx + r * Math.cos(angle)),
      row: Math.round(cy + r * Math.sin(angle)),
      type: i % 3 === 0 ? 'gas' : 'mineral',
    });
  }

  return nodes;
}
