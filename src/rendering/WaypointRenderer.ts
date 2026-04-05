import { Container, Graphics } from 'pixi.js';
import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, MOVEMENT, SELECTABLE,
  posX, posY, selected, faction,
  paths, pathLengths, movePathIndex,
  commandMode,
} from '../ecs/components';
import { Faction, CommandMode } from '../constants';

const DASH_LENGTH = 6;
const GAP_LENGTH = 4;
const WAYPOINT_RADIUS = 3;

export class WaypointRenderer {
  readonly container: Container;
  private g: Graphics;

  constructor() {
    this.container = new Container();
    this.g = new Graphics();
    this.container.addChild(this.g);
  }

  render(world: World, shiftHeld: boolean, gameTime: number): void {
    this.g.clear();
    if (!shiftHeld) return;

    const bits = POSITION | MOVEMENT | SELECTABLE;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, bits)) continue;
      if (selected[eid] !== 1) continue;

      const pathLen = pathLengths[eid];
      const pathIdx = movePathIndex[eid];
      if (pathLen === 0 || pathIdx < 0) continue;

      const startIdx = Math.min(pathIdx, pathLen - 1);
      const unitPath = paths[eid];
      if (!unitPath) continue;

      // Faction-specific waypoint colors
      const fac = faction[eid] as Faction;
      const isAttackMove = commandMode[eid] === CommandMode.AttackMove;
      const lineColor = isAttackMove ? 0xff5555 : (fac === Faction.Terran ? 0x55bbff : 0x55ffaa);
      const lineAlpha = 0.5;
      const waypointColor = isAttackMove ? 0xff7755 : (fac === Faction.Terran ? 0x77ddff : 0x77ffbb);

      // Draw dashed line from unit to first remaining waypoint, then waypoint-to-waypoint
      let prevX = posX[eid];
      let prevY = posY[eid];

      for (let i = startIdx; i < pathLen; i++) {
        const wpX = unitPath[i * 2];
        const wpY = unitPath[i * 2 + 1];

        // Animated dashed segment from prev to this waypoint
        drawAnimatedDash(this.g, prevX, prevY, wpX, wpY, lineColor, lineAlpha, gameTime);

        // Waypoint marker: circle with glow
        this.g.circle(wpX, wpY, WAYPOINT_RADIUS + 1);
        this.g.fill({ color: waypointColor, alpha: 0.2 });
        this.g.circle(wpX, wpY, WAYPOINT_RADIUS);
        this.g.fill({ color: waypointColor, alpha: lineAlpha });

        // Final waypoint gets a brighter marker
        if (i === pathLen - 1) {
          this.g.circle(wpX, wpY, WAYPOINT_RADIUS + 3);
          this.g.stroke({ color: waypointColor, width: 1, alpha: 0.4 });
        }

        prevX = wpX;
        prevY = wpY;
      }
    }
  }
}

function drawAnimatedDash(
  g: Graphics,
  x1: number, y1: number,
  x2: number, y2: number,
  color: number,
  alpha: number,
  gameTime: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;

  const nx = dx / len;
  const ny = dy / len;

  // Animate dash offset — dashes march along the path
  const dashCycle = DASH_LENGTH + GAP_LENGTH;
  const offset = (gameTime * 30) % dashCycle; // march speed

  let drawn = -offset; // start offset for animation
  let drawing = true;

  while (drawn < len) {
    const segStart = Math.max(0, drawn);
    const segLen = drawing ? DASH_LENGTH : GAP_LENGTH;
    const segEnd = Math.min(drawn + segLen, len);

    if (drawing && segEnd > 0 && segStart < len) {
      const sx = x1 + nx * Math.max(0, segStart);
      const sy = y1 + ny * Math.max(0, segStart);
      const ex = x1 + nx * Math.min(len, segEnd);
      const ey = y1 + ny * Math.min(len, segEnd);
      g.moveTo(sx, sy);
      g.lineTo(ex, ey);
      g.stroke({ color, width: 1.2, alpha });
    }

    drawn += segLen;
    drawing = !drawing;
  }
}
