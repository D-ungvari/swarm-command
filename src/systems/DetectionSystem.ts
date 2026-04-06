import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH,
  posX, posY, faction, hpCurrent,
  cloaked, burrowed, revealed,
  isDetector, detectionRange,
} from '../ecs/components';

/**
 * Each tick: clear all revealed flags, then for each detector entity,
 * reveal cloaked/burrowed enemies within detection range.
 */
export function detectionSystem(world: World): void {
  const bits = POSITION | HEALTH;

  // Phase 1: clear all revealed flags
  for (let eid = 1; eid < world.nextEid; eid++) {
    revealed[eid] = 0;
  }

  // Phase 2: for each detector, reveal nearby cloaked/burrowed enemies
  for (let det = 1; det < world.nextEid; det++) {
    if (isDetector[det] !== 1) continue;
    if (!hasComponents(world, det, POSITION)) continue;
    if (hpCurrent[det] <= 0) continue;

    const dx0 = posX[det];
    const dy0 = posY[det];
    const range = detectionRange[det];
    const rangeSq = range * range;
    const detFac = faction[det];

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (eid === det) continue;
      if (!hasComponents(world, eid, bits)) continue;
      if (faction[eid] === detFac || faction[eid] === 0) continue;
      if (hpCurrent[eid] <= 0) continue;
      if (cloaked[eid] === 0 && burrowed[eid] === 0) continue;

      const ddx = posX[eid] - dx0;
      const ddy = posY[eid] - dy0;
      if (ddx * ddx + ddy * ddy <= rangeSq) {
        revealed[eid] = 1;
      }
    }
  }
}
