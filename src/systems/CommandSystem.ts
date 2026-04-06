import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, SELECTABLE, MOVEMENT, UNIT_TYPE, BUILDING, HEALTH,
  posX, posY, selected, moveTargetX, moveTargetY, hpMax,
  setPath, appendPath, getPathWaypoint, pathLengths, faction, movePathIndex, unitType, velX, velY,
  targetEntity, commandMode,
  patrolOriginX, patrolOriginY,
  stimEndTime, hpCurrent, moveSpeed, atkCooldown,
  siegeMode, siegeTransitionEnd,
  rallyX, rallyY, rallyTargetEid, buildState, buildingType, prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  energy,
  isAir, canTargetGround, canTargetAir, atkRange, atkDamage, bonusDmg, bonusVsTag,
  atkLastTime,
  renderWidth, renderHeight, atkSplash,
} from '../ecs/components';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import { findEnemyAt, findResourceAt, findBuildingAt, findFriendlyAt, findFriendlyBuildingAt, hasCompletedBuilding } from '../ecs/queries';
import { CommandType, type GameCommand } from '../input/CommandQueue';
import type { MapData } from '../map/MapData';
import { worldToTile, tileToWorld, findNearestWalkableTile, markBuildingTiles, clearBuildingTiles } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import {
  Faction, CommandMode, UnitType, SiegeMode, BuildState, BuildingType, ArmorClass, TILE_SIZE, isHQType, UpgradeType,
  STIM_DURATION, STIM_HP_COST, STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_PACK_TIME,
  EMP_RANGE, EMP_RADIUS, EMP_ENERGY_DRAIN, EMP_ENERGY_COST,
} from '../constants';
import type { PlayerResources } from '../types';
import type { Viewport } from 'pixi-viewport';
import { addCommandPing } from '../rendering/UnitRenderer';
import { emitProjectile } from '../rendering/ProjectileRenderer';
import { simplifyPath } from '../utils/pathUtils';
import { damageEvents } from './CombatSystem';
import { soundManager } from '../audio/SoundManager';
import { triggerCameraShake } from '../rendering/CameraShake';

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
  playerFaction: Faction = Faction.IronLegion,
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
        issuePathCommand(world, units, cmd.wx!, cmd.wy!, map, CommandMode.Patrol, cmd.shiftHeld ?? false);
        addCommandPing(cmd.wx!, cmd.wy!, 0xffaa00, gameTime);
        break;
      }

      case CommandType.Stim:
        if (cmd.units && resources && resources[playerFaction]?.upgrades[UpgradeType.FactionAbility1]) {
          applyStim(world, cmd.units, gameTime);
          soundManager.playStimActivation();
        }
        break;

      case CommandType.SiegeToggle:
        if (cmd.units) {
          // Siege mode requires FactionAbility2 research
          const hasSiegeTech = resources && resources[playerFaction]?.upgrades[UpgradeType.FactionAbility2];
          if (hasSiegeTech) toggleSiegeMode(world, cmd.units, gameTime);
          soundManager.playSiegeMode();
        }
        break;

      case CommandType.EMP: {
        if (!cmd.units) break;
        const EMP_RANGE_PX = EMP_RANGE * TILE_SIZE;
        const EMP_RADIUS_PX = EMP_RADIUS * TILE_SIZE;
        const EMP_RADIUS_SQ = EMP_RADIUS_PX * EMP_RADIUS_PX;
        for (const eid of cmd.units) {
          if (unitType[eid] !== UnitType.Disruptor) continue;
          if (hpCurrent[eid] <= 0) continue;
          if (energy[eid] < EMP_ENERGY_COST) continue;
          // Range check: cast location must be within cast range
          const dxR = cmd.wx! - posX[eid];
          const dyR = cmd.wy! - posY[eid];
          if (dxR * dxR + dyR * dyR > EMP_RANGE_PX * EMP_RANGE_PX) continue;
          energy[eid] -= EMP_ENERGY_COST;
          const myFac = faction[eid];
          // Drain energy from all enemy units in radius
          for (let other = 1; other < world.nextEid; other++) {
            if (!hasComponents(world, other, POSITION | HEALTH)) continue;
            if (faction[other] === myFac || faction[other] === 0) continue;
            if (hpCurrent[other] <= 0) continue;
            const dx = posX[other] - cmd.wx!;
            const dy = posY[other] - cmd.wy!;
            if (dx * dx + dy * dy <= EMP_RADIUS_SQ) {
              energy[other] = Math.max(0, energy[other] - EMP_ENERGY_DRAIN);
            }
          }
          addCommandPing(cmd.wx!, cmd.wy!, 0x00ccff, gameTime);
          break; // only one caster per command
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
          issuePathCommand(world, units, cmd.wx!, cmd.wy!, map, CommandMode.AttackMove, cmd.shiftHeld ?? false);
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
          rallyTargetEid[eid] = 0;
        }

        if (units.length === 0) break;

        // Check enemy — set target and path the closest unit immediately; CombatSystem handles the rest
        const enemy = findEnemyAt(world, wx, wy, playerFaction);
        if (enemy > 0) {
          let firstPathed = false;
          for (const eid of units) {
            targetEntity[eid] = enemy;
            commandMode[eid] = CommandMode.AttackTarget;
            // Path only the first unit immediately; others chase via CombatSystem next tick
            if (!firstPathed) {
              const startTile = worldToTile(posX[eid], posY[eid]);
              const endTile = worldToTile(posX[enemy], posY[enemy]);
              const chasePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);
              if (chasePath.length > 0) {
                const wp = chasePath.map(([c, r]) => {
                  const p = tileToWorld(c, r);
                  return [p.x, p.y] as [number, number];
                });
                setPath(eid, wp);
              }
              firstPathed = true;
            } else {
              movePathIndex[eid] = -1;
            }
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
    if (ut !== UnitType.Trooper) continue;

    // Already stimmed — just refresh duration
    if (stimEndTime[eid] > gameTime) {
      stimEndTime[eid] = gameTime + STIM_DURATION;
      continue;
    }

    // Can't stim if it would kill the unit
    if (hpCurrent[eid] <= STIM_HP_COST) continue;

    // Apply stim
    hpCurrent[eid] -= STIM_HP_COST;
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

function stopUnits(world: World, units: number[]): void {
  for (const eid of units) {
    targetEntity[eid] = -1;
    commandMode[eid] = CommandMode.Idle;
    moveTargetX[eid] = -1;
    moveTargetY[eid] = -1;
    movePathIndex[eid] = -1;
  }
}

function holdUnits(world: World, units: number[]): void {
  for (const eid of units) {
    targetEntity[eid] = -1;
    commandMode[eid] = CommandMode.HoldPosition;
    movePathIndex[eid] = -1;
    velX[eid] = 0;
    velY[eid] = 0;
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

/** Tech building required before a unit can be trained */
const UNIT_TECH_REQS: Partial<Record<number, number>> = {
  // Iron Legion
  [UnitType.Grenadier]:   BuildingType.Barracks,
  [UnitType.Medic]:       BuildingType.Barracks,
  [UnitType.Humvee]:      BuildingType.WarFactory,
  [UnitType.SiegeTank]:   BuildingType.WarFactory,
  [UnitType.Gunship]:     BuildingType.Airfield,
  [UnitType.TitanWalker]: BuildingType.CommandUplink,
  // Swarm
  [UnitType.Spitter]:     BuildingType.SpawnPit,
  [UnitType.Burrower]:    BuildingType.SpawnPit,
  [UnitType.Broodmother]: BuildingType.EvolutionDen,
  [UnitType.Ravager]:     BuildingType.EvolutionDen,
  [UnitType.Flyer]:       BuildingType.Rookery,
  [UnitType.Leviathan]:   BuildingType.ApexChamber,
  // Arcane Covenant
  [UnitType.Warden]:        BuildingType.Gateway,
  [UnitType.Enchanter]:     BuildingType.Gateway,
  [UnitType.BlinkAssassin]: BuildingType.ArcaneLibrary,
  [UnitType.StormCaller]:   BuildingType.ArcaneLibrary,
  [UnitType.Golem]:         BuildingType.Observatory,
  [UnitType.Archmage]:      BuildingType.NexusPrime,
  // Automata
  [UnitType.Shredder]:    BuildingType.AssemblyLine,
  [UnitType.RepairDrone]: BuildingType.AssemblyLine,
  [UnitType.Crawler]:     BuildingType.AdvancedForge,
  [UnitType.Disruptor]:   BuildingType.AdvancedForge,
  [UnitType.Harvester]:   BuildingType.Skyport,
  [UnitType.Colossus]:    BuildingType.OmegaReactor,
};

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

    // Check tech requirement
    const techReq = UNIT_TECH_REQS[uType];
    if (techReq !== undefined && !hasCompletedBuilding(world, fac as Faction, techReq as BuildingType)) continue;

    // Check resources
    if (res.minerals < uDef.costMinerals || res.gas < uDef.costGas) continue;

    // Check supply
    if (uDef.supply > 0 && res.supplyUsed + uDef.supply > res.supplyProvided) continue;

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
  if (units.length === 0) return;

  // Compute relative position offsets from lead unit (position preservation)
  const leadEidForOffset = units[0];

  // No group speed restriction — each unit moves at its own speed

  // Calculate ONE lead path from the first unit to destination
  const leadEid = units[0];
  const leadStart = worldToTile(posX[leadEid], posY[leadEid]);
  let mainEndTile = worldToTile(tx, ty);
  if (mainEndTile.col >= 0 && mainEndTile.col < map.cols && mainEndTile.row >= 0 && mainEndTile.row < map.rows) {
    if (map.walkable[mainEndTile.row * map.cols + mainEndTile.col] !== 1) {
      const walkable = findNearestWalkableTile(map, mainEndTile.col, mainEndTile.row);
      if (walkable) mainEndTile = walkable;
    }
  }

  const leadTilePath = findPath(map, leadStart.col, leadStart.row, mainEndTile.col, mainEndTile.row);
  if (leadTilePath.length === 0 && units.length > 0) {
    // No path found — still set mode and clear state for all units
    for (const eid of units) {
      if (!shiftQueue) {
        targetEntity[eid] = -1;
        commandMode[eid] = mode;
        velX[eid] = 0;
        velY[eid] = 0;
      }
    }
    return;
  }

  // Convert lead path to world coordinates and simplify (remove collinear waypoints)
  const rawWorldPath: Array<[number, number]> = leadTilePath.map(([c, r]) => {
    const wp = tileToWorld(c, r);
    return [wp.x, wp.y] as [number, number];
  });
  const leadWorldPath = simplifyPath(rawWorldPath);

  for (let i = 0; i < units.length; i++) {
    const eid = units[i];

    if (siegeMode[eid] === SiegeMode.Sieged || siegeMode[eid] === SiegeMode.Packing || siegeMode[eid] === SiegeMode.Unpacking) {
      continue;
    }

    // Compact formation: units converge toward destination in a tight cluster
    // Use relative positions but compress aggressively so group arrives together
    let offsetX = posX[eid] - posX[leadEidForOffset];
    let offsetY = posY[eid] - posY[leadEidForOffset];
    const offsetDist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    // Scale spread with group size: small groups (2 tiles), larger groups wider (4 tiles)
    const maxSpread = Math.min(4, 1.5 + units.length / 15) * TILE_SIZE;
    if (offsetDist > 0) {
      const scale = Math.min(1, maxSpread / offsetDist);
      offsetX *= scale;
      offsetY *= scale;
    }

    // Every unit paths individually from its own position to its offset destination
    let unitPath: Array<[number, number]>;
    const unitStart = worldToTile(posX[eid], posY[eid]);
    const destX = tx + offsetX;
    const destY = ty + offsetY;
    let unitEnd = worldToTile(destX, destY);
    // Ensure destination is walkable
    if (unitEnd.col >= 0 && unitEnd.col < map.cols && unitEnd.row >= 0 && unitEnd.row < map.rows) {
      if (map.walkable[unitEnd.row * map.cols + unitEnd.col] !== 1) {
        const wk = findNearestWalkableTile(map, unitEnd.col, unitEnd.row);
        if (wk) unitEnd = wk;
      }
    }
    const indivPath = (unitStart.col === unitEnd.col && unitStart.row === unitEnd.row)
      ? [[unitEnd.col, unitEnd.row] as [number, number]]
      : findPath(map, unitStart.col, unitStart.row, unitEnd.col, unitEnd.row);
    if (indivPath.length > 0) {
      unitPath = simplifyPath(indivPath.map(([c, r]) => {
        const wp = tileToWorld(c, r);
        return [wp.x, wp.y] as [number, number];
      }));
    } else {
      // Fallback: direct line to destination (stuck detection will repath if needed)
      unitPath = [[destX, destY] as [number, number]];
    }

    // Verify final waypoint is walkable; snap to nearest walkable if not
    if (unitPath.length > 0) {
      const lastIdx = unitPath.length - 1;
      const [lastX, lastY] = unitPath[lastIdx];
      const lastTile = worldToTile(lastX, lastY);
      if (lastTile.col >= 0 && lastTile.col < map.cols && lastTile.row >= 0 && lastTile.row < map.rows) {
        if (map.walkable[lastTile.row * map.cols + lastTile.col] !== 1) {
          const wk = findNearestWalkableTile(map, lastTile.col, lastTile.row);
          if (wk) {
            const wp = tileToWorld(wk.col, wk.row);
            unitPath[lastIdx] = [wp.x, wp.y];
          }
        }
      }
    }

    if (shiftQueue) {
      appendPath(eid, unitPath);
    } else {
      setPath(eid, unitPath);
    }

    moveTargetX[eid] = tx + offsetX;
    moveTargetY[eid] = ty + offsetY;
    if (!shiftQueue) {
      targetEntity[eid] = -1;
      commandMode[eid] = mode;
      velX[eid] = 0;
      velY[eid] = 0;
    }
  }
}
