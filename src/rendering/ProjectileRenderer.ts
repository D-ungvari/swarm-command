import { Container, Graphics } from 'pixi.js';
import { UnitType, Faction } from '../constants';

export interface ProjectileEvent {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  unitType: number; // UnitType enum value
  speed: number;    // pixels per second
  time: number;     // when emitted (gameTime)
}

const MAX_PROJECTILES = 128;
const TRAIL_LENGTH = 5; // number of trail segments

// Module-level pending queue — CombatSystem pushes here, renderer drains each frame
const _pendingProjectiles: ProjectileEvent[] = [];

export function emitProjectile(event: ProjectileEvent): void {
  _pendingProjectiles.push(event);
}

// Impact flash pool — spawned when projectile arrives
interface ImpactFlash {
  x: number;
  y: number;
  color: number;
  radius: number;
  startTime: number;
  duration: number;
}

const _impacts: ImpactFlash[] = [];
const MAX_IMPACTS = 48;

/** Weapon visual profile per unit type */
interface WeaponStyle {
  color: number;
  glowColor: number;
  radius: number;
  glowRadius: number;
  trailWidth: number;
  trailAlpha: number;
  impactRadius: number;
  impactDuration: number;
}

function weaponStyle(uType: number): WeaponStyle {
  switch (uType as UnitType) {
    // Terran heavy — orange/yellow artillery
    case UnitType.SiegeTank:
      return { color: 0xffaa22, glowColor: 0xff6600, radius: 4, glowRadius: 10, trailWidth: 3, trailAlpha: 0.4, impactRadius: 16, impactDuration: 0.25 };
    case UnitType.Thor:
      return { color: 0xffcc44, glowColor: 0xff8800, radius: 3.5, glowRadius: 8, trailWidth: 2.5, trailAlpha: 0.35, impactRadius: 12, impactDuration: 0.2 };
    case UnitType.Battlecruiser:
      return { color: 0x44aaff, glowColor: 0x2266ff, radius: 5, glowRadius: 14, trailWidth: 4, trailAlpha: 0.5, impactRadius: 18, impactDuration: 0.3 };

    // Terran standard — blue-white gauss rounds
    case UnitType.Marine:
      return { color: 0xeeeeff, glowColor: 0x88aaff, radius: 2, glowRadius: 5, trailWidth: 1.5, trailAlpha: 0.25, impactRadius: 6, impactDuration: 0.12 };
    case UnitType.Marauder:
      return { color: 0xff8844, glowColor: 0xff5500, radius: 3, glowRadius: 7, trailWidth: 2, trailAlpha: 0.3, impactRadius: 10, impactDuration: 0.18 };
    case UnitType.Ghost:
      return { color: 0xccddff, glowColor: 0x6688cc, radius: 2, glowRadius: 6, trailWidth: 1.5, trailAlpha: 0.3, impactRadius: 7, impactDuration: 0.15 };
    case UnitType.Viking:
      return { color: 0xeeeeff, glowColor: 0x88aaff, radius: 2, glowRadius: 5, trailWidth: 1.5, trailAlpha: 0.25, impactRadius: 6, impactDuration: 0.12 };

    // Terran fire — hellion
    case UnitType.Hellion:
      return { color: 0xff4400, glowColor: 0xff2200, radius: 3, glowRadius: 8, trailWidth: 3, trailAlpha: 0.45, impactRadius: 12, impactDuration: 0.2 };

    // Zerg ranged — acid green
    case UnitType.Hydralisk:
      return { color: 0x88ff22, glowColor: 0x44cc00, radius: 2.5, glowRadius: 6, trailWidth: 2, trailAlpha: 0.3, impactRadius: 8, impactDuration: 0.15 };
    case UnitType.Roach:
      return { color: 0x66dd22, glowColor: 0x338800, radius: 3, glowRadius: 7, trailWidth: 2.5, trailAlpha: 0.35, impactRadius: 10, impactDuration: 0.18 };
    case UnitType.Mutalisk:
      return { color: 0xaaff44, glowColor: 0x66cc00, radius: 2, glowRadius: 5, trailWidth: 1.5, trailAlpha: 0.25, impactRadius: 6, impactDuration: 0.12 };
    case UnitType.Queen:
      return { color: 0xcc44ff, glowColor: 0x8822cc, radius: 2.5, glowRadius: 6, trailWidth: 2, trailAlpha: 0.3, impactRadius: 8, impactDuration: 0.15 };
    case UnitType.Ravager:
      return { color: 0xffaa00, glowColor: 0xcc6600, radius: 4, glowRadius: 10, trailWidth: 3, trailAlpha: 0.4, impactRadius: 14, impactDuration: 0.22 };
    case UnitType.Corruptor:
      return { color: 0xaa44ff, glowColor: 0x6622aa, radius: 3, glowRadius: 7, trailWidth: 2, trailAlpha: 0.3, impactRadius: 9, impactDuration: 0.15 };

    // Zerg melee — short range small
    case UnitType.Zergling:
    case UnitType.Baneling:
    case UnitType.Ultralisk:
      return { color: 0x44ff44, glowColor: 0x22aa22, radius: 1.5, glowRadius: 3, trailWidth: 1, trailAlpha: 0.15, impactRadius: 4, impactDuration: 0.1 };

    default:
      return { color: 0xffffff, glowColor: 0x888888, radius: 2, glowRadius: 5, trailWidth: 1.5, trailAlpha: 0.2, impactRadius: 6, impactDuration: 0.12 };
  }
}

export class ProjectileRenderer {
  readonly container: Container;
  private readonly graphics: Graphics;
  private active: ProjectileEvent[] = [];

  constructor() {
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /** Drain pending queue and remove arrived projectiles */
  update(gameTime: number): void {
    // Drain module-level pending queue
    while (_pendingProjectiles.length > 0) {
      const evt = _pendingProjectiles.shift()!;
      if (this.active.length < MAX_PROJECTILES) {
        this.active.push(evt);
      }
    }

    // Remove projectiles that have fully arrived — spawn impact flash
    this.active = this.active.filter((evt) => {
      const dx = evt.toX - evt.fromX;
      const dy = evt.toY - evt.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return false;
      const duration = dist / evt.speed;
      const arrived = (gameTime - evt.time) >= duration;
      if (arrived) {
        const style = weaponStyle(evt.unitType);
        if (_impacts.length < MAX_IMPACTS) {
          _impacts.push({
            x: evt.toX, y: evt.toY,
            color: style.glowColor,
            radius: style.impactRadius,
            startTime: gameTime,
            duration: style.impactDuration,
          });
        }
      }
      return !arrived;
    });

    // Remove expired impacts
    for (let i = _impacts.length - 1; i >= 0; i--) {
      if (gameTime - _impacts[i].startTime >= _impacts[i].duration) {
        _impacts.splice(i, 1);
      }
    }
  }

  render(gameTime: number): void {
    const g = this.graphics;
    g.clear();

    // ── Draw impact flashes ──
    for (const imp of _impacts) {
      const t = (gameTime - imp.startTime) / imp.duration;
      const alpha = 1 - t;
      const r = imp.radius * (0.5 + t * 0.5);

      // Outer glow
      g.circle(imp.x, imp.y, r);
      g.fill({ color: imp.color, alpha: alpha * 0.3 });

      // Bright core
      g.circle(imp.x, imp.y, r * 0.4);
      g.fill({ color: 0xffffff, alpha: alpha * 0.6 });
    }

    // ── Draw active projectiles ──
    for (const evt of this.active) {
      const dx = evt.toX - evt.fromX;
      const dy = evt.toY - evt.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const duration = dist / evt.speed;
      const t = Math.min(1, Math.max(0, (gameTime - evt.time) / duration));

      const px = evt.fromX + dx * t;
      const py = evt.fromY + dy * t;

      const style = weaponStyle(evt.unitType);

      // ── Trail: draw fading segments behind the projectile ──
      for (let i = 1; i <= TRAIL_LENGTH; i++) {
        const trailT = t - (i * 0.04); // each segment is 4% of travel behind
        if (trailT < 0) continue;
        const tx = evt.fromX + dx * trailT;
        const ty = evt.fromY + dy * trailT;
        const fade = 1 - (i / TRAIL_LENGTH);
        g.moveTo(px, py);
        if (i === 1) {
          // First segment: line from projectile to first trail point
          g.moveTo(tx, ty);
          g.lineTo(px, py);
          g.stroke({ color: style.color, width: style.trailWidth, alpha: style.trailAlpha * fade });
        } else {
          // Subsequent trail dots
          g.circle(tx, ty, style.radius * fade * 0.6);
          g.fill({ color: style.color, alpha: style.trailAlpha * fade });
        }
      }

      // ── Outer glow ──
      g.circle(px, py, style.glowRadius);
      g.fill({ color: style.glowColor, alpha: 0.15 });

      // ── Core projectile ──
      g.circle(px, py, style.radius);
      g.fill({ color: style.color, alpha: 1 });

      // ── Bright center dot ──
      g.circle(px, py, style.radius * 0.4);
      g.fill({ color: 0xffffff, alpha: 0.7 });
    }
  }
}
