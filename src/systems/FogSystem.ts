import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, BUILDING,
  posX, posY, faction, hpCurrent,
  atkRange, isAir,
} from '../ecs/components';
import { MAP_COLS, MAP_ROWS, TILE_SIZE, Faction, activePlayerFaction } from '../constants';
import type { MapData } from '../map/MapData';

/** Fog states: 0 = unexplored (black), 1 = explored but not visible (dark), 2 = currently visible */
export const FOG_UNEXPLORED = 0;
export const FOG_EXPLORED = 1;
export const FOG_VISIBLE = 2;

/** Tile-based fog grid (128x128), one byte per tile */
export const fogGrid = new Uint8Array(MAP_COLS * MAP_ROWS);

/** Dirty flag — set to true when fog changes, cleared by renderer after redraw */
export let fogDirty = true;
export function clearFogDirty(): void { fogDirty = false; }

/** Whether fogSystem has run at least once. Before first run, all tiles are treated as visible. */
let fogInitialized = false;

/** Tick counter for throttled updates */
let fogTickCounter = 0;
const FOG_UPDATE_INTERVAL = 10; // update every 10 ticks

/** Reset fog state between games */
export function resetFogSystem(): void {
  fogGrid.fill(FOG_UNEXPLORED);
  fogInitialized = false;
  fogTickCounter = 0;
  fogDirty = true;
}

/**
 * Updates the fog-of-war visibility grid based on Terran unit/building positions.
 * Call once per tick, but internally throttles to every FOG_UPDATE_INTERVAL ticks.
 */
export function fogSystem(world: World, map?: MapData): void {
  fogTickCounter++;
  if (fogTickCounter < FOG_UPDATE_INTERVAL) return;
  fogTickCounter = 0;
  fogInitialized = true;

  let changed = false;

  // Reset all VISIBLE (2) tiles to EXPLORED (1)
  for (let i = 0, len = fogGrid.length; i < len; i++) {
    if (fogGrid[i] === FOG_VISIBLE) {
      fogGrid[i] = FOG_EXPLORED;
      changed = true;
    }
  }

  // For each Terran entity with POSITION, mark tiles within sight range as VISIBLE
  const posBit = POSITION;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, posBit)) continue;
    if (faction[eid] !== activePlayerFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    // Calculate sight range: atkRange / TILE_SIZE + 2, clamped [5, 12]
    // Buildings get +2 extra sight
    const isBuilding = hasComponents(world, eid, BUILDING);
    const baseRange = atkRange[eid] / TILE_SIZE + 2;
    const bonus = isBuilding ? 2 : 0;
    const sightRange = Math.max(5, Math.min(12, baseRange + bonus));
    const sightRangeSq = sightRange * sightRange;

    // Convert world pos to tile
    const centerCol = Math.floor(posX[eid] / TILE_SIZE);
    const centerRow = Math.floor(posY[eid] / TILE_SIZE);

    // Mark a square of tiles, filter by circle
    const minCol = Math.max(0, centerCol - Math.ceil(sightRange));
    const maxCol = Math.min(MAP_COLS - 1, centerCol + Math.ceil(sightRange));
    const minRow = Math.max(0, centerRow - Math.ceil(sightRange));
    const maxRow = Math.min(MAP_ROWS - 1, centerRow + Math.ceil(sightRange));

    // Elevation of the unit's tile (0=low, 1=high, 2=ramp)
    const unitElev = map ? map.elevation[centerRow * MAP_COLS + centerCol] : 0;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const dc = c - centerCol;
        const dr = r - centerRow;
        const distSq = dc * dc + dr * dr;
        if (distSq <= sightRangeSq) {
          // SC2-style elevation vision: low-ground units can't see high ground beyond adjacent tiles
          if (map && unitElev === 0) {
            const tileElev = map.elevation[r * MAP_COLS + c];
            if (tileElev === 1 && distSq > 2.25) continue; // >1.5 tiles away
          }
          const idx = r * MAP_COLS + c;
          if (fogGrid[idx] !== FOG_VISIBLE) {
            fogGrid[idx] = FOG_VISIBLE;
            changed = true;
          }
        }
      }
    }
  }

  // Watchtower vision: grant 12-tile reveal to the faction controlling each tower
  if (map && map.watchtowerPositions) {
    const TOWER_SIGHT = 12;
    const TOWER_SIGHT_SQ = TOWER_SIGHT * TOWER_SIGHT;
    const TOWER_CONTROL_RANGE_SQ = 2.25; // 1.5 tiles squared

    for (const tower of map.watchtowerPositions) {
      // Determine controlling faction: ground unit within 1.5 tiles of center
      let controlFaction = 0;
      let contested = false;
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, POSITION)) continue;
        if (hpCurrent[eid] <= 0) continue;
        if (faction[eid] === 0) continue;
        if (isAir[eid] === 1) continue; // Air units don't control towers
        const dc = posX[eid] / TILE_SIZE - tower.col;
        const dr = posY[eid] / TILE_SIZE - tower.row;
        if (dc * dc + dr * dr > TOWER_CONTROL_RANGE_SQ) continue;
        if (controlFaction === 0) {
          controlFaction = faction[eid];
        } else if (controlFaction !== faction[eid]) {
          contested = true;
          break;
        }
      }
      // Contested or no controller: no vision
      if (contested || controlFaction === 0) continue;
      // Only grant fog reveal for the player's faction
      if (controlFaction !== activePlayerFaction) continue;

      // Reveal tiles in 12-tile radius around tower
      const minCol = Math.max(0, tower.col - TOWER_SIGHT);
      const maxCol = Math.min(MAP_COLS - 1, tower.col + TOWER_SIGHT);
      const minRow = Math.max(0, tower.row - TOWER_SIGHT);
      const maxRow = Math.min(MAP_ROWS - 1, tower.row + TOWER_SIGHT);
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          const dc = c - tower.col;
          const dr = r - tower.row;
          if (dc * dc + dr * dr <= TOWER_SIGHT_SQ) {
            const idx = r * MAP_COLS + c;
            if (fogGrid[idx] !== FOG_VISIBLE) {
              fogGrid[idx] = FOG_VISIBLE;
              changed = true;
            }
          }
        }
      }
    }
  }

  if (changed) {
    fogDirty = true;
  }
}

/**
 * Check if a world-space position is currently visible to the Terran player.
 * Returns true if fog hasn't been initialized yet (before first fogSystem call).
 */
export function isTileVisible(worldX: number, worldY: number): boolean {
  if (!fogInitialized) return true;
  const col = Math.floor(worldX / TILE_SIZE);
  const row = Math.floor(worldY / TILE_SIZE);
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
  return fogGrid[row * MAP_COLS + col] === FOG_VISIBLE;
}

/**
 * Check if a tile has been explored (visible or previously seen).
 */
export function isTileExplored(worldX: number, worldY: number): boolean {
  const col = Math.floor(worldX / TILE_SIZE);
  const row = Math.floor(worldY / TILE_SIZE);
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) return false;
  return fogGrid[row * MAP_COLS + col] >= FOG_EXPLORED;
}
