import { type World, hasComponents } from '../ecs/world';
import {
  BUILDING, POSITION,
  buildState, buildingType,
  prodUnitType, prodProgress, prodTimeTotal,
  posX, posY, faction, rallyX, rallyY,
  commandMode, setPath, movePathIndex,
  workerState, workerTargetEid, workerBaseX, workerBaseY,
  unitType as unitTypeArr, WORKER,
} from '../ecs/components';
import { BuildState, CommandMode, UnitType, WorkerState } from '../constants';
import type { PlayerResources } from '../types';
import type { MapData } from '../map/MapData';
import { findNearestWalkableTile, worldToTile, tileToWorld } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import { BUILDING_DEFS } from '../data/buildings';
import { findNearestMineral } from '../ecs/queries';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;

/**
 * Handles unit production from completed buildings.
 * Runs every tick.
 */
export function productionSystem(
  world: World,
  dt: number,
  resources: Record<number, PlayerResources>,
  map: MapData,
  spawnFn: SpawnFn,
): void {
  const bits = BUILDING | POSITION;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
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

    // Reset production
    prodUnitType[eid] = 0;
    prodProgress[eid] = 0;
    prodTimeTotal[eid] = 0;
  }
}
