import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, BUILDING, WORKER,
  posX, posY, faction,
  buildState, buildProgress, buildTimeTotal, builderEid,
  buildingType, hpCurrent, hpMax,
  supplyProvided as supplyProvidedArr,
  commandMode, workerState, workerTargetEid,
} from '../ecs/components';
import { BUILDING_DEFS } from '../data/buildings';
import { BuildState, CommandMode, WorkerState, WORKER_MINE_RANGE } from '../constants';
import type { PlayerResources } from '../types';

/**
 * Handles building construction progress.
 * Runs every tick. Builder SCV must be adjacent for progress to increment.
 */
export function buildSystem(
  world: World,
  dt: number,
  resources: Record<number, PlayerResources>,
): void {
  const bits = BUILDING | POSITION;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (buildState[eid] !== BuildState.UnderConstruction) continue;

    const builder = builderEid[eid];

    // Check builder exists and is close enough
    if (builder < 1 || !entityExists(world, builder) || !hasComponents(world, builder, WORKER)) {
      builderEid[eid] = -1;
      continue;
    }

    const dx = posX[builder] - posX[eid];
    const dy = posY[builder] - posY[eid];
    const distSq = dx * dx + dy * dy;
    const range = WORKER_MINE_RANGE * 2; // Buildings are larger, need more range
    if (distSq > range * range) continue;

    // Increment construction progress
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

      // Release builder SCV
      if (entityExists(world, builder)) {
        commandMode[builder] = CommandMode.Idle;
        workerState[builder] = WorkerState.Idle;
        workerTargetEid[builder] = -1;
      }
      builderEid[eid] = -1;
    }
  }
}
