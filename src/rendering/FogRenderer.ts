import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../constants';
import { fogGrid, fogDirty, clearFogDirty, FOG_UNEXPLORED, FOG_EXPLORED } from '../systems/FogSystem';

/**
 * Renders fog of war as a Graphics overlay in world space.
 * Culls to viewport bounds for performance.
 * Only redraws when the fog grid changes (dirty flag).
 */
export class FogRenderer {
  container: Container;
  private graphics: Graphics;
  private viewport: Viewport;
  /** Cache last viewport bounds to detect camera movement */
  private lastLeft = -1;
  private lastTop = -1;
  private lastRight = -1;
  private lastBottom = -1;

  constructor(viewport: Viewport) {
    this.viewport = viewport;
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  render(): void {
    const vp = this.viewport;
    const left = Math.floor(vp.left / TILE_SIZE);
    const top = Math.floor(vp.top / TILE_SIZE);
    const right = Math.ceil(vp.right / TILE_SIZE);
    const bottom = Math.ceil(vp.bottom / TILE_SIZE);

    // Check if we need to redraw: fog changed or camera moved
    const cameraChanged = left !== this.lastLeft || top !== this.lastTop ||
      right !== this.lastRight || bottom !== this.lastBottom;

    if (!fogDirty && !cameraChanged) return;

    clearFogDirty();
    this.lastLeft = left;
    this.lastTop = top;
    this.lastRight = right;
    this.lastBottom = bottom;

    const g = this.graphics;
    g.clear();

    const minCol = Math.max(0, left - 1);
    const maxCol = Math.min(MAP_COLS - 1, right + 1);
    const minRow = Math.max(0, top - 1);
    const maxRow = Math.min(MAP_ROWS - 1, bottom + 1);

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const fog = fogGrid[r * MAP_COLS + c];
        if (fog === FOG_UNEXPLORED) {
          g.rect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.fill({ color: 0x000000, alpha: 0.95 });
        } else if (fog === FOG_EXPLORED) {
          g.rect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.fill({ color: 0x000000, alpha: 0.6 });
        }
        // FOG_VISIBLE: no draw (transparent)
      }
    }
  }
}
