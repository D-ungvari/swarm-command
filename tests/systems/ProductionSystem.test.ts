import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestWorld,
  spawnBuilding,
  cleanupEntities,
  createTestMap,
  createPlayerResources,
  Faction,
  UnitType,
  BuildingType,
  BuildState,
} from '../helpers';
import { productionSystem } from '../../src/systems/ProductionSystem';
import {
  posX, posY,
  buildState,
  prodUnitType, prodProgress, prodTimeTotal,
  faction,
} from '../../src/ecs/components';
import { type World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';
import type { PlayerResources } from '../../src/types';

describe('ProductionSystem', () => {
  let world: World;
  let map: MapData;
  let resources: Record<number, PlayerResources>;
  let spawnFn: ReturnType<typeof vi.fn>;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    map = createTestMap();
    resources = createPlayerResources();
    spawnFn = vi.fn().mockReturnValue(99); // mock returns a fake eid
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  // ── Timer decrement ──

  describe('production timer', () => {
    it('decrements prodProgress by dt each tick', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.Complete,
        progress: 1.0,
        buildTime: 40,
        hp: 1000,
      }));
      buildState[building] = BuildState.Complete;
      prodUnitType[building] = UnitType.Marine;
      prodProgress[building] = 18.0;
      prodTimeTotal[building] = 18.0;

      const dt = 1.0;
      productionSystem(world, dt, resources, map, spawnFn);

      expect(prodProgress[building]).toBeCloseTo(17.0, 4);
      expect(spawnFn).not.toHaveBeenCalled(); // timer hasn't reached 0
    });

    it('spawns unit when timer reaches 0', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.Complete,
        progress: 1.0,
        buildTime: 40,
        hp: 1000,
        factionId: Faction.Terran,
      }));
      buildState[building] = BuildState.Complete;
      prodUnitType[building] = UnitType.Marine;
      prodProgress[building] = 0.5; // almost done
      prodTimeTotal[building] = 18.0;

      // dt = 1.0 makes timer go to -0.5, which is <= 0
      productionSystem(world, 1.0, resources, map, spawnFn);

      expect(spawnFn).toHaveBeenCalledTimes(1);
      // spawnFn(unitType, faction, x, y)
      const call = spawnFn.mock.calls[0];
      expect(call[0]).toBe(UnitType.Marine);
      expect(call[1]).toBe(Faction.Terran);
      // x and y should be numbers (spawn position near building)
      expect(typeof call[2]).toBe('number');
      expect(typeof call[3]).toBe('number');
    });

    it('resets production state after spawning', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.Complete,
        progress: 1.0,
        buildTime: 40,
        hp: 1000,
      }));
      buildState[building] = BuildState.Complete;
      prodUnitType[building] = UnitType.Marine;
      prodProgress[building] = 0.1;
      prodTimeTotal[building] = 18.0;

      productionSystem(world, 1.0, resources, map, spawnFn);

      expect(prodUnitType[building]).toBe(0);
      expect(prodProgress[building]).toBe(0);
      expect(prodTimeTotal[building]).toBe(0);
    });
  });

  // ── Supply tracking ──

  describe('supply tracking', () => {
    it('supply tracking is handled by spawnFn (not ProductionSystem)', () => {
      // Supply is tracked by Game.spawnUnitAt, not ProductionSystem.
      // ProductionSystem delegates spawning to spawnFn which handles supply.
      // With a mock spawnFn, supply is not incremented here.
      const startSupplyUsed = resources[Faction.Terran].supplyUsed;

      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.Complete,
        progress: 1.0,
        buildTime: 40,
        hp: 1000,
        factionId: Faction.Terran,
      }));
      buildState[building] = BuildState.Complete;
      prodUnitType[building] = UnitType.Marine;
      prodProgress[building] = 0.1;
      prodTimeTotal[building] = 18.0;

      // Use a spawnFn that also increments supply (mimicking real behavior)
      const realishSpawnFn = vi.fn((_type: number, _fac: number, _x: number, _y: number) => {
        resources[Faction.Terran].supplyUsed += 1;
        return 99;
      });

      productionSystem(world, 1.0, resources, map, realishSpawnFn);

      expect(resources[Faction.Terran].supplyUsed).toBe(startSupplyUsed + 1);
      expect(realishSpawnFn).toHaveBeenCalled();
    });
  });

  // ── No production when idle ──

  describe('no production conditions', () => {
    it('does nothing when prodUnitType === 0 (idle)', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.Complete,
        progress: 1.0,
        buildTime: 40,
        hp: 1000,
      }));
      buildState[building] = BuildState.Complete;
      prodUnitType[building] = 0; // no production queued
      prodProgress[building] = 0;

      productionSystem(world, 1.0, resources, map, spawnFn);

      expect(spawnFn).not.toHaveBeenCalled();
    });

    it('does nothing for buildings under construction', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.5,
        buildTime: 40,
        hp: 1000,
      }));
      // Building is still under construction
      prodUnitType[building] = UnitType.Marine;
      prodProgress[building] = 0.1;
      prodTimeTotal[building] = 18.0;

      productionSystem(world, 1.0, resources, map, spawnFn);

      expect(spawnFn).not.toHaveBeenCalled();
      // prodProgress should NOT have been decremented (system skips this entity)
      expect(prodProgress[building]).toBeCloseTo(0.1, 4);
    });
  });
});
