import { posX, posY, POSITION, HEALTH } from './components';
import { hasComponents, type World } from './world';
import { MAP_WIDTH, MAP_HEIGHT } from '../constants';

const CELL_SIZE = 128; // px per cell
const GRID_COLS = Math.ceil(MAP_WIDTH / CELL_SIZE);   // 32
const GRID_ROWS = Math.ceil(MAP_HEIGHT / CELL_SIZE);  // 32
const TOTAL_CELLS = GRID_COLS * GRID_ROWS;            // 1024

export class SpatialHash {
  // Each cell holds a list of entity IDs
  private cells: number[][] = Array.from({ length: TOTAL_CELLS }, () => []);
  // Track last rebuilt world so tests that bypass tick() still get correct results
  private lastWorld: World | null = null;
  private lastNextEid: number = 0;

  /** Rebuild the hash from current world state. Call once per tick before queries. */
  rebuild(world: World): void {
    this._build(world);
  }

  /**
   * Rebuild only if the world or entity count has changed since the last rebuild.
   * Called automatically by query functions so tests that bypass tick() still work.
   */
  ensureBuilt(world: World): void {
    if (this.lastWorld !== world || this.lastNextEid !== world.nextEid) {
      this._build(world);
    }
  }

  private _build(world: World): void {
    this.lastWorld = world;
    this.lastNextEid = world.nextEid;
    // Clear all cells
    for (let i = 0; i < TOTAL_CELLS; i++) {
      this.cells[i].length = 0;
    }
    // Insert all entities with POSITION | HEALTH
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, POSITION | HEALTH)) continue;
      const cell = this.cellFor(posX[eid], posY[eid]);
      if (cell >= 0) this.cells[cell].push(eid);
    }
  }

  /** Get all entity IDs in cells overlapping the given circle. */
  queryRadius(cx: number, cy: number, radius: number): number[] {
    const minCol = Math.max(0, Math.floor((cx - radius) / CELL_SIZE));
    const maxCol = Math.min(GRID_COLS - 1, Math.floor((cx + radius) / CELL_SIZE));
    const minRow = Math.max(0, Math.floor((cy - radius) / CELL_SIZE));
    const maxRow = Math.min(GRID_ROWS - 1, Math.floor((cy + radius) / CELL_SIZE));

    const result: number[] = [];
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cell = row * GRID_COLS + col;
        for (const eid of this.cells[cell]) {
          result.push(eid);
        }
      }
    }
    return result;
  }

  private cellFor(x: number, y: number): number {
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return -1;
    return row * GRID_COLS + col;
  }
}

// Module-level singleton — rebuilt once per tick in Game.ts
export const spatialHash = new SpatialHash();
