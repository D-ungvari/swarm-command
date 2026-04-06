import { type World, hasComponents } from '../ecs/world';
import {
  BUILDING, POSITION, HEALTH, UNIT_TYPE,
  buildingType, buildState, faction, prodUnitType, prodProgress, prodTimeTotal,
  hpCurrent, hpMax, moveSpeed, atkCooldown, atkRange, unitType,
  addonType,
} from '../ecs/components';
import { BuildState, BuildingType, UpgradeType, UnitType, AddonType, TILE_SIZE } from '../constants';
import { UNIT_DEFS } from '../data/units';
import type { PlayerResources } from '../types';

// ── Upgrade costs per type per level (0→1, 1→2, 2→3) ──
interface UpgradeCost { minerals: number; gas: number; time: number; }

const UPGRADE_COSTS: Record<number, [UpgradeCost, UpgradeCost, UpgradeCost]> = {
  [UpgradeType.InfantryWeapons]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.InfantryArmor]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.VehicleWeapons]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 175, gas: 175, time: 85 },
    { minerals: 250, gas: 250, time: 90 },
  ],
  [UpgradeType.ZergMelee]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.ZergRanged]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.ZergCarapace]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.VehicleArmor]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 175, gas: 175, time: 85 },
    { minerals: 250, gas: 250, time: 90 },
  ],
};

// ── Unit-specific research costs (single-level, boolean unlock) ──
interface ResearchDef { minerals: number; gas: number; time: number; }

const RESEARCH_COSTS: Partial<Record<UpgradeType, ResearchDef>> = {
  [UpgradeType.StimPack]:         { minerals: 100, gas: 100, time: 100 },
  [UpgradeType.CombatShield]:     { minerals: 100, gas: 100, time: 79 },
  [UpgradeType.ConcussiveShells]: { minerals: 50,  gas: 50,  time: 36 },
  [UpgradeType.SiegeTech]:        { minerals: 100, gas: 100, time: 80 },
  [UpgradeType.MetabolicBoost]:   { minerals: 100, gas: 100, time: 79 },
  [UpgradeType.AdrenalGlands]:    { minerals: 200, gas: 200, time: 93 },
  [UpgradeType.GroovedSpines]:    { minerals: 100, gas: 100, time: 57 },
  [UpgradeType.MuscularAugments]: { minerals: 100, gas: 100, time: 57 },
};

/** Returns cost for a unit-specific research, or null if already researched. */
export function getResearchCost(type: UpgradeType, currentLevel: number): UpgradeCost | null {
  if (currentLevel >= 1) return null; // boolean: 0→1 only
  const def = RESEARCH_COSTS[type];
  return def ? { minerals: def.minerals, gas: def.gas, time: def.time } : null;
}

/** Which research types each building type can perform. */
export const BUILDING_RESEARCH: Partial<Record<BuildingType, UpgradeType[]>> = {
  [BuildingType.Barracks]:      [UpgradeType.StimPack, UpgradeType.CombatShield, UpgradeType.ConcussiveShells],
  [BuildingType.Factory]:       [UpgradeType.SiegeTech],
  [BuildingType.SpawningPool]:  [UpgradeType.MetabolicBoost, UpgradeType.AdrenalGlands],
  [BuildingType.HydraliskDen]:  [UpgradeType.GroovedSpines, UpgradeType.MuscularAugments],
};

/** Research types that require TechLab addon */
const TECHLAB_RESEARCH = new Set([
  UpgradeType.StimPack, UpgradeType.CombatShield, UpgradeType.ConcussiveShells, UpgradeType.SiegeTech,
]);

/**
 * Sentinel offset stored in prodUnitType for upgrade research.
 * Values 128+ mean "researching upgrade (value - 128)".
 * This avoids collision with UnitType values (1–14) and the idle sentinel (0).
 */
export const UPGRADE_RESEARCH_OFFSET = 128;

/** Encode an upgrade type for storage in prodUnitType. */
export function encodeResearch(type: UpgradeType): number {
  return type + UPGRADE_RESEARCH_OFFSET;
}

/** Decode an upgrade type from prodUnitType. Returns null if not a research marker. */
export function decodeResearch(value: number): UpgradeType | null {
  if (value < UPGRADE_RESEARCH_OFFSET) return null;
  return (value - UPGRADE_RESEARCH_OFFSET) as UpgradeType;
}

/** Returns cost for upgrading `type` from `currentLevel` to `currentLevel+1`, or null if maxed. */
export function getUpgradeCost(type: UpgradeType, currentLevel: number): UpgradeCost | null {
  // Boolean research types (unit-specific)
  if (RESEARCH_COSTS[type] !== undefined) {
    return getResearchCost(type, currentLevel);
  }
  // Leveled upgrades (weapons/armor, 3 levels)
  if (currentLevel >= 3) return null;
  return UPGRADE_COSTS[type]?.[currentLevel] ?? null;
}

const UPGRADE_BUILDINGS = new Set([
  BuildingType.EngineeringBay, BuildingType.EvolutionChamber, BuildingType.Armory,
  BuildingType.Barracks, BuildingType.Factory,
  BuildingType.SpawningPool, BuildingType.HydraliskDen,
]);

/**
 * Advances research timers on Engineering Bay and Evolution Chamber buildings.
 * Uses prodUnitType (with UPGRADE_RESEARCH_OFFSET applied) / prodProgress / prodTimeTotal.
 * ProductionSystem is guarded to skip these building types entirely.
 */
export function upgradeSystem(world: World, dt: number, resources: Record<number, PlayerResources>): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING)) continue;
    const bt = buildingType[eid] as BuildingType;
    if (!UPGRADE_BUILDINGS.has(bt)) continue;
    if (buildState[eid] !== BuildState.Complete) continue;

    const encoded = prodUnitType[eid];
    const upgradeType = decodeResearch(encoded);
    if (upgradeType === null) continue; // nothing being researched

    prodProgress[eid] -= dt;
    if (prodProgress[eid] <= 0) {
      const fac = faction[eid];
      const res = resources[fac];
      if (res) {
        const maxLevel = RESEARCH_COSTS[upgradeType] !== undefined ? 1 : 3;
        res.upgrades[upgradeType] = Math.min(maxLevel, res.upgrades[upgradeType] + 1);
        applyResearchEffects(world, fac, upgradeType);
      }
      prodUnitType[eid] = 0;
      prodProgress[eid] = 0;
      prodTimeTotal[eid] = 0;
    }
  }
}

/** Apply immediate stat effects when a research completes (e.g. Combat Shield +10 HP) */
function applyResearchEffects(world: World, fac: number, type: UpgradeType): void {
  const bits = POSITION | HEALTH | UNIT_TYPE;
  switch (type) {
    case UpgradeType.CombatShield:
      // +10 HP to all existing Marines of this faction
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, bits)) continue;
        if (faction[eid] !== fac) continue;
        if (unitType[eid] !== UnitType.Marine) continue;
        hpMax[eid] += 10;
        hpCurrent[eid] = Math.min(hpCurrent[eid] + 10, hpMax[eid]);
      }
      break;
    case UpgradeType.MetabolicBoost:
      // +0.87 tile/s speed to all Zerglings
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, bits)) continue;
        if (faction[eid] !== fac) continue;
        if (unitType[eid] !== UnitType.Zergling) continue;
        moveSpeed[eid] += 0.87 * TILE_SIZE;
      }
      break;
    case UpgradeType.AdrenalGlands:
      // 18% faster attack for Zerglings (reduce cooldown)
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, bits)) continue;
        if (faction[eid] !== fac) continue;
        if (unitType[eid] !== UnitType.Zergling) continue;
        atkCooldown[eid] = Math.round(atkCooldown[eid] * 0.82);
      }
      break;
    case UpgradeType.GroovedSpines:
      // +1 tile range for Hydralisks
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, bits)) continue;
        if (faction[eid] !== fac) continue;
        if (unitType[eid] !== UnitType.Hydralisk) continue;
        atkRange[eid] += 1 * TILE_SIZE;
      }
      break;
    case UpgradeType.MuscularAugments:
      // +0.5 tile/s speed for Hydralisks
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, bits)) continue;
        if (faction[eid] !== fac) continue;
        if (unitType[eid] !== UnitType.Hydralisk) continue;
        moveSpeed[eid] += 0.5 * TILE_SIZE;
      }
      break;
  }
}

/** Check if a building can research a given type (considers TechLab requirement) */
export function canBuildingResearch(eid: number, type: UpgradeType): boolean {
  const bt = buildingType[eid] as BuildingType;
  const available = BUILDING_RESEARCH[bt];
  if (!available || !available.includes(type)) return false;
  if (TECHLAB_RESEARCH.has(type) && addonType[eid] !== AddonType.TechLab) return false;
  return true;
}
