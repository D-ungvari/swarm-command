import { type World, entityExists, hasComponents } from '../ecs/world';
import {
  POSITION, BUILDING, HEALTH, UNIT_TYPE, ATTACK, WORKER,
  posX, posY, faction, hpCurrent, hpMax, commandMode, unitType,
  buildingType, buildState, targetEntity,
  setPath, movePathIndex,
  energy, injectTimer, atkDamage, atkRange, atkCooldown, atkLastTime,
  prodUnitType, prodProgress, prodTimeTotal, prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  larvaCount, larvaRegenTimer,
  workerState, workerTargetEid, workerBaseX, workerBaseY,
  resourceRemaining,
  addonType,
  morphTarget, morphProgress, morphTimeTotal,
  velX, velY,
} from '../ecs/components';
import { findNearestCommandCenter, findNearestMineral } from '../ecs/queries';
import { isTileVisible } from './FogSystem';
import {
  Faction, UnitType, CommandMode, MAX_ENTITIES, TILE_SIZE, TileType,
  AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW, BuildingType, BuildState,
  MAP_COLS, MAP_ROWS, UpgradeType,
  Difficulty, DIFFICULTY_CONFIGS,
  INJECT_LARVA_COST, INJECT_LARVA_TIME,
  WorkerState, AddonType, isHatchType, getMorphDef, MORPH_DEFS,
} from '../constants';
import { findPath } from '../map/Pathfinder';
import { spatialHash } from '../ecs/SpatialHash';
import {
  worldToTile, tileToWorld, findNearestWalkableTile, type MapData,
} from '../map/MapData';
import type { PlayerResources } from '../types';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import { rng } from '../utils/SeededRng';

// ─────────────────────────────────────────
// Build Order types
// ─────────────────────────────────────────
interface CompositionTarget {
  units: Array<{ type: UnitType; ratio: number; minCount?: number }>;
  targetArmySize: number;
}

type BuildOrderAction =
  | { kind: 'unit'; type: number; count?: number }
  | { kind: 'worker' }
  | { kind: 'overlord' }
  | { kind: 'queen' }
  | { kind: 'building'; type: number; colOffset: number; rowOffset: number }
  | { kind: 'attack' }
  | { kind: 'expand' }
  | { kind: 'upgrade'; upgradeType: number }
  | { kind: 'set_worker_cap'; count: number }
  | { kind: 'set_composition'; comp: CompositionTarget };

interface BuildOrderStep {
  trigger: 'supply' | 'time' | 'unit_count' | 'worker_count' | 'building_done' | 'minerals_above' | 'always';
  triggerValue: number;
  triggerBuildingType?: number;
  action: BuildOrderAction;
  done: boolean;
  timeout?: number;
  startedAt?: number;
}

// ─────────────────────────────────────────
// Predefined Zerg Build Orders (5 SC2-style profiles)
// ─────────────────────────────────────────

// Profile 1: 12-Pool Zergling Rush — all-in early aggression (~2:00 attack)
const ZERG_12_POOL_RUSH: BuildOrderStep[] = [
  // Opening: Pool-first, minimal eco
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 12, action: { kind: 'building', type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 13, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_worker_cap', count: 14 }, done: false },
  // Pool finishes → 6 Zerglings
  { trigger: 'time', triggerValue: 50, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  // Queen for defense/inject
  { trigger: 'supply', triggerValue: 16, action: { kind: 'queen' }, done: false, timeout: 30 },
  // Set rush composition and attack
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_composition', comp: {
    units: [{ type: UnitType.Zergling, ratio: 1.0 }],
    targetArmySize: 12,
  }}, done: false },
  { trigger: 'unit_count', triggerValue: 6, action: { kind: 'attack' }, done: false, timeout: 60 },
  // Continue ling production after initial attack
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false },
];

// Profile 2: Ling-Bane Bust — break walls/bio at ~4:00
const ZERG_LING_BANE_BUST: BuildOrderStep[] = [
  // Standard opening: Hatch first
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 13, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 16, action: { kind: 'expand' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 17, action: { kind: 'building', type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 18, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 4, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 19, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 20, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 21, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_worker_cap', count: 24 }, done: false },
  // Mass Zerglings
  { trigger: 'supply', triggerValue: 24, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 28, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // Morph Banelings
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Baneling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Baneling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Baneling, count: 2 }, done: false, timeout: 20 },
  // Set composition and bust
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_composition', comp: {
    units: [
      { type: UnitType.Zergling, ratio: 0.6, minCount: 8 },
      { type: UnitType.Baneling, ratio: 0.4, minCount: 4 },
    ],
    targetArmySize: 20,
  }}, done: false },
  { trigger: 'unit_count', triggerValue: 12, action: { kind: 'attack' }, done: false, timeout: 90 },
  // Continue production after attack
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false },
];

// Profile 3: Roach-Ravager Timing — bile siege positions at ~5:00-5:30
const ZERG_ROACH_RAVAGER_TIMING: BuildOrderStep[] = [
  // Standard opening
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 13, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 16, action: { kind: 'expand' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 17, action: { kind: 'building', type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 18, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 4, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 19, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 20, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 21, action: { kind: 'queen' }, done: false, timeout: 30 },
  // Roach Warren early
  { trigger: 'supply', triggerValue: 24, action: { kind: 'building', type: BuildingType.RoachWarren, colOffset: 5, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 26, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 7, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 28, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_worker_cap', count: 22 }, done: false },
  // Roach production
  { trigger: 'time', triggerValue: 120, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 25 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 25 },
  { trigger: 'supply', triggerValue: 36, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // Ravagers
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Ravager, count: 2 }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Ravager, count: 2 }, done: false, timeout: 30 },
  // Set composition and attack
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_composition', comp: {
    units: [
      { type: UnitType.Roach, ratio: 0.65, minCount: 6 },
      { type: UnitType.Ravager, ratio: 0.35, minCount: 3 },
    ],
    targetArmySize: 26,
  }}, done: false },
  { trigger: 'unit_count', triggerValue: 8, action: { kind: 'attack' }, done: false, timeout: 90 },
  // Continue production
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false },
];

// Profile 4: Roach-Hydra Push — standard mid-game army (~6:30-7:00 attack)
const ZERG_ROACH_HYDRA_PUSH: BuildOrderStep[] = [
  // Standard opening
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 13, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 16, action: { kind: 'expand' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 17, action: { kind: 'building', type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 18, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 4, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 19, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 20, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 21, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 24, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  // Tech buildings
  { trigger: 'supply', triggerValue: 28, action: { kind: 'building', type: BuildingType.RoachWarren, colOffset: 5, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 30, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 7, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 32, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'time', triggerValue: 180, action: { kind: 'building', type: BuildingType.HydraliskDen, colOffset: 5, rowOffset: 5 }, done: false, timeout: 30 },
  // Worker and army ramp
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_worker_cap', count: 32 }, done: false },
  // Roach production
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 25 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 25 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 25 },
  { trigger: 'supply', triggerValue: 44, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // Upgrade
  { trigger: 'time', triggerValue: 240, action: { kind: 'building', type: BuildingType.EvolutionChamber, colOffset: 0, rowOffset: 5 }, done: false, timeout: 30 },
  { trigger: 'time', triggerValue: 260, action: { kind: 'upgrade', upgradeType: UpgradeType.ZergRanged }, done: false },
  // Hydra production
  { trigger: 'time', triggerValue: 240, action: { kind: 'unit', type: UnitType.Hydralisk, count: 2 }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Hydralisk, count: 2 }, done: false, timeout: 25 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Hydralisk, count: 2 }, done: false, timeout: 25 },
  { trigger: 'supply', triggerValue: 56, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 64, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // Set composition and attack
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_composition', comp: {
    units: [
      { type: UnitType.Roach, ratio: 0.5, minCount: 6 },
      { type: UnitType.Hydralisk, ratio: 0.4, minCount: 4 },
      { type: UnitType.Zergling, ratio: 0.1, minCount: 2 },
    ],
    targetArmySize: 40,
  }}, done: false },
  { trigger: 'unit_count', triggerValue: 14, action: { kind: 'attack' }, done: false, timeout: 120 },
  // Continue production
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false },
];

// Profile 5: Macro Hatch First — greedy economy, massive late-game army (~8:00+ attack)
const ZERG_MACRO_HATCH_FIRST: BuildOrderStep[] = [
  // Greedy opening: Hatch before Pool
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 13, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 16, action: { kind: 'expand' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 18, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 4, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 17, action: { kind: 'building', type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 19, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 20, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 21, action: { kind: 'queen' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 24, action: { kind: 'unit', type: UnitType.Zergling, count: 2 }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 28, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // 3rd base
  { trigger: 'supply', triggerValue: 30, action: { kind: 'expand' }, done: false, timeout: 45 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_worker_cap', count: 44 }, done: false },
  // More workers to saturate 3 bases
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'worker' }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 36, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // Tech up
  { trigger: 'time', triggerValue: 180, action: { kind: 'building', type: BuildingType.RoachWarren, colOffset: 5, rowOffset: 0 }, done: false, timeout: 30 },
  { trigger: 'time', triggerValue: 200, action: { kind: 'building', type: BuildingType.Extractor, colOffset: 7, rowOffset: -3 }, done: false, timeout: 30 },
  { trigger: 'time', triggerValue: 210, action: { kind: 'building', type: BuildingType.EvolutionChamber, colOffset: 0, rowOffset: 5 }, done: false, timeout: 30 },
  { trigger: 'time', triggerValue: 230, action: { kind: 'building', type: BuildingType.HydraliskDen, colOffset: 5, rowOffset: 5 }, done: false, timeout: 30 },
  { trigger: 'time', triggerValue: 250, action: { kind: 'upgrade', upgradeType: UpgradeType.ZergRanged }, done: false },
  // Army production
  { trigger: 'supply', triggerValue: 44, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Hydralisk, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Hydralisk, count: 2 }, done: false, timeout: 20 },
  { trigger: 'supply', triggerValue: 56, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Roach, count: 2 }, done: false, timeout: 20 },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Mutalisk, count: 2 }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 64, action: { kind: 'overlord' }, done: false, timeout: 30 },
  { trigger: 'supply', triggerValue: 72, action: { kind: 'overlord' }, done: false, timeout: 30 },
  // Set late-game composition and attack
  { trigger: 'always', triggerValue: 0, action: { kind: 'set_composition', comp: {
    units: [
      { type: UnitType.Roach, ratio: 0.3, minCount: 6 },
      { type: UnitType.Hydralisk, ratio: 0.3, minCount: 6 },
      { type: UnitType.Mutalisk, ratio: 0.2, minCount: 2 },
      { type: UnitType.Zergling, ratio: 0.2, minCount: 4 },
    ],
    targetArmySize: 60,
  }}, done: false },
  { trigger: 'unit_count', triggerValue: 20, action: { kind: 'attack' }, done: false, timeout: 150 },
  // Continue macro
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Hydralisk, count: 2 }, done: false },
];

// ─────────────────────────────────────────
// Predefined Terran Build Orders
// ─────────────────────────────────────────
const TERRAN_BIO: BuildOrderStep[] = [
  { trigger: 'supply', triggerValue: 10, action: { kind: 'unit', type: UnitType.Marine }, done: false },
  { trigger: 'supply', triggerValue: 14, action: { kind: 'unit', type: UnitType.Marine }, done: false },
  { trigger: 'supply', triggerValue: 18, action: { kind: 'unit', type: UnitType.Marauder }, done: false },
  { trigger: 'time', triggerValue: 240, action: { kind: 'attack' }, done: false },
  { trigger: 'always', triggerValue: 0, action: { kind: 'unit', type: UnitType.Marine }, done: false },
];

// ─────────────────────────────────────────
// Build Order State
// ─────────────────────────────────────────
let activeBuildOrder: BuildOrderStep[] | null = null;
let buildOrderIndex = 0;

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;
type SpawnBuildingFn = (type: number, fac: number, col: number, row: number) => number;

// ─────────────────────────────────────────
// Fair-play production: queue units through buildings
// ─────────────────────────────────────────
function aiQueueUnit(
  world: World,
  uType: number,
  resources: Record<number, PlayerResources>,
): boolean {
  const res = resources[currentAIFaction];
  if (!res) return false;

  const uDef = UNIT_DEFS[uType];
  if (!uDef) return false;

  // Check resources
  if (res.minerals < uDef.costMinerals || res.gas < uDef.costGas) return false;

  // Check supply (Overlords provide supply, don't cost it)
  if (uDef.supply > 0 && res.supplyUsed + uDef.supply > res.supplyProvided) return false;

  // Morph units (Baneling, Ravager, Lurker): find a source unit and morph it
  const morphDef = MORPH_DEFS.find(d => d.to === uType);
  if (morphDef) {
    // Check morph cost (morph cost replaces unit cost)
    if (res.minerals < morphDef.minerals || res.gas < morphDef.gas) return false;
    // Find a source unit that isn't already morphing
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, POSITION | HEALTH | UNIT_TYPE)) continue;
      if (faction[eid] !== currentAIFaction) continue;
      if (unitType[eid] !== morphDef.from) continue;
      if (hpCurrent[eid] <= 0) continue;
      if (morphTarget[eid] !== 0) continue;
      // Begin morph
      res.minerals -= morphDef.minerals;
      res.gas -= morphDef.gas;
      morphTarget[eid] = morphDef.to;
      morphProgress[eid] = morphDef.time;
      morphTimeTotal[eid] = morphDef.time;
      commandMode[eid] = CommandMode.Idle;
      movePathIndex[eid] = -1;
      velX[eid] = 0;
      velY[eid] = 0;
      return true;
    }
    return false; // no source unit available
  }

  // Find a completed production building that can produce this unit
  // Zerg: pick the Hatchery with the most larva (distribute production)
  let prodBuilding = 0;
  let bestLarva = -1;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING | POSITION)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;

    const bDef = BUILDING_DEFS[buildingType[eid]];
    if (!bDef || !bDef.produces.includes(uType)) continue;

    // Check queue not full
    const totalQueued = (prodUnitType[eid] !== 0 ? 1 : 0) + prodQueueLen[eid];
    if (totalQueued >= PROD_QUEUE_MAX) continue;

    // Zerg: check larva — pick building with most larva
    if (isHatchType(buildingType[eid])) {
      if (larvaCount[eid] <= 0) continue;
      if (larvaCount[eid] > bestLarva) {
        bestLarva = larvaCount[eid];
        prodBuilding = eid;
      }
    } else {
      // Non-Zerg buildings (Barracks etc.): first found
      prodBuilding = eid;
      break;
    }
  }

  if (prodBuilding === 0) return false;

  // Deduct resources
  res.minerals -= uDef.costMinerals;
  res.gas -= uDef.costGas;

  // Queue production
  if (prodUnitType[prodBuilding] === 0) {
    // Consume larva for Zerg
    if (isHatchType(buildingType[prodBuilding])) {
      larvaCount[prodBuilding]--;
      if (larvaRegenTimer[prodBuilding] <= 0 && larvaCount[prodBuilding] < 3) {
        larvaRegenTimer[prodBuilding] = 11;
      }
    }
    prodUnitType[prodBuilding] = uType;
    prodProgress[prodBuilding] = uDef.buildTime;
    prodTimeTotal[prodBuilding] = uDef.buildTime;
  } else {
    const qBase = prodBuilding * PROD_QUEUE_MAX;
    prodQueue[qBase + prodQueueLen[prodBuilding]] = uType;
    prodQueueLen[prodBuilding]++;
  }

  return true;
}

// ─────────────────────────────────────────
// Claim newly produced AI units into army sets
// ─────────────────────────────────────────
function claimNewUnits(world: World): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH | UNIT_TYPE)) continue;
    if (hasComponents(world, eid, BUILDING)) continue;
    if (hasComponents(world, eid, WORKER)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (unitType[eid] === UnitType.Overlord) continue;

    // Queens go to dedicated roster (stay home for inject)
    if (unitType[eid] === UnitType.Queen) {
      if (!queenEids.has(eid)) queenEids.add(eid);
      continue;
    }

    const armySet = currentAIFaction === Faction.Terran ? terranArmyEids : armyEids;
    if (armySet.has(eid) || harassEids.has(eid) || scoutEids.has(eid)
        || defenseEids.has(eid) || harassSquad1.has(eid) || harassSquad2.has(eid)
        || vanguardEids.has(eid) || terranArmyEids.has(eid)) continue;

    armySet.add(eid);
  }
}

// ─────────────────────────────────────────
// Macro management helpers
// ─────────────────────────────────────────
function assignIdleWorkers(world: World, map: MapData): void {
  // Pre-scan: count workers currently targeting each Refinery
  const gasWorkerCounts = new Map<number, number>();
  for (let w = 1; w < world.nextEid; w++) {
    if (!hasComponents(world, w, WORKER | POSITION)) continue;
    if (faction[w] !== currentAIFaction) continue;
    if (hpCurrent[w] <= 0) continue;
    if (workerState[w] === WorkerState.Idle) continue;
    const tgt = workerTargetEid[w];
    if (tgt > 0 && hasComponents(world, tgt, BUILDING) && (buildingType[tgt] === BuildingType.Refinery || buildingType[tgt] === BuildingType.Extractor)) {
      gasWorkerCounts.set(tgt, (gasWorkerCounts.get(tgt) || 0) + 1);
    }
  }

  // Find completed Refineries that need workers (fewer than 3)
  const unsaturatedRefineries: number[] = [];
  for (let b = 1; b < world.nextEid; b++) {
    if (!hasComponents(world, b, BUILDING | POSITION)) continue;
    if (faction[b] !== currentAIFaction) continue;
    if (buildingType[b] !== BuildingType.Refinery && buildingType[b] !== BuildingType.Extractor) continue;
    if (buildState[b] !== BuildState.Complete) continue;
    if (hpCurrent[b] <= 0) continue;
    if (resourceRemaining[b] <= 0) continue;
    const count = gasWorkerCounts.get(b) || 0;
    if (count < 3) unsaturatedRefineries.push(b);
  }

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, WORKER | POSITION)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    if (hpCurrent[eid] <= 0) continue;
    if (workerState[eid] !== WorkerState.Idle) continue;

    // Find nearest base for return trips
    let baseEid = 0;
    let baseDist = Infinity;
    for (let b = 1; b < world.nextEid; b++) {
      if (!hasComponents(world, b, BUILDING | POSITION)) continue;
      if (faction[b] !== currentAIFaction) continue;
      const isBase = currentAIFaction === Faction.Zerg
        ? isHatchType(buildingType[b])
        : buildingType[b] === BuildingType.CommandCenter;
      if (!isBase) continue;
      if (buildState[b] !== BuildState.Complete) continue;
      if (hpCurrent[b] <= 0) continue;
      const dx = posX[b] - posX[eid];
      const dy = posY[b] - posY[eid];
      const d = dx * dx + dy * dy;
      if (d < baseDist) { baseDist = d; baseEid = b; }
    }
    if (baseEid === 0) continue;

    // Priority: assign to gas if a Refinery needs workers
    let assignedToGas = false;
    for (let ri = 0; ri < unsaturatedRefineries.length; ri++) {
      const refEid = unsaturatedRefineries[ri];
      const count = gasWorkerCounts.get(refEid) || 0;
      if (count < 3) {
        workerState[eid] = WorkerState.MovingToResource;
        workerTargetEid[eid] = refEid;
        workerBaseX[eid] = posX[baseEid];
        workerBaseY[eid] = posY[baseEid];
        commandMode[eid] = CommandMode.Move;
        pathTo(eid, posX[refEid], posY[refEid], map);
        gasWorkerCounts.set(refEid, count + 1);
        assignedToGas = true;
        // Remove from list if now saturated
        if (count + 1 >= 3) unsaturatedRefineries.splice(ri, 1);
        break;
      }
    }
    if (assignedToGas) continue;

    // Otherwise assign to nearest mineral
    const mineralEid = findNearestMineral(world, posX[eid], posY[eid]);
    if (mineralEid === 0) continue;

    workerState[eid] = WorkerState.MovingToResource;
    workerTargetEid[eid] = mineralEid;
    workerBaseX[eid] = posX[baseEid];
    workerBaseY[eid] = posY[baseEid];
    commandMode[eid] = CommandMode.Move;
    pathTo(eid, posX[mineralEid], posY[mineralEid], map);
  }
}

function countAIWorkers(world: World): number {
  let count = 0;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, WORKER | POSITION)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    if (hpCurrent[eid] <= 0) continue;
    count++;
  }
  return count;
}

function countAIBases(world: World): number {
  let count = 0;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING | POSITION)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    const isBase = currentAIFaction === Faction.Zerg
      ? isHatchType(buildingType[eid])
      : buildingType[eid] === BuildingType.CommandCenter;
    if (!isBase) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;
    count++;
  }
  return count;
}

function findTerranCC(world: World): number {
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING | POSITION)) continue;
    if (faction[eid] !== Faction.Terran) continue;
    if (buildingType[eid] !== BuildingType.CommandCenter) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;
    return eid;
  }
  return 0;
}

function aiBuildBuilding(
  _world: World,
  bType: number,
  col: number,
  row: number,
  map: MapData,
  resources: Record<number, PlayerResources>,
  spawnBuildingFn: SpawnBuildingFn,
): boolean {
  const res = resources[currentAIFaction];
  if (!res) return false;
  const bDef = BUILDING_DEFS[bType];
  if (!bDef) return false;
  if (res.minerals < bDef.costMinerals || res.gas < bDef.costGas) return false;

  // Gas building: snap to nearest gas tile instead of using fixed offset
  let placeCol = col;
  let placeRow = row;
  if (bType === BuildingType.Refinery || bType === BuildingType.Extractor) {
    let bestDist = Infinity;
    for (let dr = -10; dr <= 10; dr++) {
      for (let dc = -10; dc <= 10; dc++) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || c >= map.cols || r < 0 || r >= map.rows) continue;
        if (map.tiles[r * map.cols + c] === TileType.Gas) {
          const dist = dc * dc + dr * dr;
          if (dist < bestDist) {
            bestDist = dist;
            placeCol = c;
            placeRow = r;
          }
        }
      }
    }
    if (bestDist === Infinity) return false; // no gas tile found
  }

  res.minerals -= bDef.costMinerals;
  res.gas -= bDef.costGas;
  spawnBuildingFn(bType, currentAIFaction, placeCol, placeRow);
  return true;
}

function runMacroManagement(
  world: World,
  map: MapData,
  resources: Record<number, PlayerResources>,
  gameTime: number,
  spawnBuildingFn: SpawnBuildingFn,
): void {
  const res = resources[currentAIFaction];
  if (!res) return;

  // 1. Assign idle workers to mine
  assignIdleWorkers(world, map);

  // 2. Build supply when near cap (within 6 supply)
  const supplyGap = res.supplyProvided - res.supplyUsed;
  if (supplyGap < 6 && res.supplyProvided < 200) {
    if (currentAIFaction === Faction.Zerg) {
      aiQueueUnit(world, UnitType.Overlord, resources);
      // Emergency: queue a second Overlord if critically low
      if (supplyGap <= 2) {
        aiQueueUnit(world, UnitType.Overlord, resources);
      }
    } else {
      // Terran: build Supply Depot
      const cc = findTerranCC(world);
      if (cc > 0 && res.minerals >= 100) {
        const ccTile = worldToTile(posX[cc], posY[cc]);
        const depotCol = ccTile.col + 4 + rng.nextInt(3);
        const depotRow = ccTile.row + rng.nextInt(3) - 1;
        aiBuildBuilding(world, BuildingType.SupplyDepot, depotCol, depotRow, map, resources, spawnBuildingFn);
      }
    }
  }

  // 3. Keep making workers until saturated (max ~16 per base)
  const workerCount = countAIWorkers(world);
  const baseCount = countAIBases(world);
  if (workerCount < workerCap && res.minerals >= 50) {
    if (currentAIFaction === Faction.Zerg) {
      aiQueueUnit(world, UnitType.Drone, resources);
    } else {
      aiQueueUnit(world, UnitType.SCV, resources);
    }
  }

  // 4. Terran AI: build addons on completed production buildings
  if (currentAIFaction === Faction.Terran && res.minerals >= 50 && res.gas >= 25) {
    let firstBarracks = true;
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, BUILDING)) continue;
      if (faction[eid] !== currentAIFaction) continue;
      if (buildState[eid] !== BuildState.Complete) continue;
      if (hpCurrent[eid] <= 0) continue;
      const bt = buildingType[eid];
      if (bt !== BuildingType.Barracks && bt !== BuildingType.Factory && bt !== BuildingType.Starport) continue;
      if (addonType[eid] !== AddonType.None) {
        if (bt === BuildingType.Barracks) firstBarracks = false;
        continue;
      }
      // First Barracks gets TechLab (for Marauder), rest get Reactor
      const addon = (bt === BuildingType.Barracks && firstBarracks) ? AddonType.TechLab : AddonType.Reactor;
      if (res.minerals >= 50 && res.gas >= 25) {
        res.minerals -= 50;
        res.gas -= 25;
        addonType[eid] = addon;
      }
      if (bt === BuildingType.Barracks) firstBarracks = false;
    }
  }

  // 5. Build tech buildings on schedule
  if (currentAIFaction === Faction.Terran) {
    checkTerranBuildingSchedule(world, map, resources, spawnBuildingFn, gameTime);
  } else {
    checkAIBuildingSchedule(world, map, resources, spawnBuildingFn, gameTime);
  }
}

// ─────────────────────────────────────────
// B.1 — Defense tuning constants
// ─────────────────────────────────────────
const DEFENSE_DETECTION_RANGE = 12;
const DEFENSE_CLEAR_RANGE = 15;
const DEFENSE_CLEAR_DURATION = 10;
const DEFENSE_PEEL_MAX = 8;
const DEFENSE_PEEL_MIN = 3;
const DEFENSE_PEEL_RATIO = 0.4;
const EMERGENCY_SPAWN_THRESHOLD = 3;
const EMERGENCY_SPAWN_COUNT = 2;

// ─────────────────────────────────────────
// Iteration 1: APM-based difficulty system
// ─────────────────────────────────────────
// Actions Per Minute budget — the core difficulty lever.
// Every AI action (spawn, move command, micro, ability) costs action points.
// The budget refills per decision tick based on difficulty.
// This makes Easy feel slow/deliberate, Brutal feel overwhelming.
const APM_BUDGETS: Record<Difficulty, number> = {
  [Difficulty.Easy]:   20,    // ~20 APM — slow macro, minimal micro
  [Difficulty.Normal]: 60,    // ~60 APM — decent macro, some micro
  [Difficulty.Hard]:   150,   // ~150 APM — good macro + active micro
  [Difficulty.Brutal]: 350,   // ~350 APM — full macro + aggressive micro
};

// Action costs (in APM points per action)
const APM_COST_SPAWN = 2;        // spawning a unit (legacy — used by Terran AI)
const APM_COST_MACRO = 1;        // macro actions: production, supply, workers (muscle memory)
const APM_COST_MOVE_CMD = 1;     // issuing a move/attack-move command
const APM_COST_MICRO = 3;        // kiting, splitting, pulling back wounded
const APM_COST_ABILITY = 2;      // using an ability (inject, etc.)
const APM_COST_SCOUT = 1;        // sending a scout
const APM_COST_ATTACK_DECISION = 5; // committing to an attack wave

let apmBudget = 0;       // current action points available this tick
let apmSpentTotal = 0;   // lifetime APM spent (for stats)

function refillAPM(elapsed: number): void {
  const maxApm = APM_BUDGETS[currentDifficulty];
  // Convert APM (per minute) to points per elapsed seconds
  const pointsPerSecond = maxApm / 60;
  apmBudget = Math.min(maxApm / 2, apmBudget + pointsPerSecond * elapsed);
}

function spendAPM(cost: number): boolean {
  if (apmBudget >= cost) {
    apmBudget -= cost;
    apmSpentTotal += cost;
    return true;
  }
  return false;
}

// ─────────────────────────────────────────
// Tuning constants
// ─────────────────────────────────────────
const INITIAL_DELAYS: Record<Difficulty, number> = {
  [Difficulty.Easy]: 30,     // Give beginners more time
  [Difficulty.Normal]: 10,   // Standard
  [Difficulty.Hard]: 3,      // Aggressive start
  [Difficulty.Brutal]: 0,    // Immediate
};
const DECISION_INTERVAL = 15;
const MAX_SPAWNS_PER_DECISION = 6;

const FIRST_WAVE_SIZES: Record<Difficulty, number> = {
  [Difficulty.Easy]: 6,
  [Difficulty.Normal]: 4,
  [Difficulty.Hard]: 4,
  [Difficulty.Brutal]: 3,
};
const WAVE_SIZE_GROWTH = 4;
const MAX_WAVE_SIZE = 30;
const WAVE_COOLDOWN = 8;
const HARASSMENT_INTERVALS: Record<Difficulty, number> = {
  [Difficulty.Easy]: 45,
  [Difficulty.Normal]: 45,
  [Difficulty.Hard]: 20,
  [Difficulty.Brutal]: 10,
};
const SCOUT_INTERVAL = 25;        // seconds between scout sends
const RETREAT_HP_RATIO = 0.35;    // retreat if army HP drops below 35% of max
const RETREAT_MIN_REGROUP_TIME = 15; // seconds before re-attacking after retreat
const RETREAT_REBUILT_RATIO = 0.5;   // army must be >= 50% rebuilt to re-attack

// ─────────────────────────────────────────
// Iteration 2: Micro behavior constants
// ─────────────────────────────────────────
const KITE_RANGE_BUFFER = 1.5;     // tiles beyond attack range to kite back to
const STUTTER_STEP_WINDOW = 0.3;   // seconds — fraction of attack cooldown to move during
const BANELING_CLUMP_THRESHOLD = 3; // enemies within splash range to detonate on
const SURROUND_SPREAD_ANGLE = 0.4;  // radians — spread angle for zergling surround
const WOUNDED_PULL_RATIO = 0.25;   // pull unit back when HP drops below 25%
const ROACH_REGEN_PULL_RATIO = 0.3; // pull Roaches back at 30% to regen

// ─────────────────────────────────────────
// Iteration 3: Engagement constants
// ─────────────────────────────────────────
const CONCAVE_SPREAD = 0.12;       // radians per unit in concave formation
const ENGAGEMENT_ADVANTAGE_THRESHOLD = 0.8;  // attack if our value >= 80% of enemy
const DISENGAGE_THRESHOLD = 0.4;   // disengage if our value drops below 40%
const FLANK_SPLIT_RATIO = 0.3;     // 30% of fast units flank

// ─────────────────────────────────────────
// Iteration 4: Adaptive strategy constants
// ─────────────────────────────────────────
const TIMING_ATTACK_WINDOW = 30;   // seconds after scouting enemy expand to punish
const TECH_SWITCH_COOLDOWN = 60;   // seconds between tech switches
let lastTechSwitchTime = 0;
let currentStrategy: 'standard' | 'anti-bio' | 'anti-mech' | 'timing-attack' | 'economy-punish' = 'standard';
let strategySetTime = 0;

// ─────────────────────────────────────────
// Iteration 5: Combat awareness constants
// ─────────────────────────────────────────
const SPLASH_SPREAD_DIST = 2.5;    // tiles to spread apart vs splash
const THREAT_ZONE_RANGE = 14;      // tiles — avoid walking into siege tank range
const SNIPE_HP_THRESHOLD = 0.2;    // focus units below 20% HP for kills
const COORDINATED_ENGAGE_RANGE = 8; // tiles — all units must be within this to engage

// Alternate attack entry point for Hard/Brutal harass squad (far side of map from player base)
function getHarassTarget() {
  return currentAIFaction === Faction.Terran
    ? { col: 15, row: 112 }
    : { col: 112, row: 15 };
}

// ─────────────────────────────────────────
// Per-game personality (randomized at init)
// ─────────────────────────────────────────
interface AIPersonality {
  aggressionMult: number;   // 0.7 (passive) to 1.3 (aggressive)
  timingOffset: number;     // -5 to +5 seconds on wave timing
  preferredStyle: 'rush' | 'balanced' | 'heavy';
}

let personality: AIPersonality;

function randomPersonality(): AIPersonality {
  const roll = rng.next();
  return {
    aggressionMult: 0.7 + rng.next() * 0.6,  // 0.7 to 1.3
    timingOffset: (rng.next() - 0.5) * 10,     // -5 to +5
    preferredStyle: roll < 0.33 ? 'rush' : roll < 0.66 ? 'balanced' : 'heavy',
  };
}

// ─────────────────────────────────────────
// Intel tracking (what the AI has scouted)
// ─────────────────────────────────────────
interface ScoutIntel {
  lastScoutTime: number;
  marineSeen: number;
  marauderSeen: number;
  tankSeen: number;
  medivacSeen: number;
  buildingsSeen: number;
  lastKnownEnemyX: number;
  lastKnownEnemyY: number;
  hasScoutedBase: boolean;
}

let intel: ScoutIntel;

function resetIntel(): ScoutIntel {
  return {
    lastScoutTime: 0,
    marineSeen: 0, marauderSeen: 0, tankSeen: 0, medivacSeen: 0,
    buildingsSeen: 0,
    lastKnownEnemyX: -1, lastKnownEnemyY: -1,
    hasScoutedBase: false,
  };
}

// ─────────────────────────────────────────
// Scout waypoints (locations to check)
// ─────────────────────────────────────────
const SCOUT_WAYPOINTS = [
  { col: 15, row: 15 },   // Player starting base
  { col: 64, row: 64 },   // Map center
  { col: 15, row: 40 },   // Natural expansion area
  { col: 40, row: 15 },   // Flanking route
  { col: 90, row: 30 },   // Far side
];

// ─────────────────────────────────────────
// AI State
// ─────────────────────────────────────────
let currentDifficulty: Difficulty = Difficulty.Normal;
let currentAIFaction: Faction = Faction.Zerg;
let playerBaseTile = { col: 15, row: 15 }; // where the player base is
let enemyFaction: Faction = Faction.Terran; // who the AI is fighting
let waveCount = 0;
let lastAIUpgradeWave = 0; // last wave count when AI upgraded
let nextAIUpgradeType = 3; // ZergMelee=3, ZergRanged=4, ZergCarapace=5 cycling
let tickCounter = 0;
let lastDecisionTime = 0;
let isAttacking = false;
let attackEndTime = 0;
let lastHarassTime = 0;
let lastScoutSendTime = 0;
let retreating = false;
let lastRetreatTime = 0;
let regroupX = 0;
let regroupY = 0;
const armyEids = new Set<number>();
const harassEids = new Set<number>();
const scoutEids = new Set<number>();
let defenseEids: Set<number> = new Set();
let queenEids: Set<number> = new Set();
let lastDefenseTime = 0;
let defenseAreaClearSince = 0;
let isStaging = false;
let stagingX = 0;
let stagingY = 0;
let stagingStartTime = 0;

// ─────────────────────────────────────────
// B.4 — Expanded AI Base (Living Base)
// ─────────────────────────────────────────
const AI_BUILDING_SCHEDULE: Array<{ minTime: number; type: number; colOffset: number; rowOffset: number }> = [
  { minTime: 0,   type: BuildingType.SpawningPool,     colOffset: -4, rowOffset: 0 },
  { minTime: 30,  type: BuildingType.Extractor,         colOffset: 4,  rowOffset: -3 },
  { minTime: 90,  type: BuildingType.RoachWarren,       colOffset: 5,  rowOffset: 0 },
  { minTime: 120, type: BuildingType.EvolutionChamber,  colOffset: 0,  rowOffset: 5 },
  { minTime: 180, type: BuildingType.HydraliskDen,      colOffset: 5,  rowOffset: 5 },
  { minTime: 240, type: BuildingType.Extractor,         colOffset: 7,  rowOffset: -3 },
  { minTime: 150, type: BuildingType.BanelingNest,       colOffset: -3, rowOffset: 3 },
  { minTime: 300, type: BuildingType.Spire,             colOffset: -5, rowOffset: 5 },
  { minTime: 360, type: BuildingType.InfestationPit,    colOffset: -5, rowOffset: -3 },
  { minTime: 250, type: BuildingType.LurkerDen,         colOffset: 6,  rowOffset: 3 },
  { minTime: 420, type: BuildingType.UltraliskCavern,   colOffset: -6, rowOffset: 4 },
  // Defensive structures
  { minTime: 60,  type: BuildingType.SpineCrawler,     colOffset: -2, rowOffset: -4 },
  { minTime: 75,  type: BuildingType.SpineCrawler,     colOffset: 2,  rowOffset: -4 },
  { minTime: 150, type: BuildingType.SporeCrawler,     colOffset: 0,  rowOffset: -3 },
];
let aiBuildingsPlaced: Set<number> = new Set();

// ─────────────────────────────────────────
// B.4b — Terran AI Building Schedule (time-gated)
// ─────────────────────────────────────────
const TERRAN_BUILDING_SCHEDULE: Array<{ minTime: number; type: number; colOffset: number; rowOffset: number }> = [
  { minTime: 60,  type: BuildingType.Refinery,        colOffset: 4, rowOffset: -3 },
  { minTime: 90,  type: BuildingType.Barracks,         colOffset: -5, rowOffset: 0 },
  { minTime: 120, type: BuildingType.Factory,          colOffset: 5, rowOffset: 3 },
  { minTime: 150, type: BuildingType.Armory,            colOffset: 5, rowOffset: -5 },
  { minTime: 180, type: BuildingType.Starport,         colOffset: -5, rowOffset: 3 },
  { minTime: 200, type: BuildingType.GhostAcademy,     colOffset: -5, rowOffset: -5 },
  { minTime: 240, type: BuildingType.EngineeringBay,   colOffset: 0, rowOffset: -5 },
  { minTime: 250, type: BuildingType.FusionCore,       colOffset: 0, rowOffset: 5 },
  { minTime: 300, type: BuildingType.Barracks,         colOffset: 5, rowOffset: -3 },
];
let terranBuildingsPlaced: Set<number> = new Set();

// ─────────────────────────────────────────
// B.6 — Persistent Harassment Squads
// ─────────────────────────────────────────
let harassSquad1: Set<number> = new Set();
let harassSquad2: Set<number> = new Set();
const HARASS_SQUAD_SIZE = 4;
const HARASS_TARGET_1 = { col: 12, row: 18 }; // player mineral line
const HARASS_TARGET_2 = { col: 15, row: 112 }; // opposite flank
const HARASS_PATROL_OFFSET = 10; // tiles to patrol between target and secondary point

// ─────────────────────────────────────────
// B.2 — Vanguard Map Presence
// ─────────────────────────────────────────
let vanguardEids: Set<number> = new Set();
const VANGUARD_SIZE = 4;
const VANGUARD_TILE = { col: 64, row: 64 }; // map center

let hasExpanded = false;
let expansionCount = 0;
let currentMap: MapData | null = null;
let cachedResources: Record<number, PlayerResources> | null = null;
let cachedGameTime = 0;

// ─────────────────────────────────────────
// Build Order driven state
// ─────────────────────────────────────────
let workerCap = 16;
let activeComposition: CompositionTarget | null = null;
let shouldAttackWhenReady = false;
let activeProfileName = '';

export function initAI(difficulty: Difficulty = Difficulty.Normal, aiFaction: Faction = Faction.Zerg): void {
  currentDifficulty = difficulty;
  currentAIFaction = aiFaction;
  enemyFaction = aiFaction === Faction.Zerg ? Faction.Terran : Faction.Zerg;
  playerBaseTile = aiFaction === Faction.Zerg ? { col: 15, row: 15 } : { col: 117, row: 117 };
  waveCount = 0;
  tickCounter = 0;
  lastDecisionTime = 0;
  isAttacking = false;
  attackEndTime = 0;
  lastHarassTime = 0;
  lastScoutSendTime = 0;
  retreating = false;
  lastRetreatTime = 0;
  regroupX = 0;
  regroupY = 0;
  armyEids.clear();
  harassEids.clear();
  scoutEids.clear();
  lastAIUpgradeWave = 0;
  nextAIUpgradeType = 3;
  hasExpanded = false;
  expansionCount = 0;
  defenseEids = new Set();
  queenEids = new Set();
  lastDefenseTime = 0;
  defenseAreaClearSince = 0;
  isStaging = false;
  stagingX = 0;
  stagingY = 0;
  stagingStartTime = 0;
  aiBuildingsPlaced = new Set();
  terranBuildingsPlaced = new Set();
  harassSquad1 = new Set();
  harassSquad2 = new Set();
  vanguardEids = new Set();
  terranArmyEids = new Set();
  terranLastSpawnTime = 0;
  personality = randomPersonality();
  intel = resetIntel();
  apmBudget = 0;
  apmSpentTotal = 0;
  lastTechSwitchTime = 0;
  currentStrategy = 'standard';
  strategySetTime = 0;
  workerCap = 16;
  activeComposition = null;
  shouldAttackWhenReady = false;
  activeProfileName = '';

  // Select build order
  activeBuildOrder = null;
  buildOrderIndex = 0;
  if (currentAIFaction === Faction.Zerg) {
    const roll = rng.next();
    if (currentDifficulty === Difficulty.Easy) {
      // Easy: slow, macro builds — give player time
      activeBuildOrder = roll < 0.6
        ? [...ZERG_MACRO_HATCH_FIRST]
        : roll < 0.8 ? [...ZERG_ROACH_HYDRA_PUSH]
        : [...ZERG_ROACH_RAVAGER_TIMING];
      activeProfileName = roll < 0.6 ? 'macro' : roll < 0.8 ? 'roach-hydra' : 'roach-ravager';
    } else if (currentDifficulty === Difficulty.Hard || currentDifficulty === Difficulty.Brutal) {
      // Hard/Brutal: aggressive profiles
      activeBuildOrder = roll < 0.25
        ? [...ZERG_12_POOL_RUSH]
        : roll < 0.55 ? [...ZERG_LING_BANE_BUST]
        : roll < 0.80 ? [...ZERG_ROACH_RAVAGER_TIMING]
        : [...ZERG_ROACH_HYDRA_PUSH];
      activeProfileName = roll < 0.25 ? 'rush' : roll < 0.55 ? 'ling-bane' : roll < 0.80 ? 'roach-ravager' : 'roach-hydra';
    } else {
      // Normal: balanced mix
      activeBuildOrder = roll < 0.10
        ? [...ZERG_12_POOL_RUSH]
        : roll < 0.30 ? [...ZERG_LING_BANE_BUST]
        : roll < 0.50 ? [...ZERG_ROACH_RAVAGER_TIMING]
        : roll < 0.75 ? [...ZERG_ROACH_HYDRA_PUSH]
        : [...ZERG_MACRO_HATCH_FIRST];
      activeProfileName = roll < 0.10 ? 'rush' : roll < 0.30 ? 'ling-bane' : roll < 0.50 ? 'roach-ravager' : roll < 0.75 ? 'roach-hydra' : 'macro';
    }
    activeBuildOrder = activeBuildOrder.map(s => ({ ...s, done: false, startedAt: undefined }));
    buildOrderIndex = 0;
  }
  if (currentAIFaction === Faction.Terran) {
    activeBuildOrder = [...TERRAN_BIO].map(s => ({ ...s, done: false, startedAt: undefined }));
    buildOrderIndex = 0;
    activeProfileName = 'terran-bio';
  }
}

export function getAIState() {
  const res = cachedResources?.[currentAIFaction];
  return { aiMinerals: res?.minerals ?? 0, aiGas: res?.gas ?? 0, waveCount, isAttacking, armySize: armyEids.size, defenseSize: defenseEids.size, apmBudget: Math.round(apmBudget), strategy: currentStrategy, profile: activeProfileName };
}

export function setAIMinerals(m: number, g: number = 0): void {
  const res = cachedResources?.[currentAIFaction];
  if (res) {
    res.minerals = m;
    res.gas = g;
  }
}

// ─────────────────────────────────────────
// Build Order Execution
// ─────────────────────────────────────────
function executeBuildOrder(
  world: World,
  resources: Record<number, PlayerResources>,
  gameTime: number,
  spawnBuildingFn: SpawnBuildingFn,
  map: MapData,
): void {
  if (!activeBuildOrder || buildOrderIndex >= activeBuildOrder.length) return;
  if (world.nextEid >= MAX_ENTITIES - 50) return; // entity cap safety

  const res = resources[currentAIFaction];
  if (!res) return;

  // Process multiple steps per tick (instant actions like set_worker_cap shouldn't stall)
  let stepsThisTick = 0;
  const MAX_STEPS_PER_TICK = 4;

  while (buildOrderIndex < activeBuildOrder.length && stepsThisTick < MAX_STEPS_PER_TICK) {
    const step = activeBuildOrder[buildOrderIndex];
    if (!step) break;
    if (step.done) { buildOrderIndex++; continue; }

    // Check trigger
    let triggered = false;
    switch (step.trigger) {
      case 'supply':
        triggered = res.supplyUsed >= step.triggerValue;
        break;
      case 'time':
        triggered = gameTime >= step.triggerValue;
        break;
      case 'unit_count':
        triggered = armyEids.size >= step.triggerValue;
        break;
      case 'worker_count':
        triggered = countAIWorkers(world) >= step.triggerValue;
        break;
      case 'building_done': {
        // Check if a building of the specified type is complete
        let found = false;
        if (step.triggerBuildingType !== undefined) {
          for (let eid = 1; eid < world.nextEid; eid++) {
            if (!hasComponents(world, eid, BUILDING | POSITION)) continue;
            if (faction[eid] !== currentAIFaction) continue;
            if (buildingType[eid] !== step.triggerBuildingType) continue;
            if (buildState[eid] !== BuildState.Complete) continue;
            if (hpCurrent[eid] <= 0) continue;
            found = true;
            break;
          }
        }
        triggered = found;
        break;
      }
      case 'minerals_above':
        triggered = res.minerals >= step.triggerValue;
        break;
      case 'always':
        triggered = true;
        break;
    }

    if (!triggered) break; // Wait for trigger

    // Timeout: skip stuck steps
    if (step.timeout) {
      if (!step.startedAt) {
        step.startedAt = gameTime;
      } else if (gameTime - step.startedAt > step.timeout) {
        step.done = true;
        buildOrderIndex++;
        stepsThisTick++;
        continue;
      }
    }

    // Execute action
    let completed = false;
    switch (step.action.kind) {
      case 'unit': {
        const def = UNIT_DEFS[step.action.type];
        if (!def) { completed = true; break; }
        const count = step.action.count ?? 1;
        // Queue as many as possible (up to count)
        let queued = 0;
        for (let i = 0; i < count; i++) {
          if (aiQueueUnit(world, step.action.type, resources)) queued++;
          else break;
        }
        // Complete if we queued at least one (don't stall on multi-queue)
        if (queued > 0) completed = true;
        break;
      }
      case 'worker': {
        const workerType = currentAIFaction === Faction.Zerg ? UnitType.Drone : UnitType.SCV;
        if (countAIWorkers(world) >= workerCap) {
          completed = true; // Already at cap, skip
        } else {
          completed = aiQueueUnit(world, workerType, resources);
        }
        break;
      }
      case 'overlord': {
        completed = aiQueueUnit(world, UnitType.Overlord, resources);
        break;
      }
      case 'queen': {
        completed = aiQueueUnit(world, UnitType.Queen, resources);
        break;
      }
      case 'building': {
        const hatch = currentAIFaction === Faction.Zerg ? findZergHatchery(world) : findTerranCC(world);
        if (hatch > 0) {
          const hatchTile = worldToTile(posX[hatch], posY[hatch]);
          const col = hatchTile.col + step.action.colOffset;
          const row = hatchTile.row + step.action.rowOffset;
          completed = aiBuildBuilding(world, step.action.type, col, row, map, resources, spawnBuildingFn);
          if (completed) {
            // Mark in aiBuildingsPlaced to avoid duplicate from schedule
            for (let i = 0; i < AI_BUILDING_SCHEDULE.length; i++) {
              if (AI_BUILDING_SCHEDULE[i].type === step.action.type && !aiBuildingsPlaced.has(i)) {
                aiBuildingsPlaced.add(i);
                break;
              }
            }
          }
        }
        break;
      }
      case 'attack':
        shouldAttackWhenReady = true;
        if (currentMap) {
          const diffConfig = DIFFICULTY_CONFIGS[currentDifficulty];
          decideAttack(world, currentMap, gameTime, diffConfig);
        }
        completed = true;
        break;
      case 'upgrade':
        if (res.upgrades[step.action.upgradeType] < 3) {
          res.upgrades[step.action.upgradeType]++;
        }
        completed = true;
        break;
      case 'expand':
        if (attemptExpansion(resources, spawnBuildingFn)) {
          completed = true;
        }
        break;
      case 'set_worker_cap':
        workerCap = step.action.count;
        completed = true;
        break;
      case 'set_composition':
        activeComposition = step.action.comp;
        completed = true;
        break;
    }

    if (completed) {
      step.done = true;
      // 'always' trigger on terminal step = infinite loop (continuous production)
      if (step.trigger === 'always' && buildOrderIndex === activeBuildOrder.length - 1) {
        // Reset the last step so it repeats
        step.done = false;
        step.startedAt = undefined;
      } else {
        buildOrderIndex++;
      }
      stepsThisTick++;
    } else {
      break; // Can't complete this step yet, wait
    }
  }
}

// ─────────────────────────────────────────
// Base Defense (B.1)
// ─────────────────────────────────────────
function checkBaseUnderAttack(world: World, gameTime: number, map: MapData, resources: Record<number, PlayerResources>): void {
  if (gameTime - lastDefenseTime < 15) return; // 15s cooldown between defense activations

  // Find if any enemy units are within DEFENSE_DETECTION_RANGE tiles of any AI building
  let threatX = 0, threatY = 0;
  let threatFound = false;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    const bx = posX[eid], by = posY[eid];
    for (let other = 1; other < world.nextEid; other++) {
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (faction[other] === currentAIFaction || faction[other] === 0) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - bx, dy = posY[other] - by;
      if (dx * dx + dy * dy < (DEFENSE_DETECTION_RANGE * TILE_SIZE) * (DEFENSE_DETECTION_RANGE * TILE_SIZE)) {
        threatX = posX[other];
        threatY = posY[other];
        threatFound = true;
        break;
      }
    }
    if (threatFound) break;
  }

  if (!threatFound) return;
  lastDefenseTime = gameTime;

  // Determine which army set to peel from
  const armySet = currentAIFaction === Faction.Terran ? terranArmyEids : armyEids;

  // Emergency spawn if army too small — queue through production (fair-play)
  if (armySet.size < EMERGENCY_SPAWN_THRESHOLD && world.nextEid < MAX_ENTITIES - 50) {
    const spawnType = currentAIFaction === Faction.Zerg ? UnitType.Zergling : UnitType.Marine;
    for (let i = 0; i < EMERGENCY_SPAWN_COUNT; i++) {
      aiQueueUnit(world, spawnType, resources);
    }
  }

  // Peel off 40% of army to defend (minimum DEFENSE_PEEL_MIN, max DEFENSE_PEEL_MAX)
  const peelCount = Math.min(DEFENSE_PEEL_MAX, Math.max(DEFENSE_PEEL_MIN, Math.floor(armySet.size * DEFENSE_PEEL_RATIO)));
  let peeled = 0;
  for (const eid of armySet) {
    if (peeled >= peelCount) break;
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;

    commandMode[eid] = CommandMode.AttackMove;
    const startTile = worldToTile(posX[eid], posY[eid]);
    const endTile = worldToTile(threatX, threatY);
    const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
    if (tilePath.length > 0) {
      setPath(eid, tilePath.map(([c, r]) => {
        const wp = tileToWorld(c, r);
        return [wp.x, wp.y] as [number, number];
      }));
    }
    defenseEids.add(eid);
    armySet.delete(eid);
    peeled++;
  }
}

function updateDefenseGroup(world: World, gameTime: number): void {
  if (defenseEids.size === 0) {
    defenseAreaClearSince = 0;
    return;
  }

  // Check if any enemy unit is within DEFENSE_CLEAR_RANGE tiles of any AI building
  let enemyNearBase = false;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, BUILDING)) continue;
    if (faction[eid] !== currentAIFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    const bx = posX[eid], by = posY[eid];
    for (let other = 1; other < world.nextEid; other++) {
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (faction[other] === currentAIFaction || faction[other] === 0) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - bx, dy = posY[other] - by;
      if (dx * dx + dy * dy < (DEFENSE_CLEAR_RANGE * TILE_SIZE) * (DEFENSE_CLEAR_RANGE * TILE_SIZE)) {
        enemyNearBase = true;
        break;
      }
    }
    if (enemyNearBase) break;
  }

  if (enemyNearBase) {
    defenseAreaClearSince = 0;
    return;
  }

  // Area is clear — start or continue timer
  if (defenseAreaClearSince === 0) {
    defenseAreaClearSince = gameTime;
    return;
  }

  // If clear for DEFENSE_CLEAR_DURATION seconds, rejoin army
  if (gameTime - defenseAreaClearSince >= DEFENSE_CLEAR_DURATION) {
    const armySet = currentAIFaction === Faction.Terran ? terranArmyEids : armyEids;
    for (const eid of defenseEids) {
      if (entityExists(world, eid) && hpCurrent[eid] > 0) {
        armySet.add(eid);
      }
    }
    defenseEids.clear();
    defenseAreaClearSince = 0;
  }
}

// ─────────────────────────────────────────
// B.4 — Auto-build buildings as waves progress
// ─────────────────────────────────────────
function checkAIBuildingSchedule(
  world: World,
  map: MapData,
  resources: Record<number, PlayerResources>,
  spawnBuildingFn: SpawnBuildingFn,
  gameTime: number,
): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  // Find the AI Hatchery to offset from
  const hatch = findZergHatchery(world);
  if (hatch === 0) return;
  const hatchTile = worldToTile(posX[hatch], posY[hatch]);

  for (let i = 0; i < AI_BUILDING_SCHEDULE.length; i++) {
    if (aiBuildingsPlaced.has(i)) continue;
    const entry = AI_BUILDING_SCHEDULE[i];
    if (gameTime >= entry.minTime) {
      const col = hatchTile.col + entry.colOffset;
      const row = hatchTile.row + entry.rowOffset;
      if (aiBuildBuilding(world, entry.type, col, row, map, resources, spawnBuildingFn)) {
        aiBuildingsPlaced.add(i);
      }
    }
  }
}

/** Rebuild critical buildings if destroyed (prevents permanent tech death) */
function checkCriticalBuildings(
  world: World,
  map: MapData,
  resources: Record<number, PlayerResources>,
  spawnBuildingFn: SpawnBuildingFn,
): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;
  const res = resources[currentAIFaction];
  if (!res || res.minerals < 200) return;

  const hatch = findZergHatchery(world);
  if (hatch === 0) return;
  const hatchTile = worldToTile(posX[hatch], posY[hatch]);

  const criticals: Array<{ type: number; colOffset: number; rowOffset: number }> = [
    { type: BuildingType.SpawningPool, colOffset: -4, rowOffset: 0 },
    { type: BuildingType.RoachWarren, colOffset: 5, rowOffset: 0 },
    { type: BuildingType.HydraliskDen, colOffset: 5, rowOffset: 5 },
  ];

  for (const crit of criticals) {
    // Check if we ever built one via schedule
    let wasBuilt = false;
    for (let i = 0; i < AI_BUILDING_SCHEDULE.length; i++) {
      if (AI_BUILDING_SCHEDULE[i].type === crit.type && aiBuildingsPlaced.has(i)) {
        wasBuilt = true;
        break;
      }
    }
    if (!wasBuilt) continue;

    // Check if a living instance exists
    let exists = false;
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, BUILDING | POSITION)) continue;
      if (faction[eid] !== currentAIFaction) continue;
      if (buildingType[eid] !== crit.type) continue;
      if (hpCurrent[eid] <= 0) continue;
      exists = true;
      break;
    }
    if (exists) continue;

    aiBuildBuilding(world, crit.type, hatchTile.col + crit.colOffset, hatchTile.row + crit.rowOffset, map, resources, spawnBuildingFn);
  }
}

// ─────────────────────────────────────────
// B.4b — Auto-build Terran buildings on time schedule
// ─────────────────────────────────────────
function checkTerranBuildingSchedule(
  world: World,
  map: MapData,
  resources: Record<number, PlayerResources>,
  spawnBuildingFn: SpawnBuildingFn,
  gameTime: number,
): void {
  const cc = findTerranCC(world);
  if (cc === 0) return;
  const ccTile = worldToTile(posX[cc], posY[cc]);

  for (let i = 0; i < TERRAN_BUILDING_SCHEDULE.length; i++) {
    if (terranBuildingsPlaced.has(i)) continue;
    const entry = TERRAN_BUILDING_SCHEDULE[i];
    if (gameTime >= entry.minTime) {
      const col = ccTile.col + entry.colOffset;
      const row = ccTile.row + entry.rowOffset;
      if (aiBuildBuilding(world, entry.type, col, row, map, resources, spawnBuildingFn)) {
        terranBuildingsPlaced.add(i);
      }
    }
  }
}

// ─────────────────────────────────────────
// B.6 — Persistent Harassment Squad Logic
// ─────────────────────────────────────────
/** Find actual enemy worker clusters for harassment targeting */
function findHarassTarget(world: World, secondary: boolean): { col: number; row: number } {
  // Scan for enemy workers
  let bestEid = 0;
  let bestDist = secondary ? -Infinity : Infinity;
  const baseTile = playerBaseTile;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH | WORKER)) continue;
    if (faction[eid] === currentAIFaction || faction[eid] === 0) continue;
    if (hpCurrent[eid] <= 0) continue;
    const dx = posX[eid] / TILE_SIZE - baseTile.col;
    const dy = posY[eid] / TILE_SIZE - baseTile.row;
    const distSq = dx * dx + dy * dy;
    // Primary: closest worker cluster to player base. Secondary: furthest (expansion workers).
    if (secondary ? distSq > bestDist : distSq < bestDist) {
      bestDist = distSq;
      bestEid = eid;
    }
  }
  if (bestEid > 0) {
    return worldToTile(posX[bestEid], posY[bestEid]);
  }
  // Fallback: use intel or player base
  if (intel.lastKnownEnemyX > 0) {
    return worldToTile(intel.lastKnownEnemyX, intel.lastKnownEnemyY);
  }
  return secondary ? HARASS_TARGET_2 : HARASS_TARGET_1;
}

function runHarassSquads(world: World, map: MapData): void {
  // Dead units already pruned in pruneDeadUnits()

  // Fill squads from newly spawned units in armyEids
  fillHarassSquad(harassSquad1, HARASS_SQUAD_SIZE);
  fillHarassSquad(harassSquad2, HARASS_SQUAD_SIZE);

  // Dynamic harassment targets: find actual enemy worker clusters
  const target1 = findHarassTarget(world, false);
  const target2 = findHarassTarget(world, true);
  moveHarassSquadToTarget(world, map, harassSquad1, target1);
  moveHarassSquadToTarget(world, map, harassSquad2, target2);
}

function fillHarassSquad(squad: Set<number>, maxSize: number): void {
  if (squad.size >= maxSize) return;
  const needed = maxSize - squad.size;
  let assigned = 0;
  for (const eid of armyEids) {
    if (assigned >= needed) break;
    if (unitType[eid] === UnitType.Zergling) {
      squad.add(eid);
      armyEids.delete(eid);
      assigned++;
    }
  }
}

function moveHarassSquadToTarget(
  world: World,
  map: MapData,
  squad: Set<number>,
  target: { col: number; row: number },
): void {
  if (squad.size === 0) return;

  const targetWorld = tileToWorld(target.col, target.row);

  // Check if any enemy workers are at the target area
  let hasEnemyNearTarget = false;
  const scanRange = 8 * TILE_SIZE;
  const scanRangeSq = scanRange * scanRange;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH)) continue;
    if (faction[eid] === currentAIFaction || faction[eid] === 0) continue;
    if (hpCurrent[eid] <= 0) continue;
    const dx = posX[eid] - targetWorld.x;
    const dy = posY[eid] - targetWorld.y;
    if (dx * dx + dy * dy < scanRangeSq) {
      hasEnemyNearTarget = true;
      break;
    }
  }

  for (const eid of squad) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    // Only re-path units that have finished their path
    if (movePathIndex[eid] >= 0) continue;

    commandMode[eid] = CommandMode.AttackMove;
    if (hasEnemyNearTarget) {
      pathTo(eid, targetWorld.x, targetWorld.y, map);
    } else {
      // Patrol between target and a secondary point
      const patrolTarget = tileToWorld(
        target.col + HARASS_PATROL_OFFSET,
        target.row + HARASS_PATROL_OFFSET,
      );
      pathTo(eid, patrolTarget.x, patrolTarget.y, map);
    }
  }
}

// ─────────────────────────────────────────
// B.2 — Vanguard Map Presence
// ─────────────────────────────────────────
function updateVanguard(world: World, map: MapData): void {
  // Dead units already pruned in pruneDeadUnits()

  const armySizeCap = Math.floor(MAX_WAVE_SIZE * DIFFICULTY_CONFIGS[currentDifficulty].armySizeCapMultiplier);
  const threshold = Math.min(
    Math.floor((FIRST_WAVE_SIZES[currentDifficulty] + waveCount * WAVE_SIZE_GROWTH) * personality.aggressionMult),
    armySizeCap,
  );

  // At 50% wave threshold, split off units to vanguard
  if (!isAttacking && armyEids.size >= threshold * 0.5 && vanguardEids.size < VANGUARD_SIZE) {
    const needed = VANGUARD_SIZE - vanguardEids.size;
    let moved = 0;
    for (const eid of armyEids) {
      if (moved >= needed) break;
      if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
      vanguardEids.add(eid);
      armyEids.delete(eid);
      // Send to map center
      commandMode[eid] = CommandMode.AttackMove;
      const dest = tileToWorld(VANGUARD_TILE.col, VANGUARD_TILE.row);
      pathTo(eid, dest.x, dest.y, map);
      moved++;
    }
  }
}

function mergeVanguardIntoArmy(): void {
  for (const eid of vanguardEids) {
    armyEids.add(eid);
  }
  vanguardEids.clear();
}

// ─────────────────────────────────────────
// B.5 — Reactive Intel-Driven Threat Response
// ─────────────────────────────────────────
function estimateThreatLevel(world: World): number {
  let playerValue = 0, aiValue = 0;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH)) continue;
    if (hpCurrent[eid] <= 0) continue;
    const val = hpCurrent[eid] * Math.max(1, atkDamage[eid]);
    if (faction[eid] === enemyFaction) playerValue += val;
    else if (faction[eid] === currentAIFaction) aiValue += val;
  }
  return aiValue > 0 ? playerValue / aiValue : 99;
}

// ─────────────────────────────────────────
// B.7 — AI Ability Usage
// ─────────────────────────────────────────
function manageQueens(world: World, gameTime: number, map: MapData): void {
  if (currentAIFaction !== Faction.Zerg) return;
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  // Auto-produce Queens: 1 per base
  const baseCount = countAIBases(world);
  if (queenEids.size < baseCount && cachedResources) {
    aiQueueUnit(world, UnitType.Queen, cachedResources);
  }

  // Inject and position Queens near Hatcheries
  for (const eid of queenEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;

    // Find nearest Hatchery that needs inject
    let nearestHatch = 0;
    let bestDist = Infinity;
    for (let h = 1; h < world.nextEid; h++) {
      if (!hasComponents(world, h, BUILDING)) continue;
      if (faction[h] !== currentAIFaction) continue;
      if (!isHatchType(buildingType[h])) continue;
      if (buildState[h] !== BuildState.Complete) continue;
      if (hpCurrent[h] <= 0) continue;
      const d = (posX[h] - posX[eid]) ** 2 + (posY[h] - posY[eid]) ** 2;
      if (d < bestDist) { bestDist = d; nearestHatch = h; }
    }
    if (nearestHatch === 0) continue;

    // Inject if energy available and Hatchery not already injected
    if (energy[eid] >= INJECT_LARVA_COST && injectTimer[nearestHatch] <= 0) {
      if (spendAPM(APM_COST_MACRO)) {
        energy[eid] -= INJECT_LARVA_COST;
        injectTimer[nearestHatch] = gameTime + INJECT_LARVA_TIME;
      }
    }

    // Path Queen home if too far from any Hatchery (> 8 tiles)
    const homeDist = 8 * TILE_SIZE;
    if (bestDist > homeDist * homeDist && movePathIndex[eid] < 0) {
      commandMode[eid] = CommandMode.Move;
      pathTo(eid, posX[nearestHatch], posY[nearestHatch], map);
    }
  }
}

function runAIAbilities(world: World, _gameTime: number): void {
  // Queen inject is now handled by manageQueens()
  // This function remains for future non-Queen army abilities
  void world;
}

// ─────────────────────────────────────────
// Terran AI Module
// ─────────────────────────────────────────
let terranArmyEids: Set<number> = new Set();
let terranLastSpawnTime = 0;

function runTerranAI(
  world: World,
  _dt: number,
  gameTime: number,
  map: MapData,
  resources: Record<number, PlayerResources>,
  spawnBuildingFn: SpawnBuildingFn,
): void {
  currentMap = map;
  const diffConfig = DIFFICULTY_CONFIGS[currentDifficulty];

  // ── APM refill for Terran AI ──
  const terranElapsed = gameTime - lastDecisionTime;
  if (terranElapsed > 0) refillAPM(terranElapsed);

  // Build order execution (runs first, takes priority)
  executeBuildOrder(world, resources, gameTime, spawnBuildingFn, map);

  // Base defense check (B.1)
  checkBaseUnderAttack(world, gameTime, map, resources);
  updateDefenseGroup(world, gameTime);

  // Macro management (worker production, supply, idle workers)
  runMacroManagement(world, map, resources, gameTime, spawnBuildingFn);

  // Clean up dead army units
  for (const eid of [...terranArmyEids]) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) terranArmyEids.delete(eid);
  }

  // Claim newly produced units into army
  claimNewUnits(world);

  // Spawn Marines and Marauders via production queue (APM-gated)
  const res = resources[currentAIFaction];
  if (gameTime - terranLastSpawnTime > 15 && res && res.minerals >= 50 && world.nextEid < MAX_ENTITIES - 50 && spendAPM(APM_COST_SPAWN)) {
    // Alternate Marines and Marauders
    const useMarauder = terranArmyEids.size % 3 === 2 && res.minerals >= 100 && res.gas >= 25;
    const uType = useMarauder ? UnitType.Marauder : UnitType.Marine;
    if (aiQueueUnit(world, uType, resources)) {
      terranLastSpawnTime = gameTime;
    }
  }

  // Attack when army is large enough
  const targetSize = Math.min(4 + waveCount * 3, Math.floor(25 * diffConfig.armySizeCapMultiplier));
  if (terranArmyEids.size >= targetSize) {
    // Route through map center for visibility (B.9)
    const midpoint = tileToWorld(64, 64);
    const target = tileToWorld(playerBaseTile.col, playerBaseTile.row);
    const midTile = worldToTile(midpoint.x, midpoint.y);
    for (const eid of terranArmyEids) {
      if (!entityExists(world, eid)) continue;
      commandMode[eid] = CommandMode.AttackMove;

      const startTile = worldToTile(posX[eid], posY[eid]);
      const pathToMid = findPath(map, startTile.col, startTile.row, midTile.col, midTile.row);

      if (pathToMid.length > 0) {
        const worldPath: Array<[number, number]> = pathToMid.map(([c, r]) => {
          const wp = tileToWorld(c, r);
          return [wp.x, wp.y] as [number, number];
        });
        const targetTile = worldToTile(target.x, target.y);
        const pathToTarget = findPath(map, midTile.col, midTile.row, targetTile.col, targetTile.row);
        if (pathToTarget.length > 0) {
          worldPath.push(...pathToTarget.map(([c, r]) => {
            const wp = tileToWorld(c, r);
            return [wp.x, wp.y] as [number, number];
          }));
        }
        setPath(eid, worldPath);
      } else {
        const tilePath = findNearestWalkablePath(world, eid, target, map);
        if (tilePath) setPath(eid, tilePath);
      }
    }
    waveCount++;
    isAttacking = true;
  } else {
    isAttacking = false;
  }
}

function findNearestWalkablePath(
  world: World,
  eid: number,
  target: { x: number; y: number },
  map: MapData,
): Array<[number, number]> | null {
  void world;
  const startTile = worldToTile(posX[eid], posY[eid]);
  const endTile = worldToTile(target.x, target.y);
  const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
  if (tilePath.length === 0) return null;
  return tilePath.map(([c, r]) => {
    const wp = tileToWorld(c, r);
    return [wp.x, wp.y] as [number, number];
  });
}

// ─────────────────────────────────────────
// Main system entry
// ─────────────────────────────────────────
export function aiSystem(
  world: World,
  _dt: number,
  gameTime: number,
  map: MapData,
  _spawnFn: SpawnFn,
  resources: Record<number, PlayerResources>,
  spawnBuildingFn: SpawnBuildingFn,
): void {
  currentMap = map;
  cachedResources = resources;
  cachedGameTime = gameTime;

  if (currentAIFaction === Faction.Terran) {
    runTerranAI(world, _dt, gameTime, map, resources, spawnBuildingFn);
    return;
  }

  if (gameTime < INITIAL_DELAYS[currentDifficulty] + personality.timingOffset) return;

  // B.1 — Defense group runs every tick for accurate timing
  updateDefenseGroup(world, gameTime);

  tickCounter++;
  if (tickCounter < DECISION_INTERVAL) return;
  tickCounter = 0;

  const elapsed = gameTime - lastDecisionTime;
  lastDecisionTime = gameTime;
  if (elapsed <= 0) return;

  // ── Iteration 1: Refill APM budget ──
  refillAPM(elapsed);

  pruneDeadUnits(world);
  claimNewUnits(world);
  gatherIntelFromUnits(world);

  // Base defense check (B.1) — free, always runs (survival instinct)
  checkBaseUnderAttack(world, gameTime, map, resources);

  const diffConfig = DIFFICULTY_CONFIGS[currentDifficulty];

  // Macro management (idle workers, supply, worker production, tech buildings)
  runMacroManagement(world, map, resources, gameTime, spawnBuildingFn);

  // Rebuild critical buildings if destroyed
  checkCriticalBuildings(world, map, resources, spawnBuildingFn);

  // Attempt expansion after wave 5
  if (waveCount >= 5 && !hasExpanded) {
    attemptExpansion(resources, spawnBuildingFn);
  }

  // Emergency Overlord: prevent supply-lock outside build order
  const aiRes = resources[currentAIFaction];
  if (currentAIFaction === Faction.Zerg && aiRes) {
    if (aiRes.supplyProvided - aiRes.supplyUsed <= 2 && aiRes.supplyProvided < 200) {
      aiQueueUnit(world, UnitType.Overlord, resources);
    }
  }

  // Build order execution (runs first, takes priority)
  executeBuildOrder(world, resources, gameTime, spawnBuildingFn, map);

  // Spawn units (APM-gated, macro cost)
  const spawnsThisTick = Math.min(MAX_SPAWNS_PER_DECISION, 2 + Math.floor(waveCount / 2));
  for (let i = 0; i < spawnsThisTick; i++) {
    if (!spendAPM(APM_COST_MACRO)) break;
    trySpawnUnit(world, resources);
  }

  // Scouting (APM-gated)
  if (gameTime - lastScoutSendTime > SCOUT_INTERVAL && scoutEids.size < 2) {
    if (spendAPM(APM_COST_SCOUT)) {
      sendScout(world, map, gameTime);
    }
  }

  // ── Iteration 4: Adaptive strategy ──
  updateStrategy(world, gameTime);

  // Retreat check (before attack decision)
  if (isAttacking && !retreating) {
    checkRetreat(world, map, gameTime);
  }
  if (retreating) {
    checkRegroupComplete(world, gameTime, diffConfig.waveIntervalBase);
  }

  // B.2 — Vanguard map presence
  updateVanguard(world, map);

  // B.6 — Persistent harassment squads
  runHarassSquads(world, map);

  // Staging check: army gathers before attack launch
  checkStagingComplete(world, map, gameTime);

  // Attack or harass
  const prevWave = waveCount;
  if (!retreating && !isStaging) {
    decideAttack(world, map, gameTime, diffConfig);
    if (gameTime - lastHarassTime > HARASSMENT_INTERVALS[currentDifficulty] * personality.aggressionMult && !isAttacking && armyEids.size >= 3) {
      sendHarassment(world, map, gameTime);
    }
  }

  // B.8 — After wave 12: bonus Ultralisk per wave (queued through production)
  if (waveCount > prevWave && waveCount >= 12 && world.nextEid < MAX_ENTITIES - 50) {
    aiQueueUnit(world, UnitType.Ultralisk, resources);
  }

  // ── Iteration 2: Tactical micro (APM-gated) ──
  if (isAttacking || defenseEids.size > 0) {
    runTacticalMicro(world, map, gameTime);
  }

  // ── Iteration 3: Engagement positioning ──
  if (isAttacking) {
    runEngagementPositioning(world, map, gameTime);
  }

  // ── Iteration 5: Combat awareness ──
  if (isAttacking || defenseEids.size > 0) {
    runCombatAwareness(world, map, gameTime);
  }

  // Queen management (inject, positioning, auto-produce)
  manageQueens(world, gameTime, map);

  // B.7 — AI ability usage (APM-gated)
  runAIAbilities(world, gameTime);

  attemptAIUpgrade(resources, waveCount, diffConfig.upgradeStartWave);
  attemptAIUnitResearch(resources, cachedGameTime);
}

// ─────────────────────────────────────────
// Intel gathering (from what AI units can see)
// ─────────────────────────────────────────
function gatherIntelFromUnits(world: World): void {
  // Check what each Zerg unit can see
  intel.marineSeen = 0;
  intel.marauderSeen = 0;
  intel.tankSeen = 0;
  intel.medivacSeen = 0;
  intel.buildingsSeen = 0;

  // Collect all AI unit positions for sight checks
  const zergPositions: Array<{ x: number; y: number }> = [];
  for (const eid of armyEids) {
    if (entityExists(world, eid) && hpCurrent[eid] > 0) {
      zergPositions.push({ x: posX[eid], y: posY[eid] });
    }
  }
  for (const eid of scoutEids) {
    if (entityExists(world, eid) && hpCurrent[eid] > 0) {
      zergPositions.push({ x: posX[eid], y: posY[eid] });
    }
  }

  if (zergPositions.length === 0) return;

  const sightRange = 8 * TILE_SIZE; // 8 tiles sight
  const sightRangeSq = sightRange * sightRange;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH)) continue;
    if (faction[eid] !== enemyFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    const ex = posX[eid];
    const ey = posY[eid];

    // Check if any Zerg unit can see this entity
    let canSee = false;
    for (const zp of zergPositions) {
      const dx = ex - zp.x;
      const dy = ey - zp.y;
      if (dx * dx + dy * dy <= sightRangeSq) {
        canSee = true;
        break;
      }
    }
    if (!canSee) continue;

    // Record intel
    if (hasComponents(world, eid, BUILDING)) {
      intel.buildingsSeen++;
      intel.lastKnownEnemyX = ex;
      intel.lastKnownEnemyY = ey;
      intel.hasScoutedBase = true;
    } else if (hasComponents(world, eid, UNIT_TYPE)) {
      const ut = unitType[eid] as UnitType;
      switch (ut) {
        case UnitType.Marine: intel.marineSeen++; break;
        case UnitType.Marauder: intel.marauderSeen++; break;
        case UnitType.SiegeTank: intel.tankSeen++; break;
        case UnitType.Medivac: intel.medivacSeen++; break;
      }
      intel.lastKnownEnemyX = ex;
      intel.lastKnownEnemyY = ey;
    }
  }
}

// ─────────────────────────────────────────
// Reactive composition (counter what we've scouted)
// ─────────────────────────────────────────
function getReactiveWeights(): Array<{ type: UnitType; costM: number; costG: number; weight: number }> {
  const base = getPhaseWeights();

  // No intel yet — use base weights
  const totalSeen = intel.marineSeen + intel.marauderSeen + intel.tankSeen + intel.medivacSeen;
  if (totalSeen === 0) return base;

  // Adjust weights based on what we've seen
  const weights = base.map(u => ({ ...u }));

  for (const w of weights) {
    switch (w.type) {
      case UnitType.Baneling:
        // Banelings counter Marines (high DPS splash vs bio)
        if (intel.marineSeen > 3) w.weight += 25;
        break;
      case UnitType.Roach:
        // Roaches counter Marauders (tanky, absorb concussive)
        if (intel.marauderSeen > 2) w.weight += 15;
        break;
      case UnitType.Hydralisk:
        // Hydralisks counter Medivacs (ranged AA) and Tanks (outrange in unsieged)
        if (intel.medivacSeen > 0 || intel.tankSeen > 0) w.weight += 20;
        break;
      case UnitType.Zergling:
        // Zerglings are good for surrounding tanks, less good vs bio ball
        if (intel.tankSeen > 1 && intel.marineSeen < 3) w.weight += 10;
        if (intel.marineSeen > 5) w.weight = Math.max(5, w.weight - 15);
        break;
    }
  }

  return weights;
}

function getPhaseWeights() {
  const phase = getPhase();
  switch (phase) {
    case AIPhase.EarlyGame: return [...EARLY_GAME_UNITS];
    case AIPhase.MidGame: return [...MID_GAME_UNITS];
    case AIPhase.LateGame:
      // Ultralisk only available after wave 8
      return waveCount >= 8
        ? [...LATE_GAME_UNITS]
        : LATE_GAME_UNITS.filter(u => u.type !== UnitType.Ultralisk);
  }
}

// ─────────────────────────────────────────
// Scouting
// ─────────────────────────────────────────
function sendScout(world: World, map: MapData, gameTime: number): void {
  lastScoutSendTime = gameTime;

  // Pick a Zergling from the army to send scouting
  let scoutEid = 0;
  for (const eid of armyEids) {
    if (unitType[eid] === UnitType.Zergling && entityExists(world, eid) && hpCurrent[eid] > 0) {
      scoutEid = eid;
      break;
    }
  }
  if (scoutEid === 0) return;

  armyEids.delete(scoutEid);
  scoutEids.add(scoutEid);

  // Pick a random scout waypoint
  const wp = SCOUT_WAYPOINTS[rng.nextInt(SCOUT_WAYPOINTS.length)];
  const dest = tileToWorld(wp.col, wp.row);

  commandMode[scoutEid] = CommandMode.AttackMove;
  pathTo(scoutEid, dest.x, dest.y, map);
}

// ─────────────────────────────────────────
// Retreat logic
// ─────────────────────────────────────────
function checkRetreat(world: World, map: MapData, gameTime: number): void {
  let totalHp = 0;
  let totalMaxHp = 0;
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    totalHp += hpCurrent[eid];
    totalMaxHp += hpMax[eid];
  }
  if (totalMaxHp === 0) return;

  const ratio = totalHp / totalMaxHp;
  if (ratio < RETREAT_HP_RATIO && armyEids.size > 2) {
    retreating = true;
    isAttacking = false;
    lastRetreatTime = gameTime;

    // Regroup near Hatchery
    const hatch = findZergHatchery(world);
    if (hatch > 0) {
      regroupX = posX[hatch];
      regroupY = posY[hatch];
    } else {
      const base = tileToWorld(AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW);
      regroupX = base.x;
      regroupY = base.y;
    }

    // Send all army units back
    for (const eid of armyEids) {
      if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
      commandMode[eid] = CommandMode.Move;
      pathTo(eid, regroupX, regroupY, map);
    }
  }
}

function checkRegroupComplete(world: World, gameTime: number, waveIntervalBase: number): void {
  // Enforce minimum regroup time after a retreat
  if (gameTime < lastRetreatTime + RETREAT_MIN_REGROUP_TIME) return;

  // Check if most units have returned near base
  let nearBase = 0;
  let total = 0;
  const rangeSq = (10 * TILE_SIZE) * (10 * TILE_SIZE);

  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    total++;
    const dx = posX[eid] - regroupX;
    const dy = posY[eid] - regroupY;
    if (dx * dx + dy * dy < rangeSq) nearBase++;
  }

  if (total === 0) {
    retreating = false;
    attackEndTime = lastDecisionTime;
    return;
  }

  // Also require army is at least 50% rebuilt (measured by count vs wave size target)
  const targetSize = Math.min(
    Math.floor((FIRST_WAVE_SIZES[currentDifficulty] + waveCount * WAVE_SIZE_GROWTH) * personality.aggressionMult),
    MAX_WAVE_SIZE,
  );
  const rebuiltRatio = total > 0 ? armyEids.size / Math.max(1, targetSize) : 0;

  if (nearBase >= total * 0.6 && rebuiltRatio >= RETREAT_REBUILT_RATIO) {
    retreating = false;
    attackEndTime = lastDecisionTime; // Reset wave cooldown timer
  }
}

// ─────────────────────────────────────────
// Focus fire (coordinate damage on priority targets)
// ─────────────────────────────────────────
function assignFocusTargets(world: World): void {
  // Find priority targets near our army: Medivacs > Siege Tanks > Marauders > Marines
  const enemyTargets: Array<{ eid: number; priority: number }> = [];
  const armyCenter = getArmyCenter(world);
  if (!armyCenter) return;

  const scanRange = 12 * TILE_SIZE;
  const scanRangeSq = scanRange * scanRange;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH | UNIT_TYPE)) continue;
    if (faction[eid] !== enemyFaction) continue;
    if (hpCurrent[eid] <= 0) continue;

    const dx = posX[eid] - armyCenter.x;
    const dy = posY[eid] - armyCenter.y;
    if (dx * dx + dy * dy > scanRangeSq) continue;

    const ut = unitType[eid] as UnitType;
    let priority = 1;
    switch (ut) {
      case UnitType.Medivac: priority = 5; break;   // Kill healers first
      case UnitType.SiegeTank: priority = 4; break;  // Then big damage
      case UnitType.Marine: priority = 3; break;      // Then DPS
      case UnitType.Marauder: priority = 2; break;    // Then tanky
      default: priority = 1;
    }
    enemyTargets.push({ eid, priority });
  }

  if (enemyTargets.length === 0) return;

  // Sort by priority descending
  enemyTargets.sort((a, b) => b.priority - a.priority);

  // Assign units across top 3 priority targets to avoid overkill
  const topTargets = enemyTargets.slice(0, Math.min(3, enemyTargets.length));
  let targetIdx = 0;
  // Track committed damage per target to distribute evenly
  const committed = new Map<number, number>();
  for (const t of topTargets) committed.set(t.eid, 0);

  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    // Only override if unit doesn't already have a valid target
    if (targetEntity[eid] >= 1 && entityExists(world, targetEntity[eid]) && hpCurrent[targetEntity[eid]] > 0) {
      continue;
    }
    // Pick the target with least committed damage relative to HP
    let bestTgt = topTargets[0].eid;
    let bestRatio = Infinity;
    for (const t of topTargets) {
      const ratio = (committed.get(t.eid) ?? 0) / Math.max(1, hpCurrent[t.eid]);
      if (ratio < bestRatio) {
        bestRatio = ratio;
        bestTgt = t.eid;
      }
    }
    targetEntity[eid] = bestTgt;
    committed.set(bestTgt, (committed.get(bestTgt) ?? 0) + atkDamage[eid]);
    targetIdx++;
  }
}

function getArmyCenter(world: World): { x: number; y: number } | null {
  let sumX = 0, sumY = 0, count = 0;
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    sumX += posX[eid];
    sumY += posY[eid];
    count++;
  }
  if (count === 0) return null;
  return { x: sumX / count, y: sumY / count };
}

// ─────────────────────────────────────────
// Attack target selection (fog-aware, uses intel)
// ─────────────────────────────────────────
function findAttackTarget(world: World): { x: number; y: number } {
  // Priority 1: Use last known enemy position from scouting
  if (intel.lastKnownEnemyX >= 0 && intel.hasScoutedBase) {
    return { x: intel.lastKnownEnemyX, y: intel.lastKnownEnemyY };
  }

  // Priority 2: Check if any AI unit can currently SEE an enemy building
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    // Look for visible enemy buildings near this unit
    for (let other = 1; other < world.nextEid; other++) {
      if (!hasComponents(world, other, POSITION | BUILDING)) continue;
      if (faction[other] !== enemyFaction) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - posX[eid];
      const dy = posY[other] - posY[eid];
      if (dx * dx + dy * dy < (10 * TILE_SIZE) * (10 * TILE_SIZE)) {
        return { x: posX[other], y: posY[other] };
      }
    }
    break; // Only check from one unit to avoid O(n^2)
  }

  // Priority 3: Attack the most likely player base location (starting area)
  const fallback = tileToWorld(playerBaseTile.col, playerBaseTile.row);
  return { x: fallback.x, y: fallback.y };
}

// ─────────────────────────────────────────
// Varied attack angles
// ─────────────────────────────────────────
function pickAttackAngle(targetX: number, targetY: number, map: MapData): { x: number; y: number } {
  // Randomly offset the approach angle to vary attack paths
  const angle = rng.next() * Math.PI * 2;
  const offsetDist = 4 * TILE_SIZE; // 4 tiles offset from direct path
  const offsetX = Math.cos(angle) * offsetDist;
  const offsetY = Math.sin(angle) * offsetDist;

  // Create a waypoint offset from the target
  let waypointX = targetX + offsetX;
  let waypointY = targetY + offsetY;

  // Clamp to map bounds
  waypointX = Math.max(TILE_SIZE * 2, Math.min((MAP_COLS - 2) * TILE_SIZE, waypointX));
  waypointY = Math.max(TILE_SIZE * 2, Math.min((MAP_ROWS - 2) * TILE_SIZE, waypointY));

  return { x: waypointX, y: waypointY };
}

// ─────────────────────────────────────────
// Core functions
// ─────────────────────────────────────────
function pruneDeadUnits(world: World): void {
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) armyEids.delete(eid);
  }
  for (const eid of harassEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) harassEids.delete(eid);
  }
  for (const eid of scoutEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) scoutEids.delete(eid);
  }
  // B.6 — Prune persistent harass squads
  for (const eid of harassSquad1) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) harassSquad1.delete(eid);
  }
  for (const eid of harassSquad2) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) harassSquad2.delete(eid);
  }
  // B.1 — Prune defense group
  for (const eid of defenseEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) defenseEids.delete(eid);
  }
  // B.2 — Prune vanguard
  for (const eid of vanguardEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) vanguardEids.delete(eid);
  }
  // Prune queens
  for (const eid of queenEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) queenEids.delete(eid);
  }
  if (isAttacking && armyEids.size === 0) {
    isAttacking = false;
    attackEndTime = lastDecisionTime;
  }
}

// ─────────────────────────────────────────
// AI auto-upgrade (Zerg, after wave 3)
// ─────────────────────────────────────────
// ─────────────────────────────────────────
// Expansion logic
// ─────────────────────────────────────────
const EXPANSION_LOCATIONS = [
  { col: 100, row: 110 },  // natural
  { col: 15, row: 100 },   // 3rd base
  { col: 80, row: 80 },    // 4th base
];

function attemptExpansion(
  resources: Record<number, PlayerResources>,
  spawnBuilding: SpawnBuildingFn,
): boolean {
  if (expansionCount >= EXPANSION_LOCATIONS.length) return false;

  const res = resources[currentAIFaction];
  if (!res || res.minerals < 300) return false;

  const loc = EXPANSION_LOCATIONS[expansionCount];
  res.minerals -= 300;
  spawnBuilding(BuildingType.Hatchery, currentAIFaction, loc.col, loc.row);
  expansionCount++;
  hasExpanded = true;
  return true;
}

function attemptAIUpgrade(resources: Record<number, PlayerResources>, waveCount: number, upgradeStartWave: number): void {
  if (waveCount < upgradeStartWave) return;
  // B.8 — After wave 8: upgrade every wave instead of every 2
  const upgradeInterval = waveCount >= 8 ? 1 : 2;
  if (waveCount - lastAIUpgradeWave < upgradeInterval) return;

  const res = resources[currentAIFaction];
  if (!res) return;

  const upgradeType = nextAIUpgradeType as UpgradeType;
  const currentLevel = res.upgrades[upgradeType];
  if (currentLevel >= 3) {
    // This track maxed — try next
    nextAIUpgradeType = ((nextAIUpgradeType - 3 + 1) % 3) + 3;
    return;
  }

  // Cost check (simplified: 100m per upgrade)
  if (res.minerals < 100) return;
  res.minerals -= 100;

  res.upgrades[upgradeType] = Math.min(3, currentLevel + 1) as 0 | 1 | 2 | 3;
  lastAIUpgradeWave = waveCount;
  nextAIUpgradeType = ((nextAIUpgradeType - 3 + 1) % 3) + 3;
}

/** AI auto-researches unit-specific upgrades at appropriate timings */
function attemptAIUnitResearch(resources: Record<number, PlayerResources>, gameTime: number): void {
  const res = resources[currentAIFaction];
  if (!res) return;
  const isTerran = currentAIFaction === Faction.Terran;
  const isZerg = currentAIFaction === Faction.Zerg;

  // Terran: Stim@120s, ConcShells@150s, SiegeTech@180s, CombatShield@200s
  if (isTerran) {
    if (gameTime >= 120 && !res.upgrades[UpgradeType.StimPack] && res.minerals >= 100 && res.gas >= 100) {
      res.upgrades[UpgradeType.StimPack] = 1; res.minerals -= 100; res.gas -= 100;
    }
    if (gameTime >= 150 && !res.upgrades[UpgradeType.ConcussiveShells] && res.minerals >= 50 && res.gas >= 50) {
      res.upgrades[UpgradeType.ConcussiveShells] = 1; res.minerals -= 50; res.gas -= 50;
    }
    if (gameTime >= 180 && !res.upgrades[UpgradeType.SiegeTech] && res.minerals >= 100 && res.gas >= 100) {
      res.upgrades[UpgradeType.SiegeTech] = 1; res.minerals -= 100; res.gas -= 100;
    }
    if (gameTime >= 200 && !res.upgrades[UpgradeType.CombatShield] && res.minerals >= 100 && res.gas >= 100) {
      res.upgrades[UpgradeType.CombatShield] = 1; res.minerals -= 100; res.gas -= 100;
    }
  }
  // Zerg: MetabolicBoost@90s, GroovedSpines@200s, MuscularAugments@220s, AdrenalGlands@300s
  if (isZerg) {
    if (gameTime >= 90 && !res.upgrades[UpgradeType.MetabolicBoost] && res.minerals >= 100 && res.gas >= 100) {
      res.upgrades[UpgradeType.MetabolicBoost] = 1; res.minerals -= 100; res.gas -= 100;
    }
    if (gameTime >= 200 && !res.upgrades[UpgradeType.GroovedSpines] && res.minerals >= 100 && res.gas >= 100) {
      res.upgrades[UpgradeType.GroovedSpines] = 1; res.minerals -= 100; res.gas -= 100;
    }
    if (gameTime >= 220 && !res.upgrades[UpgradeType.MuscularAugments] && res.minerals >= 100 && res.gas >= 100) {
      res.upgrades[UpgradeType.MuscularAugments] = 1; res.minerals -= 100; res.gas -= 100;
    }
    if (gameTime >= 300 && !res.upgrades[UpgradeType.AdrenalGlands] && res.minerals >= 200 && res.gas >= 200) {
      res.upgrades[UpgradeType.AdrenalGlands] = 1; res.minerals -= 200; res.gas -= 200;
    }
  }
}

const enum AIPhase {
  EarlyGame = 0,
  MidGame = 1,
  LateGame = 2,
}

function getPhase(): AIPhase {
  const gt = cachedGameTime;
  if (gt < 180) return AIPhase.EarlyGame;      // First 3 minutes
  if (gt < 420) return AIPhase.MidGame;         // 3-7 minutes
  return AIPhase.LateGame;                       // 7+ minutes
}

const EARLY_GAME_UNITS = [
  { type: UnitType.Zergling, costM: 25, costG: 0, weight: 70 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 30 },
];
const MID_GAME_UNITS = [
  { type: UnitType.Zergling, costM: 25, costG: 0, weight: 30 },
  { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 25 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 25 },
  { type: UnitType.Baneling, costM: 25, costG: 25, weight: 15 },
  { type: UnitType.Ravager, costM: 25, costG: 75, weight: 8 },
  { type: UnitType.Mutalisk, costM: 100, costG: 100, weight: 5 },
];
const LATE_GAME_UNITS = [
  { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 30 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 25 },
  { type: UnitType.Baneling, costM: 25, costG: 25, weight: 20 },
  { type: UnitType.Zergling, costM: 25, costG: 0, weight: 15 },
  { type: UnitType.Mutalisk, costM: 100, costG: 100, weight: 10 },
  { type: UnitType.Ravager, costM: 25, costG: 75, weight: 8 },
  { type: UnitType.Corruptor, costM: 150, costG: 100, weight: 6 },
  { type: UnitType.Ultralisk, costM: 300, costG: 200, weight: 5 },
  { type: UnitType.Infestor, costM: 100, costG: 150, weight: 3 },
  { type: UnitType.Viper, costM: 100, costG: 200, weight: 3 },
];

function findZergHatchery(world: World): number {
  const bits = POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== Faction.Zerg) continue;
    if (!isHatchType(buildingType[eid])) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;
    return eid;
  }
  return 0;
}

function countArmyComposition(world: World): Map<UnitType, number> {
  const counts = new Map<UnitType, number>();
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    const ut = unitType[eid] as UnitType;
    counts.set(ut, (counts.get(ut) || 0) + 1);
  }
  return counts;
}

function findMostNeededUnit(
  target: CompositionTarget,
  current: Map<UnitType, number>,
  resources: Record<number, PlayerResources>,
): UnitType | null {
  let bestType: UnitType | null = null;
  let bestDeficit = -Infinity;
  const res = resources[currentAIFaction];
  if (!res) return null;

  for (const entry of target.units) {
    const have = current.get(entry.type) || 0;
    const want = Math.max(entry.minCount || 0, Math.round(target.targetArmySize * entry.ratio));
    const deficit = want - have;
    if (deficit <= bestDeficit) continue;

    // Check affordability
    const def = UNIT_DEFS[entry.type];
    if (!def) continue;
    if (res.minerals >= def.costMinerals && res.gas >= def.costGas) {
      bestDeficit = deficit;
      bestType = entry.type;
    }
  }
  return bestType;
}

function isArmyReady(world: World, threshold: number = 0.7): boolean {
  if (!activeComposition) return armyEids.size >= 4; // fallback
  const current = countArmyComposition(world);
  let totalHave = 0;
  let totalWant = 0;
  for (const entry of activeComposition.units) {
    const have = current.get(entry.type) || 0;
    const want = Math.max(entry.minCount || 0, Math.round(activeComposition.targetArmySize * entry.ratio));
    totalHave += Math.min(have, want);
    totalWant += want;
  }
  return totalWant > 0 && (totalHave / totalWant) >= threshold;
}

function trySpawnUnit(world: World, resources: Record<number, PlayerResources>): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  // Composition targeting: build toward the active composition target
  if (activeComposition) {
    const current = countArmyComposition(world);
    const needed = findMostNeededUnit(activeComposition, current, resources);
    if (needed) {
      aiQueueUnit(world, needed, resources);
      return;
    }
  }

  // Fallback: Strategy-driven composition, then reactive, then phase weights
  const stratWeights = getStrategyWeights();
  const options = stratWeights ?? getReactiveWeights();
  const totalWeight = options.reduce((s, o) => s + o.weight, 0);
  let roll = rng.next() * totalWeight;
  let chosen = options[0];

  for (const opt of options) {
    roll -= opt.weight;
    if (roll <= 0) { chosen = opt; break; }
  }

  // aiQueueUnit handles resource check, deduction, larva, and production queue
  aiQueueUnit(world, chosen.type, resources);
}

function decideAttack(world: World, map: MapData, gameTime: number, diffConfig: { waveIntervalBase: number; armySizeCapMultiplier: number }): void {
  if (isAttacking) {
    // During active attack, apply focus fire
    assignFocusTargets(world);
    return;
  }

  if (attackEndTime > 0 && gameTime - attackEndTime < diffConfig.waveIntervalBase) return;

  // B.5 — Reactive Intel-Driven Response
  const threat = estimateThreatLevel(world);
  if (threat > 1.5) {
    // Defensive: don't attack, hold army near base
    shouldAttackWhenReady = false;
    return;
  }

  // Composition-based readiness check (primary attack decision)
  if (shouldAttackWhenReady && isArmyReady(world, 0.7)) {
    // Build order triggered attack and army is 70%+ ready — go!
    shouldAttackWhenReady = false;
  } else if (shouldAttackWhenReady) {
    // Build order wants attack but army not ready yet — wait
    return;
  } else {
    // Autonomous attack logic (after build order exhausted)
    const effectiveMaxWaveSize = waveCount >= 8 ? Math.floor(MAX_WAVE_SIZE * 1.5) : MAX_WAVE_SIZE;
    const armySizeCap = Math.floor(effectiveMaxWaveSize * diffConfig.armySizeCapMultiplier);
    const threshold = Math.min(
      Math.floor((FIRST_WAVE_SIZES[currentDifficulty] + waveCount * WAVE_SIZE_GROWTH) * personality.aggressionMult),
      armySizeCap,
    );

    const timingBonus = currentStrategy === 'timing-attack' ? 0.6 : 1.0;
    const economyPunishBonus = currentStrategy === 'economy-punish' ? 0.7 : 1.0;
    const adjustedThreshold = Math.floor(threshold * timingBonus * economyPunishBonus);

    // Check composition readiness OR raw army size
    const compositionReady = isArmyReady(world, 0.7);
    const sizeReady = armyEids.size >= adjustedThreshold;
    const opportunistic = threat < 0.7 && armyEids.size >= Math.floor(adjustedThreshold * 0.5);
    if (!compositionReady && !sizeReady && !opportunistic) return;
  }

  // APM-gated: committing to an attack wave costs action points
  if (!spendAPM(APM_COST_ATTACK_DECISION)) return;

  // B.2 — Merge vanguard back into attack force
  mergeVanguardIntoArmy();

  // Launch wave!
  retreating = false;
  waveCount++;

  // Grow composition target for escalating waves
  if (activeComposition) {
    activeComposition.targetArmySize = Math.min(activeComposition.targetArmySize + 8, 60);
  }

  const target = findAttackTarget(world);

  // Small armies (< 6) skip staging for responsiveness
  if (armyEids.size < 6) {
    isAttacking = true;
    const angle = pickAttackAngle(target.x, target.y, map);
    sendUnitsToAttack(world, map, armyEids, target.x, target.y, angle);
    return;
  }

  // Enter staging phase: gather army at staging point before attack
  isStaging = true;
  stagingStartTime = gameTime;
  // Staging point: halfway between AI base and target
  const hatch = findZergHatchery(world);
  const baseX = hatch > 0 ? posX[hatch] : AI_SPAWN_BASE_COL * TILE_SIZE;
  const baseY = hatch > 0 ? posY[hatch] : AI_SPAWN_BASE_ROW * TILE_SIZE;
  stagingX = (baseX + target.x) / 2;
  stagingY = (baseY + target.y) / 2;
  // Send army to staging point with attack-move
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    commandMode[eid] = CommandMode.AttackMove;
    const startTile = worldToTile(posX[eid], posY[eid]);
    const endTile = worldToTile(stagingX, stagingY);
    const tilePath = findPath(currentMap!, startTile.col, startTile.row, endTile.col, endTile.row);
    if (tilePath.length > 0) {
      const wp: Array<[number, number]> = tilePath.map(([c, r]) => {
        const p = tileToWorld(c, r);
        return [p.x, p.y] as [number, number];
      });
      setPath(eid, wp);
    }
  }
}

/** Check staging completion and launch the actual attack */
function checkStagingComplete(world: World, map: MapData, gameTime: number): void {
  if (!isStaging) return;

  // Count how many army units are near staging point
  let nearCount = 0;
  let totalAlive = 0;
  const stagingRangeSq = (6 * TILE_SIZE) * (6 * TILE_SIZE);
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    totalAlive++;
    const dx = posX[eid] - stagingX;
    const dy = posY[eid] - stagingY;
    if (dx * dx + dy * dy <= stagingRangeSq) nearCount++;
  }

  const percentStaged = totalAlive > 0 ? nearCount / totalAlive : 0;
  const timeout = gameTime - stagingStartTime > 5;

  if (percentStaged >= 0.7 || timeout) {
    // Launch attack from staging point
    isStaging = false;
    isAttacking = true;
    const target = findAttackTarget(world);
    if (currentDifficulty >= Difficulty.Hard) {
      sendDifficultyMultiProngAttack(world, map, target.x, target.y);
    } else if (armyEids.size >= 10 && rng.next() < 0.3) {
      sendMultiProngAttack(world, map, target.x, target.y);
    } else {
      const angle = pickAttackAngle(target.x, target.y, map);
      sendUnitsToAttack(world, map, armyEids, target.x, target.y, angle);
    }
  }
}

function sendMultiProngAttack(world: World, map: MapData, targetX: number, targetY: number): void {
  const group1: number[] = [];
  const group2: number[] = [];
  let i = 0;

  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    if (i % 2 === 0) group1.push(eid);
    else group2.push(eid);
    i++;
  }

  const angle1 = pickAttackAngle(targetX, targetY, map);
  const angle2 = pickAttackAngle(targetX, targetY, map);

  const set1 = new Set(group1);
  const set2 = new Set(group2);
  sendUnitsToAttack(world, map, set1, targetX, targetY, angle1);
  sendUnitsToAttack(world, map, set2, targetX, targetY, angle2);
}

// Hard/Brutal multi-prong: 70% main force on primary target, 30% harass squad on alternate entry
function sendDifficultyMultiProngAttack(world: World, map: MapData, targetX: number, targetY: number): void {
  const all: number[] = [];
  for (const eid of armyEids) {
    if (entityExists(world, eid) && hpCurrent[eid] > 0) all.push(eid);
  }

  const harassCount = Math.max(3, Math.floor(all.length * 0.3));
  const mainCount = all.length - harassCount;

  // Shuffle to avoid always picking the same units for harass
  for (let i = all.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }

  const mainForce = new Set(all.slice(0, mainCount));
  const harassSquad = new Set(all.slice(mainCount));

  const mainAngle = pickAttackAngle(targetX, targetY, map);
  sendUnitsToAttack(world, map, mainForce, targetX, targetY, mainAngle);

  // Harass squad attacks the alternate entry point (far side of map)
  const harassTile = getHarassTarget();
  const harassWorld = tileToWorld(harassTile.col, harassTile.row);
  sendUnitsToAttack(world, map, harassSquad, harassWorld.x, harassWorld.y);
}

function sendHarassment(world: World, map: MapData, gameTime: number): void {
  lastHarassTime = gameTime;

  const harassCount = Math.min(4, armyEids.size);
  let picked = 0;
  const toSend: number[] = [];

  for (const eid of armyEids) {
    if (picked >= harassCount) break;
    if (unitType[eid] === UnitType.Zergling && entityExists(world, eid) && hpCurrent[eid] > 0) {
      toSend.push(eid);
      picked++;
    }
  }

  if (toSend.length < 2) return;

  for (const eid of toSend) {
    armyEids.delete(eid);
    harassEids.add(eid);
  }

  const target = findAttackTarget(world);
  const harassSet = new Set(toSend);
  sendUnitsToAttack(world, map, harassSet, target.x, target.y);
}

function sendUnitsToAttack(
  world: World,
  map: MapData,
  units: Set<number>,
  targetX: number,
  targetY: number,
  waypoint?: { x: number; y: number },
): void {
  const cols = Math.ceil(Math.sqrt(units.size));
  const spacing = TILE_SIZE * 0.8;
  let i = 0;

  for (const eid of units) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;

    const row = Math.floor(i / cols);
    const col = i % cols;
    const offsetX = (col - (cols - 1) / 2) * spacing;
    const offsetY = (row - Math.floor(units.size / cols - 1) / 2) * spacing;
    i++;

    commandMode[eid] = CommandMode.AttackMove;

    if (waypoint) {
      // Route through waypoint then to target
      pathTo(eid, waypoint.x + offsetX, waypoint.y + offsetY, map);
    } else {
      pathTo(eid, targetX + offsetX, targetY + offsetY, map);
    }
  }
}

// ═══════════════════════════════════════════
// ITERATION 2: Tactical Micro Behaviors
// ═══════════════════════════════════════════
function runTacticalMicro(world: World, map: MapData, gameTime: number): void {
  // Only run micro for difficulties that have APM budget for it
  if (currentDifficulty === Difficulty.Easy) return;

  const activeUnits = isAttacking ? armyEids : defenseEids;
  let microActions = 0;
  const maxMicroPerTick = currentDifficulty === Difficulty.Brutal ? 8 : currentDifficulty === Difficulty.Hard ? 4 : 2;

  for (const eid of activeUnits) {
    if (microActions >= maxMicroPerTick) break;
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;

    const ut = unitType[eid] as UnitType;

    // ── Ranged kiting (Hydralisks, Roaches) ──
    if ((ut === UnitType.Hydralisk || ut === UnitType.Roach) && atkRange[eid] > 0) {
      if (tryKiteBack(world, eid, map, gameTime)) {
        microActions++;
        continue;
      }
    }

    // ── Baneling target optimization ──
    if (ut === UnitType.Baneling) {
      if (tryBanelingClumpTarget(world, eid, map)) {
        microActions++;
        continue;
      }
    }

    // ── Zergling surround ──
    if (ut === UnitType.Zergling) {
      if (trySurroundTarget(world, eid, map)) {
        microActions++;
        continue;
      }
    }

    // ── Pull wounded units back (not Zerglings — expendable) ──
    if (ut !== UnitType.Zergling && ut !== UnitType.Baneling) {
      const hpRatio = hpCurrent[eid] / Math.max(1, hpMax[eid]);
      const pullThreshold = ut === UnitType.Roach ? ROACH_REGEN_PULL_RATIO : WOUNDED_PULL_RATIO;
      if (hpRatio < pullThreshold && hpRatio > 0) {
        if (tryPullBack(world, eid, map)) {
          microActions++;
          continue;
        }
      }
    }
  }
}

/** Ranged units stutter-step: attack then back off during cooldown */
function tryKiteBack(world: World, eid: number, map: MapData, gameTime: number): boolean {
  const tgtEid = targetEntity[eid];
  if (tgtEid < 1 || !entityExists(world, tgtEid) || hpCurrent[tgtEid] <= 0) return false;

  // Only kite if we recently attacked (within cooldown window)
  const cooldown = atkCooldown[eid] / 1000; // ms to seconds
  const timeSinceAttack = gameTime - atkLastTime[eid];
  if (timeSinceAttack < 0.05 || timeSinceAttack > cooldown * STUTTER_STEP_WINDOW) return false;

  if (!spendAPM(APM_COST_MICRO)) return false;

  // Move away from target
  const dx = posX[eid] - posX[tgtEid];
  const dy = posY[eid] - posY[tgtEid];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.01) return false;

  const kiteDistPx = atkRange[eid] + KITE_RANGE_BUFFER * TILE_SIZE;
  if (dist >= kiteDistPx) return false; // already at max range

  const nx = dx / dist;
  const ny = dy / dist;
  const retreatX = posX[eid] + nx * TILE_SIZE * 2;
  const retreatY = posY[eid] + ny * TILE_SIZE * 2;

  commandMode[eid] = CommandMode.AttackMove; // will re-engage after moving
  pathTo(eid, retreatX, retreatY, map);
  return true;
}

/** Banelings seek the densest enemy clump to maximize splash */
function tryBanelingClumpTarget(world: World, eid: number, map: MapData): boolean {
  let bestClump = 0;
  let bestX = 0, bestY = 0;
  const scanRange = 10 * TILE_SIZE;
  const scanRangeSq = scanRange * scanRange;
  const splashRange = 2 * TILE_SIZE;
  const splashRangeSq = splashRange * splashRange;

  // Find enemy with most nearby allies
  for (let other = 1; other < world.nextEid; other++) {
    if (!hasComponents(world, other, POSITION | HEALTH)) continue;
    if (faction[other] === currentAIFaction || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;

    const dx = posX[other] - posX[eid];
    const dy = posY[other] - posY[eid];
    if (dx * dx + dy * dy > scanRangeSq) continue;

    // Count enemies near this one using spatial hash
    let clumpCount = 1;
    const nearby = spatialHash.queryRadius(posX[other], posY[other], splashRange);
    for (const n of nearby) {
      if (n === other) continue;
      if (faction[n] === currentAIFaction || faction[n] === 0) continue;
      if (hpCurrent[n] <= 0) continue;
      clumpCount++;
    }

    if (clumpCount > bestClump) {
      bestClump = clumpCount;
      bestX = posX[other];
      bestY = posY[other];
    }
  }

  if (bestClump >= BANELING_CLUMP_THRESHOLD) {
    if (!spendAPM(APM_COST_MICRO)) return false;
    commandMode[eid] = CommandMode.AttackMove;
    pathTo(eid, bestX, bestY, map);
    return true;
  }
  return false;
}

/** Zerglings try to surround the target instead of a-moving head-on */
function trySurroundTarget(world: World, eid: number, map: MapData): boolean {
  const tgtEid = targetEntity[eid];
  if (tgtEid < 1 || !entityExists(world, tgtEid) || hpCurrent[tgtEid] <= 0) return false;

  const dx = posX[eid] - posX[tgtEid];
  const dy = posY[eid] - posY[tgtEid];
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Only surround when approaching (3-6 tiles out)
  if (dist < 2 * TILE_SIZE || dist > 6 * TILE_SIZE) return false;

  if (!spendAPM(APM_COST_MICRO)) return false;

  // Calculate angle to target and offset perpendicular
  const baseAngle = Math.atan2(dy, dx);
  const offset = (rng.next() > 0.5 ? 1 : -1) * (Math.PI * 0.5 + rng.next() * SURROUND_SPREAD_ANGLE);
  const surroundAngle = baseAngle + offset;

  // Move to a flanking position near the target
  const surroundDist = 1.5 * TILE_SIZE;
  const sx = posX[tgtEid] + Math.cos(surroundAngle) * surroundDist;
  const sy = posY[tgtEid] + Math.sin(surroundAngle) * surroundDist;

  commandMode[eid] = CommandMode.AttackMove;
  pathTo(eid, sx, sy, map);
  return true;
}

/** Pull a wounded unit back toward the nearest hatchery for regen */
function tryPullBack(world: World, eid: number, map: MapData): boolean {
  if (!spendAPM(APM_COST_MICRO)) return false;

  // Find safe point (hatchery or army center)
  const hatch = findZergHatchery(world);
  let safeX: number, safeY: number;
  if (hatch > 0) {
    safeX = posX[hatch];
    safeY = posY[hatch];
  } else {
    const center = getArmyCenter(world);
    if (!center) return false;
    safeX = center.x;
    safeY = center.y;
  }

  // Move toward safe point but not all the way — just behind the front line
  const dx = safeX - posX[eid];
  const dy = safeY - posY[eid];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 3 * TILE_SIZE) return false; // already near safe zone

  const pullDist = Math.min(4 * TILE_SIZE, dist * 0.5);
  const nx = dx / dist;
  const ny = dy / dist;

  commandMode[eid] = CommandMode.Move;
  pathTo(eid, posX[eid] + nx * pullDist, posY[eid] + ny * pullDist, map);
  return true;
}

// ═══════════════════════════════════════════
// ITERATION 3: Smart Engagement Decisions
// ═══════════════════════════════════════════
function runEngagementPositioning(world: World, map: MapData, _gameTime: number): void {
  if (currentDifficulty < Difficulty.Normal) return;

  const center = getArmyCenter(world);
  if (!center) return;

  // ── Pre-engagement: form concave before contact ──
  if (!hasEnemyContact(world)) {
    formConcave(world, map, center);
    return;
  }

  // ── During engagement: flank with fast units ──
  if (currentDifficulty >= Difficulty.Hard) {
    sendFlankingUnits(world, map);
  }

  // ── Disengage check: if we're losing badly, pull out ──
  const armyValue = calculateArmyValue(world, currentAIFaction);
  const enemyValue = calculateArmyValue(world, enemyFaction);
  if (enemyValue > 0 && armyValue / enemyValue < DISENGAGE_THRESHOLD && armyEids.size > 3) {
    if (currentMap) {
      // Force retreat
      checkRetreat(world, currentMap, _gameTime);
    }
  }
}

/** Check if any army unit is within engagement range of an enemy */
function hasEnemyContact(world: World): boolean {
  const contactRange = COORDINATED_ENGAGE_RANGE * TILE_SIZE;
  const contactRangeSq = contactRange * contactRange;

  let checked = 0;
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    for (let other = 1; other < world.nextEid; other++) {
      if (!hasComponents(world, other, POSITION | HEALTH)) continue;
      if (faction[other] === currentAIFaction || faction[other] === 0) continue;
      if (hpCurrent[other] <= 0) continue;
      const dx = posX[other] - posX[eid];
      const dy = posY[other] - posY[eid];
      if (dx * dx + dy * dy < contactRangeSq) return true;
    }
    if (++checked >= 3) break; // sample up to 3 units for accuracy
  }
  return false;
}

/** Form a concave arc facing the enemy before engaging */
function formConcave(world: World, map: MapData, center: { x: number; y: number }): void {
  // Find direction toward the nearest known enemy
  let enemyX = 0, enemyY = 0;
  let found = false;

  if (intel.lastKnownEnemyX >= 0) {
    enemyX = intel.lastKnownEnemyX;
    enemyY = intel.lastKnownEnemyY;
    found = true;
  }
  if (!found) {
    const target = tileToWorld(playerBaseTile.col, playerBaseTile.row);
    enemyX = target.x;
    enemyY = target.y;
  }

  const dx = enemyX - center.x;
  const dy = enemyY - center.y;
  const baseAngle = Math.atan2(dy, dx);
  const unitCount = armyEids.size;
  if (unitCount < 3) return;

  let i = 0;
  let actionsSpent = 0;
  const maxActions = currentDifficulty >= Difficulty.Hard ? 6 : 3;

  for (const eid of armyEids) {
    if (actionsSpent >= maxActions) break;
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    // Skip units already pathing
    if (movePathIndex[eid] >= 0) { i++; continue; }

    if (!spendAPM(APM_COST_MOVE_CMD)) break;

    // Arc from -60° to +60° relative to enemy direction
    const arcOffset = ((i / (unitCount - 1)) - 0.5) * Math.PI * CONCAVE_SPREAD * unitCount;
    const angle = baseAngle + arcOffset;
    const radius = 3 * TILE_SIZE; // formation radius from center
    const fx = center.x + Math.cos(angle + Math.PI) * radius; // behind center, facing enemy
    const fy = center.y + Math.sin(angle + Math.PI) * radius;

    commandMode[eid] = CommandMode.AttackMove;
    pathTo(eid, fx, fy, map);
    i++;
    actionsSpent++;
  }
}

/** Send fast units (Zerglings) to flank while main army engages head-on */
function sendFlankingUnits(world: World, map: MapData): void {
  if (armyEids.size < 8) return;

  const flankCount = Math.floor(armyEids.size * FLANK_SPLIT_RATIO);
  let flanked = 0;

  // Find enemy center
  let enemyX = 0, enemyY = 0, enemyCount = 0;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH)) continue;
    if (faction[eid] !== enemyFaction || hpCurrent[eid] <= 0) continue;
    enemyX += posX[eid];
    enemyY += posY[eid];
    enemyCount++;
    if (enemyCount > 10) break; // sample
  }
  if (enemyCount === 0) return;
  enemyX /= enemyCount;
  enemyY /= enemyCount;

  for (const eid of armyEids) {
    if (flanked >= flankCount) break;
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    const ut = unitType[eid] as UnitType;
    if (ut !== UnitType.Zergling) continue; // only fast units flank
    if (movePathIndex[eid] >= 0) continue; // already pathing

    if (!spendAPM(APM_COST_MOVE_CMD)) break;

    // Flank: approach from 90° offset
    const center = getArmyCenter(world);
    if (!center) break;
    const dx = enemyX - center.x;
    const dy = enemyY - center.y;
    const baseAngle = Math.atan2(dy, dx);
    const flankSide = flanked % 2 === 0 ? 1 : -1;
    const flankAngle = baseAngle + flankSide * (Math.PI * 0.5);

    const flankX = enemyX + Math.cos(flankAngle) * 4 * TILE_SIZE;
    const flankY = enemyY + Math.sin(flankAngle) * 4 * TILE_SIZE;

    commandMode[eid] = CommandMode.AttackMove;
    pathTo(eid, flankX, flankY, map);
    flanked++;
  }
}

/** Calculate combined army value (HP * damage) for a faction */
function calculateArmyValue(world: World, fac: number): number {
  let value = 0;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, POSITION | HEALTH)) continue;
    if (faction[eid] !== fac || hpCurrent[eid] <= 0) continue;
    if (hasComponents(world, eid, BUILDING)) continue; // skip buildings
    value += hpCurrent[eid] * Math.max(1, atkDamage[eid]);
  }
  return value;
}

// ═══════════════════════════════════════════
// ITERATION 4: Adaptive Strategy & Tech Switching
// ═══════════════════════════════════════════
function updateStrategy(world: World, gameTime: number): void {
  if (currentDifficulty < Difficulty.Normal) return;
  if (gameTime - lastTechSwitchTime < TECH_SWITCH_COOLDOWN) return;

  const totalSeen = intel.marineSeen + intel.marauderSeen + intel.tankSeen + intel.medivacSeen;
  if (totalSeen === 0) return;

  const oldStrategy = currentStrategy;
  const bioRatio = (intel.marineSeen + intel.medivacSeen) / Math.max(1, totalSeen);
  const mechRatio = (intel.tankSeen) / Math.max(1, totalSeen);

  // ── Detect player expanding (buildings scouted in non-base location) ──
  if (intel.buildingsSeen > 2 && waveCount <= 3 && currentStrategy !== 'timing-attack') {
    currentStrategy = 'timing-attack';
  }
  // ── Heavy bio → Banelings + splash ──
  else if (bioRatio > 0.6 && intel.marineSeen >= 5) {
    currentStrategy = 'anti-bio';
  }
  // ── Heavy mech → Zergling runby + Hydra range ──
  else if (mechRatio > 0.3 && intel.tankSeen >= 2) {
    currentStrategy = 'anti-mech';
  }
  // ── Economy punishment (few army units scouted, they're greedy) ──
  else if (totalSeen < 4 && waveCount >= 2) {
    currentStrategy = 'economy-punish';
  }
  else {
    currentStrategy = 'standard';
  }

  if (currentStrategy !== oldStrategy) {
    lastTechSwitchTime = gameTime;
    strategySetTime = gameTime;

    // Update composition target for counter-strategies
    switch (currentStrategy) {
      case 'anti-bio':
        activeComposition = {
          units: [
            { type: UnitType.Baneling, ratio: 0.4, minCount: 4 },
            { type: UnitType.Hydralisk, ratio: 0.3, minCount: 3 },
            { type: UnitType.Roach, ratio: 0.2, minCount: 2 },
            { type: UnitType.Zergling, ratio: 0.1 },
          ],
          targetArmySize: activeComposition?.targetArmySize ?? 30,
        };
        break;
      case 'anti-mech':
        activeComposition = {
          units: [
            { type: UnitType.Zergling, ratio: 0.35, minCount: 6 },
            { type: UnitType.Hydralisk, ratio: 0.3, minCount: 3 },
            { type: UnitType.Ravager, ratio: 0.2, minCount: 2 },
            { type: UnitType.Roach, ratio: 0.15 },
          ],
          targetArmySize: activeComposition?.targetArmySize ?? 30,
        };
        break;
      case 'timing-attack':
        activeComposition = {
          units: [
            { type: UnitType.Zergling, ratio: 0.5, minCount: 6 },
            { type: UnitType.Roach, ratio: 0.3, minCount: 3 },
            { type: UnitType.Baneling, ratio: 0.2, minCount: 2 },
          ],
          targetArmySize: activeComposition?.targetArmySize ?? 20,
        };
        break;
      // standard and economy-punish keep the build order's composition
    }
  }
}

/** Get strategy-adjusted unit weights — overrides reactive weights when strategy is active */
function getStrategyWeights(): Array<{ type: UnitType; costM: number; costG: number; weight: number }> | null {
  switch (currentStrategy) {
    case 'anti-bio':
      // Mass Banelings + Hydras to counter Marines
      return [
        { type: UnitType.Baneling, costM: 25, costG: 25, weight: 40 },
        { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 25 },
        { type: UnitType.Roach, costM: 75, costG: 25, weight: 15 },
        { type: UnitType.Zergling, costM: 25, costG: 0, weight: 10 },
        { type: UnitType.Mutalisk, costM: 100, costG: 100, weight: 10 },
      ];

    case 'anti-mech':
      // Zergling swarm (surround tanks) + Hydras (outrange unsieged)
      return [
        { type: UnitType.Zergling, costM: 25, costG: 0, weight: 35 },
        { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 25 },
        { type: UnitType.Ravager, costM: 25, costG: 75, weight: 15 },
        { type: UnitType.Roach, costM: 75, costG: 25, weight: 15 },
        { type: UnitType.Mutalisk, costM: 100, costG: 100, weight: 10 },
      ];

    case 'timing-attack':
      // Cheap, fast army for immediate aggression
      return [
        { type: UnitType.Zergling, costM: 25, costG: 0, weight: 50 },
        { type: UnitType.Roach, costM: 75, costG: 25, weight: 30 },
        { type: UnitType.Baneling, costM: 25, costG: 25, weight: 20 },
      ];

    case 'economy-punish':
      // Fast harass units to punish greed
      return [
        { type: UnitType.Zergling, costM: 25, costG: 0, weight: 40 },
        { type: UnitType.Mutalisk, costM: 100, costG: 100, weight: 25 },
        { type: UnitType.Baneling, costM: 25, costG: 25, weight: 20 },
        { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 15 },
      ];

    default:
      return null; // use default phase-based weights
  }
}

// ═══════════════════════════════════════════
// ITERATION 5: Advanced Combat Awareness
// ═══════════════════════════════════════════
function runCombatAwareness(world: World, map: MapData, _gameTime: number): void {
  if (currentDifficulty < Difficulty.Hard) return;

  let actionsThisTick = 0;
  const maxActions = currentDifficulty === Difficulty.Brutal ? 6 : 3;

  const activeUnits = isAttacking ? armyEids : defenseEids;

  for (const eid of activeUnits) {
    if (actionsThisTick >= maxActions) break;
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;

    // ── Splash avoidance: spread out near siege tanks ──
    if (trySplashAvoidance(world, eid, map)) {
      actionsThisTick++;
      continue;
    }

    // ── Snipe low-HP targets for quick kills ──
    if (trySnipeLowHP(world, eid)) {
      actionsThisTick++;
      continue;
    }

    // ── Threat zone avoidance: don't walk into siege tank range ──
    if (tryAvoidThreatZone(world, eid, map)) {
      actionsThisTick++;
      continue;
    }
  }
}

/** Spread apart when near enemy splash damage sources (Siege Tanks) */
function trySplashAvoidance(world: World, eid: number, map: MapData): boolean {
  const ut = unitType[eid] as UnitType;
  // Only spread ranged/squishy units — Zerglings are expendable
  if (ut === UnitType.Zergling || ut === UnitType.Baneling) return false;

  // Check if any siege tank is in range
  let hasSplashThreat = false;
  let threatX = 0, threatY = 0;
  const dangerRange = THREAT_ZONE_RANGE * TILE_SIZE;
  const dangerRangeSq = dangerRange * dangerRange;

  for (let other = 1; other < world.nextEid; other++) {
    if (!hasComponents(world, other, POSITION | HEALTH | ATTACK)) continue;
    if (faction[other] === currentAIFaction || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;
    if (unitType[other] !== UnitType.SiegeTank) continue;

    const dx = posX[other] - posX[eid];
    const dy = posY[other] - posY[eid];
    if (dx * dx + dy * dy < dangerRangeSq) {
      hasSplashThreat = true;
      threatX = posX[other];
      threatY = posY[other];
      break;
    }
  }

  if (!hasSplashThreat) return false;

  // Check for nearby friendly clumping
  let nearbyFriendlies = 0;
  const clumpRange = SPLASH_SPREAD_DIST * TILE_SIZE;
  const clumpRangeSq = clumpRange * clumpRange;

  for (const otherEid of armyEids) {
    if (otherEid === eid) continue;
    if (!entityExists(world, otherEid) || hpCurrent[otherEid] <= 0) continue;
    const dx = posX[otherEid] - posX[eid];
    const dy = posY[otherEid] - posY[eid];
    if (dx * dx + dy * dy < clumpRangeSq) nearbyFriendlies++;
  }

  if (nearbyFriendlies < 2) return false; // not clumped enough to worry

  if (!spendAPM(APM_COST_MICRO)) return false;

  // Move perpendicular to threat direction to spread out
  const dx = posX[eid] - threatX;
  const dy = posY[eid] - threatY;
  const angle = Math.atan2(dy, dx);
  const spreadDir = rng.next() > 0.5 ? 1 : -1;
  const spreadAngle = angle + spreadDir * Math.PI * 0.5;

  const spreadX = posX[eid] + Math.cos(spreadAngle) * SPLASH_SPREAD_DIST * TILE_SIZE;
  const spreadY = posY[eid] + Math.sin(spreadAngle) * SPLASH_SPREAD_DIST * TILE_SIZE;

  commandMode[eid] = CommandMode.AttackMove;
  pathTo(eid, spreadX, spreadY, map);
  return true;
}

/** Retarget to an enemy with very low HP for a guaranteed kill */
function trySnipeLowHP(world: World, eid: number): boolean {
  if (atkRange[eid] <= 0) return false; // melee units don't snipe

  const scanRange = atkRange[eid] + 2 * TILE_SIZE;
  const scanRangeSq = scanRange * scanRange;

  let bestTarget = 0;
  let bestHpRatio = SNIPE_HP_THRESHOLD;

  for (let other = 1; other < world.nextEid; other++) {
    if (!hasComponents(world, other, POSITION | HEALTH)) continue;
    if (faction[other] === currentAIFaction || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;
    if (hasComponents(world, other, BUILDING)) continue; // don't snipe buildings

    const dx = posX[other] - posX[eid];
    const dy = posY[other] - posY[eid];
    if (dx * dx + dy * dy > scanRangeSq) continue;

    const ratio = hpCurrent[other] / Math.max(1, hpMax[other]);
    if (ratio < bestHpRatio) {
      bestHpRatio = ratio;
      bestTarget = other;
    }
  }

  if (bestTarget > 0 && bestTarget !== targetEntity[eid]) {
    if (!spendAPM(APM_COST_MICRO)) return false;
    targetEntity[eid] = bestTarget;
    commandMode[eid] = CommandMode.AttackTarget;
    return true;
  }
  return false;
}

/** Avoid walking into siege tank range — path around if possible */
function tryAvoidThreatZone(world: World, eid: number, map: MapData): boolean {
  const ut = unitType[eid] as UnitType;
  // Only avoid with non-melee units or high-value units
  if (ut === UnitType.Zergling || ut === UnitType.Baneling) return false;
  if (movePathIndex[eid] < 0) return false; // not currently moving

  // Check for siege tanks in path
  const dangerRange = 13 * TILE_SIZE; // siege range
  const dangerRangeSq = dangerRange * dangerRange;
  const warningRange = (13 + 3) * TILE_SIZE; // a bit beyond siege range
  const warningRangeSq = warningRange * warningRange;

  let threatFound = false;
  let threatX = 0, threatY = 0;

  for (let other = 1; other < world.nextEid; other++) {
    if (!hasComponents(world, other, POSITION | HEALTH)) continue;
    if (faction[other] === currentAIFaction || faction[other] === 0) continue;
    if (hpCurrent[other] <= 0) continue;
    if (unitType[other] !== UnitType.SiegeTank) continue;

    const dx = posX[other] - posX[eid];
    const dy = posY[other] - posY[eid];
    const distSq = dx * dx + dy * dy;
    if (distSq < warningRangeSq && distSq > dangerRangeSq * 0.25) {
      threatFound = true;
      threatX = posX[other];
      threatY = posY[other];
      break;
    }
  }

  if (!threatFound) return false;

  if (!spendAPM(APM_COST_MICRO)) return false;

  // Path around: move perpendicular to threat direction
  const dx = posX[eid] - threatX;
  const dy = posY[eid] - threatY;
  const angle = Math.atan2(dy, dx);
  const avoidDir = rng.next() > 0.5 ? 1 : -1;
  const avoidAngle = angle + avoidDir * Math.PI * 0.4;

  const avoidX = posX[eid] + Math.cos(avoidAngle) * 5 * TILE_SIZE;
  const avoidY = posY[eid] + Math.sin(avoidAngle) * 5 * TILE_SIZE;

  commandMode[eid] = CommandMode.AttackMove;
  pathTo(eid, avoidX, avoidY, map);
  return true;
}

// ─────────────────────────────────────────
// Utility
// ─────────────────────────────────────────
function pathTo(eid: number, destX: number, destY: number, map: MapData): void {
  const startTile = worldToTile(posX[eid], posY[eid]);
  let endTile = worldToTile(destX, destY);
  let tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);

  // Fallback: if destination is unwalkable, find nearest walkable tile
  if (tilePath.length === 0) {
    const nearest = findNearestWalkableTile(map, endTile.col, endTile.row);
    if (nearest) {
      endTile = nearest;
      tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
    }
  }

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = simplifyAIPath(tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    }));
    setPath(eid, worldPath);
  }
}

/** Remove collinear waypoints from AI paths */
function simplifyAIPath(path: Array<[number, number]>): Array<[number, number]> {
  if (path.length <= 2) return path;
  const result: Array<[number, number]> = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const [px, py] = result[result.length - 1];
    const [cx, cy] = path[i];
    const [nx, ny] = path[i + 1];
    if (Math.abs((cx - px) * (ny - cy) - (cy - py) * (nx - cx)) > 0.01) {
      result.push(path[i]);
    }
  }
  result.push(path[path.length - 1]);
  return result;
}
