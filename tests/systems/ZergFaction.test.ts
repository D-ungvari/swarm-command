import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  spawnBuilding,
  cleanupEntities,
  createTestMap,
  createPlayerResources,
  Faction,
  BuildingType,
  BuildState,
  CommandType,
} from '../helpers';
import { productionSystem } from '../../src/systems/ProductionSystem';
import { abilitySystem } from '../../src/systems/AbilitySystem';
import { commandSystem } from '../../src/systems/CommandSystem';
import { selectionSystem } from '../../src/systems/SelectionSystem';
import {
  larvaCount,
  larvaRegenTimer,
  buildingType,
  buildState,
  faction,
  energy,
  unitType,
  injectTimer,
  selected,
} from '../../src/ecs/components';
import type { World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';
import type { PlayerResources } from '../../src/types';

// UnitType.Queen = 16 (const enum erased at compile time, use numeric value)
const QUEEN_UNIT_TYPE = 16;

function mockViewport() {
  return {
    toWorld: (x: number, y: number) => ({ x, y }),
    toScreen: (x: number, y: number) => ({ x, y }),
    screenWidth: 1920,
    screenHeight: 1080,
  } as any;
}

describe('ZergFaction', () => {
  let world: World;
  let map: MapData;
  let resources: Record<number, PlayerResources>;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    map = createTestMap();
    resources = createPlayerResources();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  // ── Group 1: Larva regeneration ──

  describe('Larva regeneration', () => {
    it('regenerates larva after 11 seconds', () => {
      const hatchEid = track(spawnBuilding(world, {
        buildingTypeId: BuildingType.Hatchery,
        buildStateId: BuildState.Complete,
        factionId: Faction.Zerg,
      }));
      larvaCount[hatchEid] = 2;
      larvaRegenTimer[hatchEid] = 11.0;

      productionSystem(world, 11.1, resources, map, vi.fn().mockReturnValue(0), 0);

      expect(larvaCount[hatchEid]).toBe(3);
    });

    it('does NOT exceed LARVA_MAX (3)', () => {
      const hatchEid = track(spawnBuilding(world, {
        buildingTypeId: BuildingType.Hatchery,
        buildStateId: BuildState.Complete,
        factionId: Faction.Zerg,
      }));
      larvaCount[hatchEid] = 3;
      larvaRegenTimer[hatchEid] = 0;

      productionSystem(world, 12, resources, map, vi.fn().mockReturnValue(0), 0);

      expect(larvaCount[hatchEid]).toBe(3);
    });

    it('does NOT regen when timer has not expired', () => {
      const hatchEid = track(spawnBuilding(world, {
        buildingTypeId: BuildingType.Hatchery,
        buildStateId: BuildState.Complete,
        factionId: Faction.Zerg,
      }));
      larvaCount[hatchEid] = 1;
      larvaRegenTimer[hatchEid] = 5.0;

      // dt=3 → timer goes to 2.0, not yet expired
      productionSystem(world, 3, resources, map, vi.fn().mockReturnValue(0), 0);

      expect(larvaCount[hatchEid]).toBe(1);
    });
  });

  // ── Group 2: Queen energy ──

  describe('Queen energy', () => {
    it('Queen gains energy over time', () => {
      const queen = track(spawnUnit(world, {
        factionId: Faction.Zerg,
        unitTypeId: QUEEN_UNIT_TYPE,
      }));
      energy[queen] = 50;

      abilitySystem(world, 10, 1);

      expect(energy[queen]).toBeGreaterThan(50);
    });

    it('Queen energy is capped at 200', () => {
      const queen = track(spawnUnit(world, {
        factionId: Faction.Zerg,
        unitTypeId: QUEEN_UNIT_TYPE,
      }));
      energy[queen] = 199;

      abilitySystem(world, 100, 1);

      expect(energy[queen]).toBe(200);
    });
  });

  // ── Group 3: InjectLarva command ──

  describe('InjectLarva command', () => {
    it('sets injectTimer on nearest Hatchery and deducts Queen energy', () => {
      const queen = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: QUEEN_UNIT_TYPE,
      }));
      energy[queen] = 50;

      const hatchEid = track(spawnBuilding(world, {
        x: 150, y: 150,
        buildingTypeId: BuildingType.Hatchery,
        buildStateId: BuildState.Complete,
        factionId: Faction.Zerg,
      }));
      injectTimer[hatchEid] = 0;

      commandSystem(
        world,
        [{ type: CommandType.InjectLarva, units: [queen] }],
        mockViewport(),
        map,
        1,
        resources,
      );

      expect(injectTimer[hatchEid]).toBeGreaterThan(0);
      expect(energy[queen]).toBeLessThan(50);
    });

    it('does nothing if Queen energy < 25', () => {
      const queen = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: QUEEN_UNIT_TYPE,
      }));
      energy[queen] = 10;

      const hatchEid = track(spawnBuilding(world, {
        x: 150, y: 150,
        buildingTypeId: BuildingType.Hatchery,
        buildStateId: BuildState.Complete,
        factionId: Faction.Zerg,
      }));
      injectTimer[hatchEid] = 0;

      commandSystem(
        world,
        [{ type: CommandType.InjectLarva, units: [queen] }],
        mockViewport(),
        map,
        1,
        resources,
      );

      expect(injectTimer[hatchEid]).toBe(0);
    });
  });

  // ── Group 4: SelectionSystem with Zerg playerFaction ──

  describe('SelectionSystem with Zerg playerFaction', () => {
    it('Zerg player can select Zerg units', () => {
      const zergling = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
      }));

      selectionSystem(
        world,
        [{ type: CommandType.Select, sx: 100, sy: 100 }],
        mockViewport(),
        Faction.Zerg as any,
      );

      expect(selected[zergling]).toBe(1);
    });

    it('Zerg player cannot select Terran units via box select', () => {
      const marine = track(spawnUnit(world, {
        x: 150, y: 150,
        factionId: Faction.Terran,
      }));

      selectionSystem(
        world,
        [{ type: CommandType.BoxSelect, sx: 140, sy: 140, sx2: 160, sy2: 160 }],
        mockViewport(),
        Faction.Zerg as any,
      );

      expect(selected[marine]).toBe(0);
    });
  });
});
