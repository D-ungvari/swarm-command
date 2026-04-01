import { Container, Graphics } from 'pixi.js';
import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, MOVEMENT, SELECTABLE,
  posX, posY, selected, faction,
  paths, pathLengths, movePathIndex,
} from '../ecs/components';
import { Faction } from '../constants';

const DASH_LENGTH = 6;
const GAP_LENGTH = 4;
const WAYPOINT_RADIUS = 3;
const LINE_COLOR = 0x44ff88;
const LINE_ALPHA = 0.6;

export class WaypointRenderer {
  readonly container: Container;
  private g: Graphics;

  constructor() {
    this.container = new Container();
    this.g = new Graphics();
    this.container.addChild(this.g);
  }

  render(world: World, shiftHeld: boolean): void {
    this.g.clear();
    if (!shiftHeld) return;

    const bits = POSITION | MOVEMENT | SELECTABLE;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, bits)) continue;
      if (selected[eid] !== 1) continue;
      if (faction[eid] !== Faction.Terran) continue;

      const pathLen = pathLengths[eid];
      const pathIdx = movePathIndex[eid];
      if (pathLen === 0 || pathIdx < 0) continue;

      const startIdx = Math.min(pathIdx, pathLen - 1);
      const unitPath = paths[eid];
      if (!unitPath) continue;

      // Draw dashed line from unit to first remaining waypoint, then waypoint-to-waypoint
      let prevX = posX[eid];
      let prevY = posY[eid];

      for (let i = startIdx; i < pathLen; i++) {
        const wpX = unitPath[i * 2];
        const wpY = unitPath[i * 2 + 1];

        // Dashed segment from prev to this waypoint
        drawDashedLine(this.g, prevX, prevY, wpX, wpY, LINE_COLOR, LINE_ALPHA);

        // Circle at waypoint
        this.g.circle(wpX, wpY, WAYPOINT_RADIUS);
        this.g.fill({ color: LINE_COLOR, alpha: LINE_ALPHA });

        prevX = wpX;
        prevY = wpY;
      }
    }
  }
}

function drawDashedLine(
  g: Graphics,
  x1: number, y1: number,
  x2: number, y2: number,
  color: number,
  alpha: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const nx = dx / len;
  const ny = dy / len;

  let drawn = 0;
  let drawing = true;

  g.moveTo(x1, y1);

  while (drawn < len) {
    const segLen = drawing ? DASH_LENGTH : GAP_LENGTH;
    const end = Math.min(drawn + segLen, len);
    const ex = x1 + nx * end;
    const ey = y1 + ny * end;

    if (drawing) {
      g.lineTo(ex, ey);
      g.stroke({ color, width: 1, alpha });
      g.moveTo(ex, ey);
    } else {
      g.moveTo(ex, ey);
    }

    drawn = end;
    drawing = !drawing;
  }
}
