import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, MOVEMENT, WORKER, RESOURCE,
  posX, posY, faction,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  movePathIndex, setPath,
  resourceRemaining, hpCurrent, resourceType,
} from '../ecs/components';
import { findNearestMineral } from '../ecs/queries';
import { WorkerState, ResourceType, WORKER_CARRY_MINERALS, MINE_DURATION, WORKER_MINE_RANGE } from '../constants';
import { findPath } from '../map/Pathfinder';
import { worldToTile, tileToWorld, findNearestWalkableTile, type MapData } from '../map/MapData';
import type { PlayerResources } from '../types';

const ARRIVAL_THRESHOLD = 64; // px — close enough to base to deposit (~2 tiles, accounts for building footprint)

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

function tickMovingToResource(world: World, eid: number, map: MapData): void {
  const target = workerTargetEid[eid];

  // Validate target still exists and has resources
  if (target < 1 || !entityExists(world, target) || resourceRemaining[target] <= 0) {
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

  // Check if within mining range
  const dx = posX[target] - posX[eid];
  const dy = posY[target] - posY[eid];
  const distSq = dx * dx + dy * dy;

  if (distSq <= WORKER_MINE_RANGE * WORKER_MINE_RANGE) {
    // Start mining
    workerState[eid] = WorkerState.Mining;
    workerMineTimer[eid] = MINE_DURATION;
    movePathIndex[eid] = -1; // Stop movement
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

  // Pick up minerals (capped at remaining)
  const amount = Math.min(WORKER_CARRY_MINERALS, resourceRemaining[target]);
  workerCarrying[eid] = amount;
  resourceRemaining[target] -= amount;
  hpCurrent[target] -= amount; // DeathSystem will remove when <= 0

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

  // If path finished but not close enough, re-path
  if (movePathIndex[eid] < 0 && distSq > ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD) {
    pathToBase(eid, map);
    return;
  }

  if (distSq <= ARRIVAL_THRESHOLD * ARRIVAL_THRESHOLD) {
    // Deposit
    const fac = faction[eid];
    if (resources[fac]) {
      resources[fac].minerals += workerCarrying[eid];
    }
    workerCarrying[eid] = 0;

    // Go back for more if target still exists
    const target = workerTargetEid[eid];
    if (target >= 1 && entityExists(world, target) && resourceRemaining[target] > 0) {
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
