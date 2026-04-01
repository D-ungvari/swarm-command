import { type World, hasComponents } from '../ecs/world';
import { BUILDING, buildingType, buildState, faction, prodUnitType, prodProgress, prodTimeTotal } from '../ecs/components';
import { BuildState, BuildingType, UpgradeType } from '../constants';
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
};

/**
 * Sentinel offset stored in prodUnitType for upgrade research.
 * Values 128–133 mean "researching upgrade (value - 128)".
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
  if (currentLevel >= 3) return null;
  return UPGRADE_COSTS[type]?.[currentLevel] ?? null;
}

const UPGRADE_BUILDINGS = new Set([BuildingType.EngineeringBay, BuildingType.EvolutionChamber]);

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
        res.upgrades[upgradeType] = Math.min(3, res.upgrades[upgradeType] + 1) as 0 | 1 | 2 | 3;
      }
      prodUnitType[eid] = 0;
      prodProgress[eid] = 0;
      prodTimeTotal[eid] = 0;
    }
  }
}
