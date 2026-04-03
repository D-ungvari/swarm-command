import { describe, it, expect } from 'vitest';
import { generateMap, getElevation } from '../../src/map/MapData';

// const enums are erased at compile time — use raw values
const MAP_COLS = 128;
const MAP_ROWS = 128;
const MapType_Plains = 0;
const TileType_Water = 5;

describe('Elevation system — MapData', () => {
  describe('generateMap() elevation array', () => {
    it('returns MapData with elevation of correct length', () => {
      const map = generateMap(MapType_Plains);
      expect(map.elevation).toBeInstanceOf(Uint8Array);
      expect(map.elevation.length).toBe(MAP_COLS * MAP_ROWS);
    });
  });

  describe('Plains map base elevation', () => {
    // Plains P1 main base: markBaseElevation(elevation, 2, 2, 20, 20)
    // Interior = rows 4-18, cols 4-18 → elevation=1
    // Perimeter (2-tile ring) = rows 2-3, 19-20 or cols 2-3, 19-20 → elevation=2

    it('tiles inside a main base area have elevation=1', () => {
      const map = generateMap(MapType_Plains);
      // row=10, col=10 is well inside the P1 main base interior
      expect(getElevation(map, 10, 10)).toBe(1);
      // Check another interior tile
      expect(getElevation(map, 12, 8)).toBe(1);
    });

    it('tiles on the 2-tile perimeter ring have elevation=2', () => {
      const map = generateMap(MapType_Plains);
      // Top perimeter row of P1 base: row=2, col=10
      expect(getElevation(map, 10, 2)).toBe(2);
      // Left perimeter col: row=10, col=2
      expect(getElevation(map, 2, 10)).toBe(2);
      // Bottom perimeter row: row=20, col=10
      expect(getElevation(map, 10, 20)).toBe(2);
      // Right perimeter col: row=10, col=20
      expect(getElevation(map, 20, 10)).toBe(2);
      // Second perimeter row: row=3, col=10
      expect(getElevation(map, 10, 3)).toBe(2);
    });

    it('tiles outside all bases have elevation=0', () => {
      const map = generateMap(MapType_Plains);
      // (col=100, row=50) is in the open area — no base, watchtower, or terrain feature
      expect(getElevation(map, 100, 50)).toBe(0);
    });
  });

  describe('getElevation() out-of-bounds', () => {
    it('returns 0 for negative col', () => {
      const map = generateMap(MapType_Plains);
      expect(getElevation(map, -1, 10)).toBe(0);
    });

    it('returns 0 for negative row', () => {
      const map = generateMap(MapType_Plains);
      expect(getElevation(map, 10, -1)).toBe(0);
    });

    it('returns 0 for col >= MAP_COLS', () => {
      const map = generateMap(MapType_Plains);
      expect(getElevation(map, MAP_COLS, 10)).toBe(0);
      expect(getElevation(map, MAP_COLS + 50, 10)).toBe(0);
    });

    it('returns 0 for row >= MAP_ROWS', () => {
      const map = generateMap(MapType_Plains);
      expect(getElevation(map, 10, MAP_ROWS)).toBe(0);
      expect(getElevation(map, 10, MAP_ROWS + 50)).toBe(0);
    });
  });

  describe('Water tiles always have elevation=0', () => {
    it('border water tiles have elevation=0', () => {
      const map = generateMap(MapType_Plains);
      // Border walls are water tiles (row=0, col=0, etc.)
      // Row 0 is all water
      for (let c = 0; c < MAP_COLS; c++) {
        const idx = 0 * MAP_COLS + c;
        if (map.tiles[idx] === TileType_Water) {
          expect(map.elevation[idx]).toBe(0);
        }
      }
      // Col 0 is all water
      for (let r = 0; r < MAP_ROWS; r++) {
        const idx = r * MAP_COLS + 0;
        if (map.tiles[idx] === TileType_Water) {
          expect(map.elevation[idx]).toBe(0);
        }
      }
    });

    it('no water tile anywhere on the map has non-zero elevation', () => {
      const map = generateMap(MapType_Plains);
      for (let i = 0; i < map.tiles.length; i++) {
        if (map.tiles[i] === TileType_Water) {
          expect(map.elevation[i]).toBe(0);
        }
      }
    });
  });
});
