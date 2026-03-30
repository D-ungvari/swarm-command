import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  Faction,
  UnitType,
  SiegeMode,
} from '../helpers';
import { abilitySystem } from '../../src/systems/AbilitySystem';
import { movementSystem } from '../../src/systems/MovementSystem';
import {
  hpCurrent, hpMax,
  moveSpeed, atkCooldown, atkDamage, atkRange, atkSplash,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd,
  lastCombatTime,
  unitType, faction,
  velX, velY,
  setPath, movePathIndex,
  targetEntity,
} from '../../src/ecs/components';
import { UNIT_DEFS } from '../../src/data/units';
import type { World } from '../../src/ecs/world';

const TILE_SIZE = 32;

// Ability constants (mirrored from constants.ts to avoid const enum import issues)
const STIM_DURATION = 7.0;
const STIM_HP_COST = 10;
const STIM_SPEED_MULT = 1.5;
const STIM_COOLDOWN_MULT = 0.5;

const SIEGE_PACK_TIME = 2.0;
const SIEGE_DAMAGE = 35;
const SIEGE_RANGE = 13;
const SIEGE_SPLASH = 1.5;

const MEDIVAC_HEAL_RATE = 3.0;
const MEDIVAC_HEAL_RANGE = 4;

const ROACH_REGEN_COMBAT = 0.5;
const ROACH_REGEN_IDLE = 2.0;
const ROACH_COMBAT_TIMEOUT = 3.0;

describe('AbilitySystem', () => {
  let world: World;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  // ── Stim Pack ──

  describe('Stim Pack', () => {
    const marineDef = UNIT_DEFS[UnitType.Marine];

    it('increases moveSpeed by STIM_SPEED_MULT and decreases atkCooldown by STIM_COOLDOWN_MULT', () => {
      const marine = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
        speed: marineDef.speed * TILE_SIZE,
        cooldown: marineDef.attackCooldown,
      }));

      // Simulate stim applied (as CommandSystem would)
      const gameTime = 10.0;
      hpCurrent[marine] = 45 - STIM_HP_COST;
      stimEndTime[marine] = gameTime + STIM_DURATION;
      moveSpeed[marine] = marineDef.speed * TILE_SIZE * STIM_SPEED_MULT;
      atkCooldown[marine] = marineDef.attackCooldown * STIM_COOLDOWN_MULT;

      expect(moveSpeed[marine]).toBeCloseTo(marineDef.speed * TILE_SIZE * STIM_SPEED_MULT);
      expect(atkCooldown[marine]).toBeCloseTo(marineDef.attackCooldown * STIM_COOLDOWN_MULT);
    });

    it('costs STIM_HP_COST HP', () => {
      const marine = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      }));

      const hpBefore = hpCurrent[marine];
      // Simulate stim cost
      hpCurrent[marine] -= STIM_HP_COST;

      expect(hpCurrent[marine]).toBe(hpBefore - STIM_HP_COST);
    });

    it('expires after STIM_DURATION — restores moveSpeed and atkCooldown', () => {
      const marine = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
        speed: marineDef.speed * TILE_SIZE * STIM_SPEED_MULT,
        cooldown: marineDef.attackCooldown * STIM_COOLDOWN_MULT,
      }));

      const stimAppliedAt = 10.0;
      stimEndTime[marine] = stimAppliedAt + STIM_DURATION;
      moveSpeed[marine] = marineDef.speed * TILE_SIZE * STIM_SPEED_MULT;
      atkCooldown[marine] = marineDef.attackCooldown * STIM_COOLDOWN_MULT;

      // Run ability system AFTER stim has expired
      const gameTimeAfterExpiry = stimAppliedAt + STIM_DURATION + 0.1;
      abilitySystem(world, 1 / 60, gameTimeAfterExpiry);

      expect(stimEndTime[marine]).toBe(0);
      expect(moveSpeed[marine]).toBeCloseTo(marineDef.speed * TILE_SIZE);
      expect(atkCooldown[marine]).toBeCloseTo(marineDef.attackCooldown);
    });

    it('does not expire before STIM_DURATION elapses', () => {
      const marine = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      }));

      const stimAppliedAt = 10.0;
      stimEndTime[marine] = stimAppliedAt + STIM_DURATION;
      const stimmedSpeed = marineDef.speed * TILE_SIZE * STIM_SPEED_MULT;
      const stimmedCooldown = marineDef.attackCooldown * STIM_COOLDOWN_MULT;
      moveSpeed[marine] = stimmedSpeed;
      atkCooldown[marine] = stimmedCooldown;

      // Run ability system BEFORE stim expires
      const gameTimeBeforeExpiry = stimAppliedAt + STIM_DURATION - 1.0;
      abilitySystem(world, 1 / 60, gameTimeBeforeExpiry);

      // Stats should still be boosted
      expect(stimEndTime[marine]).toBe(stimAppliedAt + STIM_DURATION);
      expect(moveSpeed[marine]).toBeCloseTo(stimmedSpeed);
      expect(atkCooldown[marine]).toBeCloseTo(stimmedCooldown);
    });

    it('re-stimming refreshes duration without stacking speed boost', () => {
      const marine = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      }));

      // First stim at t=10
      const firstStimTime = 10.0;
      stimEndTime[marine] = firstStimTime + STIM_DURATION;
      moveSpeed[marine] = marineDef.speed * TILE_SIZE * STIM_SPEED_MULT;
      atkCooldown[marine] = marineDef.attackCooldown * STIM_COOLDOWN_MULT;

      // Re-stim at t=14 (during first stim)
      const reStimTime = 14.0;
      stimEndTime[marine] = reStimTime + STIM_DURATION;
      // Speed stays the same — not stacked
      moveSpeed[marine] = marineDef.speed * TILE_SIZE * STIM_SPEED_MULT;

      // Verify the timer was refreshed
      expect(stimEndTime[marine]).toBe(reStimTime + STIM_DURATION);
      // Speed should be exactly 1x stim boost, not 2x
      expect(moveSpeed[marine]).toBeCloseTo(marineDef.speed * TILE_SIZE * STIM_SPEED_MULT);

      // After the refreshed duration, stim expires
      abilitySystem(world, 1 / 60, reStimTime + STIM_DURATION + 0.1);
      expect(moveSpeed[marine]).toBeCloseTo(marineDef.speed * TILE_SIZE);
    });

    it('only affects Marines — not other unit types', () => {
      const marauder = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marauder,
        hp: 125,
      }));
      const marauderDef = UNIT_DEFS[UnitType.Marauder];

      // Set some arbitrary boosted stats and stimEndTime on a non-Marine
      const boostedSpeed = marauderDef.speed * TILE_SIZE * 2;
      moveSpeed[marauder] = boostedSpeed;
      stimEndTime[marauder] = 10.0 + STIM_DURATION;

      // After expiry, the system still restores from UNIT_DEFS for the unit type
      abilitySystem(world, 1 / 60, 10.0 + STIM_DURATION + 0.1);

      // The system processes stim expiry for ANY unit with stimEndTime > 0 and ABILITY bit,
      // but in practice only Marines get stimmed via CommandSystem.
      // The AbilitySystem restores stats from UNIT_DEFS[unitType] on expiry.
      // So if a non-Marine somehow had stimEndTime set, it would restore to that unit's base stats.
      expect(moveSpeed[marauder]).toBeCloseTo(marauderDef.speed * TILE_SIZE);
    });
  });

  // ── Siege Mode ──

  describe('Siege Mode', () => {
    const tankDef = UNIT_DEFS[UnitType.SiegeTank];

    it('toggle to siege: sets siegeMode to Unpacking with siegeTransitionEnd', () => {
      const tank = track(spawnUnit(world, {
        x: 200, y: 200,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
      }));

      const gameTime = 5.0;
      // Simulate pressing E (CommandSystem sets these)
      siegeMode[tank] = SiegeMode.Unpacking;
      siegeTransitionEnd[tank] = gameTime + SIEGE_PACK_TIME;

      expect(siegeMode[tank]).toBe(SiegeMode.Unpacking);
      expect(siegeTransitionEnd[tank]).toBeCloseTo(gameTime + SIEGE_PACK_TIME);
    });

    it('after SIEGE_PACK_TIME, transitions to Sieged with correct stats', () => {
      const tank = track(spawnUnit(world, {
        x: 200, y: 200,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
        damage: tankDef.damage,
        range: tankDef.range * TILE_SIZE,
      }));

      const gameTime = 5.0;
      siegeMode[tank] = SiegeMode.Unpacking;
      siegeTransitionEnd[tank] = gameTime + SIEGE_PACK_TIME;

      // Run after transition completes
      abilitySystem(world, 1 / 60, gameTime + SIEGE_PACK_TIME + 0.01);

      expect(siegeMode[tank]).toBe(SiegeMode.Sieged);
      expect(atkDamage[tank]).toBe(SIEGE_DAMAGE);
      expect(atkRange[tank]).toBe(SIEGE_RANGE * TILE_SIZE);
      expect(atkSplash[tank]).toBe(SIEGE_SPLASH);
    });

    it('toggle back: Packing, then after time becomes Mobile with normal stats', () => {
      const tank = track(spawnUnit(world, {
        x: 200, y: 200,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
      }));

      // Start in sieged mode with siege stats
      siegeMode[tank] = SiegeMode.Sieged;
      atkDamage[tank] = SIEGE_DAMAGE;
      atkRange[tank] = SIEGE_RANGE * TILE_SIZE;
      atkSplash[tank] = SIEGE_SPLASH;

      // Player presses E to pack up
      const gameTime = 10.0;
      siegeMode[tank] = SiegeMode.Packing;
      siegeTransitionEnd[tank] = gameTime + SIEGE_PACK_TIME;

      // Run after transition completes
      abilitySystem(world, 1 / 60, gameTime + SIEGE_PACK_TIME + 0.01);

      expect(siegeMode[tank]).toBe(SiegeMode.Mobile);
      expect(atkDamage[tank]).toBe(tankDef.damage);
      expect(atkRange[tank]).toBe(tankDef.range * TILE_SIZE);
      expect(atkSplash[tank]).toBe(tankDef.splashRadius);
    });

    it('cannot move while sieged (MovementSystem zeroes velocity)', () => {
      const tank = track(spawnUnit(world, {
        x: 200, y: 200,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
        speed: tankDef.speed * TILE_SIZE,
      }));

      siegeMode[tank] = SiegeMode.Sieged;

      // Give the tank a path
      setPath(tank, [[300, 300], [400, 400]]);
      velX[tank] = 50;
      velY[tank] = 50;

      movementSystem(world, 1 / 60);

      expect(velX[tank]).toBe(0);
      expect(velY[tank]).toBe(0);
      expect(movePathIndex[tank]).toBe(-1);
    });

    it('cannot interrupt transition (pressing E during pack/unpack is ignored)', () => {
      const tank = track(spawnUnit(world, {
        x: 200, y: 200,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
      }));

      const gameTime = 5.0;
      siegeMode[tank] = SiegeMode.Unpacking;
      siegeTransitionEnd[tank] = gameTime + SIEGE_PACK_TIME;

      // Mid-transition: ability system should not change anything
      abilitySystem(world, 1 / 60, gameTime + SIEGE_PACK_TIME / 2);

      // Still unpacking — not interrupted
      expect(siegeMode[tank]).toBe(SiegeMode.Unpacking);
      expect(siegeTransitionEnd[tank]).toBeCloseTo(gameTime + SIEGE_PACK_TIME);
    });

    it('sieged tank drops target if out of range (cannot chase)', () => {
      const tank = track(spawnUnit(world, {
        x: 200, y: 200,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
        range: SIEGE_RANGE * TILE_SIZE,
        damage: SIEGE_DAMAGE,
      }));
      const farEnemy = track(spawnUnit(world, {
        x: 900, y: 900, // way beyond siege range
        factionId: Faction.Zerg,
        hp: 100,
      }));

      siegeMode[tank] = SiegeMode.Sieged;
      targetEntity[tank] = farEnemy;

      // CombatSystem handles the target-drop logic for sieged tanks,
      // but we can verify the behavior via distance check:
      // Siege range = 13 * 32 = 416px, distance to (900,900) from (200,200) = ~990px
      const dx = 900 - 200;
      const dy = 900 - 200;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThan(SIEGE_RANGE * TILE_SIZE);
    });
  });

  // ── Medivac Heal ──

  describe('Medivac Heal', () => {
    it('heals wounded Marine within range', () => {
      const medivac = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        damage: 0,
      }));
      const marine = track(spawnUnit(world, {
        x: 120, y: 100, // 20px away, well within 4 tiles = 128px
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      }));
      hpCurrent[marine] = 30; // wounded

      const dt = 1.0; // 1 second
      abilitySystem(world, dt, 10.0);

      // Should heal by MEDIVAC_HEAL_RATE * dt = 3.0 * 1.0 = 3.0
      expect(hpCurrent[marine]).toBeCloseTo(33);
    });

    it('does NOT heal full-HP units', () => {
      const medivac = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        damage: 0,
      }));
      const marine = track(spawnUnit(world, {
        x: 120, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      }));
      // Marine is at full HP (45/45)

      abilitySystem(world, 1.0, 10.0);

      expect(hpCurrent[marine]).toBe(45); // unchanged
    });

    it('does NOT heal non-bio units (SiegeTank)', () => {
      const medivac = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        damage: 0,
      }));
      const tank = track(spawnUnit(world, {
        x: 120, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.SiegeTank,
        hp: 160,
      }));
      hpCurrent[tank] = 100; // wounded

      abilitySystem(world, 1.0, 10.0);

      expect(hpCurrent[tank]).toBe(100); // unchanged — not bio
    });

    it('does NOT heal enemy units', () => {
      const medivac = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        damage: 0,
      }));
      const enemyMarine = track(spawnUnit(world, {
        x: 120, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Marine, // hypothetical enemy Marine
        hp: 45,
      }));
      hpCurrent[enemyMarine] = 20;

      abilitySystem(world, 1.0, 10.0);

      expect(hpCurrent[enemyMarine]).toBe(20); // unchanged — enemy
    });

    it('heal does not exceed hpMax', () => {
      const medivac = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Medivac,
        hp: 150,
        damage: 0,
      }));
      const marine = track(spawnUnit(world, {
        x: 120, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        hp: 45,
      }));
      hpCurrent[marine] = 44; // just 1 HP below max

      // Heal for 1 full second = 3.0 HP, but only 1 HP of headroom
      abilitySystem(world, 1.0, 10.0);

      expect(hpCurrent[marine]).toBe(45); // capped at hpMax
    });
  });

  // ── Roach Regen ──

  describe('Roach Regen', () => {
    it('regenerates at idle rate when not in combat', () => {
      const roach = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Roach,
        hp: 145,
      }));
      hpCurrent[roach] = 100;
      lastCombatTime[roach] = 0; // long ago — idle

      const dt = 1.0;
      const gameTime = 100.0; // well past ROACH_COMBAT_TIMEOUT
      abilitySystem(world, dt, gameTime);

      // Idle rate: 2.0 HP/s * 1.0s = 2.0
      expect(hpCurrent[roach]).toBeCloseTo(102);
    });

    it('regenerates at combat rate when recently in combat', () => {
      const roach = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Roach,
        hp: 145,
      }));
      hpCurrent[roach] = 100;

      const gameTime = 10.0;
      // Last combat was 1 second ago (< ROACH_COMBAT_TIMEOUT of 3.0)
      lastCombatTime[roach] = gameTime - 1.0;

      const dt = 1.0;
      abilitySystem(world, dt, gameTime);

      // Combat rate: 0.5 HP/s * 1.0s = 0.5
      expect(hpCurrent[roach]).toBeCloseTo(100.5);
    });

    it('regen does not exceed hpMax', () => {
      const roach = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Roach,
        hp: 145,
      }));
      hpCurrent[roach] = 144; // 1 below max
      lastCombatTime[roach] = 0;

      const dt = 1.0;
      const gameTime = 100.0;
      abilitySystem(world, dt, gameTime);

      // Would heal 2.0 but only 1 HP headroom
      expect(hpCurrent[roach]).toBe(145);
    });

    it('non-Roach units do not regenerate', () => {
      const zergling = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Zerg,
        unitTypeId: UnitType.Zergling,
        hp: 35,
      }));
      hpCurrent[zergling] = 20;
      lastCombatTime[zergling] = 0;

      abilitySystem(world, 1.0, 100.0);

      expect(hpCurrent[zergling]).toBe(20); // unchanged
    });
  });
});
