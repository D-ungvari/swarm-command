import { Graphics, Container } from 'pixi.js';
import type { MapData } from '../map/MapData';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, TileType,
  GROUND_COLOR, MINERAL_COLOR, GAS_COLOR,
  UNBUILDABLE_COLOR, WATER_COLOR, ROCK_COLOR,
} from '../constants';

/**
 * Renders the tile grid into a single container.
 * Static tiles are drawn once; water tiles get a subtle animation.
 */
export class TilemapRenderer {
  container: Container;
  private staticGraphics: Graphics;
  private waterGraphics: Graphics;
  private creepGraphics: Graphics;
  private waterTiles: Array<{ col: number; row: number }> = [];
  private mapRef: MapData | null = null;
  private lastCreepUpdate = -1;

  constructor() {
    this.container = new Container();
    this.staticGraphics = new Graphics();
    this.waterGraphics = new Graphics();
    this.creepGraphics = new Graphics();
    this.container.addChild(this.staticGraphics);
    this.container.addChild(this.waterGraphics);
    this.container.addChild(this.creepGraphics);
  }

  render(map: MapData): void {
    this.mapRef = map;
    const g = this.staticGraphics;
    g.clear();
    this.waterTiles = [];

    const TS = TILE_SIZE;
    const half = TS / 2;

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = map.tiles[row * MAP_COLS + col] as TileType;
        const x = col * TS;
        const y = row * TS;
        const hash = tileHash(col, row);

        if (tile === TileType.Water) {
          // Base water tile (animation overlay in updateWater)
          g.rect(x, y, TS, TS);
          g.fill({ color: WATER_COLOR });
          // Depth gradient — darker toward center of water bodies
          const depthAlpha = 0.08 + (hash % 5) * 0.02;
          g.rect(x, y, TS, TS);
          g.fill({ color: 0x000022, alpha: depthAlpha });
          this.waterTiles.push({ col, row });
        } else if (tile === TileType.Ground || tile === TileType.Unbuildable) {
          // ── Ground with noise pattern ──
          const baseColor = tile === TileType.Ground ? GROUND_COLOR : UNBUILDABLE_COLOR;
          const color = varyColor(baseColor, col, row);
          g.rect(x, y, TS, TS);
          g.fill({ color });

          // Noise detail: scattered tiny dots for texture
          const dotCount = 1 + (hash % 3); // 1-3 dots per tile
          for (let d = 0; d < dotCount; d++) {
            const dHash = tileHash(col * 7 + d, row * 13 + d);
            const dx = x + (dHash % TS);
            const dy = y + ((dHash >> 8) % TS);
            const bright = (dHash >> 4) % 2 === 0;
            g.circle(dx, dy, 0.5 + (dHash % 2) * 0.3);
            g.fill({ color: bright ? 0x3a3a28 : 0x1a1a10, alpha: 0.3 });
          }

          // Occasional grass tuft on ground tiles
          if (tile === TileType.Ground && hash % 11 === 0) {
            const gx = x + 3 + (hash % (TS - 6));
            const gy = y + TS - 3;
            g.moveTo(gx, gy);
            g.lineTo(gx - 1.5, gy - 4);
            g.moveTo(gx + 2, gy);
            g.lineTo(gx + 3, gy - 3.5);
            g.stroke({ color: 0x445522, width: 0.8, alpha: 0.3 });
          }
        } else if (tile === TileType.Ramp) {
          // ── Ramp with directional lines ──
          g.rect(x, y, TS, TS);
          g.fill({ color: 0x3a3a2a });
          // Diagonal stripes to indicate slope
          for (let s = 0; s < TS; s += 5) {
            g.moveTo(x + s, y);
            g.lineTo(x + s + TS * 0.3, y + TS);
            g.stroke({ color: 0x4a4a38, width: 0.8, alpha: 0.25 });
          }
          // Border highlight (lighter top edge = elevated side)
          g.moveTo(x, y);
          g.lineTo(x + TS, y);
          g.stroke({ color: 0x555544, width: 1, alpha: 0.4 });
        } else if (tile === TileType.Minerals) {
          // ── Mineral patch with crystal facets ──
          g.rect(x, y, TS, TS);
          g.fill({ color: varyColor(0x1a2a3a, col, row) }); // dark blue-grey ground

          // Crystal cluster: 2-3 diamond shapes
          const crystalCount = 2 + (hash % 2);
          for (let c = 0; c < crystalCount; c++) {
            const cHash = tileHash(col + c * 3, row + c * 7);
            const cx = x + 4 + (cHash % (TS - 8));
            const cy = y + 4 + ((cHash >> 6) % (TS - 8));
            const ch = 4 + (cHash % 4); // crystal height 4-7
            const cw = 2 + (cHash % 2); // crystal width 2-3

            // Crystal body (diamond shape)
            g.moveTo(cx, cy - ch);
            g.lineTo(cx + cw, cy);
            g.lineTo(cx, cy + ch * 0.4);
            g.lineTo(cx - cw, cy);
            g.closePath();
            g.fill({ color: MINERAL_COLOR, alpha: 0.8 });

            // Bright highlight facet (left face)
            g.moveTo(cx, cy - ch);
            g.lineTo(cx - cw, cy);
            g.lineTo(cx, cy + ch * 0.4);
            g.closePath();
            g.fill({ color: 0xaaeeff, alpha: 0.25 });
          }

          // Sparkle dots
          const sparkleCount = 1 + (hash % 2);
          for (let s = 0; s < sparkleCount; s++) {
            const sHash = tileHash(col * 5 + s, row * 11);
            const sx = x + 3 + (sHash % (TS - 6));
            const sy = y + 3 + ((sHash >> 5) % (TS - 6));
            g.circle(sx, sy, 0.8);
            g.fill({ color: 0xffffff, alpha: 0.5 });
          }
        } else if (tile === TileType.Gas) {
          // ── Gas geyser with vent detail ──
          g.rect(x, y, TS, TS);
          g.fill({ color: varyColor(0x1a2a1a, col, row) }); // dark green ground

          // Vent ring
          g.circle(x + half, y + half, TS * 0.35);
          g.stroke({ color: 0x446644, width: 2, alpha: 0.5 });

          // Inner glow
          g.circle(x + half, y + half, TS * 0.2);
          g.fill({ color: GAS_COLOR, alpha: 0.4 });

          // Bright center
          g.circle(x + half, y + half, TS * 0.08);
          g.fill({ color: 0xccffcc, alpha: 0.6 });

          // Steam wisps (3 small offset dots)
          for (let w = 0; w < 3; w++) {
            const wHash = tileHash(col + w, row * 3);
            const wx = x + half + ((wHash % 10) - 5);
            const wy = y + half - 3 - (wHash % 5);
            g.circle(wx, wy, 1.5);
            g.fill({ color: 0x88ff88, alpha: 0.2 });
          }
        } else if (tile === TileType.Destructible) {
          // ── Destructible rock with layered detail ──
          g.rect(x, y, TS, TS);
          g.fill({ color: varyColor(0x3a3a2a, col, row) }); // ground underneath

          const inset = 3;
          // Rock body
          g.rect(x + inset, y + inset, TS - inset * 2, TS - inset * 2);
          g.fill({ color: 0x888070 });
          g.rect(x + inset, y + inset, TS - inset * 2, TS - inset * 2);
          g.stroke({ color: 0x444038, width: 1.5 });

          // Crack line across rock
          const crackDir = hash % 2;
          if (crackDir === 0) {
            g.moveTo(x + inset + 2, y + half - 1);
            g.lineTo(x + half, y + half + 2);
            g.lineTo(x + TS - inset - 2, y + half - 2);
            g.stroke({ color: 0x333028, width: 1, alpha: 0.6 });
          } else {
            g.moveTo(x + half - 1, y + inset + 2);
            g.lineTo(x + half + 2, y + half);
            g.lineTo(x + half - 2, y + TS - inset - 2);
            g.stroke({ color: 0x333028, width: 1, alpha: 0.6 });
          }

          // Highlight chip (top-left)
          g.rect(x + inset + 2, y + inset + 2, 4, 3);
          g.fill({ color: 0xaaa090, alpha: 0.4 });

          // Shadow chip (bottom-right)
          g.rect(x + TS - inset - 5, y + TS - inset - 4, 4, 3);
          g.fill({ color: 0x222018, alpha: 0.3 });
        } else {
          // Fallback
          g.rect(x, y, TS, TS);
          g.fill({ color: tileColor(tile) });
        }

        // Subtle grid lines between tiles
        g.rect(x, y, TS, TS);
        g.stroke({ color: 0x000000, width: 0.5, alpha: 0.04 });
      }
    }
  }

  /**
   * Call each frame to redraw the creep overlay when it changes.
   * Only redraws if creepMap has been updated since last render (checked via gameTime bucket).
   */
  updateCreep(map: MapData, gameTime: number): void {
    // Redraw every 5 seconds (aligned to creep spread interval)
    const bucket = Math.floor(gameTime / 5);
    if (bucket === this.lastCreepUpdate) return;
    this.lastCreepUpdate = bucket;

    const g = this.creepGraphics;
    g.clear();

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        if (map.creepMap[row * MAP_COLS + col] !== 1) continue;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;
        const hash = tileHash(col, row);

        // Base creep layer
        g.rect(x, y, TILE_SIZE, TILE_SIZE);
        g.fill({ color: 0x6600aa, alpha: 0.15 });

        // Vein detail — occasional darker veins across creep tiles
        if (hash % 5 === 0) {
          const vx = x + (hash % TILE_SIZE);
          g.moveTo(vx, y);
          g.lineTo(vx + 3, y + TILE_SIZE);
          g.stroke({ color: 0x440066, width: 1, alpha: 0.2 });
        }
        if (hash % 7 === 0) {
          const vy = y + ((hash >> 4) % TILE_SIZE);
          g.moveTo(x, vy);
          g.lineTo(x + TILE_SIZE, vy + 2);
          g.stroke({ color: 0x440066, width: 0.8, alpha: 0.15 });
        }
      }
    }
  }

  /** Call each frame with current gameTime to animate water tiles */
  updateWater(gameTime: number): void {
    if (this.waterTiles.length === 0) return;
    const g = this.waterGraphics;
    g.clear();

    for (const { col, row } of this.waterTiles) {
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      // Wave highlight — brighter ripple line moving across water
      const phase = (col * 0.7 + row * 0.5) + gameTime * 1.5;
      const pulse = 0.08 + 0.06 * Math.sin(phase);
      g.rect(x, y, TILE_SIZE, TILE_SIZE);
      g.fill({ color: 0x1144aa, alpha: pulse });

      // Secondary wave (slower, different direction)
      const phase2 = (col * 0.4 - row * 0.8) + gameTime * 0.8;
      const pulse2 = 0.04 * Math.sin(phase2);
      if (pulse2 > 0) {
        g.rect(x, y, TILE_SIZE, TILE_SIZE);
        g.fill({ color: 0x2266cc, alpha: pulse2 });
      }

      // Occasional foam dot on water surface
      const hash = tileHash(col, row);
      if (hash % 9 === 0) {
        const foamPhase = gameTime * 0.5 + hash;
        const foamAlpha = 0.1 + 0.08 * Math.sin(foamPhase);
        const fx = x + TILE_SIZE * 0.3 + Math.sin(foamPhase * 0.7) * 3;
        const fy = y + TILE_SIZE * 0.5 + Math.cos(foamPhase * 0.5) * 2;
        g.circle(fx, fy, 1.5);
        g.fill({ color: 0x88aacc, alpha: foamAlpha });
      }
    }
  }
}

/** Base tile color lookup */
function tileColor(type: TileType): number {
  switch (type) {
    case TileType.Ground: return GROUND_COLOR;
    case TileType.Minerals: return MINERAL_COLOR;
    case TileType.Gas: return GAS_COLOR;
    case TileType.Ramp: return 0x3a3a2a;
    case TileType.Unbuildable: return UNBUILDABLE_COLOR;
    case TileType.Water: return WATER_COLOR;
    case TileType.Destructible: return ROCK_COLOR;
    default: return GROUND_COLOR;
  }
}

/** Fast deterministic hash from tile position */
function tileHash(col: number, row: number): number {
  return (((col * 73856093) ^ (row * 19349663)) >>> 0);
}

/** Deterministic per-tile color variation using position-based hash */
function varyColor(base: number, col: number, row: number): number {
  const hash = tileHash(col, row);
  // Variation range: -8 to +8 per channel
  const variation = ((hash % 17) - 8);

  const r = Math.max(0, Math.min(255, ((base >> 16) & 0xff) + variation));
  const g = Math.max(0, Math.min(255, ((base >> 8) & 0xff) + variation));
  const b = Math.max(0, Math.min(255, (base & 0xff) + variation));

  return (r << 16) | (g << 8) | b;
}
