import { Container, Graphics } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../constants';
import { fogGrid, fogDirty, clearFogDirty, FOG_UNEXPLORED, FOG_EXPLORED, FOG_VISIBLE } from '../systems/FogSystem';

/**
 * Renders fog of war as a Graphics overlay in world space.
 * Culls to viewport bounds for performance.
 * Redraws when fog changes, camera moves, or transitions are in progress.
 * Smooth transitions: explored tiles fade in over 0.3s, visible→explored fades over 0.5s.
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

  /** Previous visibility state per tile — used to detect state changes */
  private prevVisibility: Uint8Array = new Uint8Array(MAP_COLS * MAP_ROWS);
  /** Game-time when each tile last changed visibility state (seconds) */
  private fogTransitionTime: Float32Array = new Float32Array(MAP_COLS * MAP_ROWS);
  /** Whether any tile is currently mid-transition (forces redraw each frame) */
  private hasActiveTransitions = false;

  constructor(viewport: Viewport) {
    this.viewport = viewport;
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    // All tiles start as unexplored — mark transition times at 0
    this.prevVisibility.fill(FOG_UNEXPLORED);
    this.fogTransitionTime.fill(0);
  }

  render(gameTime: number): void {
    const vp = this.viewport;
    const left = Math.floor(vp.left / TILE_SIZE);
    const top = Math.floor(vp.top / TILE_SIZE);
    const right = Math.ceil(vp.right / TILE_SIZE);
    const bottom = Math.ceil(vp.bottom / TILE_SIZE);

    // Detect tile state changes and record transition timestamps
    let stateChanged = false;
    for (let i = 0, len = fogGrid.length; i < len; i++) {
      if (fogGrid[i] !== this.prevVisibility[i]) {
        this.fogTransitionTime[i] = gameTime;
        this.prevVisibility[i] = fogGrid[i];
        stateChanged = true;
      }
    }

    // Check if we need to redraw: fog changed, camera moved, or transitions in progress
    const cameraChanged = left !== this.lastLeft || top !== this.lastTop ||
      right !== this.lastRight || bottom !== this.lastBottom;

    if (!fogDirty && !cameraChanged && !stateChanged && !this.hasActiveTransitions) return;

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

    let anyTransitioning = false;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * MAP_COLS + c;
        const fog = fogGrid[idx];
        const elapsed = gameTime - this.fogTransitionTime[idx];

        if (fog === FOG_UNEXPLORED) {
          g.rect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          g.fill({ color: 0x000000, alpha: 0.88 });
        } else if (fog === FOG_EXPLORED) {
          // Transition from unexplored: fade in over 0.3s (alpha 0.95 → 0.6)
          // Transition from visible: fade in darker over 0.5s (alpha 0 → 0.6)
          const FADE_DURATION = elapsed < 0.01 ? 0.3 : (this.prevVisibility[idx] === FOG_VISIBLE ? 0.5 : 0.3);
          const t = Math.min(1, elapsed / FADE_DURATION);
          const alpha = 0.45 * t;
          if (t < 1) anyTransitioning = true;
          if (alpha > 0.01) {
            g.rect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
            g.fill({ color: 0x000000, alpha });
          }
        }
        // FOG_VISIBLE: no draw (transparent)
      }
    }

    this.hasActiveTransitions = anyTransitioning;
  }
}
