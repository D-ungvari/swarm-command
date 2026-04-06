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
  POSITION, VELOCITY, HEALTH, ATTACK, MOVEMENT, SELECTABLE, RENDERABLE,
  UNIT_TYPE, ABILITY, RESOURCE, WORKER, BUILDING, SUPPLY,
  posX, posY,
  hpCurrent, hpMax,
  moveSpeed, movePathIndex,
  atkDamage, atkRange, atkCooldown, atkSplash, atkLastTime, atkHitCount, atkMinRange,
  bonusDmg, bonusVsTag, armorClass, baseArmor, pendingDamage,
  targetEntity, commandMode, stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd, lastCombatTime,
  killCount, veterancyLevel, supplyCost,
  renderWidth, renderHeight, renderTint,
  faction, unitType, isAir, canTargetGround, canTargetAir, cloaked,
  energy, cargoCapacity, isDetector, detectionRange,
  workerBaseX, workerBaseY, workerTargetEid, workerState, workerCarrying, workerMineTimer,
  buildingType, buildState, buildProgress, buildTimeTotal, builderEid,
  rallyX, rallyY,
  prodUnitType, prodProgress, prodTimeTotal, supplyProvided,
  larvaCount, larvaRegenTimer,
  resourceType, resourceRemaining,
  addUnitComponents, addWorkerComponent, addResourceComponents, addBuildingComponents,
  setPath,
  selected,
} from '../ecs/components';
import { spatialHash } from '../ecs/SpatialHash';
import { type MapData, generateMap, tileToWorld, worldToTile, getResourceTiles, markBuildingTiles, findNearestWalkableTile } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import { spawnRockEntities } from '../map/MapData';
import { type PlayerResources } from '../types';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import {
  Faction, UnitType, BuildingType, BuildState, ResourceType,
  CommandMode, UpgradeType, WorkerState,
  TILE_SIZE, TICKS_PER_SECOND, MS_PER_TICK,
  STARTING_MINERALS, STARTING_GAS, STARTING_SUPPLY,
  MINERAL_PER_PATCH, MINERAL_PER_PATCH_RICH, GAS_PER_GEYSER,
  MINERAL_COLOR, GAS_COLOR, isHatchType, TileType,
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
    // Multi-hit units
    if (type === UnitType.Reaper) atkHitCount[eid] = 2;
    else if (type === UnitType.Queen) atkHitCount[eid] = 2;
    else if (type === UnitType.Thor) atkHitCount[eid] = 4;
    else atkHitCount[eid] = 1;
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

    // Energy setup for caster units
    if (type === UnitType.Ghost || type === UnitType.Banshee || type === UnitType.Raven || type === UnitType.Infestor || type === UnitType.Viper) {
      energy[eid] = 50;
    }
    if (type === UnitType.Queen) {
      energy[eid] = 25;
    }
    if (type === UnitType.Medivac) {
      cargoCapacity[eid] = 8;
    }
    // Mobile detectors
    if (type === UnitType.Raven || type === UnitType.Overseer) {
      isDetector[eid] = 1;
      detectionRange[eid] = 11 * TILE_SIZE;
    }

    // Overlord provides 8 supply when spawned
    if (type === UnitType.Overlord) {
      const res = this.resources[fac];
      if (res) res.supplyProvided += 8;
    }

    // Worker setup
    if (type === UnitType.SCV || type === UnitType.Drone) {
      addWorkerComponent(this.world, eid);
      workerBaseX[eid] = x;
      workerBaseY[eid] = y;
      workerTargetEid[eid] = -1;
      workerState[eid] = 0;
      workerCarrying[eid] = 0;
      workerMineTimer[eid] = 0;
    }

    // Track supply
    const res = this.resources[fac];
    if (res) {
      res.supplyUsed += def.supply;
    }

    // Apply already-researched stat buffs to newly spawned units
    if (res) {
      if (type === UnitType.Marine && res.upgrades[UpgradeType.CombatShield]) {
        hpMax[eid] += 10;
        hpCurrent[eid] += 10;
      }
      if (type === UnitType.Zergling && res.upgrades[UpgradeType.MetabolicBoost]) {
        moveSpeed[eid] += 0.87 * TILE_SIZE;
      }
      if (type === UnitType.Zergling && res.upgrades[UpgradeType.AdrenalGlands]) {
        atkCooldown[eid] = Math.round(atkCooldown[eid] * 0.82);
      }
      if (type === UnitType.Hydralisk && res.upgrades[UpgradeType.GroovedSpines]) {
        atkRange[eid] += 1 * TILE_SIZE;
      }
      if (type === UnitType.Hydralisk && res.upgrades[UpgradeType.MuscularAugments]) {
        moveSpeed[eid] += 0.5 * TILE_SIZE;
      }
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

    if (isHatchType(type)) {
      larvaCount[eid] = 3;
      larvaRegenTimer[eid] = 0;
    }

    if (type === BuildingType.Refinery || type === BuildingType.Extractor) {
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

  /** Spawn resource nodes from map data. */
  spawnResourceNodes(): void {
    const tiles = getResourceTiles(this.map);
    let mineralIdx = 0;
    for (const t of tiles) {
      const eid = addEntity(this.world);
      addResourceComponents(this.world, eid);

      const wp = tileToWorld(t.col, t.row);
      posX[eid] = wp.x;
      posY[eid] = wp.y;

      if (t.type === TileType.Minerals) {
        resourceType[eid] = ResourceType.Mineral;
        const amount = (mineralIdx % 8) < 4 ? MINERAL_PER_PATCH_RICH : MINERAL_PER_PATCH;
        mineralIdx++;
        resourceRemaining[eid] = amount;
        hpCurrent[eid] = amount;
        hpMax[eid] = amount;
        renderWidth[eid] = TILE_SIZE - 6;
        renderHeight[eid] = TILE_SIZE - 10;
        renderTint[eid] = MINERAL_COLOR;
      } else {
        resourceType[eid] = ResourceType.Gas;
        resourceRemaining[eid] = GAS_PER_GEYSER;
        hpCurrent[eid] = GAS_PER_GEYSER;
        hpMax[eid] = GAS_PER_GEYSER;
        renderWidth[eid] = TILE_SIZE - 4;
        renderHeight[eid] = TILE_SIZE - 4;
        renderTint[eid] = GAS_COLOR;
      }

      faction[eid] = Faction.None;
    }
  }

  /** Spawn rock entities from map destructible tiles. */
  spawnRocks(): void {
    spawnRockEntities(this.world, this.map);
  }

  /** Send all idle workers of a faction to mine nearest minerals. */
  sendWorkersToMine(fac: number): void {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, WORKER | POSITION)) continue;
      if (faction[eid] !== fac) continue;
      if (workerState[eid] !== WorkerState.Idle) continue;

      let bestDist = Infinity;
      let bestMineral = -1;
      for (let rid = 1; rid < this.world.nextEid; rid++) {
        if (!hasComponents(this.world, rid, RESOURCE | POSITION)) continue;
        if (resourceType[rid] !== ResourceType.Mineral) continue;
        const dx = posX[rid] - posX[eid];
        const dy = posY[rid] - posY[eid];
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestMineral = rid;
        }
      }
      if (bestMineral < 0) continue;

      workerState[eid] = WorkerState.MovingToResource;
      workerTargetEid[eid] = bestMineral;
      commandMode[eid] = CommandMode.Gather;

      const resTile = worldToTile(posX[bestMineral], posY[bestMineral]);
      const walkable = findNearestWalkableTile(this.map, resTile.col, resTile.row);
      if (walkable) {
        const startTile = worldToTile(posX[eid], posY[eid]);
        const tilePath = findPath(this.map, startTile.col, startTile.row, walkable.col, walkable.row);
        if (tilePath.length > 0) {
          setPath(eid, tilePath.map(([c, r]) => {
            const wp = tileToWorld(c, r);
            return [wp.x, wp.y] as [number, number];
          }));
        }
      }
    }
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
