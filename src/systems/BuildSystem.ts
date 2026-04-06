import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, BUILDING, ATTACK,
  posX, posY, faction,
  buildState, buildProgress, buildTimeTotal, builderEid,
  buildingType, hpCurrent, hpMax,
  supplyProvided as supplyProvidedArr,
  commandMode,
  movePathIndex,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash,
  canTargetGround, canTargetAir, targetEntity,
  isDetector, detectionRange,
} from '../ecs/components';
import { BUILDING_DEFS } from '../data/buildings';
import { BuildState, BuildingType, CommandMode, TILE_SIZE, isHQType } from '../constants';
import type { PlayerResources } from '../types';
import { markCreepDirty } from './CreepSystem';
import { worldToTile, tileToWorld, findNearestWalkableTile, type MapData } from '../map/MapData';

/**
 * Handles building construction progress.
 * Runs every tick. Construction progresses automatically (no worker required).
 */
export function buildSystem(
  world: World,
  dt: number,
  resources: Record<number, PlayerResources>,
  gameTime: number = 0,
  map?: MapData,
): void {
  const bits = BUILDING | POSITION;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (buildState[eid] !== BuildState.UnderConstruction) continue;

    // Increment construction progress unconditionally
    const increment = dt / buildTimeTotal[eid];
    buildProgress[eid] = Math.min(1.0, buildProgress[eid] + increment);

    // HP scales with progress
    hpCurrent[eid] = hpMax[eid] * (0.1 + 0.9 * buildProgress[eid]);

    // Check completion
    if (buildProgress[eid] >= 1.0) {
      buildState[eid] = BuildState.Complete;
      hpCurrent[eid] = hpMax[eid];
      buildProgress[eid] = 1.0;

      // Grant supply
      const def = BUILDING_DEFS[buildingType[eid]];
      if (def && def.supplyProvided > 0) {
        supplyProvidedArr[eid] = def.supplyProvided;
        const fac = faction[eid];
        if (resources[fac]) {
          resources[fac].supplyProvided += def.supplyProvided;
        }
      }

      // Defensive building: add ATTACK component so CombatSystem targets enemies
      if (def && def.damage && def.damage > 0) {
        world.mask[eid] |= ATTACK;
        atkDamage[eid] = def.damage;
        atkRange[eid] = (def.range ?? 0) * TILE_SIZE;
        atkCooldown[eid] = def.attackCooldown ?? 0;
        atkLastTime[eid] = 0;
        atkSplash[eid] = 0;
        canTargetGround[eid] = def.canTargetGround ?? 0;
        canTargetAir[eid] = def.canTargetAir ?? 0;
        targetEntity[eid] = -1;
        // HoldPosition prevents CombatSystem from trying to chase targets
        commandMode[eid] = CommandMode.HoldPosition;
      }

      // Detector buildings (e.g. Bunker, SpineTower, WardStone, TurretArray)
      const bt = buildingType[eid];
      if (bt === BuildingType.Bunker || bt === BuildingType.SpineTower
       || bt === BuildingType.WardStone || bt === BuildingType.TurretArray) {
        isDetector[eid] = 1;
        detectionRange[eid] = 11 * TILE_SIZE;
      }

      builderEid[eid] = -1;
    }
  }
}
