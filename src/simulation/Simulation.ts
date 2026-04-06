/**
 * Simulation — Headless game simulation that can run on Node.js (server) or browser (client).
 *
 * Owns: World, Map, Resources, game time, tick logic, entity spawning.
 * Does NOT own: PixiJS, Viewport, Input, Rendering, DOM.
 *
 * Extracted from Game.ts as part of Phase 0 (multiplayer arena pivot).
 */

import { type World, createWorld, addEntity, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, BUILDING,
  posX, posY,
  hpCurrent, hpMax,
  moveSpeed, movePathIndex,
  atkDamage, atkRange, atkCooldown, atkSplash, atkLastTime, atkHitCount,
  bonusDmg, bonusVsTag, armorClass, baseArmor, pendingDamage,
  targetEntity, commandMode, stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd, lastCombatTime,
  killCount, veterancyLevel, supplyCost,
  renderWidth, renderHeight, renderTint,
  faction, unitType, isAir, canTargetGround, canTargetAir, cloaked,
  energy,
  buildingType, buildState, buildProgress, buildTimeTotal, builderEid,
  rallyX, rallyY,
  prodUnitType, prodProgress, prodTimeTotal, supplyProvided,
  larvaCount, larvaRegenTimer,
  resourceType, resourceRemaining,
  addUnitComponents, addResourceComponents, addBuildingComponents,
  setPath,
} from '../ecs/components';
import { spatialHash } from '../ecs/SpatialHash';
import { type MapData, generateMap, tileToWorld, markBuildingTiles } from '../map/MapData';
import { spawnRockEntities } from '../map/MapData';
import { type PlayerResources } from '../types';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import {
  Faction, UnitType, BuildingType, BuildState, ResourceType,
  UpgradeType,
  TILE_SIZE,
  STARTING_MINERALS, STARTING_GAS, STARTING_SUPPLY,
  GAS_PER_GEYSER, isHQType,
} from '../constants';
import type { MapType } from '../map/MapData';
import { commandSystem, issuePathCommand } from '../systems/CommandSystem';
import { buildSystem } from '../systems/BuildSystem';
import { productionSystem } from '../systems/ProductionSystem';
import { upgradeSystem } from '../systems/UpgradeSystem';
import { movementSystem } from '../systems/MovementSystem';
import { fogSystem, resetFogSystem } from '../systems/FogSystem';
import { detectionSystem } from '../systems/DetectionSystem';
import { combatSystem } from '../systems/CombatSystem';
import { abilitySystem } from '../systems/AbilitySystem';
import { morphSystem } from '../systems/MorphSystem';
import { gatherSystem } from '../systems/GatherSystem';
import { deathSystem } from '../systems/DeathSystem';
import { creepSystem, resetCreepSystem } from '../systems/CreepSystem';
import { seedRng } from '../utils/SeededRng';
import type { GameCommand } from '../input/CommandQueue';

/**
 * Configuration for creating a Simulation.
 */
export interface SimulationConfig {
  mapType?: MapType;
  fogEnabled?: boolean;
  gameSeed?: number;
}

/**
 * Headless game simulation — no rendering, no DOM, no PixiJS.
 * Can run on Node.js server or browser client.
 */
export class Simulation {
  world: World;
  map: MapData;
  resources: Record<number, PlayerResources> = {};
  fogEnabled: boolean;
  gameTime = 0;
  tickCount = 0;

  private gameSeed: number;

  constructor(config: SimulationConfig = {}) {
    this.world = createWorld();
    this.map = generateMap(config.mapType);
    this.fogEnabled = config.fogEnabled ?? true;
    this.gameSeed = config.gameSeed ?? (Date.now() & 0x7fffffff);
    seedRng(this.gameSeed);
    resetCreepSystem();
    resetFogSystem();
  }

  /** Initialize resources for a player/faction. */
  addPlayer(factionId: number, startingMinerals = STARTING_MINERALS, startingGas = STARTING_GAS): void {
    this.resources[factionId] = {
      minerals: startingMinerals,
      gas: startingGas,
      supplyUsed: 0,
      supplyProvided: STARTING_SUPPLY,
      upgrades: new Uint8Array(UpgradeType.COUNT),
    };
  }

  /** Get the RNG seed (for replay/networking). */
  getSeed(): number {
    return this.gameSeed;
  }

  // ─── TICK ───────────────────────────────────────────────────────────────

  /**
   * Advance simulation by one tick.
   * @param dt - time step in seconds (typically 1/60 for 60Hz or 1/20 for 20Hz server)
   * @param commands - player commands to process this tick
   */
  tick(dt: number, commands: GameCommand[] = []): void {
    this.tickCount++;
    this.gameTime += dt;

    // Rebuild spatial hash once per tick — must run before any system queries
    spatialHash.rebuild(this.world);

    // Process player commands (viewport=null for headless; commands use world coords)
    commandSystem(this.world, commands, null as any, this.map, this.gameTime, this.resources);
    buildSystem(this.world, dt, this.resources, this.gameTime, this.map);
    productionSystem(this.world, dt, this.resources, this.map,
      (type, fac, x, y) => this.spawnUnitAt(type, fac, x, y),
      this.gameTime,
    );
    upgradeSystem(this.world, dt, this.resources);
    movementSystem(this.world, dt, this.map, this.gameTime);

    // Fog must update BEFORE combat so auto-acquire sees current visibility
    if (this.fogEnabled) fogSystem(this.world, this.map);

    detectionSystem(this.world);
    combatSystem(this.world, dt, this.gameTime, this.map, this.resources);
    abilitySystem(this.world, dt, this.gameTime);
    morphSystem(this.world, dt,
      (type, fac, x, y) => this.spawnUnitAt(type, fac, x, y),
      (eid) => { hpCurrent[eid] = 0; },
    );
    gatherSystem(this.world, dt, this.map, this.resources);
    deathSystem(this.world, this.gameTime, this.map, this.resources, dt);
    creepSystem(this.world, this.map, dt);
  }

  // ─── ENTITY SPAWNING ───────────────────────────────────────────────────

  /** Spawn a unit at world coordinates. Returns entity ID. */
  spawnUnitAt(type: number, fac: number, x: number, y: number): number {
    const def = UNIT_DEFS[type];
    if (!def) throw new Error(`Unknown unit type: ${type}`);

    const eid = addEntity(this.world);
    addUnitComponents(this.world, eid);

    posX[eid] = x;
    posY[eid] = y;

    hpCurrent[eid] = def.hp;
    hpMax[eid] = def.hp;
    moveSpeed[eid] = def.speed * TILE_SIZE;
    movePathIndex[eid] = -1;

    atkDamage[eid] = def.damage;
    atkRange[eid] = def.range * TILE_SIZE;
    atkCooldown[eid] = def.attackCooldown;
    atkSplash[eid] = def.splashRadius;
    atkLastTime[eid] = 0;
    atkHitCount[eid] = 1;
    bonusDmg[eid] = def.bonusDamage;
    bonusVsTag[eid] = def.bonusVsTag;
    armorClass[eid] = def.armorClass;
    baseArmor[eid] = def.baseArmor;
    pendingDamage[eid] = 0;
    killCount[eid] = 0;
    targetEntity[eid] = -1;
    commandMode[eid] = 0;
    stimEndTime[eid] = 0;
    slowEndTime[eid] = 0;
    slowFactor[eid] = 0;
    siegeMode[eid] = 0;
    siegeTransitionEnd[eid] = 0;
    lastCombatTime[eid] = 0;
    supplyCost[eid] = def.supply;

    renderWidth[eid] = def.width;
    renderHeight[eid] = def.height;
    renderTint[eid] = def.color;

    faction[eid] = fac;
    unitType[eid] = def.type;
    isAir[eid] = def.isAir;
    canTargetGround[eid] = def.canTargetGround;
    canTargetAir[eid] = def.canTargetAir;
    cloaked[eid] = 0;
    veterancyLevel[eid] = 0;

    // Energy setup for caster units (Storm Caller, Disruptor, Archmage, etc.)
    if (type === UnitType.StormCaller || type === UnitType.Disruptor || type === UnitType.Archmage) {
      energy[eid] = 50;
    }

    // Track supply
    const res = this.resources[fac];
    if (res) {
      res.supplyUsed += def.supply;
    }

    // Apply weapon/armor upgrade bonuses
    if (res) {
      const weaponLevel = res.upgrades[UpgradeType.Weapons1] + res.upgrades[UpgradeType.Weapons2] + res.upgrades[UpgradeType.Weapons3];
      const armorLevel = res.upgrades[UpgradeType.Armor1] + res.upgrades[UpgradeType.Armor2] + res.upgrades[UpgradeType.Armor3];
      if (weaponLevel > 0) atkDamage[eid] += weaponLevel;
      if (armorLevel > 0) baseArmor[eid] += armorLevel;
    }

    return eid;
  }

  /** Spawn a building at tile coordinates. Returns entity ID. */
  spawnBuilding(type: BuildingType, fac: Faction, col: number, row: number): number {
    const def = BUILDING_DEFS[type];
    if (!def) throw new Error(`Unknown building type: ${type}`);

    const eid = addEntity(this.world);
    addBuildingComponents(this.world, eid);

    const wp = tileToWorld(col, row);
    posX[eid] = wp.x;
    posY[eid] = wp.y;

    hpCurrent[eid] = def.hp * 0.1;
    hpMax[eid] = def.hp;

    buildingType[eid] = type;
    buildState[eid] = BuildState.UnderConstruction;
    buildProgress[eid] = 0;
    buildTimeTotal[eid] = def.buildTime;
    builderEid[eid] = -1;
    rallyX[eid] = -1;
    rallyY[eid] = -1;
    prodUnitType[eid] = 0;
    prodProgress[eid] = 0;
    prodTimeTotal[eid] = 0;
    supplyProvided[eid] = 0;
    supplyCost[eid] = 0;

    renderWidth[eid] = def.tileWidth * TILE_SIZE;
    renderHeight[eid] = def.tileHeight * TILE_SIZE;
    renderTint[eid] = def.color;

    faction[eid] = fac;

    if (isHQType(type)) {
      larvaCount[eid] = 3;
      larvaRegenTimer[eid] = 0;
    }

    // Extractor buildings store gas resource data
    if (type === BuildingType.Extractor_L || type === BuildingType.Extractor_S
      || type === BuildingType.Extractor_A || type === BuildingType.Extractor_M) {
      resourceType[eid] = ResourceType.Gas;
      resourceRemaining[eid] = GAS_PER_GEYSER;
    }

    markBuildingTiles(this.map, col, row, def.tileWidth, def.tileHeight);

    return eid;
  }

  /** Spawn a completed building (full HP, BuildState.Complete). */
  spawnCompletedBuilding(type: BuildingType, fac: Faction, col: number, row: number): number {
    const eid = this.spawnBuilding(type, fac, col, row);
    const def = BUILDING_DEFS[type];
    buildState[eid] = BuildState.Complete;
    buildProgress[eid] = 1.0;
    hpCurrent[eid] = hpMax[eid];
    supplyProvided[eid] = def.supplyProvided;
    // Track supply provided
    const res = this.resources[fac];
    if (res) res.supplyProvided += def.supplyProvided;
    return eid;
  }

  /** Spawn rock entities from map destructible tiles. */
  spawnRocks(): void {
    spawnRockEntities(this.world, this.map);
  }

  // ─── QUERIES ────────────────────────────────────────────────────────────

  /** Count alive entities for a faction. */
  countAlive(fac: number): number {
    let count = 0;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, POSITION | HEALTH)) continue;
      if (hpCurrent[eid] > 0 && faction[eid] === fac) count++;
    }
    return count;
  }

  /** Check if a faction has any buildings alive. */
  hasBuildingsAlive(fac: number): boolean {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, BUILDING | HEALTH)) continue;
      if (hpCurrent[eid] > 0 && faction[eid] === fac) return true;
    }
    return false;
  }
}
