import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, SELECTABLE, MOVEMENT, UNIT_TYPE, BUILDING,
  posX, posY, selected, moveTargetX, moveTargetY,
  setPath, appendPath, getPathWaypoint, pathLengths, faction, movePathIndex, unitType, velX, velY,
  targetEntity, commandMode,
  patrolOriginX, patrolOriginY,
  stimEndTime, hpCurrent, moveSpeed, atkCooldown,
  siegeMode, siegeTransitionEnd,
  workerState, workerTargetEid, resourceType, resourceRemaining,
  rallyX, rallyY, buildState, buildingType, prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  cloaked,
  energy, injectTimer,
  isAir, canTargetGround, canTargetAir, atkRange, atkDamage,
  atkLastTime,
  bileLandTime, bileLandX, bileLandY,
  fungalLandTime, fungalLandX, fungalLandY,
} from '../ecs/components';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import { findEnemyAt, findResourceAt, findBuildingAt, findFriendlyAt } from '../ecs/queries';
import { CommandType, type GameCommand } from '../input/CommandQueue';
import type { MapData } from '../map/MapData';
import { worldToTile, tileToWorld, findNearestWalkableTile } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import {
  Faction, CommandMode, UnitType, SiegeMode, ResourceType, WorkerState, BuildState, BuildingType, TILE_SIZE,
  STIM_DURATION, STIM_HP_COST, STIM_HP_COST_MARAUDER, STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_PACK_TIME,
  INJECT_LARVA_COST, INJECT_LARVA_TIME,
} from '../constants';
import type { PlayerResources } from '../types';
import type { Viewport } from 'pixi-viewport';
import { addCommandPing } from '../rendering/UnitRenderer';
import { emitProjectile } from '../rendering/ProjectileRenderer';
import { damageEvents } from './CombatSystem';
import { soundManager } from '../audio/SoundManager';

/**
 * Translates queued game commands into move/attack/attack-move commands for selected units.
 * Also handles ability commands (Stim, Siege), rally points, and production.
 */
export function commandSystem(
  world: World,
  commands: GameCommand[],
  viewport: Viewport,
  map: MapData,
  gameTime: number,
  resources?: Record<number, PlayerResources>,
  playerFaction: Faction = Faction.Terran,
): void {
  for (const cmd of commands) {
    switch (cmd.type) {
      case CommandType.Stop:
        if (cmd.units) stopUnits(world, cmd.units);
        break;

      case CommandType.HoldPosition:
        if (cmd.units) holdUnits(world, cmd.units);
        break;

      case CommandType.Patrol: {
        const units = cmd.units ?? [];
        if (units.length === 0) break;
        // Record current position as patrol origin for each unit
        for (const eid of units) {
          patrolOriginX[eid] = posX[eid];
          patrolOriginY[eid] = posY[eid];
        }
        issuePathCommand(world, units, cmd.wx!, cmd.wy!, map, CommandMode.Patrol);
        addCommandPing(cmd.wx!, cmd.wy!, 0xffaa00, gameTime);
        break;
      }

      case CommandType.Stim:
        if (cmd.units) {
          applyStim(world, cmd.units, gameTime);
          soundManager.playStimActivation();
        }
        break;

      case CommandType.SiegeToggle:
        if (cmd.units) {
          toggleSiegeMode(world, cmd.units, gameTime);
          vikingTransform(world, cmd.units);
          soundManager.playSiegeMode();
        }
        break;

      case CommandType.Cloak:
        if (cmd.units) {
          for (const eid of cmd.units) {
            if (unitType[eid] !== UnitType.Ghost) continue;
            cloaked[eid] = cloaked[eid] === 1 ? 0 : 1; // toggle
          }
          soundManager.playCloakToggle();
        }
        break;

      case CommandType.InjectLarva: {
        if (!cmd.units) break;
        for (const qEid of cmd.units) {
          if (unitType[qEid] !== UnitType.Queen) continue;
          if (hpCurrent[qEid] <= 0) continue;
          if (energy[qEid] < INJECT_LARVA_COST) continue;
          // Find nearest friendly Hatchery with no active inject
          let best = 0, bestDist = Infinity;
          const myFac = faction[qEid];
          for (let eid = 1; eid < world.nextEid; eid++) {
            if (!hasComponents(world, eid, BUILDING)) continue;
            if (faction[eid] !== myFac) continue;
            if (buildingType[eid] !== BuildingType.Hatchery) continue;
            if (buildState[eid] !== BuildState.Complete) continue;
            if (injectTimer[eid] > 0) continue;
            const d = (posX[eid] - posX[qEid]) ** 2 + (posY[eid] - posY[qEid]) ** 2;
            if (d < bestDist) { bestDist = d; best = eid; }
          }
          if (best === 0) continue;
          energy[qEid] -= INJECT_LARVA_COST;
          injectTimer[best] = gameTime + INJECT_LARVA_TIME;
        }
        break;
      }

      case CommandType.Yamato: {
        if (!cmd.units) break;
        const YAMATO_RANGE = 10 * TILE_SIZE;
        const YAMATO_COOLDOWN = 71; // seconds
        const YAMATO_DAMAGE = 240;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Battlecruiser) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Use atkLastTime for cooldown tracking (reuse existing field)
          if (atkLastTime[eid] + YAMATO_COOLDOWN > gameTime) continue;
          // Find nearest enemy in range
          const myFac = faction[eid];
          let bestTgt = 0;
          let bestDist = Infinity;
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | UNIT_TYPE)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            // Check targeting capability
            if (isAir[other] === 1 && !canTargetAir[eid]) continue;
            if (isAir[other] === 0 && !canTargetGround[eid]) continue;
            const dx = posX[other] - posX[eid];
            const dy = posY[other] - posY[eid];
            const distSq = dx * dx + dy * dy;
            if (distSq <= YAMATO_RANGE * YAMATO_RANGE && distSq < bestDist) {
              bestDist = distSq;
              bestTgt = other;
            }
          }
          if (bestTgt === 0) continue;
          atkLastTime[eid] = gameTime;
          hpCurrent[bestTgt] = Math.max(0, hpCurrent[bestTgt] - YAMATO_DAMAGE);
          // Emit a large orange-red projectile visual
          emitProjectile({
            fromX: posX[eid], fromY: posY[eid],
            toX: posX[bestTgt], toY: posY[bestTgt],
            unitType: UnitType.Battlecruiser,
            speed: 200,
            time: gameTime,
          });
          // Push a distinctive damage event so it's visible
          damageEvents.push({
            x: posX[bestTgt],
            y: posY[bestTgt],
            amount: YAMATO_DAMAGE,
            time: gameTime,
            color: 0xff6600,
          });
          addCommandPing(posX[bestTgt], posY[bestTgt], 0xff6600, gameTime);
          soundManager.playYamato();
        }
        break;
      }

      case CommandType.CorrosiveBile: {
        if (!cmd.units) break;
        const BILE_COOLDOWN = 5; // seconds per-unit
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Ravager) continue;
          if (hpCurrent[eid] <= 0) continue;
          // Use atkLastTime for cooldown tracking
          if (atkLastTime[eid] + BILE_COOLDOWN > gameTime) continue;
          atkLastTime[eid] = gameTime;
          bileLandTime[eid] = gameTime + 2; // 2s travel time
          bileLandX[eid] = cmd.wx!;
          bileLandY[eid] = cmd.wy!;
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0x88ff00, gameTime);
        break;
      }

      case CommandType.FungalGrowth: {
        if (!cmd.units) break;
        const FUNGAL_ENERGY_COST = 100;
        const FUNGAL_COOLDOWN = 10; // seconds per-unit
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Infestor) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < FUNGAL_ENERGY_COST) continue;
          if (atkLastTime[eid] + FUNGAL_COOLDOWN > gameTime) continue;
          energy[eid] -= FUNGAL_ENERGY_COST;
          atkLastTime[eid] = gameTime;
          fungalLandTime[eid] = gameTime + 1; // 1s travel time
          fungalLandX[eid] = cmd.wx!;
          fungalLandY[eid] = cmd.wy!;
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0x00ff44, gameTime);
        break;
      }

      case CommandType.Abduct: {
        if (!cmd.units) break;
        const ABDUCT_RANGE = 9 * TILE_SIZE;
        const ABDUCT_ENERGY_COST = 75;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Viper) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < ABDUCT_ENERGY_COST) continue;
          const tgt = targetEntity[eid];
          if (tgt < 1) continue;
          if (hpCurrent[tgt] <= 0) continue;
          // Check range
          const adx = posX[tgt] - posX[eid];
          const ady = posY[tgt] - posY[eid];
          if (adx * adx + ady * ady > ABDUCT_RANGE * ABDUCT_RANGE) continue;
          energy[eid] -= ABDUCT_ENERGY_COST;
          // Teleport target next to the Viper
          posX[tgt] = posX[eid] + 2 * TILE_SIZE;
          posY[tgt] = posY[eid];
          movePathIndex[tgt] = -1; // stop movement
          addCommandPing(posX[eid], posY[eid], 0xcc44ff, gameTime);
        }
        break;
      }

      case CommandType.Cancel:
        if (resources) cancelSelectedBuildings(world, resources);
        break;

      case CommandType.Produce:
        if (resources) handleProductionCommand(world, cmd, resources);
        break;

      case CommandType.AttackMove: {
        const units = cmd.units ?? [];
        if (units.length === 0) break;
        // Check if clicking on an enemy
        const enemy = findEnemyAt(world, cmd.wx!, cmd.wy!, playerFaction);
        if (enemy > 0) {
          for (const eid of units) {
            targetEntity[eid] = enemy;
            commandMode[eid] = CommandMode.AttackTarget;
          }
        } else {
          issuePathCommand(world, units, cmd.wx!, cmd.wy!, map, CommandMode.AttackMove);
        }
        addCommandPing(cmd.wx!, cmd.wy!, 0xff8844, gameTime);
        break;
      }

      case CommandType.Move: {
        // Right-click — CommandSystem reclassifies based on world state
        const units = cmd.units ?? [];
        const wx = cmd.wx!;
        const wy = cmd.wy!;

        // Set rally point for selected buildings
        const selectedBuildings = getSelectedBuildings(world);
        for (const eid of selectedBuildings) {
          rallyX[eid] = wx;
          rallyY[eid] = wy;
        }

        if (units.length === 0) break;

        // Check if right-clicking on a mineral patch
        const resource = findResourceAt(world, wx, wy);
        if (resource > 0 && resourceType[resource] === ResourceType.Mineral) {
          const workers: number[] = [];
          const nonWorkers: number[] = [];
          for (const eid of units) {
            const ut = unitType[eid] as UnitType;
            (ut === UnitType.SCV || ut === UnitType.Drone ? workers : nonWorkers).push(eid);
          }
          for (const eid of workers) {
            workerTargetEid[eid] = resource;
            workerState[eid] = WorkerState.MovingToResource;
            commandMode[eid] = CommandMode.Gather;
            targetEntity[eid] = -1;
            const resTile = worldToTile(posX[resource], posY[resource]);
            const walkable = findNearestWalkableTile(map, resTile.col, resTile.row);
            if (walkable) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);
              if (tilePath.length > 0) {
                setPath(eid, tilePath.map(([c, r]) => { const wp = tileToWorld(c, r); return [wp.x, wp.y] as [number, number]; }));
              }
            }
          }
          if (nonWorkers.length > 0) issuePathCommand(world, nonWorkers, wx, wy, map, CommandMode.Move);
          if (workers.length > 0) addCommandPing(wx, wy, 0x44bbff, gameTime);
          break;
        }

        // Check refinery
        const refinery = findBuildingAt(world, wx, wy, BuildingType.Refinery);
        if (refinery > 0 && resourceRemaining[refinery] > 0) {
          const workers: number[] = [];
          const nonWorkers: number[] = [];
          for (const eid of units) {
            const ut = unitType[eid] as UnitType;
            (ut === UnitType.SCV || ut === UnitType.Drone ? workers : nonWorkers).push(eid);
          }
          for (const eid of workers) {
            workerTargetEid[eid] = refinery;
            workerState[eid] = WorkerState.MovingToResource;
            commandMode[eid] = CommandMode.Gather;
            targetEntity[eid] = -1;
            const refTile = worldToTile(posX[refinery], posY[refinery]);
            const walkable = findNearestWalkableTile(map, refTile.col, refTile.row);
            if (walkable) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);
              if (tilePath.length > 0) {
                setPath(eid, tilePath.map(([c, r]) => { const wp = tileToWorld(c, r); return [wp.x, wp.y] as [number, number]; }));
              }
            }
          }
          if (nonWorkers.length > 0) issuePathCommand(world, nonWorkers, wx, wy, map, CommandMode.Move);
          if (workers.length > 0) addCommandPing(wx, wy, 0x44ff66, gameTime);
          break;
        }

        // Check if right-clicking on a friendly unit (Medivac heal-follow)
        const friendly = findFriendlyAt(world, wx, wy, playerFaction);
        if (friendly > 0) {
          const medivacs: number[] = [];
          const others: number[] = [];
          for (const eid of units) {
            (unitType[eid] === UnitType.Medivac ? medivacs : others).push(eid);
          }
          if (medivacs.length > 0) {
            issuePathCommand(world, medivacs, posX[friendly], posY[friendly], map, CommandMode.Move);
            addCommandPing(posX[friendly], posY[friendly], 0x00ffff, gameTime);
          }
          if (others.length > 0) {
            issuePathCommand(world, others, wx, wy, map, CommandMode.Move, cmd.shiftHeld ?? false);
            addCommandPing(wx, wy, cmd.shiftHeld ? 0xffff44 : 0x44ff44, gameTime);
          }
          break;
        }

        // Check enemy
        const enemy = findEnemyAt(world, wx, wy, playerFaction);
        if (enemy > 0) {
          for (const eid of units) {
            targetEntity[eid] = enemy;
            commandMode[eid] = CommandMode.AttackTarget;
            movePathIndex[eid] = -1;
            velX[eid] = 0;
            velY[eid] = 0;
          }
          addCommandPing(wx, wy, 0xff4444, gameTime);
          break;
        }

        // Plain move
        issuePathCommand(world, units, wx, wy, map, CommandMode.Move, cmd.shiftHeld ?? false);
        addCommandPing(wx, wy, cmd.shiftHeld ? 0xffff44 : 0x44ff44, gameTime);
        if (units.length > 0) soundManager.playVoiceLine(unitType[units[0]], 'command');
        break;
      }
    }
  }
}

function applyStim(world: World, units: number[], gameTime: number): void {
  for (const eid of units) {
    const ut = unitType[eid] as UnitType;
    if (ut !== UnitType.Marine && ut !== UnitType.Marauder) continue;

    // Already stimmed — just refresh duration
    if (stimEndTime[eid] > gameTime) {
      stimEndTime[eid] = gameTime + STIM_DURATION;
      continue;
    }

    const hpCost = ut === UnitType.Marauder ? STIM_HP_COST_MARAUDER : STIM_HP_COST;

    // Can't stim if it would kill the unit
    if (hpCurrent[eid] <= hpCost) continue;

    // Apply stim
    hpCurrent[eid] -= hpCost;
    stimEndTime[eid] = gameTime + STIM_DURATION;

    const def = UNIT_DEFS[unitType[eid]];
    if (def) {
      moveSpeed[eid] = def.speed * TILE_SIZE * STIM_SPEED_MULT;
      atkCooldown[eid] = def.attackCooldown * STIM_COOLDOWN_MULT;
    }
  }
}

function toggleSiegeMode(world: World, units: number[], gameTime: number): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.SiegeTank) continue;

    const mode = siegeMode[eid] as SiegeMode;

    // Can't interrupt a transition
    if (mode === SiegeMode.Packing || mode === SiegeMode.Unpacking) continue;

    if (mode === SiegeMode.Mobile) {
      // Start unpacking → will become Sieged
      siegeMode[eid] = SiegeMode.Unpacking;
      siegeTransitionEnd[eid] = gameTime + SIEGE_PACK_TIME;
      movePathIndex[eid] = -1; // Stop movement
    } else {
      // Sieged → start packing → will become Mobile
      siegeMode[eid] = SiegeMode.Packing;
      siegeTransitionEnd[eid] = gameTime + SIEGE_PACK_TIME;
    }
  }
}

export function vikingTransform(world: World, units: number[]): void {
  for (const eid of units) {
    if (unitType[eid] !== UnitType.Viking) continue;
    if (hpCurrent[eid] <= 0) continue;

    if (isAir[eid] === 1) {
      // Fighter (air) → Assault (ground)
      isAir[eid] = 0;
      canTargetGround[eid] = 1;
      canTargetAir[eid] = 0;
      atkRange[eid] = 5 * TILE_SIZE;
      atkDamage[eid] = 12;
    } else {
      // Assault (ground) → Fighter (air)
      isAir[eid] = 1;
      canTargetGround[eid] = 0;
      canTargetAir[eid] = 1;
      atkRange[eid] = 9 * TILE_SIZE;
      atkDamage[eid] = 10;
    }
  }
}

function stopUnits(world: World, units: number[]): void {
  for (const eid of units) {
    targetEntity[eid] = -1;
    commandMode[eid] = CommandMode.Idle;
    moveTargetX[eid] = -1;
    moveTargetY[eid] = -1;
    movePathIndex[eid] = -1;
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
  }
}

function holdUnits(world: World, units: number[]): void {
  for (const eid of units) {
    targetEntity[eid] = -1;
    commandMode[eid] = CommandMode.HoldPosition;
    movePathIndex[eid] = -1;
    velX[eid] = 0;
    velY[eid] = 0;
    workerState[eid] = WorkerState.Idle;
    workerTargetEid[eid] = -1;
  }
}

function getSelectedBuildings(world: World): number[] {
  const buildings: number[] = [];
  const bits = SELECTABLE | POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (selected[eid] !== 1) continue;
    if (buildState[eid] !== BuildState.Complete) continue;
    buildings.push(eid);
  }
  return buildings;
}

function handleProductionCommand(
  world: World,
  cmd: GameCommand,
  resources: Record<number, PlayerResources>,
): void {
  const buildings = getSelectedBuildings(world);
  if (buildings.length === 0) return;

  const slotIndex = cmd.data ?? 0;

  for (const eid of buildings) {
    // Check if queue is full (current production + queue items)
    const qLen = prodQueueLen[eid];
    const totalQueued = (prodUnitType[eid] !== 0 ? 1 : 0) + qLen;
    if (totalQueued >= PROD_QUEUE_MAX) continue; // Queue full

    const bDef = BUILDING_DEFS[buildingType[eid]];
    if (!bDef || slotIndex >= bDef.produces.length) continue;

    const uType = bDef.produces[slotIndex];
    const uDef = UNIT_DEFS[uType];
    if (!uDef) continue;

    const fac = faction[eid];
    const res = resources[fac];
    if (!res) continue;

    // Check resources
    if (res.minerals < uDef.costMinerals || res.gas < uDef.costGas) continue;

    // Check supply
    if (res.supplyUsed >= res.supplyProvided) continue;

    // Deduct cost
    res.minerals -= uDef.costMinerals;
    res.gas -= uDef.costGas;

    // If nothing is currently producing, start immediately
    if (prodUnitType[eid] === 0) {
      prodUnitType[eid] = uType;
      prodProgress[eid] = uDef.buildTime;
      prodTimeTotal[eid] = uDef.buildTime;
    } else {
      // Add to queue
      const qBase = eid * PROD_QUEUE_MAX;
      prodQueue[qBase + qLen] = uType;
      prodQueueLen[eid] = qLen + 1;
    }
    break; // Only queue on the first available building
  }
}

/** Cancel selected buildings under construction — refund 75% of cost, destroy the building */
function cancelSelectedBuildings(world: World, resources: Record<number, PlayerResources>): void {
  const bits = SELECTABLE | POSITION | BUILDING;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (selected[eid] !== 1) continue;
    if (buildState[eid] !== BuildState.UnderConstruction) continue;

    const fac = faction[eid];
    const res = resources[fac];
    const bDef = BUILDING_DEFS[buildingType[eid]];

    // Refund 75% of mineral/gas cost
    if (res && bDef) {
      res.minerals += Math.floor(bDef.costMinerals * 0.75);
      res.gas += Math.floor(bDef.costGas * 0.75);
    }

    // Kill the building (DeathSystem will clean up tiles, release builder)
    hpCurrent[eid] = 0;
  }
}

export function issuePathCommand(
  world: World,
  units: number[],
  tx: number,
  ty: number,
  map: MapData,
  mode: CommandMode,
  shiftQueue: boolean = false,
): void {
  const cols = Math.ceil(Math.sqrt(units.length));
  const spacing = TILE_SIZE * 0.8;

  for (let i = 0; i < units.length; i++) {
    const eid = units[i];

    // Sieged tanks can't move
    if (siegeMode[eid] === SiegeMode.Sieged || siegeMode[eid] === SiegeMode.Packing || siegeMode[eid] === SiegeMode.Unpacking) {
      continue;
    }

    const row = Math.floor(i / cols);
    const col = i % cols;
    const offsetX = (col - (cols - 1) / 2) * spacing;
    const offsetY = (row - Math.floor(units.length / cols - 1) / 2) * spacing;

    const destX = tx + offsetX;
    const destY = ty + offsetY;

    const startTile = worldToTile(posX[eid], posY[eid]);
    let endTile = worldToTile(destX, destY);

    // If destination is unwalkable, find nearest walkable tile
    if (endTile.col >= 0 && endTile.col < map.cols && endTile.row >= 0 && endTile.row < map.rows) {
      if (map.walkable[endTile.row * map.cols + endTile.col] !== 1) {
        const walkable = findNearestWalkableTile(map, endTile.col, endTile.row);
        if (walkable) endTile = walkable;
      }
    }

    // For shift-queue: path from the END of current path to destination
    let pathStartCol = startTile.col;
    let pathStartRow = startTile.row;
    if (shiftQueue && movePathIndex[eid] >= 0 && pathLengths[eid] > 0) {
      // Use the last waypoint of the current path as the start
      const lastIdx = pathLengths[eid] - 1;
      const lastWp = getPathWaypoint(eid, lastIdx);
      if (lastWp) {
        const lastTile = worldToTile(lastWp[0], lastWp[1]);
        pathStartCol = lastTile.col;
        pathStartRow = lastTile.row;
      }
    }

    const tilePath = findPath(map, pathStartCol, pathStartRow, endTile.col, endTile.row);

    if (tilePath.length > 0) {
      const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
        const wp = tileToWorld(c, r);
        return [wp.x, wp.y] as [number, number];
      });
      if (shiftQueue) {
        appendPath(eid, worldPath);
      } else {
        setPath(eid, worldPath);
      }
    }

    moveTargetX[eid] = destX;
    moveTargetY[eid] = destY;
    if (!shiftQueue) {
      targetEntity[eid] = -1;
      commandMode[eid] = mode;
      velX[eid] = 0;
      velY[eid] = 0;
      workerState[eid] = WorkerState.Idle;
      workerTargetEid[eid] = -1;
    }
  }
}
