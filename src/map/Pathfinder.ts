import PF from 'pathfinding';
import type { MapData } from './MapData';

let cachedGrid: PF.Grid | null = null;
let cachedMap: MapData | null = null;
const finder = new PF.AStarFinder({
  allowDiagonal: true,
  dontCrossCorners: true,
});

/**
 * Find a path from (startCol, startRow) to (endCol, endRow).
 * Returns array of [col, row] waypoints (excluding start).
 */
export function findPath(
  map: MapData,
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
): Array<[number, number]> {
  // Rebuild grid if map changed
  if (cachedMap !== map) {
    cachedGrid = new PF.Grid(map.cols, map.rows);
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        cachedGrid.setWalkableAt(c, r, map.walkable[r * map.cols + c] === 1);
      }
    }
    cachedMap = map;
  }

  // Clamp to bounds
  startCol = clamp(startCol, 0, map.cols - 1);
  startRow = clamp(startRow, 0, map.rows - 1);
  endCol = clamp(endCol, 0, map.cols - 1);
  endRow = clamp(endRow, 0, map.rows - 1);

  // If start or end is unwalkable, bail
  if (!cachedGrid!.isWalkableAt(startCol, startRow) ||
      !cachedGrid!.isWalkableAt(endCol, endRow)) {
    return [];
  }

  // Clone grid (pathfinding lib mutates it)
  const gridClone = cachedGrid!.clone();
  const rawPath = finder.findPath(startCol, startRow, endCol, endRow, gridClone);

  // Skip the first point (that's where we already are)
  return rawPath.slice(1) as Array<[number, number]>;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
