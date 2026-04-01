import { Container, Graphics } from 'pixi.js';
import { UnitType } from '../constants';

export interface ProjectileEvent {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  unitType: number; // UnitType enum value
  speed: number;    // pixels per second
  time: number;     // when emitted (gameTime)
}

const MAX_PROJECTILES = 64;

// Module-level pending queue — CombatSystem pushes here, renderer drains each frame
const _pendingProjectiles: ProjectileEvent[] = [];

export function emitProjectile(event: ProjectileEvent): void {
  _pendingProjectiles.push(event);
}

/** Returns [color, radius] for a given unit type */
function projectileStyle(uType: number): [number, number] {
  switch (uType as UnitType) {
    case UnitType.SiegeTank:
      return [0xff8800, 4];
    case UnitType.Drone:
    case UnitType.Zergling:
    case UnitType.Baneling:
    case UnitType.Hydralisk:
    case UnitType.Roach:
      return [0x44ff44, 2];
    default:
      // Marine, SCV, Marauder — white
      return [0xffffff, 2];
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

    // Remove projectiles that have fully arrived (t >= 1)
    this.active = this.active.filter((evt) => {
      const dx = evt.toX - evt.fromX;
      const dy = evt.toY - evt.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) return false; // zero-distance, discard
      const duration = dist / evt.speed;
      return (gameTime - evt.time) < duration;
    });
  }

  render(gameTime: number): void {
    const g = this.graphics;
    g.clear();

    for (const evt of this.active) {
      const dx = evt.toX - evt.fromX;
      const dy = evt.toY - evt.fromY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      const duration = dist / evt.speed;
      const t = Math.min(1, Math.max(0, (gameTime - evt.time) / duration));

      const px = evt.fromX + dx * t;
      const py = evt.fromY + dy * t;

      const [color, radius] = projectileStyle(evt.unitType);
      g.circle(px, py, radius);
      g.fill({ color, alpha: 1 });
    }
  }
}
