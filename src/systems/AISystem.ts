import { type World, entityExists } from '../ecs/world';
import {
  posX, posY, faction, hpCurrent, commandMode, unitType,
  setPath,
} from '../ecs/components';
import { findNearestCommandCenter } from '../ecs/queries';
import {
  Faction, UnitType, CommandMode, MAX_ENTITIES, TILE_SIZE,
  AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW,
} from '../constants';
import { findPath } from '../map/Pathfinder';
import {
  worldToTile, tileToWorld, findNearestWalkableTile, type MapData,
} from '../map/MapData';
import type { PlayerResources } from '../types';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;

// ── Tuning constants ──
const INITIAL_DELAY = 20;         // seconds before AI acts
const DECISION_INTERVAL = 15;     // ticks between decisions (~0.25s)
const BASE_INCOME = 3.0;          // minerals/sec starting income
const GAS_INCOME_RATIO = 0.35;    // gas = minerals * this ratio
const INCOME_GROWTH_PER_WAVE = 0.25; // +25% income per wave
const MAX_SPAWNS_PER_DECISION = 3;   // can spawn up to 3 units per decision tick

// Wave timing
const FIRST_WAVE_SIZE = 6;
const WAVE_SIZE_GROWTH = 4;       // each wave is 4 units bigger
const MAX_WAVE_SIZE = 30;
const WAVE_COOLDOWN = 8;          // seconds between end of attack and next wave launch
const HARASSMENT_INTERVAL = 45;   // seconds between small harassment groups

// Build order phases
const enum AIPhase {
  EarlyGame = 0,   // waves 0-1: mostly Zerglings
  MidGame = 1,     // waves 2-4: mixed composition
  LateGame = 2,    // waves 5+: heavy units, Banelings
}

// ── AI State ──
let aiMinerals = 0;
let aiGas = 0;
let waveCount = 0;
let tickCounter = 0;
let lastDecisionTime = 0;
let isAttacking = false;
let attackEndTime = 0;
let lastHarassTime = 0;
const armyEids = new Set<number>();
const harassEids = new Set<number>();

const spawnBase = tileToWorld(AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW);

export function initAI(): void {
  aiMinerals = 0;
  aiGas = 0;
  waveCount = 0;
  tickCounter = 0;
  lastDecisionTime = 0;
  isAttacking = false;
  attackEndTime = 0;
  lastHarassTime = 0;
  armyEids.clear();
  harassEids.clear();
}

export function getAIState() {
  return { aiMinerals, aiGas, waveCount, isAttacking, armySize: armyEids.size };
}

export function setAIMinerals(m: number, g: number = 0): void {
  aiMinerals = m;
  aiGas = g;
}

export function aiSystem(
  world: World,
  dt: number,
  gameTime: number,
  map: MapData,
  spawnFn: SpawnFn,
  _resources: Record<number, PlayerResources>,
): void {
  if (gameTime < INITIAL_DELAY) return;

  tickCounter++;
  if (tickCounter < DECISION_INTERVAL) return;
  tickCounter = 0;

  const elapsed = gameTime - lastDecisionTime;
  lastDecisionTime = gameTime;
  if (elapsed <= 0) return;

  pruneDeadUnits(world);

  // Accumulate resources (scales with wave count)
  const incomeMultiplier = 1 + waveCount * INCOME_GROWTH_PER_WAVE;
  aiMinerals += BASE_INCOME * incomeMultiplier * elapsed;
  aiGas += BASE_INCOME * GAS_INCOME_RATIO * incomeMultiplier * elapsed;

  // Spawn units (multiple per decision tick for faster buildup)
  const spawnsThisTick = Math.min(MAX_SPAWNS_PER_DECISION, 1 + Math.floor(waveCount / 2));
  for (let i = 0; i < spawnsThisTick; i++) {
    trySpawnUnit(world, map, spawnFn);
  }

  // Check for main wave attack
  decideAttack(world, map, gameTime);

  // Harassment: send small groups periodically
  if (gameTime - lastHarassTime > HARASSMENT_INTERVAL && !isAttacking && armyEids.size >= 3) {
    sendHarassment(world, map, gameTime);
  }
}

function pruneDeadUnits(world: World): void {
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) {
      armyEids.delete(eid);
    }
  }
  for (const eid of harassEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) {
      harassEids.delete(eid);
    }
  }
  if (isAttacking && armyEids.size === 0) {
    isAttacking = false;
  }
}

function getPhase(): AIPhase {
  if (waveCount <= 1) return AIPhase.EarlyGame;
  if (waveCount <= 4) return AIPhase.MidGame;
  return AIPhase.LateGame;
}

// Build orders per phase — different unit compositions
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

function getSpawnOptions() {
  const phase = getPhase();
  switch (phase) {
    case AIPhase.EarlyGame: return EARLY_GAME_UNITS;
    case AIPhase.MidGame: return MID_GAME_UNITS;
    case AIPhase.LateGame: return LATE_GAME_UNITS;
  }
}

function trySpawnUnit(world: World, map: MapData, spawnFn: SpawnFn): void {
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  const options = getSpawnOptions();
  const totalWeight = options.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = options[0];

  for (const opt of options) {
    roll -= opt.weight;
    if (roll <= 0) { chosen = opt; break; }
  }

  if (aiMinerals < chosen.costM || aiGas < chosen.costG) return;

  const jitterCol = AI_SPAWN_BASE_COL + Math.floor(Math.random() * 5) - 2;
  const jitterRow = AI_SPAWN_BASE_ROW + Math.floor(Math.random() * 5) - 2;
  const walkable = findNearestWalkableTile(map, jitterCol, jitterRow);
  if (!walkable) return;

  const wp = tileToWorld(walkable.col, walkable.row);
  aiMinerals -= chosen.costM;
  aiGas -= chosen.costG;
  const eid = spawnFn(chosen.type, Faction.Zerg, wp.x, wp.y);
  armyEids.add(eid);
}

function decideAttack(world: World, map: MapData, gameTime: number): void {
  if (isAttacking) return;

  // Cooldown between waves
  if (attackEndTime > 0 && gameTime - attackEndTime < WAVE_COOLDOWN) return;

  const threshold = Math.min(
    FIRST_WAVE_SIZE + waveCount * WAVE_SIZE_GROWTH,
    MAX_WAVE_SIZE,
  );

  if (armyEids.size < threshold) return;

  // Launch wave!
  isAttacking = true;
  waveCount++;

  const target = findAttackTarget(world);
  sendUnitsToAttack(world, map, armyEids, target.x, target.y);
}

function sendHarassment(world: World, map: MapData, gameTime: number): void {
  lastHarassTime = gameTime;

  // Pick 2-4 fast units (Zerglings) for harassment
  const harassCount = Math.min(4, armyEids.size);
  let picked = 0;
  const toSend: number[] = [];

  for (const eid of armyEids) {
    if (picked >= harassCount) break;
    if (unitType[eid] === UnitType.Zergling) {
      toSend.push(eid);
      picked++;
    }
  }

  if (toSend.length < 2) return;

  // Remove from main army, add to harass group
  for (const eid of toSend) {
    armyEids.delete(eid);
    harassEids.add(eid);
  }

  const target = findAttackTarget(world);
  const harassSet = new Set(toSend);
  sendUnitsToAttack(world, map, harassSet, target.x, target.y);
}

function findAttackTarget(world: World): { x: number; y: number } {
  const cc = findNearestCommandCenter(world, Faction.Terran, spawnBase.x, spawnBase.y);
  if (cc > 0) {
    return { x: posX[cc], y: posY[cc] };
  }
  const fallback = tileToWorld(15, 15);
  return { x: fallback.x, y: fallback.y };
}

function sendUnitsToAttack(
  world: World,
  map: MapData,
  units: Set<number>,
  targetX: number,
  targetY: number,
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
}
