import { type World, hasComponents, entityExists } from './world';
import {
  POSITION, SELECTABLE, RENDERABLE, HEALTH, ATTACK,
  posX, posY, renderWidth, renderHeight, faction, hpCurrent, atkRange,
} from './components';
import type { Faction } from '../constants';

/**
 * Find the closest unit at a world position (for click targeting).
 * Returns entity ID or 0 if none found.
 */
export function findUnitAt(world: World, wx: number, wy: number): number {
  const bits = POSITION | SELECTABLE | RENDERABLE;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + 4;
    const halfH = renderHeight[eid] / 2 + 4;

    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestEid = eid;
      }
    }
  }

  return closestEid;
}

/**
 * Find the closest enemy unit at a world position.
 * Returns entity ID or 0 if none found.
 */
export function findEnemyAt(world: World, wx: number, wy: number, myFaction: Faction): number {
  const bits = POSITION | SELECTABLE | RENDERABLE | HEALTH;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] === myFaction || faction[eid] === 0) continue;
    if (hpCurrent[eid] <= 0) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + 4;
    const halfH = renderHeight[eid] / 2 + 4;

    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestEid = eid;
      }
    }
  }

  return closestEid;
}

/**
 * Find the closest enemy within attack range of an entity.
 * Returns entity ID or 0 if none found.
 */
export function findClosestEnemy(world: World, eid: number, range: number): number {
  const myFac = faction[eid];
  const ex = posX[eid];
  const ey = posY[eid];
  const rangeSq = range * range;

  const bits = POSITION | HEALTH;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let other = 1; other < world.nextEid; other++) {
    if (other === eid) continue;
    if (!hasComponents(world, other, bits)) continue;
    if (faction[other] === myFac || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;

    const dx = posX[other] - ex;
    const dy = posY[other] - ey;
    const distSq = dx * dx + dy * dy;

    if (distSq <= rangeSq && distSq < closestDist) {
      closestDist = distSq;
      closestEid = other;
    }
  }

  return closestEid;
}
