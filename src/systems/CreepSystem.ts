import type { MapData } from '../map/MapData';
import type { World } from '../ecs/world';

/** Mark creep for re-spread (no-op in new IP). */
export function markCreepDirty(): void {
  // stub — creep mechanic removed
}

/** Creep spread system (no-op in new IP). */
export function creepSystem(_world: World, _map: MapData, _dt: number): void {
  // stub — creep mechanic removed
}

/** Reset the creep system (no-op in new IP). */
export function resetCreepSystem(): void {
  // stub — creep mechanic removed
}
