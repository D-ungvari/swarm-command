import { Graphics, Container } from 'pixi.js';
import type { MapData } from '../map/MapData';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, TileType,
  GROUND_COLOR, MINERAL_COLOR, GAS_COLOR,
  UNBUILDABLE_COLOR, WATER_COLOR,
} from '../constants';

/**
 * Renders the tile grid into a single container.
 * Tiles are drawn once as static graphics — only re-rendered if the map changes.
 */
export class TilemapRenderer {
  container: Container;
  private graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  render(map: MapData): void {
    const g = this.graphics;
    g.clear();

    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const tile = map.tiles[row * MAP_COLS + col] as TileType;
        const color = tileColor(tile);
        const x = col * TILE_SIZE;
        const y = row * TILE_SIZE;

        g.rect(x, y, TILE_SIZE, TILE_SIZE);
        g.fill({ color });

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
}

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
