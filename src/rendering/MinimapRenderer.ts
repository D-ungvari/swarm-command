import { Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  MAP_COLS, MAP_ROWS, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE,
  Faction, TERRAN_COLOR, ZERG_COLOR, MINERAL_COLOR, GAS_COLOR,
  GROUND_COLOR, WATER_COLOR, UNBUILDABLE_COLOR, TileType,
} from '../constants';
import {
  POSITION, HEALTH, BUILDING, RESOURCE,
  posX, posY, faction, hpCurrent,
  buildingType, resourceType,
} from '../ecs/components';
import { type World, hasComponents } from '../ecs/world';
import { type MapData } from '../map/MapData';

const MINIMAP_SIZE = 160;
const MINIMAP_PADDING = 12;
const MINIMAP_SCALE = MINIMAP_SIZE / MAP_WIDTH; // tiles -> minimap pixels

/**
 * Renders a minimap in the bottom-right corner of the screen.
 * Shows terrain, units as colored dots, buildings as squares,
 * resources as tiny dots, and the camera viewport as a white rect.
 *
 * Added to app.stage (screen space), not the viewport.
 */
export class MinimapRenderer {
  container: Container;
  private backgroundGraphics: Graphics;
  private dynamicGraphics: Graphics;
  private viewport: Viewport;
  private mapData: MapData;
  private screenWidth: number;
  private screenHeight: number;

  constructor(stage: Container, viewport: Viewport, mapData: MapData) {
    this.viewport = viewport;
    this.mapData = mapData;
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;

    this.container = new Container();

    // Background: static terrain (drawn once)
    this.backgroundGraphics = new Graphics();
    this.container.addChild(this.backgroundGraphics);

    // Dynamic overlay: units, buildings, camera rect (redrawn each frame)
    this.dynamicGraphics = new Graphics();
    this.container.addChild(this.dynamicGraphics);

    stage.addChild(this.container);

    this.reposition();
    this.drawBackground();
  }

  /** Reposition minimap when the window resizes */
  resize(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.reposition();
  }

  private reposition(): void {
    this.container.x = this.screenWidth - MINIMAP_SIZE - MINIMAP_PADDING;
    this.container.y = this.screenHeight - MINIMAP_SIZE - MINIMAP_PADDING;
  }

  /** Draw the static terrain background (called once) */
  private drawBackground(): void {
    const g = this.backgroundGraphics;
    g.clear();

    // Semi-transparent dark border/background
    g.rect(-4, -4, MINIMAP_SIZE + 8, MINIMAP_SIZE + 8);
    g.fill({ color: 0x000000, alpha: 0.7 });

    // Draw terrain tiles at reduced resolution
    // Group tiles into 2x2 blocks for performance (128 tiles -> 64 blocks -> fits in 160px)
    const blockSize = 2;
    const pxPerBlock = (MINIMAP_SIZE / MAP_COLS) * blockSize;

    for (let r = 0; r < MAP_ROWS; r += blockSize) {
      for (let c = 0; c < MAP_COLS; c += blockSize) {
        const tile = this.mapData.tiles[r * MAP_COLS + c] as TileType;
        let color: number;
        switch (tile) {
          case TileType.Water:
            color = WATER_COLOR;
            break;
          case TileType.Unbuildable:
            color = UNBUILDABLE_COLOR;
            break;
          case TileType.Minerals:
            color = MINERAL_COLOR;
            break;
          case TileType.Gas:
            color = GAS_COLOR;
            break;
          default:
            color = GROUND_COLOR;
            break;
        }

        const px = (c / MAP_COLS) * MINIMAP_SIZE;
        const py = (r / MAP_ROWS) * MINIMAP_SIZE;
        g.rect(px, py, pxPerBlock, pxPerBlock);
        g.fill({ color });
      }
    }
  }

  /** Called each frame: redraw units, buildings, resources, and camera rect */
  render(world: World): void {
    const g = this.dynamicGraphics;
    g.clear();

    const posBit = POSITION | HEALTH;

    // Draw entities
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, posBit)) continue;
      if (hpCurrent[eid] <= 0) continue;

      const mx = posX[eid] * MINIMAP_SCALE;
      const my = posY[eid] * MINIMAP_SCALE;

      // Resource nodes: tiny dots
      if (hasComponents(world, eid, RESOURCE)) {
        const rt = resourceType[eid];
        const color = rt === 1 ? MINERAL_COLOR : GAS_COLOR; // ResourceType.Mineral=1, Gas=2
        g.rect(mx - 0.5, my - 0.5, 1, 1);
        g.fill({ color, alpha: 0.8 });
        continue;
      }

      // Buildings: larger squares in faction color
      if (hasComponents(world, eid, BUILDING)) {
        const fac = faction[eid] as Faction;
        const color = fac === Faction.Terran ? TERRAN_COLOR
          : fac === Faction.Zerg ? ZERG_COLOR : 0x888888;
        g.rect(mx - 2, my - 2, 4, 4);
        g.fill({ color });
        continue;
      }

      // Units: small dots in faction color
      const fac = faction[eid] as Faction;
      if (fac === Faction.None) continue;
      const color = fac === Faction.Terran ? TERRAN_COLOR : ZERG_COLOR;
      g.rect(mx - 1, my - 1, 2, 2);
      g.fill({ color });
    }

    // Camera viewport rectangle (white outline)
    const vp = this.viewport;
    const camLeft = vp.left * MINIMAP_SCALE;
    const camTop = vp.top * MINIMAP_SCALE;
    const camWidth = (vp.right - vp.left) * MINIMAP_SCALE;
    const camHeight = (vp.bottom - vp.top) * MINIMAP_SCALE;

    // Clamp to minimap bounds
    const rx = Math.max(0, camLeft);
    const ry = Math.max(0, camTop);
    const rw = Math.min(MINIMAP_SIZE - rx, camWidth);
    const rh = Math.min(MINIMAP_SIZE - ry, camHeight);

    g.rect(rx, ry, rw, rh);
    g.stroke({ color: 0xffffff, width: 1, alpha: 0.9 });
  }

  /**
   * Check if a screen-space click hits the minimap.
   * If so, move the camera to that position and return true.
   */
  handleClick(screenX: number, screenY: number): boolean {
    const localX = screenX - this.container.x;
    const localY = screenY - this.container.y;

    if (localX < 0 || localX > MINIMAP_SIZE || localY < 0 || localY > MINIMAP_SIZE) {
      return false;
    }

    const worldX = (localX / MINIMAP_SIZE) * MAP_WIDTH;
    const worldY = (localY / MINIMAP_SIZE) * MAP_HEIGHT;
    this.viewport.moveCenter(worldX, worldY);
    return true;
  }

  /**
   * Check if the mouse is being held down on the minimap (drag-to-pan).
   * Call every frame with current mouse state.
   */
  handleDrag(screenX: number, screenY: number, leftDown: boolean): void {
    if (!leftDown) return;

    const localX = screenX - this.container.x;
    const localY = screenY - this.container.y;

    if (localX < 0 || localX > MINIMAP_SIZE || localY < 0 || localY > MINIMAP_SIZE) {
      return;
    }

    const worldX = (localX / MINIMAP_SIZE) * MAP_WIDTH;
    const worldY = (localY / MINIMAP_SIZE) * MAP_HEIGHT;
    this.viewport.moveCenter(worldX, worldY);
  }
}
