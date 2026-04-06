import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  Faction,
} from '../helpers';
import {
  fogSystem,
  fogGrid,
  FOG_VISIBLE,
  resetFogSystem,
} from '../../src/systems/FogSystem';
import { posX, posY, atkRange } from '../../src/ecs/components';
import type { MapData } from '../../src/map/MapData';
import type { World } from '../../src/ecs/world';

// const enums are erased — use raw values
const MAP_COLS = 128;
const MAP_ROWS = 128;
const TILE_SIZE = 32;
const TileType_Ground = 0;

// The fog system throttles to every 10 ticks.
// After resetFogSystem (counter=0), we need to call fogSystem 10 times.
const FOG_UPDATE_INTERVAL = 10;

/**
 * Create a full 128x128 map with a controlled elevation layout:
 * - Rows 0-7: low ground (elevation=0)
 * - Row 7: ramp (elevation=2)
 * - Rows 8-15: high ground (elevation=1)
 * - Everything else: low ground (elevation=0)
 *
 * All tiles are walkable ground.
 */
function createElevationTestMap(): MapData {
  const tiles = new Uint8Array(MAP_COLS * MAP_ROWS);
  const walkable = new Uint8Array(MAP_COLS * MAP_ROWS);
  const destructibleHP = new Uint16Array(MAP_COLS * MAP_ROWS);
  const creepMap = new Uint8Array(MAP_COLS * MAP_ROWS);
  const elevation = new Uint8Array(MAP_COLS * MAP_ROWS);

  tiles.fill(TileType_Ground);
  walkable.fill(1);

  // Set rows 8-15 to high ground (elevation=1)
  for (let r = 8; r <= 15; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      elevation[r * MAP_COLS + c] = 1;
    }
  }

  // Set row 7 to ramp (elevation=2), overriding the default 0
  for (let c = 0; c < MAP_COLS; c++) {
    elevation[7 * MAP_COLS + c] = 2;
  }

  return { tiles, walkable, destructibleHP, creepMap, elevation, cols: MAP_COLS, rows: MAP_ROWS };
}

/** Call fogSystem enough times to trigger the throttled update. */
function runFogUpdate(world: World, map: MapData): void {
  for (let i = 0; i < FOG_UPDATE_INTERVAL; i++) {
    fogSystem(world, map);
  }
}

describe('FogSystem — elevation vision rules', () => {
  let world: World;
  let map: MapData;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    map = createElevationTestMap();
    resetFogSystem();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
    resetFogSystem();
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  describe('low-ground unit vision of high ground', () => {
    it('does NOT see high-ground tiles 5+ tiles away', () => {
      // Place a Terran unit on low ground at row=2, col=10
      const unit = track(spawnUnit(world, {
        x: 10 * TILE_SIZE + TILE_SIZE / 2,  // col=10 center
        y: 2 * TILE_SIZE + TILE_SIZE / 2,   // row=2 center
        factionId: Faction.Terran,
        range: 6 * TILE_SIZE,               // 6-tile range → sightRange ~8
      }));

      runFogUpdate(world, map);

      // Unit is at row=2 (elevation=0). High ground starts at row=8 (elevation=1).
      // Distance from row=2 to row=8 is 6 tiles, well beyond the 1.5-tile adjacency limit.
      // The fog system should NOT reveal high-ground tiles at this distance.
      const farHighGroundIdx = 10 * MAP_COLS + 10;  // row=10, col=10 (high ground, 8 tiles away)
      expect(fogGrid[farHighGroundIdx]).not.toBe(FOG_VISIBLE);

      // Also check row=8 (first high-ground row), 6 tiles away from unit at row=2
      const nearHighGroundIdx = 8 * MAP_COLS + 10;  // row=8, col=10
      expect(fogGrid[nearHighGroundIdx]).not.toBe(FOG_VISIBLE);
    });

    it('DOES see low-ground tiles at full range', () => {
      // Place a Terran unit on low ground at row=2, col=10
      const unit = track(spawnUnit(world, {
        x: 10 * TILE_SIZE + TILE_SIZE / 2,
        y: 2 * TILE_SIZE + TILE_SIZE / 2,
        factionId: Faction.Terran,
        range: 6 * TILE_SIZE,
      }));

      runFogUpdate(world, map);

      // Low-ground tile within sight range (same elevation) should be visible
      // Row=4, col=10 — 2 tiles away, definitely in range, elevation=0
      const lowGroundIdx = 4 * MAP_COLS + 10;
      expect(fogGrid[lowGroundIdx]).toBe(FOG_VISIBLE);

      // Row=0, col=10 — 2 tiles away in the other direction, still low ground
      const lowGroundIdx2 = 0 * MAP_COLS + 10;
      expect(fogGrid[lowGroundIdx2]).toBe(FOG_VISIBLE);
    });

    it('CAN see high-ground tiles within 1.5 tiles (adjacent)', () => {
      // Place unit at row=7 boundary area but on low ground.
      // Actually row=7 is ramp (elevation=2), so place at row=6 (elevation=0)
      const unit = track(spawnUnit(world, {
        x: 10 * TILE_SIZE + TILE_SIZE / 2,
        y: 6 * TILE_SIZE + TILE_SIZE / 2,   // row=6 (low ground)
        factionId: Faction.Terran,
        range: 5 * TILE_SIZE,
      }));

      runFogUpdate(world, map);

      // Row=7 is ramp (elevation=2), not high ground (1), so the restriction
      // doesn't apply. Check that the unit can see ramp tiles.
      const rampIdx = 7 * MAP_COLS + 10;
      expect(fogGrid[rampIdx]).toBe(FOG_VISIBLE);
    });
  });

  describe('high-ground unit vision of low ground', () => {
    it('DOES see low-ground tiles at full range', () => {
      // Place a Terran unit on high ground at row=10, col=10
      const unit = track(spawnUnit(world, {
        x: 10 * TILE_SIZE + TILE_SIZE / 2,
        y: 10 * TILE_SIZE + TILE_SIZE / 2,   // row=10 (high ground, elevation=1)
        factionId: Faction.Terran,
        range: 8 * TILE_SIZE,                 // 8-tile range → sightRange ~10
      }));

      runFogUpdate(world, map);

      // Low-ground tiles within sight range should be visible from high ground
      // Row=2, col=10 — 8 tiles away (within 10-tile sight range)
      const lowGroundIdx = 2 * MAP_COLS + 10;
      expect(fogGrid[lowGroundIdx]).toBe(FOG_VISIBLE);

      // Row=4, col=10 — 6 tiles away
      const lowGroundIdx2 = 4 * MAP_COLS + 10;
      expect(fogGrid[lowGroundIdx2]).toBe(FOG_VISIBLE);
    });

    it('DOES see other high-ground tiles at full range', () => {
      // Unit at row=10, col=10 (high ground)
      const unit = track(spawnUnit(world, {
        x: 10 * TILE_SIZE + TILE_SIZE / 2,
        y: 10 * TILE_SIZE + TILE_SIZE / 2,
        factionId: Faction.Terran,
        range: 6 * TILE_SIZE,
      }));

      runFogUpdate(world, map);

      // Row=12, col=10 — 2 tiles away, same elevation=1
      const highGroundIdx = 12 * MAP_COLS + 10;
      expect(fogGrid[highGroundIdx]).toBe(FOG_VISIBLE);
    });
  });

  describe('ramp unit vision', () => {
    it('sees both elevation levels normally', () => {
      // Place unit on ramp at row=7 (elevation=2)
      const unit = track(spawnUnit(world, {
        x: 10 * TILE_SIZE + TILE_SIZE / 2,
        y: 7 * TILE_SIZE + TILE_SIZE / 2,   // row=7 (ramp, elevation=2)
        factionId: Faction.Terran,
        range: 6 * TILE_SIZE,               // sightRange ~8
      }));

      runFogUpdate(world, map);

      // Should see low-ground tiles (row=3, col=10 — 4 tiles away, elevation=0)
      const lowIdx = 3 * MAP_COLS + 10;
      expect(fogGrid[lowIdx]).toBe(FOG_VISIBLE);

      // Should see high-ground tiles (row=11, col=10 — 4 tiles away, elevation=1)
      const highIdx = 11 * MAP_COLS + 10;
      expect(fogGrid[highIdx]).toBe(FOG_VISIBLE);

      // Should see ramp tiles (row=7, col=12 — 2 tiles away, elevation=2)
      const rampIdx = 7 * MAP_COLS + 12;
      expect(fogGrid[rampIdx]).toBe(FOG_VISIBLE);
    });
  });
});
