import { type World, hasComponents, entityExists, removeEntity } from '../ecs/world';
import {
  POSITION, HEALTH, BUILDING,
  posX, posY, faction, hpCurrent,
  resetComponents,
  buildingType, buildState, builderEid, supplyProvided,
  commandMode, workerState, workerTargetEid,
} from '../ecs/components';
import { BUILDING_DEFS } from '../data/buildings';
import { clearBuildingTiles, worldToTile } from '../map/MapData';
import { CommandMode, WorkerState } from '../constants';
import type { PlayerResources } from '../types';
import type { MapData } from '../map/MapData';

export interface DeathEvent {
  x: number;
  y: number;
  faction: number;
  time: number;
}

/** Bounded array of recent death events for rendering effects */
const MAX_DEATH_EVENTS = 64;
export const deathEvents: DeathEvent[] = [];

const DEATH_EVENT_LIFETIME = 0.5; // seconds

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

    // Record death event
    if (deathEvents.length < MAX_DEATH_EVENTS) {
      deathEvents.push({
        x: posX[eid],
        y: posY[eid],
        faction: faction[eid],
        time: gameTime,
      });
    }

    // Building cleanup: clear tiles, release supply, release builder
    if (hasComponents(world, eid, BUILDING) && map) {
      const bDef = BUILDING_DEFS[buildingType[eid]];
      if (bDef) {
        const tile = worldToTile(posX[eid], posY[eid]);
        clearBuildingTiles(map, tile.col, tile.row, bDef.tileWidth, bDef.tileHeight);
      }
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

    // Clean up entity
    resetComponents(eid);
    removeEntity(world, eid);
  }
}
