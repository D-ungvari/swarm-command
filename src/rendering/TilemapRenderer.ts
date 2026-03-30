import { Graphics, Container } from 'pixi.js';
import type { MapData } from '../map/MapData';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, TileType,
  GROUND_COLOR, MINERAL_COLOR, GAS_COLOR,
  UNBUILDABLE_COLOR, WATER_COLOR,
} from '../constants';

/**
 * Renders the tile grid into a single container.
 * Static tiles are drawn once; water tiles get a subtle animation.
 */
export class TilemapRenderer {
  container: Container;
  private staticGraphics: Graphics;
  private waterGraphics: Graphics;
  private waterTiles: Array<{ col: number; row: number }> = [];
  private mapRef: MapData | null = null;

  constructor() {
    this.container = new Container();
    this.staticGraphics = new Graphics();
    this.waterGraphics = new Graphics();
    this.container.addChild(this.staticGraphics);
    this.container.addChild(this.waterGraphics);
  }

  render(map: MapData): void {
    this.mapRef = map;
    const g = this.staticGraphics;
    g.clear();
    this.waterTiles = [];

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = map.tiles[row * MAP_COLS + col] as TileType;
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        if (tile === TileType.Water) {
          // Draw base water tile statically; animation is in updateWater()
          g.rect(x, y, TILE_SIZE, TILE_SIZE);
          g.fill({ color: WATER_COLOR });
          this.waterTiles.push({ col, row });
        } else {
          // Deterministic color variation for ground tiles
          const baseColor = tileColor(tile);
          const color = tile === TileType.Ground || tile === TileType.Unbuildable
            ? varyColor(baseColor, col, row)
            : baseColor;

          g.rect(x, y, TILE_SIZE, TILE_SIZE);
          g.fill({ color });
        }

        // Subtle grid lines between tiles
        g.rect(x, y, TILE_SIZE, TILE_SIZE);
        g.stroke({ color: 0x000000, width: 0.5, alpha: 0.05 });

        // Mineral patches get a subtle highlight
        if (tile === TileType.Minerals) {
          g.rect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
          g.fill({ color: 0x66ddff, alpha: 0.4 });
        }
        // Gas geysers get a glow
        if (tile === TileType.Gas) {
          g.circle(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 3);
          g.fill({ color: 0x88ff88, alpha: 0.3 });
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
      // Subtle alpha pulse per tile, offset by position for wave effect
      const phase = (col * 0.7 + row * 0.5) + gameTime * 1.5;
      const pulse = 0.08 + 0.06 * Math.sin(phase);
      g.rect(x, y, TILE_SIZE, TILE_SIZE);
      g.fill({ color: 0x1144aa, alpha: pulse });
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
    default: return GROUND_COLOR;
  }
}

/** Deterministic per-tile color variation using position-based hash */
function varyColor(base: number, col: number, row: number): number {
  // Simple hash from position
  const hash = ((col * 73856093) ^ (row * 19349663)) >>> 0;
  // Variation range: -8 to +8 per channel
  const variation = ((hash % 17) - 8);

  const r = Math.max(0, Math.min(255, ((base >> 16) & 0xff) + variation));
  const g = Math.max(0, Math.min(255, ((base >> 8) & 0xff) + variation));
  const b = Math.max(0, Math.min(255, (base & 0xff) + variation));

  return (r << 16) | (g << 8) | b;
}
