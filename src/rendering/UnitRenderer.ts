import { Container, Graphics } from 'pixi.js';
import { Faction, UnitType, SiegeMode, ResourceType, BuildState, BuildingType, SELECTION_COLOR, TILE_SIZE, MEDIVAC_HEAL_RANGE, ZERG_COLOR } from '../constants';
import {
  POSITION, RENDERABLE, SELECTABLE, HEALTH, UNIT_TYPE, ATTACK, RESOURCE, BUILDING, WORKER,
  posX, posY, renderWidth, renderHeight, renderTint,
  selected, faction, hpCurrent, hpMax, unitType,
  atkFlashTimer, atkRange, atkDamage, targetEntity,
  stimEndTime, slowEndTime, siegeMode, lastCombatTime, deathTime,
  resourceType, resourceRemaining,
  buildState, buildProgress, buildingType, rallyX, rallyY,
  workerCarrying, workerState,
  prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  velX, velY,
} from '../ecs/components';
import { type World, hasComponents, entityExists } from '../ecs/world';
import { deathEvents } from '../systems/DeathSystem';
import { damageEvents } from '../systems/CombatSystem';
import { isTileVisible } from '../systems/FogSystem';

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

      // Fog of war: skip enemy entities (Zerg) on non-visible tiles
      const fac = faction[eid] as Faction;
      if (fac !== Faction.Terran && fac !== Faction.None && !isTileVisible(x, y)) {
        continue;
      }

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

        // Neutral rock obstacle — rendered by the tilemap; entity only contributes health bar
        if (bt === BuildingType.Rock) {
          // Subtle selection ring
          if (isSelected) {
            g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
            g.stroke({ color: SELECTION_COLOR, width: 1.5, alpha: 0.7 });
          }
          // HP bar
          if (hpCurrent[eid] < hpMax[eid]) {
            const barW = w;
            const barH = 3;
            const barX = x - barW / 2;
            const barY = y - h / 2 - 6;
            const hpRatio = Math.max(0, hpCurrent[eid] / hpMax[eid]);
            g.rect(barX, barY, barW, barH);
            g.fill({ color: 0x333333, alpha: 0.8 });
            const hpColor = hpRatio > 0.5 ? 0x44ff44 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333;
            g.rect(barX, barY, barW * hpRatio, barH);
            g.fill({ color: hpColor });
          }
          continue;
        }

        const isZergBuilding = bt === BuildingType.Hatchery || bt === BuildingType.SpawningPool;

        if (isZergBuilding) {
          // === Zerg buildings: organic ellipses ===

          // Creep ground indicator (dark patch under building)
          g.ellipse(x, y, w / 2 + 8, h / 2 + 8);
          g.fill({ color: 0x331111, alpha: 0.5 * baseAlpha });

          // Shadow behind
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });

          // Main body ellipse
          g.ellipse(x, y, w / 2, h / 2);
          g.fill({ color: tint, alpha: baseAlpha });

          if (bt === BuildingType.Hatchery) {
            // Hatchery: large organic shape with inner membrane and veins
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0xaa4444, width: 2, alpha: 0.7 * baseAlpha });

            // Inner membrane ring
            g.ellipse(x, y, w * 0.3, h * 0.3);
            g.stroke({ color: 0xcc5555, width: 1.5, alpha: 0.5 * baseAlpha });

            // Pulsing core
            const pulse = 0.4 + 0.3 * Math.sin(gameTime * 2);
            g.circle(x, y, 6);
            g.fill({ color: 0xff6644, alpha: pulse * baseAlpha });

            // Organic vein lines radiating outward
            for (let v = 0; v < 6; v++) {
              const angle = (v / 6) * Math.PI * 2;
              const innerR = 8;
              const outerR = Math.min(w, h) * 0.4;
              g.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
              g.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
              g.stroke({ color: 0x993333, width: 1, alpha: 0.4 * baseAlpha });
            }
          } else {
            // SpawningPool: smaller organic with pulsing glow
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x661111, width: 2, alpha: 0.7 * baseAlpha });

            // Pulsing glow ring
            const glow = 0.3 + 0.3 * Math.sin(gameTime * 3);
            g.ellipse(x, y, w / 2 + 4, h / 2 + 4);
            g.stroke({ color: 0xff4422, width: 2, alpha: glow * baseAlpha });

            // Inner bubbling circles
            for (let b = 0; b < 3; b++) {
              const bx = x + (b - 1) * (w * 0.2);
              const by = y + Math.sin(gameTime * 4 + b * 2) * 3;
              g.circle(bx, by, 3);
              g.fill({ color: 0xaa3322, alpha: 0.5 * baseAlpha });
            }
          }
        } else {
        // === Terran buildings: rectangles ===

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
        } // close Terran buildings else block

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
        // ═══════════════════════════════════════════
        // ═══  ZERG UNITS — organic, curved shapes ═
        // ═══════════════════════════════════════════

        if (uType === UnitType.Drone) {
          // ── Drone (Worker): small insectoid with antennae and legs ──
          // Shadow
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body ellipse
          g.ellipse(x, y, w / 2, h / 2);
          g.fill({ color: bodyColor });
          // Lighter center eye spot
          g.ellipse(x, y - h * 0.1, w * 0.2, h * 0.15);
          g.fill({ color: 0xff8866, alpha: 0.7 });
          // Antennae — curved lines going up-outward, ending in dots
          g.moveTo(x - w * 0.15, y - h * 0.4);
          g.lineTo(x - w * 0.35, y - h * 0.7);
          g.lineTo(x - w * 0.45, y - h * 0.85);
          g.stroke({ color: tint, width: 1.2 });
          g.circle(x - w * 0.45, y - h * 0.85, 1.5);
          g.fill({ color: 0xff6644, alpha: 0.9 });
          g.moveTo(x + w * 0.15, y - h * 0.4);
          g.lineTo(x + w * 0.35, y - h * 0.7);
          g.lineTo(x + w * 0.45, y - h * 0.85);
          g.stroke({ color: tint, width: 1.2 });
          g.circle(x + w * 0.45, y - h * 0.85, 1.5);
          g.fill({ color: 0xff6644, alpha: 0.9 });
          // Legs — 4 total, 2 per side, angled down
          g.moveTo(x - w * 0.35, y + h * 0.1);
          g.lineTo(x - w * 0.6, y + h * 0.55);
          g.stroke({ color: tint, width: 1 });
          g.moveTo(x - w * 0.25, y + h * 0.25);
          g.lineTo(x - w * 0.5, y + h * 0.7);
          g.stroke({ color: tint, width: 1 });
          g.moveTo(x + w * 0.35, y + h * 0.1);
          g.lineTo(x + w * 0.6, y + h * 0.55);
          g.stroke({ color: tint, width: 1 });
          g.moveTo(x + w * 0.25, y + h * 0.25);
          g.lineTo(x + w * 0.5, y + h * 0.7);
          g.stroke({ color: tint, width: 1 });

        } else if (uType === UnitType.Zergling) {
          // ── Zergling: fast, elongated, predatory with mandibles and spines ──
          // Shadow
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body — elongated horizontal ellipse (wider than tall)
          g.ellipse(x, y, w * 0.6, h * 0.35);
          g.fill({ color: bodyColor });
          // V-shaped jaw mandibles at front (right side = forward)
          g.moveTo(x + w * 0.5, y - h * 0.1);
          g.lineTo(x + w * 0.85, y - h * 0.35);
          g.stroke({ color: 0xdd5544, width: 1.5 });
          g.moveTo(x + w * 0.5, y + h * 0.1);
          g.lineTo(x + w * 0.85, y + h * 0.35);
          g.stroke({ color: 0xdd5544, width: 1.5 });
          // Spine ridge — 4 small triangular spikes along top
          for (let s = 0; s < 4; s++) {
            const sx = x - w * 0.3 + s * w * 0.2;
            g.moveTo(sx - w * 0.05, y - h * 0.3);
            g.lineTo(sx, y - h * 0.55);
            g.lineTo(sx + w * 0.05, y - h * 0.3);
            g.closePath();
            g.fill({ color: tint, alpha: 0.9 });
          }
          // Legs — 2 thin lines on each side
          g.moveTo(x - w * 0.2, y + h * 0.3);
          g.lineTo(x - w * 0.4, y + h * 0.65);
          g.stroke({ color: tint, width: 0.8 });
          g.moveTo(x + w * 0.1, y + h * 0.3);
          g.lineTo(x - w * 0.05, y + h * 0.65);
          g.stroke({ color: tint, width: 0.8 });
          g.moveTo(x - w * 0.2, y - h * 0.3);
          g.lineTo(x - w * 0.4, y - h * 0.65);
          g.stroke({ color: tint, width: 0.8 });
          g.moveTo(x + w * 0.1, y - h * 0.3);
          g.lineTo(x - w * 0.05, y - h * 0.65);
          g.stroke({ color: tint, width: 0.8 });
          // Tail — thin curved line extending backward
          g.moveTo(x - w * 0.55, y);
          g.lineTo(x - w * 0.75, y + h * 0.1);
          g.lineTo(x - w * 0.9, y + h * 0.05);
          g.stroke({ color: tint, width: 1 });

        } else if (uType === UnitType.Baneling) {
          // ── Baneling: round, glowing, explosive with pulsing animation ──
          const pulseGlow = 0.5 + 0.4 * Math.sin(gameTime * 5);
          // Shadow
          g.circle(x, y, w / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Outer glow ring (pulsing)
          g.circle(x, y, w / 2 + 3);
          g.stroke({ color: 0xaaff44, width: 2, alpha: pulseGlow * 0.5 });
          // Main body — perfect circle
          g.circle(x, y, w / 2);
          g.fill({ color: bodyColor });
          // Vein lines — 4 lines radiating from center (crack pattern)
          for (let v = 0; v < 4; v++) {
            const angle = (v / 4) * Math.PI * 2 + 0.3;
            g.moveTo(x + Math.cos(angle) * w * 0.1, y + Math.sin(angle) * w * 0.1);
            g.lineTo(x + Math.cos(angle) * w * 0.45, y + Math.sin(angle) * w * 0.45);
            g.stroke({ color: 0x88ff44, width: 1, alpha: 0.6 });
          }
          // Bright inner glow spot (pulsing)
          g.circle(x, y, w * 0.2);
          g.fill({ color: 0xddff88, alpha: pulseGlow * 0.7 });
          // Bright center point
          g.circle(x, y, w * 0.08);
          g.fill({ color: 0xffffff, alpha: pulseGlow * 0.5 });
          // Small legs underneath (barely visible)
          g.moveTo(x - w * 0.3, y + h * 0.35);
          g.lineTo(x - w * 0.4, y + h * 0.6);
          g.stroke({ color: 0x338833, width: 0.8, alpha: 0.6 });
          g.moveTo(x, y + h * 0.4);
          g.lineTo(x, y + h * 0.65);
          g.stroke({ color: 0x338833, width: 0.8, alpha: 0.6 });
          g.moveTo(x + w * 0.3, y + h * 0.35);
          g.lineTo(x + w * 0.4, y + h * 0.6);
          g.stroke({ color: 0x338833, width: 0.8, alpha: 0.6 });

        } else if (uType === UnitType.Hydralisk) {
          // ── Hydralisk: tall, upright, snake-like with cobra hood ──
          // Shadow
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body — tall ellipse (taller than wide, upright posture)
          g.ellipse(x, y, w * 0.4, h * 0.55);
          g.fill({ color: bodyColor });
          // Cobra hood — wide V-shape spreading outward from head
          g.moveTo(x, y - h * 0.35);
          g.lineTo(x - w * 0.6, y - h * 0.65);
          g.stroke({ color: tint, width: 2 });
          g.moveTo(x, y - h * 0.35);
          g.lineTo(x + w * 0.6, y - h * 0.65);
          g.stroke({ color: tint, width: 2 });
          // Hood fill (triangular area)
          g.moveTo(x - w * 0.55, y - h * 0.6);
          g.lineTo(x, y - h * 0.3);
          g.lineTo(x + w * 0.55, y - h * 0.6);
          g.closePath();
          g.fill({ color: bodyColor, alpha: 0.6 });
          // Spine needle ridge — 3 small spikes on the back (left side)
          for (let s = 0; s < 3; s++) {
            const sy = y - h * 0.15 + s * h * 0.2;
            g.moveTo(x - w * 0.35, sy);
            g.lineTo(x - w * 0.6, sy - h * 0.08);
            g.lineTo(x - w * 0.35, sy + h * 0.04);
            g.closePath();
            g.fill({ color: tint, alpha: 0.8 });
          }
          // Arms — two curved lines on sides ending in needle claws
          g.moveTo(x - w * 0.35, y - h * 0.05);
          g.lineTo(x - w * 0.55, y + h * 0.15);
          g.lineTo(x - w * 0.65, y + h * 0.1);
          g.stroke({ color: tint, width: 1.2 });
          g.moveTo(x + w * 0.35, y - h * 0.05);
          g.lineTo(x + w * 0.55, y + h * 0.15);
          g.lineTo(x + w * 0.65, y + h * 0.1);
          g.stroke({ color: tint, width: 1.2 });
          // Mouth — bright dot at face area
          g.circle(x, y - h * 0.32, 1.5);
          g.fill({ color: 0xff6644, alpha: 0.9 });

        } else if (uType === UnitType.Roach) {
          // ── Roach: wide, armored beetle with carapace and segments ──
          // Shadow
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body — wide ellipse (wider than tall, low tanky)
          g.ellipse(x, y, w * 0.55, h * 0.4);
          g.fill({ color: bodyColor });
          // Carapace — filled arc covering top half, darker shade
          g.arc(x, y - h * 0.05, w * 0.5, Math.PI, 0, false);
          g.closePath();
          g.fill({ color: 0x662222, alpha: 0.5 });
          g.arc(x, y - h * 0.05, w * 0.5, Math.PI, 0, false);
          g.stroke({ color: 0x886644, width: 2, alpha: 0.7 });
          // Armor segment lines — 3 horizontal lines across body
          for (let s = 0; s < 3; s++) {
            const sy = y - h * 0.15 + s * h * 0.15;
            g.moveTo(x - w * 0.35, sy);
            g.lineTo(x + w * 0.35, sy);
            g.stroke({ color: 0x884422, width: 1, alpha: 0.4 });
          }
          // Mandibles — two short thick lines at front
          g.moveTo(x + w * 0.4, y - h * 0.1);
          g.lineTo(x + w * 0.65, y - h * 0.25);
          g.stroke({ color: 0xaa6644, width: 2 });
          g.moveTo(x + w * 0.4, y + h * 0.1);
          g.lineTo(x + w * 0.65, y + h * 0.25);
          g.stroke({ color: 0xaa6644, width: 2 });
          // Legs — 3 on each side going down
          for (let l = 0; l < 3; l++) {
            const lx = x - w * 0.3 + l * w * 0.25;
            g.moveTo(lx, y + h * 0.35);
            g.lineTo(lx - w * 0.1, y + h * 0.65);
            g.stroke({ color: tint, width: 0.8 });
            g.moveTo(lx, y - h * 0.35);
            g.lineTo(lx - w * 0.1, y - h * 0.65);
            g.stroke({ color: tint, width: 0.8 });
          }
          // Regen indicator (keep existing)
          if (hpCurrent[eid] < hpMax[eid] && hpCurrent[eid] > 0) {
            const pulse = 0.3 + 0.3 * Math.sin(gameTime * 4);
            g.circle(x, y - h / 2 - 4, 3);
            g.fill({ color: 0x44ff44, alpha: pulse });
          }

        } else {
          // Fallback for any unknown Zerg unit
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          g.ellipse(x, y, w / 2, h / 2);
          g.fill({ color: bodyColor });
        }

      } else {
        // ═══════════════════════════════════════════════
        // ═══  TERRAN UNITS — angular, mechanical shapes ═
        // ═══════════════════════════════════════════════

        if (uType === UnitType.SCV) {
          // ── SCV (Worker): boxy body with articulated mining arm ──
          // Shadow
          g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body rect
          g.rect(x - w / 2, y - h / 2, w, h);
          g.fill({ color: bodyColor });
          // Border outline for armor look
          g.rect(x - w / 2, y - h / 2, w, h);
          g.stroke({ color: 0x5588bb, width: 1, alpha: 0.6 });
          // Visor line — darker stripe across upper body
          g.moveTo(x - w * 0.35, y - h * 0.2);
          g.lineTo(x + w * 0.35, y - h * 0.2);
          g.stroke({ color: 0x224466, width: 2, alpha: 0.8 });
          // Small viewport dot on visor
          g.circle(x, y - h * 0.2, 1.5);
          g.fill({ color: 0x66ccff, alpha: 0.9 });
          // Articulated mining arm — 2-segment from right side going down-right
          // Segment 1: shoulder to elbow
          g.moveTo(x + w * 0.45, y + h * 0.1);
          g.lineTo(x + w * 0.7, y + h * 0.3);
          g.stroke({ color: 0xdd9933, width: 2 });
          // Segment 2: elbow to drill head
          g.moveTo(x + w * 0.7, y + h * 0.3);
          g.lineTo(x + w * 0.85, y + h * 0.6);
          g.stroke({ color: 0xdd9933, width: 2 });
          // Drill head — small diamond
          g.moveTo(x + w * 0.85, y + h * 0.5);
          g.lineTo(x + w * 0.95, y + h * 0.6);
          g.lineTo(x + w * 0.85, y + h * 0.7);
          g.lineTo(x + w * 0.75, y + h * 0.6);
          g.closePath();
          g.fill({ color: 0xffbb44, alpha: 0.9 });
          // Elbow joint dot
          g.circle(x + w * 0.7, y + h * 0.3, 1.5);
          g.fill({ color: 0x888888 });

        } else if (uType === UnitType.Marine) {
          // ── Marine: armored infantry with visor and rifle ──
          // Shadow
          g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body — trapezoid shape (wider at shoulders, narrower at feet)
          g.moveTo(x - w * 0.5, y - h * 0.4);
          g.lineTo(x + w * 0.5, y - h * 0.4);
          g.lineTo(x + w * 0.35, y + h * 0.5);
          g.lineTo(x - w * 0.35, y + h * 0.5);
          g.closePath();
          g.fill({ color: bodyColor });
          // Armor plate outline
          g.moveTo(x - w * 0.5, y - h * 0.4);
          g.lineTo(x + w * 0.5, y - h * 0.4);
          g.lineTo(x + w * 0.35, y + h * 0.5);
          g.lineTo(x - w * 0.35, y + h * 0.5);
          g.closePath();
          g.stroke({ color: 0x5588bb, width: 1, alpha: 0.6 });
          // Helmet — small rect on top
          g.rect(x - w * 0.3, y - h * 0.55, w * 0.6, h * 0.2);
          g.fill({ color: bodyColor });
          g.rect(x - w * 0.3, y - h * 0.55, w * 0.6, h * 0.2);
          g.stroke({ color: 0x6699cc, width: 1, alpha: 0.7 });
          // Visor slit — bright cyan horizontal line
          g.moveTo(x - w * 0.22, y - h * 0.46);
          g.lineTo(x + w * 0.22, y - h * 0.46);
          g.stroke({ color: 0x44ffff, width: 1.5 });
          // Rifle — thin angled line from right shoulder going down-right
          g.moveTo(x + w * 0.4, y - h * 0.3);
          g.lineTo(x + w * 0.75, y + h * 0.15);
          g.stroke({ color: 0x778899, width: 1.5 });
          // Rifle muzzle — small horizontal line at end
          g.moveTo(x + w * 0.7, y + h * 0.15);
          g.lineTo(x + w * 0.85, y + h * 0.15);
          g.stroke({ color: 0x556677, width: 1.5 });

        } else if (uType === UnitType.Marauder) {
          // ── Marauder: heavy armored, bulky with concussion grenades ──
          // Shadow
          g.rect(x - w / 2 - 3, y - h / 2 - 2, w + 6, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main body — wider rect (emphasize bulk)
          g.rect(x - w * 0.5, y - h * 0.4, w, h * 0.8);
          g.fill({ color: bodyColor });
          // Armor plate outline
          g.rect(x - w * 0.5, y - h * 0.4, w, h * 0.8);
          g.stroke({ color: 0x5577aa, width: 1.2, alpha: 0.7 });
          // Central chest plate — inner rect with slightly different shade
          g.rect(x - w * 0.25, y - h * 0.25, w * 0.5, h * 0.5);
          g.fill({ color: 0x2266aa, alpha: 0.4 });
          g.rect(x - w * 0.25, y - h * 0.25, w * 0.5, h * 0.5);
          g.stroke({ color: 0x4488bb, width: 0.8, alpha: 0.5 });
          // Left shoulder pad — big rounded rect extending from left side
          g.rect(x - w * 0.7, y - h * 0.5, w * 0.3, h * 0.45);
          g.fill({ color: bodyColor });
          g.rect(x - w * 0.7, y - h * 0.5, w * 0.3, h * 0.45);
          g.stroke({ color: 0x6688aa, width: 1 });
          // Right shoulder pad
          g.rect(x + w * 0.4, y - h * 0.5, w * 0.3, h * 0.45);
          g.fill({ color: bodyColor });
          g.rect(x + w * 0.4, y - h * 0.5, w * 0.3, h * 0.45);
          g.stroke({ color: 0x6688aa, width: 1 });
          // Grenade launchers — small circles on shoulders
          g.circle(x - w * 0.55, y - h * 0.35, 2.5);
          g.fill({ color: 0x445566 });
          g.circle(x - w * 0.55, y - h * 0.35, 2.5);
          g.stroke({ color: 0x667788, width: 0.8 });
          g.circle(x + w * 0.55, y - h * 0.35, 2.5);
          g.fill({ color: 0x445566 });
          g.circle(x + w * 0.55, y - h * 0.35, 2.5);
          g.stroke({ color: 0x667788, width: 0.8 });
          // Visor — bright red/orange horizontal line
          g.moveTo(x - w * 0.2, y - h * 0.45);
          g.lineTo(x + w * 0.2, y - h * 0.45);
          g.stroke({ color: 0xff6622, width: 2 });

        } else if (uType === UnitType.SiegeTank) {
          // ── Siege Tank: heavy vehicle with treads and cannon ──
          if (sm === SiegeMode.Sieged) {
            // === SIEGED MODE: wider, flatter, very long cannon ===
            // Shadow
            g.rect(x - w / 2 - 3, y - h / 2 - 2, w + 6, h + 6);
            g.fill({ color: 0x000000, alpha: 0.4 });
            // Stabilizer legs extending down-left and down-right
            g.moveTo(x - w * 0.4, y + h * 0.3);
            g.lineTo(x - w * 0.7, y + h * 0.65);
            g.stroke({ color: 0x555555, width: 2 });
            g.moveTo(x + w * 0.4, y + h * 0.3);
            g.lineTo(x + w * 0.7, y + h * 0.65);
            g.stroke({ color: 0x555555, width: 2 });
            // Stabilizer feet (small horizontal lines)
            g.moveTo(x - w * 0.75, y + h * 0.65);
            g.lineTo(x - w * 0.6, y + h * 0.65);
            g.stroke({ color: 0x666666, width: 2 });
            g.moveTo(x + w * 0.65, y + h * 0.65);
            g.lineTo(x + w * 0.8, y + h * 0.65);
            g.stroke({ color: 0x666666, width: 2 });
            // Main body — wide, flat
            g.rect(x - w * 0.5, y - h * 0.3, w, h * 0.6);
            g.fill({ color: bodyColor });
            g.rect(x - w * 0.5, y - h * 0.3, w, h * 0.6);
            g.stroke({ color: 0x5588aa, width: 1, alpha: 0.6 });
            // Turret — darker rect on top-center
            g.rect(x - w * 0.2, y - h * 0.25, w * 0.4, h * 0.3);
            g.fill({ color: 0x224466 });
            g.rect(x - w * 0.2, y - h * 0.25, w * 0.4, h * 0.3);
            g.stroke({ color: 0x446688, width: 1 });
            // Very long cannon extending right
            g.moveTo(x + w * 0.2, y - h * 0.1);
            g.lineTo(x + w * 1.1, y - h * 0.1);
            g.stroke({ color: 0xaaaaaa, width: 3.5 });
            // Muzzle flash circle at tip
            const muzzlePulse = 0.3 + 0.3 * Math.sin(gameTime * 6);
            g.circle(x + w * 1.1, y - h * 0.1, 3);
            g.fill({ color: 0xffaa44, alpha: muzzlePulse });
          } else if (sm === SiegeMode.Packing || sm === SiegeMode.Unpacking) {
            // === TRANSITIONING: pulsing outline ===
            g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
            g.fill({ color: 0x000000, alpha: 0.4 });
            g.rect(x - w / 2, y - h / 2, w, h);
            g.fill({ color: bodyColor });
            const pulse = 0.3 + 0.5 * Math.sin(gameTime * 8);
            g.rect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6);
            g.stroke({ color: 0xffaa00, width: 2, alpha: pulse });
          } else {
            // === MOBILE MODE: body with treads and cannon ===
            // Shadow
            g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 6);
            g.fill({ color: 0x000000, alpha: 0.4 });
            // Treads — two parallel dark rects below the body, slightly wider
            g.rect(x - w * 0.55, y + h * 0.3, w * 1.1, h * 0.15);
            g.fill({ color: 0x444444 });
            g.rect(x - w * 0.55, y + h * 0.3, w * 1.1, h * 0.15);
            g.stroke({ color: 0x333333, width: 0.8 });
            g.rect(x - w * 0.55, y + h * 0.48, w * 1.1, h * 0.15);
            g.fill({ color: 0x3a3a3a });
            g.rect(x - w * 0.55, y + h * 0.48, w * 1.1, h * 0.15);
            g.stroke({ color: 0x333333, width: 0.8 });
            // Tread detail — small vertical lines for track links
            for (let t = 0; t < 5; t++) {
              const tx = x - w * 0.45 + t * w * 0.22;
              g.moveTo(tx, y + h * 0.3);
              g.lineTo(tx, y + h * 0.63);
              g.stroke({ color: 0x555555, width: 0.6 });
            }
            // Main body rect
            g.rect(x - w * 0.45, y - h * 0.35, w * 0.9, h * 0.65);
            g.fill({ color: bodyColor });
            g.rect(x - w * 0.45, y - h * 0.35, w * 0.9, h * 0.65);
            g.stroke({ color: 0x5588aa, width: 1, alpha: 0.6 });
            // Turret — smaller darker rect on top-center
            g.rect(x - w * 0.15, y - h * 0.3, w * 0.3, h * 0.3);
            g.fill({ color: 0x224466 });
            g.rect(x - w * 0.15, y - h * 0.3, w * 0.3, h * 0.3);
            g.stroke({ color: 0x446688, width: 0.8 });
            // Cannon extending right
            g.moveTo(x + w * 0.15, y - h * 0.15);
            g.lineTo(x + w * 0.8, y - h * 0.15);
            g.stroke({ color: 0x888888, width: 2.5 });
            // Muzzle circle
            g.circle(x + w * 0.8, y - h * 0.15, 2);
            g.fill({ color: 0x666666 });
          }

        } else if (uType === UnitType.Medivac) {
          // ── Medivac: flying medical transport with wings and red cross ──
          // Faint shadow below (elevated appearance)
          g.ellipse(x, y + 3, w * 0.45, h * 0.2);
          g.fill({ color: 0x000000, alpha: 0.2 });
          // Shadow behind main body
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.35 });
          // Main body — oval/ellipse (unlike other Terran rects, it flies)
          g.ellipse(x, y, w * 0.5, h * 0.4);
          g.fill({ color: bodyColor });
          g.ellipse(x, y, w * 0.5, h * 0.4);
          g.stroke({ color: 0x6699bb, width: 1, alpha: 0.6 });
          // Two swept-back wing lines extending from sides
          g.moveTo(x - w * 0.4, y - h * 0.05);
          g.lineTo(x - w * 0.85, y - h * 0.35);
          g.stroke({ color: 0x8899aa, width: 2 });
          g.moveTo(x + w * 0.4, y - h * 0.05);
          g.lineTo(x + w * 0.85, y - h * 0.35);
          g.stroke({ color: 0x8899aa, width: 2 });
          // Wing tips (small horizontal ends)
          g.moveTo(x - w * 0.85, y - h * 0.35);
          g.lineTo(x - w * 0.95, y - h * 0.3);
          g.stroke({ color: 0x778899, width: 1.5 });
          g.moveTo(x + w * 0.85, y - h * 0.35);
          g.lineTo(x + w * 0.95, y - h * 0.3);
          g.stroke({ color: 0x778899, width: 1.5 });
          // Large red cross in center
          g.rect(x - 2, y - 5, 4, 10);
          g.fill({ color: 0xff3333, alpha: 0.8 });
          g.rect(x - 5, y - 2, 10, 4);
          g.fill({ color: 0xff3333, alpha: 0.8 });
          // Small rotor circle on top
          const rotorAngle = gameTime * 8;
          g.circle(x, y - h * 0.35, 3);
          g.fill({ color: 0x889999, alpha: 0.7 });
          // Rotor blade lines (spinning)
          g.moveTo(x + Math.cos(rotorAngle) * 5, y - h * 0.35 + Math.sin(rotorAngle) * 2);
          g.lineTo(x - Math.cos(rotorAngle) * 5, y - h * 0.35 - Math.sin(rotorAngle) * 2);
          g.stroke({ color: 0xaabbcc, width: 1, alpha: 0.6 });
          // Exhaust glow at rear
          g.circle(x, y + h * 0.35, 2);
          g.fill({ color: 0x4488ff, alpha: 0.4 });

          // Draw heal beams to nearby wounded bio allies
          this.drawHealBeams(g, world, eid, x, y);

        } else {
          // Fallback for any unknown Terran unit
          g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          g.rect(x - w / 2, y - h / 2, w, h);
          g.fill({ color: bodyColor });
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

    // Death animation pass — units with hpCurrent <= 0 but not yet removed
    const DEATH_ANIM_DURATION = 0.3;
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, POSITION | RENDERABLE)) continue;
      if (hpCurrent[eid] > 0) continue;          // alive — handled above
      if (deathTime[eid] <= 0) continue;          // not yet tagged by DeathSystem
      const fac = faction[eid] as Faction;
      if (fac !== Faction.Terran && fac !== Faction.None && !isTileVisible(posX[eid], posY[eid])) continue;

      const elapsed = gameTime - deathTime[eid];
      const progress = Math.min(1, Math.max(0, elapsed / DEATH_ANIM_DURATION));
      const scale = 1 - progress;
      const alpha = 1 - progress;
      if (alpha <= 0 || scale <= 0) continue;

      const x = posX[eid];
      const y = posY[eid];
      const w = renderWidth[eid] * scale;
      const h = renderHeight[eid] * scale;
      const tint = renderTint[eid];
      const factionVal = faction[eid] as Faction;

      if (factionVal === Faction.Zerg) {
        g.ellipse(x, y, w / 2, h / 2);
        g.fill({ color: tint, alpha });
      } else {
        g.rect(x - w / 2, y - h / 2, w, h);
        g.fill({ color: tint, alpha });
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
