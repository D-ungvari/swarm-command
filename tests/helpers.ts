/**
 * Test helpers for Swarm Command ECS tests.
 *
 * Provides a `createTestWorld` that returns a fresh World,
 * and a `spawnUnit` helper that creates a fully-initialized unit entity.
 */

import { createWorld, addEntity, type World } from '../src/ecs/world';
import {
  addUnitComponents,
  addWorkerComponent,
  addResourceComponents,
  addBuildingComponents,
  resetComponents,
  WORKER, RESOURCE, BUILDING, SUPPLY,
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
  atkDamageType, armorClass, baseArmor, pendingDamage, killCount,
  resourceType, resourceRemaining,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  buildingType, buildState, buildProgress, buildTimeTotal, builderEid,
  rallyX, rallyY,
  prodUnitType, prodProgress, prodTimeTotal,
  supplyProvided, supplyCost,
  isAir, canTargetGround, canTargetAir,
} from '../src/ecs/components';
import type { MapData } from '../src/map/MapData';
import type { PlayerResources } from '../src/types';

// Re-export const enum values as plain numbers so tests can use them
// (const enums are erased at compile time and can't be imported in tests)
export const Faction = { None: 0, Terran: 1, Zerg: 2 } as const;
export const UnitType = {
  SCV: 1, Marine: 2, Marauder: 3, SiegeTank: 4, Medivac: 5,
  Ghost: 6, Hellion: 7,
  Drone: 10, Zergling: 11, Baneling: 12, Hydralisk: 13, Roach: 14, Mutalisk: 15,
  Queen: 16, Overlord: 17,
  Reaper: 18, Viking: 19, WidowMine: 20, Cyclone: 21, Thor: 22, Battlecruiser: 23,
  Ravager: 24, Lurker: 25, Infestor: 26, Ultralisk: 27, Corruptor: 28, Viper: 29,
} as const;
export const CommandMode = {
  Idle: 0, Move: 1, AttackMove: 2, AttackTarget: 3, Gather: 4, Build: 5,
  HoldPosition: 6, Patrol: 7,
} as const;
export const SiegeMode = {
  Mobile: 0, Sieged: 1, Packing: 2, Unpacking: 3,
} as const;
export const ResourceType = {
  Mineral: 1, Gas: 2,
} as const;
export const WorkerState = {
  Idle: 0, MovingToResource: 1, Mining: 2, ReturningToBase: 3,
} as const;
export const BuildingType = {
  CommandCenter: 20, SupplyDepot: 21, Barracks: 22,
  Refinery: 23, Factory: 24, Starport: 25,
  EngineeringBay: 26,
  Hatchery: 30, SpawningPool: 31,
} as const;
export const BuildState = {
  UnderConstruction: 1, Complete: 2,
} as const;
export const CommandType = {
  Move: 0, AttackMove: 1, AttackTarget: 2, Stop: 3, HoldPosition: 4, Patrol: 5,
  Stim: 6, SiegeToggle: 7, Gather: 8, SetRally: 9, BuildPlace: 10,
  Produce: 11, Cancel: 12, Select: 13, BoxSelect: 14, AddSelect: 15,
  DoubleClickSelect: 16, ControlGroupAssign: 17, ControlGroupRecall: 18,
  CycleSubgroup: 19, Cloak: 20, InjectLarva: 21,
  Yamato: 22, CorrosiveBile: 23, FungalGrowth: 24, Abduct: 25,
} as const;
export const DamageType = { Normal: 0, Concussive: 1, Explosive: 2 } as const;
export const ArmorClass = { Light: 0, Armored: 1 } as const;

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
  damageTypeId?: number;  // DamageType value
  armorClassId?: number;  // ArmorClass value
  isAirUnit?: boolean;
  canTargetGroundUnit?: boolean;
  canTargetAirUnit?: boolean;
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

  // Air/targeting capability — default: ground unit that can target both
  isAir[eid] = opts.isAirUnit ? 1 : 0;
  canTargetGround[eid] = opts.canTargetGroundUnit !== false ? 1 : 0;
  canTargetAir[eid] = opts.canTargetAirUnit !== false ? 1 : 0;

  // Damage type & armor
  atkDamageType[eid] = opts.damageTypeId ?? 0;  // DamageType.Normal
  armorClass[eid] = opts.armorClassId ?? 0;      // ArmorClass.Light
  baseArmor[eid] = opts.armorClassId === 1 ? 1 : 0;
  pendingDamage[eid] = 0;
  killCount[eid] = 0;

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

export interface SpawnResourceOpts {
  x?: number;
  y?: number;
  type?: number;       // ResourceType.Mineral or Gas
  remaining?: number;
  width?: number;
  height?: number;
}

/**
 * Spawn a resource entity (mineral patch or gas geyser).
 * Returns the entity ID.
 */
export function spawnResource(world: World, opts: SpawnResourceOpts = {}): number {
  const eid = addEntity(world);
  addResourceComponents(world, eid);

  posX[eid] = opts.x ?? 200;
  posY[eid] = opts.y ?? 200;
  resourceType[eid] = opts.type ?? ResourceType.Mineral;
  const rem = opts.remaining ?? 1500;
  resourceRemaining[eid] = rem;
  hpCurrent[eid] = rem;
  hpMax[eid] = rem;
  renderWidth[eid] = opts.width ?? 24;
  renderHeight[eid] = opts.height ?? 16;

  return eid;
}

/**
 * Spawn an SCV worker entity ready for gathering.
 * Returns the entity ID. Worker starts Idle with no target.
 */
export function spawnWorker(
  world: World,
  opts: SpawnOpts & { baseX?: number; baseY?: number } = {},
): number {
  const eid = spawnUnit(world, {
    ...opts,
    factionId: opts.factionId ?? Faction.Terran,
    unitTypeId: opts.unitTypeId ?? UnitType.SCV,
  });
  addWorkerComponent(world, eid);

  workerState[eid] = WorkerState.Idle;
  workerCarrying[eid] = 0;
  workerTargetEid[eid] = -1;
  workerMineTimer[eid] = 0;
  workerBaseX[eid] = opts.baseX ?? 50;
  workerBaseY[eid] = opts.baseY ?? 50;

  return eid;
}

export interface SpawnBuildingOpts {
  x?: number;
  y?: number;
  hp?: number;
  buildingTypeId?: number;
  buildStateId?: number;
  progress?: number;
  buildTime?: number;
  builder?: number;
  factionId?: number;
  width?: number;
  height?: number;
  supply?: number;
}

/**
 * Spawn a building entity. Returns the entity ID.
 * Sets all building component arrays with sane defaults.
 */
export function spawnBuilding(world: World, opts: SpawnBuildingOpts = {}): number {
  const eid = addEntity(world);
  addBuildingComponents(world, eid);

  posX[eid] = opts.x ?? 200;
  posY[eid] = opts.y ?? 200;
  hpCurrent[eid] = opts.hp ?? 150;
  hpMax[eid] = opts.hp ?? 1500;
  faction[eid] = opts.factionId ?? Faction.Terran;
  renderWidth[eid] = opts.width ?? 48;
  renderHeight[eid] = opts.height ?? 48;
  renderTint[eid] = 0x2266aa;

  buildingType[eid] = opts.buildingTypeId ?? BuildingType.Barracks;
  buildState[eid] = opts.buildStateId ?? BuildState.UnderConstruction;
  buildProgress[eid] = opts.progress ?? 0;
  buildTimeTotal[eid] = opts.buildTime ?? 40;
  builderEid[eid] = opts.builder ?? -1;
  rallyX[eid] = -1;
  rallyY[eid] = -1;
  prodUnitType[eid] = 0;
  prodProgress[eid] = 0;
  prodTimeTotal[eid] = 0;
  supplyProvided[eid] = opts.supply ?? 0;
  supplyCost[eid] = 0;

  return eid;
}

/**
 * Create default player resources for both factions.
 */
export function createPlayerResources(): Record<number, PlayerResources> {
  return {
    [Faction.Terran]: { minerals: 50, gas: 0, supplyUsed: 0, supplyProvided: 10, upgrades: new Uint8Array(6) },
    [Faction.Zerg]: { minerals: 50, gas: 0, supplyUsed: 0, supplyProvided: 10, upgrades: new Uint8Array(6) },
  };
}
