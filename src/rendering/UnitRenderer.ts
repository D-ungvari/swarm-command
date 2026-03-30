import { Container, Graphics } from 'pixi.js';
import { Faction, UnitType, SiegeMode, ResourceType, BuildState, BuildingType, SELECTION_COLOR, TILE_SIZE, MEDIVAC_HEAL_RANGE } from '../constants';
import {
  POSITION, RENDERABLE, SELECTABLE, HEALTH, UNIT_TYPE, ATTACK, RESOURCE, BUILDING, WORKER,
  posX, posY, renderWidth, renderHeight, renderTint,
  selected, faction, hpCurrent, hpMax, unitType,
  atkFlashTimer, atkRange, atkDamage, targetEntity,
  stimEndTime, slowEndTime, siegeMode, lastCombatTime,
  resourceType, resourceRemaining,
  buildState, buildProgress, buildingType, rallyX, rallyY,
  workerCarrying, workerState,
  prodUnitType, prodProgress, prodTimeTotal,
  velX, velY,
} from '../ecs/components';
import { type World, hasComponents, entityExists } from '../ecs/world';
import { deathEvents } from '../systems/DeathSystem';
import { damageEvents } from '../systems/CombatSystem';

/** Command ping visual marker */
interface CommandPing {
  x: number;
  y: number;
  time: number;
  color: number;
}

const commandPings: CommandPing[] = [];
const PING_DURATION = 0.5;

/** Add a command feedback ping at a world-space position */
export function addCommandPing(x: number, y: number, color: number, gameTime: number): void {
  commandPings.push({ x, y, time: gameTime, color });
}

/**
 * Renders units as simple geometric shapes with ability visual feedback.
 */
export class UnitRenderer {
  container: Container;
  private graphics: Graphics;

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  render(world: World, gameTime: number): void {
    const g = this.graphics;
    g.clear();

    const bits = POSITION | RENDERABLE;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, bits)) continue;

      const x = posX[eid];
      let y = posY[eid];
      let w = renderWidth[eid];
      let h = renderHeight[eid];
      const tint = renderTint[eid];
      const isSelected = hasComponents(world, eid, SELECTABLE) && selected[eid] === 1;

      // Resource entities render differently
      if (hasComponents(world, eid, RESOURCE)) {
        if (isSelected) {
          g.circle(x, y, Math.max(w, h) * 0.7);
          g.stroke({ color: SELECTION_COLOR, width: 1.5, alpha: 0.8 });
        }
        const rt = resourceType[eid] as ResourceType;
        if (rt === ResourceType.Mineral) {
          // Diamond shape for minerals
          g.moveTo(x, y - h / 2);
          g.lineTo(x + w / 2, y);
          g.lineTo(x, y + h / 2);
          g.lineTo(x - w / 2, y);
          g.closePath();
          g.fill({ color: tint });
          g.stroke({ color: 0x88ddff, width: 1, alpha: 0.5 });
        } else {
          // Pulsing circle for gas
          const pulse = 0.6 + 0.2 * Math.sin(gameTime * 3);
          g.circle(x, y, w / 2);
          g.fill({ color: tint, alpha: pulse });
          g.stroke({ color: 0x88ff88, width: 1, alpha: 0.4 });
        }
        // Depletion bar (reuse health bar pattern)
        if (hpCurrent[eid] < hpMax[eid]) {
          const barW = w + 4;
          const barH = 3;
          const barX = x - barW / 2;
          const barY = y - h / 2 - 6;
          const ratio = Math.max(0, hpCurrent[eid] / hpMax[eid]);
          g.rect(barX, barY, barW, barH);
          g.fill({ color: 0x333333, alpha: 0.8 });
          g.rect(barX, barY, barW * ratio, barH);
          g.fill({ color: tint });
        }
        continue;
      }

      // Building entities
      if (hasComponents(world, eid, BUILDING)) {
        if (isSelected) {
          g.circle(x, y, Math.max(w, h) * 0.6);
          g.stroke({ color: SELECTION_COLOR, width: 1.5, alpha: 0.8 });
        }

        const bs = buildState[eid] as BuildState;
        const bt = buildingType[eid] as BuildingType;
        const baseAlpha = bs === BuildState.UnderConstruction ? 0.6 : 1.0;

        // === Shadow outline behind building ===
        g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
        g.fill({ color: 0x000000, alpha: 0.4 });

        // Main building rect
        g.rect(x - w / 2, y - h / 2, w, h);
        g.fill({ color: tint, alpha: baseAlpha });

        // Per-type border colors and thickness
        let borderColor = 0x446688;
        if (bt === BuildingType.CommandCenter) borderColor = 0x5588bb;
        else if (bt === BuildingType.SupplyDepot) borderColor = 0x3366aa;
        else if (bt === BuildingType.Barracks) borderColor = 0x6644aa;
        else if (bt === BuildingType.Refinery) borderColor = 0x448844;
        else if (bt === BuildingType.Factory) borderColor = 0x886644;
        else if (bt === BuildingType.Starport) borderColor = 0x4466aa;
        g.rect(x - w / 2, y - h / 2, w, h);
        g.stroke({ color: borderColor, width: 2, alpha: baseAlpha });

        // Under construction: animated diagonal stripes
        if (bs === BuildState.UnderConstruction) {
          const stripeSpacing = 8;
          const offset = (gameTime * 20) % stripeSpacing;
          const hw = w / 2;
          const hh = h / 2;
          for (let s = -w - h; s < w + h; s += stripeSpacing) {
            const sx = s + offset;
            // Diagonal line from top-left to bottom-right direction
            const x1 = Math.max(-hw, sx);
            const y1 = Math.max(-hh, x1 - sx - hh);
            const x2 = Math.min(hw, sx + h);
            const y2 = Math.min(hh, x2 - sx + hh);
            // Clip to building bounds
            const lx1 = Math.max(x - hw, x + Math.max(-hw, sx - hh));
            const ly1 = y - hh;
            const lx2 = Math.min(x + hw, x + Math.min(hw, sx + hh));
            const ly2 = y + hh;
            if (lx1 < lx2) {
              g.moveTo(lx1, ly1);
              g.lineTo(lx2, ly2);
              g.stroke({ color: 0xffaa22, width: 1, alpha: 0.15 });
            }
          }
        }

        // Building type details
        if (bt === BuildingType.CommandCenter) {
          // Inner base outline rectangle
          const inset = 6;
          g.rect(x - w / 2 + inset, y - h / 2 + inset, w - inset * 2, h - inset * 2);
          g.stroke({ color: 0x6699cc, width: 1, alpha: 0.5 * baseAlpha });

          // Bright gold star in center (4-pointed)
          const starR = 5;
          const starInner = 2;
          g.moveTo(x, y - starR);
          g.lineTo(x + starInner, y - starInner);
          g.lineTo(x + starR, y);
          g.lineTo(x + starInner, y + starInner);
          g.lineTo(x, y + starR);
          g.lineTo(x - starInner, y + starInner);
          g.lineTo(x - starR, y);
          g.lineTo(x - starInner, y - starInner);
          g.closePath();
          g.fill({ color: 0xffcc44, alpha: baseAlpha });
        } else if (bt === BuildingType.SupplyDepot) {
          // Diagonal cross-hatch pattern
          const hw2 = w / 2 - 3;
          const hh2 = h / 2 - 3;
          const step = 6;
          for (let d = -Math.max(hw2, hh2); d <= Math.max(hw2, hh2); d += step) {
            // Forward diagonals
            const fx1 = Math.max(-hw2, d - hh2);
            const fx2 = Math.min(hw2, d + hh2);
            if (fx1 < fx2) {
              g.moveTo(x + fx1, y + (fx1 - d));
              g.lineTo(x + fx2, y + (fx2 - d));
              g.stroke({ color: 0x88aacc, width: 0.5, alpha: 0.35 * baseAlpha });
            }
            // Backward diagonals
            if (fx1 < fx2) {
              g.moveTo(x + fx1, y - (fx1 - d));
              g.lineTo(x + fx2, y - (fx2 - d));
              g.stroke({ color: 0x88aacc, width: 0.5, alpha: 0.35 * baseAlpha });
            }
          }
        } else if (bt === BuildingType.Barracks) {
          // Larger X indicator
          const xSize = 7;
          g.moveTo(x - xSize, y - xSize);
          g.lineTo(x + xSize, y + xSize);
          g.moveTo(x + xSize, y - xSize);
          g.lineTo(x - xSize, y + xSize);
          g.stroke({ color: 0xffffff, width: 2, alpha: 0.5 * baseAlpha });

          // Door rectangle at bottom edge
          const doorW = 10;
          const doorH = 6;
          g.rect(x - doorW / 2, y + h / 2 - doorH, doorW, doorH);
          g.fill({ color: 0x112244, alpha: 0.8 * baseAlpha });
          g.rect(x - doorW / 2, y + h / 2 - doorH, doorW, doorH);
          g.stroke({ color: 0x6688aa, width: 1, alpha: 0.6 * baseAlpha });
        } else if (bt === BuildingType.Refinery) {
          // Green gas venting pipes — two small circles on top
          g.circle(x - w * 0.2, y - h * 0.15, 4);
          g.fill({ color: 0x44ff66, alpha: 0.4 * baseAlpha });
          g.circle(x + w * 0.2, y - h * 0.15, 4);
          g.fill({ color: 0x44ff66, alpha: 0.4 * baseAlpha });
          // Central pipe
          g.rect(x - 2, y - h * 0.3, 4, h * 0.6);
          g.fill({ color: 0x556655, alpha: 0.6 * baseAlpha });
        } else if (bt === BuildingType.Factory) {
          // Gear icon shape — circle with teeth
          const gearR = 8;
          const gearInner = 5;
          const teeth = 6;
          for (let t = 0; t < teeth; t++) {
            const angle = (t / teeth) * Math.PI * 2;
            const nextAngle = ((t + 0.5) / teeth) * Math.PI * 2;
            g.moveTo(
              x + Math.cos(angle) * gearInner,
              y + Math.sin(angle) * gearInner,
            );
            g.lineTo(
              x + Math.cos(angle) * gearR,
              y + Math.sin(angle) * gearR,
            );
            g.lineTo(
              x + Math.cos(nextAngle) * gearR,
              y + Math.sin(nextAngle) * gearR,
            );
            g.lineTo(
              x + Math.cos(nextAngle) * gearInner,
              y + Math.sin(nextAngle) * gearInner,
            );
            g.stroke({ color: 0xccaa44, width: 1.5, alpha: 0.6 * baseAlpha });
          }
          // Center dot
          g.circle(x, y, 3);
          g.fill({ color: 0xccaa44, alpha: 0.5 * baseAlpha });

          // Door rectangle at bottom
          const doorW2 = 12;
          const doorH2 = 7;
          g.rect(x - doorW2 / 2, y + h / 2 - doorH2, doorW2, doorH2);
          g.fill({ color: 0x112244, alpha: 0.8 * baseAlpha });
          g.rect(x - doorW2 / 2, y + h / 2 - doorH2, doorW2, doorH2);
          g.stroke({ color: 0x886644, width: 1, alpha: 0.6 * baseAlpha });
        } else if (bt === BuildingType.Starport) {
          // Wing icon shape — V with horizontal line
          g.moveTo(x - w * 0.35, y - h * 0.2);
          g.lineTo(x, y + h * 0.15);
          g.lineTo(x + w * 0.35, y - h * 0.2);
          g.stroke({ color: 0x88aaff, width: 2, alpha: 0.6 * baseAlpha });
          // Horizontal stabilizer
          g.moveTo(x - w * 0.25, y);
          g.lineTo(x + w * 0.25, y);
          g.stroke({ color: 0x88aaff, width: 1.5, alpha: 0.4 * baseAlpha });
          // Landing pad circle
          g.circle(x, y + h * 0.2, 5);
          g.stroke({ color: 0x6688cc, width: 1, alpha: 0.5 * baseAlpha });

          // Door rectangle at bottom
          const doorW3 = 12;
          const doorH3 = 7;
          g.rect(x - doorW3 / 2, y + h / 2 - doorH3, doorW3, doorH3);
          g.fill({ color: 0x112244, alpha: 0.8 * baseAlpha });
          g.rect(x - doorW3 / 2, y + h / 2 - doorH3, doorW3, doorH3);
          g.stroke({ color: 0x4466aa, width: 1, alpha: 0.6 * baseAlpha });
        }

        // Construction progress bar (yellow)
        if (bs === BuildState.UnderConstruction) {
          const barW2 = w + 4;
          const barH2 = 4;
          const barX2 = x - barW2 / 2;
          const barY2 = y - h / 2 - 8;
          g.rect(barX2, barY2, barW2, barH2);
          g.fill({ color: 0x333333, alpha: 0.8 });
          g.rect(barX2, barY2, barW2 * buildProgress[eid], barH2);
          g.fill({ color: 0xffaa22 });
        }

        // Health bar (only if complete and damaged)
        if (bs === BuildState.Complete && hpCurrent[eid] < hpMax[eid]) {
          const barW3 = w + 4;
          const barH3 = 3;
          const barX3 = x - barW3 / 2;
          const barY3 = y - h / 2 - 6;
          const hpRatio = Math.max(0, hpCurrent[eid] / hpMax[eid]);
          g.rect(barX3, barY3, barW3, barH3);
          g.fill({ color: 0x333333, alpha: 0.8 });
          const hpColor = hpRatio > 0.5 ? 0x44ff44 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333;
          g.rect(barX3, barY3, barW3 * hpRatio, barH3);
          g.fill({ color: hpColor });
        }

        // Rally point indicator
        if (isSelected && rallyX[eid] >= 0) {
          g.circle(rallyX[eid], rallyY[eid], 4);
          g.fill({ color: 0x44ff44, alpha: 0.6 });
          g.moveTo(x, y);
          g.lineTo(rallyX[eid], rallyY[eid]);
          g.stroke({ color: 0x44ff44, width: 1, alpha: 0.3 });
        }

        // Production progress ring (visible without selecting)
        if (bs === BuildState.Complete && prodUnitType[eid] > 0 && prodTimeTotal[eid] > 0) {
          const prodRatio = 1 - (prodProgress[eid] / prodTimeTotal[eid]);
          const arcRadius = Math.max(w, h) / 2 + 4;
          const startAngle = -Math.PI / 2; // 12 o'clock
          const endAngle = startAngle + prodRatio * Math.PI * 2;
          g.arc(x, y, arcRadius, startAngle, endAngle, false);
          g.stroke({ color: 0xffaa22, width: 2, alpha: 0.7 });
        }
        continue;
      }

      const fac = faction[eid] as Faction;
      const uType = unitType[eid] as UnitType;
      const isFlashing = atkFlashTimer[eid] > 0;
      const isStimmed = stimEndTime[eid] > gameTime;
      const isSlowed = slowEndTime[eid] > gameTime;
      const sm = siegeMode[eid] as SiegeMode;

      // Selection ring
      if (isSelected) {
        g.circle(x, y, Math.max(w, h) * 0.7);
        g.stroke({ color: SELECTION_COLOR, width: 1.5, alpha: 0.8 });
      }

      // Range circle for selected units that can attack
      if (isSelected && hasComponents(world, eid, ATTACK) && atkDamage[eid] > 0) {
        g.circle(x, y, atkRange[eid]);
        g.stroke({ color: 0xff4444, width: 0.5, alpha: 0.2 });
      }

      // Slow debuff indicator — frosty ring behind unit
      if (isSlowed) {
        g.circle(x, y, Math.max(w, h) * 0.6);
        g.fill({ color: 0x4488cc, alpha: 0.25 });
      }

      // Idle unit breathing animation — subtle vertical bob
      if (velX[eid] === 0 && velY[eid] === 0) {
        y += Math.sin(gameTime * 2 + eid * 0.7) * 0.8;
      }

      // Siege Tank shape adjustment when sieged
      if (uType === UnitType.SiegeTank && sm === SiegeMode.Sieged) {
        w = w * 1.4;
        h = h * 0.7;
      }

      // Unit body color — stim = bright teal, flash = white, otherwise normal
      let bodyColor = tint;
      if (isFlashing) bodyColor = 0xffffff;
      else if (isStimmed) bodyColor = 0x66ddff;

      if (fac === Faction.Zerg) {
        // === Shadow outline behind Zerg unit ===
        g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
        g.fill({ color: 0x000000, alpha: 0.4 });

        // Organic: circles/ellipses
        g.ellipse(x, y, w / 2, h / 2);
        g.fill({ color: bodyColor });

        // --- Per-unit detail shapes ---

        // Zergling: spikes on top + mandible lines at front
        if (uType === UnitType.Zergling) {
          g.moveTo(x - w * 0.4, y - h * 0.5);
          g.lineTo(x - w * 0.1, y - h * 0.3);
          g.lineTo(x + w * 0.1, y - h * 0.3);
          g.lineTo(x + w * 0.4, y - h * 0.5);
          g.stroke({ color: tint, width: 1.5 });
          // Mandibles at front (bottom)
          g.moveTo(x - w * 0.2, y + h * 0.4);
          g.lineTo(x - w * 0.35, y + h * 0.65);
          g.stroke({ color: tint, width: 1 });
          g.moveTo(x + w * 0.2, y + h * 0.4);
          g.lineTo(x + w * 0.35, y + h * 0.65);
          g.stroke({ color: tint, width: 1 });
        }

        // Baneling: glow ring + inner glow circle (brighter center)
        if (uType === UnitType.Baneling) {
          g.circle(x, y, w / 2 + 2);
          g.stroke({ color: 0xaaff44, width: 1, alpha: 0.6 });
          // Brighter inner glow
          g.circle(x, y, w / 4);
          g.fill({ color: 0xddff88, alpha: 0.5 });
        }

        // Hydralisk: taller with spine/crest on top (triangular spike)
        if (uType === UnitType.Hydralisk) {
          // Triangular crest spike on top
          g.moveTo(x, y - h * 0.5 - 5);
          g.lineTo(x - w * 0.15, y - h * 0.35);
          g.lineTo(x + w * 0.15, y - h * 0.35);
          g.closePath();
          g.fill({ color: tint });
        }

        // Roach: carapace arc on top
        if (uType === UnitType.Roach) {
          // Carapace arc
          g.arc(x, y - h * 0.1, w / 2 - 2, Math.PI, 0, false);
          g.stroke({ color: 0x886644, width: 2, alpha: 0.6 });
          // Regen indicator
          if (hpCurrent[eid] < hpMax[eid] && hpCurrent[eid] > 0) {
            const pulse = 0.3 + 0.3 * Math.sin(gameTime * 4);
            g.circle(x, y - h / 2 - 4, 3);
            g.fill({ color: 0x44ff44, alpha: pulse });
          }
        }

        // Drone: two small antenna dots above
        if (uType === UnitType.Drone) {
          g.circle(x - w * 0.25, y - h * 0.5 - 3, 2);
          g.fill({ color: tint, alpha: 0.8 });
          g.circle(x + w * 0.25, y - h * 0.5 - 3, 2);
          g.fill({ color: tint, alpha: 0.8 });
        }

      } else {
        // === Shadow outline behind Terran unit ===
        g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
        g.fill({ color: 0x000000, alpha: 0.4 });

        // Terran: rectangles (angular, mechanical)
        g.rect(x - w / 2, y - h / 2, w, h);
        g.fill({ color: bodyColor });

        // --- Per-unit detail shapes ---

        // SCV: wrench/arm line extending from right side
        if (uType === UnitType.SCV) {
          // Arm line
          g.moveTo(x + w / 2, y);
          g.lineTo(x + w / 2 + 5, y - 3);
          g.lineTo(x + w / 2 + 3, y - 6);
          g.stroke({ color: 0xaaaaaa, width: 1.5 });
        }

        // Marine: triangular helmet/visor on top
        if (uType === UnitType.Marine) {
          g.moveTo(x - w * 0.3, y - h / 2);
          g.lineTo(x, y - h / 2 - 4);
          g.lineTo(x + w * 0.3, y - h / 2);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: 0x88bbff, width: 0.5, alpha: 0.6 });
        }

        // Marauder: shoulder pads (small rects on sides)
        if (uType === UnitType.Marauder) {
          // Left shoulder pad
          g.rect(x - w / 2 - 3, y - h / 2, 3, h * 0.4);
          g.fill({ color: bodyColor });
          g.stroke({ color: 0x5577aa, width: 0.5 });
          // Right shoulder pad
          g.rect(x + w / 2, y - h / 2, 3, h * 0.4);
          g.fill({ color: bodyColor });
          g.stroke({ color: 0x5577aa, width: 0.5 });
        }

        // Siege Tank
        if (uType === UnitType.SiegeTank) {
          // Treads (two thin rects below body)
          g.rect(x - w / 2, y + h / 2, w, 2);
          g.fill({ color: 0x555555 });
          g.rect(x - w / 2, y + h / 2 + 3, w, 2);
          g.fill({ color: 0x444444 });

          if (sm === SiegeMode.Sieged) {
            // Longer cannon in siege mode
            g.moveTo(x, y);
            g.lineTo(x + w * 0.7, y);
            g.stroke({ color: 0xaaaaaa, width: 3 });
          } else if (sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) {
            // Pulsing outline during transition
            const pulse = 0.3 + 0.5 * Math.sin(gameTime * 8);
            g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
            g.stroke({ color: 0xffaa00, width: 1.5, alpha: pulse });
          } else {
            // Normal cannon line
            g.moveTo(x, y);
            g.lineTo(x + w * 0.8, y);
            g.stroke({ color: 0x888888, width: 2 });
          }
        }

        // Medivac: cross symbol + heal beams + wing lines
        if (uType === UnitType.Medivac) {
          g.rect(x - 2, y - 5, 4, 10);
          g.fill({ color: 0xffffff, alpha: 0.6 });
          g.rect(x - 5, y - 2, 10, 4);
          g.fill({ color: 0xffffff, alpha: 0.6 });

          // Wing lines extending from sides
          g.moveTo(x - w / 2, y);
          g.lineTo(x - w / 2 - 5, y - 2);
          g.stroke({ color: 0x8899aa, width: 1.5 });
          g.moveTo(x + w / 2, y);
          g.lineTo(x + w / 2 + 5, y - 2);
          g.stroke({ color: 0x8899aa, width: 1.5 });

          // Draw heal beams to nearby wounded bio allies
          this.drawHealBeams(g, world, eid, x, y);
        }
      }

      // Projectile line for ranged units when attacking
      if (isFlashing && atkRange[eid] > TILE_SIZE) {
        const tgt = targetEntity[eid];
        if (tgt >= 1 && entityExists(world, tgt)) {
          g.moveTo(x, y);
          g.lineTo(posX[tgt], posY[tgt]);
          g.stroke({ color: 0xffff66, width: 1.5, alpha: 0.7 });
        }
      }

      // Health bar: show if damaged OR if selected (so player can see relative HP of their army)
      const showHealthBar = hasComponents(world, eid, HEALTH) && hpCurrent[eid] > 0 &&
        (hpCurrent[eid] < hpMax[eid] || isSelected);
      if (showHealthBar) {
        const barW = w + 4;
        const barH = 3;
        const barX = x - barW / 2;
        const barY = y - h / 2 - 6;
        const hpRatio = Math.max(0, hpCurrent[eid] / hpMax[eid]);

        // Background
        g.rect(barX, barY, barW, barH);
        g.fill({ color: 0x333333, alpha: 0.8 });

        // Health fill
        const hpColor = hpRatio > 0.5 ? 0x44ff44 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333;
        g.rect(barX, barY, barW * hpRatio, barH);
        g.fill({ color: hpColor });
      }

      // Worker carrying indicator — bright blue dot when carrying minerals
      if (hasComponents(world, eid, WORKER) && workerCarrying[eid] > 0) {
        g.circle(x, y - h / 2 - 2, 4);
        g.fill({ color: 0x44bbff, alpha: 0.9 });
      }
    }

    // Command pings — shrinking circles that fade out
    for (let i = commandPings.length - 1; i >= 0; i--) {
      const ping = commandPings[i];
      const age = gameTime - ping.time;
      if (age >= PING_DURATION) {
        commandPings.splice(i, 1);
        continue;
      }
      const t = age / PING_DURATION;
      const alpha = Math.max(0, 1 - t);
      const radius = 6 + t * 20;
      g.circle(ping.x, ping.y, radius);
      g.stroke({ color: ping.color, width: 2, alpha: alpha * 0.8 });
      // Inner dot
      const innerAlpha = Math.max(0, 1 - t * 2);
      if (innerAlpha > 0) {
        g.circle(ping.x, ping.y, 3);
        g.fill({ color: ping.color, alpha: innerAlpha * 0.6 });
      }
    }

    // Death effects — improved with filled circles, particles, faction colors
    for (const evt of deathEvents) {
      const age = gameTime - evt.time;
      const duration = 0.5;
      const t = Math.min(1, age / duration);
      const alpha = Math.max(0, 1 - t);

      const isTerran = evt.faction === Faction.Terran;
      const baseColor = isTerran ? 0x6699ff : 0x44cc44;
      const particleColor = isTerran ? 0xaaccff : 0x66ff44;

      // Filled expanding circle with decreasing alpha
      const radius = 6 + t * 30;
      g.circle(evt.x, evt.y, radius);
      g.fill({ color: baseColor, alpha: alpha * 0.35 });
      g.circle(evt.x, evt.y, radius);
      g.stroke({ color: baseColor, width: 2, alpha: alpha * 0.7 });

      // Bright center flash (fades fast)
      const centerAlpha = Math.max(0, 1 - t * 3);
      if (centerAlpha > 0) {
        g.circle(evt.x, evt.y, 4 + t * 6);
        g.fill({ color: 0xffffff, alpha: centerAlpha * 0.6 });
      }

      // 4 particle dots flying outward
      const particleDist = 8 + t * 50;
      const particleAlpha = alpha * 0.8;
      const particleSize = Math.max(0.5, 2 - t * 2);
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI / 2) + 0.3; // offset for variety
        const px = evt.x + Math.cos(angle) * particleDist;
        const py = evt.y + Math.sin(angle) * particleDist;
        g.circle(px, py, particleSize);
        g.fill({ color: particleColor, alpha: particleAlpha });
      }
    }

    // Floating damage indicators — colored markers that drift upward and fade
    for (let i = damageEvents.length - 1; i >= 0; i--) {
      const evt = damageEvents[i];
      const age = gameTime - evt.time;
      const duration = 0.8;
      if (age >= duration) continue;

      const t = age / duration;
      const alpha = Math.max(0, 1 - t);
      const floatY = age * 30; // drift upward

      const dx = evt.x;
      const dy = evt.y - floatY;

      // Small colored diamond marker that shrinks as it fades
      const size = Math.max(1, 3 - t * 2);
      g.moveTo(dx, dy - size);
      g.lineTo(dx + size, dy);
      g.lineTo(dx, dy + size);
      g.lineTo(dx - size, dy);
      g.closePath();
      g.fill({ color: evt.color, alpha: alpha * 0.9 });

      // Thin dash line above the diamond to indicate "damage"
      g.moveTo(dx - 2, dy - size - 2);
      g.lineTo(dx + 2, dy - size - 2);
      g.stroke({ color: evt.color, width: 1.5, alpha: alpha * 0.7 });
    }
  }

  private drawHealBeams(g: Graphics, world: World, medivacEid: number, mx: number, my: number): void {
    const healRangePx = MEDIVAC_HEAL_RANGE * TILE_SIZE;
    const healRangeSq = healRangePx * healRangePx;
    const myFac = faction[medivacEid];

    for (let other = 1; other < world.nextEid; other++) {
      if (other === medivacEid) continue;
      if (!hasComponents(world, other, POSITION | HEALTH | UNIT_TYPE)) continue;
      if (faction[other] !== myFac) continue;
      if (hpCurrent[other] <= 0 || hpCurrent[other] >= hpMax[other]) continue;

      const ut = unitType[other] as UnitType;
      if (ut !== UnitType.Marine && ut !== UnitType.Marauder) continue;

      const dx = posX[other] - mx;
      const dy = posY[other] - my;
      if (dx * dx + dy * dy > healRangeSq) continue;

      g.moveTo(mx, my);
      g.lineTo(posX[other], posY[other]);
      g.stroke({ color: 0x44ff88, width: 1, alpha: 0.5 });
    }
  }
}
