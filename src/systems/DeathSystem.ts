import { type World, hasComponents, entityExists, removeEntity } from '../ecs/world';
import {
  POSITION, HEALTH, BUILDING, UNIT_TYPE,
  posX, posY, faction, hpCurrent,
  resetComponents, unitType,
  buildingType, buildState, builderEid, supplyProvided, supplyCost,
  commandMode, workerState, workerTargetEid,
  deathTime, renderWidth, renderHeight,
} from '../ecs/components';
import { BUILDING_DEFS } from '../data/buildings';
import { clearBuildingTiles, worldToTile } from '../map/MapData';
import { BuildingType, CommandMode, WorkerState, Faction } from '../constants';
import type { PlayerResources } from '../types';
import type { MapData } from '../map/MapData';
import { soundManager } from '../audio/SoundManager';
import { triggerCameraShake } from '../rendering/CameraShake';
import { markCreepDirty } from './CreepSystem';

export interface DeathEvent {
  x: number;
  y: number;
  faction: number;
  time: number;
  size: number; // max(renderWidth, renderHeight) for scale-dependent effects
  unitType: number; // UnitType for unit-specific death visuals
}

/** Bounded array of recent death events for rendering effects */
const MAX_DEATH_EVENTS = 64;
export const deathEvents: DeathEvent[] = [];

const DEATH_EVENT_LIFETIME = 0.8; // seconds
const DEATH_ANIM_DURATION = 0.3; // seconds — shrink/fade before removal

/**
 * Removes entities with HP <= 0 and records death events.
 * Runs every tick after CombatSystem.
 */
export function deathSystem(
  world: World,
  gameTime: number,
  map?: MapData,
  resources?: Record<number, PlayerResources>,
): void {
  // Clean up old death events
  while (deathEvents.length > 0 && gameTime - deathEvents[0].time > DEATH_EVENT_LIFETIME) {
    deathEvents.shift();
  }

  const bits = POSITION | HEALTH;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (hpCurrent[eid] > 0) continue;

    // --- Pass 1: Start death animation for newly-dead entities ---
    if (deathTime[eid] === 0) {
      deathTime[eid] = gameTime;

      // Record death event for visual effects
      if (deathEvents.length < MAX_DEATH_EVENTS) {
        deathEvents.push({
          x: posX[eid],
          y: posY[eid],
          faction: faction[eid],
          time: gameTime,
          size: Math.max(renderWidth[eid] || 12, renderHeight[eid] || 12),
          unitType: hasComponents(world, eid, UNIT_TYPE) ? unitType[eid] : 0,
        });
      }
      soundManager.playDeath();

      // Camera shake on large unit/building deaths
      const unitSize = Math.max(renderWidth[eid] || 12, renderHeight[eid] || 12);
      if (hasComponents(world, eid, BUILDING)) {
        triggerCameraShake(6); // buildings always shake hard
      } else if (unitSize >= 24) {
        triggerCameraShake(unitSize * 0.15); // large units: Ultralisk, BC, Thor
      }
    }

    // --- Pass 2: Remove entities whose death animation has finished ---
    if (gameTime - deathTime[eid] < DEATH_ANIM_DURATION) continue;

    // Building cleanup: clear tiles, release supply, release builder
    if (hasComponents(world, eid, BUILDING) && map) {
      const bType = buildingType[eid];
      const bDef = BUILDING_DEFS[bType];
      if (bDef) {
        const tile = worldToTile(posX[eid], posY[eid]);
        // For destructible rocks, zero out the HP entry (tile type is reset by clearBuildingTiles)
        if (bType === BuildingType.Rock) {
          const idx = tile.row * map.cols + tile.col;
          map.destructibleHP[idx] = 0;
        }
        clearBuildingTiles(map, tile.col, tile.row, bDef.tileWidth, bDef.tileHeight);
      }
      // Zerg building destroyed — mark creep for re-spread
      if (faction[eid] === Faction.Zerg) markCreepDirty();
      // Release supply
      if (supplyProvided[eid] > 0 && resources) {
        const fac = faction[eid];
        if (resources[fac]) {
          resources[fac].supplyProvided -= supplyProvided[eid];
        }
      }
      // Release builder SCV
      const builder = builderEid[eid];
      if (builder > 0 && entityExists(world, builder)) {
        commandMode[builder] = CommandMode.Idle;
        workerState[builder] = WorkerState.Idle;
        workerTargetEid[builder] = -1;
      }
    }

    // Release supply used by the unit
    if (resources && supplyCost[eid] > 0) {
      const fac = faction[eid];
      if (resources[fac]) {
        resources[fac].supplyUsed -= supplyCost[eid];
      }
    }

    // Clean up entity
    resetComponents(eid);
    removeEntity(world, eid);
  }
}
