import { Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  MAP_COLS, MAP_ROWS, MAP_WIDTH, MAP_HEIGHT, TILE_SIZE,
  Faction, TERRAN_COLOR, ZERG_COLOR, MINERAL_COLOR, GAS_COLOR,
  GROUND_COLOR, WATER_COLOR, UNBUILDABLE_COLOR, TileType,
  activePlayerFaction,
} from '../constants';
import { TerrainPalette } from './terrainPalette';
import { getFactionPalette, TERRAN_PALETTE, type FactionPalette } from '../ui/theme';
import {
  POSITION, HEALTH, BUILDING, RESOURCE,
  posX, posY, faction, hpCurrent,
  buildingType, resourceType,
} from '../ecs/components';
import { type World, hasComponents } from '../ecs/world';
import { type MapData } from '../map/MapData';
import { isTileVisible } from '../systems/FogSystem';

const MINIMAP_SIZE = 200;
const MINIMAP_PADDING = 12;
const MINIMAP_SCALE = MINIMAP_SIZE / MAP_WIDTH; // tiles -> minimap pixels
const ATTACK_PING_DURATION = 5; // seconds before ping expires

/**
 * Renders a minimap in the bottom-right corner of the screen.
 * Shows terrain, units as colored dots, buildings as squares,
 * resources as tiny dots, and the camera viewport as a white rect.
 *
 * Added to app.stage (screen space), not the viewport.
 */
interface AttackPing {
  worldX: number;
  worldY: number;
  time: number; // gameTime when the ping was created
}

export class MinimapRenderer {
  container: Container;
  private backgroundGraphics: Graphics;
  private dynamicGraphics: Graphics;
  private viewport: Viewport;
  private mapData: MapData;
  private screenWidth: number;
  private screenHeight: number;
  private attackPings: AttackPing[] = [];
  private palette: FactionPalette = TERRAN_PALETTE;

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

    // Dark background with faction-colored frame
    g.rect(-6, -6, MINIMAP_SIZE + 12, MINIMAP_SIZE + 12);
    g.fill({ color: 0x000000, alpha: 0.82 });
    g.rect(-6, -6, MINIMAP_SIZE + 12, MINIMAP_SIZE + 12);
    g.stroke({ color: this.palette.primaryHex, width: 2.0, alpha: 0.4 });
    // Top edge highlight (bevel simulation)
    g.moveTo(-4, -4); g.lineTo(MINIMAP_SIZE + 4, -4);
    g.stroke({ color: this.palette.primaryHex, width: 1.0, alpha: 0.15 });
    // Inner border
    g.rect(-2, -2, MINIMAP_SIZE + 4, MINIMAP_SIZE + 4);
    g.stroke({ color: 0x1a2a3a, width: 0.5, alpha: 0.5 });

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
          case TileType.Destructible:
            color = TerrainPalette.rock.body;
            break;
          case TileType.Ramp:
            color = TerrainPalette.ramp.base;
            break;
          default:
            color = GROUND_COLOR;
            break;
        }

        // Brighten high-ground tiles on the minimap
        const elev = this.mapData.elevation[r * MAP_COLS + c];
        if (elev === 1) {
          color = brightenColor(color, 0x1a1a1a);
        }

        const px = (c / MAP_COLS) * MINIMAP_SIZE;
        const py = (r / MAP_ROWS) * MINIMAP_SIZE;
        g.rect(px, py, pxPerBlock, pxPerBlock);
        g.fill({ color });
      }
    }
  }

  setFaction(f: Faction): void {
    this.palette = getFactionPalette(f);
    this.drawBackground();
  }

  /**
   * Register a pulsing red attack ping at a world-space position.
   * Expires after ATTACK_PING_DURATION seconds.
   */
  showAttackPing(worldX: number, worldY: number, time: number): void {
    // Replace existing ping at same approximate location (within 3 tiles) to avoid stacking
    const mx = worldX * MINIMAP_SCALE;
    const my = worldY * MINIMAP_SCALE;
    const existing = this.attackPings.findIndex(p => {
      const pmx = p.worldX * MINIMAP_SCALE;
      const pmy = p.worldY * MINIMAP_SCALE;
      return Math.abs(pmx - mx) < 6 && Math.abs(pmy - my) < 6;
    });
    if (existing >= 0) {
      this.attackPings[existing] = { worldX, worldY, time };
    } else {
      this.attackPings.push({ worldX, worldY, time });
    }
  }

  /** Called each frame: redraw units, buildings, resources, and camera rect */
  render(world: World, gameTime = 0): void {
    const g = this.dynamicGraphics;
    g.clear();

    const posBit = POSITION | HEALTH;

    // Draw creep overlay (purple dots for each creep tile)
    const blockSize = 2;
    const pxPerBlock = (MINIMAP_SIZE / MAP_COLS) * blockSize;
    for (let r = 0; r < MAP_ROWS; r += blockSize) {
      for (let c = 0; c < MAP_COLS; c += blockSize) {
        if (this.mapData.creepMap[r * MAP_COLS + c] !== 1) continue;
        const px = (c / MAP_COLS) * MINIMAP_SIZE;
        const py = (r / MAP_ROWS) * MINIMAP_SIZE;
        g.rect(px, py, pxPerBlock, pxPerBlock);
        g.fill({ color: TerrainPalette.creep.base, alpha: 0.5 });
      }
    }

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

      // Buildings: larger squares with outline
      if (hasComponents(world, eid, BUILDING)) {
        const fac = faction[eid] as Faction;
        // Skip enemy buildings in fog
        if (fac !== activePlayerFaction && fac !== Faction.None && !isTileVisible(posX[eid], posY[eid])) continue;
        const color = fac === Faction.Terran ? TERRAN_COLOR
          : fac === Faction.Zerg ? ZERG_COLOR : 0x888888;
        g.rect(mx - 2.5, my - 2.5, 5, 5);
        g.fill({ color, alpha: 0.9 });
        g.rect(mx - 2.5, my - 2.5, 5, 5);
        g.stroke({ color: 0xffffff, width: 0.5, alpha: 0.3 });
        continue;
      }

      // Units: dots sized by importance, with glow for player units
      const fac = faction[eid] as Faction;
      if (fac === Faction.None) continue;
      // Skip enemy units in fog
      if (fac !== activePlayerFaction && !isTileVisible(posX[eid], posY[eid])) continue;
      const color = fac === Faction.Terran ? TERRAN_COLOR : ZERG_COLOR;
      // Slightly larger dots for better visibility
      g.rect(mx - 1.2, my - 1.2, 2.4, 2.4);
      g.fill({ color });
    }

    // Expire old pings
    if (this.attackPings.length > 0) {
      this.attackPings = this.attackPings.filter(p => gameTime - p.time < ATTACK_PING_DURATION);
    }

    // Draw attack pings — pulsing red circles that persist for ATTACK_PING_DURATION seconds
    for (const ping of this.attackPings) {
      const pingMx = ping.worldX * MINIMAP_SCALE;
      const pingMy = ping.worldY * MINIMAP_SCALE;
      const age = gameTime - ping.time;
      // Fade out in the last 2 seconds
      const fadeAlpha = age > ATTACK_PING_DURATION - 2
        ? 1 - (age - (ATTACK_PING_DURATION - 2)) / 2
        : 1;
      const pulse = Math.sin(gameTime * 6) * 0.3 + 0.7;
      g.circle(pingMx, pingMy, 5);
      g.fill({ color: 0xff2222, alpha: pulse * fadeAlpha * 0.85 });
      // Outer ring
      g.circle(pingMx, pingMy, 7);
      g.stroke({ color: 0xff4444, width: 1, alpha: pulse * fadeAlpha * 0.5 });
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

    // Camera viewport with fill tint and bright border
    g.rect(rx, ry, rw, rh);
    g.fill({ color: 0xffffff, alpha: 0.04 });
    g.rect(rx, ry, rw, rh);
    g.stroke({ color: 0xffffff, width: 1.2, alpha: 0.85 });
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

  /**
   * Check if a right-click hits the minimap. Returns world coords or null.
   */
  handleRightClick(screenX: number, screenY: number): { x: number; y: number } | null {
    const localX = screenX - this.container.x;
    const localY = screenY - this.container.y;

    if (localX < 0 || localX > MINIMAP_SIZE || localY < 0 || localY > MINIMAP_SIZE) {
      return null;
    }

    return {
      x: (localX / MINIMAP_SIZE) * MAP_WIDTH,
      y: (localY / MINIMAP_SIZE) * MAP_HEIGHT,
    };
  }
}

/** Add a fixed amount to each RGB channel, clamped to 255 */
function brightenColor(base: number, add: number): number {
  const r = Math.min(255, ((base >> 16) & 0xff) + ((add >> 16) & 0xff));
  const g = Math.min(255, ((base >> 8) & 0xff) + ((add >> 8) & 0xff));
  const b = Math.min(255, (base & 0xff) + (add & 0xff));
  return (r << 16) | (g << 8) | b;
}
