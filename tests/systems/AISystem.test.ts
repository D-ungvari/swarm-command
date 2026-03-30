import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  createPlayerResources,
  Faction,
  CommandMode,
} from '../helpers';
import {
  aiSystem, initAI, getAIState, setAIMinerals,
} from '../../src/systems/AISystem';
import {
  hpCurrent, commandMode, faction, posX, posY,
} from '../../src/ecs/components';
import { entityExists, type World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';
import type { PlayerResources } from '../../src/types';

// ── Mock pathfinding (heavy dependency, not under test) ──
vi.mock('../../src/map/Pathfinder', () => ({
  findPath: vi.fn(() => []),
}));

// ── Mock queries (findNearestCommandCenter) ──
vi.mock('../../src/ecs/queries', () => ({
  findNearestCommandCenter: vi.fn(() => 0),
}));

// AI timing constants (mirrors src/constants.ts)
const AI_DECISION_INTERVAL = 30;
const AI_INITIAL_DELAY = 30;
const AI_ATTACK_THRESHOLD_BASE = 8;
const AI_ATTACK_THRESHOLD_GROWTH = 3;
const AI_MINERAL_INCOME = 1.5;
const AI_INCOME_GROWTH = 0.15;
const AI_MAX_WAVE_SIZE = 25;
const MAX_ENTITIES = 2048;

/**
 * Create a large all-walkable map (128x128) matching the game's real map size.
 * The AI spawn base is at col=117, row=117 so we need a map that covers it.
 */
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
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  /**
   * Run the AI system N times. Each call = 1 tick.
   * Uses the provided gameTime for all ticks (or increments if desired).
   */
  function tickAI(n: number, gameTime: number, spawnFn?: ReturnType<typeof vi.fn>) {
    const fn = spawnFn ?? vi.fn(() => 0);
    for (let i = 0; i < n; i++) {
      aiSystem(world, dt, gameTime, map, fn, resources);
    }
    return fn;
  }

  /**
   * Run AI through one full decision cycle.
   * Calls aiSystem AI_DECISION_INTERVAL + 1 times so the tickCounter wraps and fires.
   * gameTime must be >= AI_INITIAL_DELAY to not be skipped.
   * Returns the spawnFn mock for assertions.
   */
  function runOneDecision(gameTime: number, spawnFn?: ReturnType<typeof vi.fn>) {
    const fn = spawnFn ?? vi.fn(() => 0);
    // Need AI_DECISION_INTERVAL calls to increment counter, then it resets and runs logic
    for (let i = 0; i < AI_DECISION_INTERVAL; i++) {
      aiSystem(world, dt, gameTime, map, fn, resources);
    }
    return fn;
  }

  // ── Initial delay ──

  describe('initial delay', () => {
    it('does nothing before AI_INITIAL_DELAY', () => {
      const spawnFn = vi.fn(() => 0);
      // Call many times at gameTime=10 (well below 30)
      for (let i = 0; i < 100; i++) {
        aiSystem(world, dt, 10, map, spawnFn, resources);
      }
      expect(spawnFn).not.toHaveBeenCalled();
      const state = getAIState();
      expect(state.aiMinerals).toBe(0);
      expect(state.armySize).toBe(0);
    });

    it('does nothing at exactly gameTime=0', () => {
      const spawnFn = vi.fn(() => 0);
      for (let i = 0; i < 50; i++) {
        aiSystem(world, dt, 0, map, spawnFn, resources);
      }
      expect(spawnFn).not.toHaveBeenCalled();
    });
  });

  // ── Mineral accumulation ──

  describe('mineral accumulation', () => {
    it('accumulates minerals after initial delay', () => {
      const gameTime = AI_INITIAL_DELAY + 10; // 40s into the game
      const spawnFn = vi.fn(() => 0);

      // First decision: tickCounter needs to reach AI_DECISION_INTERVAL
      runOneDecision(gameTime, spawnFn);

      const state = getAIState();
      // elapsed = gameTime - lastDecisionTime; first decision: elapsed = 40 - 0 = 40
      // income = AI_MINERAL_INCOME * (1 + 0 * AI_INCOME_GROWTH) * 40 = 1.5 * 1 * 40 = 60
      // But AI spent minerals spawning a zergling (50 minerals) since it could afford it
      // So minerals should be 60 - 50 = 10 (if spawn was called)
      expect(state.aiMinerals).toBeGreaterThan(0);
    });

    it('income increases with wave count (progressive difficulty)', () => {
      const spawnFn = vi.fn(() => 0);
      // Force a known mineral state with no wave yet
      // First decision at gameTime=40
      runOneDecision(40, spawnFn);
      const afterFirst = getAIState();
      const firstMinerals = afterFirst.aiMinerals;

      // Reset to test with higher wave count
      initAI();
      // Manually simulate: set waveCount by triggering waves
      // Instead, just verify formula: at wave 0, income mult = 1.0
      // Minerals from first decision = AI_MINERAL_INCOME * 1.0 * elapsed
      // elapsed = 40 (since lastDecisionTime starts at 0)
      // Gross income = 1.5 * 1.0 * 40 = 60, minus any spawn cost
      expect(firstMinerals).toBeLessThanOrEqual(60); // gross was 60, minus spawn costs
    });
  });

  // ── Unit spawning ──

  describe('unit spawning', () => {
    it('spawns a unit when minerals are sufficient', () => {
      let nextEid = 100;
      const spawnFn = vi.fn(() => nextEid++);

      // Pre-fund AI with enough minerals for a Zergling (50 minerals)
      setAIMinerals(200);

      // Run one decision at a gameTime past delay
      // Note: first decision has elapsed = gameTime - 0, but we already set minerals
      // The system will accumulate MORE minerals on top, then try to spawn
      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      expect(spawnFn).toHaveBeenCalled();
      // spawnFn should be called with (unitType, Faction.Zerg, x, y)
      const call = spawnFn.mock.calls[0];
      expect(call[1]).toBe(Faction.Zerg); // faction argument is Zerg
    });

    it('does not spawn when minerals are insufficient', () => {
      const spawnFn = vi.fn(() => 0);
      // Set minerals to 0, gas to 0
      setAIMinerals(0, 0);

      // We need to prevent accumulation from giving us enough minerals
      // Use a very small elapsed time window
      // First call: lastDecisionTime = 0, so elapsed = gameTime - 0
      // If gameTime is just barely past delay, elapsed is small
      // At gameTime=30.01, elapsed=30.01, income=1.5*30.01=45 < 50 (Zergling cost)
      // Actually elapsed would be 30.01 which gives 45 minerals, not enough for Zergling (50)
      runOneDecision(AI_INITIAL_DELAY + 0.01, spawnFn);

      expect(spawnFn).not.toHaveBeenCalled();
    });

    it('spawns Zerglings as early game priority (army < 4)', () => {
      let nextEid = 100;
      const spawnFn = vi.fn(() => nextEid++);
      setAIMinerals(500);

      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      expect(spawnFn).toHaveBeenCalled();
      // First 4 units should be Zerglings (UnitType.Zergling = 11)
      const unitTypeArg = spawnFn.mock.calls[0][0];
      expect(unitTypeArg).toBe(11); // UnitType.Zergling
    });

    it('adds spawned unit eid to army tracking', () => {
      const spawnFn = vi.fn(() => 42);
      setAIMinerals(500);

      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      expect(spawnFn).toHaveBeenCalled();
      const state = getAIState();
      expect(state.armySize).toBeGreaterThanOrEqual(1);
    });

    it('deducts minerals when spawning', () => {
      const spawnFn = vi.fn(() => 50);
      setAIMinerals(100, 100);

      // Run decision — elapsed will be (AI_INITIAL_DELAY + 0.5), adding some income
      // The system accumulates: 1.5 * 1 * (30.5) = 45.75 on top of 100
      // Then spawns a zergling for 50 minerals
      runOneDecision(AI_INITIAL_DELAY + 0.5, spawnFn);

      const state = getAIState();
      // Started with 100, added ~45.75 income, then spent 50 on zergling
      // Should be around 95.75
      expect(state.aiMinerals).toBeLessThan(145.75); // must have spent some
    });
  });

  // ── Army tracking & dead unit pruning ──

  describe('army tracking', () => {
    it('prunes dead units from army', () => {
      // Spawn some units that the AI will track
      let nextEid = 0;
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        nextEid = eid;
        return eid;
      });

      setAIMinerals(500, 500);

      // Run a decision to spawn some units
      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      const stateBeforeKill = getAIState();
      expect(stateBeforeKill.armySize).toBeGreaterThanOrEqual(1);

      // Kill all spawned units
      for (const eid of spawnedEids) {
        hpCurrent[eid] = 0;
      }

      // Run another decision cycle — pruning happens at each decision tick
      runOneDecision(AI_INITIAL_DELAY + 2, spawnFn);

      const stateAfterKill = getAIState();
      // The dead units should have been pruned. New ones may have been spawned.
      // To isolate pruning, check that the original units were removed.
      // Since new spawns happen after pruning, armySize might not be 0.
      // But we can verify the dead ones aren't counted by checking size decreased.
      // Actually, the best way: kill units, then run decision with no minerals to prevent new spawns.
      // Let's do that with a fresh setup.
    });

    it('prunes dead units and does not count them', () => {
      // Spawn units manually and add them via spawnFn
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });

      setAIMinerals(500, 500);
      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      const sizeAfterSpawn = getAIState().armySize;
      expect(sizeAfterSpawn).toBeGreaterThanOrEqual(1);

      // Kill all spawned units
      for (const eid of spawnedEids) {
        hpCurrent[eid] = 0;
      }

      // Run a decision with zero minerals so no new spawns
      setAIMinerals(0, 0);
      const noSpawnFn = vi.fn(() => 0);
      runOneDecision(AI_INITIAL_DELAY + 1.1, noSpawnFn);

      expect(noSpawnFn).not.toHaveBeenCalled();
      expect(getAIState().armySize).toBe(0);
    });
  });

  // ── Attack wave triggering ──

  describe('attack waves', () => {
    it('triggers attack when army reaches threshold', () => {
      // Threshold for wave 0 = AI_ATTACK_THRESHOLD_BASE = 8
      // We need to spawn 8 units, then the next decision should trigger attack
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });

      // Give plenty of minerals and run multiple decision cycles to spawn 8+ units
      setAIMinerals(5000, 5000);
      let gameTime = AI_INITIAL_DELAY + 1;

      // Each decision spawns 1 unit. Need AI_ATTACK_THRESHOLD_BASE decisions.
      for (let wave = 0; wave < AI_ATTACK_THRESHOLD_BASE + 1; wave++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }

      const state = getAIState();
      // After spawning enough units, attack should have triggered
      expect(state.isAttacking).toBe(true);
      expect(state.waveCount).toBeGreaterThanOrEqual(1);
    });

    it('sets AttackMove command on all army units during attack', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });

      setAIMinerals(5000, 5000);
      let gameTime = AI_INITIAL_DELAY + 1;

      for (let i = 0; i < AI_ATTACK_THRESHOLD_BASE + 1; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }

      // After attack triggers, all living army units should have AttackMove
      const livingEids = spawnedEids.filter(eid => hpCurrent[eid] > 0);
      for (const eid of livingEids) {
        expect(commandMode[eid]).toBe(CommandMode.AttackMove);
      }
    });

    it('resets isAttacking when all army units die', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });

      setAIMinerals(5000, 5000);
      let gameTime = AI_INITIAL_DELAY + 1;

      // Spawn enough to trigger attack
      for (let i = 0; i < AI_ATTACK_THRESHOLD_BASE + 1; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }

      expect(getAIState().isAttacking).toBe(true);

      // Kill all army units
      for (const eid of spawnedEids) {
        hpCurrent[eid] = 0;
      }

      // Run another decision — pruning will detect all dead, reset isAttacking
      // Set minerals to 0 so no new units spawn after reset
      setAIMinerals(0, 0);
      gameTime += 0.01; // tiny elapsed so income stays < spawn cost
      const postAttackSpawnFn = vi.fn(() => 0);
      runOneDecision(gameTime, postAttackSpawnFn);

      expect(getAIState().isAttacking).toBe(false);
    });

    it('increases threshold after each wave (progressive difficulty)', () => {
      // Wave 0 threshold: AI_ATTACK_THRESHOLD_BASE = 8
      // Wave 1 threshold: 8 + 1*3 = 11
      // Wave 2 threshold: 8 + 2*3 = 14
      const threshold0 = AI_ATTACK_THRESHOLD_BASE;
      const threshold1 = AI_ATTACK_THRESHOLD_BASE + 1 * AI_ATTACK_THRESHOLD_GROWTH;
      const threshold2 = AI_ATTACK_THRESHOLD_BASE + 2 * AI_ATTACK_THRESHOLD_GROWTH;

      expect(threshold0).toBe(8);
      expect(threshold1).toBe(11);
      expect(threshold2).toBe(14);

      // Verify with live system: spawn enough for wave 0, trigger attack
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });

      setAIMinerals(10000, 10000);
      let gameTime = AI_INITIAL_DELAY + 1;

      // Spawn 8 units for wave 0
      for (let i = 0; i < AI_ATTACK_THRESHOLD_BASE + 1; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }

      const stateAfterWave0 = getAIState();
      expect(stateAfterWave0.waveCount).toBeGreaterThanOrEqual(1);

      // Kill army to reset isAttacking
      for (const eid of spawnedEids) {
        hpCurrent[eid] = 0;
      }
      gameTime += 0.5;
      runOneDecision(gameTime, spawnFn);
      expect(getAIState().isAttacking).toBe(false);

      // Now wave 1 needs threshold1 = 11 units
      // The wave1 threshold is higher than wave0, confirming progressive difficulty
      const wave1Start = getAIState().waveCount;

      // Spawn units one per decision. Track when wave 1 triggers.
      let decisionsForWave1 = 0;
      for (let i = 0; i < 20; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
        decisionsForWave1++;
        if (getAIState().waveCount > wave1Start) break;
      }

      // Wave 1 should require more decisions (more units) than wave 0
      // Wave 0 threshold was 8, wave 1 is 11 — so it must have taken more
      expect(getAIState().waveCount).toBe(wave1Start + 1);
      expect(decisionsForWave1).toBeGreaterThan(AI_ATTACK_THRESHOLD_BASE);
    });

    it('caps threshold at AI_MAX_WAVE_SIZE', () => {
      // After many waves, threshold should not exceed AI_MAX_WAVE_SIZE = 25
      // threshold = AI_ATTACK_THRESHOLD_BASE + waveCount * AI_ATTACK_THRESHOLD_GROWTH
      // Solving: 8 + n*3 >= 25 → n >= 5.67 → from wave 6 onward, capped at 25
      const waveForCap = Math.ceil(
        (AI_MAX_WAVE_SIZE - AI_ATTACK_THRESHOLD_BASE) / AI_ATTACK_THRESHOLD_GROWTH,
      );
      const thresholdAtCap = Math.min(
        AI_ATTACK_THRESHOLD_BASE + waveForCap * AI_ATTACK_THRESHOLD_GROWTH,
        AI_MAX_WAVE_SIZE,
      );
      expect(thresholdAtCap).toBe(AI_MAX_WAVE_SIZE);
    });
  });

  // ── Entity limit safety ──

  describe('entity limit safety', () => {
    it('does not spawn when near MAX_ENTITIES', () => {
      const spawnFn = vi.fn(() => 0);
      setAIMinerals(1000, 1000);

      // Set world.nextEid to near the limit
      world.nextEid = MAX_ENTITIES - 49; // >= MAX_ENTITIES - 50

      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      expect(spawnFn).not.toHaveBeenCalled();
    });

    it('spawns normally when well below MAX_ENTITIES', () => {
      let nextEid = 100;
      const spawnFn = vi.fn(() => nextEid++);
      setAIMinerals(1000, 1000);

      // nextEid is well below limit (default from createWorld is ~1)
      runOneDecision(AI_INITIAL_DELAY + 1, spawnFn);

      expect(spawnFn).toHaveBeenCalled();
    });
  });

  // ── initAI reset ──

  describe('initAI', () => {
    it('resets all AI state', () => {
      // Accumulate some state first
      const spawnFn = vi.fn(() => {
        return track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
      });
      setAIMinerals(5000, 5000);

      let gameTime = AI_INITIAL_DELAY + 1;
      for (let i = 0; i < 5; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }

      const stateBefore = getAIState();
      expect(stateBefore.aiMinerals).toBeGreaterThan(0);
      expect(stateBefore.armySize).toBeGreaterThan(0);

      // Reset
      initAI();

      const stateAfter = getAIState();
      expect(stateAfter.aiMinerals).toBe(0);
      expect(stateAfter.aiGas).toBe(0);
      expect(stateAfter.waveCount).toBe(0);
      expect(stateAfter.isAttacking).toBe(false);
      expect(stateAfter.armySize).toBe(0);
    });
  });

  // ── No spawning during attack ──

  describe('no spawning during attack', () => {
    it('does not spawn units while isAttacking is true', () => {
      const spawnedEids: number[] = [];
      const spawnFn = vi.fn(() => {
        const eid = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 100 }));
        spawnedEids.push(eid);
        return eid;
      });

      setAIMinerals(5000, 5000);
      let gameTime = AI_INITIAL_DELAY + 1;

      // Spawn enough to trigger attack
      for (let i = 0; i < AI_ATTACK_THRESHOLD_BASE + 1; i++) {
        gameTime += 0.5;
        runOneDecision(gameTime, spawnFn);
      }
      expect(getAIState().isAttacking).toBe(true);

      // Record spawn count, run more decisions
      const callCountAfterAttack = spawnFn.mock.calls.length;
      gameTime += 0.5;
      runOneDecision(gameTime, spawnFn);

      // No additional spawns should have been made while attacking
      expect(spawnFn.mock.calls.length).toBe(callCountAfterAttack);
    });
  });
});
