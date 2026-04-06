import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnBuilding,
  spawnWorker,
  cleanupEntities,
  createPlayerResources,
  Faction,
  BuildingType,
  BuildState,
  WorkerState,
  CommandMode,
} from '../helpers';
import { buildSystem } from '../../src/systems/BuildSystem';
import {
  posX, posY,
  hpCurrent, hpMax,
  buildState, buildProgress, buildTimeTotal, builderEid,
  commandMode, workerState, workerTargetEid,
  supplyProvided,
} from '../../src/ecs/components';
import { type World } from '../../src/ecs/world';
import type { PlayerResources } from '../../src/types';

describe('BuildSystem', () => {
  let world: World;
  let resources: Record<number, PlayerResources>;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
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

  // ── Construction progress ──

  describe('construction progress', () => {
    it('increments progress by dt/buildTimeTotal when builder is adjacent', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0,
        buildTime: 40,
        hp: 1000,
      }));

      // Spawn SCV builder close to the building (within WORKER_MINE_RANGE * 2 = 96px)
      const scv = track(spawnWorker(world, { x: 220, y: 200 }));
      builderEid[building] = scv;

      const dt = 1.0; // 1 second
      buildSystem(world, dt, resources);

      // Expected progress: 0 + 1.0/40 = 0.025
      expect(buildProgress[building]).toBeCloseTo(1.0 / 40, 4);
    });

    it('does NOT progress when builder is absent (builderEid = -1)', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.5,
        buildTime: 40,
      }));
      // No builder assigned
      builderEid[building] = -1;

      buildSystem(world, 1.0, resources);

      expect(buildProgress[building]).toBeCloseTo(0.5, 4);
    });

    it('does NOT progress when builder is too far away', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.3,
        buildTime: 40,
      }));

      // Spawn SCV far from building (distance = 500px, well beyond 96px range)
      const scv = track(spawnWorker(world, { x: 700, y: 200 }));
      builderEid[building] = scv;

      buildSystem(world, 1.0, resources);

      expect(buildProgress[building]).toBeCloseTo(0.3, 4);
    });
  });

  // ── Building completion ──

  describe('building completion', () => {
    it('transitions to Complete when progress >= 1.0', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.98,
        buildTime: 40,
        hp: 1000,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;

      // dt = 2.0s, increment = 2.0/40 = 0.05, total = 0.98 + 0.05 = 1.03 -> clamped to 1.0
      buildSystem(world, 2.0, resources);

      expect(buildState[building]).toBe(BuildState.Complete);
      expect(buildProgress[building]).toBe(1.0);
    });

    it('sets HP to hpMax on completion', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.99,
        buildTime: 40,
        hp: 1000,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;

      buildSystem(world, 2.0, resources);

      expect(hpCurrent[building]).toBe(hpMax[building]);
      expect(hpCurrent[building]).toBe(1000);
    });
  });

  // ── HP scales with progress ──

  describe('HP scaling during construction', () => {
    it('HP = (0.1 + 0.9 * progress) * hpMax during construction', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0,
        buildTime: 40,
        hp: 1000,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;

      // dt = 20s -> progress = 20/40 = 0.5
      buildSystem(world, 20, resources);

      const expectedHp = 1000 * (0.1 + 0.9 * 0.5); // 550
      expect(hpCurrent[building]).toBeCloseTo(expectedHp, 0);
      expect(buildProgress[building]).toBeCloseTo(0.5, 4);
    });
  });

  // ── Builder release ──

  describe('builder SCV release', () => {
    it('sets builder SCV to Idle command and worker state on completion', () => {
      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.99,
        buildTime: 40,
        hp: 1000,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;
      commandMode[scv] = CommandMode.Build;
      workerState[scv] = CommandMode.Build as number; // in build mode

      buildSystem(world, 2.0, resources);

      expect(commandMode[scv]).toBe(CommandMode.Idle);
      expect(workerState[scv]).toBe(WorkerState.Idle);
      expect(workerTargetEid[scv]).toBe(-1);
      expect(builderEid[building]).toBe(-1);
    });
  });

  // ── Supply granting ──

  describe('supply granting', () => {
    it('SupplyDepot grants supplyProvided to player resources on completion', () => {
      const startingSupply = resources[Faction.Terran].supplyProvided;

      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.SupplyDepot,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.99,
        buildTime: 20,
        hp: 400,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;

      buildSystem(world, 2.0, resources);

      // SupplyDepot provides 8 supply
      expect(resources[Faction.Terran].supplyProvided).toBe(startingSupply + 8);
      expect(supplyProvided[building]).toBe(8);
    });

    it('Barracks does NOT grant supply on completion', () => {
      const startingSupply = resources[Faction.Terran].supplyProvided;

      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.Barracks,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.99,
        buildTime: 40,
        hp: 1000,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;

      buildSystem(world, 2.0, resources);

      expect(resources[Faction.Terran].supplyProvided).toBe(startingSupply);
      expect(supplyProvided[building]).toBe(0);
    });

    it('CommandCenter grants 15 supply on completion', () => {
      const startingSupply = resources[Faction.Terran].supplyProvided;

      const building = track(spawnBuilding(world, {
        x: 200, y: 200,
        buildingTypeId: BuildingType.CommandCenter,
        buildStateId: BuildState.UnderConstruction,
        progress: 0.99,
        buildTime: 60,
        hp: 1500,
      }));

      const scv = track(spawnWorker(world, { x: 210, y: 200 }));
      builderEid[building] = scv;

      buildSystem(world, 2.0, resources);

      expect(resources[Faction.Terran].supplyProvided).toBe(startingSupply + 15);
      expect(supplyProvided[building]).toBe(15);
    });
  });
});
