import { MAP_COLS, MAP_ROWS, TileType, TILE_SIZE } from '../constants';

export interface MapData {
  /** Flat tile grid, row-major. tiles[row * MAP_COLS + col] */
  tiles: Uint8Array;
  /** Walkable grid for pathfinding (1 = walkable, 0 = blocked) */
  walkable: Uint8Array;
  cols: number;
  rows: number;
}

/** Generate a simple symmetric 2-player map */
export function generateMap(): MapData {
  const tiles = new Uint8Array(MAP_COLS * MAP_ROWS);
  const walkable = new Uint8Array(MAP_COLS * MAP_ROWS);

  // Fill with ground (all walkable)
  tiles.fill(TileType.Ground);
  walkable.fill(1);

  // Border walls
  for (let c = 0; c < MAP_COLS; c++) {
    setTile(tiles, walkable, 0, c, TileType.Water);
    setTile(tiles, walkable, MAP_ROWS - 1, c, TileType.Water);
  }
  for (let r = 0; r < MAP_ROWS; r++) {
    setTile(tiles, walkable, r, 0, TileType.Water);
    setTile(tiles, walkable, r, MAP_COLS - 1, TileType.Water);
  }

  // Mineral patches — player 1 (top-left area)
  placeMinerals(tiles, walkable, 10, 10);
  // Mineral patches — player 2 (bottom-right area)
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 14);

  // Natural expansion minerals
  placeMinerals(tiles, walkable, 10, 40);
  placeMinerals(tiles, walkable, MAP_ROWS - 14, MAP_COLS - 44);

  // Gas geysers
  setTile(tiles, walkable, 8, 18, TileType.Gas);
  setTile(tiles, walkable, MAP_ROWS - 10, MAP_COLS - 20, TileType.Gas);

  // Some unbuildable terrain in the middle for tactical interest
  for (let r = 55; r < 73; r++) {
    for (let c = 55; c < 73; c++) {
      if (Math.abs(r - 64) + Math.abs(c - 64) < 10) {
        setTile(tiles, walkable, r, c, TileType.Unbuildable);
      }
    }
  }

  // Water features (small lakes)
  placeWaterPatch(tiles, walkable, 30, 90, 6);
  placeWaterPatch(tiles, walkable, 90, 30, 6);

  return { tiles, walkable, cols: MAP_COLS, rows: MAP_ROWS };
}

function setTile(tiles: Uint8Array, walkable: Uint8Array, row: number, col: number, type: TileType): void {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return;
  const idx = row * MAP_COLS + col;
  tiles[idx] = type;
  walkable[idx] = (type === TileType.Ground || type === TileType.Ramp) ? 1 : 0;
}

function placeMinerals(tiles: Uint8Array, walkable: Uint8Array, startRow: number, startCol: number): void {
  // 8 mineral patches in an arc
  const offsets = [
    [0, 0], [0, 1], [0, 2], [0, 3],
    [1, 0], [1, 1], [1, 2], [1, 3],
  ];
  for (const [dr, dc] of offsets) {
    setTile(tiles, walkable, startRow + dr, startCol + dc, TileType.Minerals);
  }
}

function placeWaterPatch(tiles: Uint8Array, walkable: Uint8Array, centerRow: number, centerCol: number, radius: number): void {
  for (let r = centerRow - radius; r <= centerRow + radius; r++) {
    for (let c = centerCol - radius; c <= centerCol + radius; c++) {
      const dist = Math.sqrt((r - centerRow) ** 2 + (c - centerCol) ** 2);
      if (dist <= radius) {
        setTile(tiles, walkable, r, c, TileType.Water);
      }
    }
  }
}

/** Convert tile (col, row) to world pixel coordinates (center of tile) */
export function tileToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

/** Convert world pixel coordinates to tile (col, row) */
export function worldToTile(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.floor(x / TILE_SIZE),
    row: Math.floor(y / TILE_SIZE),
  };
}

/** Get tile type at world coordinates */
export function getTileAt(map: MapData, x: number, y: number): TileType {
  const { col, row } = worldToTile(x, y);
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return TileType.Water;
  return map.tiles[row * map.cols + col] as TileType;
}

/** Check if a world position is walkable */
export function isWalkable(map: MapData, x: number, y: number): boolean {
  const { col, row } = worldToTile(x, y);
  if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return false;
  return map.walkable[row * map.cols + col] === 1;
}

/** Get all resource tile positions */
export function getResourceTiles(map: MapData): Array<{ col: number; row: number; type: TileType }> {
  const result: Array<{ col: number; row: number; type: TileType }> = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const t = map.tiles[r * map.cols + c] as TileType;
      if (t === TileType.Minerals || t === TileType.Gas) {
        result.push({ col: c, row: r, type: t });
      }
    }
  }
  return result;
}

/** Find nearest walkable tile to a given (possibly unwalkable) tile */
export function findNearestWalkableTile(map: MapData, col: number, row: number): { col: number; row: number } | null {
  if (col >= 0 && col < map.cols && row >= 0 && row < map.rows && map.walkable[row * map.cols + col] === 1) {
    return { col, row };
  }
  // BFS in expanding rings
  for (let radius = 1; radius <= 5; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue; // only check ring
        const r = row + dr;
        const c = col + dc;
        if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) continue;
        if (map.walkable[r * map.cols + c] === 1) return { col: c, row: r };
      }
    }
  }
  return null;
}

/** Check if a building footprint can be placed at (col, row) */
export function isBuildable(map: MapData, col: number, row: number, tileW: number, tileH: number): boolean {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) return false;
      if (map.walkable[r * map.cols + c] !== 1) return false;
      if (map.tiles[r * map.cols + c] !== TileType.Ground) return false;
    }
  }
  return true;
}

/** Mark tiles occupied by a building (unwalkable) */
export function markBuildingTiles(map: MapData, col: number, row: number, tileW: number, tileH: number): void {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c >= 0 && c < map.cols && r >= 0 && r < map.rows) {
        map.walkable[r * map.cols + c] = 0;
      }
    }
  }
  // Invalidate pathfinder cache
  invalidatePathfinderCache();
}

/** Clear tiles occupied by a destroyed building (make walkable again) */
export function clearBuildingTiles(map: MapData, col: number, row: number, tileW: number, tileH: number): void {
  const startCol = col - Math.floor(tileW / 2);
  const startRow = row - Math.floor(tileH / 2);
  for (let r = startRow; r < startRow + tileH; r++) {
    for (let c = startCol; c < startCol + tileW; c++) {
      if (c >= 0 && c < map.cols && r >= 0 && r < map.rows) {
        map.walkable[r * map.cols + c] = 1;
        map.tiles[r * map.cols + c] = TileType.Ground;
      }
    }
  }
  invalidatePathfinderCache();
}

/** Exported callback set by Pathfinder to invalidate its cache */
let invalidatePathfinderCache: () => void = () => {};
export function setPathfinderInvalidator(fn: () => void): void {
  invalidatePathfinderCache = fn;
}
