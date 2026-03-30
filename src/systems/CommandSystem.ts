import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, SELECTABLE, MOVEMENT, UNIT_TYPE, BUILDING,
  posX, posY, selected, moveTargetX, moveTargetY,
  setPath, faction, movePathIndex, unitType,
  targetEntity, commandMode,
  stimEndTime, hpCurrent, moveSpeed, atkCooldown,
  siegeMode, siegeTransitionEnd,
  workerState, workerTargetEid, resourceType,
  rallyX, rallyY, buildState, buildingType, prodUnitType, prodProgress, prodTimeTotal,
} from '../ecs/components';
import { UNIT_DEFS } from '../data/units';
import { BUILDING_DEFS } from '../data/buildings';
import { findEnemyAt, findResourceAt } from '../ecs/queries';
import type { InputState } from '../input/InputManager';
import type { MapData } from '../map/MapData';
import { worldToTile, tileToWorld, findNearestWalkableTile } from '../map/MapData';
import { findPath } from '../map/Pathfinder';
import {
  Faction, CommandMode, UnitType, SiegeMode, ResourceType, WorkerState, BuildState, TILE_SIZE,
  STIM_DURATION, STIM_HP_COST, STIM_SPEED_MULT, STIM_COOLDOWN_MULT,
  SIEGE_PACK_TIME,
} from '../constants';
import type { PlayerResources } from '../types';
import type { Viewport } from 'pixi-viewport';
import { addCommandPing } from '../rendering/UnitRenderer';

/** Attack-move mode: set by pressing A, consumed by next left-click */
export let attackMoveMode = false;

/**
 * Translates player input into move/attack/attack-move commands for selected units.
 * Also handles ability hotkeys (T = stim, E = siege mode).
 * Handles rally points for buildings and production hotkeys.
 */
export function commandSystem(
  world: World,
  input: InputState,
  viewport: Viewport,
  map: MapData,
  gameTime: number,
  resources?: Record<number, PlayerResources>,
): void {
  const m = input.mouse;

  // Production hotkeys (Q = produce first unit, W = produce second)
  if (resources && (input.keysJustPressed.has('KeyQ') || input.keysJustPressed.has('KeyW'))) {
    handleProductionHotkey(world, input, resources);
  }

  // A key toggles attack-move mode
  if (input.keysJustPressed.has('KeyA')) {
    attackMoveMode = true;
  }

  // Escape cancels attack-move mode
  if (input.keysJustPressed.has('Escape')) {
    attackMoveMode = false;
  }

  // S key = stop command
  if (input.keysJustPressed.has('KeyS')) {
    stopSelectedUnits(world);
    return;
  }

  // H key = hold position
  if (input.keysJustPressed.has('KeyH')) {
    stopSelectedUnits(world);
    return;
  }

  // T key = Stim Pack (Marines only)
  if (input.keysJustPressed.has('KeyT')) {
    applyStim(world, gameTime);
  }

  // E key = Siege Mode toggle (Siege Tanks only)
  if (input.keysJustPressed.has('KeyE')) {
    toggleSiegeMode(world, gameTime);
  }

  // Attack-move: A + left-click on ground
  if (attackMoveMode && m.leftJustReleased && !m.isDragging) {
    attackMoveMode = false;
    const worldPos = viewport.toWorld(m.x, m.y);
    const selectedUnits = getSelectedUnits(world);
    if (selectedUnits.length === 0) return;

    const enemy = findEnemyAt(world, worldPos.x, worldPos.y, Faction.Terran);
    if (enemy > 0) {
      for (const eid of selectedUnits) {
        targetEntity[eid] = enemy;
        commandMode[eid] = CommandMode.AttackTarget;
      }
      return;
    }

    issuePathCommand(world, selectedUnits, worldPos.x, worldPos.y, map, CommandMode.AttackMove);
    return;
  }

  // Right-click = move or attack or rally
  if (!m.rightJustPressed) return;
  attackMoveMode = false;

  const worldPos = viewport.toWorld(m.x, m.y);

  // Set rally point for selected buildings
  const selectedBuildings = getSelectedBuildings(world);
  for (const eid of selectedBuildings) {
    rallyX[eid] = worldPos.x;
    rallyY[eid] = worldPos.y;
  }

  const selectedUnits = getSelectedUnits(world);
  if (selectedUnits.length === 0) return;

  // Check if right-clicking on a mineral patch (gather command for workers)
  const resource = findResourceAt(world, worldPos.x, worldPos.y);
  if (resource > 0 && resourceType[resource] === ResourceType.Mineral) {
    const workers: number[] = [];
    const nonWorkers: number[] = [];
    for (const eid of selectedUnits) {
      const ut = unitType[eid] as UnitType;
      if (ut === UnitType.SCV || ut === UnitType.Drone) {
        workers.push(eid);
      } else {
        nonWorkers.push(eid);
      }
    }
    // Workers get gather command
    for (const eid of workers) {
      workerTargetEid[eid] = resource;
      workerState[eid] = WorkerState.MovingToResource;
      commandMode[eid] = CommandMode.Gather;
      targetEntity[eid] = -1;
      // Path to nearest walkable tile adjacent to resource
      const resTile = worldToTile(posX[resource], posY[resource]);
      const walkable = findNearestWalkableTile(map, resTile.col, resTile.row);
      if (walkable) {
        const startTile = worldToTile(posX[eid], posY[eid]);
        const tilePath = findPath(map, startTile.col, startTile.row, walkable.col, walkable.row);
        if (tilePath.length > 0) {
          const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
            const wp = tileToWorld(c, r);
            return [wp.x, wp.y] as [number, number];
          });
          setPath(eid, worldPath);
        }
      }
    }
    // Non-workers get a move command to the area
    if (nonWorkers.length > 0) {
      issuePathCommand(world, nonWorkers, worldPos.x, worldPos.y, map, CommandMode.Move);
    }
    if (workers.length > 0) {
      addCommandPing(worldPos.x, worldPos.y, 0x44bbff, gameTime);
    }
    return;
  }

  const enemy = findEnemyAt(world, worldPos.x, worldPos.y, Faction.Terran);
  if (enemy > 0) {
    for (const eid of selectedUnits) {
      targetEntity[eid] = enemy;
      commandMode[eid] = CommandMode.AttackTarget;
    }
    addCommandPing(worldPos.x, worldPos.y, 0xff4444, gameTime);
    return;
  }

  issuePathCommand(world, selectedUnits, worldPos.x, worldPos.y, map, CommandMode.Move);
  addCommandPing(worldPos.x, worldPos.y, 0x44ff44, gameTime);
}

function applyStim(world: World, gameTime: number): void {
  const units = getSelectedUnits(world);
  for (const eid of units) {
    if (unitType[eid] !== UnitType.Marine) continue;

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

function toggleSiegeMode(world: World, gameTime: number): void {
  const units = getSelectedUnits(world);
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

function getSelectedUnits(world: World): number[] {
  const units: number[] = [];
  const bits = SELECTABLE | POSITION | MOVEMENT;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (selected[eid] !== 1) continue;
    if (faction[eid] !== Faction.Terran) continue;
    units.push(eid);
  }
  return units;
}

function issuePathCommand(
  world: World,
  units: number[],
  tx: number,
  ty: number,
  map: MapData,
  mode: CommandMode,
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
    const endTile = worldToTile(destX, destY);
    const tilePath = findPath(map, startTile.col, startTile.row, endTile.col, endTile.row);

    if (tilePath.length > 0) {
      const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
        const wp = tileToWorld(c, r);
        return [wp.x, wp.y] as [number, number];
      });
      setPath(eid, worldPath);
    }

    moveTargetX[eid] = destX;
    moveTargetY[eid] = destY;
    targetEntity[eid] = -1;
    commandMode[eid] = mode;
  }
}

function stopSelectedUnits(world: World): void {
  const units = getSelectedUnits(world);
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

function handleProductionHotkey(
  world: World,
  input: InputState,
  resources: Record<number, PlayerResources>,
): void {
  const buildings = getSelectedBuildings(world);
  if (buildings.length === 0) return;

  const isQ = input.keysJustPressed.has('KeyQ');
  const slotIndex = isQ ? 0 : 1;

  for (const eid of buildings) {
    if (prodUnitType[eid] !== 0) continue; // Already producing

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

    // Start production
    prodUnitType[eid] = uType;
    prodProgress[eid] = uDef.buildTime;
    prodTimeTotal[eid] = uDef.buildTime;
    break; // Only queue on the first available building
  }
}
