import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, BUILDING, WORKER, ATTACK,
  posX, posY, faction,
  buildState, buildProgress, buildTimeTotal, builderEid,
  buildingType, hpCurrent, hpMax,
  supplyProvided as supplyProvidedArr,
  commandMode, workerState, workerTargetEid,
  movePathIndex,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash,
  canTargetGround, canTargetAir, targetEntity,
} from '../ecs/components';
import { BUILDING_DEFS } from '../data/buildings';
import { BuildState, CommandMode, WorkerState, WORKER_MINE_RANGE, Faction, TILE_SIZE } from '../constants';
import type { PlayerResources } from '../types';
import { markCreepDirty } from './CreepSystem';
import { worldToTile, tileToWorld, findNearestWalkableTile, type MapData } from '../map/MapData';

/**
 * Handles building construction progress.
 * Runs every tick. Builder SCV must be adjacent for progress to increment.
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

    const isZerg = faction[eid] === Faction.Zerg;
    const builder = builderEid[eid];

    if (!isZerg) {
      // Terran: Check builder exists and is close enough
      if (builder < 1 || !entityExists(world, builder) || !hasComponents(world, builder, WORKER)) {
        builderEid[eid] = -1;
        continue;
      }

      const dx = posX[builder] - posX[eid];
      const dy = posY[builder] - posY[eid];
      const distSq = dx * dx + dy * dy;
      const range = WORKER_MINE_RANGE * 2; // Buildings are larger, need more range
      if (distSq > range * range) continue;

      // Orbit SCV around building during construction
      const angle = (gameTime * 1.0) + eid * 0.5; // slow rotation, unique per building
      const orbitRadius = 40; // px from building center
      posX[builder] = posX[eid] + Math.cos(angle) * orbitRadius;
      posY[builder] = posY[eid] + Math.sin(angle) * orbitRadius;
      movePathIndex[builder] = -1; // Clear any stale path
    }

    // Increment construction progress (Zerg: unconditional, Terran: builder in range)
    const increment = dt / buildTimeTotal[eid];
    buildProgress[eid] = Math.min(1.0, buildProgress[eid] + increment);

    // HP scales with progress
    hpCurrent[eid] = hpMax[eid] * (0.1 + 0.9 * buildProgress[eid]);

    // Check completion
    if (buildProgress[eid] >= 1.0) {
      buildState[eid] = BuildState.Complete;
      hpCurrent[eid] = hpMax[eid];
      buildProgress[eid] = 1.0;

      // Zerg building completed — mark creep for re-spread
      if (isZerg) markCreepDirty();

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

      // Release builder SCV (Terran only — Zerg drone was already consumed)
      if (!isZerg && builder > 0 && entityExists(world, builder)) {
        commandMode[builder] = CommandMode.Idle;
        workerState[builder] = WorkerState.Idle;
        workerTargetEid[builder] = -1;
        // Move SCV out of the building footprint to nearest walkable tile
        if (map) {
          const bTile = worldToTile(posX[eid], posY[eid]);
          const walkTile = findNearestWalkableTile(map, bTile.col, bTile.row);
          if (walkTile) {
            const wp = tileToWorld(walkTile.col, walkTile.row);
            posX[builder] = wp.x;
            posY[builder] = wp.y;
          }
        }
      }
      builderEid[eid] = -1;
    }
  }
}
