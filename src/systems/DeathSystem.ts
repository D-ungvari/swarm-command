import { type World, hasComponents, entityExists, removeEntity } from '../ecs/world';
import {
  POSITION, HEALTH,
  posX, posY, faction, hpCurrent,
  resetComponents,
} from '../ecs/components';

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
export function deathSystem(world: World, gameTime: number): void {
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

    // Clean up entity
    resetComponents(eid);
    removeEntity(world, eid);
  }
}
