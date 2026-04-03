import { Container, Graphics } from 'pixi.js';
import { Faction, UnitType, SiegeMode, ResourceType, BuildState, BuildingType, CommandMode, WorkerState, SELECTION_COLOR, TILE_SIZE, MEDIVAC_HEAL_RANGE, ZERG_COLOR, TERRAN_VISOR, TERRAN_METAL, TERRAN_DARK, TERRAN_HIGHLIGHT, ZERG_ACID, ZERG_EYE, ZERG_FLESH } from '../constants';
import {
  POSITION, RENDERABLE, SELECTABLE, HEALTH, UNIT_TYPE, ATTACK, RESOURCE, BUILDING, WORKER,
  posX, posY, renderWidth, renderHeight, renderTint,
  selected, faction, hpCurrent, hpMax, unitType,
  atkFlashTimer, atkRange, atkDamage, targetEntity,
  stimEndTime, slowEndTime, slowFactor, siegeMode, siegeTransitionEnd, lastCombatTime, deathTime,
  resourceType, resourceRemaining,
  buildState, buildProgress, buildingType, rallyX, rallyY,
  workerCarrying, workerState,
  prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  velX, velY, commandMode,
  cloaked, energy, isAir,
  veterancyLevel,
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

function drawDashedLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha: number, dashLen: number, gapLen: number): void {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const nx = dx / len, ny = dy / len;
  let d = 0, drawing = true;
  while (d < len) {
    const seg = Math.min(drawing ? dashLen : gapLen, len - d);
    const ex = x1 + nx * (d + seg), ey = y1 + ny * (d + seg);
    if (drawing) {
      g.moveTo(x1 + nx * d, y1 + ny * d);
      g.lineTo(ex, ey);
      g.stroke({ color, width: 1, alpha });
    }
    d += seg;
    drawing = !drawing;
  }
}

function darken(color: number, amount: number): number {
  const r = Math.max(0, ((color >> 16) & 0xff) - amount);
  const g = Math.max(0, ((color >> 8) & 0xff) - amount);
  const b = Math.max(0, (color & 0xff) - amount);
  return (r << 16) | (g << 8) | b;
}

function lighten(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + amount);
  const g = Math.min(255, ((color >> 8) & 0xff) + amount);
  const b = Math.min(255, (color & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
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

  render(world: World, gameTime: number, viewportScale: number = 1): void {
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

      // Skip entities whose death animation has already completed
      if (deathTime[eid] > 0 && (gameTime - deathTime[eid]) >= 0.3) continue;

      // Resource entities render differently
      if (hasComponents(world, eid, RESOURCE)) {
        if (isSelected) {
          g.circle(x, y, Math.max(w, h) * 0.7);
          g.stroke({ color: SELECTION_COLOR, width: 1.5, alpha: 0.8 });
        }
        const rt = resourceType[eid] as ResourceType;
        if (rt === ResourceType.Mineral) {
          // Subtle blue glow beneath the crystal cluster
          g.circle(x, y + 2, Math.max(w, h) * 0.6);
          g.fill({ color: 0x4488ff, alpha: 0.15 });

          // Crystal cluster: 3 overlapping diamonds
          // Back-left crystal (slightly smaller)
          const s1 = 0.7;
          g.moveTo(x - 4, y - h / 2 * s1 + 1);
          g.lineTo(x - 4 + w / 2 * s1, y + 1);
          g.lineTo(x - 4, y + h / 2 * s1 + 1);
          g.lineTo(x - 4 - w / 2 * s1, y + 1);
          g.closePath();
          g.fill({ color: darken(tint, 30) });
          g.stroke({ color: 0x88ddff, width: 0.5, alpha: 0.4 });

          // Back-right crystal (slightly smaller)
          const s2 = 0.75;
          g.moveTo(x + 3, y - h / 2 * s2 + 2);
          g.lineTo(x + 3 + w / 2 * s2, y + 2);
          g.lineTo(x + 3, y + h / 2 * s2 + 2);
          g.lineTo(x + 3 - w / 2 * s2, y + 2);
          g.closePath();
          g.fill({ color: darken(tint, 15) });
          g.stroke({ color: 0x88ddff, width: 0.5, alpha: 0.4 });

          // Front crystal (full size, on top)
          g.moveTo(x, y - h / 2);
          g.lineTo(x + w / 2, y);
          g.lineTo(x, y + h / 2);
          g.lineTo(x - w / 2, y);
          g.closePath();
          g.fill({ color: tint });
          g.stroke({ color: 0x88ddff, width: 1, alpha: 0.5 });

          // White highlight on top-right edge of front crystal
          g.moveTo(x + 1, y - h / 2 + 2);
          g.lineTo(x + w / 2 - 2, y - 1);
          g.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
        } else {
          // Gas geyser base: pulsing circle
          const pulse = 0.6 + 0.2 * Math.sin(gameTime * 3);
          g.circle(x, y, w / 2);
          g.fill({ color: tint, alpha: pulse });
          g.stroke({ color: 0x88ff88, width: 1, alpha: 0.4 });

          // Rising gas jets: 2-3 small circles drifting upward
          for (let j = 0; j < 3; j++) {
            const offsetX = Math.sin(gameTime * 2.5 + j * 2.1) * 3;
            const rise = ((gameTime * 0.8 + j * 0.33) % 1.0); // 0..1 repeating
            const jetY = y - rise * 14;
            const jetAlpha = Math.max(0, 0.5 * (1 - rise));
            const jetR = 1.5 + (1 - rise) * 1.0;
            if (jetAlpha > 0.02) {
              g.circle(x + offsetX, jetY, jetR);
              g.fill({ color: 0x88ff88, alpha: jetAlpha });
            }
          }
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

        const isZergBuilding = bt === BuildingType.Hatchery || bt === BuildingType.SpawningPool
          || bt === BuildingType.EvolutionChamber || bt === BuildingType.RoachWarren
          || bt === BuildingType.HydraliskDen || bt === BuildingType.Spire
          || bt === BuildingType.InfestationPit;

        if (isZergBuilding) {
          // === Zerg buildings: organic ellipses ===

          // Creep ground indicator — subtly breathes
          const creepBreathe = 1 + 0.02 * Math.sin(gameTime * 1.2);
          g.ellipse(x, y, (w / 2 + 8) * creepBreathe, (h / 2 + 8) * creepBreathe);
          g.fill({ color: 0x331111, alpha: 0.5 * baseAlpha });

          // Shadow behind
          g.ellipse(x, y, w / 2 + 2, h / 2 + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });

          // Main body ellipse
          g.ellipse(x, y, w / 2, h / 2);
          g.fill({ color: tint, alpha: baseAlpha });

          if (bt === BuildingType.Hatchery) {
            // Hatchery: large organic shape with breathing veins
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0xaa4444, width: 2, alpha: 0.7 * baseAlpha });

            // Inner membrane ring — breathes
            const breathe = 1 + 0.05 * Math.sin(gameTime * 1.5);
            g.ellipse(x, y, w * 0.3 * breathe, h * 0.3 * breathe);
            g.stroke({ color: 0xcc5555, width: 1.5, alpha: 0.5 * baseAlpha });

            // Pulsing core with glow halo
            const pulse = 0.4 + 0.3 * Math.sin(gameTime * 2);
            g.circle(x, y, 10);
            g.fill({ color: 0xff4422, alpha: pulse * 0.2 * baseAlpha });
            g.circle(x, y, 6);
            g.fill({ color: 0xff6644, alpha: pulse * baseAlpha });

            // Pulsing organic veins radiating outward
            for (let v = 0; v < 8; v++) {
              const angle = (v / 8) * Math.PI * 2;
              const veinPulse = 0.3 + 0.2 * Math.sin(gameTime * 2.5 + v * 0.8);
              const innerR = 8;
              const outerR = Math.min(w, h) * 0.4;
              g.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
              g.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
              g.stroke({ color: 0x993333, width: 1.5, alpha: veinPulse * baseAlpha });
            }

            // Larva cocoons around the edge (when complete)
            if (bs === BuildState.Complete) {
              for (let lv = 0; lv < 4; lv++) {
                const lAngle = (lv / 4) * Math.PI * 2 + Math.PI / 4;
                const lR = Math.min(w, h) * 0.38;
                const lx = x + Math.cos(lAngle) * lR;
                const ly = y + Math.sin(lAngle) * lR;
                const wobble = 2 + Math.sin(gameTime * 3 + lv * 1.5) * 1;
                g.ellipse(lx, ly, wobble + 1, wobble);
                g.fill({ color: 0xcc6644, alpha: 0.5 * baseAlpha });
              }
            }
          } else if (bt === BuildingType.SpawningPool) {
            // SpawningPool: bubbling biomass pool
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x661111, width: 2, alpha: 0.7 * baseAlpha });

            // Pulsing glow ring
            const glow = 0.3 + 0.3 * Math.sin(gameTime * 3);
            g.ellipse(x, y, w / 2 + 4, h / 2 + 4);
            g.stroke({ color: 0xff4422, width: 2, alpha: glow * baseAlpha });

            // Inner bubbling circles — more and varied
            for (let b = 0; b < 5; b++) {
              const bAngle = (b / 5) * Math.PI * 2;
              const bDist = w * 0.15 + Math.sin(gameTime * 2 + b) * 3;
              const bx = x + Math.cos(bAngle + gameTime * 0.5) * bDist;
              const by = y + Math.sin(bAngle + gameTime * 0.5) * bDist * 0.7;
              const br = 2 + Math.sin(gameTime * 4 + b * 1.3) * 1;
              g.circle(bx, by, br);
              g.fill({ color: 0xaa3322, alpha: 0.5 * baseAlpha });
            }

            // Rising vapor/steam when complete
            if (bs === BuildState.Complete) {
              for (let v = 0; v < 3; v++) {
                const rise = ((gameTime * 0.6 + v * 0.33) % 1.0);
                const vx = x + Math.sin(gameTime * 1.2 + v * 2.1) * 5;
                const vy = y - rise * 16 - 4;
                const vAlpha = Math.max(0, 0.35 * (1 - rise));
                const vr = 2 + rise * 2;
                if (vAlpha > 0.02) {
                  g.circle(vx, vy, vr);
                  g.fill({ color: 0xff6644, alpha: vAlpha * baseAlpha });
                }
              }
            }
          } else if (bt === BuildingType.EvolutionChamber) {
            // EvolutionChamber: mutation/upgrade building — DNA helix + mutation glow
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x226622, width: 2, alpha: 0.7 * baseAlpha });

            // Rotating DNA helix: phase shifts over time to simulate rotation
            const helixLen = w * 0.4;
            const helixAmp = h * 0.15;
            const helixPhase = gameTime * 1.5; // rotation speed
            for (let i = 0; i < 14; i++) {
              const t0 = i / 14;
              const t1 = (i + 1) / 14;
              const x0 = x - helixLen + t0 * helixLen * 2;
              const x1 = x - helixLen + t1 * helixLen * 2;
              // Strand 1 — depth simulated by alpha variation
              const y0a = y + Math.sin(t0 * Math.PI * 3 + helixPhase) * helixAmp;
              const y1a = y + Math.sin(t1 * Math.PI * 3 + helixPhase) * helixAmp;
              const depth1 = 0.4 + 0.3 * Math.sin(t0 * Math.PI * 3 + helixPhase + Math.PI / 2);
              g.moveTo(x0, y0a);
              g.lineTo(x1, y1a);
              g.stroke({ color: 0x44cc44, width: 1.5, alpha: depth1 * baseAlpha });
              // Strand 2 (offset by PI)
              const y0b = y + Math.sin(t0 * Math.PI * 3 + helixPhase + Math.PI) * helixAmp;
              const y1b = y + Math.sin(t1 * Math.PI * 3 + helixPhase + Math.PI) * helixAmp;
              const depth2 = 0.4 + 0.3 * Math.sin(t0 * Math.PI * 3 + helixPhase + Math.PI + Math.PI / 2);
              g.moveTo(x0, y0b);
              g.lineTo(x1, y1b);
              g.stroke({ color: 0x33aa33, width: 1.5, alpha: depth2 * baseAlpha });
              // Cross-links between strands (rungs of the ladder)
              if (i % 3 === 0) {
                g.moveTo(x0, y0a);
                g.lineTo(x0, y0b);
                g.stroke({ color: 0x228822, width: 0.8, alpha: 0.3 * baseAlpha });
              }
            }

            // Mutation glow: pulsing green aura
            const mutGlow = 0.2 + 0.2 * Math.sin(gameTime * 2.5);
            g.ellipse(x, y, w / 2 + 5, h / 2 + 5);
            g.stroke({ color: 0x44ff44, width: 2, alpha: mutGlow * baseAlpha });
          } else if (bt === BuildingType.RoachWarren) {
            // RoachWarren: acid pool + carapace arch
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x445522, width: 2, alpha: 0.7 * baseAlpha });

            // Acid pool with animated surface
            const acidPulse = 1 + 0.04 * Math.sin(gameTime * 2);
            g.ellipse(x, y + h * 0.05, w * 0.3 * acidPulse, h * 0.2 * acidPulse);
            g.fill({ color: 0x88aa22, alpha: 0.5 * baseAlpha });
            // Bubbles rising from acid
            for (let b = 0; b < 5; b++) {
              const bAngle = (b / 5) * Math.PI * 2;
              const bDist = w * 0.18;
              const bx = x + Math.cos(bAngle + gameTime * 0.7) * bDist;
              const rise = ((gameTime * 0.8 + b * 0.2) % 1.0);
              const by = y + h * 0.05 - rise * 8;
              const br = 1.5 + Math.sin(gameTime * 4 + b) * 0.5;
              const bAlpha = Math.max(0, 0.6 * (1 - rise));
              if (bAlpha > 0.02) {
                g.circle(bx, by, br);
                g.fill({ color: 0xaacc33, alpha: bAlpha * baseAlpha });
              }
            }

            // Carapace arch with ridges
            g.arc(x, y, w * 0.3, Math.PI, 0, false);
            g.stroke({ color: 0x334411, width: 3, alpha: 0.7 * baseAlpha });
            g.arc(x, y, w * 0.25, Math.PI * 0.9, Math.PI * 0.1, false);
            g.stroke({ color: 0x445522, width: 1.5, alpha: 0.4 * baseAlpha });
          } else if (bt === BuildingType.HydraliskDen) {
            // HydraliskDen: swaying spine rack + dripping venom
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x224444, width: 2, alpha: 0.7 * baseAlpha });

            // Spine rack: 5 spines that sway in the wind
            const spineCount = 5;
            for (let s = 0; s < spineCount; s++) {
              const sx = x + (s - (spineCount - 1) / 2) * (w * 0.12);
              const sway = Math.sin(gameTime * 1.8 + s * 1.2) * 2;
              const spineH = h * 0.3 + Math.sin(gameTime * 2 + s) * 2;
              g.moveTo(sx - 2, y - h * 0.05);
              g.lineTo(sx + sway, y - h * 0.05 - spineH);
              g.lineTo(sx + 2, y - h * 0.05);
              g.closePath();
              g.fill({ color: 0x33aaaa, alpha: 0.7 * baseAlpha });
              // Bright tip
              g.circle(sx + sway, y - h * 0.05 - spineH, 1.5);
              g.fill({ color: 0x66ffff, alpha: 0.6 * baseAlpha });
            }

            // Venom drip trails falling from spine tips
            if (bs === BuildState.Complete) {
              for (let s = 0; s < 3; s++) {
                const sx = x + (s - 1) * (w * 0.12);
                const fall = ((gameTime * 1.2 + s * 0.4) % 1.0);
                const dripY = y - h * 0.05 + fall * h * 0.35;
                const dAlpha = Math.max(0, 0.5 * (1 - fall));
                if (dAlpha > 0.02) {
                  g.circle(sx, dripY, 1.5 - fall * 0.8);
                  g.fill({ color: 0x22cccc, alpha: dAlpha * baseAlpha });
                }
              }
            }
          } else if (bt === BuildingType.Spire) {
            // Spire: tall spire with pulsing tip + wing motifs
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x442244, width: 2, alpha: 0.7 * baseAlpha });

            // Tall spire shape
            g.moveTo(x - w * 0.12, y + h * 0.15);
            g.lineTo(x, y - h * 0.4);
            g.lineTo(x + w * 0.12, y + h * 0.15);
            g.closePath();
            g.fill({ color: 0x9944aa, alpha: 0.7 * baseAlpha });
            // Highlight edge
            g.moveTo(x, y - h * 0.4);
            g.lineTo(x + w * 0.08, y + h * 0.05);
            g.stroke({ color: 0xbb66dd, width: 1, alpha: 0.4 * baseAlpha });

            // Pulsing tip light
            if (bs === BuildState.Complete) {
              const tipGlow = 0.5 + 0.4 * Math.sin(gameTime * 3);
              g.circle(x, y - h * 0.4, 4);
              g.fill({ color: 0xcc66ff, alpha: tipGlow * 0.3 * baseAlpha });
              g.circle(x, y - h * 0.4, 2);
              g.fill({ color: 0xee88ff, alpha: tipGlow * baseAlpha });
            }

            // Wing motifs with subtle flap animation
            for (let wg = 0; wg < 4; wg++) {
              const baseAngle = (wg / 4) * Math.PI * 2 - Math.PI / 4;
              const flapOffset = Math.sin(gameTime * 2 + wg * 1.5) * 0.08;
              const angle = baseAngle + flapOffset;
              const innerR = w * 0.1;
              const outerR = w * 0.3;
              g.moveTo(x + Math.cos(angle) * innerR, y + Math.sin(angle) * innerR);
              g.lineTo(x + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
              g.stroke({ color: 0x7733aa, width: 1.5, alpha: 0.5 * baseAlpha });
            }
          } else if (bt === BuildingType.InfestationPit) {
            // InfestationPit: writhing tentacles + spore cloud
            g.ellipse(x, y, w / 2, h / 2);
            g.stroke({ color: 0x442233, width: 2, alpha: 0.7 * baseAlpha });

            // Central maw — dark pulsing pit
            const mawPulse = 1 + 0.1 * Math.sin(gameTime * 2);
            g.ellipse(x, y, 6 * mawPulse, 5 * mawPulse);
            g.fill({ color: 0x110011, alpha: 0.8 * baseAlpha });

            // 6 writhing tentacles
            for (let t = 0; t < 6; t++) {
              const baseAngle = (t / 6) * Math.PI * 2;
              const wave1 = Math.sin(gameTime * 2.5 + t * 1.1) * 0.25;
              const wave2 = Math.sin(gameTime * 1.8 + t * 2.3) * 0.15;
              const midR = w * 0.18;
              const outerR = w * 0.36;
              const mx = x + Math.cos(baseAngle + wave1) * midR;
              const my = y + Math.sin(baseAngle + wave1) * midR;
              const ex = x + Math.cos(baseAngle + wave2) * outerR;
              const ey = y + Math.sin(baseAngle + wave2) * outerR;
              g.moveTo(x, y);
              g.lineTo(mx, my);
              g.lineTo(ex, ey);
              g.stroke({ color: 0x884466, width: 2, alpha: 0.6 * baseAlpha });
              // Tentacle tip glow
              g.circle(ex, ey, 2);
              g.fill({ color: 0xaa5577, alpha: 0.5 * baseAlpha });
            }

            // Spore cloud: 5 floating spores with drift
            for (let s = 0; s < 5; s++) {
              const sAngle = (s / 5) * Math.PI * 2 + gameTime * 0.8;
              const sR = w * 0.2 + Math.sin(gameTime * 1.5 + s * 2) * 4;
              const sx = x + Math.cos(sAngle) * sR;
              const sy = y + Math.sin(sAngle) * sR;
              const sAlpha = 0.3 + 0.2 * Math.sin(gameTime * 3 + s);
              g.circle(sx, sy, 2.5);
              g.fill({ color: 0xaa4488, alpha: sAlpha * baseAlpha });
            }
          }
        } else {
        // === Terran buildings: unique silhouettes per type ===
        const hw = w / 2;
        const hh = h / 2;

        let borderColor = 0x446688;
        if (bt === BuildingType.CommandCenter) borderColor = 0x5588bb;
        else if (bt === BuildingType.SupplyDepot) borderColor = 0x3366aa;
        else if (bt === BuildingType.Barracks) borderColor = 0x6644aa;
        else if (bt === BuildingType.Refinery) borderColor = 0x448844;
        else if (bt === BuildingType.Factory) borderColor = 0x886644;
        else if (bt === BuildingType.Starport) borderColor = 0x4466aa;
        else if (bt === BuildingType.EngineeringBay) borderColor = 0x5577cc;

        if (bt === BuildingType.CommandCenter) {
          // Octagonal footprint
          const cut = 16;
          g.moveTo(x - hw + cut, y - hh); g.lineTo(x + hw - cut, y - hh);
          g.lineTo(x + hw, y - hh + cut); g.lineTo(x + hw, y + hh - cut);
          g.lineTo(x + hw - cut, y + hh); g.lineTo(x - hw + cut, y + hh);
          g.lineTo(x - hw, y + hh - cut); g.lineTo(x - hw, y - hh + cut);
          g.closePath();
          g.fill({ color: 0x000000, alpha: 0.4 }); // shadow
          g.moveTo(x - hw + cut + 2, y - hh + 2); g.lineTo(x + hw - cut - 2, y - hh + 2);
          g.lineTo(x + hw - 2, y - hh + cut + 2); g.lineTo(x + hw - 2, y + hh - cut - 2);
          g.lineTo(x + hw - cut - 2, y + hh - 2); g.lineTo(x - hw + cut + 2, y + hh - 2);
          g.lineTo(x - hw + 2, y + hh - cut - 2); g.lineTo(x - hw + 2, y - hh + cut + 2);
          g.closePath();
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 2, alpha: baseAlpha });
        } else if (bt === BuildingType.SupplyDepot) {
          // Beveled hexagonal shape
          const bev = 12;
          g.moveTo(x - hw + bev, y - hh); g.lineTo(x + hw - bev, y - hh);
          g.lineTo(x + hw, y - hh + bev); g.lineTo(x + hw, y + hh - bev);
          g.lineTo(x + hw - bev, y + hh); g.lineTo(x - hw + bev, y + hh);
          g.lineTo(x - hw, y + hh - bev); g.lineTo(x - hw, y - hh + bev);
          g.closePath();
          g.fill({ color: 0x000000, alpha: 0.4 });
          const b2 = bev - 2;
          g.moveTo(x - hw + b2 + 2, y - hh + 2); g.lineTo(x + hw - b2 - 2, y - hh + 2);
          g.lineTo(x + hw - 2, y - hh + b2 + 2); g.lineTo(x + hw - 2, y + hh - b2 - 2);
          g.lineTo(x + hw - b2 - 2, y + hh - 2); g.lineTo(x - hw + b2 + 2, y + hh - 2);
          g.lineTo(x - hw + 2, y + hh - b2 - 2); g.lineTo(x - hw + 2, y - hh + b2 + 2);
          g.closePath();
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 1.5, alpha: baseAlpha });
        } else if (bt === BuildingType.Barracks) {
          // L-shaped: main block + entrance extension at bottom
          const bayW = w * 0.35;
          const bayH = 10;
          // Shadow
          g.rect(x - hw - 2, y - hh - 2, w + 4, h + 4 + bayH);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main block
          g.rect(x - hw, y - hh, w, h);
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 2, alpha: baseAlpha });
          // Extension
          g.rect(x - bayW / 2, y + hh, bayW, bayH);
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 1.5, alpha: baseAlpha });
        } else if (bt === BuildingType.Factory) {
          // Main block + smokestack protrusion on top-right
          const stackW = 12;
          const stackH = 16;
          // Shadow
          g.rect(x - hw - 2, y - hh - stackH - 2, w + 4, h + stackH + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main block
          g.rect(x - hw, y - hh, w, h);
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 2, alpha: baseAlpha });
          // Smokestack
          g.rect(x + hw - stackW - 6, y - hh - stackH, stackW, stackH);
          g.fill({ color: darken(tint, 15), alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 1, alpha: 0.7 * baseAlpha });
        } else if (bt === BuildingType.Starport) {
          // Main block + angled wings
          // Shadow
          g.rect(x - hw - 12, y - hh - 2, w + 24, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Main block
          g.rect(x - hw, y - hh, w, h);
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 2, alpha: baseAlpha });
          // Left wing stub
          g.moveTo(x - hw, y + hh * 0.3);
          g.lineTo(x - hw - 10, y + hh * 0.5);
          g.lineTo(x - hw - 10, y - hh * 0.1);
          g.lineTo(x - hw, y - hh * 0.3);
          g.closePath();
          g.fill({ color: darken(tint, 10), alpha: baseAlpha });
          // Right wing stub
          g.moveTo(x + hw, y + hh * 0.3);
          g.lineTo(x + hw + 10, y + hh * 0.5);
          g.lineTo(x + hw + 10, y - hh * 0.1);
          g.lineTo(x + hw, y - hh * 0.3);
          g.closePath();
          g.fill({ color: darken(tint, 10), alpha: baseAlpha });
        } else {
          // Default: plain rectangle (Refinery, EngineeringBay, etc.)
          g.rect(x - hw - 2, y - hh - 2, w + 4, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          g.rect(x - hw, y - hh, w, h);
          g.fill({ color: tint, alpha: baseAlpha });
          g.stroke({ color: borderColor, width: 2, alpha: baseAlpha });
        }

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
          // Panel lines across the octagonal body
          const cut = 16;
          const panelStep = 16;
          for (let py = -hh + panelStep; py < hh; py += panelStep) {
            const xInset = (Math.abs(py) > hh - cut) ? cut * 0.7 : 4;
            g.moveTo(x - hw + xInset, y + py);
            g.lineTo(x + hw - xInset, y + py);
            g.stroke({ color: 0x6699cc, width: 0.6, alpha: 0.25 * baseAlpha });
          }

          // Rotating radar dish on top
          const radarAngle = gameTime * 1.5;
          const radarR = 12;
          g.moveTo(x, y - hh * 0.15);
          g.lineTo(x + Math.cos(radarAngle) * radarR, y - hh * 0.15 + Math.sin(radarAngle) * radarR * 0.4);
          g.stroke({ color: 0xffcc44, width: 2, alpha: 0.7 * baseAlpha });
          g.circle(x, y - hh * 0.15, 3);
          g.fill({ color: 0xffcc44, alpha: 0.8 * baseAlpha });

          // Command windows — row of lit windows across center
          if (bs === BuildState.Complete) {
            const winY = y + hh * 0.2;
            for (let wi = -2; wi <= 2; wi++) {
              const winX = x + wi * 14;
              const glow = 0.5 + 0.2 * Math.sin(gameTime * 2 + wi * 0.8);
              g.rect(winX - 4, winY - 2, 8, 4);
              g.fill({ color: 0x88ccff, alpha: glow * baseAlpha });
            }
          }

          // Gold Terran insignia — small diamond
          g.moveTo(x, y + hh * 0.5 - 5);
          g.lineTo(x + 4, y + hh * 0.5);
          g.lineTo(x, y + hh * 0.5 + 5);
          g.lineTo(x - 4, y + hh * 0.5);
          g.closePath();
          g.fill({ color: 0xffcc44, alpha: 0.8 * baseAlpha });
        } else if (bt === BuildingType.SupplyDepot) {
          // Crate grid: 2x2 inner supply crates
          const crateGap = 3;
          const crateW = (w - crateGap * 3) / 2;
          const crateH = (h - crateGap * 3) / 2;
          for (let cr = 0; cr < 2; cr++) {
            for (let cc = 0; cc < 2; cc++) {
              const cx = x - hw + crateGap + cc * (crateW + crateGap) + crateW / 2;
              const cy = y - hh + crateGap + cr * (crateH + crateGap) + crateH / 2;
              g.rect(cx - crateW / 2, cy - crateH / 2, crateW, crateH);
              g.fill({ color: darken(tint, 10 + cr * 5), alpha: 0.8 * baseAlpha });
              g.stroke({ color: 0x5577aa, width: 0.8, alpha: 0.4 * baseAlpha });
              // Strapping line across each crate
              g.moveTo(cx - crateW / 2 + 2, cy);
              g.lineTo(cx + crateW / 2 - 2, cy);
              g.stroke({ color: 0x88aacc, width: 0.6, alpha: 0.3 * baseAlpha });
            }
          }
        } else if (bt === BuildingType.Barracks) {
          // Door opening in the entrance bay
          const doorW = w * 0.3;
          const doorH = 7;
          g.rect(x - doorW / 2, y + hh + 1, doorW, doorH);
          g.fill({ color: TERRAN_DARK, alpha: 0.9 * baseAlpha });
          g.rect(x - doorW / 2, y + hh + 1, doorW, doorH);
          g.stroke({ color: 0x6688aa, width: 0.8, alpha: 0.5 * baseAlpha });

          // Military chevron (V-shape pointing up)
          g.moveTo(x - 10, y + 4);
          g.lineTo(x, y - 6);
          g.lineTo(x + 10, y + 4);
          g.stroke({ color: 0xddddff, width: 2.5, alpha: 0.5 * baseAlpha });
          g.moveTo(x - 8, y + 8);
          g.lineTo(x, y - 2);
          g.lineTo(x + 8, y + 8);
          g.stroke({ color: 0xddddff, width: 1.5, alpha: 0.35 * baseAlpha });

          // Inner border + window lights when complete
          const inset = 5;
          g.rect(x - hw + inset, y - hh + inset, w - inset * 2, h - inset * 2);
          g.stroke({ color: 0x6644aa, width: 0.8, alpha: 0.3 * baseAlpha });
          if (bs === BuildState.Complete) {
            // Two rows of windows
            for (let wr = 0; wr < 2; wr++) {
              const winY = y - hh * 0.3 + wr * hh * 0.5;
              for (let wi = -1; wi <= 1; wi++) {
                const glow = 0.4 + 0.2 * Math.sin(gameTime * 1.8 + wi * 1.2 + wr * 2);
                g.rect(x + wi * 16 - 3, winY - 2, 6, 4);
                g.fill({ color: 0x9988ff, alpha: glow * baseAlpha });
              }
            }
          }
        } else if (bt === BuildingType.Refinery) {
          // Two cylindrical tanks (vertical rectangles with rounded tops)
          const tankW = w * 0.22;
          const tankH = h * 0.55;
          // Left tank
          g.rect(x - w * 0.25 - tankW / 2, y - tankH / 2, tankW, tankH);
          g.fill({ color: 0x445544, alpha: 0.7 * baseAlpha });
          g.rect(x - w * 0.25 - tankW / 2, y - tankH / 2, tankW, tankH);
          g.stroke({ color: 0x668866, width: 1, alpha: 0.6 * baseAlpha });
          g.circle(x - w * 0.25, y - tankH / 2, tankW / 2);
          g.fill({ color: 0x445544, alpha: 0.7 * baseAlpha });
          // Right tank
          g.rect(x + w * 0.25 - tankW / 2, y - tankH / 2, tankW, tankH);
          g.fill({ color: 0x445544, alpha: 0.7 * baseAlpha });
          g.rect(x + w * 0.25 - tankW / 2, y - tankH / 2, tankW, tankH);
          g.stroke({ color: 0x668866, width: 1, alpha: 0.6 * baseAlpha });
          g.circle(x + w * 0.25, y - tankH / 2, tankW / 2);
          g.fill({ color: 0x445544, alpha: 0.7 * baseAlpha });
          // Connecting pipe between tanks
          g.rect(x - w * 0.12, y - 2, w * 0.24, 4);
          g.fill({ color: 0x556655, alpha: 0.6 * baseAlpha });
          // Green gas venting glow on top of each tank
          const ventPulse = 0.3 + 0.2 * Math.sin(gameTime * 3);
          g.circle(x - w * 0.25, y - tankH / 2 - 2, 4);
          g.fill({ color: 0x44ff66, alpha: ventPulse * baseAlpha });
          g.circle(x + w * 0.25, y - tankH / 2 - 2, 4);
          g.fill({ color: 0x44ff66, alpha: ventPulse * baseAlpha });
        } else if (bt === BuildingType.Factory) {
          // Smokestack cap (stack body is part of base shape)
          g.rect(x + hw - 20, y - hh - 18, 16, 3);
          g.fill({ color: TERRAN_METAL, alpha: baseAlpha });
          // Smoke puffs rising from stack (only when complete)
          if (bs === BuildState.Complete) {
            for (let p = 0; p < 3; p++) {
              const rise = ((gameTime * 0.5 + p * 0.33) % 1.0);
              const smokeX = x + hw - 12 + Math.sin(gameTime * 1.5 + p * 2) * 3;
              const smokeY = y - hh - 20 - rise * 18;
              const smokeAlpha = Math.max(0, 0.25 * (1 - rise));
              const smokeR = 2 + rise * 3;
              if (smokeAlpha > 0.02) {
                g.circle(smokeX, smokeY, smokeR);
                g.fill({ color: 0x888888, alpha: smokeAlpha * baseAlpha });
              }
            }
          }

          // Rotating gear icon — spins when building is complete
          const gearR = 13;
          const gearInner = 8;
          const teeth = 6;
          const gearSpin = bs === BuildState.Complete ? gameTime * 0.8 : 0;
          for (let t = 0; t < teeth; t++) {
            const angle = (t / teeth) * Math.PI * 2 + gearSpin;
            const nextAngle = ((t + 0.5) / teeth) * Math.PI * 2 + gearSpin;
            g.moveTo(x + Math.cos(angle) * gearInner, y + Math.sin(angle) * gearInner);
            g.lineTo(x + Math.cos(angle) * gearR, y + Math.sin(angle) * gearR);
            g.lineTo(x + Math.cos(nextAngle) * gearR, y + Math.sin(nextAngle) * gearR);
            g.lineTo(x + Math.cos(nextAngle) * gearInner, y + Math.sin(nextAngle) * gearInner);
            g.stroke({ color: 0xccaa44, width: 2, alpha: 0.6 * baseAlpha });
          }
          g.circle(x, y, 3);
          g.fill({ color: 0xccaa44, alpha: 0.5 * baseAlpha });
          // Outer gear ring
          g.circle(x, y, gearR + 1);
          g.stroke({ color: 0x886633, width: 1, alpha: 0.3 * baseAlpha });

          // Track marks at the bottom — horizontal dashes
          const trackY = y + h / 2 - 5;
          for (let tx = -w / 2 + 6; tx < w / 2 - 6; tx += 8) {
            g.rect(x + tx, trackY, 5, 3);
            g.fill({ color: TERRAN_DARK, alpha: 0.5 * baseAlpha });
          }

          // Door rectangle at bottom
          const doorW2 = 12;
          const doorH2 = 7;
          g.rect(x - doorW2 / 2, y + h / 2 - doorH2, doorW2, doorH2);
          g.fill({ color: 0x112244, alpha: 0.8 * baseAlpha });
          g.rect(x - doorW2 / 2, y + h / 2 - doorH2, doorW2, doorH2);
          g.stroke({ color: 0x886644, width: 1, alpha: 0.6 * baseAlpha });
        } else if (bt === BuildingType.Starport) {
          // Landing pad circle in center
          g.circle(x, y + hh * 0.1, 16);
          g.fill({ color: darken(tint, 15), alpha: 0.5 * baseAlpha });
          g.circle(x, y + hh * 0.1, 16);
          g.stroke({ color: 0x6688cc, width: 1.5, alpha: 0.6 * baseAlpha });
          g.circle(x, y + hh * 0.1, 8);
          g.stroke({ color: 0x6688cc, width: 1, alpha: 0.4 * baseAlpha });

          // V wing icon
          g.moveTo(x - w * 0.3, y - hh * 0.4);
          g.lineTo(x, y + hh * 0.05);
          g.lineTo(x + w * 0.3, y - hh * 0.4);
          g.stroke({ color: 0x88aaff, width: 2.5, alpha: 0.6 * baseAlpha });
          g.moveTo(x - w * 0.2, y - hh * 0.1);
          g.lineTo(x + w * 0.2, y - hh * 0.1);
          g.stroke({ color: 0x88aaff, width: 2, alpha: 0.4 * baseAlpha });

          // Blinking runway lights on the landing pad
          if (bs === BuildState.Complete) {
            const blinkPhase = Math.floor(gameTime * 2) % 4;
            for (let li = 0; li < 4; li++) {
              const lAngle = (li / 4) * Math.PI * 2 - Math.PI / 2;
              const lx = x + Math.cos(lAngle) * 14;
              const ly = y + hh * 0.1 + Math.sin(lAngle) * 14;
              const lit = li === blinkPhase;
              g.circle(lx, ly, 2);
              g.fill({ color: lit ? 0x44ff88 : 0x224433, alpha: (lit ? 0.9 : 0.3) * baseAlpha });
            }
          }
        } else if (bt === BuildingType.EngineeringBay) {
          // Satellite dish with scanning beam
          const dishR = 14;
          g.arc(x, y - 2, dishR, Math.PI * 0.15, Math.PI * 0.85);
          g.stroke({ color: 0x88aadd, width: 2.5, alpha: 0.7 * baseAlpha });
          g.arc(x, y - 2, dishR * 0.6, Math.PI * 0.2, Math.PI * 0.8);
          g.stroke({ color: 0x88aadd, width: 1.5, alpha: 0.4 * baseAlpha });
          // Dish feed
          g.moveTo(x, y - 2);
          g.lineTo(x, y + dishR + 2);
          g.stroke({ color: 0x88aadd, width: 1.5, alpha: 0.6 * baseAlpha });
          g.circle(x, y - dishR * 0.3, 2.5);
          g.fill({ color: 0x66ccff, alpha: 0.8 * baseAlpha });
          g.rect(x - 4, y + dishR, 8, 5);
          g.fill({ color: TERRAN_METAL, alpha: 0.6 * baseAlpha });

          // Scanning beam sweep when complete
          if (bs === BuildState.Complete) {
            const scanAngle = gameTime * 2;
            const beamLen = dishR * 1.2;
            const beamX = x + Math.cos(scanAngle) * beamLen;
            const beamY = y - dishR * 0.3 + Math.sin(scanAngle) * beamLen * 0.3;
            g.moveTo(x, y - dishR * 0.3);
            g.lineTo(beamX, beamY);
            g.stroke({ color: 0x66ccff, width: 1, alpha: 0.4 * baseAlpha });
            g.circle(beamX, beamY, 2);
            g.fill({ color: 0x66ccff, alpha: 0.6 * baseAlpha });
          }

          // Research glow: pulsing ring when researching
          if (prodUnitType[eid] > 0 && prodTimeTotal[eid] > 0) {
            const resGlow = 0.2 + 0.2 * Math.sin(gameTime * 3);
            g.circle(x, y, Math.max(w, h) * 0.35);
            g.stroke({ color: 0x5577cc, width: 2, alpha: resGlow * baseAlpha });
          }
        }
        } // close Terran buildings else block

        // Power indicator light (all completed Terran buildings)
        if (bs === BuildState.Complete && !isZergBuilding) {
          const pwrGlow = 0.5 + 0.3 * Math.sin(gameTime * 1.5);
          g.circle(x - w / 2 + 6, y + h / 2 - 6, 2.5);
          g.fill({ color: 0x44aaff, alpha: pwrGlow * baseAlpha });
        }

        // Production glow — pulsing aura when actively training a unit
        if (bs === BuildState.Complete && prodUnitType[eid] > 0 && prodTimeTotal[eid] > 0) {
          const prodGlow = 0.15 + 0.1 * Math.sin(gameTime * 4);
          const glowColor = isZergBuilding ? 0xff6644 : 0x44aaff;
          const glowR = Math.max(w, h) / 2 + 6;
          g.circle(x, y, glowR);
          g.stroke({ color: glowColor, width: 2, alpha: prodGlow });
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

          // Fire effect at critical HP (< 25%)
          if (hpRatio < 0.25 && hpRatio > 0) {
            const flicker1 = Math.sin(gameTime * 8 + eid * 1.7) > 0;
            const flicker2 = Math.sin(gameTime * 11 + eid * 2.3) > 0;
            if (flicker1) {
              g.circle(x - w * 0.2, y - h * 0.5 - 3, 4);
              g.fill({ color: 0xff6600, alpha: 0.7 });
              g.circle(x - w * 0.2, y - h * 0.5 - 3, 2);
              g.fill({ color: 0xffcc00, alpha: 0.8 });
            }
            if (flicker2) {
              g.circle(x + w * 0.15, y - h * 0.5 - 5, 3);
              g.fill({ color: 0xff4400, alpha: 0.7 });
            }
          }
        }

        // Rally point indicator
        if (isSelected && rallyX[eid] !== -1) {
          const bx = posX[eid];
          const by = posY[eid];
          const rx = rallyX[eid];
          const ry = rallyY[eid];

          // Dashed line to rally point
          drawDashedLine(g, bx, by, rx, ry, 0x44ff88, 0.5, 5, 4);

          // Flag marker at rally point
          g.moveTo(rx, ry - 10);
          g.lineTo(rx, ry);
          g.moveTo(rx, ry - 10);
          g.lineTo(rx + 7, ry - 7);
          g.lineTo(rx, ry - 4);
          g.stroke({ color: 0x44ff88, width: 1.5, alpha: 0.8 });
        }

        // Production progress ring (visible without selecting)
        if (bs === BuildState.Complete && prodUnitType[eid] > 0 && prodTimeTotal[eid] > 0) {
          const prodRatio = 1 - (prodProgress[eid] / prodTimeTotal[eid]);
          const arcRadius = Math.max(w, h) / 2 + 5;
          const startAngle = -Math.PI / 2; // 12 o'clock
          const endAngle = startAngle + prodRatio * Math.PI * 2;
          const prodPulse = 0.6 + Math.sin(gameTime * 3) * 0.15;

          // Outer glow ring (full circle, dim)
          g.circle(x, y, arcRadius + 1);
          g.stroke({ color: 0xff8800, width: 1, alpha: 0.15 * prodPulse });

          // Progress arc (bright, thicker)
          g.arc(x, y, arcRadius, startAngle, endAngle, false);
          g.stroke({ color: 0xffaa22, width: 2.5, alpha: prodPulse });

          // Leading dot at the arc's tip
          const tipX = x + Math.cos(endAngle) * arcRadius;
          const tipY = y + Math.sin(endAngle) * arcRadius;
          g.circle(tipX, tipY, 2.5);
          g.fill({ color: 0xffdd66, alpha: prodPulse });

          // Inner activity glow (shows building is working)
          g.circle(x, y, Math.max(w, h) * 0.25);
          g.fill({ color: 0xffaa22, alpha: 0.06 + Math.sin(gameTime * 5) * 0.03 });
        }
        continue;
      }

      const uType = unitType[eid] as UnitType;
      const isFlashing = atkFlashTimer[eid] > 0;
      const isStimmed = stimEndTime[eid] > gameTime;
      const isSlowed = slowEndTime[eid] > gameTime;
      const sm = siegeMode[eid] as SiegeMode;

      // Selection brackets (SC2-style corner brackets with glow)
      if (isSelected) {
        const hw = w / 2;
        const hh = h / 2;
        const bracketLen = Math.max(4, Math.min(hw, hh) * 0.4);
        const bOff = 2;

        // Outer glow pass (wider, dimmer)
        g.moveTo(x - hw - bOff, y - hh - bOff + bracketLen);
        g.lineTo(x - hw - bOff, y - hh - bOff);
        g.lineTo(x - hw - bOff + bracketLen, y - hh - bOff);
        g.moveTo(x + hw + bOff - bracketLen, y - hh - bOff);
        g.lineTo(x + hw + bOff, y - hh - bOff);
        g.lineTo(x + hw + bOff, y - hh - bOff + bracketLen);
        g.moveTo(x - hw - bOff, y + hh + bOff - bracketLen);
        g.lineTo(x - hw - bOff, y + hh + bOff);
        g.lineTo(x - hw - bOff + bracketLen, y + hh + bOff);
        g.moveTo(x + hw + bOff - bracketLen, y + hh + bOff);
        g.lineTo(x + hw + bOff, y + hh + bOff);
        g.lineTo(x + hw + bOff, y + hh + bOff - bracketLen);
        g.stroke({ color: SELECTION_COLOR, width: 3.5, alpha: 0.25 });

        // Inner bright pass
        g.moveTo(x - hw - bOff, y - hh - bOff + bracketLen);
        g.lineTo(x - hw - bOff, y - hh - bOff);
        g.lineTo(x - hw - bOff + bracketLen, y - hh - bOff);
        g.moveTo(x + hw + bOff - bracketLen, y - hh - bOff);
        g.lineTo(x + hw + bOff, y - hh - bOff);
        g.lineTo(x + hw + bOff, y - hh - bOff + bracketLen);
        g.moveTo(x - hw - bOff, y + hh + bOff - bracketLen);
        g.lineTo(x - hw - bOff, y + hh + bOff);
        g.lineTo(x - hw - bOff + bracketLen, y + hh + bOff);
        g.moveTo(x + hw + bOff - bracketLen, y + hh + bOff);
        g.lineTo(x + hw + bOff, y + hh + bOff);
        g.lineTo(x + hw + bOff, y + hh + bOff - bracketLen);
        g.stroke({ color: SELECTION_COLOR, width: 1.5 });

        // Mode indicator badge
        const halfH = h / 2;
        const cm = commandMode[eid] as CommandMode;
        if (cm === CommandMode.HoldPosition) {
          // Small shield: two horizontal lines above the unit
          g.moveTo(posX[eid] - 4, posY[eid] - halfH - 4);
          g.lineTo(posX[eid] + 4, posY[eid] - halfH - 4);
          g.moveTo(posX[eid] - 3, posY[eid] - halfH - 7);
          g.lineTo(posX[eid] + 3, posY[eid] - halfH - 7);
          g.stroke({ color: 0xffcc44, width: 1.5, alpha: 0.9 });
        } else if (cm === CommandMode.Patrol) {
          // Small circular arrow indicator: arc above unit
          g.arc(posX[eid], posY[eid] - halfH - 6, 4, -Math.PI * 0.8, Math.PI * 0.8);
          g.stroke({ color: 0x44ffaa, width: 1.5, alpha: 0.9 });
        }
      }

      // Range circle for selected units that can attack
      if (isSelected && hasComponents(world, eid, ATTACK) && atkDamage[eid] > 0) {
        g.circle(x, y, atkRange[eid]);
        g.stroke({ color: 0xff4444, width: 0.5, alpha: 0.2 });
      }

      // Slow debuff indicator — icy stroke ring around unit
      if (slowFactor[eid] > 0) {
        const halfW = renderWidth[eid] / 2;
        const halfH = renderHeight[eid] / 2;
        const radius = Math.max(halfW, halfH) + 3;
        g.circle(x, y, radius);
        g.stroke({ color: 0x88ccff, width: 1.5, alpha: 0.7 });
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

      // LOD: at low zoom, render a simple colored dot instead of full geometry
      if (viewportScale < 0.4) {
        g.circle(posX[eid], posY[eid], Math.max(renderWidth[eid], renderHeight[eid]) * 0.4);
        g.fill({ color: renderTint[eid], alpha: isAir[eid] ? 0.6 : 0.9 });
        continue;
      }

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
          // ── Zergling: insectoid raptor-dog, 6 scythe-legs, mandibles, dorsal spines ──
          // SC2: "Zerglings are small, fast, and attack in swarms. They have
          // blade-like forearms and insectoid legs that skitter rapidly."
          const isMoving = Math.abs(velX[eid]) > 0.1 || Math.abs(velY[eid]) > 0.1;
          const legCycle = isMoving ? gameTime * 12 + eid * 1.7 : 0;

          // Shadow
          g.ellipse(x, y + 1, w * 0.5, h * 0.2);
          g.fill({ color: 0x000000, alpha: 0.3 });

          // 6 skittering legs (3 per side) — animate when moving
          for (let leg = 0; leg < 3; leg++) {
            const lx = x - w * 0.25 + leg * w * 0.2;
            // Alternate leg phase: even legs forward when odd legs back
            const phase = legCycle + leg * (Math.PI * 2 / 3);
            const legSwing = Math.sin(phase) * (isMoving ? h * 0.2 : 0);
            // Top legs
            const topKneeX = lx - w * 0.12;
            const topKneeY = y - h * 0.35 + legSwing * 0.3;
            const topFootY = y - h * 0.6 + legSwing;
            g.moveTo(lx, y - h * 0.25);
            g.lineTo(topKneeX, topKneeY);
            g.lineTo(topKneeX - w * 0.05, topFootY);
            g.stroke({ color: tint, width: 0.9 });
            // Bottom legs (mirror)
            const botKneeX = lx - w * 0.12;
            const botKneeY = y + h * 0.35 - legSwing * 0.3;
            const botFootY = y + h * 0.6 - legSwing;
            g.moveTo(lx, y + h * 0.25);
            g.lineTo(botKneeX, botKneeY);
            g.lineTo(botKneeX - w * 0.05, botFootY);
            g.stroke({ color: tint, width: 0.9 });
          }

          // Main body — elongated horizontal ellipse
          g.ellipse(x, y, w * 0.55, h * 0.3);
          g.fill({ color: bodyColor });
          g.ellipse(x, y, w * 0.55, h * 0.3);
          g.stroke({ color: darken(tint, 20), width: 0.8, alpha: 0.5 });

          // V-shaped scythe mandibles (blade-like forearms)
          const mandibleSnap = isMoving ? Math.sin(gameTime * 6 + eid) * h * 0.05 : 0;
          g.moveTo(x + w * 0.45, y - h * 0.08);
          g.lineTo(x + w * 0.8, y - h * 0.3 + mandibleSnap);
          g.stroke({ color: 0xdd5544, width: 1.8 });
          g.moveTo(x + w * 0.45, y + h * 0.08);
          g.lineTo(x + w * 0.8, y + h * 0.3 - mandibleSnap);
          g.stroke({ color: 0xdd5544, width: 1.8 });

          // Dorsal spine ridge — 4 spikes
          for (let s = 0; s < 4; s++) {
            const sx = x - w * 0.25 + s * w * 0.18;
            g.moveTo(sx - w * 0.04, y - h * 0.28);
            g.lineTo(sx, y - h * 0.5);
            g.lineTo(sx + w * 0.04, y - h * 0.28);
            g.closePath();
            g.fill({ color: tint, alpha: 0.9 });
          }

          // Glowing eyes (2 small dots at front)
          g.circle(x + w * 0.35, y - h * 0.1, 1.5);
          g.fill({ color: ZERG_EYE, alpha: 0.9 });
          g.circle(x + w * 0.35, y + h * 0.1, 1.5);
          g.fill({ color: ZERG_EYE, alpha: 0.9 });

          // Segmented tail
          g.moveTo(x - w * 0.5, y);
          g.lineTo(x - w * 0.7, y + h * 0.08);
          g.lineTo(x - w * 0.85, y + h * 0.03);
          g.stroke({ color: tint, width: 1.2 });

        } else if (uType === UnitType.Baneling) {
          // ── Baneling: volatile acid sac, rolls toward enemies and detonates ──
          // SC2: "Morphed from Zerglings. Living bomb filled with corrosive acid.
          // Rolls rapidly toward enemies and detonates on contact."
          const isMoving = Math.abs(velX[eid]) > 0.1 || Math.abs(velY[eid]) > 0.1;
          // Pulse faster and brighter when moving (about to detonate!)
          const pulseSpeed = isMoving ? 8 : 5;
          const pulseGlow = isMoving
            ? 0.7 + 0.3 * Math.sin(gameTime * pulseSpeed + eid)
            : 0.5 + 0.4 * Math.sin(gameTime * pulseSpeed);
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
          // ── Hydralisk: upright serpent with cobra hood, spine needle attack ──
          // SC2: "Snake-like upper body rising from a coiled lower half.
          // Fires volleys of needle spines. Iconic cobra hood flares when attacking."
          const isMoving = Math.abs(velX[eid]) > 0.1 || Math.abs(velY[eid]) > 0.1;
          const sway = isMoving ? Math.sin(gameTime * 4 + eid * 2.1) * 1.5 : 0;

          // Shadow
          g.ellipse(x, y + 2, w * 0.4, h * 0.18);
          g.fill({ color: 0x000000, alpha: 0.3 });
          // Main body — swaying when moving (serpentine)
          g.ellipse(x + sway, y, w * 0.4, h * 0.55);
          g.fill({ color: bodyColor });
          // Cobra hood — flares with attack flash
          const hoodFlare = atkFlashTimer[eid] > 0 ? 1.2 : 1.0;
          g.moveTo(x + sway, y - h * 0.35);
          g.lineTo(x - w * 0.6 * hoodFlare + sway, y - h * 0.65);
          g.stroke({ color: tint, width: 2 });
          g.moveTo(x + sway, y - h * 0.35);
          g.lineTo(x + w * 0.6 * hoodFlare + sway, y - h * 0.65);
          g.stroke({ color: tint, width: 2 });
          // Hood fill
          g.moveTo(x - w * 0.55 * hoodFlare + sway, y - h * 0.6);
          g.lineTo(x + sway, y - h * 0.3);
          g.lineTo(x + w * 0.55 * hoodFlare + sway, y - h * 0.6);
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
          // ── Roach: armored insectoid with thick carapace, acid-spitting maw ──
          // SC2: "Heavily armored beetle-like creature. Regenerates rapidly.
          // Fires corrosive acid from its mouth."
          const isMoving = Math.abs(velX[eid]) > 0.1 || Math.abs(velY[eid]) > 0.1;
          const legCycle = isMoving ? gameTime * 8 + eid * 1.3 : 0;

          // Shadow
          g.ellipse(x, y + 2, w * 0.5, h * 0.2);
          g.fill({ color: 0x000000, alpha: 0.3 });

          // Animated legs — 3 per side, slower cycle than Zergling (heavier)
          for (let l = 0; l < 3; l++) {
            const lx = x - w * 0.25 + l * w * 0.22;
            const phase = legCycle + l * (Math.PI * 2 / 3);
            const swing = Math.sin(phase) * (isMoving ? h * 0.12 : 0);
            g.moveTo(lx, y + h * 0.35);
            g.lineTo(lx - w * 0.12, y + h * 0.6 + swing);
            g.stroke({ color: tint, width: 1 });
            g.moveTo(lx, y - h * 0.35);
            g.lineTo(lx - w * 0.12, y - h * 0.6 - swing);
            g.stroke({ color: tint, width: 1 });
          }

          // Main body — wide ellipse
          g.ellipse(x, y, w * 0.55, h * 0.4);
          g.fill({ color: bodyColor });
          // Thick carapace — armored half-dome on top
          g.arc(x, y - h * 0.05, w * 0.5, Math.PI, 0, false);
          g.closePath();
          g.fill({ color: 0x662222, alpha: 0.5 });
          g.arc(x, y - h * 0.05, w * 0.5, Math.PI, 0, false);
          g.stroke({ color: 0x886644, width: 2, alpha: 0.7 });
          // Armor segment lines
          for (let s = 0; s < 3; s++) {
            const sy = y - h * 0.15 + s * h * 0.15;
            g.moveTo(x - w * 0.35, sy);
            g.lineTo(x + w * 0.35, sy);
            g.stroke({ color: 0x884422, width: 1, alpha: 0.4 });
          }
          // Acid mandibles
          g.moveTo(x + w * 0.4, y - h * 0.1);
          g.lineTo(x + w * 0.65, y - h * 0.25);
          g.stroke({ color: 0xaa6644, width: 2 });
          g.moveTo(x + w * 0.4, y + h * 0.1);
          g.lineTo(x + w * 0.65, y + h * 0.25);
          g.stroke({ color: 0xaa6644, width: 2 });
          // Glowing acid maw
          g.circle(x + w * 0.42, y, 2.5);
          g.fill({ color: 0x88aa22, alpha: 0.6 });
          // Regen indicator
          if (hpCurrent[eid] < hpMax[eid] && hpCurrent[eid] > 0) {
            const pulse = 0.3 + 0.3 * Math.sin(gameTime * 4);
            g.circle(x, y - h / 2 - 4, 3);
            g.fill({ color: 0x44ff44, alpha: pulse });
          }

        } else if (uType === UnitType.Mutalisk) {
          // ── Mutalisk: agile flying predator with leathery wings, glaive wurm attack ──
          // SC2: "Fast flying unit with a unique glaive wurm attack that bounces
          // between targets. Bat-like wings, serpentine body."
          const wingFlap = Math.sin(gameTime * 6 + eid * 1.9) * 0.15;

          // Faint ground shadow (elevated — bobs with wing flap)
          g.ellipse(x, y + 5 + wingFlap * 8, w * 0.3, h * 0.12);
          g.fill({ color: 0x000000, alpha: 0.15 });

          // Left wing — animated flap
          const lwTipY = y - h * 0.38 + wingFlap * h * 0.5;
          g.moveTo(x - w * 0.22, y - h * 0.05);
          g.lineTo(x - w * 0.7, lwTipY);
          g.lineTo(x - w * 0.85, lwTipY + h * 0.13);
          g.stroke({ color: 0xcc88ff, width: 1.8 });
          // Left wing membrane
          g.moveTo(x - w * 0.2, y - h * 0.05);
          g.lineTo(x - w * 0.7, lwTipY);
          g.lineTo(x - w * 0.3, y + h * 0.12);
          g.closePath();
          g.fill({ color: bodyColor, alpha: 0.3 });

          // Right wing — animated flap (mirror)
          const rwTipY = y - h * 0.38 + wingFlap * h * 0.5;
          g.moveTo(x + w * 0.22, y - h * 0.05);
          g.lineTo(x + w * 0.7, rwTipY);
          g.lineTo(x + w * 0.85, rwTipY + h * 0.13);
          g.stroke({ color: 0xcc88ff, width: 1.8 });
          // Right wing membrane
          g.moveTo(x + w * 0.2, y - h * 0.05);
          g.lineTo(x + w * 0.7, rwTipY);
          g.lineTo(x + w * 0.3, y + h * 0.12);
          g.closePath();
          g.fill({ color: bodyColor, alpha: 0.3 });

          // Main body — narrow vertical ellipse (serpentine)
          const bodyBob = wingFlap * 2;
          g.ellipse(x, y + bodyBob, w * 0.28, h * 0.42);
          g.fill({ color: bodyColor });
          g.ellipse(x, y + bodyBob, w * 0.28, h * 0.42);
          g.stroke({ color: 0x9966cc, width: 1, alpha: 0.6 });

          // Glaive beak — sharp spike pointing upward from head
          g.moveTo(x, y - h * 0.38);
          g.lineTo(x - 3, y - h * 0.55);
          g.lineTo(x + 3, y - h * 0.55);
          g.closePath();
          g.fill({ color: 0xddaaff, alpha: 0.9 });
          // Eye — bright dot
          g.circle(x, y - h * 0.15, 1.5);
          g.fill({ color: 0xff44cc, alpha: 0.9 });
          // Tail spine curving backward (downward)
          g.moveTo(x, y + h * 0.38);
          g.lineTo(x - 3, y + h * 0.58);
          g.lineTo(x + 2, y + h * 0.65);
          g.stroke({ color: tint, width: 1.2 });

        } else if (uType === UnitType.Ravager) {
          // ── Ravager: evolved Roach — wide carapace, bile launcher, acid vents ──

          // Shadow
          g.ellipse(x, y + 2, w * 0.75, h * 0.3);
          g.fill({ color: 0x000000, alpha: 0.35 });

          // 6 stubby legs (3 per side, angled outward)
          for (let l = 0; l < 3; l++) {
            const lx = x - w * 0.25 + l * w * 0.22;
            // Bottom legs
            g.moveTo(lx, y + h * 0.3);
            g.lineTo(lx - w * 0.08, y + h * 0.55);
            g.stroke({ color: darken(tint, 20), width: 1.2 });
            // Top legs
            g.moveTo(lx, y - h * 0.3);
            g.lineTo(lx - w * 0.08, y - h * 0.55);
            g.stroke({ color: darken(tint, 20), width: 1.2 });
          }

          // Wide squat body ellipse (wider than Roach)
          g.ellipse(x, y, w * 0.7, h * 0.4);
          g.fill({ color: bodyColor });

          // Dark carapace arc on top half
          g.arc(x, y - h * 0.05, w * 0.65, Math.PI, 0, false);
          g.closePath();
          g.fill({ color: darken(bodyColor, 40), alpha: 0.5 });
          g.arc(x, y - h * 0.05, w * 0.65, Math.PI, 0, false);
          g.stroke({ color: 0x886644, width: 2, alpha: 0.7 });

          // 4 armored segment lines across body
          for (let s = 0; s < 4; s++) {
            const sy = y - h * 0.2 + s * h * 0.12;
            g.moveTo(x - w * 0.45, sy);
            g.lineTo(x + w * 0.45, sy);
            g.stroke({ color: 0x884422, width: 1, alpha: 0.35 });
          }

          // 2 forward mandibles (short, thick)
          g.moveTo(x + w * 0.5, y - h * 0.12);
          g.lineTo(x + w * 0.75, y - h * 0.3);
          g.stroke({ color: 0xaa6644, width: 2.5 });
          g.moveTo(x + w * 0.5, y + h * 0.12);
          g.lineTo(x + w * 0.75, y + h * 0.3);
          g.stroke({ color: 0xaa6644, width: 2.5 });

          // Back-mounted bile launcher: thick rect extending upward
          g.rect(x - w * 0.12, y - h * 0.4 - 8, w * 0.24, 10);
          g.fill({ color: 0x663311, alpha: 0.9 });
          g.rect(x - w * 0.12, y - h * 0.4 - 8, w * 0.24, 10);
          g.stroke({ color: 0x884422, width: 1, alpha: 0.6 });
          // Glowing bile tip (pulsing orange-green)
          const bilePulse = 0.5 + 0.4 * Math.sin(gameTime * 3.5 + eid * 1.7);
          g.circle(x, y - h * 0.4 - 10, 3);
          g.fill({ color: ZERG_ACID, alpha: bilePulse * 0.8 });
          g.circle(x, y - h * 0.4 - 10, 5);
          g.stroke({ color: 0xaacc44, width: 1.5, alpha: bilePulse * 0.4 });

          // Acid glow vents on each side
          g.circle(x - w * 0.45, y, 2.5);
          g.fill({ color: ZERG_ACID, alpha: 0.5 + 0.2 * Math.sin(gameTime * 2 + 1) });
          g.circle(x + w * 0.45, y, 2.5);
          g.fill({ color: ZERG_ACID, alpha: 0.5 + 0.2 * Math.sin(gameTime * 2 + 3) });

          // Border stroke on body
          g.ellipse(x, y, w * 0.7, h * 0.4);
          g.stroke({ color: lighten(bodyColor, 15), width: 1, alpha: 0.5 });

        } else if (uType === UnitType.Lurker) {
          // ── Lurker: flat segmented body, long fanning spines, ambush predator ──

          // Shadow
          g.ellipse(x, y + 2, w * 0.6, h * 0.25);
          g.fill({ color: 0x000000, alpha: 0.35 });

          // 4 legs tucked underneath (barely visible)
          g.moveTo(x - w * 0.25, y + h * 0.25);
          g.lineTo(x - w * 0.35, y + h * 0.42);
          g.stroke({ color: darken(tint, 15), width: 0.8, alpha: 0.5 });
          g.moveTo(x + w * 0.15, y + h * 0.25);
          g.lineTo(x + w * 0.25, y + h * 0.42);
          g.stroke({ color: darken(tint, 15), width: 0.8, alpha: 0.5 });
          g.moveTo(x - w * 0.1, y + h * 0.28);
          g.lineTo(x - w * 0.18, y + h * 0.45);
          g.stroke({ color: darken(tint, 15), width: 0.8, alpha: 0.5 });
          g.moveTo(x + w * 0.3, y + h * 0.25);
          g.lineTo(x + w * 0.38, y + h * 0.42);
          g.stroke({ color: darken(tint, 15), width: 0.8, alpha: 0.5 });

          // Dark underbelly shading
          g.ellipse(x, y + h * 0.05, w * 0.48, h * 0.22);
          g.fill({ color: darken(bodyColor, 35), alpha: 0.5 });

          // Wide flat body ellipse
          g.ellipse(x, y, w * 0.55, h * 0.3);
          g.fill({ color: bodyColor });

          // Segmented carapace — 3 horizontal lines
          for (let s = 0; s < 3; s++) {
            const sy = y - h * 0.12 + s * h * 0.1;
            g.moveTo(x - w * 0.38, sy);
            g.lineTo(x + w * 0.38, sy);
            g.stroke({ color: darken(tint, 25), width: 1, alpha: 0.45 });
          }

          // 6 long spines fanning outward from top (spread at angles)
          const spineAngles = [-1.8, -1.35, -0.9, -0.45, 0.0, 0.45];
          for (let i = 0; i < 6; i++) {
            const angle = spineAngles[i] - Math.PI / 2;
            const baseX = x - w * 0.15 + i * w * 0.08;
            const baseY = y - h * 0.25;
            const tipX = baseX + Math.cos(angle) * h * 0.55;
            const tipY = baseY + Math.sin(angle) * h * 0.55;
            // Spine shaft
            g.moveTo(baseX, baseY);
            g.lineTo(tipX, tipY);
            g.stroke({ color: 0x998866, width: 1.8, alpha: 0.85 });
            // Spine tip glow (light bone color)
            g.circle(tipX, tipY, 1.5);
            g.fill({ color: 0xccbb99, alpha: 0.6 });
          }

          // Small head protrusion at front with mandible dots
          g.ellipse(x + w * 0.45, y, w * 0.12, h * 0.15);
          g.fill({ color: darken(bodyColor, 15) });
          // Mandible dots
          g.circle(x + w * 0.55, y - h * 0.06, 1.2);
          g.fill({ color: ZERG_EYE, alpha: 0.7 });
          g.circle(x + w * 0.55, y + h * 0.06, 1.2);
          g.fill({ color: ZERG_EYE, alpha: 0.7 });

          // Body border stroke
          g.ellipse(x, y, w * 0.55, h * 0.3);
          g.stroke({ color: lighten(bodyColor, 10), width: 1, alpha: 0.4 });

        } else if (uType === UnitType.Infestor) {
          // ── Infestor: pulsing blob with tentacles and drifting spores ──
          const infestPulse = Math.sin(gameTime * 0.8) * 1.5;
          const blobR = h / 2 + infestPulse;
          // Shadow
          g.circle(x, y, blobR + 2);
          g.fill({ color: 0x000000, alpha: 0.4 });
          // Pulsing blob body
          g.circle(x, y, blobR);
          g.fill({ color: bodyColor, alpha: 0.9 });
          g.circle(x, y, blobR);
          g.stroke({ color: lighten(bodyColor, 20), width: 1, alpha: 0.4 });
          // 3 tentacles in different directions
          // Tentacle 1 — right
          g.moveTo(x + blobR * 0.85, y);
          g.lineTo(x + blobR + 5, y - 4);
          g.lineTo(x + blobR + 8, y - 2);
          g.stroke({ color: 0x668833, width: 2, alpha: 0.8 });
          // Tentacle 2 — lower-left
          g.moveTo(x - blobR * 0.6, y + blobR * 0.6);
          g.lineTo(x - blobR - 3, y + blobR + 2);
          g.lineTo(x - blobR - 6, y + blobR + 5);
          g.stroke({ color: 0x668833, width: 1.8, alpha: 0.7 });
          // Tentacle 3 — upper-left
          g.moveTo(x - blobR * 0.5, y - blobR * 0.7);
          g.lineTo(x - blobR - 2, y - blobR - 1);
          g.lineTo(x - blobR - 5, y - blobR + 1);
          g.stroke({ color: 0x668833, width: 1.5, alpha: 0.6 });
          // Dark arc mouth on front
          g.arc(x + blobR * 0.3, y, blobR * 0.35, -Math.PI * 0.4, Math.PI * 0.4);
          g.stroke({ color: 0x223311, width: 2, alpha: 0.7 });
          // 3 floating spore particles drifting slowly
          for (let sp = 0; sp < 3; sp++) {
            const spAngle = gameTime * 0.5 + sp * 2.1 + eid * 0.3;
            const spDist = blobR + 4 + Math.sin(gameTime * 0.7 + sp * 1.5) * 3;
            const spx = x + Math.cos(spAngle) * spDist;
            const spy = y + Math.sin(spAngle) * spDist;
            g.circle(spx, spy, 1.5);
            g.fill({ color: ZERG_ACID, alpha: 0.5 });
          }

        } else if (uType === UnitType.Ultralisk) {
          // ── Ultralisk: massive armored beast with kaiser blades ──
          // Shadow
          g.ellipse(x, y, w / 2 + 4, h / 2 + 4);
          g.fill({ color: 0x000000, alpha: 0.5 });
          // Large elliptical body
          g.ellipse(x, y, w / 2, h / 2);
          g.fill({ color: bodyColor, alpha: 0.95 });
          // Dorsal spine ridge — 4 small triangular spines along the top
          for (let ds = 0; ds < 4; ds++) {
            const dsx = x - w * 0.25 + ds * w * 0.17;
            g.moveTo(dsx - 2.5, y - h * 0.4);
            g.lineTo(dsx, y - h * 0.58);
            g.lineTo(dsx + 2.5, y - h * 0.4);
            g.closePath();
            g.fill({ color: lighten(bodyColor, 15), alpha: 0.85 });
          }
          // Kaiser blade (left) — wide polygon base, tapering to sharp point, slight inward curve
          g.moveTo(x - w * 0.35, y - h * 0.3);
          g.lineTo(x - w * 0.5, y - h * 0.55);
          g.lineTo(x - w * 0.65, y - h * 0.7);
          g.lineTo(x - w * 0.55, y - h * 0.45);
          g.lineTo(x - w * 0.4, y - h * 0.25);
          g.closePath();
          g.fill({ color: 0x887755, alpha: 0.9 });
          g.stroke({ color: 0xaa9966, width: 1, alpha: 0.7 });
          // Kaiser blade (right)
          g.moveTo(x + w * 0.35, y - h * 0.3);
          g.lineTo(x + w * 0.5, y - h * 0.55);
          g.lineTo(x + w * 0.65, y - h * 0.7);
          g.lineTo(x + w * 0.55, y - h * 0.45);
          g.lineTo(x + w * 0.4, y - h * 0.25);
          g.closePath();
          g.fill({ color: 0x887755, alpha: 0.9 });
          g.stroke({ color: 0xaa9966, width: 1, alpha: 0.7 });
          // Four legs — 2 front + 2 rear, each ending in a small claw fork
          // Front left leg
          g.moveTo(x - w * 0.3, y + h * 0.2);
          g.lineTo(x - w * 0.5, y + h * 0.55);
          g.stroke({ color: bodyColor, width: 1.5 });
          g.moveTo(x - w * 0.5, y + h * 0.55);
          g.lineTo(x - w * 0.55, y + h * 0.62);
          g.moveTo(x - w * 0.5, y + h * 0.55);
          g.lineTo(x - w * 0.45, y + h * 0.62);
          g.stroke({ color: bodyColor, width: 1 });
          // Front right leg
          g.moveTo(x + w * 0.3, y + h * 0.2);
          g.lineTo(x + w * 0.5, y + h * 0.55);
          g.stroke({ color: bodyColor, width: 1.5 });
          g.moveTo(x + w * 0.5, y + h * 0.55);
          g.lineTo(x + w * 0.55, y + h * 0.62);
          g.moveTo(x + w * 0.5, y + h * 0.55);
          g.lineTo(x + w * 0.45, y + h * 0.62);
          g.stroke({ color: bodyColor, width: 1 });
          // Rear left leg
          g.moveTo(x - w * 0.15, y + h * 0.35);
          g.lineTo(x - w * 0.3, y + h * 0.6);
          g.stroke({ color: bodyColor, width: 1.5 });
          g.moveTo(x - w * 0.3, y + h * 0.6);
          g.lineTo(x - w * 0.35, y + h * 0.67);
          g.moveTo(x - w * 0.3, y + h * 0.6);
          g.lineTo(x - w * 0.25, y + h * 0.67);
          g.stroke({ color: bodyColor, width: 1 });
          // Rear right leg
          g.moveTo(x + w * 0.15, y + h * 0.35);
          g.lineTo(x + w * 0.3, y + h * 0.6);
          g.stroke({ color: bodyColor, width: 1.5 });
          g.moveTo(x + w * 0.3, y + h * 0.6);
          g.lineTo(x + w * 0.35, y + h * 0.67);
          g.moveTo(x + w * 0.3, y + h * 0.6);
          g.lineTo(x + w * 0.25, y + h * 0.67);
          g.stroke({ color: bodyColor, width: 1 });
          // Two bright red eyes near the front
          g.circle(x - w * 0.12, y - h * 0.25, 2);
          g.fill({ color: ZERG_EYE, alpha: 0.9 });
          g.circle(x + w * 0.12, y - h * 0.25, 2);
          g.fill({ color: ZERG_EYE, alpha: 0.9 });

        } else if (uType === UnitType.Corruptor) {
          // ── Corruptor: floating crab-like air parasite ──
          const hw = w / 2;
          const hh = h / 2;
          // Ground shadow (air unit, offset below)
          g.ellipse(x, y + 6, hw * 0.7, hh * 0.25);
          g.fill({ color: 0x000000, alpha: 0.2 });
          // Membrane wings (translucent spread)
          g.moveTo(x - hw * 1.2, y - hh * 0.3);
          g.lineTo(x - hw * 0.3, y - hh * 0.1);
          g.lineTo(x - hw * 0.8, y + hh * 0.4);
          g.closePath();
          g.fill({ color: 0x553366, alpha: 0.4 });
          g.moveTo(x + hw * 1.2, y - hh * 0.3);
          g.lineTo(x + hw * 0.3, y - hh * 0.1);
          g.lineTo(x + hw * 0.8, y + hh * 0.4);
          g.closePath();
          g.fill({ color: 0x553366, alpha: 0.4 });
          // Main body (segmented ellipse)
          g.ellipse(x, y, hw * 0.6, hh * 0.5);
          g.fill({ color: bodyColor, alpha: 0.9 });
          g.ellipse(x, y, hw * 0.6, hh * 0.5);
          g.stroke({ color: lighten(bodyColor, 20), width: 1, alpha: 0.5 });
          // Carapace segment lines
          for (let s = -1; s <= 1; s++) {
            g.moveTo(x - hw * 0.4, y + s * hh * 0.15);
            g.lineTo(x + hw * 0.4, y + s * hh * 0.15);
            g.stroke({ color: 0x442255, width: 0.8, alpha: 0.4 });
          }
          // Front claws (pincers)
          g.moveTo(x - hw * 0.5, y - hh * 0.2);
          g.lineTo(x - hw * 0.9, y - hh * 0.6);
          g.lineTo(x - hw * 0.7, y - hh * 0.35);
          g.stroke({ color: 0xaa66aa, width: 2, alpha: 0.8 });
          g.moveTo(x + hw * 0.5, y - hh * 0.2);
          g.lineTo(x + hw * 0.9, y - hh * 0.6);
          g.lineTo(x + hw * 0.7, y - hh * 0.35);
          g.stroke({ color: 0xaa66aa, width: 2, alpha: 0.8 });
          // Eye
          g.circle(x, y - hh * 0.2, 2);
          g.fill({ color: ZERG_EYE, alpha: 0.8 });
          // Corruption aura (faint purple glow)
          const corruptPulse = 0.15 + Math.sin(gameTime * 2 + eid) * 0.05;
          g.circle(x, y, hw * 0.8);
          g.fill({ color: 0x8844aa, alpha: corruptPulse });

        } else if (uType === UnitType.Viper) {
          // ── Viper: serpentine flyer with wide cobra hood ──
          const hw = w / 2;
          const hh = h / 2;
          // Ground shadow (air unit)
          g.ellipse(x, y + 6, hw * 0.5, hh * 0.15);
          g.fill({ color: 0x000000, alpha: 0.2 });
          // Tail (curving behind)
          g.moveTo(x, y + hh * 0.3);
          g.lineTo(x + 2, y + hh * 0.7);
          g.lineTo(x - 1, y + hh * 1.0);
          g.stroke({ color: darken(bodyColor, 15), width: 2.5, alpha: 0.7 });
          // Tail tip
          g.circle(x - 1, y + hh * 1.0, 1.5);
          g.fill({ color: ZERG_ACID, alpha: 0.5 });
          // Body (elongated vertical ellipse)
          g.ellipse(x, y, hw * 0.35, hh * 0.5);
          g.fill({ color: bodyColor, alpha: 0.9 });
          g.ellipse(x, y, hw * 0.35, hh * 0.5);
          g.stroke({ color: lighten(bodyColor, 15), width: 0.8, alpha: 0.4 });
          // Cobra hood (wide V-shape)
          g.moveTo(x, y - hh * 0.3);
          g.lineTo(x - hw * 0.8, y - hh * 0.1);
          g.lineTo(x - hw * 0.6, y + hh * 0.1);
          g.lineTo(x, y);
          g.closePath();
          g.fill({ color: lighten(bodyColor, 10), alpha: 0.7 });
          g.moveTo(x, y - hh * 0.3);
          g.lineTo(x + hw * 0.8, y - hh * 0.1);
          g.lineTo(x + hw * 0.6, y + hh * 0.1);
          g.lineTo(x, y);
          g.closePath();
          g.fill({ color: lighten(bodyColor, 10), alpha: 0.7 });
          // Hood membrane pattern
          g.moveTo(x - hw * 0.2, y - hh * 0.25);
          g.lineTo(x - hw * 0.5, y - hh * 0.05);
          g.stroke({ color: 0x662244, width: 0.8, alpha: 0.5 });
          g.moveTo(x + hw * 0.2, y - hh * 0.25);
          g.lineTo(x + hw * 0.5, y - hh * 0.05);
          g.stroke({ color: 0x662244, width: 0.8, alpha: 0.5 });
          // Head
          g.circle(x, y - hh * 0.35, hw * 0.2);
          g.fill({ color: bodyColor });
          // Eyes (glowing)
          g.circle(x - 2, y - hh * 0.38, 1.5);
          g.fill({ color: ZERG_EYE, alpha: 0.9 });
          g.circle(x + 2, y - hh * 0.38, 1.5);
          g.fill({ color: ZERG_EYE, alpha: 0.9 });

        } else if (uType === UnitType.Queen) {
          // ── Queen: tall upright matriarch with scythe arms and crown spines ──
          const membranePulse = 0.7 + Math.sin(gameTime * 1.5) * 0.2;
          // Shadow
          g.ellipse(x, y, w / 2 + 3, h / 2 + 3);
          g.fill({ color: 0x000000, alpha: 0.45 });
          // Egg sac abdomen — larger circle at bottom blending into body
          g.ellipse(x, y + h * 0.2, w * 0.45, h * 0.35);
          g.fill({ color: darken(bodyColor, 15), alpha: membranePulse });
          g.ellipse(x, y + h * 0.2, w * 0.45, h * 0.35);
          g.stroke({ color: ZERG_FLESH, width: 1, alpha: 0.5 });
          // Main body — tall upright ellipse (taller than wide)
          g.ellipse(x, y - h * 0.05, w * 0.35, h * 0.45);
          g.fill({ color: bodyColor, alpha: membranePulse });
          g.ellipse(x, y - h * 0.05, w * 0.35, h * 0.45);
          g.stroke({ color: lighten(bodyColor, 20), width: 1, alpha: 0.5 });
          // Crown of 5 spines radiating from the top
          for (let s = 0; s < 5; s++) {
            const spineAngle = -Math.PI / 2 + (s - 2) * 0.35;
            const baseX = x + Math.cos(spineAngle) * w * 0.15;
            const baseY = y - h * 0.42 + Math.sin(spineAngle) * h * 0.05;
            const tipX = x + Math.cos(spineAngle) * w * 0.4;
            const tipY = y - h * 0.42 + Math.sin(spineAngle) * h * 0.2 - h * 0.15;
            // Triangular spine
            g.moveTo(baseX - 2, baseY);
            g.lineTo(tipX, tipY);
            g.lineTo(baseX + 2, baseY);
            g.closePath();
            g.fill({ color: lighten(bodyColor, 10), alpha: 0.85 });
          }
          // Left scythe arm — curved line extending from mid-body, tapering
          g.moveTo(x - w * 0.3, y - h * 0.1);
          g.lineTo(x - w * 0.6, y - h * 0.25);
          g.lineTo(x - w * 0.75, y - h * 0.15);
          g.stroke({ color: lighten(bodyColor, 15), width: 2 });
          g.moveTo(x - w * 0.75, y - h * 0.15);
          g.lineTo(x - w * 0.82, y - h * 0.08);
          g.stroke({ color: lighten(bodyColor, 15), width: 1 });
          // Right scythe arm
          g.moveTo(x + w * 0.3, y - h * 0.1);
          g.lineTo(x + w * 0.6, y - h * 0.25);
          g.lineTo(x + w * 0.75, y - h * 0.15);
          g.stroke({ color: lighten(bodyColor, 15), width: 2 });
          g.moveTo(x + w * 0.75, y - h * 0.15);
          g.lineTo(x + w * 0.82, y - h * 0.08);
          g.stroke({ color: lighten(bodyColor, 15), width: 1 });
          // Large glowing purple eye at center
          g.circle(x, y - h * 0.15, 3);
          g.fill({ color: 0xbb44bb, alpha: 0.9 });
          g.circle(x, y - h * 0.15, 5);
          g.stroke({ color: 0xbb44bb, width: 1.5, alpha: 0.3 });

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
          // ── SCV (Worker): compact mechanical shape with arms and visor ──
          const hw = w / 2;
          const hh = h / 2;

          // Shadow
          g.roundRect(x - hw - 2, y - hh - 1, w + 4, h + 2, 4);
          g.fill({ color: 0x000000, alpha: 0.4 });

          // Main body — rounded rectangle, slightly wider than tall
          g.roundRect(x - hw, y - hh * 0.8, w, h * 0.85, 3);
          g.fill({ color: bodyColor });
          g.roundRect(x - hw, y - hh * 0.8, w, h * 0.85, 3);
          g.stroke({ color: TERRAN_METAL, width: 1.2, alpha: 0.7 });

          // Left arm — mining drill extending from left side
          g.rect(x - hw - w * 0.3, y - hh * 0.1, w * 0.32, h * 0.18);
          g.fill({ color: TERRAN_METAL });
          g.rect(x - hw - w * 0.3, y - hh * 0.1, w * 0.32, h * 0.18);
          g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.6 });
          // Drill tip
          g.moveTo(x - hw - w * 0.3, y - hh * 0.02);
          g.lineTo(x - hw - w * 0.4, y);
          g.lineTo(x - hw - w * 0.3, y + hh * 0.02);
          g.fill({ color: 0xdd9933 });

          // Right arm — welder extending from right side
          g.rect(x + hw - w * 0.02, y - hh * 0.1, w * 0.32, h * 0.18);
          g.fill({ color: TERRAN_METAL });
          g.rect(x + hw - w * 0.02, y - hh * 0.1, w * 0.32, h * 0.18);
          g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.6 });
          // Welder nozzle
          g.circle(x + hw + w * 0.32, y, 1.8);
          g.fill({ color: 0xffbb44, alpha: 0.9 });

          // Visor line — construction helmet stripe across top of body
          g.moveTo(x - hw * 0.75, y - hh * 0.65);
          g.lineTo(x + hw * 0.75, y - hh * 0.65);
          g.stroke({ color: TERRAN_DARK, width: 2.5, alpha: 0.9 });
          // Visor glow
          g.moveTo(x - hw * 0.5, y - hh * 0.65);
          g.lineTo(x + hw * 0.5, y - hh * 0.65);
          g.stroke({ color: 0x66ccff, width: 1.2, alpha: 0.8 });

          // Viewport dot on visor center
          g.circle(x, y - hh * 0.65, 1.5);
          g.fill({ color: 0x88eeff, alpha: 0.9 });

          // Body panel line
          g.moveTo(x - hw * 0.6, y + hh * 0.15);
          g.lineTo(x + hw * 0.6, y + hh * 0.15);
          g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.4 });

          // Welding spark when mining
          if (workerState[eid] !== WorkerState.Idle) {
            const sparkAlpha = 0.5 + Math.sin(gameTime * 12) * 0.5;
            if (sparkAlpha > 0.3) {
              g.circle(x + hw + w * 0.32, y, 2);
              g.fill({ color: 0xff8822, alpha: sparkAlpha });
              g.circle(x + hw + w * 0.32, y, 3.5);
              g.fill({ color: 0xffcc44, alpha: sparkAlpha * 0.4 });
            }
          }

        } else if (uType === UnitType.Marine) {
          // ── Marine: CMC Powered Combat Armour — 22-layer SC2 iconic design ──
          const hw = w / 2;
          const hh = h / 2;

          // Idle breathing micro-animation (desync per unit)
          const breathY = Math.sin(gameTime * 1.2 + eid * 2.3) * 0.4;
          const bx = x;
          const by = y + breathY;

          // Layer 1: Drop shadow
          g.ellipse(bx, by + hh + 4, hw * 1.4, hh * 0.35);
          g.fill({ color: 0x000000, alpha: 0.3 });

          // Layer 2-3: Boots (heavy, wide)
          g.rect(bx - hw * 0.3, by + hh * 0.3, hw * 0.24, hh * 0.3);
          g.fill({ color: darken(bodyColor, 40) });
          g.rect(bx + hw * 0.06, by + hh * 0.3, hw * 0.24, hh * 0.3);
          g.fill({ color: darken(bodyColor, 40) });

          // Layer 4: Torso (barrel chest trapezoid)
          g.moveTo(bx - hw * 0.4, by - hh * 0.1);
          g.lineTo(bx + hw * 0.4, by - hh * 0.1);
          g.lineTo(bx + hw * 0.3, by + hh * 0.15);
          g.lineTo(bx - hw * 0.3, by + hh * 0.15);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1, alpha: 0.7 });

          // Layer 5: Chest plate (raised, slightly brighter)
          g.rect(bx - hw * 0.24, by - hh * 0.08, hw * 0.48, hh * 0.18);
          g.fill({ color: lighten(bodyColor, 20) });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 0.8, alpha: 0.5 });

          // Layer 6: Chest division seam
          g.moveTo(bx, by - hh * 0.08);
          g.lineTo(bx, by + hh * 0.12);
          g.stroke({ color: TERRAN_DARK, width: 1, alpha: 0.5 });

          // Layer 7: Waist band
          g.rect(bx - hw * 0.26, by + hh * 0.12, hw * 0.52, hh * 0.06);
          g.fill({ color: darken(bodyColor, 30) });

          // Layer 8: LEFT PAULDRON (massive shoulder pad — the iconic feature)
          g.moveTo(bx - hw * 0.38, by - hh * 0.2);
          g.lineTo(bx - hw * 0.7, by - hh * 0.2);
          g.lineTo(bx - hw * 0.72, by + hh * 0.02);
          g.lineTo(bx - hw * 0.4, by + hh * 0.06);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1, alpha: 0.6 });
          // Pauldron top ridge
          g.moveTo(bx - hw * 0.38, by - hh * 0.2);
          g.lineTo(bx - hw * 0.7, by - hh * 0.2);
          g.stroke({ color: 0x7799cc, width: 1 });

          // Layer 9: RIGHT PAULDRON (mirror)
          g.moveTo(bx + hw * 0.38, by - hh * 0.2);
          g.lineTo(bx + hw * 0.7, by - hh * 0.2);
          g.lineTo(bx + hw * 0.72, by + hh * 0.02);
          g.lineTo(bx + hw * 0.4, by + hh * 0.06);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1, alpha: 0.6 });
          // Pauldron top ridge
          g.moveTo(bx + hw * 0.38, by - hh * 0.2);
          g.lineTo(bx + hw * 0.7, by - hh * 0.2);
          g.stroke({ color: 0x7799cc, width: 1 });

          // Layer 10: Elbow joints
          g.circle(bx - hw * 0.32, by + hh * 0.05, hw * 0.07);
          g.fill({ color: TERRAN_DARK });
          g.circle(bx + hw * 0.32, by + hh * 0.05, hw * 0.07);
          g.fill({ color: TERRAN_DARK });

          // Layer 11: Helmet dome (slightly wider than torso)
          g.moveTo(bx - hw * 0.36, by - hh * 0.15);
          g.lineTo(bx - hw * 0.36, by - hh * 0.45);
          g.arc(bx, by - hh * 0.45, hw * 0.36, Math.PI, 0);
          g.lineTo(bx + hw * 0.36, by - hh * 0.15);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1, alpha: 0.7 });

          // Layer 12: Helmet antenna/ridge
          g.rect(bx - hw * 0.2, by - hh * 0.62, hw * 0.1, hh * 0.12);
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_DARK, width: 0.8 });

          // Layer 13: Chin guard
          g.moveTo(bx - hw * 0.3, by - hh * 0.15);
          g.lineTo(bx - hw * 0.2, by - hh * 0.06);
          g.lineTo(bx + hw * 0.2, by - hh * 0.06);
          g.lineTo(bx + hw * 0.3, by - hh * 0.15);
          g.closePath();
          g.fill({ color: darken(bodyColor, 25) });
          g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.6 });

          // Layer 14: Visor dark interior
          g.rect(bx - hw * 0.24, by - hh * 0.47, hw * 0.48, hh * 0.2);
          g.fill({ color: 0x001122, alpha: 0.85 });

          // Layer 15: T-VISOR (the iconic feature — horizontal bar + vertical drop)
          // Horizontal bar
          g.moveTo(bx - hw * 0.26, by - hh * 0.38);
          g.lineTo(bx + hw * 0.26, by - hh * 0.38);
          g.stroke({ color: TERRAN_VISOR, width: 2.5 });
          // Vertical drop
          g.moveTo(bx, by - hh * 0.38);
          g.lineTo(bx, by - hh * 0.24);
          g.stroke({ color: TERRAN_VISOR, width: 1.5 });
          // Soft glow
          g.moveTo(bx - hw * 0.26, by - hh * 0.38);
          g.lineTo(bx + hw * 0.26, by - hh * 0.38);
          g.stroke({ color: 0x44ffff, width: 5, alpha: 0.2 });

          // Layer 16: Gauss Rifle (5 elements)
          // Stock
          g.rect(bx + hw * 0.28, by + hh * 0.0, hw * 0.14, hh * 0.16);
          g.fill({ color: TERRAN_METAL });
          // Receiver
          g.rect(bx + hw * 0.32, by - hh * 0.08, hw * 0.34, hh * 0.12);
          g.fill({ color: 0x556677 });
          g.stroke({ color: 0x667788, width: 0.8 });
          // Magazine
          g.rect(bx + hw * 0.38, by + hh * 0.04, hw * 0.16, hh * 0.14);
          g.fill({ color: 0x2a3a4a });
          g.stroke({ color: TERRAN_METAL, width: 0.8 });
          // Barrel
          g.moveTo(bx + hw * 0.66, by - hh * 0.02);
          g.lineTo(bx + hw * 1.0, by + hh * 0.12);
          g.stroke({ color: 0x778899, width: 2.5 });
          // Muzzle
          g.circle(bx + hw * 1.0, by + hh * 0.12, 2);
          g.fill({ color: TERRAN_METAL });

          // Layer 17: Muzzle flash (when attacking)
          if (atkFlashTimer[eid] > 0) {
            const fa = atkFlashTimer[eid] / 0.12;
            g.circle(bx + hw * 1.0, by + hh * 0.12, 4 + fa * 3);
            g.fill({ color: 0xffdd44, alpha: fa * 0.9 });
            g.circle(bx + hw * 1.0, by + hh * 0.12, 2 + fa * 2);
            g.fill({ color: 0xffffff, alpha: fa });
          }

          // Layer 18: Left arm (bracing rifle)
          g.moveTo(bx - hw * 0.24, by + hh * 0.08);
          g.lineTo(bx + hw * 0.3, by + hh * 0.02);
          g.stroke({ color: bodyColor, width: 4 });

          // Layer 19: Stim Pack ring (when active)
          if (isStimmed) {
            const sp = 0.55 + Math.sin(gameTime * 8) * 0.3;
            g.circle(bx, by, Math.max(w, h) * 0.85);
            g.stroke({ color: 0xff8800, width: 2.5, alpha: sp });
            g.circle(bx, by, Math.max(w, h) * 0.65);
            g.stroke({ color: 0xffaa44, width: 1, alpha: sp * 0.5 });
          }

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
          // Grenade launchers — small circles on shoulders (palette metal)
          g.circle(x - w * 0.55, y - h * 0.35, 2.5);
          g.fill({ color: TERRAN_METAL });
          g.circle(x - w * 0.55, y - h * 0.35, 2.5);
          g.stroke({ color: lighten(TERRAN_METAL, 30), width: 0.8 });
          g.circle(x + w * 0.55, y - h * 0.35, 2.5);
          g.fill({ color: TERRAN_METAL });
          g.circle(x + w * 0.55, y - h * 0.35, 2.5);
          g.stroke({ color: lighten(TERRAN_METAL, 30), width: 0.8 });
          // Visor — red-orange horizontal slit (distinct from Marine's cyan T-visor)
          g.moveTo(x - w * 0.22, y - h * 0.45);
          g.lineTo(x + w * 0.22, y - h * 0.45);
          g.stroke({ color: 0xff6644, width: 1.5 });
          // Visor glow
          g.moveTo(x - w * 0.22, y - h * 0.45);
          g.lineTo(x + w * 0.22, y - h * 0.45);
          g.stroke({ color: 0xff8866, width: 4, alpha: 0.15 });

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
            // Main body — wide, flat, darker/greener tint in siege mode
            g.rect(x - w * 0.5, y - h * 0.3, w, h * 0.6);
            g.fill({ color: 0x5577aa });
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
          // Thruster glow at rear — two pulsing orange circles
          const thrusterPulse = 0.5 + Math.sin(gameTime * 3) * 0.3;
          g.circle(x - w * 0.15, y + h * 0.35, 3);
          g.fill({ color: 0xff8833, alpha: thrusterPulse });
          g.circle(x + w * 0.15, y + h * 0.35, 3);
          g.fill({ color: 0xff8833, alpha: thrusterPulse });
          // Thruster inner glow
          g.circle(x - w * 0.15, y + h * 0.35, 1.5);
          g.fill({ color: 0xffcc66, alpha: thrusterPulse * 0.8 });
          g.circle(x + w * 0.15, y + h * 0.35, 1.5);
          g.fill({ color: 0xffcc66, alpha: thrusterPulse * 0.8 });
          // Air shadow — offset ellipse below the unit
          g.ellipse(x, y + 8, w * 0.4, h * 0.15);
          g.fill({ color: 0x000000, alpha: 0.15 });

          // Draw heal beams to nearby wounded bio allies
          this.drawHealBeams(g, world, eid, x, y);

        } else if (uType === UnitType.Ghost) {
          // ── Ghost: psionic covert operative with C-10 canister rifle ──
          // SC2: "Ghosts are elite Terran operatives. They cloak, snipe, and call
          // down nuclear strikes. Sleek hostile environment suit, long rifle."
          const isCloaked = cloaked[eid] === 1;
          const ghostAlpha = isCloaked ? 0.25 + 0.1 * Math.sin(gameTime * 3 + eid) : 1.0;

          // Shadow (fades when cloaked)
          g.ellipse(x, y + h * 0.4, w * 0.35, h * 0.15);
          g.fill({ color: 0x000000, alpha: 0.25 * ghostAlpha });
          // Main body — slim profile
          g.rect(x - w * 0.32, y - h * 0.45, w * 0.64, h * 0.9);
          g.fill({ color: bodyColor, alpha: ghostAlpha });
          g.stroke({ color: 0x446688, width: 1, alpha: 0.6 * ghostAlpha });
          // Helmet
          g.rect(x - w * 0.22, y - h * 0.58, w * 0.44, h * 0.18);
          g.fill({ color: bodyColor, alpha: ghostAlpha });
          g.stroke({ color: 0x557799, width: 1, alpha: 0.6 * ghostAlpha });
          // Visor — dim when cloaked, bright on attack
          const visorBright = atkFlashTimer[eid] > 0 ? 1.0 : 0.7;
          g.moveTo(x - w * 0.18, y - h * 0.5);
          g.lineTo(x + w * 0.18, y - h * 0.5);
          g.stroke({ color: 0x8899bb, width: 1.5, alpha: visorBright * ghostAlpha });
          // C-10 canister rifle
          g.moveTo(x + w * 0.3, y - h * 0.35);
          g.lineTo(x + w * 0.95, y - h * 0.6);
          g.stroke({ color: 0x556677, width: 1.5, alpha: ghostAlpha });
          // Scope with animated glint
          g.rect(x + w * 0.5, y - h * 0.52, w * 0.15, h * 0.08);
          g.fill({ color: 0x334455, alpha: ghostAlpha });
          const scopeGlint = 0.5 + 0.5 * Math.sin(gameTime * 2 + eid * 3);
          g.circle(x + w * 0.57, y - h * 0.48, 1.5);
          g.fill({ color: 0x44ff88, alpha: scopeGlint * ghostAlpha });
          // Cloak shimmer effect — diagonal scan lines when cloaked
          if (isCloaked) {
            for (let s = 0; s < 3; s++) {
              const shimmerY = y - h * 0.4 + ((gameTime * 2 + s * 0.33) % 1.0) * h * 0.8;
              g.moveTo(x - w * 0.3, shimmerY);
              g.lineTo(x + w * 0.3, shimmerY - 2);
              g.stroke({ color: 0x88ccff, width: 0.5, alpha: 0.3 });
            }
          }
          // Suit seam
          g.moveTo(x, y - h * 0.38);
          g.lineTo(x, y + h * 0.38);
          g.stroke({ color: 0x334466, width: 0.8, alpha: 0.5 * ghostAlpha });

        } else if (uType === UnitType.Hellion) {
          // ── Hellion: fast attack buggy with Infernal flamethrower ──
          // SC2: "Lightly armored, fast-moving vehicle. Burns groups of
          // light units with a line of fire from its Infernal flamethrower."
          const hw = w / 2;
          const hh = h / 2;
          const isMoving = Math.abs(velX[eid]) > 0.1 || Math.abs(velY[eid]) > 0.1;

          // Shadow
          g.ellipse(x, y + hh + 2, hw * 1.1, hh * 0.3);
          g.fill({ color: 0x000000, alpha: 0.3 });
          // Main body — angular vehicle profile
          g.moveTo(x - hw, y - hh * 0.7);
          g.lineTo(x + hw * 0.6, y - hh);
          g.lineTo(x + hw, y);
          g.lineTo(x + hw * 0.6, y + hh);
          g.lineTo(x - hw, y + hh * 0.7);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: 0xcc4400, width: 1, alpha: 0.7 });
          // Flame nozzle (front-facing)
          g.moveTo(x + hw, y - 3);
          g.lineTo(x + hw + 7, y - 5);
          g.moveTo(x + hw, y + 3);
          g.lineTo(x + hw + 7, y + 5);
          g.stroke({ color: 0xffcc44, width: 2, alpha: 0.9 });
          // Flame burst on attack
          if (atkFlashTimer[eid] > 0) {
            const flameLen = hw * 0.8;
            for (let f = 0; f < 3; f++) {
              const fx = x + hw + 4 + f * flameLen * 0.3;
              const fy = y + (Math.random() - 0.5) * 6;
              const fr = 3 - f * 0.8;
              g.circle(fx, fy, fr);
              g.fill({ color: f === 0 ? 0xffdd44 : 0xff6622, alpha: 0.7 - f * 0.2 });
            }
          }
          // Wheels with spin animation
          const wheelSpin = isMoving ? gameTime * 15 : 0;
          const wheelPositions = [[-hw + 3, hh + 2], [hw - 5, hh + 2], [-hw + 3, -hh - 2], [hw - 5, -hh - 2]] as const;
          for (const [wx, wy] of wheelPositions) {
            g.circle(x + wx, y + wy, 2.5);
            g.fill({ color: 0x444444, alpha: 0.9 });
            // Spoke line (rotates when moving)
            const spokeX = Math.cos(wheelSpin) * 2;
            const spokeY = Math.sin(wheelSpin) * 2;
            g.moveTo(x + wx - spokeX, y + wy - spokeY);
            g.lineTo(x + wx + spokeX, y + wy + spokeY);
            g.stroke({ color: 0x666666, width: 0.6, alpha: 0.7 });
          }
          // Dust trail when moving fast
          if (isMoving) {
            for (let d = 0; d < 2; d++) {
              const dustAge = ((gameTime * 3 + d * 0.5) % 1.0);
              const dx2 = x - hw - 3 - dustAge * 8;
              const dAlpha = Math.max(0, 0.3 * (1 - dustAge));
              if (dAlpha > 0.02) {
                g.circle(dx2, y + (d === 0 ? hh : -hh) + 2, 2 + dustAge * 2);
                g.fill({ color: 0x887766, alpha: dAlpha });
              }
            }
          }

        } else if (uType === UnitType.Reaper) {
          // ── Reaper: agile infantry, dual pistols, jet pack, light armor ──
          const hw = w / 2;
          const hh = h / 2;
          const isMoving = Math.abs(velX[eid]) > 0.1 || Math.abs(velY[eid]) > 0.1;

          // Layer 1: Drop shadow (ellipse, not rect — agile unit)
          g.ellipse(x, y + hh + 3, hw * 1.2, hh * 0.3);
          g.fill({ color: 0x000000, alpha: 0.3 });

          // Layer 2: Jet pack — two cylindrical shapes on back
          g.rect(x - hw * 0.55, y - hh * 0.3, hw * 0.28, hh * 0.7);
          g.fill({ color: TERRAN_DARK, alpha: 0.9 });
          g.rect(x - hw * 0.55, y - hh * 0.3, hw * 0.28, hh * 0.7);
          g.stroke({ color: TERRAN_METAL, width: 0.8, alpha: 0.6 });
          g.rect(x + hw * 0.27, y - hh * 0.3, hw * 0.28, hh * 0.7);
          g.fill({ color: TERRAN_DARK, alpha: 0.9 });
          g.rect(x + hw * 0.27, y - hh * 0.3, hw * 0.28, hh * 0.7);
          g.stroke({ color: TERRAN_METAL, width: 0.8, alpha: 0.6 });

          // Jet thruster glow (orange when moving)
          if (isMoving) {
            const thrustPulse = 0.6 + 0.3 * Math.sin(gameTime * 8 + eid * 2);
            g.circle(x - hw * 0.41, y + hh * 0.45, 2.5);
            g.fill({ color: 0xff8822, alpha: thrustPulse });
            g.circle(x + hw * 0.41, y + hh * 0.45, 2.5);
            g.fill({ color: 0xff8822, alpha: thrustPulse });
            // Flame trails behind
            for (let t = 0; t < 2; t++) {
              const trailX = t === 0 ? x - hw * 0.41 : x + hw * 0.41;
              g.circle(trailX, y + hh * 0.65, 1.8);
              g.fill({ color: 0xff6600, alpha: thrustPulse * 0.5 });
              g.circle(trailX, y + hh * 0.8, 1.2);
              g.fill({ color: 0xff4400, alpha: thrustPulse * 0.3 });
            }
          }

          // Layer 3: Slim torso (narrower than Marine — shows agility)
          g.moveTo(x - hw * 0.28, y - hh * 0.25);
          g.lineTo(x + hw * 0.28, y - hh * 0.25);
          g.lineTo(x + hw * 0.22, y + hh * 0.2);
          g.lineTo(x - hw * 0.22, y + hh * 0.2);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 0.8, alpha: 0.6 });

          // Layer 4: Light armor plates (3 lines on torso)
          for (let p = 0; p < 3; p++) {
            const py = y - hh * 0.15 + p * hh * 0.12;
            g.moveTo(x - hw * 0.2, py);
            g.lineTo(x + hw * 0.2, py);
            g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.4 });
          }

          // Layer 5: Dual pistol lines extending from sides (angled forward)
          g.moveTo(x - hw * 0.3, y + hh * 0.05);
          g.lineTo(x - hw * 0.65, y - hh * 0.15);
          g.stroke({ color: TERRAN_METAL, width: 1.8 });
          g.circle(x - hw * 0.65, y - hh * 0.15, 1);
          g.fill({ color: 0xffaa44, alpha: 0.5 });
          g.moveTo(x + hw * 0.3, y + hh * 0.05);
          g.lineTo(x + hw * 0.65, y - hh * 0.15);
          g.stroke({ color: TERRAN_METAL, width: 1.8 });
          g.circle(x + hw * 0.65, y - hh * 0.15, 1);
          g.fill({ color: 0xffaa44, alpha: 0.5 });

          // Layer 6: Head (smaller than Marine)
          g.arc(x, y - hh * 0.45, hw * 0.24, Math.PI, 0);
          g.closePath();
          g.fill({ color: bodyColor });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 0.8, alpha: 0.6 });

          // Layer 7: Visor (horizontal line — distinct from Marine T-shape)
          g.moveTo(x - hw * 0.2, y - hh * 0.38);
          g.lineTo(x + hw * 0.2, y - hh * 0.38);
          g.stroke({ color: TERRAN_VISOR, width: 2 });

          // Layer 8: Boots
          g.rect(x - hw * 0.2, y + hh * 0.2, hw * 0.16, hh * 0.2);
          g.fill({ color: darken(bodyColor, 35) });
          g.rect(x + hw * 0.04, y + hh * 0.2, hw * 0.16, hh * 0.2);
          g.fill({ color: darken(bodyColor, 35) });

        } else if (uType === UnitType.Viking) {
          // ── Viking: transforming fighter jet — swept wings, dual guns, engine pods ──
          const hw = w / 2;
          const hh = h / 2;

          // Layer 1: Faint ground shadow (offset below — it's an air unit)
          g.ellipse(x, y + hh + 6, hw * 0.8, hh * 0.2);
          g.fill({ color: 0x000000, alpha: 0.15 });

          // Layer 2: Swept delta wings
          g.moveTo(x, y - hh * 0.6);
          g.lineTo(x - hw - 7, y + hh * 0.6);
          g.lineTo(x - hw * 0.3, y + hh * 0.4);
          g.closePath();
          g.fill({ color: darken(bodyColor, 15), alpha: 0.7 });
          g.moveTo(x, y - hh * 0.6);
          g.lineTo(x + hw + 7, y + hh * 0.6);
          g.lineTo(x + hw * 0.3, y + hh * 0.4);
          g.closePath();
          g.fill({ color: darken(bodyColor, 15), alpha: 0.7 });

          // Layer 3: Wing hardpoints (small circles at wing tips)
          g.circle(x - hw - 5, y + hh * 0.55, 2);
          g.fill({ color: TERRAN_METAL, alpha: 0.8 });
          g.circle(x + hw + 5, y + hh * 0.55, 2);
          g.fill({ color: TERRAN_METAL, alpha: 0.8 });

          // Layer 4: Engine pods on each wing (small ellipses with blue glow)
          g.ellipse(x - hw * 0.55, y + hh * 0.25, 3, 5);
          g.fill({ color: TERRAN_DARK, alpha: 0.9 });
          g.circle(x - hw * 0.55, y + hh * 0.55, 2);
          g.fill({ color: 0x4488ff, alpha: 0.5 + 0.3 * Math.sin(gameTime * 4 + eid) });
          g.ellipse(x + hw * 0.55, y + hh * 0.25, 3, 5);
          g.fill({ color: TERRAN_DARK, alpha: 0.9 });
          g.circle(x + hw * 0.55, y + hh * 0.55, 2);
          g.fill({ color: 0x4488ff, alpha: 0.5 + 0.3 * Math.sin(gameTime * 4 + eid) });

          // Layer 5: Central fuselage (long narrow rect)
          g.rect(x - hw * 0.2, y - hh * 0.7, hw * 0.4, hh * 1.5);
          g.fill({ color: bodyColor, alpha: 0.9 });
          g.rect(x - hw * 0.2, y - hh * 0.7, hw * 0.4, hh * 1.5);
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1, alpha: 0.6 });

          // Layer 6: Cockpit dot (brighter color at front)
          g.circle(x, y - hh * 0.5, 2);
          g.fill({ color: TERRAN_VISOR, alpha: 0.9 });

          // Layer 7: Dual gun barrels extending forward from fuselage
          g.moveTo(x - hw * 0.15, y - hh * 0.7);
          g.lineTo(x - hw * 0.15, y - hh * 1.1);
          g.stroke({ color: TERRAN_METAL, width: 1.5 });
          g.moveTo(x + hw * 0.15, y - hh * 0.7);
          g.lineTo(x + hw * 0.15, y - hh * 1.1);
          g.stroke({ color: TERRAN_METAL, width: 1.5 });

          // Layer 8: Tail fins (small lines at rear)
          g.moveTo(x - hw * 0.15, y + hh * 0.7);
          g.lineTo(x - hw * 0.35, y + hh * 1.0);
          g.stroke({ color: bodyColor, width: 1.5 });
          g.moveTo(x + hw * 0.15, y + hh * 0.7);
          g.lineTo(x + hw * 0.35, y + hh * 1.0);
          g.stroke({ color: bodyColor, width: 1.5 });

          // Layer 9: Running lights — red left, green right
          g.circle(x - hw - 3, y + hh * 0.45, 1.2);
          g.fill({ color: 0xff2222, alpha: 0.7 + 0.3 * Math.sin(gameTime * 2) });
          g.circle(x + hw + 3, y + hh * 0.45, 1.2);
          g.fill({ color: 0x22ff22, alpha: 0.7 + 0.3 * Math.sin(gameTime * 2) });

        } else if (uType === UnitType.WidowMine) {
          // ── Widow Mine: spider-like mine, glowing sensor eye, drill bit ──
          const hw = w / 2;
          const hh = h / 2;
          const mineR = Math.min(hw, hh) * 0.85;

          // Shadow (circular)
          g.circle(x, y + 2, mineR + 2);
          g.fill({ color: 0x000000, alpha: 0.3 });

          // 4 articulated spider legs (angled outward with joint bends)
          const legAngles = [-0.7, -2.4, 0.7, 2.4];
          for (let l = 0; l < 4; l++) {
            const angle = legAngles[l];
            const jointX = x + Math.cos(angle) * mineR * 0.9;
            const jointY = y + Math.sin(angle) * mineR * 0.5;
            const tipX = jointX + Math.cos(angle + 0.3) * mineR * 0.7;
            const tipY = jointY + Math.abs(Math.sin(angle)) * mineR * 0.6 + 2;
            // Upper segment
            g.moveTo(x + Math.cos(angle) * mineR * 0.4, y + Math.sin(angle) * mineR * 0.3);
            g.lineTo(jointX, jointY);
            g.stroke({ color: TERRAN_METAL, width: 1.5, alpha: 0.8 });
            // Lower segment
            g.moveTo(jointX, jointY);
            g.lineTo(tipX, tipY);
            g.stroke({ color: TERRAN_METAL, width: 1.2, alpha: 0.7 });
            // Joint dot
            g.circle(jointX, jointY, 1);
            g.fill({ color: TERRAN_DARK, alpha: 0.8 });
          }

          // Drill bit underneath (small triangle pointing down)
          g.moveTo(x - 2.5, y + mineR * 0.5);
          g.lineTo(x, y + mineR * 1.1);
          g.lineTo(x + 2.5, y + mineR * 0.5);
          g.closePath();
          g.fill({ color: TERRAN_METAL, alpha: 0.7 });

          // Main circular body (dark metallic)
          g.circle(x, y, mineR);
          g.fill({ color: darken(bodyColor, 20) });
          g.circle(x, y, mineR);
          g.stroke({ color: TERRAN_METAL, width: 1.2, alpha: 0.7 });

          // Inner ring detail
          g.circle(x, y, mineR * 0.6);
          g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.5 });

          // Central glowing sensor eye (red pulsing dot)
          const eyePulse = 0.5 + 0.5 * Math.sin(gameTime * 3 + eid * 1.3);
          g.circle(x, y, 2.5);
          g.fill({ color: 0xff2222, alpha: eyePulse });
          g.circle(x, y, 4);
          g.stroke({ color: 0xff4444, width: 1, alpha: eyePulse * 0.4 });

          // Danger aura when attacking/targeting
          if (targetEntity[eid] > 0 && entityExists(world, targetEntity[eid])) {
            const auraPulse = 0.3 + 0.3 * Math.sin(gameTime * 6);
            g.circle(x, y, mineR + 5);
            g.stroke({ color: 0xff3333, width: 1.5, alpha: auraPulse });
          }

        } else if (uType === UnitType.Cyclone) {
          // ── Cyclone: tracked vehicle, rotating missile launcher turret, lock-on ──
          const hw = w / 2;
          const hh = h / 2;

          // Layer 1: Drop shadow
          g.rect(x - hw - 2, y - hh - 2, w + 4, h + 4);
          g.fill({ color: 0x000000, alpha: 0.35 });

          // Layer 2: Track marks — two darker rects on sides (tread indicators)
          g.rect(x - hw - 1, y - hh * 0.6, 3, hh * 1.2);
          g.fill({ color: darken(bodyColor, 40) });
          g.rect(x - hw - 1, y - hh * 0.6, 3, hh * 1.2);
          g.stroke({ color: TERRAN_DARK, width: 0.6, alpha: 0.5 });
          g.rect(x + hw - 2, y - hh * 0.6, 3, hh * 1.2);
          g.fill({ color: darken(bodyColor, 40) });
          g.rect(x + hw - 2, y - hh * 0.6, 3, hh * 1.2);
          g.stroke({ color: TERRAN_DARK, width: 0.6, alpha: 0.5 });

          // Layer 3: Lower hull rect (tank-like base)
          g.rect(x - hw * 0.85, y - hh * 0.6, w * 0.85, hh * 1.2);
          g.fill({ color: bodyColor });
          g.rect(x - hw * 0.85, y - hh * 0.6, w * 0.85, hh * 1.2);
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1, alpha: 0.5 });

          // Layer 4: Hull plating lines
          for (let p = 0; p < 2; p++) {
            const py = y - hh * 0.25 + p * hh * 0.35;
            g.moveTo(x - hw * 0.7, py);
            g.lineTo(x + hw * 0.7, py);
            g.stroke({ color: TERRAN_DARK, width: 0.8, alpha: 0.35 });
          }

          // Layer 5: Upper turret (smaller rect on top, slightly rotated)
          const turretW = hw * 0.7;
          const turretH = hh * 0.55;
          g.rect(x - turretW / 2, y - hh * 0.55 - turretH * 0.3, turretW, turretH);
          g.fill({ color: lighten(bodyColor, 15) });
          g.rect(x - turretW / 2, y - hh * 0.55 - turretH * 0.3, turretW, turretH);
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 0.8, alpha: 0.6 });

          // Layer 6: Missile pod — 2 small rects (launcher tubes)
          const podY = y - hh * 0.55 - turretH * 0.2;
          g.rect(x - turretW * 0.35, podY - hh * 0.4, 2.5, hh * 0.35);
          g.fill({ color: TERRAN_METAL, alpha: 0.9 });
          g.rect(x + turretW * 0.15, podY - hh * 0.4, 2.5, hh * 0.35);
          g.fill({ color: TERRAN_METAL, alpha: 0.9 });

          // Layer 7: Targeting dish (small circle on top of turret)
          g.circle(x, y - hh * 0.55 - turretH * 0.3, 2);
          g.fill({ color: TERRAN_VISOR, alpha: 0.7 });

          // Layer 8: Lock-on indicator — pulsing circle at target when attacking
          if (targetEntity[eid] > 0 && entityExists(world, targetEntity[eid])) {
            const tgtX = posX[targetEntity[eid]];
            const tgtY = posY[targetEntity[eid]];
            const lockPulse = 0.4 + 0.4 * Math.sin(gameTime * 6);
            g.circle(tgtX, tgtY, 8);
            g.stroke({ color: 0xff4444, width: 1.5, alpha: lockPulse });
            g.circle(tgtX, tgtY, 4);
            g.stroke({ color: 0xff6666, width: 1, alpha: lockPulse * 0.7 });
            // Dashed line to target
            drawDashedLine(g, x, y, tgtX, tgtY, 0xff4444, lockPulse * 0.3, 4, 3);
          }

        } else if (uType === UnitType.Thor) {
          // ── Thor: massive quad-cannon walker ──
          const hw = w / 2;
          const hh = h / 2;
          // Shadow (larger for massive unit)
          g.ellipse(x, y + 2, hw + 4, hh * 0.5);
          g.fill({ color: 0x000000, alpha: 0.45 });
          // Legs (wide stance)
          g.rect(x - hw * 0.8, y + hh * 0.2, hw * 0.35, hh * 0.7);
          g.fill({ color: darken(bodyColor, 30) });
          g.rect(x + hw * 0.45, y + hh * 0.2, hw * 0.35, hh * 0.7);
          g.fill({ color: darken(bodyColor, 30) });
          // Feet
          g.rect(x - hw * 0.9, y + hh * 0.8, hw * 0.5, hh * 0.15);
          g.fill({ color: 0x334455 });
          g.rect(x + hw * 0.4, y + hh * 0.8, hw * 0.5, hh * 0.15);
          g.fill({ color: 0x334455 });
          // Main body (wide torso)
          g.rect(x - hw * 0.7, y - hh * 0.4, hw * 1.4, hh * 0.7);
          g.fill({ color: bodyColor });
          g.rect(x - hw * 0.7, y - hh * 0.4, hw * 1.4, hh * 0.7);
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 1.5, alpha: 0.6 });
          // Chest plate
          g.rect(x - hw * 0.35, y - hh * 0.3, hw * 0.7, hh * 0.45);
          g.fill({ color: lighten(bodyColor, 15) });
          g.stroke({ color: TERRAN_HIGHLIGHT, width: 0.8, alpha: 0.4 });
          // Shoulder cannon mounts (wide shoulders)
          g.rect(x - hw - 2, y - hh * 0.5, hw * 0.4, hh * 0.4);
          g.fill({ color: bodyColor });
          g.stroke({ color: 0x556677, width: 1, alpha: 0.6 });
          g.rect(x + hw * 0.6 + 2, y - hh * 0.5, hw * 0.4, hh * 0.4);
          g.fill({ color: bodyColor });
          g.stroke({ color: 0x556677, width: 1, alpha: 0.6 });
          // Four gun barrels (2 per shoulder, clean positions)
          const barrelOffsets = [-hw - 1, -hw * 0.7, hw * 0.7, hw + 1];
          for (const bx of barrelOffsets) {
            g.moveTo(x + bx, y - hh * 0.5);
            g.lineTo(x + bx, y - hh * 0.5 - 8);
            g.stroke({ color: 0x8899aa, width: 2.5, alpha: 0.9 });
            // Muzzle cap
            g.circle(x + bx, y - hh * 0.5 - 8, 1.5);
            g.fill({ color: 0x667788 });
          }
          // Head/cockpit
          g.rect(x - hw * 0.2, y - hh * 0.65, hw * 0.4, hh * 0.25);
          g.fill({ color: darken(bodyColor, 10) });
          // Visor
          g.moveTo(x - hw * 0.15, y - hh * 0.55);
          g.lineTo(x + hw * 0.15, y - hh * 0.55);
          g.stroke({ color: TERRAN_VISOR, width: 1.5 });
          // Power core glow
          const thorPulse = 0.3 + Math.sin(gameTime * 1.5 + eid) * 0.1;
          g.circle(x, y - hh * 0.1, 3);
          g.fill({ color: 0x4488ff, alpha: thorPulse });

        } else if (uType === UnitType.Battlecruiser) {
          // ── Battlecruiser: massive capital ship ──
          const hw = w / 2;
          const hh = h / 2;
          // Triangle body
          g.moveTo(posX[eid], posY[eid] - hh);
          g.lineTo(posX[eid] - hw, posY[eid] + hh);
          g.lineTo(posX[eid] + hw, posY[eid] + hh);
          g.closePath();
          g.fill({ color: 0x334455, alpha: 0.9 });
          // Hull plating lines — 3 horizontal stripes across the body
          for (let pl = 0; pl < 3; pl++) {
            const plY = posY[eid] - hh * 0.3 + pl * hh * 0.45;
            const plHalfW = hw * (0.3 + pl * 0.2);
            g.moveTo(posX[eid] - plHalfW, plY);
            g.lineTo(posX[eid] + plHalfW, plY);
            g.stroke({ color: 0x556677, width: 0.8, alpha: 0.3 });
          }
          // Engine glow array — 3 small blue circles at rear
          for (let eg = -1; eg <= 1; eg++) {
            g.circle(posX[eid] + eg * hw * 0.35, posY[eid] + hh - 3, 3);
            g.fill({ color: 0x4488ff, alpha: 0.6 });
            g.circle(posX[eid] + eg * hw * 0.35, posY[eid] + hh - 3, 1.5);
            g.fill({ color: 0x88ccff, alpha: 0.8 });
          }
          // Running lights — red port (left), green starboard (right), blinking alternately
          const portAlpha = 0.3 + Math.sin(gameTime * 2) * 0.5;
          const starAlpha = 0.3 + Math.cos(gameTime * 2) * 0.5;
          g.circle(posX[eid] - hw * 0.6, posY[eid] + hh * 0.3, 1.5);
          g.fill({ color: 0xff2222, alpha: Math.max(0, portAlpha) });
          g.circle(posX[eid] + hw * 0.6, posY[eid] + hh * 0.3, 1.5);
          g.fill({ color: 0x22ff22, alpha: Math.max(0, starAlpha) });

        } else {
          // Fallback for any unknown Terran unit
          g.rect(x - w / 2 - 2, y - h / 2 - 2, w + 4, h + 4);
          g.fill({ color: 0x000000, alpha: 0.4 });
          g.rect(x - w / 2, y - h / 2, w, h);
          g.fill({ color: bodyColor });
        }
      }

      // Cloak visual: shimmer ring + phase distortion effect
      if (cloaked[eid] === 1) {
        const pulse = 0.3 + Math.sin(gameTime * 4 + eid) * 0.2;
        const shimmer = Math.sin(gameTime * 6 + eid * 1.7) * 0.15;
        const rw = renderWidth[eid] / 2;
        const rh = renderHeight[eid] / 2;

        // Outer shimmer ring (pulsing)
        g.circle(posX[eid], posY[eid], Math.max(rw, rh) + 4);
        g.stroke({ color: 0x88aaff, width: 1.5, alpha: pulse });

        // Phase distortion — offset duplicate outline
        const distortX = Math.sin(gameTime * 3 + eid) * 2;
        const distortY = Math.cos(gameTime * 2.5 + eid) * 1.5;
        if (fac === Faction.Zerg) {
          g.ellipse(posX[eid] + distortX, posY[eid] + distortY, rw, rh);
          g.stroke({ color: 0x6688cc, width: 0.8, alpha: 0.2 + shimmer });
        } else {
          g.rect(posX[eid] - rw + distortX, posY[eid] - rh + distortY, renderWidth[eid], renderHeight[eid]);
          g.stroke({ color: 0x6688cc, width: 0.8, alpha: 0.2 + shimmer });
        }

        // Dark overlay to dim the unit
        if (fac === Faction.Zerg) {
          g.ellipse(posX[eid], posY[eid], rw, rh);
        } else {
          g.rect(posX[eid] - rw, posY[eid] - rh, renderWidth[eid], renderHeight[eid]);
        }
        g.fill({ color: 0x000033, alpha: 0.5 });
      }

      // ── Universal status effect overlays (all unit types) ──

      // Stim Pack aura — pulsing orange ring (applies to any stimmed unit)
      if (isStimmed && uType !== UnitType.Marine) {
        // Marine has its own stim ring in layer 19; all others get this one
        const sp = 0.5 + Math.sin(gameTime * 8) * 0.3;
        const maxDim = Math.max(w, h);
        g.circle(x, y, maxDim * 0.8);
        g.stroke({ color: 0xff8800, width: 2, alpha: sp });
        g.circle(x, y, maxDim * 0.55);
        g.stroke({ color: 0xffaa44, width: 1, alpha: sp * 0.4 });
      }

      // Slow debuff aura — icy blue shimmer
      if (slowEndTime[eid] > gameTime) {
        const slowPulse = 0.4 + Math.sin(gameTime * 3 + eid) * 0.2;
        const maxDim = Math.max(w, h);
        g.circle(x, y, maxDim * 0.7);
        g.fill({ color: 0x4488cc, alpha: slowPulse * 0.15 });
        g.circle(x, y, maxDim * 0.7);
        g.stroke({ color: 0x88ccff, width: 1.5, alpha: slowPulse * 0.5 });
        // Icy sparkle dots
        for (let i = 0; i < 3; i++) {
          const angle = gameTime * 1.5 + i * 2.1 + eid * 0.5;
          const dist = maxDim * 0.5;
          const sx = x + Math.cos(angle) * dist;
          const sy = y + Math.sin(angle) * dist;
          g.circle(sx, sy, 1);
          g.fill({ color: 0xcceeFF, alpha: slowPulse * 0.6 });
        }
      }

      // Siege mode transition — sparks and glow during pack/unpack
      if (uType === UnitType.SiegeTank && siegeTransitionEnd[eid] > gameTime) {
        const transProgress = 1 - Math.max(0, (siegeTransitionEnd[eid] - gameTime) / 2);
        const sparkAlpha = 0.4 + Math.sin(gameTime * 12) * 0.3;
        // Transition glow ring
        g.circle(x, y, Math.max(w, h) * 0.7);
        g.stroke({ color: 0xffaa22, width: 2, alpha: sparkAlpha * transProgress });
        // Spark dots around the tank
        for (let i = 0; i < 4; i++) {
          const angle = gameTime * 4 + i * Math.PI / 2;
          const dist = Math.max(w, h) * 0.5 * transProgress;
          const sx = x + Math.cos(angle) * dist;
          const sy = y + Math.sin(angle) * dist;
          g.circle(sx, sy, 1.5);
          g.fill({ color: 0xffdd44, alpha: sparkAlpha });
        }
      }

      // Weapon fire line + muzzle flash for ranged units when attacking
      if (isFlashing && atkRange[eid] > TILE_SIZE) {
        const tgt = targetEntity[eid];
        if (tgt >= 1 && entityExists(world, tgt)) {
          const isTerranUnit = fac === Faction.Terran;
          const lineColor = isTerranUnit ? 0xaaccff : 0x88ff44;
          const flashColor = isTerranUnit ? 0xffdd88 : 0xaaff66;
          const flashAlpha = Math.min(1, atkFlashTimer[eid] / 0.06); // sharper fade

          // Glow line (wider, faded)
          g.moveTo(x, y);
          g.lineTo(posX[tgt], posY[tgt]);
          g.stroke({ color: lineColor, width: 3, alpha: flashAlpha * 0.2 });

          // Core line (thin, bright)
          g.moveTo(x, y);
          g.lineTo(posX[tgt], posY[tgt]);
          g.stroke({ color: lineColor, width: 1, alpha: flashAlpha * 0.5 });

          // Muzzle flash at attacker position
          g.circle(x, y, 3 + flashAlpha * 2);
          g.fill({ color: flashColor, alpha: flashAlpha * 0.6 });
          g.circle(x, y, 1.5);
          g.fill({ color: 0xffffff, alpha: flashAlpha * 0.8 });

          // Hit spark at target position
          if (flashAlpha > 0.5) {
            g.circle(posX[tgt], posY[tgt], 2 + flashAlpha);
            g.fill({ color: 0xffffff, alpha: (flashAlpha - 0.5) * 0.6 });
          }
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
        const hpColor = hpRatio > 0.5 ? 0x44ff44 : hpRatio > 0.25 ? 0xffaa00 : 0xff3333;
        const fillWidth = barW * hpRatio;

        // Background
        g.rect(barX, barY, barW, barH);
        g.fill({ color: 0x333333, alpha: 0.8 });

        // Segmented health fill (5 segments with 1px gaps)
        const segments = 5;
        const segWidth = barW / segments;
        const gap = 1;
        for (let s = 0; s < segments; s++) {
          const segX = barX + s * segWidth;
          const segFill = Math.min(segWidth - gap, Math.max(0, fillWidth - s * segWidth));
          if (segFill > 0) {
            g.rect(segX, barY, segFill, barH);
            g.fill({ color: hpColor });
          }
        }
      }

      // Veterancy stars — drawn above the health bar
      const vet = veterancyLevel[eid];
      if (vet > 0 && hpCurrent[eid] > 0) {
        const starBarX = x - (w + 4) / 2;
        const starBarY = y - h / 2 - 6;
        for (let s = 0; s < vet; s++) {
          const sx = starBarX + s * 5 + 2;
          const sy = starBarY - 4;
          // Small filled diamond shape as a star indicator
          g.moveTo(sx, sy - 3);
          g.lineTo(sx + 2, sy);
          g.lineTo(sx, sy + 3);
          g.lineTo(sx - 2, sy);
          g.closePath();
          g.fill({ color: vet === 3 ? 0xffdd00 : vet === 2 ? 0x44ffaa : 0xaaaaff });
        }
      }

      // Ghost energy bar — shown below the health bar
      if (uType === UnitType.Ghost && (showHealthBar || isSelected)) {
        const eBarW = w + 4;
        const eBarH = 2;
        const eBarX = x - eBarW / 2;
        // Place it below the health bar (health bar is at y - h/2 - 6, 3px tall → bottom at y - h/2 - 3)
        const eBarY = y - h / 2 - 2;
        const eRatio = Math.max(0, Math.min(1, energy[eid] / 200));
        g.rect(eBarX, eBarY, eBarW, eBarH);
        g.fill({ color: 0x111133, alpha: 0.8 });
        if (eRatio > 0) {
          g.rect(eBarX, eBarY, eBarW * eRatio, eBarH);
          g.fill({ color: 0x4488ff });
        }
      }

      // Worker carrying indicator — resource glow when hauling
      if (hasComponents(world, eid, WORKER) && workerCarrying[eid] > 0) {
        // Check if carrying gas (target is a Refinery/gas entity)
        const tgtEid = targetEntity[eid];
        const isGas = tgtEid >= 1 && hasComponents(world, tgtEid, BUILDING) &&
          buildingType[tgtEid] === BuildingType.Refinery;
        const carryColor = isGas ? 0x44ff66 : 0x44bbff;
        const glowColor = isGas ? 0x22aa44 : 0x2288cc;

        // Glow behind
        g.circle(x, y - h / 2 - 2, 5);
        g.fill({ color: glowColor, alpha: 0.3 });
        // Resource crystal/droplet
        if (isGas) {
          // Gas: green droplet shape
          g.circle(x, y - h / 2 - 2, 3);
          g.fill({ color: carryColor, alpha: 0.85 });
        } else {
          // Minerals: blue diamond
          g.moveTo(x, y - h / 2 - 5);
          g.lineTo(x + 3, y - h / 2 - 2);
          g.lineTo(x, y - h / 2 + 1);
          g.lineTo(x - 3, y - h / 2 - 2);
          g.closePath();
          g.fill({ color: carryColor, alpha: 0.85 });
        }
        // Bright center
        g.circle(x, y - h / 2 - 2, 1);
        g.fill({ color: 0xffffff, alpha: 0.5 });
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

      // Faction-specific death halo
      const maxDim = Math.max(renderWidth[eid], renderHeight[eid]);
      if (factionVal === Faction.Terran) {
        // Terran mechanical death: orange flash
        g.circle(x, y, maxDim * (1 - progress) * 1.3);
        g.fill({ color: 0xff8844, alpha: (1 - progress) * 0.4 });
      } else if (factionVal === Faction.Zerg) {
        // Zerg death: green acid dissolve
        g.circle(x, y, maxDim * (1 - progress) * 1.2);
        g.fill({ color: 0x88ff22, alpha: (1 - progress) * 0.3 });
      }

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

    // Death effects — dramatic explosions with size-dependent scale
    for (const evt of deathEvents) {
      const age = gameTime - evt.time;
      const duration = 0.8;
      const t = Math.min(1, age / duration);
      const alpha = Math.max(0, 1 - t);

      const isTerran = evt.faction === Faction.Terran;
      const sizeMult = Math.max(1, evt.size / 14); // scale effects by unit size

      // Faction-specific colors
      const coreColor = isTerran ? 0xffaa44 : 0x88ff22;
      const midColor = isTerran ? 0xff6622 : 0x44cc00;
      const outerColor = isTerran ? 0x4488ff : 0x228800;
      const sparkColor = isTerran ? 0xffcc88 : 0xaaff66;
      const debrisColor = isTerran ? 0x667788 : 0x554422;

      // Phase 1: Bright white core flash (first 20% of duration)
      const flashT = Math.min(1, t * 5);
      if (flashT < 1) {
        const flashAlpha = (1 - flashT) * 0.8;
        const flashR = (4 + sizeMult * 6) * (0.5 + flashT * 0.5);
        g.circle(evt.x, evt.y, flashR);
        g.fill({ color: 0xffffff, alpha: flashAlpha });
      }

      // Phase 2: Expanding shockwave ring
      const ringR = (8 + sizeMult * 12) * t;
      const ringAlpha = alpha * 0.5;
      g.circle(evt.x, evt.y, ringR);
      g.stroke({ color: coreColor, width: 2 + sizeMult * 0.5, alpha: ringAlpha });

      // Phase 3: Inner explosion glow (expanding, fading)
      const innerR = (4 + sizeMult * 8) * (0.3 + t * 0.7);
      g.circle(evt.x, evt.y, innerR);
      g.fill({ color: midColor, alpha: alpha * 0.3 });

      // Phase 4: Outer haze
      const outerR = (6 + sizeMult * 14) * t;
      g.circle(evt.x, evt.y, outerR);
      g.fill({ color: outerColor, alpha: alpha * 0.15 });

      // Phase 5: Spark particles flying outward (8 sparks for normal, more for big units)
      const sparkCount = Math.min(12, Math.floor(4 + sizeMult * 2));
      const sparkDist = (6 + sizeMult * 10) * t;
      const sparkSize = Math.max(0.5, (1.5 + sizeMult * 0.3) * (1 - t));
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i / sparkCount) * Math.PI * 2 + evt.time * 3; // seeded by time for variety
        const wobble = Math.sin(angle * 3 + t * 8) * 4 * t; // slight wobble path
        const px = evt.x + Math.cos(angle) * (sparkDist + wobble);
        const py = evt.y + Math.sin(angle) * (sparkDist + wobble) - t * 8; // slight upward drift
        g.circle(px, py, sparkSize);
        g.fill({ color: sparkColor, alpha: alpha * 0.7 });
      }

      // Phase 6: Debris chunks (Terran = metal shards, Zerg = organic bits)
      const debrisCount = Math.min(6, Math.floor(2 + sizeMult));
      const debrisDist = (4 + sizeMult * 8) * t;
      for (let i = 0; i < debrisCount; i++) {
        const angle = (i / debrisCount) * Math.PI * 2 + 0.5;
        const speed = 0.7 + (i % 3) * 0.15; // varying speeds
        const dx = evt.x + Math.cos(angle) * debrisDist * speed;
        const dy = evt.y + Math.sin(angle) * debrisDist * speed + t * t * 20; // gravity arc
        const dSize = Math.max(0.5, (2 + sizeMult * 0.5) * (1 - t * 0.7));

        if (isTerran) {
          // Metal shards: small rotating rectangles
          g.rect(dx - dSize, dy - dSize * 0.5, dSize * 2, dSize);
          g.fill({ color: debrisColor, alpha: alpha * 0.6 });
        } else {
          // Organic bits: small circles
          g.circle(dx, dy, dSize);
          g.fill({ color: debrisColor, alpha: alpha * 0.5 });
        }
      }

      // Phase 7: Smoke trail (Terran only — lingering dark smoke)
      if (isTerran && t > 0.3) {
        const smokeT = (t - 0.3) / 0.7;
        const smokeR = (3 + sizeMult * 4) * (0.5 + smokeT * 0.5);
        const smokeY = evt.y - smokeT * sizeMult * 8; // rises upward
        g.circle(evt.x, smokeY, smokeR);
        g.fill({ color: 0x222222, alpha: (1 - smokeT) * 0.25 });
      }
    }

    // Floating damage indicators — severity-scaled markers with impact bars
    for (let i = damageEvents.length - 1; i >= 0; i--) {
      const evt = damageEvents[i];
      const age = gameTime - evt.time;
      const duration = 1.0;
      if (age >= duration) continue;

      const t = age / duration;
      const alpha = Math.max(0, 1 - t * t); // quadratic fade — stays visible longer
      const floatY = age * 35; // drift upward
      // Slight horizontal spread based on event index for readability
      const spreadX = Math.sin(evt.time * 7 + i) * 6;

      const dx = evt.x + spreadX;
      const dy = evt.y - floatY;

      // Scale by damage amount: small hits = small marker, big hits = big marker
      const dmg = evt.amount;
      const severity = Math.min(1, dmg / 50); // normalize: 50+ damage = max size
      const baseSize = 2 + severity * 4; // 2-6px
      const size = baseSize * (1 - t * 0.3); // slight shrink over time

      // Color shifts with severity: low = base color, high = brighter/whiter
      const isHeavy = dmg >= 30;
      const isCrit = dmg >= 80;
      const glowColor = isCrit ? 0xffffff : isHeavy ? 0xffddaa : evt.color;

      // Background glow for heavy hits
      if (isHeavy) {
        g.circle(dx, dy, size + 3);
        g.fill({ color: evt.color, alpha: alpha * 0.15 });
      }

      // Damage bar — horizontal line whose width = damage magnitude
      const barWidth = 2 + Math.min(14, dmg * 0.2);
      const barHeight = Math.max(1.5, 1 + severity);
      g.rect(dx - barWidth / 2, dy - barHeight / 2, barWidth, barHeight);
      g.fill({ color: glowColor, alpha: alpha * 0.85 });

      // Bright core dot
      g.circle(dx, dy, size * 0.4);
      g.fill({ color: 0xffffff, alpha: alpha * 0.6 });

      // Critical hit burst — extra sparkle lines for 80+ damage
      if (isCrit && t < 0.3) {
        const burstAlpha = (1 - t / 0.3) * alpha;
        for (let s = 0; s < 4; s++) {
          const angle = s * Math.PI / 2 + 0.4;
          const len = 4 + severity * 3;
          g.moveTo(dx + Math.cos(angle) * 2, dy + Math.sin(angle) * 2);
          g.lineTo(dx + Math.cos(angle) * len, dy + Math.sin(angle) * len);
          g.stroke({ color: 0xffff88, width: 1, alpha: burstAlpha * 0.7 });
        }
      }
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
