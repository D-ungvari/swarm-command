import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTestWorld,
  spawnBuilding,
  spawnUnit,
  cleanupEntities,
  createTestMap,
  createPlayerResources,
  Faction,
  UnitType,
  BuildingType,
  BuildState,
} from '../helpers';
import { getUpgradeCost, upgradeSystem, encodeResearch } from '../../src/systems/UpgradeSystem';
import { productionSystem } from '../../src/systems/ProductionSystem';
import { combatSystem } from '../../src/systems/CombatSystem';
import {
  prodUnitType,
  prodProgress,
  prodTimeTotal,
  buildState,
  buildingType,
  faction,
  atkDamage,
  atkRange,
  atkCooldown,
  atkLastTime,
  hpCurrent,
  armorClass,
  baseArmor,
} from '../../src/ecs/components';
import type { World } from '../../src/ecs/world';
import type { PlayerResources } from '../../src/types';

// Numeric UpgradeType values matching constants.ts UpgradeType enum
const UpgradeType = {
  InfantryWeapons: 0,
  InfantryArmor:   1,
  VehicleWeapons:  2,
  ZergMelee:       3,
  ZergRanged:      4,
  ZergCarapace:    5,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: getUpgradeCost
// ─────────────────────────────────────────────────────────────────────────────

describe('getUpgradeCost', () => {
  it('InfantryWeapons level 0→1 returns valid positive cost', () => {
    const cost = getUpgradeCost(UpgradeType.InfantryWeapons, 0);
    expect(cost).not.toBeNull();
    expect(cost!.minerals).toBeGreaterThan(0);
    expect(cost!.gas).toBeGreaterThan(0);
    expect(cost!.time).toBeGreaterThan(0);
  });

  it('returns null when already at max level (level 3)', () => {
    expect(getUpgradeCost(UpgradeType.InfantryWeapons, 3)).toBeNull();
  });

  it('InfantryWeapons level 2→3 returns non-null cost', () => {
    expect(getUpgradeCost(UpgradeType.InfantryWeapons, 2)).not.toBeNull();
  });

  it('all 6 upgrade types return non-null cost at level 0', () => {
    const types = [
      UpgradeType.InfantryWeapons,
      UpgradeType.InfantryArmor,
      UpgradeType.VehicleWeapons,
      UpgradeType.ZergMelee,
      UpgradeType.ZergRanged,
      UpgradeType.ZergCarapace,
    ] as const;
    for (const type of types) {
      expect(getUpgradeCost(type, 0)).not.toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: upgradeSystem completes research
// ─────────────────────────────────────────────────────────────────────────────

describe('upgradeSystem', () => {
  let world: World;
  let resources: ReturnType<typeof createPlayerResources>;
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

  it('upgrades[InfantryArmor] increments from 0 to 1 and prodUnitType resets after research completes', () => {
    const eid = track(spawnBuilding(world, {
      buildingTypeId: BuildingType.EngineeringBay,
      buildStateId: BuildState.Complete,
      factionId: Faction.Terran,
    }));

    // Use InfantryArmor (1) — InfantryWeapons is 0, which conflicts with the
    // idle sentinel used by prodUnitType. InfantryArmor = 1 is a safe non-zero value.
    prodUnitType[eid] = encodeResearch(UpgradeType.InfantryArmor);
    prodProgress[eid] = 80;
    prodTimeTotal[eid] = 80;

    // dt large enough to complete (80s timer, pass 100s)
    upgradeSystem(world, 100, resources);

    expect(resources[Faction.Terran].upgrades[UpgradeType.InfantryArmor]).toBe(1);
    expect(prodUnitType[eid]).toBe(0);
  });

  it('research does NOT complete before time expires', () => {
    const eid = track(spawnBuilding(world, {
      buildingTypeId: BuildingType.EngineeringBay,
      buildStateId: BuildState.Complete,
      factionId: Faction.Terran,
    }));

    prodUnitType[eid] = encodeResearch(UpgradeType.InfantryArmor);
    prodProgress[eid] = 80;
    prodTimeTotal[eid] = 80;

    // dt well below the remaining timer — should not complete
    upgradeSystem(world, 10, resources);

    expect(resources[Faction.Terran].upgrades[UpgradeType.InfantryArmor]).toBe(0);
    expect(prodUnitType[eid]).toBe(encodeResearch(UpgradeType.InfantryArmor));
  });

  it('upgrades[type] never exceeds 3 — capped at max level', () => {
    const eid = track(spawnBuilding(world, {
      buildingTypeId: BuildingType.EngineeringBay,
      buildStateId: BuildState.Complete,
      factionId: Faction.Terran,
    }));

    // Pre-set to max level; use InfantryArmor (1) since 0 is the idle sentinel
    resources[Faction.Terran].upgrades[UpgradeType.InfantryArmor] = 3;

    prodUnitType[eid] = encodeResearch(UpgradeType.InfantryArmor);
    prodProgress[eid] = 80;
    prodTimeTotal[eid] = 80;

    upgradeSystem(world, 100, resources);

    // Must not exceed 3
    expect(resources[Faction.Terran].upgrades[UpgradeType.InfantryArmor]).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: ProductionSystem does NOT process Engineering Bay
// ─────────────────────────────────────────────────────────────────────────────

describe('ProductionSystem ignores Engineering Bay', () => {
  let world: World;
  let resources: ReturnType<typeof createPlayerResources>;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    resources = createPlayerResources();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  it('does not clear prodUnitType or call spawnFn for an Engineering Bay', () => {
    const map = createTestMap();
    const spawnCallback = vi.fn().mockReturnValue(0);

    const eid = spawnBuilding(world, {
      buildingTypeId: BuildingType.EngineeringBay,
      buildStateId: BuildState.Complete,
      factionId: Faction.Terran,
    });
    eids.push(eid);

    // InfantryArmor = 1, not a unit type — ProductionSystem must not interpret it as one
    prodUnitType[eid] = encodeResearch(UpgradeType.InfantryArmor);
    prodProgress[eid] = 0.1;
    prodTimeTotal[eid] = 80;

    productionSystem(world, 1, resources, map, spawnCallback);

    expect(prodUnitType[eid]).toBe(encodeResearch(UpgradeType.InfantryArmor));
    expect(spawnCallback).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Upgrade combat bonus
// ─────────────────────────────────────────────────────────────────────────────

describe('upgrade combat bonus', () => {
  let world: World;
  let resources: ReturnType<typeof createPlayerResources>;
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

  /** Spawn a Marine (Normal damage, Light armor, 0 base armor) ready to fire. */
  function spawnMarine(fac: number, x: number): number {
    const eid = track(spawnUnit(world, {
      x, y: 100,
      factionId: fac,
      unitTypeId: UnitType.Marine,
      damage: 6,
      range: 160,
      cooldown: 600,
      bonusDamage: 0, bonusVsTag: -1,
      armorClassId: 0,   // ArmorClass.Light
    }));
    baseArmor[eid] = 0;
    atkLastTime[eid] = -999; // allow immediate attack
    return eid;
  }

  it('without upgrades: Marine deals 6 damage to Marine (Normal vs Light, 0 armor)', () => {
    const attacker = spawnMarine(Faction.Terran, 100);
    const target   = spawnMarine(Faction.Zerg,   100);
    const startHp  = hpCurrent[target];

    const map = createTestMap();
    combatSystem(world, 1 / 60, 1, map, resources);

    // 6 * 1.0 - 0 = 6
    expect(hpCurrent[target]).toBeCloseTo(startHp - 6, 4);
  });

  it('InfantryWeapons level 2: Marine deals 8 damage (6+2)*1.0 - 0', () => {
    const attacker = spawnMarine(Faction.Terran, 100);
    const target   = spawnMarine(Faction.Zerg,   100);
    const startHp  = hpCurrent[target];

    resources[Faction.Terran].upgrades[UpgradeType.InfantryWeapons] = 2;

    const map = createTestMap();
    combatSystem(world, 1 / 60, 1, map, resources);

    // (6 + 2) * 1.0 - 0 = 8
    expect(hpCurrent[target]).toBeCloseTo(startHp - 8, 4);
  });

  it('InfantryArmor level 2 on defender: Marine deals 4 damage = max(1, 6*1.0 - 2)', () => {
    const attacker = spawnMarine(Faction.Terran, 100);
    const target   = spawnMarine(Faction.Zerg,   100);
    const startHp  = hpCurrent[target];

    resources[Faction.Zerg].upgrades[UpgradeType.ZergCarapace] = 2;

    const map = createTestMap();
    combatSystem(world, 1 / 60, 1, map, resources);

    // max(1, 6*1.0 - 2) = max(1, 4) = 4
    expect(hpCurrent[target]).toBeCloseTo(startHp - 4, 4);
  });
});
