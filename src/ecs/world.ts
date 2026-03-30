import { MAX_ENTITIES } from '../constants';

/**
 * Minimal hand-rolled ECS using TypedArrays for cache-friendly access.
 *
 * - Entity = integer ID (1-based, 0 = no entity)
 * - Component = set of parallel TypedArrays
 * - System = function that iterates over entities with required components
 * - Bitmask tracks which components each entity has
 */

// Each component gets a unique bit
let nextBit = 0;

export function componentBit(): number {
  if (nextBit >= 32) throw new Error('Max 32 component types (use BigInt if more needed)');
  return 1 << nextBit++;
}

export interface World {
  /** Bitmask of which components each entity has */
  mask: Uint32Array;
  /** Entity IDs that are free for reuse */
  freeList: number[];
  /** Next entity ID to allocate if freeList is empty */
  nextEid: number;
  /** Number of living entities */
  entityCount: number;
}

export function createWorld(): World {
  return {
    mask: new Uint32Array(MAX_ENTITIES),
    freeList: [],
    nextEid: 1, // 0 is reserved for "no entity"
    entityCount: 0,
  };
}

export function addEntity(world: World): number {
  const eid = world.freeList.length > 0
    ? world.freeList.pop()!
    : world.nextEid++;

  if (eid >= MAX_ENTITIES) throw new Error(`Entity limit reached (${MAX_ENTITIES})`);
  world.mask[eid] = 0;
  world.entityCount++;
  return eid;
}

export function removeEntity(world: World, eid: number): void {
  if (world.mask[eid] === 0) return; // already dead
  world.mask[eid] = 0;
  world.freeList.push(eid);
  world.entityCount--;
}

export function entityExists(world: World, eid: number): boolean {
  return eid > 0 && eid < MAX_ENTITIES && world.mask[eid] !== 0;
}

/** Check if entity has all given component bits */
export function hasComponents(world: World, eid: number, bits: number): boolean {
  return (world.mask[eid] & bits) === bits;
}

/** Iterate over all entities matching a bitmask */
export function* queryEntities(world: World, bits: number): Generator<number> {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if ((world.mask[eid] & bits) === bits) {
      yield eid;
    }
  }
}

/** Faster non-generator version for hot loops */
export function queryEntitiesArray(world: World, bits: number, out: number[]): number {
  let count = 0;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if ((world.mask[eid] & bits) === bits) {
      out[count++] = eid;
    }
  }
  return count;
}
