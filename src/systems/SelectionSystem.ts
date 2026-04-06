import { type World, hasComponents, entityExists } from '../ecs/world';
import {
  POSITION, SELECTABLE,
  posX, posY, renderWidth, renderHeight,
  selected, faction, RENDERABLE, UNIT_TYPE, BUILDING,
  unitType, hpCurrent, buildingType,
} from '../ecs/components';
import { CommandType, type GameCommand } from '../input/CommandQueue';
import { Faction } from '../constants';
import type { Viewport } from 'pixi-viewport';
import { soundManager } from '../audio/SoundManager';

// Control groups: 10 groups (0-9), each stores a set of entity IDs
const controlGroups: Set<number>[] = Array.from({ length: 10 }, () => new Set());

// Signal for double-tap center camera (read by Game.ts)
export let controlGroupCenterX = 0;
export let controlGroupCenterY = 0;
export let controlGroupCenterFrame = 0;

// Subgroup cycling state
let subgroupIndex = 0;
let buildingCycleIndex = 0;

// Last recalled control group (for active highlight in UI)
let lastActiveGroup = -1;

export interface ControlGroupSlot {
  count: number;
  types: Record<number, number>; // unitType → alive count
  eids: number[];                // alive entity IDs
}

/** Get detailed info for all 10 control groups (0-9), filtering dead entities. */
export function getControlGroupInfo(world?: World): Array<ControlGroupSlot> {
  return controlGroups.map(group => {
    const types: Record<number, number> = {};
    const eids: number[] = [];
    for (const eid of group) {
      if (world && (!entityExists(world, eid) || hpCurrent[eid] <= 0)) {
        group.delete(eid); // lazy cleanup
        continue;
      }
      eids.push(eid);
      const ut = unitType[eid] || 0;
      types[ut] = (types[ut] || 0) + 1;
    }
    return { count: eids.length, types, eids };
  });
}

/** Get the last recalled control group number, or -1 if none. */
export function getLastActiveGroup(): number { return lastActiveGroup; }

/** Get the current subgroup cycling index (for Tab breadcrumb display). */
export function getActiveSubgroupIndex(): number { return subgroupIndex; }

/** Get the active subgroup's unit type, or -1 if no subgroup focus. */
export function getActiveSubgroupType(world: World, playerFaction: Faction): number {
  if (subgroupIndex < 0) return -1;
  const types = new Set<number>();
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (selected[eid] !== 1) continue;
    if (!hasComponents(world, eid, SELECTABLE | UNIT_TYPE)) continue;
    if (faction[eid] !== playerFaction) continue;
    types.add(unitType[eid]);
  }
  const sorted = Array.from(types).sort((a, b) => a - b);
  if (sorted.length <= 1) return -1;
  const idx = subgroupIndex % sorted.length;
  return sorted[idx];
}

/** Remove all entities of a specific unitType from a control group. */
export function removeTypeFromControlGroup(groupIndex: number, ut: number): void {
  const group = controlGroups[groupIndex];
  if (!group) return;
  for (const eid of group) {
    if (unitType[eid] === ut) {
      group.delete(eid);
    }
  }
}

/**
 * Handles click and drag-box unit selection.
 * Selects player (Terran) units/buildings. Single-click can also select neutral resources.
 */
export function selectionSystem(
  world: World,
  commands: GameCommand[],
  viewport: Viewport,
  playerFaction: Faction = Faction.IronLegion,
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

      case CommandType.ControlGroupAdd:
        if (cmd.data !== undefined) {
          for (let eid = 1; eid < world.nextEid; eid++) {
            if (selected[eid] === 1 && faction[eid] === playerFaction) {
              controlGroups[cmd.data].add(eid);
            }
          }
        }
        break;

      case CommandType.ControlGroupRecallCenter:
        // Double-tap: recall selection + signal camera center (handled by Game.ts)
        if (cmd.data !== undefined) {
          const grp = controlGroups[cmd.data];
          if (grp.size > 0) {
            lastActiveGroup = cmd.data;
            clearSelection(world);
            for (const eid of grp) {
              if (entityExists(world, eid) && hasComponents(world, eid, SELECTABLE)) {
                selected[eid] = 1;
              } else {
                grp.delete(eid);
              }
            }
            // Compute centroid and store for Game.ts to read
            let cx = 0, cy = 0, n = 0;
            for (const eid of grp) {
              if (entityExists(world, eid)) {
                cx += posX[eid]; cy += posY[eid]; n++;
              }
            }
            if (n > 0) {
              controlGroupCenterX = cx / n;
              controlGroupCenterY = cy / n;
              controlGroupCenterFrame++;
            }
          }
        }
        break;

      case CommandType.ControlGroupSteal:
        // Alt+#: remove from all other groups, assign to target group
        if (cmd.data !== undefined) {
          const selectedEids: number[] = [];
          for (let eid = 1; eid < world.nextEid; eid++) {
            if (selected[eid] === 1 && faction[eid] === playerFaction) {
              selectedEids.push(eid);
            }
          }
          // Remove from all groups
          for (let g = 0; g < 10; g++) {
            for (const eid of selectedEids) {
              controlGroups[g].delete(eid);
            }
          }
          // Add to target group
          for (const eid of selectedEids) {
            controlGroups[cmd.data].add(eid);
          }
        }
        break;

      case CommandType.Select: {
        lastActiveGroup = -1;
        // Ctrl+click: buildings → select all of same type; units → filter selection to type
        if (cmd.data === 1) {
          const worldPos = viewport.toWorld(cmd.sx!, cmd.sy!);
          const closest = findUnitAt(world, worldPos.x, worldPos.y, extraTolerance);
          if (closest > 0 && faction[closest] === playerFaction) {
            if (hasComponents(world, closest, BUILDING)) {
              // Building: select ALL of same building type globally
              const bt = buildingType[closest];
              clearSelection(world);
              for (let eid = 1; eid < world.nextEid; eid++) {
                if (!hasComponents(world, eid, BUILDING | SELECTABLE)) continue;
                if (faction[eid] !== playerFaction) continue;
                if (buildingType[eid] !== bt) continue;
                if (hpCurrent[eid] <= 0) continue;
                selected[eid] = 1;
              }
            } else if (hasComponents(world, closest, UNIT_TYPE)) {
              // Unit: filter existing selection to clicked type
              const clickedType = unitType[closest];
              for (let eid = 1; eid < world.nextEid; eid++) {
                if (selected[eid] !== 1) continue;
                if (!hasComponents(world, eid, UNIT_TYPE) || unitType[eid] !== clickedType) {
                  selected[eid] = 0;
                }
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
        lastActiveGroup = -1;
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
        lastActiveGroup = -1;
        // Drag box — sx/sy = start screen, sx2/sy2 = end screen
        const startWorld = viewport.toWorld(cmd.sx!, cmd.sy!);
        const endWorld = viewport.toWorld(cmd.sx2!, cmd.sy2!);
        const minX = Math.min(startWorld.x, endWorld.x);
        const maxX = Math.max(startWorld.x, endWorld.x);
        const minY = Math.min(startWorld.y, endWorld.y);
        const maxY = Math.max(startWorld.y, endWorld.y);

        if (!cmd.shiftHeld) clearSelection(world);

        // SC2 box select: if box contains both units and buildings, only select units
        const bits = POSITION | SELECTABLE;
        const unitEids: number[] = [];
        const buildingEids: number[] = [];
        for (let eid = 1; eid < world.nextEid; eid++) {
          if (!hasComponents(world, eid, bits)) continue;
          if (faction[eid] !== playerFaction) continue;
          const x = posX[eid];
          const y = posY[eid];
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            if (hasComponents(world, eid, BUILDING)) {
              buildingEids.push(eid);
            } else {
              unitEids.push(eid);
            }
          }
        }
        const toSelect = unitEids.length > 0 ? unitEids : buildingEids;
        for (const eid of toSelect) selected[eid] = 1;
        soundManager.playSelect();
        break;
      }

      case CommandType.CycleSubgroup:
        cycleSubgroup(world, playerFaction, viewport, cmd.data === -1 ? -1 : 1);
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
function cycleSubgroup(world: World, playerFaction: Faction, viewport: Viewport, direction: 1 | -1 = 1): void {
  // Check if all selected entities are buildings of the same type → building cycle mode
  const selectedEids: number[] = [];
  let allSameBuilding = true;
  let firstBt = -1;
  for (let eid = 1; eid < world.nextEid; eid++) {
    if (selected[eid] !== 1) continue;
    if (faction[eid] !== playerFaction) continue;
    selectedEids.push(eid);
    if (hasComponents(world, eid, BUILDING)) {
      const bt = buildingType[eid];
      if (firstBt === -1) firstBt = bt;
      else if (bt !== firstBt) allSameBuilding = false;
    } else {
      allSameBuilding = false;
    }
  }

  // Building cycle mode: Tab cycles through individual buildings, centering camera
  if (allSameBuilding && selectedEids.length > 1 && firstBt >= 0) {
    buildingCycleIndex = ((buildingCycleIndex + direction) % selectedEids.length + selectedEids.length) % selectedEids.length;
    clearSelection(world);
    const focusEid = selectedEids[buildingCycleIndex];
    selected[focusEid] = 1;
    viewport.moveCenter(posX[focusEid], posY[focusEid]);
    return;
  }

  // Unit subgroup mode: cycle through unit types
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
  if (types.length <= 1) return;

  subgroupIndex = ((subgroupIndex + direction) % types.length + types.length) % types.length;
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
