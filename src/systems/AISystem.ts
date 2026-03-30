import { type World, entityExists, hasComponents } from '../ecs/world';
import {
  POSITION, BUILDING, HEALTH, UNIT_TYPE,
  posX, posY, faction, hpCurrent, hpMax, commandMode, unitType,
  buildingType, buildState, targetEntity,
  setPath, movePathIndex,
} from '../ecs/components';
import { findNearestCommandCenter } from '../ecs/queries';
import { isTileVisible } from './FogSystem';
import {
  Faction, UnitType, CommandMode, MAX_ENTITIES, TILE_SIZE,
  AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW, BuildingType, BuildState,
  MAP_COLS, MAP_ROWS,
} from '../constants';
import { findPath } from '../map/Pathfinder';
import {
  worldToTile, tileToWorld, findNearestWalkableTile, type MapData,
} from '../map/MapData';
import type { PlayerResources } from '../types';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;

// ─────────────────────────────────────────
// Tuning constants
// ─────────────────────────────────────────
const INITIAL_DELAY = 20;
const DECISION_INTERVAL = 15;
const BASE_INCOME = 3.0;
const GAS_INCOME_RATIO = 0.35;
const INCOME_GROWTH_PER_WAVE = 0.25;
const MAX_SPAWNS_PER_DECISION = 3;

const FIRST_WAVE_SIZE = 6;
const WAVE_SIZE_GROWTH = 4;
const MAX_WAVE_SIZE = 30;
const WAVE_COOLDOWN = 8;
const HARASSMENT_INTERVAL = 45;
const SCOUT_INTERVAL = 25;        // seconds between scout sends
const RETREAT_HP_RATIO = 0.35;    // retreat if army HP drops below 35% of max

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
  const roll = Math.random();
  return {
    aggressionMult: 0.7 + Math.random() * 0.6,  // 0.7 to 1.3
    timingOffset: (Math.random() - 0.5) * 10,     // -5 to +5
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
let aiMinerals = 0;
let aiGas = 0;
let waveCount = 0;
let tickCounter = 0;
let lastDecisionTime = 0;
let isAttacking = false;
let attackEndTime = 0;
let lastHarassTime = 0;
let lastScoutSendTime = 0;
let retreating = false;
let regroupX = 0;
let regroupY = 0;
const armyEids = new Set<number>();
const harassEids = new Set<number>();
const scoutEids = new Set<number>();

export function initAI(): void {
  aiMinerals = 0;
  aiGas = 0;
  waveCount = 0;
  tickCounter = 0;
  lastDecisionTime = 0;
  isAttacking = false;
  attackEndTime = 0;
  lastHarassTime = 0;
  lastScoutSendTime = 0;
  retreating = false;
  regroupX = 0;
  regroupY = 0;
  armyEids.clear();
  harassEids.clear();
  scoutEids.clear();
  personality = randomPersonality();
  intel = resetIntel();
}

export function getAIState() {
  return { aiMinerals, aiGas, waveCount, isAttacking, armySize: armyEids.size };
}

export function setAIMinerals(m: number, g: number = 0): void {
  aiMinerals = m;
  aiGas = g;
}

// ─────────────────────────────────────────
// Main system entry
// ─────────────────────────────────────────
export function aiSystem(
  world: World,
  _dt: number,
  gameTime: number,
  map: MapData,
  spawnFn: SpawnFn,
  _resources: Record<number, PlayerResources>,
): void {
  if (gameTime < INITIAL_DELAY + personality.timingOffset) return;

  tickCounter++;
  if (tickCounter < DECISION_INTERVAL) return;
  tickCounter = 0;

  const elapsed = gameTime - lastDecisionTime;
  lastDecisionTime = gameTime;
  if (elapsed <= 0) return;

  pruneDeadUnits(world);
  gatherIntelFromUnits(world);

  // Accumulate resources
  const incomeMultiplier = 1 + waveCount * INCOME_GROWTH_PER_WAVE;
  aiMinerals += BASE_INCOME * incomeMultiplier * personality.aggressionMult * elapsed;
  aiGas += BASE_INCOME * GAS_INCOME_RATIO * incomeMultiplier * elapsed;

  // Spawn units
  const spawnsThisTick = Math.min(MAX_SPAWNS_PER_DECISION, 1 + Math.floor(waveCount / 2));
  for (let i = 0; i < spawnsThisTick; i++) {
    trySpawnUnit(world, map, spawnFn);
  }

  // Scouting
  if (gameTime - lastScoutSendTime > SCOUT_INTERVAL && scoutEids.size < 2) {
    sendScout(world, map, gameTime);
  }

  // Retreat check (before attack decision)
  if (isAttacking && !retreating) {
    checkRetreat(world, map);
  }
  if (retreating) {
    checkRegroupComplete(world);
  }

  // Attack or harass
  if (!retreating) {
    decideAttack(world, map, gameTime);
    if (gameTime - lastHarassTime > HARASSMENT_INTERVAL * personality.aggressionMult && !isAttacking && armyEids.size >= 3) {
      sendHarassment(world, map, gameTime);
    }
  }
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

  // Collect all Zerg unit positions for sight checks
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
    if (faction[eid] !== Faction.Terran) continue;
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
    case AIPhase.LateGame: return [...LATE_GAME_UNITS];
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
  const wp = SCOUT_WAYPOINTS[Math.floor(Math.random() * SCOUT_WAYPOINTS.length)];
  const dest = tileToWorld(wp.col, wp.row);

  commandMode[scoutEid] = CommandMode.AttackMove;
  pathTo(scoutEid, dest.x, dest.y, map);
}

// ─────────────────────────────────────────
// Retreat logic
// ─────────────────────────────────────────
function checkRetreat(world: World, map: MapData): void {
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

function checkRegroupComplete(world: World): void {
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

  if (total === 0 || nearBase >= total * 0.6) {
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
    if (faction[eid] !== Faction.Terran) continue;
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

  // Assign top 1-2 targets to army units
  const primaryTarget = enemyTargets[0].eid;

  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    // Only override if unit doesn't already have a valid target
    if (targetEntity[eid] >= 1 && entityExists(world, targetEntity[eid]) && hpCurrent[targetEntity[eid]] > 0) {
      continue;
    }
    targetEntity[eid] = primaryTarget;
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

  // Priority 2: Check if any Zerg unit can currently SEE a Terran building
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;
    // Look for visible Terran buildings near this unit
    for (let other = 1; other < world.nextEid; other++) {
      if (!hasComponents(world, other, POSITION | BUILDING)) continue;
      if (faction[other] !== Faction.Terran) continue;
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
  const fallback = tileToWorld(15, 15);
  return { x: fallback.x, y: fallback.y };
}

// ─────────────────────────────────────────
// Varied attack angles
// ─────────────────────────────────────────
function pickAttackAngle(targetX: number, targetY: number, map: MapData): { x: number; y: number } {
  // Randomly offset the approach angle to vary attack paths
  const angle = Math.random() * Math.PI * 2;
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
  if (isAttacking && armyEids.size === 0) {
    isAttacking = false;
    attackEndTime = lastDecisionTime;
  }
}

const enum AIPhase {
  EarlyGame = 0,
  MidGame = 1,
  LateGame = 2,
}

function getPhase(): AIPhase {
  if (waveCount <= 1) return AIPhase.EarlyGame;
  if (waveCount <= 4) return AIPhase.MidGame;
  return AIPhase.LateGame;
}

const EARLY_GAME_UNITS = [
  { type: UnitType.Zergling, costM: 50, costG: 0, weight: 70 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 30 },
];
const MID_GAME_UNITS = [
  { type: UnitType.Zergling, costM: 50, costG: 0, weight: 30 },
  { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 30 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 25 },
  { type: UnitType.Baneling, costM: 50, costG: 25, weight: 15 },
];
const LATE_GAME_UNITS = [
  { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 35 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 25 },
  { type: UnitType.Baneling, costM: 50, costG: 25, weight: 20 },
  { type: UnitType.Zergling, costM: 50, costG: 0, weight: 20 },
];

function findZergHatchery(world: World): number {
  const bits = POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== Faction.Zerg) continue;
    if (buildingType[eid] !== BuildingType.Hatchery) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    if (hpCurrent[eid] <= 0) continue;
    return eid;
  }
  return 0;
}

function trySpawnUnit(world: World, map: MapData, spawnFn: SpawnFn): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  const hatchery = findZergHatchery(world);
  if (hatchery === 0) return;

  // Use reactive composition (intel-driven)
  const options = getReactiveWeights();
  const totalWeight = options.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = options[0];

  for (const opt of options) {
    roll -= opt.weight;
    if (roll <= 0) { chosen = opt; break; }
  }

  // Personality style override
  if (personality.preferredStyle === 'rush' && waveCount <= 2) {
    // Rush style: always Zerglings early
    chosen = EARLY_GAME_UNITS[0];
  } else if (personality.preferredStyle === 'heavy' && waveCount >= 2) {
    // Heavy style: prefer Roaches and Hydralisks
    const heavyOptions = options.filter(o => o.type === UnitType.Roach || o.type === UnitType.Hydralisk);
    if (heavyOptions.length > 0) {
      chosen = heavyOptions[Math.floor(Math.random() * heavyOptions.length)];
    }
  }

  if (aiMinerals < chosen.costM || aiGas < chosen.costG) return;

  const hatchTile = worldToTile(posX[hatchery], posY[hatchery]);
  const jitterCol = hatchTile.col + Math.floor(Math.random() * 5) - 2;
  const jitterRow = hatchTile.row + Math.floor(Math.random() * 5) - 2;
  const walkable = findNearestWalkableTile(map, jitterCol, jitterRow);
  if (!walkable) return;

  const wp = tileToWorld(walkable.col, walkable.row);
  aiMinerals -= chosen.costM;
  aiGas -= chosen.costG;
  const eid = spawnFn(chosen.type, Faction.Zerg, wp.x, wp.y);
  armyEids.add(eid);
}

function decideAttack(world: World, map: MapData, gameTime: number): void {
  if (isAttacking) {
    // During active attack, apply focus fire
    assignFocusTargets(world);
    return;
  }

  if (attackEndTime > 0 && gameTime - attackEndTime < WAVE_COOLDOWN) return;

  const threshold = Math.min(
    Math.floor((FIRST_WAVE_SIZE + waveCount * WAVE_SIZE_GROWTH) * personality.aggressionMult),
    MAX_WAVE_SIZE,
  );

  if (armyEids.size < threshold) return;

  // Launch wave!
  isAttacking = true;
  retreating = false;
  waveCount++;

  const target = findAttackTarget(world);

  // Multi-prong: 30% chance to split army into 2 groups from different angles
  if (armyEids.size >= 10 && Math.random() < 0.3) {
    sendMultiProngAttack(world, map, target.x, target.y);
  } else {
    const angle = pickAttackAngle(target.x, target.y, map);
    sendUnitsToAttack(world, map, armyEids, target.x, target.y, angle);
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

    const destX = targetX + offsetX;
    const destY = targetY + offsetY;
    commandMode[eid] = CommandMode.AttackMove;

    // If waypoint given, path through it first for varied approach angle
    if (waypoint) {
      pathTo(eid, waypoint.x + offsetX, waypoint.y + offsetY, map);
    } else {
      pathTo(eid, destX, destY, map);
    }
  }
}

// ─────────────────────────────────────────
// Utility
// ─────────────────────────────────────────
function pathTo(eid: number, destX: number, destY: number, map: MapData): void {
  const startTile = worldToTile(posX[eid], posY[eid]);
  const endTile = worldToTile(destX, destY);
  const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);

  if (tilePath.length > 0) {
    const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
      const wp = tileToWorld(c, r);
      return [wp.x, wp.y] as [number, number];
    });
    setPath(eid, worldPath);
  }
}
