import { type World, hasComponents } from '../ecs/world';
import {
  BUILDING, POSITION, HEALTH, UNIT_TYPE,
  buildingType, buildState, faction, prodUnitType, prodProgress, prodTimeTotal,
  hpCurrent, hpMax, moveSpeed, atkCooldown, atkRange, unitType,
} from '../ecs/components';
import { BuildState, BuildingType, UpgradeType, TILE_SIZE } from '../constants';
import type { PlayerResources } from '../types';

// ── Upgrade costs per type per level (0→1, 1→2, 2→3) ──
interface UpgradeCost { minerals: number; gas: number; time: number; }

const UPGRADE_COSTS: Record<number, [UpgradeCost, UpgradeCost, UpgradeCost]> = {
  [UpgradeType.Weapons1]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.Weapons2]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.Weapons3]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.Armor1]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.Armor2]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
  [UpgradeType.Armor3]: [
    { minerals: 100, gas: 100, time: 80 },
    { minerals: 150, gas: 150, time: 85 },
    { minerals: 200, gas: 200, time: 90 },
  ],
};

// ── Faction-specific research costs (single-level, boolean unlock) ──
interface ResearchDef { minerals: number; gas: number; time: number; }

const RESEARCH_COSTS: Partial<Record<UpgradeType, ResearchDef>> = {
  [UpgradeType.FactionAbility1]: { minerals: 100, gas: 100, time: 100 },
  [UpgradeType.FactionAbility2]: { minerals: 100, gas: 100, time: 79 },
  [UpgradeType.FactionAbility3]: { minerals: 100, gas: 100, time: 80 },
  [UpgradeType.FactionAbility4]: { minerals: 150, gas: 150, time: 93 },
};

/** Returns cost for a faction-specific research, or null if already researched. */
export function getResearchCost(type: UpgradeType, currentLevel: number): UpgradeCost | null {
  if (currentLevel >= 1) return null; // boolean: 0→1 only
  const def = RESEARCH_COSTS[type];
  return def ? { minerals: def.minerals, gas: def.gas, time: def.time } : null;
}

/** Which research types each building type can perform. */
export const BUILDING_RESEARCH: Partial<Record<BuildingType, UpgradeType[]>> = {
  [BuildingType.CommandUplink]:  [UpgradeType.FactionAbility1, UpgradeType.FactionAbility2],
  [BuildingType.EvolutionDen]:   [UpgradeType.FactionAbility1, UpgradeType.FactionAbility2],
  [BuildingType.ArcaneLibrary]:  [UpgradeType.FactionAbility1, UpgradeType.FactionAbility2],
  [BuildingType.AdvancedForge]:  [UpgradeType.FactionAbility1, UpgradeType.FactionAbility2],
};

/**
 * Sentinel offset stored in prodUnitType for upgrade research.
 * Values 128+ mean "researching upgrade (value - 128)".
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
  // Boolean research types (faction-specific)
  if (RESEARCH_COSTS[type] !== undefined) {
    return getResearchCost(type, currentLevel);
  }
  // Leveled upgrades (weapons/armor, 3 levels)
  if (currentLevel >= 3) return null;
  return UPGRADE_COSTS[type]?.[currentLevel] ?? null;
}

const UPGRADE_BUILDINGS = new Set([
  BuildingType.CommandUplink, BuildingType.EvolutionDen,
  BuildingType.ArcaneLibrary, BuildingType.AdvancedForge,
]);

/**
 * Advances research timers on upgrade buildings.
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
      }
      prodUnitType[eid] = 0;
      prodProgress[eid] = 0;
      prodTimeTotal[eid] = 0;
    }
  }
}

/** Check if a building can research a given type */
export function canBuildingResearch(eid: number, type: UpgradeType): boolean {
  const bt = buildingType[eid] as BuildingType;
  const available = BUILDING_RESEARCH[bt];
  if (!available || !available.includes(type)) return false;
  return true;
}
