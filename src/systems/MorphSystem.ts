import type { World } from '../ecs/world';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;
type KillFn = (eid: number) => void;

/**
 * Morph system (no-op in new IP — SC2-specific morph mechanic removed).
 */
export function morphSystem(
  _world: World,
  _dt: number,
  _spawnFn: SpawnFn,
  _killFn: KillFn,
): void {
  // stub — morph mechanic removed
}
