import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, MOVEMENT, WORKER, RESOURCE, BUILDING,
  posX, posY, faction,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  movePathIndex, setPath,
  resourceRemaining, hpCurrent, resourceType,
  buildingType, buildState,
} from '../ecs/components';
import { findNearestMineral } from '../ecs/queries';
import {
  WorkerState, ResourceType, BuildingType, BuildState,
  WORKER_CARRY_MINERALS, WORKER_CARRY_GAS, MINE_DURATION, WORKER_MINE_RANGE,
} from '../constants';
import { findPath } from '../map/Pathfinder';
import { worldToTile, tileToWorld, findNearestWalkableTile, type MapData } from '../map/MapData';
import type { PlayerResources } from '../types';
import { soundManager } from '../audio/SoundManager';

const ARRIVAL_THRESHOLD = 96; // px — close enough to base to deposit (~3 tiles, accounts for 3x3 CC footprint)

/**
 * Worker AI state machine: gather resources and deposit at base.
 * Runs every tick after AbilitySystem.
 */
export function gatherSystem(
  world: World,
  dt: number,
  map: MapData,
  resources: Record<number, PlayerResources>,
): void {
  const bits = WORKER | POSITION | MOVEMENT;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;

    const state = workerState[eid] as WorkerState;
    if (state === WorkerState.Idle) continue;

    switch (state) {
      case WorkerState.MovingToResource:
        tickMovingToResource(world, eid, map);
        break;
      case WorkerState.Mining:
        tickMining(world, eid, dt, map);
        break;
      case WorkerState.ReturningToBase:
        tickReturningToBase(world, eid, map, resources);
        break;
    }
  }
}

/** Determine if a target entity is a gas source (Refinery building or gas resource with refinery) */
function isGasTarget(world: World, target: number): boolean {
  // Refinery building that is complete and has gas remaining
  if (hasComponents(world, target, BUILDING)) {
    return buildingType[target] === BuildingType.Refinery &&
           buildState[target] === BuildState.Complete &&
           resourceRemaining[target] > 0;
  }
  return false;
}

/** Get the carry amount for a given target */
function getCarryAmount(world: World, target: number): number {
  if (isGasTarget(world, target)) {
    return WORKER_CARRY_GAS;
  }
  return WORKER_CARRY_MINERALS;
}

function tickMovingToResource(world: World, eid: number, map: MapData): void {
  const target = workerTargetEid[eid];

  // Validate target still exists and has resources
  if (target < 1 || !entityExists(world, target)) {
    // Try to find a new mineral patch nearby
    const alt = findNearestMineral(world, posX[eid], posY[eid]);
    if (alt > 0) {
      workerTargetEid[eid] = alt;
      pathToResource(eid, alt, map);
    } else {
      workerState[eid] = WorkerState.Idle;
      workerTargetEid[eid] = -1;
    }
    return;
  }

  // For Refinery buildings, check build state and resource remaining
  if (hasComponents(world, target, BUILDING)) {
    if (!isGasTarget(world, target)) {
      workerState[eid] = WorkerState.Idle;
      workerTargetEid[eid] = -1;
      return;
    }
  } else if (resourceRemaining[target] <= 0) {
    // Mineral patch depleted
    const alt = findNearestMineral(world, posX[eid], posY[eid]);
    if (alt > 0) {
      workerTargetEid[eid] = alt;
      pathToResource(eid, alt, map);
    } else {
      workerState[eid] = WorkerState.Idle;
      workerTargetEid[eid] = -1;
    }
    return;
  }

  // Check if within mining range
  const dx = posX[target] - posX[eid];
  const dy = posY[target] - posY[eid];
  const distSq = dx * dx + dy * dy;

  if (distSq <= WORKER_MINE_RANGE * WORKER_MINE_RANGE) {
    // Start mining
    workerState[eid] = WorkerState.Mining;
    workerMineTimer[eid] = MINE_DURATION;
    movePathIndex[eid] = -1; // Stop movement
    soundManager.playGather();
  } else if (movePathIndex[eid] < 0) {
    // Not moving and not in range — path to resource
    pathToResource(eid, target, map);
  }
}

function tickMining(world: World, eid: number, dt: number, map: MapData): void {
  workerMineTimer[eid] -= dt;
  if (workerMineTimer[eid] > 0) return;

  const target = workerTargetEid[eid];

  // Validate target
  if (target < 1 || !entityExists(world, target) || resourceRemaining[target] <= 0) {
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    return;
  }

  // Pick up resources (capped at remaining)
  const carryAmount = getCarryAmount(world, target);
  const amount = Math.min(carryAmount, resourceRemaining[target]);
  workerCarrying[eid] = amount;
  resourceRemaining[target] -= amount;

  // For non-Refinery resource entities, also reduce HP for depletion visual
  if (!hasComponents(world, target, BUILDING)) {
    hpCurrent[target] -= amount; // DeathSystem will remove when <= 0
  }

  // Head back to base
  workerState[eid] = WorkerState.ReturningToBase;
  pathToBase(eid, map);
}

function tickReturningToBase(
  world: World,
  eid: number,
  map: MapData,
  resources: Record<number, PlayerResources>,
): void {
  const bx = workerBaseX[eid];
  const by = workerBaseY[eid];
  const dx = bx - posX[eid];
  const dy = by - posY[eid];
  const distSq = dx * dx + dy * dy;

  // If still moving along path, wait
  if (movePathIndex[eid] >= 0 && distSq > ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD) {
    return;
  }

  // Close enough OR path finished (worker is as close as it can get) — deposit
  if (distSq <= ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD || movePathIndex[eid] < 0) {
    // Determine what we're carrying based on target
    const target = workerTargetEid[eid];
    const isGas = target >= 1 && entityExists(world, target) && isGasTarget(world, target);

    // Deposit
    const fac = faction[eid];
    if (resources[fac]) {
      if (isGas) {
        resources[fac].gas += workerCarrying[eid];
      } else {
        resources[fac].minerals += workerCarrying[eid];
      }
    }
    workerCarrying[eid] = 0;

    // Go back for more if target still exists
    if (target >= 1 && entityExists(world, target) && resourceRemaining[target] > 0) {
      // For Refinery, also check it's still complete
      if (hasComponents(world, target, BUILDING) && !isGasTarget(world, target)) {
        workerState[eid] = WorkerState.Idle;
        workerTargetEid[eid] = -1;
        return;
      }
      workerState[eid] = WorkerState.MovingToResource;
      pathToResource(eid, target, map);
    } else {
      // Find a new mineral patch
      const alt = findNearestMineral(world, posX[eid], posY[eid]);
      if (alt > 0) {
        workerTargetEid[eid] = alt;
        workerState[eid] = WorkerState.MovingToResource;
        pathToResource(eid, alt, map);
      } else {
        workerState[eid] = WorkerState.Idle;
        workerTargetEid[eid] = -1;
      }
    }
  }
}

function pathToResource(eid: number, target: number, map: MapData): void {
  const targetTile = worldToTile(posX[target], posY[target]);
  // Resource tiles are unwalkable — find nearest walkable tile
  const walkable = findNearestWalkableTile(map, targetTile.col, targetTile.row);
  if (!walkable) return;

  const startTile = worldToTile(posX[eid], posY[eid]);
  const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    });
    setPath(eid, worldPath);
  }
}

function pathToBase(eid: number, map: MapData): void {
  const baseTile = worldToTile(workerBaseX[eid], workerBaseY[eid]);
  // Base tile may be unwalkable (building sits on it) — find nearest walkable tile
  const walkable = findNearestWalkableTile(map, baseTile.col, baseTile.row);
  if (!walkable) return;

  const startTile = worldToTile(posX[eid], posY[eid]);
  const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    });
    setPath(eid, worldPath);
  }
}
