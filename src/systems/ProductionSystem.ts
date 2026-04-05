import { type World, hasComponents } from '../ecs/world';
import {
  BUILDING, POSITION,
  buildState, buildingType,
  prodUnitType, prodProgress, prodTimeTotal,
  prodSlot2UnitType, prodSlot2Progress, prodSlot2TimeTotal,
  prodQueue, prodQueueLen, prodQueueProgress, prodQueueTimeTotal, PROD_QUEUE_MAX,
  posX, posY, faction, rallyX, rallyY, hpCurrent, hpMax,
  commandMode, setPath, movePathIndex,
  workerState, workerTargetEid, workerBaseX, workerBaseY,
  unitType as unitTypeArr, WORKER,
  larvaCount, larvaRegenTimer, injectTimer,
  addonType,
  upgradingTo, upgradeProgress, upgradeTimeTotal,
} from '../ecs/components';
import { BuildState, BuildingType, CommandMode, UnitType, WorkerState, LARVA_MAX, LARVA_INJECT_MAX, LARVA_REGEN_TIME, INJECT_LARVA_BONUS, AddonType, isHatchType } from '../constants';
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

  // ── Larva regeneration (Zerg Hatchery/Lair/Hive) ──
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING)) continue;
    if (!isHatchType(buildingType[eid])) continue;
    if (buildState[eid] !== BuildState.Complete) continue;

    // Inject larva completion
    if (injectTimer[eid] > 0 && gameTime >= injectTimer[eid]) {
      larvaCount[eid] = Math.min(larvaCount[eid] + INJECT_LARVA_BONUS, LARVA_INJECT_MAX);
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

  // ── Building upgrade tick (Hatchery→Lair→Hive) ──
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING)) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (upgradingTo[eid] === 0) continue;

    upgradeProgress[eid] -= dt;
    if (upgradeProgress[eid] <= 0) {
      // Upgrade complete: transform building
      const targetType = upgradingTo[eid] as BuildingType;
      const targetDef = BUILDING_DEFS[targetType];
      buildingType[eid] = targetType;
      if (targetDef) {
        hpMax[eid] = targetDef.hp;
        hpCurrent[eid] = targetDef.hp;
      }
      upgradingTo[eid] = 0;
      upgradeProgress[eid] = 0;
      upgradeTimeTotal[eid] = 0;
    }
  }

  // Helper: spawn a completed unit, rally, and auto-gather
  function spawnCompleted(eid: number, uType: number): void {
    const fac = faction[eid];
    const bDef = BUILDING_DEFS[buildingType[eid]];
    const bTile = worldToTile(posX[eid], posY[eid]);
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

    const newEid = spawnFn(uType, fac, sx, sy);
    soundManager.playProdComplete();

    if (rallyX[eid] >= 0 && newEid > 0) {
      commandMode[newEid] = CommandMode.Move;
      const startTile = worldToTile(sx, sy);
      const endTile = worldToTile(rallyX[eid], rallyY[eid]);
      const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
      if (tilePath.length > 0) {
        const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
          const wp2 = tileToWorld(c, r);
          return [wp2.x, wp2.y] as [number, number];
        });
        setPath(newEid, worldPath);
      }
    }

    if (newEid > 0 && hasComponents(world, newEid, WORKER) && rallyX[eid] < 0) {
      const mineral = findNearestMineral(world, sx, sy);
      if (mineral > 0) {
        workerTargetEid[newEid] = mineral;
        workerState[newEid] = WorkerState.MovingToResource;
        commandMode[newEid] = CommandMode.Gather;
        workerBaseX[newEid] = posX[eid];
        workerBaseY[newEid] = posY[eid];
        const resTile = worldToTile(posX[mineral], posY[mineral]);
        const walkTile = findNearestWalkableTile(map, resTile.col, resTile.row);
        if (walkTile) {
          const startTile = worldToTile(sx, sy);
          const tilePath = findPath(map, startTile.col, startTile.row, walkTile.col, walkTile.row);
          if (tilePath.length > 0) {
            const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
              const wp2 = tileToWorld(c, r);
              return [wp2.x, wp2.y] as [number, number];
            });
            setPath(newEid, worldPath);
          }
        }
      }
    }
  }

  // Helper: dequeue next item from production queue into a slot
  function dequeueNext(eid: number): { type: number; buildTime: number } | null {
    const qLen = prodQueueLen[eid];
    if (qLen === 0) return null;

    const qBase = eid * PROD_QUEUE_MAX;
    const nextType = prodQueue[qBase];
    const nextDef = UNIT_DEFS[nextType];
    if (!nextDef) {
      // Invalid — shift queue and skip
      shiftQueue(eid);
      return null;
    }

    // Zerg larva check (Hatchery/Lair/Hive)
    if (isHatchType(buildingType[eid])) {
      if (larvaCount[eid] <= 0) return null;
      larvaCount[eid]--;
      if (larvaRegenTimer[eid] <= 0 && larvaCount[eid] < LARVA_MAX) {
        larvaRegenTimer[eid] = LARVA_REGEN_TIME;
      }
    }

    shiftQueue(eid);
    return { type: nextType, buildTime: nextDef.buildTime };
  }

  // Helper: shift queue forward by one (shifts timers too for parallel morph support)
  function shiftQueue(eid: number): void {
    const qBase = eid * PROD_QUEUE_MAX;
    const qLen = prodQueueLen[eid];
    for (let i = 0; i < qLen - 1; i++) {
      prodQueue[qBase + i] = prodQueue[qBase + i + 1];
      prodQueueProgress[qBase + i] = prodQueueProgress[qBase + i + 1];
      prodQueueTimeTotal[qBase + i] = prodQueueTimeTotal[qBase + i + 1];
    }
    if (qLen > 0) {
      prodQueue[qBase + qLen - 1] = 0;
      prodQueueProgress[qBase + qLen - 1] = 0;
      prodQueueTimeTotal[qBase + qLen - 1] = 0;
      prodQueueLen[eid] = qLen - 1;
    }
  }

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    const bt = buildingType[eid] as BuildingType;
    if (bt === BuildingType.EngineeringBay || bt === BuildingType.EvolutionChamber || bt === BuildingType.Armory) continue;

    const hasReactor = addonType[eid] === AddonType.Reactor;
    const isZergBase = isHatchType(bt);

    // ── Slot 1 production ──
    if (prodUnitType[eid] !== 0) {
      prodProgress[eid] -= dt;
      if (prodProgress[eid] <= 0) {
        spawnCompleted(eid, prodUnitType[eid]);

        if (isZergBase) {
          // Zerg: slot 1 done, don't dequeue (queue items morph in parallel)
          prodUnitType[eid] = 0;
          prodProgress[eid] = 0;
          prodTimeTotal[eid] = 0;
        } else {
          // Terran: dequeue next for slot 1
          const next = dequeueNext(eid);
          if (next) {
            prodUnitType[eid] = next.type;
            prodProgress[eid] = next.buildTime;
            prodTimeTotal[eid] = next.buildTime;
          } else {
            prodUnitType[eid] = 0;
            prodProgress[eid] = 0;
            prodTimeTotal[eid] = 0;
          }
        }
      }
    }

    // ── Slot 2 production (Reactor only) ──
    if (hasReactor && prodSlot2UnitType[eid] !== 0) {
      prodSlot2Progress[eid] -= dt;
      if (prodSlot2Progress[eid] <= 0) {
        spawnCompleted(eid, prodSlot2UnitType[eid]);

        // Dequeue next for slot 2
        const next = dequeueNext(eid);
        if (next) {
          prodSlot2UnitType[eid] = next.type;
          prodSlot2Progress[eid] = next.buildTime;
          prodSlot2TimeTotal[eid] = next.buildTime;
        } else {
          prodSlot2UnitType[eid] = 0;
          prodSlot2Progress[eid] = 0;
          prodSlot2TimeTotal[eid] = 0;
        }
      }
    }

    // ── Zerg parallel queue morphing ──
    if (isZergBase) {
      const qBase = eid * PROD_QUEUE_MAX;
      let qLen = prodQueueLen[eid];
      for (let qi = qLen - 1; qi >= 0; qi--) {
        if (prodQueueProgress[qBase + qi] <= 0) continue;
        prodQueueProgress[qBase + qi] -= dt;
        if (prodQueueProgress[qBase + qi] <= 0) {
          // Morph complete — spawn and remove from queue
          spawnCompleted(eid, prodQueue[qBase + qi]);
          // Remove item at index qi by shifting remaining items down
          for (let j = qi; j < qLen - 1; j++) {
            prodQueue[qBase + j] = prodQueue[qBase + j + 1];
            prodQueueProgress[qBase + j] = prodQueueProgress[qBase + j + 1];
            prodQueueTimeTotal[qBase + j] = prodQueueTimeTotal[qBase + j + 1];
          }
          prodQueue[qBase + qLen - 1] = 0;
          prodQueueProgress[qBase + qLen - 1] = 0;
          prodQueueTimeTotal[qBase + qLen - 1] = 0;
          qLen--;
          prodQueueLen[eid] = qLen;
        }
      }
    }
  }
}
