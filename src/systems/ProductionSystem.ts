import { type World, hasComponents } from '../ecs/world';
import {
  BUILDING, POSITION,
  buildState, buildingType,
  prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, prodQueueProgress, prodQueueTimeTotal, PROD_QUEUE_MAX,
  posX, posY, faction, rallyX, rallyY,
  hpCurrent, hpMax,
  commandMode, setPath, movePathIndex,
  upgradingTo, upgradeProgress, upgradeTimeTotal,
} from '../ecs/components';
import { BuildState, BuildingType, CommandMode, isHQType } from '../constants';
import type { PlayerResources } from '../types';
import type { MapData } from '../map/MapData';
import { findNearestWalkableTile, worldToTile, tileToWorld } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { soundManager } from '../audio/SoundManager';
import { UPGRADE_RESEARCH_OFFSET } from './UpgradeSystem';

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

  // ── Building upgrade tick (e.g. HQ tier upgrades) ──
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

  // Helper: spawn a completed unit, rally
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
      // Combat units: attack-move to rally
      commandMode[newEid] = CommandMode.AttackMove;
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

    shiftQueue(eid);
    return { type: nextType, buildTime: nextDef.buildTime };
  }

  // Helper: shift queue forward by one
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
    // Skip upgrade-only buildings
    if (bt === BuildingType.CommandUplink || bt === BuildingType.EvolutionDen
     || bt === BuildingType.ArcaneLibrary || bt === BuildingType.AdvancedForge) continue;

    // ── Slot 1 production ── (skip if this slot holds a research marker)
    if (prodUnitType[eid] !== 0 && prodUnitType[eid] < UPGRADE_RESEARCH_OFFSET) {
      prodProgress[eid] -= dt;
      if (prodProgress[eid] <= 0) {
        spawnCompleted(eid, prodUnitType[eid]);

        // Dequeue next for slot 1
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
}
