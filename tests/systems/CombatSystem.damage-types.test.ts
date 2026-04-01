import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  createTestMap,
  Faction,
  UnitType,
  CommandMode,
  DamageType,
  ArmorClass,
} from '../helpers';
import { combatSystem } from '../../src/systems/CombatSystem';
import { findBestTarget } from '../../src/ecs/queries';
import { getDamageMultiplier } from '../../src/combat/damageCalc';
import {
  hpCurrent,
  atkLastTime,
  armorClass,
  baseArmor,
  atkDamageType,
  atkDamage,
  atkRange,
  commandMode,
  targetEntity,
  pendingDamage,
  killCount,
  posX,
  posY,
} from '../../src/ecs/components';
import type { World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture
// ─────────────────────────────────────────────────────────────────────────────

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

function unit(opts: Parameters<typeof spawnUnit>[1] = {}): number {
  const eid = spawnUnit(world, opts);
  eids.push(eid);
  return eid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: getDamageMultiplier
// ─────────────────────────────────────────────────────────────────────────────

describe('getDamageMultiplier', () => {
  it('Normal vs Light → 1.0', () => {
    expect(getDamageMultiplier(DamageType.Normal, ArmorClass.Light)).toBe(1.0);
  });

  it('Normal vs Armored → 1.0', () => {
    expect(getDamageMultiplier(DamageType.Normal, ArmorClass.Armored)).toBe(1.0);
  });

  it('Concussive vs Light → 1.0', () => {
    expect(getDamageMultiplier(DamageType.Concussive, ArmorClass.Light)).toBe(1.0);
  });

  it('Concussive vs Armored → 0.5', () => {
    expect(getDamageMultiplier(DamageType.Concussive, ArmorClass.Armored)).toBe(0.5);
  });

  it('Explosive vs Light → 0.5', () => {
    expect(getDamageMultiplier(DamageType.Explosive, ArmorClass.Light)).toBe(0.5);
  });

  it('Explosive vs Armored → 1.0', () => {
    expect(getDamageMultiplier(DamageType.Explosive, ArmorClass.Armored)).toBe(1.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: base armor formula
// ─────────────────────────────────────────────────────────────────────────────

describe('base armor formula', () => {
  it('Marine (Normal) vs Marine (Light, 0 armor): drops by 6', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Marine,
      damage: 6, range: 160, cooldown: 600,
      damageTypeId: DamageType.Normal,
      armorClassId: ArmorClass.Light,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 45,
      armorClassId: ArmorClass.Light,
    });
    baseArmor[target] = 0;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // 6 * 1.0 - 0 = 6
    expect(hpCurrent[target]).toBe(39);
  });

  it('Marauder (Concussive, 10) vs Armored (1 armor): drops by 4', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Marauder,
      damage: 10, range: 160, cooldown: 1200,
      damageTypeId: DamageType.Concussive,
      armorClassId: ArmorClass.Armored,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 125,
      armorClassId: ArmorClass.Armored,
    });
    baseArmor[target] = 1;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // 10 * 0.5 - 1 = 4
    expect(hpCurrent[target]).toBe(121);
  });

  it('Marauder (Concussive, 10) vs Light (0 armor): drops by 10', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Marauder,
      damage: 10, range: 160, cooldown: 1200,
      damageTypeId: DamageType.Concussive,
      armorClassId: ArmorClass.Armored,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 35,
      armorClassId: ArmorClass.Light,
    });
    baseArmor[target] = 0;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // 10 * 1.0 - 0 = 10
    expect(hpCurrent[target]).toBe(25);
  });

  it('SiegeTank (Explosive, 35) vs Armored (1 armor): drops by 34', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.SiegeTank,
      damage: 35, range: 160, cooldown: 2000,
      damageTypeId: DamageType.Explosive,
      armorClassId: ArmorClass.Armored,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 145,
      armorClassId: ArmorClass.Armored,
    });
    baseArmor[target] = 1;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // 35 * 1.0 - 1 = 34
    expect(hpCurrent[target]).toBe(111);
  });

  it('SiegeTank (Explosive, 35) vs Light (0 armor): drops by 17.5', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.SiegeTank,
      damage: 35, range: 160, cooldown: 2000,
      damageTypeId: DamageType.Explosive,
      armorClassId: ArmorClass.Armored,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 100,
      armorClassId: ArmorClass.Light,
    });
    baseArmor[target] = 0;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // Math.max(1, 35 * 0.5 - 0) = 17.5
    expect(hpCurrent[target]).toBeCloseTo(100 - 17.5);
  });

  it('min 1 damage floor: Explosive 1 damage vs Light → 1 damage dealt', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 1, range: 160, cooldown: 500,
      damageTypeId: DamageType.Explosive,
      armorClassId: ArmorClass.Light,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 50,
      armorClassId: ArmorClass.Light,
    });
    baseArmor[target] = 0;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // Math.max(1, 1 * 0.5 - 0) = Math.max(1, 0.5) = 1
    expect(hpCurrent[target]).toBe(49);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: kill counter
// ─────────────────────────────────────────────────────────────────────────────

describe('kill counter', () => {
  it('increments killCount when attacker kills target', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 100, range: 160, cooldown: 500,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 10,
    });
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    expect(killCount[attacker]).toBe(1);
  });

  it('does not increment killCount when target survives', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 5, range: 160, cooldown: 500,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 100,
    });
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    expect(killCount[attacker]).toBe(0);
    expect(hpCurrent[target]).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: focus fire invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('focus fire invariant', () => {
  it('AttackTarget unit does not switch to a closer auto-acquired enemy', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 5, range: 500, cooldown: 500,
    });
    // Far enemy — explicitly targeted
    const farEnemy = unit({
      x: 300, y: 100,
      factionId: Faction.Zerg,
      hp: 100,
    });
    // Closer enemy — should NOT be auto-acquired
    const closeEnemy = unit({
      x: 130, y: 100,
      factionId: Faction.Zerg,
      hp: 100,
    });

    // Explicitly assign far enemy as the attack target
    commandMode[attacker] = CommandMode.AttackTarget;
    targetEntity[attacker] = farEnemy;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // Must still be locked onto farEnemy, not switched to closeEnemy
    expect(targetEntity[attacker]).toBe(farEnemy);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: overkill prevention
// ─────────────────────────────────────────────────────────────────────────────

describe('overkill prevention', () => {
  it('second attacker picks alternate target when first has already committed enough damage to kill', () => {
    // Low-HP primary target
    const primaryTarget = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 5, damage: 0,
    });
    // Alternate healthy target
    const altTarget = unit({
      x: 110, y: 100,
      factionId: Faction.Zerg,
      hp: 100, damage: 0,
    });

    // Two attackers, each dealing 10 damage — more than enough to kill primaryTarget (hp=5)
    const attacker1 = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 10, range: 200, cooldown: 500,
    });
    const attacker2 = unit({
      x: 105, y: 100,
      factionId: Faction.Terran,
      damage: 10, range: 200, cooldown: 500,
    });

    atkLastTime[attacker1] = -999;
    atkLastTime[attacker2] = -999;

    // Ensure pendingDamage starts clean
    pendingDamage[primaryTarget] = 0;
    pendingDamage[altTarget] = 0;

    combatSystem(world, 1 / 60, 1, map);

    // primaryTarget must be dead (at least one attacker hit it)
    expect(hpCurrent[primaryTarget]).toBeLessThanOrEqual(0);

    // The second attacker should have redirected to altTarget rather than piling on a dead unit.
    // Verify altTarget took damage (overkill prevention worked and redirected the second shot).
    expect(hpCurrent[altTarget]).toBeLessThan(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: findBestTarget priority
// ─────────────────────────────────────────────────────────────────────────────

describe('findBestTarget priority', () => {
  it('prefers a retaliating enemy over a non-retaliating armed enemy', () => {
    const searcher = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 5, range: 400,
    });

    // Armed enemy that is NOT targeting the searcher
    const armedEnemy = unit({
      x: 150, y: 100,
      factionId: Faction.Zerg,
      damage: 5, range: 400, hp: 80,
    });

    // Armed enemy that IS targeting the searcher (retaliation)
    const retaliatingEnemy = unit({
      x: 200, y: 100,
      factionId: Faction.Zerg,
      damage: 5, range: 400, hp: 80,
    });
    targetEntity[retaliatingEnemy] = searcher;

    const result = findBestTarget(world, searcher, 400);

    expect(result).toBe(retaliatingEnemy);
  });

  it('prefers an armed unit over an unarmed unit', () => {
    const searcher = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 5, range: 400,
    });

    // Unarmed enemy (damage=0, closer)
    const unarmedEnemy = unit({
      x: 130, y: 100,
      factionId: Faction.Zerg,
      damage: 0, range: 0, hp: 50,
    });

    // Armed enemy (further)
    const armedEnemy = unit({
      x: 250, y: 100,
      factionId: Faction.Zerg,
      damage: 10, range: 200, hp: 50,
    });

    const result = findBestTarget(world, searcher, 400);

    expect(result).toBe(armedEnemy);
  });

  it('returns 0 when no targets are in range', () => {
    const searcher = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 5, range: 50,
    });

    // Enemy well out of range
    unit({
      x: 900, y: 900,
      factionId: Faction.Zerg,
      damage: 5, hp: 80,
    });

    const result = findBestTarget(world, searcher, 50);

    expect(result).toBe(0);
  });
});
