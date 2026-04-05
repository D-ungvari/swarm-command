import { type World, hasComponents, entityExists } from './world';
import {
  POSITION, SELECTABLE, RENDERABLE, HEALTH, ATTACK, RESOURCE, BUILDING, UNIT_TYPE,
  posX, posY, renderWidth, renderHeight, faction, hpCurrent, atkRange,
  resourceRemaining, resourceType, workerCountOnResource,
  buildingType, buildState,
  atkDamage, atkMinRange, targetEntity, pendingDamage,
  cloaked, burrowed, revealed,
  isAir, canTargetGround, canTargetAir,
} from './components';
import { type Faction, ResourceType, BuildingType, BuildState } from '../constants';
import { spatialHash } from './SpatialHash';

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

  spatialHash.ensureBuilt(world);
  const candidates = spatialHash.queryRadius(wx, wy, 32);
  for (const eid of candidates) {
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

  spatialHash.ensureBuilt(world);
  const candidates = spatialHash.queryRadius(ex, ey, range);
  for (const other of candidates) {
    if (other === eid) continue;
    if (!hasComponents(world, other, bits)) continue;
    if (faction[other] === myFac || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;

    // Respect air/ground targeting restrictions
    if (isAir[other] === 1 && !canTargetAir[eid]) continue;
    if (isAir[other] === 0 && !canTargetGround[eid]) continue;

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

/**
 * Find a resource entity at a world position (for click targeting).
 * Returns entity ID or 0 if none found.
 */
export function findResourceAt(world: World, wx: number, wy: number): number {
  const bits = POSITION | RESOURCE | RENDERABLE;
  let closestEid = 0;
  let closestDist = Infinity;

  spatialHash.ensureBuilt(world);
  const candidates = spatialHash.queryRadius(wx, wy, 32);
  for (const eid of candidates) {
    if (!hasComponents(world, eid, bits)) continue;
    if (resourceRemaining[eid] <= 0) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + 6;
    const halfH = renderHeight[eid] / 2 + 6;

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
 * Find the nearest mineral patch entity with resources remaining.
 */
export function findNearestMineral(world: World, wx: number, wy: number): number {
  const bits = POSITION | RESOURCE;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (resourceRemaining[eid] <= 0) continue;
    if (resourceType[eid] !== ResourceType.Mineral) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const distSq = dx * dx + dy * dy;

    if (distSq < closestDist) {
      closestDist = distSq;
      closestEid = eid;
    }
  }

  return closestEid;
}

/**
 * Find all mineral patches near a position, sorted by saturation (least workers first).
 * Used for distributing workers evenly across nearby patches.
 */
export function findNearbyMinerals(world: World, wx: number, wy: number, radius: number): number[] {
  const bits = POSITION | RESOURCE;
  const radiusSq = radius * radius;
  const results: Array<{ eid: number; workers: number; distSq: number }> = [];

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (resourceRemaining[eid] <= 0) continue;
    if (resourceType[eid] !== ResourceType.Mineral) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const distSq = dx * dx + dy * dy;
    if (distSq > radiusSq) continue;

    results.push({ eid, workers: workerCountOnResource[eid], distSq });
  }

  // Sort by worker count first (least saturated), then by distance as tiebreaker
  results.sort((a, b) => a.workers - b.workers || a.distSq - b.distSq);
  return results.map(r => r.eid);
}

/**
 * Find the least-saturated mineral patch near a position.
 * Prefers patches with fewer workers; uses distance as tiebreaker.
 */
export function findLeastSaturatedMineral(world: World, wx: number, wy: number, radius: number): number {
  const minerals = findNearbyMinerals(world, wx, wy, radius);
  return minerals.length > 0 ? minerals[0] : 0;
}

/**
 * Find a completed building of a specific type at a world position (click targeting).
 * Returns entity ID or 0 if none found.
 */
export function findBuildingAt(world: World, wx: number, wy: number, bType: BuildingType): number {
  const bits = POSITION | BUILDING | RENDERABLE;
  let closestEid = 0;
  let closestDist = Infinity;

  spatialHash.ensureBuilt(world);
  const candidates = spatialHash.queryRadius(wx, wy, 32);
  for (const eid of candidates) {
    if (!hasComponents(world, eid, bits)) continue;
    if (buildingType[eid] !== bType) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + 6;
    const halfH = renderHeight[eid] / 2 + 6;

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
 * Check if a completed building of a specific type exists for a faction.
 */
export function hasCompletedBuilding(world: World, fac: Faction, bType: BuildingType): boolean {
  const bits = POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== fac) continue;
    const bt = buildingType[eid];
    // Hive satisfies Lair requirements (Zerg tech chain)
    if (bt !== bType && !(bType === BuildingType.Lair && bt === BuildingType.Hive)) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;
    return true;
  }
  return false;
}

/**
 * Find the nearest completed Command Center for a given faction.
 */
export function findNearestCommandCenter(world: World, fac: Faction, wx: number, wy: number): number {
  const bits = POSITION | BUILDING;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== fac) continue;
    if (buildingType[eid] !== BuildingType.CommandCenter) continue;
    if (buildState[eid] !== BuildState.Complete) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const distSq = dx * dx + dy * dy;

    if (distSq < closestDist) {
      closestDist = distSq;
      closestEid = eid;
    }
  }

  return closestEid;
}

/**
 * Find the closest friendly building at or near a world position.
 * Returns entity ID or 0 if none found within tolerance.
 */
export function findFriendlyBuildingAt(world: World, wx: number, wy: number, myFaction: number): number {
  const bits = POSITION | BUILDING | RENDERABLE | HEALTH;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== myFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + 6;
    const halfH = renderHeight[eid] / 2 + 6;

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
 * Find the closest friendly unit (not building) at or near a world position.
 * Returns entity ID or 0 if none found within tolerance.
 */
export function findFriendlyAt(world: World, wx: number, wy: number, myFaction: number): number {
  const TOLERANCE = 32; // px — generous for click targeting
  const toleranceSq = TOLERANCE * TOLERANCE;

  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH | UNIT_TYPE)) continue;
    if (hasComponents(world, eid, BUILDING)) continue; // exclude buildings
    if (faction[eid] !== myFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const distSq = dx * dx + dy * dy;
    if (distSq <= toleranceSq && distSq < closestDist) {
      closestDist = distSq;
      closestEid = eid;
    }
  }

  return closestEid;
}

/**
 * Find the best enemy target for auto-acquire, using SC2-style priority scoring.
 *
 * Priority (lower = higher priority):
 *   0 — enemy is targeting ME (retaliation)
 *   1 — armed non-building unit
 *   2 — unarmed non-building unit (worker, Medivac)
 *   3 — building
 *
 * Within each tier, prefer the closest entity.
 * Overkill prevention: skip targets where pendingDamage >= hpCurrent.
 */
export function findBestTarget(world: World, eid: number, range: number): number {
  const myFac = faction[eid];
  const rangeSq = range * range;

  // Track best candidate per priority tier [0..3]
  const bestEid = [0, 0, 0, 0];
  const bestDist = [Infinity, Infinity, Infinity, Infinity];

  spatialHash.ensureBuilt(world);
  const candidates = spatialHash.queryRadius(posX[eid], posY[eid], range);
  for (const other of candidates) {
    if (!hasComponents(world, other, POSITION | HEALTH)) continue;
    if (faction[other] === myFac || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;

    // Skip cloaked/burrowed enemies unless revealed by a detector
    if ((cloaked[other] === 1 || burrowed[other] === 1) && revealed[other] === 0) continue;

    // Respect air/ground targeting restrictions
    if (isAir[other] === 1 && !canTargetAir[eid]) continue;
    if (isAir[other] === 0 && !canTargetGround[eid]) continue;

    // Overkill prevention: skip heavily over-committed targets (allow 50% overshoot)
    if (pendingDamage[other] >= hpCurrent[other] * 1.5) continue;

    const dx = posX[other] - posX[eid];
    const dy = posY[other] - posY[eid];
    const distSq = dx * dx + dy * dy;
    if (distSq > rangeSq) continue;
    // Skip targets inside minimum range (e.g., sieged tank can't fire at close targets)
    if (atkMinRange[eid] > 0 && distSq < atkMinRange[eid] * atkMinRange[eid]) continue;

    // Priority scoring
    let score: number;
    if (targetEntity[other] === eid) {
      score = 0; // retaliating
    } else if (!hasComponents(world, other, BUILDING) && atkDamage[other] > 0) {
      score = 1; // armed unit
    } else if (!hasComponents(world, other, BUILDING)) {
      score = 2; // unarmed unit (worker/Medivac)
    } else {
      score = 3; // building
    }

    if (distSq < bestDist[score]) {
      bestDist[score] = distSq;
      bestEid[score] = other;
    }
  }

  // Return highest-priority candidate
  for (let s = 0; s <= 3; s++) {
    if (bestEid[s] > 0) return bestEid[s];
  }
  return 0;
}
