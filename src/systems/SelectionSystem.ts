import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, SELECTABLE,
  posX, posY, renderWidth, renderHeight,
  selected, faction, RENDERABLE,
} from '../ecs/components';
import type { InputState } from '../input/InputManager';
import { Faction } from '../constants';
import type { Viewport } from 'pixi-viewport';

/**
 * Handles click and drag-box unit selection.
 * Only selects player (Terran) units.
 */
export function selectionSystem(
  world: World,
  input: InputState,
  viewport: Viewport,
): void {
  const m = input.mouse;

  // Convert screen position to world position
  const worldPos = viewport.toWorld(m.x, m.y);

  // Left click release — either single select or box select
  if (m.leftJustReleased) {
    if (m.isDragging) {
      // Box select
      const startWorld = viewport.toWorld(m.dragStartX, m.dragStartY);
      const endWorld = worldPos;

      const minX = Math.min(startWorld.x, endWorld.x);
      const maxX = Math.max(startWorld.x, endWorld.x);
      const minY = Math.min(startWorld.y, endWorld.y);
      const maxY = Math.max(startWorld.y, endWorld.y);

      // Clear selection unless shift held
      if (!input.shiftHeld) clearSelection(world);

      const bits = POSITION | SELECTABLE;
      for (let eid = 1; eid < world.nextEid; eid++) {
        if (!hasComponents(world, eid, bits)) continue;
        if (faction[eid] !== Faction.Terran) continue;

        const x = posX[eid];
        const y = posY[eid];
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
          selected[eid] = 1;
        }
      }
    } else {
      // Single click select
      if (!input.shiftHeld) clearSelection(world);

      const closest = findUnitAt(world, worldPos.x, worldPos.y);
      if (closest > 0 && faction[closest] === Faction.Terran) {
        selected[closest] = selected[closest] === 1 && input.shiftHeld ? 0 : 1;
      }
    }
  }
}

function clearSelection(world: World): void {
  for (let eid = 1; eid < world.nextEid; eid++) {
    selected[eid] = 0;
  }
}

function findUnitAt(world: World, wx: number, wy: number): number {
  const bits = POSITION | SELECTABLE | RENDERABLE;
  let closestEid = 0;
  let closestDist = Infinity;

  for (let eid = 1; eid < world.nextEid; eid++) {
    if (!hasComponents(world, eid, bits)) continue;

    const dx = posX[eid] - wx;
    const dy = posY[eid] - wy;
    const halfW = renderWidth[eid] / 2 + 4; // small padding for click tolerance
    const halfH = renderHeight[eid] / 2 + 4;

    if (Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      const dist = dx * dx + dy * dy;
      if (dist < closestDist) {
        closestDist = dist;
        closestEid = eid;
      }
    }
  }

  return closestEid;
}
