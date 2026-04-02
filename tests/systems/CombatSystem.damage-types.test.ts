import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  createTestMap,
  Faction,
  UnitType,
  CommandMode,
  ArmorClass,
} from '../helpers';
import { combatSystem } from '../../src/systems/CombatSystem';
import { findBestTarget } from '../../src/ecs/queries';
import { getBonusDamage } from '../../src/combat/damageCalc';
import {
  hpCurrent,
  atkLastTime,
  armorClass,
  baseArmor,
  bonusDmg,
  bonusVsTag,
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
// Group 1: getBonusDamage
// ─────────────────────────────────────────────────────────────────────────────

describe('getBonusDamage', () => {
  it('bonus vs matching tag returns bonus damage', () => {
    expect(getBonusDamage(10, ArmorClass.Armored, ArmorClass.Armored)).toBe(10);
  });

  it('bonus vs non-matching tag returns 0', () => {
    expect(getBonusDamage(10, ArmorClass.Armored, ArmorClass.Light)).toBe(0);
  });

  it('Baneling bonus vs Light returns 19', () => {
    expect(getBonusDamage(19, ArmorClass.Light, ArmorClass.Light)).toBe(19);
  });

  it('no bonus unit (bonusDamage=0) returns 0', () => {
    expect(getBonusDamage(0, -1, ArmorClass.Light)).toBe(0);
  });

  it('bonusTag -1 always returns 0 even with positive bonus', () => {
    expect(getBonusDamage(10, -1, ArmorClass.Armored)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: SC2 bonus-damage combat formula
// ─────────────────────────────────────────────────────────────────────────────

describe('SC2 bonus-damage combat formula', () => {
  it('Marine (6, no bonus) vs Marine (Light, 0 armor): drops by 6', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Marine,
      damage: 6, range: 160, cooldown: 600,
      bonusDamage: 0, bonusVsTag: -1,
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

    // 6 + 0 - 0 = 6
    expect(hpCurrent[target]).toBe(39);
  });

  it('Marauder (10 base + 10 bonus) vs Roach (Armored, 1 armor): drops by 19', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Marauder,
      damage: 10, range: 160, cooldown: 1200,
      bonusDamage: 10, bonusVsTag: ArmorClass.Armored,
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

    // max(1, 10 + 10 - 1) = 19
    expect(hpCurrent[target]).toBe(126);
  });

  it('Marauder (10 base + 10 bonus) vs Light (0 armor): drops by 10 (no bonus)', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Marauder,
      damage: 10, range: 160, cooldown: 1200,
      bonusDamage: 10, bonusVsTag: ArmorClass.Armored,
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

    // 10 + 0 - 0 = 10
    expect(hpCurrent[target]).toBe(25);
  });

  it('Baneling (16 base + 19 bonus) vs Marine (Light, 0 armor): drops by 35', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      unitTypeId: UnitType.Baneling,
      damage: 16, range: 10, cooldown: 0,
      bonusDamage: 19, bonusVsTag: ArmorClass.Light,
      armorClassId: ArmorClass.Light,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      hp: 45,
      armorClassId: ArmorClass.Light,
    });
    baseArmor[target] = 0;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // max(1, 16 + 19 - 0) = 35
    expect(hpCurrent[target]).toBe(10);
  });

  it('Hellion (8 base + 6 bonus) vs Zergling (Light, 0 armor): drops by 14', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.Hellion,
      damage: 8, range: 160, cooldown: 1800,
      bonusDamage: 6, bonusVsTag: ArmorClass.Light,
      armorClassId: ArmorClass.Light,
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

    // max(1, 8 + 6 - 0) = 14
    expect(hpCurrent[target]).toBe(21);
  });

  it('SiegeTank (15 base + 10 bonus) vs Armored (1 armor): drops by 24', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.SiegeTank,
      damage: 15, range: 160, cooldown: 2000,
      bonusDamage: 10, bonusVsTag: ArmorClass.Armored,
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

    // max(1, 15 + 10 - 1) = 24
    expect(hpCurrent[target]).toBe(121);
  });

  it('SiegeTank (15 base + 10 bonus) vs Light (0 armor): drops by 15 (no bonus)', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      unitTypeId: UnitType.SiegeTank,
      damage: 15, range: 160, cooldown: 2000,
      bonusDamage: 10, bonusVsTag: ArmorClass.Armored,
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

    // max(1, 15 + 0 - 0) = 15
    expect(hpCurrent[target]).toBe(85);
  });

  it('min 1 damage floor: 1 base damage vs 5 armor → 1 damage dealt', () => {
    const attacker = unit({
      x: 100, y: 100,
      factionId: Faction.Terran,
      damage: 1, range: 160, cooldown: 500,
      bonusDamage: 0, bonusVsTag: -1,
      armorClassId: ArmorClass.Light,
    });
    const target = unit({
      x: 100, y: 100,
      factionId: Faction.Zerg,
      hp: 50,
      armorClassId: ArmorClass.Armored,
    });
    baseArmor[target] = 5;
    atkLastTime[attacker] = -999;

    combatSystem(world, 1 / 60, 1, map);

    // max(1, 1 + 0 - 5) = max(1, -4) = 1
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
