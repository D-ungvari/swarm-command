/**
 * Test helpers for Swarm Command ECS tests.
 *
 * Provides a `createTestWorld` that returns a fresh World,
 * and a `spawnUnit` helper that creates a fully-initialized unit entity.
 */

import { createWorld, addEntity, type World } from '../src/ecs/world';
import {
  addUnitComponents,
  resetComponents,
  posX, posY,
  hpCurrent, hpMax,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash, atkFlashTimer,
  moveSpeed, movePathIndex,
  faction,
  unitType,
  targetEntity,
  commandMode,
  renderWidth, renderHeight, renderTint,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd,
  lastCombatTime,
} from '../src/ecs/components';
import type { MapData } from '../src/map/MapData';

// Re-export const enum values as plain numbers so tests can use them
// (const enums are erased at compile time and can't be imported in tests)
export const Faction = { None: 0, Terran: 1, Zerg: 2 } as const;
export const UnitType = {
  SCV: 1, Marine: 2, Marauder: 3, SiegeTank: 4, Medivac: 5,
  Drone: 10, Zergling: 11, Baneling: 12, Hydralisk: 13, Roach: 14,
} as const;
export const CommandMode = {
  Idle: 0, Move: 1, AttackMove: 2, AttackTarget: 3,
} as const;
export const SiegeMode = {
  Mobile: 0, Sieged: 1, Packing: 2, Unpacking: 3,
} as const;

export interface SpawnOpts {
  x?: number;
  y?: number;
  hp?: number;
  damage?: number;
  range?: number;
  cooldown?: number;   // ms
  splash?: number;     // tile units
  speed?: number;
  factionId?: number;
  unitTypeId?: number;
  width?: number;
  height?: number;
}

/** Create a fresh world for a single test. */
export function createTestWorld(): World {
  return createWorld();
}

/**
 * Spawn a unit with sane defaults. Returns the entity ID.
 * All component arrays are set; the entity gets full unit bitmask.
 */
export function spawnUnit(world: World, opts: SpawnOpts = {}): number {
  const eid = addEntity(world);
  addUnitComponents(world, eid);

  posX[eid] = opts.x ?? 100;
  posY[eid] = opts.y ?? 100;
  hpCurrent[eid] = opts.hp ?? 100;
  hpMax[eid] = opts.hp ?? 100;
  atkDamage[eid] = opts.damage ?? 10;
  atkRange[eid] = opts.range ?? 160;    // px
  atkCooldown[eid] = opts.cooldown ?? 1000; // ms
  atkLastTime[eid] = -999;  // allow immediate first attack
  atkSplash[eid] = opts.splash ?? 0;
  atkFlashTimer[eid] = 0;
  moveSpeed[eid] = opts.speed ?? 90;
  movePathIndex[eid] = -1;
  faction[eid] = opts.factionId ?? Faction.Terran;
  unitType[eid] = opts.unitTypeId ?? UnitType.Marine;
  targetEntity[eid] = -1;
  commandMode[eid] = CommandMode.Idle;
  renderWidth[eid] = opts.width ?? 12;
  renderHeight[eid] = opts.height ?? 12;
  renderTint[eid] = 0xffffff;

  // Ability arrays — default to inactive
  stimEndTime[eid] = 0;
  slowEndTime[eid] = 0;
  slowFactor[eid] = 0;
  siegeMode[eid] = 0;
  siegeTransitionEnd[eid] = 0;
  lastCombatTime[eid] = 0;

  return eid;
}

/**
 * Reset all entities used in a test. Call in afterEach.
 * Pass all eids that were spawned.
 */
export function cleanupEntities(eids: number[]): void {
  for (const eid of eids) {
    resetComponents(eid);
  }
}

/**
 * Create a minimal all-walkable map for combat tests.
 * Small 16x16 so pathfinding is fast, all tiles walkable.
 */
export function createTestMap(): MapData {
  const cols = 16;
  const rows = 16;
  const tiles = new Uint8Array(cols * rows);   // 0 = Ground
  const walkable = new Uint8Array(cols * rows);
  walkable.fill(1);
  return { tiles, walkable, cols, rows };
}
