import { type World, entityExists } from '../ecs/world';
import {
  posX, posY, faction, hpCurrent, commandMode, unitType,
  setPath,
} from '../ecs/components';
import { findNearestCommandCenter } from '../ecs/queries';
import {
  Faction, UnitType, CommandMode, MAX_ENTITIES, TILE_SIZE,
  AI_DECISION_INTERVAL, AI_MINERAL_INCOME, AI_INITIAL_DELAY,
  AI_ATTACK_THRESHOLD_BASE, AI_ATTACK_THRESHOLD_GROWTH,
  AI_INCOME_GROWTH, AI_MAX_WAVE_SIZE,
  AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW,
} from '../constants';
import { findPath } from '../map/Pathfinder';
import {
  worldToTile, tileToWorld, findNearestWalkableTile, type MapData,
} from '../map/MapData';
import type { PlayerResources } from '../types';

type SpawnFn = (type: number, fac: number, x: number, y: number) => number;

// ── AI State (module-level) ──
let aiMinerals = 0;
let aiGas = 0;
let waveCount = 0;
let tickCounter = 0;
let lastDecisionTime = 0;
let isAttacking = false;
const armyEids = new Set<number>();

// Spawn point in world coords
const spawnBase = tileToWorld(AI_SPAWN_BASE_COL, AI_SPAWN_BASE_ROW);

/** Reset AI state (call on game init) */
export function initAI(): void {
  aiMinerals = 0;
  aiGas = 0;
  waveCount = 0;
  tickCounter = 0;
  lastDecisionTime = 0;
  isAttacking = false;
  armyEids.clear();
}

/** Expose state for testing */
export function getAIState() {
  return { aiMinerals, aiGas, waveCount, isAttacking, armySize: armyEids.size };
}

/** Directly set minerals for testing */
export function setAIMinerals(m: number, g: number = 0): void {
  aiMinerals = m;
  aiGas = g;
}

/**
 * AI opponent system. Controls the Zerg faction.
 * Runs every tick but only makes decisions every AI_DECISION_INTERVAL ticks.
 */
export function aiSystem(
  world: World,
  dt: number,
  gameTime: number,
  map: MapData,
  spawnFn: SpawnFn,
  _resources: Record<number, PlayerResources>, // Reserved for future fair-AI mode; cheating AI uses internal aiMinerals
): void {
  // Don't start until initial delay
  if (gameTime < AI_INITIAL_DELAY) return;

  tickCounter++;
  if (tickCounter < AI_DECISION_INTERVAL) return;
  tickCounter = 0;

  const elapsed = gameTime - lastDecisionTime;
  lastDecisionTime = gameTime;
  if (elapsed <= 0) return;

  // Prune dead units from army
  pruneDeadUnits(world);

  // Accumulate resources
  const incomeMultiplier = 1 + waveCount * AI_INCOME_GROWTH;
  aiMinerals += AI_MINERAL_INCOME * incomeMultiplier * elapsed;
  aiGas += AI_MINERAL_INCOME * 0.3 * incomeMultiplier * elapsed;

  // Try to spawn a unit
  if (!isAttacking) {
    trySpawnUnit(world, map, spawnFn);
  }

  // Check if we should attack
  decideAttack(world, map);
}

function pruneDeadUnits(world: World): void {
  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) {
      armyEids.delete(eid);
    }
  }

  // Reset attack state if all army units are dead
  if (isAttacking && armyEids.size === 0) {
    isAttacking = false;
  }
}

// Unit costs for AI spawning
const SPAWN_OPTIONS = [
  { type: UnitType.Zergling, costM: 50, costG: 0, weight: 40 },
  { type: UnitType.Hydralisk, costM: 100, costG: 50, weight: 30 },
  { type: UnitType.Roach, costM: 75, costG: 25, weight: 20 },
  { type: UnitType.Baneling, costM: 50, costG: 25, weight: 10 },
];

function trySpawnUnit(world: World, map: MapData, spawnFn: SpawnFn): void {
  // Entity limit safety
  if (world.nextEid >= MAX_ENTITIES - 50) return;

  // Pick a unit to spawn (weighted random)
  const totalWeight = SPAWN_OPTIONS.reduce((s, o) => s + o.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = SPAWN_OPTIONS[0];

  for (const opt of SPAWN_OPTIONS) {
    roll -= opt.weight;
    if (roll <= 0) {
      chosen = opt;
      break;
    }
  }

  // Early game priority: always start with some Zerglings
  if (armyEids.size < 4) {
    chosen = SPAWN_OPTIONS[0]; // Zergling
  }

  if (aiMinerals < chosen.costM || aiGas < chosen.costG) return;

  // Find spawn position with jitter
  const jitterCol = AI_SPAWN_BASE_COL + Math.floor(Math.random() * 5) - 2;
  const jitterRow = AI_SPAWN_BASE_ROW + Math.floor(Math.random() * 5) - 2;
  const walkable = findNearestWalkableTile(map, jitterCol, jitterRow);
  if (!walkable) return;

  const wp = tileToWorld(walkable.col, walkable.row);

  // Deduct cost and spawn
  aiMinerals -= chosen.costM;
  aiGas -= chosen.costG;
  const eid = spawnFn(chosen.type, Faction.Zerg, wp.x, wp.y);
  armyEids.add(eid);
}

function decideAttack(world: World, map: MapData): void {
  if (isAttacking) return;

  const threshold = Math.min(
    AI_ATTACK_THRESHOLD_BASE + waveCount * AI_ATTACK_THRESHOLD_GROWTH,
    AI_MAX_WAVE_SIZE,
  );

  if (armyEids.size < threshold) return;

  // Find target: player's Command Center
  let targetX: number, targetY: number;
  const cc = findNearestCommandCenter(world, Faction.Terran, spawnBase.x, spawnBase.y);
  if (cc > 0) {
    targetX = posX[cc];
    targetY = posY[cc];
  } else {
    // Fallback to starting CC position
    const fallback = tileToWorld(15, 15);
    targetX = fallback.x;
    targetY = fallback.y;
  }

  isAttacking = true;
  waveCount++;

  // Issue attack-move to all army units
  const targetTile = worldToTile(targetX, targetY);
  const cols = Math.ceil(Math.sqrt(armyEids.size));
  const spacing = TILE_SIZE * 0.8;
  let i = 0;

  for (const eid of armyEids) {
    if (!entityExists(world, eid) || hpCurrent[eid] <= 0) continue;

    const row = Math.floor(i / cols);
    const col = i % cols;
    const offsetX = (col - (cols - 1) / 2) * spacing;
    const offsetY = (row - Math.floor(armyEids.size / cols - 1) / 2) * spacing;
    i++;

    const destX = targetX + offsetX;
    const destY = targetY + offsetY;

    commandMode[eid] = CommandMode.AttackMove;

    // Path to target
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
