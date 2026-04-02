import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, SELECTABLE,
  posX, posY, renderWidth, renderHeight,
  selected, faction, RENDERABLE, UNIT_TYPE, BUILDING,
  unitType,
} from '../ecs/components';
import { CommandType, type GameCommand } from '../input/CommandQueue';
import { Faction } from '../constants';
import type { Viewport } from 'pixi-viewport';
import { soundManager } from '../audio/SoundManager';

// Control groups: 10 groups (0-9), each stores a set of entity IDs
const controlGroups: Set<number>[] = Array.from({ length: 10 }, () => new Set());

// Subgroup cycling state
let subgroupIndex = 0;

// Last recalled control group (for active highlight in UI)
let lastActiveGroup = -1;

/** Get entity counts for all 10 control groups (0-9). */
export function getControlGroupInfo(): Array<{ count: number }> {
  return controlGroups.map(group => ({ count: group.size }));
}

/** Get the last recalled control group number, or -1 if none. */
export function getLastActiveGroup(): number { return lastActiveGroup; }

/** Get the current subgroup cycling index (for Tab breadcrumb display). */
export function getActiveSubgroupIndex(): number { return subgroupIndex; }

/**
 * Handles click and drag-box unit selection.
 * Selects player (Terran) units/buildings. Single-click can also select neutral resources.
 */
export function selectionSystem(
  world: World,
  commands: GameCommand[],
  viewport: Viewport,
  playerFaction: Faction = Faction.Terran,
  extraTolerance = 0,
): void {
  for (const cmd of commands) {
    switch (cmd.type) {
      case CommandType.ControlGroupAssign:
        if (cmd.data !== undefined) {
          controlGroups[cmd.data].clear();
          for (let eid = 1; eid < world.nextEid; eid++) {
            if (selected[eid] === 1 && faction[eid] === playerFaction) {
              controlGroups[cmd.data].add(eid);
            }
          }
        }
        break;

      case CommandType.ControlGroupRecall:
        if (cmd.data !== undefined) {
          const group = controlGroups[cmd.data];
          if (group.size > 0) {
            lastActiveGroup = cmd.data;
            clearSelection(world);
            for (const eid of group) {
              if (entityExists(world, eid) && hasComponents(world, eid, SELECTABLE)) {
                selected[eid] = 1;
              } else {
                group.delete(eid);
              }
            }
          }
        }
        break;

      case CommandType.Select: {
        // Ctrl+click: filter current selection to clicked unit's type
        if (cmd.data === 1) {
          const worldPos = viewport.toWorld(cmd.sx!, cmd.sy!);
          const closest = findUnitAt(world, worldPos.x, worldPos.y, extraTolerance);
          if (closest > 0 && hasComponents(world, closest, UNIT_TYPE)) {
            const clickedType = unitType[closest];
            for (let eid = 1; eid < world.nextEid; eid++) {
              if (selected[eid] !== 1) continue;
              if (!hasComponents(world, eid, UNIT_TYPE) || unitType[eid] !== clickedType) {
                selected[eid] = 0;
              }
            }
          }
          break;
        }
        // Single click — sx/sy are screen coords
        if (!cmd.shiftHeld) clearSelection(world);
        const worldPos = viewport.toWorld(cmd.sx!, cmd.sy!);
        const closest = findUnitAt(world, worldPos.x, worldPos.y, extraTolerance);
        if (closest > 0) {
          const fac = faction[closest];
          if (fac === playerFaction || fac === Faction.None) {
            selected[closest] = selected[closest] === 1 && cmd.shiftHeld ? 0 : 1;
          }
        }
        // Play select sound
        let firstType = 0;
        for (let eid2 = 1; eid2 < world.nextEid; eid2++) {
          if (selected[eid2] === 1 && hasComponents(world, eid2, UNIT_TYPE)) {
            firstType = unitType[eid2];
            break;
          }
        }
        if (firstType > 0) {
          soundManager.playSelectUnit(firstType);
          soundManager.playVoiceLine(firstType, 'select');
        } else {
          soundManager.playSelect();
        }
        break;
      }

      case CommandType.DoubleClickSelect: {
        // Double-click: select all on-screen units of same type
        if (!cmd.shiftHeld) clearSelection(world);
        const worldPos = viewport.toWorld(cmd.sx!, cmd.sy!);
        const closest = findUnitAt(world, worldPos.x, worldPos.y, extraTolerance);
        if (closest > 0 && faction[closest] === playerFaction && hasComponents(world, closest, UNIT_TYPE)) {
          selected[closest] = 1;
          const uType = unitType[closest];
          const screenW = viewport.screenWidth;
          const screenH = viewport.screenHeight;
          for (let eid2 = 1; eid2 < world.nextEid; eid2++) {
            if (!hasComponents(world, eid2, POSITION | SELECTABLE | UNIT_TYPE)) continue;
            if (faction[eid2] !== playerFaction) continue;
            if (unitType[eid2] !== uType) continue;
            const screen = viewport.toScreen(posX[eid2], posY[eid2]);
            if (screen.x >= 0 && screen.x <= screenW && screen.y >= 0 && screen.y <= screenH) {
              selected[eid2] = 1;
            }
          }
          soundManager.playSelectUnit(uType);
        }
        break;
      }

      case CommandType.BoxSelect: {
        // Drag box — sx/sy = start screen, sx2/sy2 = end screen
        const startWorld = viewport.toWorld(cmd.sx!, cmd.sy!);
        const endWorld = viewport.toWorld(cmd.sx2!, cmd.sy2!);
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);

        if (!cmd.shiftHeld) clearSelection(world);

        const bits = POSITION | SELECTABLE;
        for (let eid = 1; eid < world.nextEid; eid++) {
          if (!hasComponents(world, eid, bits)) continue;
          if (faction[eid] !== playerFaction) continue;
          const x = posX[eid];
          const y = posY[eid];
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            selected[eid] = 1;
          }
        }
        soundManager.playSelect();
        break;
      }

      case CommandType.CycleSubgroup:
        cycleSubgroup(world, playerFaction);
        break;
    }
  }
}

function clearSelection(world: World): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    selected[eid] = 0;
  }
}

/**
 * Cycle selection through subgroups of the current selection, grouped by unit type.
 * Each Tab press selects only the entities of the next unit type in the current selection.
 */
function cycleSubgroup(world: World, playerFaction: Faction): void {
  // Collect all currently selected player-faction unit-type entities
  const bits = SELECTABLE | UNIT_TYPE;
  const typeToEids = new Map<number, number[]>();

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (selected[eid] !== 1) continue;
    if (!hasComponents(world, eid, bits)) continue;
    if (faction[eid] !== playerFaction) continue;
    const ut = unitType[eid];
    let group = typeToEids.get(ut);
    if (!group) { group = []; typeToEids.set(ut, group); }
    group.push(eid);
  }

  const types = Array.from(typeToEids.keys()).sort((a, b) => a - b);
  if (types.length <= 1) return; // Nothing to cycle through

  subgroupIndex = (subgroupIndex + 1) % types.length;
  const activeType = types[subgroupIndex];

  // Deselect all, then select only the active subgroup
  for (let eid = 1; eid < world.nextEid; eid++) {
    selected[eid] = 0;
  }
  const activeEids = typeToEids.get(activeType)!;
  for (const eid of activeEids) {
    selected[eid] = 1;
  }
}

function findUnitAt(world: World, wx: number, wy: number, extraTolerance = 0): number {
  const bits = POSITION | SELECTABLE | RENDERABLE;
  const TOLERANCE = 12;

  // Pass 1: prefer units over buildings
  let closestEid = 0;
  let closestDist = Infinity;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (hasComponents(world, eid, BUILDING)) continue; // skip buildings in pass 1
    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + TOLERANCE + extraTolerance;
    const halfH = renderHeight[eid] / 2 + TOLERANCE + extraTolerance;
    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) { closestDist = dist; closestEid = eid; }
    }
  }
  if (closestEid > 0) return closestEid;

  // Pass 2: fall back to buildings
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;
    if (!hasComponents(world, eid, BUILDING)) continue; // only buildings in pass 2
    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + TOLERANCE + extraTolerance;
    const halfH = renderHeight[eid] / 2 + TOLERANCE + extraTolerance;
    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) { closestDist = dist; closestEid = eid; }
    }
  }
  return closestEid;
}
