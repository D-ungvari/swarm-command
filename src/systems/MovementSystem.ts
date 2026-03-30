import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, MOVEMENT,
  posX, posY, velX, velY,
  moveSpeed, moveTargetX, moveTargetY,
  movePathIndex, pathLengths, getPathWaypoint,
  slowFactor, siegeMode,
} from '../ecs/components';
import { SiegeMode } from '../constants';

const ARRIVAL_THRESHOLD = 4; // px — close enough to waypoint

/**
 * Moves entities along their paths toward their targets.
 * Runs every tick.
 */
export function movementSystem(world: World, dt: number): void {
  const bits = POSITION | MOVEMENT;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;

    // Siege immobilization: sieged or transitioning tanks can't move
    const sm = siegeMode[eid] as SiegeMode;
    if (sm === SiegeMode.Sieged || sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) {
      velX[eid] = 0;
      velY[eid] = 0;
      movePathIndex[eid] = -1;
      continue;
    }

    const pathIdx = movePathIndex[eid];
    if (pathIdx < 0) {
      velX[eid] = 0;
      velY[eid] = 0;
      continue;
    }

    // Get current waypoint
    const wp = getPathWaypoint(eid, pathIdx);
    if (!wp) {
      // Path complete
      movePathIndex[eid] = -1;
      velX[eid] = 0;
      velY[eid] = 0;
      continue;
    }

    const [tx, ty] = wp;
    const dx = tx - posX[eid];
    const dy = ty - posY[eid];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVAL_THRESHOLD) {
      // Move to next waypoint
      movePathIndex[eid]++;
      if (movePathIndex[eid] >= pathLengths[eid]) {
        movePathIndex[eid] = -1;
        velX[eid] = 0;
        velY[eid] = 0;
      }
      continue;
    }

    // Apply slow debuff: reduce effective speed
    const effectiveSpeed = slowFactor[eid] > 0
      ? moveSpeed[eid] * (1 - slowFactor[eid])
      : moveSpeed[eid];

    const speed = effectiveSpeed * dt;
    const nx = dx / dist;
    const ny = dy / dist;
    velX[eid] = nx * effectiveSpeed;
    velY[eid] = ny * effectiveSpeed;

    posX[eid] += nx * speed;
    posY[eid] += ny * speed;
  }
}
