import PF from 'pathfinding';
import { type MapData, setPathfinderInvalidator } from './MapData';

let cachedGrid: PF.Grid | null = null;
let cachedMap: MapData | null = null;

// Register cache invalidation callback with MapData
setPathfinderInvalidator(() => {
  cachedGrid = null;
  cachedMap = null;
});
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
  const path = rawPath.slice(1) as Array<[number, number]>;
  return smoothPath(path, map);
}

/** Remove redundant waypoints by checking line-of-sight between non-adjacent points */
function smoothPath(path: Array<[number, number]>, map: MapData): Array<[number, number]> {
  if (path.length < 3) return path;
  const result: Array<[number, number]> = [path[0]];
  let anchor = 0;

  while (anchor < path.length - 1) {
    let furthest = anchor + 1;
    // Find furthest waypoint we can reach in a straight line
    for (let test = anchor + 2; test < path.length; test++) {
      if (hasLineOfSight(path[anchor], path[test], map)) {
        furthest = test;
      } else {
        break;
      }
    }
    result.push(path[furthest]);
    anchor = furthest;
  }
  return result;
}

/** Check if a straight line between two tile coords is walkable */
function hasLineOfSight(a: [number, number], b: [number, number], map: MapData): boolean {
  // Bresenham-style line check
  let [x0, y0] = a;
  let [x1, y1] = b;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 < 0 || x0 >= map.cols || y0 < 0 || y0 >= map.rows) return false;
    if (map.walkable[y0 * map.cols + x0] !== 1) return false;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return true;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
