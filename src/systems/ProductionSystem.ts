import { type World, hasComponents } from '../ecs/world';
import {
  BUILDING, POSITION,
  buildState, buildingType,
  prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  posX, posY, faction, rallyX, rallyY,
  commandMode, setPath, movePathIndex,
  workerState, workerTargetEid, workerBaseX, workerBaseY,
  unitType as unitTypeArr, WORKER,
  larvaCount, larvaRegenTimer, injectTimer,
} from '../ecs/components';
import { BuildState, BuildingType, CommandMode, UnitType, WorkerState, LARVA_MAX, LARVA_REGEN_TIME, INJECT_LARVA_BONUS } from '../constants';
import type { PlayerResources } from '../types';
import type { MapData } from '../map/MapData';
import { findNearestWalkableTile, worldToTile, tileToWorld } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { findNearestMineral } from '../ecs/queries';
import { soundManager } from '../audio/SoundManager';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;

/**
 * Handles unit production from completed buildings, with a queue of up to 5.
 * Runs every tick.
 */
export function productionSystem(
  world: World,
  dt: number,
  resources: Record<number, PlayerResources>,
  map: MapData,
  spawnFn: SpawnFn,
  gameTime: number,
): void {
  const bits = BUILDING | POSITION;

  // ── Larva regeneration (Zerg Hatcheries) ──
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING)) continue;
    if (buildingType[eid] !== BuildingType.Hatchery) continue;
    if (buildState[eid] !== BuildState.Complete) continue;

    // Inject larva completion
    if (injectTimer[eid] > 0 && gameTime >= injectTimer[eid]) {
      larvaCount[eid] = Math.min(larvaCount[eid] + INJECT_LARVA_BONUS, larvaCount[eid] + INJECT_LARVA_BONUS);
      injectTimer[eid] = 0;
    }

    // Regular larva regeneration
    if (larvaCount[eid] < LARVA_MAX) {
      larvaRegenTimer[eid] -= dt;
      if (larvaRegenTimer[eid] <= 0) {
        larvaCount[eid]++;
        larvaRegenTimer[eid] = larvaCount[eid] < LARVA_MAX ? LARVA_REGEN_TIME : 0;
      }
    }
  }

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    // Upgrade buildings are handled by UpgradeSystem, not ProductionSystem
    const bt = buildingType[eid] as BuildingType;
    if (bt === BuildingType.EngineeringBay || bt === BuildingType.EvolutionChamber) continue;
    if (prodUnitType[eid] === 0) continue;

    // Decrement timer
    prodProgress[eid] -= dt;
    if (prodProgress[eid] > 0) continue;

    // Spawn the unit
    const uType = prodUnitType[eid];
    const fac = faction[eid];

    // Find spawn position: adjacent walkable tile
    const bDef = BUILDING_DEFS[buildingType[eid]];
    const bTile = worldToTile(posX[eid], posY[eid]);
    // Try below the building first
    const spawnTileRow = bTile.row + (bDef ? Math.ceil(bDef.tileHeight / 2) + 1 : 2);
    const walkable = findNearestWalkableTile(map, bTile.col, spawnTileRow);

    let sx: number, sy: number;
    if (walkable) {
      const wp = tileToWorld(walkable.col, walkable.row);
      sx = wp.x;
      sy = wp.y;
    } else {
      sx = posX[eid];
      sy = posY[eid] + 64;
    }

    // spawnUnitAt handles supply tracking internally
    const newEid = spawnFn(uType, fac, sx, sy);
    soundManager.playProdComplete();

    // Send to rally point if set
    if (rallyX[eid] >= 0 && newEid > 0) {
      commandMode[newEid] = CommandMode.Move;
      const startTile = worldToTile(sx, sy);
      const endTile = worldToTile(rallyX[eid], rallyY[eid]);
      const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
      if (tilePath.length > 0) {
        const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
          const wp = tileToWorld(c, r);
          return [wp.x, wp.y] as [number, number];
        });
        setPath(newEid, worldPath);
      }
    }

    // Workers auto-gather nearest minerals if no rally set
    if (newEid > 0 && hasComponents(world, newEid, WORKER) && rallyX[eid] < 0) {
      const mineral = findNearestMineral(world, sx, sy);
      if (mineral > 0) {
        workerTargetEid[newEid] = mineral;
        workerState[newEid] = WorkerState.MovingToResource;
        commandMode[newEid] = CommandMode.Gather;
        workerBaseX[newEid] = posX[eid]; // Return to this building
        workerBaseY[newEid] = posY[eid];
        const resTile = worldToTile(posX[mineral], posY[mineral]);
        const walkTile = findNearestWalkableTile(map, resTile.col, resTile.row);
        if (walkTile) {
          const startTile = worldToTile(sx, sy);
          const tilePath = findPath(map, startTile.col, startTile.row, walkTile.col, walkTile.row);
          if (tilePath.length > 0) {
            const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
              const wp = tileToWorld(c, r);
              return [wp.x, wp.y] as [number, number];
            });
            setPath(newEid, worldPath);
          }
        }
      }
    }

    // Advance the queue: shift items 1..N-1 to 0..N-2, decrement length
    const qBase = eid * PROD_QUEUE_MAX;
    const qLen = prodQueueLen[eid];
    if (qLen > 0) {
      // Shift queue forward
      for (let i = 0; i < qLen - 1; i++) {
        prodQueue[qBase + i] = prodQueue[qBase + i + 1];
      }
      prodQueue[qBase + qLen - 1] = 0;
      prodQueueLen[eid] = qLen - 1;

      // Start producing the next queued item
      if (qLen - 1 > 0) {
        const nextType = prodQueue[qBase];
        const nextDef = UNIT_DEFS[nextType];
        if (nextDef) {
          // Zerg: consume larva when starting a new unit
          if (buildingType[eid] === BuildingType.Hatchery && larvaCount[eid] === 0) {
            // No larva available — skip (don't start production)
            continue;
          }
          if (buildingType[eid] === BuildingType.Hatchery && larvaCount[eid] > 0) {
            larvaCount[eid]--;
            if (larvaRegenTimer[eid] <= 0 && larvaCount[eid] < LARVA_MAX) {
              larvaRegenTimer[eid] = LARVA_REGEN_TIME; // restart regen timer
            }
          }
          prodUnitType[eid] = nextType;
          prodProgress[eid] = nextDef.buildTime;
          prodTimeTotal[eid] = nextDef.buildTime;
        } else {
          // Invalid type in queue, clear
          prodUnitType[eid] = 0;
          prodProgress[eid] = 0;
          prodTimeTotal[eid] = 0;
        }
      } else {
        // Queue empty
        prodUnitType[eid] = 0;
        prodProgress[eid] = 0;
        prodTimeTotal[eid] = 0;
      }
    } else {
      // No queue — just reset
      prodUnitType[eid] = 0;
      prodProgress[eid] = 0;
      prodTimeTotal[eid] = 0;
    }
  }
}
