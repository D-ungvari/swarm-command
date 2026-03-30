import { Container, Graphics } from 'pixi.js';
import { Faction, UnitType, SiegeMode, SELECTION_COLOR, TILE_SIZE, MEDIVAC_HEAL_RANGE } from '../constants';
import {
  POSITION, RENDERABLE, SELECTABLE, HEALTH, UNIT_TYPE, ATTACK,
  posX, posY, renderWidth, renderHeight, renderTint,
  selected, faction, hpCurrent, hpMax, unitType,
  atkFlashTimer, atkRange, atkDamage, targetEntity,
  stimEndTime, slowEndTime, siegeMode, lastCombatTime,
} from '../ecs/components';
import { type World, hasComponents, entityExists } from '../ecs/world';
import { deathEvents } from '../systems/DeathSystem';

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
      const y = posY[eid];
      let w = renderWidth[eid];
      let h = renderHeight[eid];
      const tint = renderTint[eid];
      const isSelected = hasComponents(world, eid, SELECTABLE) && selected[eid] === 1;
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
        // Organic: circles/ellipses
        g.ellipse(x, y, w / 2, h / 2);
        g.fill({ color: bodyColor });

        // Zergling: small spikes
        if (uType === UnitType.Zergling) {
          g.moveTo(x - w * 0.4, y - h * 0.5);
          g.lineTo(x - w * 0.1, y - h * 0.3);
          g.lineTo(x + w * 0.1, y - h * 0.3);
          g.lineTo(x + w * 0.4, y - h * 0.5);
          g.stroke({ color: tint, width: 1.5 });
        }
        // Baneling: glow ring
        if (uType === UnitType.Baneling) {
          g.circle(x, y, w / 2 + 2);
          g.stroke({ color: 0xaaff44, width: 1, alpha: 0.6 });
        }
        // Roach regen indicator — pulsing green when regenerating
        if (uType === UnitType.Roach && hpCurrent[eid] < hpMax[eid] && hpCurrent[eid] > 0) {
          const pulse = 0.3 + 0.3 * Math.sin(gameTime * 4);
          g.circle(x, y - h / 2 - 4, 3);
          g.fill({ color: 0x44ff44, alpha: pulse });
        }
      } else {
        // Terran: rectangles (angular, mechanical)
        g.rect(x - w / 2, y - h / 2, w, h);
        g.fill({ color: bodyColor });

        // Siege Tank
        if (uType === UnitType.SiegeTank) {
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
        // Medivac: cross symbol + heal beams
        if (uType === UnitType.Medivac) {
          g.rect(x - 2, y - 5, 4, 10);
          g.fill({ color: 0xffffff, alpha: 0.6 });
          g.rect(x - 5, y - 2, 10, 4);
          g.fill({ color: 0xffffff, alpha: 0.6 });

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

      // Health bar (only if damaged)
      if (hasComponents(world, eid, HEALTH) && hpCurrent[eid] < hpMax[eid] && hpCurrent[eid] > 0) {
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
    }

    // Death effects
    for (const evt of deathEvents) {
      const age = gameTime - evt.time;
      const alpha = Math.max(0, 1 - age / 0.5);
      const radius = 8 + age * 40;
      const color = evt.faction === Faction.Terran ? 0x3399ff : 0xcc3333;

      g.circle(evt.x, evt.y, radius);
      g.stroke({ color, width: 2, alpha });
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
