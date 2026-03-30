import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnWorker,
  spawnResource,
  cleanupEntities,
  createTestMap,
  createPlayerResources,
  Faction,
  UnitType,
  ResourceType,
  WorkerState,
} from '../helpers';
import { gatherSystem } from '../../src/systems/GatherSystem';
import {
  posX, posY,
  hpCurrent,
  movePathIndex,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  resourceRemaining,
  faction,
} from '../../src/ecs/components';
import { type World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';
import type { PlayerResources } from '../../src/types';

describe('GatherSystem', () => {
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

  // ── MovingToResource → Mining transition ──

  describe('MovingToResource → Mining', () => {
    it('transitions to Mining when worker is within WORKER_MINE_RANGE (48px)', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 180, y: 200 }));

      // Set worker to MovingToResource state, targeting the mineral
      workerState[worker] = WorkerState.MovingToResource;
      workerTargetEid[worker] = mineral;
      movePathIndex[worker] = -1; // arrived (no active path)

      // Distance = 20px, which is within 48px range
      gatherSystem(world, 1 / 60, map, resources);

      expect(workerState[worker]).toBe(WorkerState.Mining);
      expect(workerMineTimer[worker]).toBeCloseTo(1.5); // MINE_DURATION
      expect(movePathIndex[worker]).toBe(-1); // movement stopped
    });

    it('stays in MovingToResource when outside WORKER_MINE_RANGE', () => {
      const mineral = track(spawnResource(world, { x: 300, y: 300, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 100, y: 100 }));

      workerState[worker] = WorkerState.MovingToResource;
      workerTargetEid[worker] = mineral;
      // Worker is still walking (has active path)
      movePathIndex[worker] = 2;

      // Distance ≈ 283px, well outside 48px range
      gatherSystem(world, 1 / 60, map, resources);

      expect(workerState[worker]).toBe(WorkerState.MovingToResource);
    });
  });

  // ── Mining countdown ──

  describe('Mining state', () => {
    it('counts down workerMineTimer by dt each tick', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 190, y: 200 }));

      workerState[worker] = WorkerState.Mining;
      workerTargetEid[worker] = mineral;
      workerMineTimer[worker] = 1.0;

      const dt = 1 / 60;
      gatherSystem(world, dt, map, resources);

      expect(workerMineTimer[worker]).toBeCloseTo(1.0 - dt, 4);
      expect(workerState[worker]).toBe(WorkerState.Mining); // still mining
    });

    it('transitions to ReturningToBase when timer expires, carrying correct amount', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 190, y: 200 }));

      workerState[worker] = WorkerState.Mining;
      workerTargetEid[worker] = mineral;
      workerMineTimer[worker] = 0.01; // about to expire

      // Tick with dt large enough to expire the timer
      gatherSystem(world, 0.1, map, resources);

      expect(workerState[worker]).toBe(WorkerState.ReturningToBase);
      expect(workerCarrying[worker]).toBe(5); // WORKER_CARRY_MINERALS
    });
  });

  // ── ReturningToBase → deposit ──

  describe('ReturningToBase → deposit', () => {
    it('deposits minerals into player resources when near base', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 52, y: 52, baseX: 50, baseY: 50 }));

      workerState[worker] = WorkerState.ReturningToBase;
      workerTargetEid[worker] = mineral;
      workerCarrying[worker] = 5;
      movePathIndex[worker] = -1; // arrived at base

      const startMinerals = resources[Faction.Terran].minerals;
      gatherSystem(world, 1 / 60, map, resources);

      expect(workerCarrying[worker]).toBe(0);
      expect(resources[Faction.Terran].minerals).toBe(startMinerals + 5);
    });

    it('loops back to MovingToResource after depositing', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 50, y: 50, baseX: 50, baseY: 50 }));

      workerState[worker] = WorkerState.ReturningToBase;
      workerTargetEid[worker] = mineral;
      workerCarrying[worker] = 5;
      movePathIndex[worker] = -1;

      gatherSystem(world, 1 / 60, map, resources);

      expect(workerState[worker]).toBe(WorkerState.MovingToResource);
      expect(workerCarrying[worker]).toBe(0);
    });
  });

  // ── Resource depletion ──

  describe('resource depletion', () => {
    it('decreases mineral patch resourceRemaining by carry amount', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 190, y: 200 }));

      workerState[worker] = WorkerState.Mining;
      workerTargetEid[worker] = mineral;
      workerMineTimer[worker] = 0.01;

      gatherSystem(world, 0.1, map, resources);

      expect(resourceRemaining[mineral]).toBe(1495); // 1500 - 5
    });

    it('decreases hpCurrent in sync with resourceRemaining', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 190, y: 200 }));

      workerState[worker] = WorkerState.Mining;
      workerTargetEid[worker] = mineral;
      workerMineTimer[worker] = 0.01;

      const hpBefore = hpCurrent[mineral];
      gatherSystem(world, 0.1, map, resources);

      expect(hpCurrent[mineral]).toBe(hpBefore - 5); // WORKER_CARRY_MINERALS
      expect(hpCurrent[mineral]).toBe(resourceRemaining[mineral]); // stays in sync
    });

    it('caps carry amount at remaining minerals on last trip', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 3 }));
      const worker = track(spawnWorker(world, { x: 190, y: 200 }));

      workerState[worker] = WorkerState.Mining;
      workerTargetEid[worker] = mineral;
      workerMineTimer[worker] = 0.01;

      gatherSystem(world, 0.1, map, resources);

      expect(workerCarrying[worker]).toBe(3); // capped at remaining, not 5
      expect(resourceRemaining[mineral]).toBe(0);
      expect(hpCurrent[mineral]).toBe(0);
    });
  });

  // ── Worker retargeting ──

  describe('worker retargeting', () => {
    it('retargets to nearest mineral when original patch depleted', () => {
      // Depleted mineral
      const depleted = track(spawnResource(world, { x: 200, y: 200, remaining: 0 }));
      hpCurrent[depleted] = 0;
      // Fresh mineral nearby
      const fresh = track(spawnResource(world, { x: 250, y: 200, remaining: 1500 }));

      const worker = track(spawnWorker(world, { x: 190, y: 200 }));
      workerState[worker] = WorkerState.MovingToResource;
      workerTargetEid[worker] = depleted;
      movePathIndex[worker] = -1;

      gatherSystem(world, 1 / 60, map, resources);

      expect(workerTargetEid[worker]).toBe(fresh);
    });

    it('goes idle when no minerals available', () => {
      // Only depleted mineral in the world
      const depleted = track(spawnResource(world, { x: 200, y: 200, remaining: 0 }));
      hpCurrent[depleted] = 0;

      const worker = track(spawnWorker(world, { x: 190, y: 200 }));
      workerState[worker] = WorkerState.MovingToResource;
      workerTargetEid[worker] = depleted;
      movePathIndex[worker] = -1;

      gatherSystem(world, 1 / 60, map, resources);

      expect(workerState[worker]).toBe(WorkerState.Idle);
      expect(workerTargetEid[worker]).toBe(-1);
    });

    it('retargets after depositing when original patch is depleted', () => {
      // Depleted mineral
      const depleted = track(spawnResource(world, { x: 200, y: 200, remaining: 0 }));
      hpCurrent[depleted] = 0;
      // Fresh mineral nearby
      const fresh = track(spawnResource(world, { x: 250, y: 200, remaining: 1500 }));

      const worker = track(spawnWorker(world, { x: 50, y: 50, baseX: 50, baseY: 50 }));
      workerState[worker] = WorkerState.ReturningToBase;
      workerTargetEid[worker] = depleted;
      workerCarrying[worker] = 5;
      movePathIndex[worker] = -1;

      gatherSystem(world, 1 / 60, map, resources);

      expect(workerTargetEid[worker]).toBe(fresh);
      expect(workerState[worker]).toBe(WorkerState.MovingToResource);
    });

    it('goes idle after depositing when no minerals remain', () => {
      // Only depleted mineral
      const depleted = track(spawnResource(world, { x: 200, y: 200, remaining: 0 }));
      hpCurrent[depleted] = 0;

      const worker = track(spawnWorker(world, { x: 50, y: 50, baseX: 50, baseY: 50 }));
      workerState[worker] = WorkerState.ReturningToBase;
      workerTargetEid[worker] = depleted;
      workerCarrying[worker] = 5;
      movePathIndex[worker] = -1;

      gatherSystem(world, 1 / 60, map, resources);

      expect(workerState[worker]).toBe(WorkerState.Idle);
      expect(workerTargetEid[worker]).toBe(-1);
      // Minerals should still have been deposited
      expect(resources[Faction.Terran].minerals).toBe(55); // 50 + 5
    });
  });

  // ── Multiple workers ──

  describe('multiple workers', () => {
    it('multiple workers can mine the same patch', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));

      const worker1 = track(spawnWorker(world, { x: 190, y: 200 }));
      const worker2 = track(spawnWorker(world, { x: 195, y: 205 }));

      // Both workers mining the same patch, timers about to expire
      workerState[worker1] = WorkerState.Mining;
      workerTargetEid[worker1] = mineral;
      workerMineTimer[worker1] = 0.01;

      workerState[worker2] = WorkerState.Mining;
      workerTargetEid[worker2] = mineral;
      workerMineTimer[worker2] = 0.01;

      gatherSystem(world, 0.1, map, resources);

      // Both should now be returning
      expect(workerState[worker1]).toBe(WorkerState.ReturningToBase);
      expect(workerState[worker2]).toBe(WorkerState.ReturningToBase);
      expect(workerCarrying[worker1]).toBe(5);
      expect(workerCarrying[worker2]).toBe(5);
      expect(resourceRemaining[mineral]).toBe(1490); // 1500 - 5 - 5
    });
  });

  // ── Idle workers are skipped ──

  describe('idle workers', () => {
    it('does not process idle workers', () => {
      const mineral = track(spawnResource(world, { x: 200, y: 200, remaining: 1500 }));
      const worker = track(spawnWorker(world, { x: 190, y: 200 }));

      // Worker is idle (default)
      workerState[worker] = WorkerState.Idle;
      workerTargetEid[worker] = mineral;

      gatherSystem(world, 1 / 60, map, resources);

      // Should remain idle, no state change
      expect(workerState[worker]).toBe(WorkerState.Idle);
    });
  });
});
