import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, MOVEMENT, WORKER, RESOURCE, BUILDING,
  posX, posY, faction,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  movePathIndex, setPath,
  resourceRemaining, hpCurrent, hpMax,
  buildingType, buildState,
  workerCountOnResource,
} from '../ecs/components';
import { findNearestMineral, findLeastSaturatedMineral } from '../ecs/queries';
import {
  WorkerState, BuildingType, BuildState, TILE_SIZE,
  WORKER_CARRY_MINERALS, WORKER_CARRY_GAS, MINE_DURATION, WORKER_MINE_RANGE,
  REPAIR_RATE, REPAIR_COST_RATIO,
} from '../constants';
import { findPath } from '../map/Pathfinder';
import { worldToTile, tileToWorld, findNearestWalkableTile, type MapData } from '../map/MapData';
import type { PlayerResources } from '../types';
import { soundManager } from '../audio/SoundManager';

const ARRIVAL_THRESHOLD = 96; // px — close enough to base to deposit (~3 tiles, accounts for 3x3 CC footprint)

/** If a worker is standing on an unwalkable tile, snap to the nearest walkable one. */
function ensureWalkable(eid: number, map: MapData): void {
  const tile = worldToTile(posX[eid], posY[eid]);
  if (tile.col < 0 || tile.col >= map.cols || tile.row < 0 || tile.row >= map.rows) return;
  if (map.walkable[tile.row * map.cols + tile.col] === 1) return;
  const walkable = findNearestWalkableTile(map, tile.col, tile.row);
  if (walkable) {
    const wp = tileToWorld(walkable.col, walkable.row);
    posX[eid] = wp.x;
    posY[eid] = wp.y;
  }
}

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

    // Safety: if worker ended up on an unwalkable tile (building placed on them, etc.), push out
    ensureWalkable(eid, map);

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
      case WorkerState.Repairing:
        tickRepairing(world, eid, dt, map, resources);
        break;
    }
  }
}

/** Determine if a target entity is a gas source (Refinery/Extractor building that is complete with gas remaining) */
function isGasTarget(world: World, target: number): boolean {
  if (hasComponents(world, target, BUILDING)) {
    const bt = buildingType[target];
    return (bt === BuildingType.Refinery || bt === BuildingType.Extractor) &&
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
  // Buildings are multi-tile but posX/Y is the top-left tile center, so use a larger range
  const isBuilding = hasComponents(world, target, BUILDING);
  const mineRange = isBuilding ? WORKER_MINE_RANGE * 1.5 : WORKER_MINE_RANGE;
  const dx = posX[target] - posX[eid];
  const dy = posY[target] - posY[eid];
  const distSq = dx * dx + dy * dy;

  if (distSq <= mineRange * mineRange) {
    startMining(eid, target);
  } else if (movePathIndex[eid] < 0) {
    // Not moving and not in range — try to path to resource
    const pathed = pathToResource(eid, target, map);
    if (!pathed) {
      // Path failed — check if we're already at the closest walkable tile
      if (isAtResourceTile(eid, target, map)) {
        // As close as we can get — start mining anyway
        startMining(eid, target);
      } else if (isBuilding) {
        return; // Gas workers: don't fall back to minerals — retry next tick
      } else {
        // Can't reach this patch (blocked by other workers/terrain) — try a different one
        const alt = findLeastSaturatedMineral(world, posX[eid], posY[eid], 12 * TILE_SIZE);
        if (alt > 0 && alt !== target) {
          workerTargetEid[eid] = alt;
          pathToResource(eid, alt, map);
        }
      }
    }
  }
}

/** Enter Mining state for a worker at a resource target. */
function startMining(eid: number, target: number): void {
  workerState[eid] = WorkerState.Mining;
  workerMineTimer[eid] = MINE_DURATION;
  movePathIndex[eid] = -1;
  workerCountOnResource[target]++;
  soundManager.playGather();
}

/** Check if a worker is already standing on the nearest walkable tile to the target. */
function isAtResourceTile(eid: number, target: number, map: MapData): boolean {
  const targetTile = worldToTile(posX[target], posY[target]);
  const walkable = findNearestWalkableTile(map, targetTile.col, targetTile.row);
  if (!walkable) return false;
  const workerTile = worldToTile(posX[eid], posY[eid]);
  return workerTile.col === walkable.col && workerTile.row === walkable.row;
}

function tickMining(world: World, eid: number, dt: number, map: MapData): void {
  workerMineTimer[eid] -= dt;
  if (workerMineTimer[eid] > 0) return;

  const target = workerTargetEid[eid];

  // Validate target
  if (target < 1 || !entityExists(world, target) || resourceRemaining[target] <= 0) {
    // Decrement saturation counter before going idle
    if (target >= 1 && workerCountOnResource[target] > 0) {
      workerCountOnResource[target]--;
    }
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    return;
  }

  // Decrement saturation — worker is leaving to return to base
  if (workerCountOnResource[target] > 0) {
    workerCountOnResource[target]--;
  }

  // Apply efficiency penalty for over-saturated patches (more than 2 workers)
  const currentWorkers = workerCountOnResource[target]; // already decremented
  // saturation check: if 2+ others were mining at same time (i.e. counter was >2 before decrement)
  const totalOnPatch = currentWorkers + 1; // include this worker that just finished
  let carryAmount = getCarryAmount(world, target);
  if (totalOnPatch > 2) {
    const efficiency = Math.min(1.0, 2.0 / totalOnPatch);
    carryAmount = Math.round(carryAmount * efficiency);
  }

  // Pick up resources (capped at remaining)
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

    // Go back for more — pick the least-saturated nearby mineral patch
    if (target >= 1 && entityExists(world, target) && resourceRemaining[target] > 0) {
      // For Refinery (gas), stick with the same one
      if (hasComponents(world, target, BUILDING) && !isGasTarget(world, target)) {
        workerState[eid] = WorkerState.Idle;
        workerTargetEid[eid] = -1;
        return;
      }
      if (isGas) {
        // Gas: always return to same refinery
        workerState[eid] = WorkerState.MovingToResource;
        pathToResource(eid, target, map);
      } else {
        // Mineral: pick least-saturated nearby patch for balanced gathering
        const better = findLeastSaturatedMineral(world, posX[eid], posY[eid], 12 * TILE_SIZE);
        const nextTarget = better > 0 ? better : target;
        workerTargetEid[eid] = nextTarget;
        workerState[eid] = WorkerState.MovingToResource;
        pathToResource(eid, nextTarget, map);
      }
    } else {
      // Original target gone — find any nearby mineral
      const alt = findLeastSaturatedMineral(world, posX[eid], posY[eid], 12 * TILE_SIZE)
        || findNearestMineral(world, posX[eid], posY[eid]);
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

const REPAIR_RANGE = WORKER_MINE_RANGE * 2; // px — generous range for buildings

function tickRepairing(
  world: World,
  eid: number,
  dt: number,
  map: MapData,
  resources: Record<number, PlayerResources>,
): void {
  const target = workerTargetEid[eid];

  // Validate target still exists and is alive
  if (target < 1 || !entityExists(world, target) || hpCurrent[target] <= 0) {
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    return;
  }

  // Check if target is still damaged
  if (hpCurrent[target] >= hpMax[target]) {
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    return;
  }

  // Check if player has minerals
  const fac = faction[eid];
  const res = resources[fac];
  if (!res || res.minerals <= 0) {
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    return;
  }

  // Check range
  const dx = posX[target] - posX[eid];
  const dy = posY[target] - posY[eid];
  const distSq = dx * dx + dy * dy;

  if (distSq > REPAIR_RANGE * REPAIR_RANGE) {
    // Out of range — path toward target
    if (movePathIndex[eid] < 0) {
      pathToEntity(eid, target, map);
    }
    return;
  }

  // In range — stop movement and repair
  movePathIndex[eid] = -1;

  const hpToRestore = Math.min(
    REPAIR_RATE * dt,
    hpMax[target] - hpCurrent[target],
  );

  // Cap by available minerals
  const affordable = Math.min(hpToRestore, res.minerals / REPAIR_COST_RATIO);
  if (affordable <= 0) {
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
    return;
  }

  const actualRestore = Math.min(affordable, hpMax[target] - hpCurrent[target]);
  hpCurrent[target] += actualRestore;
  res.minerals -= actualRestore * REPAIR_COST_RATIO;
}

function pathToEntity(eid: number, target: number, map: MapData): void {
  const targetTile = worldToTile(posX[target], posY[target]);
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

function pathToResource(eid: number, target: number, map: MapData): boolean {
  const targetTile = worldToTile(posX[target], posY[target]);
  // Resource tiles are unwalkable — find nearest walkable tile
  const walkable = findNearestWalkableTile(map, targetTile.col, targetTile.row);
  if (!walkable) return false;

  const startTile = worldToTile(posX[eid], posY[eid]);

  // Already at the destination tile — no path needed
  if (startTile.col === walkable.col && startTile.row === walkable.row) return true;

  const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    });
    setPath(eid, worldPath);
    return true;
  }
  return false;
}

function pathToBase(eid: number, map: MapData): void {
  const baseTile = worldToTile(workerBaseX[eid], workerBaseY[eid]);
  // Base tile may be unwalkable (building sits on it) — find nearest walkable tile
  const walkable = findNearestWalkableTile(map, baseTile.col, baseTile.row);
  if (!walkable) return;

  const startTile = worldToTile(posX[eid], posY[eid]);

  // Already at the base tile — no path needed, deposit will happen immediately
  if (startTile.col === walkable.col && startTile.row === walkable.row) {
    movePathIndex[eid] = -1;
    return;
  }

  const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    });
    setPath(eid, worldPath);
  } else {
    // Fallback: no path found, deposit will trigger via movePathIndex < 0
    movePathIndex[eid] = -1;
  }
}
