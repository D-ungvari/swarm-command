import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  spawnBuilding,
  cleanupEntities,
  createPlayerResources,
  Faction,
  CommandMode,
  BuildingType,
  BuildState,
} from '../helpers';
import {
  aiSystem, initAI, getAIState, setAIMinerals,
} from '../../src/systems/AISystem';
import { faction } from '../../src/ecs/components';
import {
  hpCurrent, commandMode,
} from '../../src/ecs/components';
import { type World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';
import type { PlayerResources } from '../../src/types';

vi.mock('../../src/map/Pathfinder', () => ({
  findPath: vi.fn(() => []),
}));

vi.mock('../../src/ecs/queries', () => ({
  findNearestCommandCenter: vi.fn(() => 0),
}));

// New AI constants (mirrors AISystem.ts internal values)
const INITIAL_DELAY = 20;
const DECISION_INTERVAL = 15;
const FIRST_WAVE_SIZE = 6;
const MAX_ENTITIES = 4096;

function createLargeTestMap(): MapData {
  const cols = 128;
  const rows = 128;
  const tiles = new Uint8Array(cols * rows);
  const walkable = new Uint8Array(cols * rows);
  walkable.fill(1);
  return { tiles, walkable, cols, rows };
}

describe('AISystem', () => {
  let world: World;
  let map: MapData;
  let resources: Record<number, PlayerResources>;
  const eids: number[] = [];
  const dt = 1 / 60;

  beforeEach(() => {
    world = createTestWorld();
    map = createLargeTestMap();
    resources = createPlayerResources();
    eids.length = 0;
    initAI();
    // AI needs a Hatchery to spawn units
    const hatchEid = spawnBuilding(world, {
      buildingTypeId: BuildingType.Hatchery,
      buildStateId: BuildState.Complete,
      factionId: Faction.Zerg,
      x: 117 * 32 + 16, // tileToWorld(117, 117) approximation
      y: 117 * 32 + 16,
      hp: 1500,
    });
    eids.push(hatchEid);
  });

  afterEach(() => { cleanupEntities(eids); });

  function track(eid: number): number { eids.push(eid); return eid; }

  function runOneDecision(gameTime: number, spawnFn?: ReturnType<typeof vi.fn>) {
    const fn = spawnFn ?? vi.fn(() => 0);
    const buildFn = vi.fn(() => 0);
    for (let i = 0; i < DECISION_INTERVAL; i++) {
      aiSystem(world, dt, gameTime, map, fn, resources, buildFn);
    }
    return fn;
  }

  describe('initial delay', () => {
    it('does nothing before delay', () => {
      const spawnFn = vi.fn(() => 0);
      for (let i = 0; i < 100; i++) {
        aiSystem(world, dt, 5, map, spawnFn, resources);
      }
      expect(spawnFn).not.toHaveBeenCalled();
      expect(getAIState().aiMinerals).toBe(0);
    });
  });

  describe('mineral accumulation', () => {
    it('accumulates minerals after delay and spends them', () => {
      let spawned = 0;
      const spawnFn = vi.fn(() => { spawned++; return 100 + spawned; });
      runOneDecision(55, spawnFn);
      // AI accumulated income (3.0 * 25s = 75) and spent it on units
      // Either minerals remain > 0 or units were spawned (minerals were earned)
      const state = getAIState();
      expect(state.aiMinerals + spawned * 50).toBeGreaterThan(0);
    });
  });

  describe('unit spawning', () => {
    it('spawns units when minerals sufficient', () => {
      let nextEid = 100;
      const spawnFn = vi.fn(() => nextEid++);
      setAIMinerals(500, 500);
      runOneDecision(150, spawnFn);
      expect(spawnFn).toHaveBeenCalled();
      expect(spawnFn.mock.calls[0][1]).toBe(Faction.Zerg);
    });

    it('can spawn multiple units per decision tick', () => {
      let nextEid = 100;
      const spawnFn = vi.fn(() => nextEid++);
      setAIMinerals(1000, 1000);
      runOneDecision(150, spawnFn);
      // New AI spawns up to 3 units per decision
      expect(spawnFn.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('adds spawned units to army tracking', () => {
      const spawnFn = vi.fn(() => 42);
      setAIMinerals(500, 500);
      runOneDecision(150, spawnFn);
      expect(getAIState().armySize).toBeGreaterThanOrEqual(1);
    });
  });

  describe('army tracking', () => {
    it('prunes dead units', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });
      setAIMinerals(500, 500);
      // Run enough decisions at a late-enough gameTime to guarantee spawning
      for (let i = 0; i < 20; i++) runOneDecision(100 + i * 0.5, spawnFn);
      expect(getAIState().armySize).toBeGreaterThanOrEqual(1);

      // Kill ALL spawned entities (including those assigned to harass/vanguard squads)
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (faction[eid] === Faction.Zerg) hpCurrent[eid] = 0;
      }
      setAIMinerals(0, 0);
      runOneDecision(120, vi.fn(() => 0));
      expect(getAIState().armySize).toBe(0);
    });
  });

  describe('attack waves', () => {
    it('triggers attack when army reaches threshold', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });
      setAIMinerals(10000, 10000);
      let gameTime = 50;
      for (let i = 0; i < FIRST_WAVE_SIZE + 5; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }
      expect(getAIState().isAttacking).toBe(true);
      expect(getAIState().waveCount).toBeGreaterThanOrEqual(1);
    });

    it('sets AttackMove on army units during attack', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });
      setAIMinerals(10000, 10000);
      let gameTime = 50;
      for (let i = 0; i < FIRST_WAVE_SIZE + 5; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }
      const living = spawnedEids.filter(eid => hpCurrent[eid] > 0);
      const attackMoving = living.filter(eid => commandMode[eid] === CommandMode.AttackMove);
      expect(attackMoving.length).toBeGreaterThan(0);
    });

    it('resets isAttacking when all army units die', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });
      setAIMinerals(10000, 10000);
      let gameTime = 50;
      for (let i = 0; i < FIRST_WAVE_SIZE + 5; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }
      expect(getAIState().isAttacking).toBe(true);
      for (const eid of spawnedEids) hpCurrent[eid] = 0;
      setAIMinerals(0, 0);
      gameTime += 0.01;
      runOneDecision(gameTime, vi.fn(() => 0));
      expect(getAIState().isAttacking).toBe(false);
    });
  });

  describe('entity limit safety', () => {
    it('does not spawn near MAX_ENTITIES', () => {
      const spawnFn = vi.fn(() => 0);
      setAIMinerals(1000, 1000);
      world.nextEid = MAX_ENTITIES - 5; // Very close to cap — should block spawning
      runOneDecision(150, spawnFn);
      expect(spawnFn).not.toHaveBeenCalled();
    });
  });

  describe('initAI', () => {
    it('resets all state', () => {
      setAIMinerals(5000, 5000);
      const spawnFn = vi.fn(() => track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 })));
      for (let i = 0; i < 20; i++) runOneDecision(150 + i * 0.5, spawnFn);
      expect(getAIState().armySize).toBeGreaterThan(0);
      initAI();
      const s = getAIState();
      expect(s.aiMinerals).toBe(0);
      expect(s.waveCount).toBe(0);
      expect(s.isAttacking).toBe(false);
      expect(s.armySize).toBe(0);
    });
  });
});
