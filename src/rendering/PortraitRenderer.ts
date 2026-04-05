import { Faction, UnitType } from '../constants';
import { UNIT_DEFS } from '../data/units';

const SIZE = 44;
const BG = '#1a2235';

// Faction base colors (CSS strings)
const T_BLUE = '#55aaff';
const T_STEEL = '#667788';
const T_DARK = '#223355';
const T_VISOR = '#22ffff';
const T_HIGHLIGHT = '#88bbee';
const Z_RED = '#ee4444';
const Z_FLESH = '#aa3355';
const Z_ACID = '#99ff44';

function hexColor(hex: number): string {
  return '#' + hex.toString(16).padStart(6, '0');
}

/**
 * Pre-renders 44x44 HTML5 Canvas portraits for each unit type.
 * Uses Canvas 2D only (not PixiJS). Caches results in a Map.
 */
export class PortraitRenderer {
  private cache = new Map<number, HTMLCanvasElement>();

  getPortrait(ut: number): HTMLCanvasElement {
    let c = this.cache.get(ut);
    if (c) return c;
    c = this.createPortrait(ut);
    this.cache.set(ut, c);
    return c;
  }

  private createPortrait(ut: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Draw unit-specific art
    this.drawUnit(ctx, ut);

    // Border — faction color
    const def = UNIT_DEFS[ut];
    const isTerran = def && def.faction === Faction.Terran;
    ctx.strokeStyle = isTerran ? T_BLUE : Z_RED;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);

    return canvas;
  }

  private drawUnit(ctx: CanvasRenderingContext2D, ut: number): void {
    switch (ut) {
      case UnitType.SCV:       this.drawSCV(ctx); break;
      case UnitType.Marine:    this.drawMarine(ctx); break;
      case UnitType.Marauder:  this.drawMarauder(ctx); break;
      case UnitType.SiegeTank: this.drawSiegeTank(ctx); break;
      case UnitType.Medivac:   this.drawMedivac(ctx); break;
      case UnitType.Ghost:     this.drawGhost(ctx); break;
      case UnitType.Hellion:   this.drawHellion(ctx); break;
      case UnitType.Reaper:    this.drawReaper(ctx); break;
      case UnitType.Viking:    this.drawViking(ctx); break;
      case UnitType.WidowMine: this.drawWidowMine(ctx); break;
      case UnitType.Battlecruiser: this.drawBattlecruiser(ctx); break;
      case UnitType.Drone:     this.drawDrone(ctx); break;
      case UnitType.Zergling:  this.drawZergling(ctx); break;
      case UnitType.Baneling:  this.drawBaneling(ctx); break;
      case UnitType.Hydralisk: this.drawHydralisk(ctx); break;
      case UnitType.Roach:     this.drawRoach(ctx); break;
      case UnitType.Mutalisk:  this.drawMutalisk(ctx); break;
      case UnitType.Queen:     this.drawQueen(ctx); break;
      case UnitType.Overlord:  this.drawOverlord(ctx); break;
      case UnitType.Ravager:   this.drawRavager(ctx); break;
      case UnitType.Infestor:  this.drawInfestor(ctx); break;
      case UnitType.Ultralisk: this.drawUltralisk(ctx); break;
      case UnitType.Viper:     this.drawViper(ctx); break;
      default:                 this.drawFallback(ctx, ut); break;
    }
  }

  // ── Terran ────────────────────────────────────────

  private drawSCV(ctx: CanvasRenderingContext2D): void {
    // Body square
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(14, 14, 16, 16);
    // Arm extending right
    ctx.strokeStyle = T_BLUE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, 22);
    ctx.lineTo(38, 18);
    ctx.stroke();
    // Visor
    ctx.fillStyle = T_VISOR;
    ctx.fillRect(17, 18, 8, 3);
  }

  private drawMarine(ctx: CanvasRenderingContext2D): void {
    // Body rectangle
    ctx.fillStyle = T_BLUE;
    ctx.fillRect(14, 14, 16, 20);
    // Shoulder pads
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(10, 14, 6, 6);
    ctx.fillRect(28, 14, 6, 6);
    // T-visor (horizontal + vertical)
    ctx.strokeStyle = T_VISOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(17, 20);
    ctx.lineTo(27, 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, 17);
    ctx.lineTo(22, 23);
    ctx.stroke();
  }

  private drawMarauder(ctx: CanvasRenderingContext2D): void {
    // Wide body
    ctx.fillStyle = T_BLUE;
    ctx.fillRect(10, 14, 24, 20);
    // Two shoulder launchers
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(6, 12, 8, 8);
    ctx.fillRect(30, 12, 8, 8);
    // Visor slit
    ctx.fillStyle = T_VISOR;
    ctx.fillRect(16, 19, 12, 2);
  }

  private drawSiegeTank(ctx: CanvasRenderingContext2D): void {
    // Hull
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(8, 22, 28, 12);
    // Turret
    ctx.fillStyle = T_BLUE;
    ctx.fillRect(16, 14, 12, 10);
    // Barrel
    ctx.strokeStyle = T_HIGHLIGHT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(28, 19);
    ctx.lineTo(40, 16);
    ctx.stroke();
  }

  private drawMedivac(ctx: CanvasRenderingContext2D): void {
    // Oval body
    ctx.fillStyle = T_HIGHLIGHT;
    ctx.beginPath();
    ctx.ellipse(22, 22, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings/engines
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(4, 18, 6, 4);
    ctx.fillRect(34, 18, 6, 4);
    // Red cross
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(20, 18, 4, 8);
    ctx.fillRect(18, 20, 8, 4);
  }

  private drawGhost(ctx: CanvasRenderingContext2D): void {
    // Slim body — darker blue / stealth
    ctx.fillStyle = T_DARK;
    ctx.fillRect(17, 14, 10, 22);
    // Head circle
    ctx.fillStyle = T_STEEL;
    ctx.beginPath();
    ctx.arc(22, 12, 5, 0, Math.PI * 2);
    ctx.fill();
    // Visor glow
    ctx.fillStyle = T_VISOR;
    ctx.fillRect(19, 11, 6, 2);
  }

  private drawHellion(ctx: CanvasRenderingContext2D): void {
    // Body
    ctx.fillStyle = '#ff6600';
    ctx.fillRect(14, 18, 16, 10);
    // Wheels/treads
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(10, 28, 8, 4);
    ctx.fillRect(26, 28, 8, 4);
    // Flame nozzle
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(20, 12, 4, 8);
  }

  private drawReaper(ctx: CanvasRenderingContext2D): void {
    // Slim body
    ctx.fillStyle = '#88aacc';
    ctx.fillRect(17, 16, 10, 18);
    // Jetpack
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(13, 16, 4, 10);
    ctx.fillRect(27, 16, 4, 10);
    // Jet flames
    ctx.fillStyle = '#ff6622';
    ctx.fillRect(14, 26, 2, 4);
    ctx.fillRect(28, 26, 2, 4);
  }

  private drawViking(ctx: CanvasRenderingContext2D): void {
    // Body
    ctx.fillStyle = '#6699bb';
    ctx.fillRect(16, 14, 12, 18);
    // Wings
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(4, 18, 12, 4);
    ctx.fillRect(28, 18, 12, 4);
    // Cockpit
    ctx.fillStyle = T_VISOR;
    ctx.fillRect(19, 16, 6, 3);
  }

  private drawWidowMine(ctx: CanvasRenderingContext2D): void {
    // Mine body circle
    ctx.fillStyle = '#443322';
    ctx.beginPath();
    ctx.arc(22, 22, 10, 0, Math.PI * 2);
    ctx.fill();
    // Warning light
    ctx.fillStyle = '#ff3333';
    ctx.beginPath();
    ctx.arc(22, 22, 3, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.strokeStyle = T_STEEL;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 30); ctx.lineTo(10, 36);
    ctx.moveTo(30, 30); ctx.lineTo(34, 36);
    ctx.stroke();
  }

  private drawBattlecruiser(ctx: CanvasRenderingContext2D): void {
    // Large hull
    ctx.fillStyle = '#334455';
    ctx.fillRect(4, 18, 36, 12);
    // Bridge on top
    ctx.fillStyle = T_STEEL;
    ctx.fillRect(14, 10, 16, 10);
    // Engine glow
    ctx.fillStyle = T_VISOR;
    ctx.fillRect(6, 22, 4, 4);
    // Accent line
    ctx.strokeStyle = T_BLUE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, 24);
    ctx.lineTo(40, 24);
    ctx.stroke();
  }

  // ── Zerg ──────────────────────────────────────────

  private drawDrone(ctx: CanvasRenderingContext2D): void {
    // Body ellipse
    ctx.fillStyle = Z_RED;
    ctx.beginPath();
    ctx.ellipse(22, 22, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.strokeStyle = Z_FLESH;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 28); ctx.lineTo(8, 36);
    ctx.moveTo(30, 28); ctx.lineTo(36, 36);
    ctx.moveTo(12, 22); ctx.lineTo(6, 18);
    ctx.moveTo(32, 22); ctx.lineTo(38, 18);
    ctx.stroke();
  }

  private drawZergling(ctx: CanvasRenderingContext2D): void {
    // Elongated body
    ctx.fillStyle = Z_RED;
    ctx.beginPath();
    ctx.ellipse(22, 22, 14, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mandibles
    ctx.strokeStyle = '#ff6644';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(36, 20); ctx.lineTo(40, 16);
    ctx.moveTo(36, 24); ctx.lineTo(40, 28);
    ctx.stroke();
  }

  private drawBaneling(ctx: CanvasRenderingContext2D): void {
    // Glow circle
    ctx.fillStyle = 'rgba(68, 204, 68, 0.3)';
    ctx.beginPath();
    ctx.arc(22, 22, 14, 0, Math.PI * 2);
    ctx.fill();
    // Main body
    ctx.fillStyle = '#44cc44';
    ctx.beginPath();
    ctx.arc(22, 22, 10, 0, Math.PI * 2);
    ctx.fill();
    // Acid sac highlight
    ctx.fillStyle = Z_ACID;
    ctx.beginPath();
    ctx.arc(20, 19, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHydralisk(ctx: CanvasRenderingContext2D): void {
    // Tall ellipse body
    ctx.fillStyle = Z_RED;
    ctx.beginPath();
    ctx.ellipse(22, 24, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Spine ridge on top
    ctx.strokeStyle = '#ff6644';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, 10); ctx.lineTo(22, 6); ctx.lineTo(26, 10);
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(18, 18, 3, 2);
    ctx.fillRect(23, 18, 3, 2);
  }

  private drawRoach(ctx: CanvasRenderingContext2D): void {
    // Wide squat ellipse
    ctx.fillStyle = Z_RED;
    ctx.beginPath();
    ctx.ellipse(22, 24, 14, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Carapace line
    ctx.strokeStyle = Z_FLESH;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 22);
    ctx.lineTo(22, 18);
    ctx.lineTo(34, 22);
    ctx.stroke();
  }

  private drawMutalisk(ctx: CanvasRenderingContext2D): void {
    // Wing diamond shape
    ctx.fillStyle = '#aa66dd';
    ctx.beginPath();
    ctx.moveTo(22, 8);
    ctx.lineTo(38, 22);
    ctx.lineTo(22, 36);
    ctx.lineTo(6, 22);
    ctx.closePath();
    ctx.fill();
    // Body center
    ctx.fillStyle = Z_RED;
    ctx.beginPath();
    ctx.ellipse(22, 22, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawQueen(ctx: CanvasRenderingContext2D): void {
    // Large body
    ctx.fillStyle = '#bb44bb';
    ctx.beginPath();
    ctx.ellipse(22, 24, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Crown spikes
    ctx.strokeStyle = '#ff66ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 16); ctx.lineTo(16, 8);
    ctx.moveTo(22, 14); ctx.lineTo(22, 6);
    ctx.moveTo(30, 16); ctx.lineTo(28, 8);
    ctx.stroke();
  }

  private drawOverlord(ctx: CanvasRenderingContext2D): void {
    // Body circle
    ctx.fillStyle = '#886622';
    ctx.beginPath();
    ctx.arc(22, 18, 12, 0, Math.PI * 2);
    ctx.fill();
    // Tentacles
    ctx.strokeStyle = Z_RED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 28); ctx.lineTo(12, 38);
    ctx.moveTo(22, 30); ctx.lineTo(22, 40);
    ctx.moveTo(30, 28); ctx.lineTo(32, 38);
    ctx.stroke();
  }

  private drawRavager(ctx: CanvasRenderingContext2D): void {
    // Wide body
    ctx.fillStyle = '#cc4422';
    ctx.beginPath();
    ctx.ellipse(22, 24, 12, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Acid green accent
    ctx.fillStyle = Z_ACID;
    ctx.fillRect(18, 14, 8, 4);
    // Arm details
    ctx.strokeStyle = Z_RED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(10, 20); ctx.lineTo(4, 14);
    ctx.moveTo(34, 20); ctx.lineTo(40, 14);
    ctx.stroke();
  }

  private drawInfestor(ctx: CanvasRenderingContext2D): void {
    // Wide purple-red body
    ctx.fillStyle = '#446622';
    ctx.beginPath();
    ctx.ellipse(22, 22, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tendrils
    ctx.strokeStyle = Z_FLESH;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 26); ctx.lineTo(4, 34);
    ctx.moveTo(36, 26); ctx.lineTo(40, 34);
    ctx.moveTo(22, 32); ctx.lineTo(22, 40);
    ctx.stroke();
  }

  private drawUltralisk(ctx: CanvasRenderingContext2D): void {
    // Very large body
    ctx.fillStyle = '#332211';
    ctx.fillRect(6, 14, 32, 20);
    // Carapace highlight
    ctx.fillStyle = Z_RED;
    ctx.fillRect(8, 14, 28, 4);
    // Kaiser blades
    ctx.strokeStyle = '#ff6644';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 18); ctx.lineTo(2, 8);
    ctx.moveTo(38, 18); ctx.lineTo(42, 8);
    ctx.stroke();
  }

  private drawViper(ctx: CanvasRenderingContext2D): void {
    // Elongated body
    ctx.fillStyle = '#669944';
    ctx.beginPath();
    ctx.ellipse(22, 22, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.strokeStyle = Z_RED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, 22);
    ctx.quadraticCurveTo(2, 32, 6, 38);
    ctx.stroke();
    // Eyes
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(30, 20, 3, 2);
  }

  // ── Fallback ──────────────────────────────────────

  private drawFallback(ctx: CanvasRenderingContext2D, ut: number): void {
    const def = UNIT_DEFS[ut];
    const color = def ? hexColor(def.color) : '#888888';
    ctx.fillStyle = color;
    ctx.fillRect(10, 10, 24, 24);
  }
}
