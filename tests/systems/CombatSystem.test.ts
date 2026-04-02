import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  createTestMap,
  Faction,
  UnitType,
  CommandMode,
} from '../helpers';
import { combatSystem } from '../../src/systems/CombatSystem';
import {
  hpCurrent,
  atkLastTime,
  atkFlashTimer,
  targetEntity,
  commandMode,
  posX,
  posY,
  faction,
  atkDamage,
  atkRange,
  atkCooldown,
  atkSplash,
  unitType,
  movePathIndex,
  slowEndTime,
  slowFactor,
  lastCombatTime,
} from '../../src/ecs/components';
import { entityExists, removeEntity, type World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';

describe('CombatSystem', () => {
  let world: World;
  let map: MapData;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    map = createTestMap();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  // ── Auto-target acquisition ──

  describe('auto-target acquisition', () => {
    it('acquires the closest enemy in range', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, range: 200, damage: 10,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[attacker]).toBe(enemy);
    });

    it('does not target friendlies', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, range: 200,
      }));
      const friendly = track(spawnUnit(world, {
        x: 120, y: 100, factionId: Faction.Terran, hp: 50,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[attacker]).not.toBe(friendly);
    });

    it('does not acquire targets beyond range', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, range: 50,
      }));
      track(spawnUnit(world, {
        x: 300, y: 300, factionId: Faction.Zerg, hp: 50,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[attacker]).toBe(-1);
    });

    it('prefers the closest enemy when multiple are in range', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, range: 300, damage: 5,
      }));
      const farEnemy = track(spawnUnit(world, {
        x: 250, y: 100, factionId: Faction.Zerg, hp: 50,
      }));
      const nearEnemy = track(spawnUnit(world, {
        x: 130, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(targetEntity[attacker]).toBe(nearEnemy);
    });
  });

  // ── Cooldown enforcement ──

  describe('cooldown enforcement', () => {
    it('attacks immediately when cooldown has elapsed', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 10, cooldown: 1000,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 50,
      }));
      atkLastTime[attacker] = -999; // long ago

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[enemy]).toBe(40); // 50 - 10
    });

    it('does not attack again before cooldown expires', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 10, cooldown: 1000,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      // First attack at t=1.0
      combatSystem(world, 1 / 60, 1.0, map);
      expect(hpCurrent[enemy]).toBe(40);

      // Try again at t=1.5 (only 0.5s later, cooldown is 1.0s)
      combatSystem(world, 1 / 60, 1.5, map);
      expect(hpCurrent[enemy]).toBe(40); // no second hit
    });

    it('attacks again after cooldown expires', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 10, cooldown: 1000,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      // First attack at t=1.0
      combatSystem(world, 1 / 60, 1.0, map);
      expect(hpCurrent[enemy]).toBe(40);

      // Second attack at t=2.1 (1.1s later, cooldown = 1.0s)
      combatSystem(world, 1 / 60, 2.1, map);
      expect(hpCurrent[enemy]).toBe(30);
    });
  });

  // ── Damage application ──

  describe('damage application', () => {
    it('applies damage equal to atkDamage', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 15, cooldown: 500,
      }));
      const enemy = track(spawnUnit(world, {
        x: 140, y: 100, factionId: Faction.Zerg, hp: 80,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[enemy]).toBe(65); // 80 - 15
    });

    it('can reduce HP below zero', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 50, cooldown: 100,
      }));
      const enemy = track(spawnUnit(world, {
        x: 140, y: 100, factionId: Faction.Zerg, hp: 20,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[enemy]).toBeLessThanOrEqual(0);
    });

    it('sets attack flash timer on hit', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 10,
      }));
      track(spawnUnit(world, {
        x: 140, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(atkFlashTimer[attacker]).toBeGreaterThan(0);
    });

    it('skips units with 0 damage (e.g. Medivac)', () => {
      const medivac = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        damage: 0, range: 200,
      }));
      const enemy = track(spawnUnit(world, {
        x: 140, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[enemy]).toBe(50); // untouched
      expect(targetEntity[medivac]).toBe(-1);
    });
  });

  // ── Splash damage ──

  describe('splash damage', () => {
    it('deals splash damage to nearby enemies around the target', () => {
      // Attacker with 2-tile splash radius
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 20, splash: 2, cooldown: 500,
      }));

      // Primary target
      const target = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 100,
      }));

      // Splash victim — close to target (within 2 tiles = 64px of target)
      const splashVictim = track(spawnUnit(world, {
        x: 170, y: 100, factionId: Faction.Zerg, hp: 100,
      }));

      // Out of splash — far from target
      const farEnemy = track(spawnUnit(world, {
        x: 400, y: 400, factionId: Faction.Zerg, hp: 100,
      }));

      // Force target
      targetEntity[attacker] = target;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[target]).toBe(80);       // 100 - 20 direct hit
      expect(hpCurrent[splashVictim]).toBe(80);  // 100 - 20 splash
      expect(hpCurrent[farEnemy]).toBe(100);     // untouched
    });

    it('does not splash friendly units', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 20, splash: 3, cooldown: 500,
      }));
      const target = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 100, damage: 0,
      }));
      // Friendly near the target
      const friendly = track(spawnUnit(world, {
        x: 160, y: 100, factionId: Faction.Terran, hp: 100,
      }));

      targetEntity[attacker] = target;
      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[friendly]).toBe(100); // not splashed
    });
  });

  // ── Baneling suicide ──

  describe('Baneling suicide', () => {
    it('kills itself after attacking', () => {
      const baneling = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Zerg,
        damage: 20, range: 20, cooldown: 0, splash: 2,
        unitTypeId: UnitType.Baneling,
      }));
      const target = track(spawnUnit(world, {
        x: 110, y: 100, factionId: Faction.Terran, hp: 100,
      }));

      targetEntity[baneling] = target;
      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[target]).toBe(80);         // took damage
      expect(hpCurrent[baneling]).toBeLessThanOrEqual(0); // suicide
    });
  });

  // ── Target clearing ──

  describe('target clearing', () => {
    it('clears target when target entity is dead', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 10,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 5,
      }));

      // Attack and kill
      targetEntity[attacker] = enemy;
      commandMode[attacker] = CommandMode.AttackTarget;
      combatSystem(world, 1 / 60, 1.0, map);

      // Enemy now has hp <= 0. Run combat again so attacker detects dead target.
      // First, simulate death system removing the entity.
      hpCurrent[enemy] = 0;
      combatSystem(world, 1 / 60, 2.0, map);

      expect(targetEntity[attacker]).toBe(-1);
      expect(commandMode[attacker]).toBe(CommandMode.Idle);
    });

    it('clears target when target entity is removed from world', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, range: 200,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100, factionId: Faction.Zerg, hp: 50,
      }));

      targetEntity[attacker] = enemy;
      commandMode[attacker] = CommandMode.AttackTarget;

      // Remove enemy from world entirely
      removeEntity(world, enemy);

      combatSystem(world, 1 / 60, 2.0, map);

      expect(targetEntity[attacker]).toBe(-1);
    });
  });

  // ── Dead units don't act ──

  describe('dead units', () => {
    it('dead units (hp <= 0) do not attack', () => {
      const deadAttacker = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran,
        range: 200, damage: 50, hp: 0,
      }));
      // Override: set hp to 0 after spawn
      hpCurrent[deadAttacker] = 0;

      const enemy = track(spawnUnit(world, {
        x: 120, y: 100, factionId: Faction.Zerg, hp: 100,
      }));

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[enemy]).toBe(100); // untouched
    });
  });

  // ── Flash timer decrement ──

  describe('flash timer', () => {
    it('decrements atkFlashTimer each tick', () => {
      const unit = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, damage: 0,
      }));
      atkFlashTimer[unit] = 0.10;

      const dt = 1 / 60;
      combatSystem(world, dt, 1.0, map);

      expect(atkFlashTimer[unit]).toBeCloseTo(0.10 - dt, 4);
    });

    it('does not go below zero', () => {
      const unit = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, damage: 0,
      }));
      atkFlashTimer[unit] = 0.005;

      combatSystem(world, 1 / 60, 1.0, map);

      expect(atkFlashTimer[unit]).toBe(0);
    });
  });

  // ── Marauder Concussive Shells ──

  describe('Marauder Concussive Shells', () => {
    it('Marauder attack slows the target', () => {
      const marauder = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marauder,
        range: 200, damage: 10, cooldown: 1200,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100,
        factionId: Faction.Zerg,
        hp: 100,
      }));

      const gameTime = 5.0;
      combatSystem(world, 1 / 60, gameTime, map);

      // SLOW_DURATION = 1.07, SLOW_FACTOR = 0.5
      expect(slowEndTime[enemy]).toBeCloseTo(gameTime + 1.07);
      expect(slowFactor[enemy]).toBeCloseTo(0.5);
    });

    it('non-Marauder attack does NOT slow the target', () => {
      const marine = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        unitTypeId: UnitType.Marine,
        range: 200, damage: 6, cooldown: 600,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100,
        factionId: Faction.Zerg,
        hp: 100,
      }));

      combatSystem(world, 1 / 60, 5.0, map);

      expect(slowEndTime[enemy]).toBe(0);
      expect(slowFactor[enemy]).toBe(0);
    });
  });

  // ── lastCombatTime tracking ──

  describe('lastCombatTime tracking', () => {
    it('updates lastCombatTime for both attacker and target on attack', () => {
      const attacker = track(spawnUnit(world, {
        x: 100, y: 100,
        factionId: Faction.Terran,
        range: 200, damage: 10, cooldown: 1000,
      }));
      const enemy = track(spawnUnit(world, {
        x: 150, y: 100,
        factionId: Faction.Zerg,
        hp: 100,
      }));

      const gameTime = 7.5;
      combatSystem(world, 1 / 60, gameTime, map);

      expect(lastCombatTime[attacker]).toBe(gameTime);
      expect(lastCombatTime[enemy]).toBe(gameTime);
    });
  });
});
