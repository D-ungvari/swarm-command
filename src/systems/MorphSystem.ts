import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, UNIT_TYPE,
  posX, posY, faction, hpCurrent,
  morphTarget, morphProgress, morphTimeTotal,
} from '../ecs/components';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;
type KillFn = (eid: number) => void;

/**
 * Advances morph timers. When a morph completes, kills the source unit
 * and spawns the target unit at the same position.
 */
export function morphSystem(
  world: World,
  dt: number,
  spawnFn: SpawnFn,
  killFn: KillFn,
): void {
  const bits = POSITION | HEALTH | UNIT_TYPE;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (morphTarget[eid] === 0) continue;
    if (hpCurrent[eid] <= 0) continue;

    morphProgress[eid] -= dt;
    if (morphProgress[eid] <= 0) {
      // Morph complete: spawn target, kill source
      const targetType = morphTarget[eid];
      const fac = faction[eid];
      const x = posX[eid];
      const y = posY[eid];

      spawnFn(targetType, fac, x, y);
      killFn(eid);

      morphTarget[eid] = 0;
      morphProgress[eid] = 0;
      morphTimeTotal[eid] = 0;
    }
  }
}
