import { Texture } from 'pixi.js';
import { TILE_SIZE } from '../constants';
import { TerrainPalette, tileHash } from './terrainPalette';

/** Convert 0xRRGGBB number to CSS "rgb(r,g,b)" */
function hexToCSS(hex: number, alpha = 1): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`;
}

/**
 * Procedural tile texture generator.
 * Paints rich Canvas 2D textures at startup, caches as PixiJS Textures.
 */
export class TextureGenerator {
  private cache = new Map<string, Texture>();

  /** Generate all tile textures and populate cache */
  generateAll(): void {
    // Ground variants
    for (let v = 0; v < 3; v++) {
      this.cache.set(`ground_${v}`, this.generateGround(v));
      this.cache.set(`ground_high_${v}`, this.generateGroundHigh(v));
    }
    this.cache.set('water_base', this.generateWater());
    this.cache.set('ramp', this.generateRamp());
    this.cache.set('cliff', this.generateUnbuildable());
    this.cache.set('rock', this.generateDestructible());
    this.cache.set('mineral_ground', this.generateMineralGround());
    this.cache.set('gas_ground', this.generateGasGround());
  }

  /** Get a cached texture by key */
  get(key: string): Texture {
    return this.cache.get(key) ?? Texture.WHITE;
  }

  // ── Individual generators ──

  private generateGround(variant: number): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.ground;
    const TS = TILE_SIZE;

    // Base fill
    ctx.fillStyle = hexToCSS(pal.base);
    ctx.fillRect(0, 0, TS, TS);

    // Variant tint
    if (variant === 0) {
      // Grass-dominant: green overlay
      ctx.fillStyle = hexToCSS(pal.grassTint, 0.15);
      ctx.fillRect(0, 0, TS, TS);
      this.addGrassTufts(ctx, 3 + (variant * 2));
    } else if (variant === 1) {
      // Dirt-dominant: brown overlay
      ctx.fillStyle = hexToCSS(pal.dirtTint, 0.2);
      ctx.fillRect(0, 0, TS, TS);
      // Crack lines
      ctx.strokeStyle = hexToCSS(pal.noiseDark, 0.3);
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(4, 12);
      ctx.lineTo(18, 20);
      ctx.stroke();
    } else {
      // Mixed: lighter grass + subtle dirt
      ctx.fillStyle = hexToCSS(pal.grassTint, 0.08);
      ctx.fillRect(0, 0, TS, TS);
      this.addGrassTufts(ctx, 2);
    }

    // Noise dots
    this.addNoise(ctx, pal.noise, 5, [0.5, 1.5]);
    this.addNoise(ctx, pal.noiseDark, 3, [0.3, 1.0]);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateGroundHigh(variant: number): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.ground;
    const TS = TILE_SIZE;

    // Brighter base for high ground
    const brightBase = brighten(pal.base, 25);
    ctx.fillStyle = hexToCSS(brightBase);
    ctx.fillRect(0, 0, TS, TS);

    if (variant === 0) {
      ctx.fillStyle = hexToCSS(brighten(pal.grassTint, 15), 0.15);
      ctx.fillRect(0, 0, TS, TS);
      this.addGrassTufts(ctx, 4);
    } else if (variant === 1) {
      ctx.fillStyle = hexToCSS(pal.dirtTint, 0.15);
      ctx.fillRect(0, 0, TS, TS);
    } else {
      ctx.fillStyle = hexToCSS(brighten(pal.grassTint, 10), 0.1);
      ctx.fillRect(0, 0, TS, TS);
      this.addGrassTufts(ctx, 2);
    }

    // Brightness overlay
    ctx.fillStyle = hexToCSS(0xffffff, TerrainPalette.elevation.highAlpha);
    ctx.fillRect(0, 0, TS, TS);

    this.addNoise(ctx, pal.noise, 4, [0.5, 1.2]);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateWater(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.water;
    const TS = TILE_SIZE;

    // Blue base
    ctx.fillStyle = hexToCSS(pal.base);
    ctx.fillRect(0, 0, TS, TS);

    // Subtle depth gradient (darker at bottom)
    const grad = ctx.createLinearGradient(0, 0, 0, TS);
    grad.addColorStop(0, hexToCSS(pal.wave, 0.1));
    grad.addColorStop(1, hexToCSS(pal.deep, 0.15));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TS, TS);

    // Wave highlight dots
    ctx.fillStyle = hexToCSS(pal.wave, 0.2);
    ctx.beginPath();
    ctx.arc(8, 10, 1.5, 0, Math.PI * 2);
    ctx.arc(22, 18, 1.2, 0, Math.PI * 2);
    ctx.arc(14, 26, 1.0, 0, Math.PI * 2);
    ctx.fill();

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateRamp(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.ramp;
    const TS = TILE_SIZE;

    // Greenish-tan base
    ctx.fillStyle = hexToCSS(pal.base);
    ctx.fillRect(0, 0, TS, TS);

    // Directional chevron pattern (3 chevrons pointing up)
    ctx.strokeStyle = hexToCSS(pal.stripe, 0.6);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const cy = 8 + i * 9;
      ctx.beginPath();
      ctx.moveTo(6, cy + 4);
      ctx.lineTo(TS / 2, cy);
      ctx.lineTo(TS - 6, cy + 4);
      ctx.stroke();
    }

    // Border highlight at top
    ctx.strokeStyle = hexToCSS(pal.border, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(TS, 0);
    ctx.stroke();

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateUnbuildable(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.cliff;
    const TS = TILE_SIZE;

    // Dark rocky base
    ctx.fillStyle = hexToCSS(pal.base);
    ctx.fillRect(0, 0, TS, TS);

    // Bevel: top/left light, bottom/right dark
    ctx.strokeStyle = hexToCSS(pal.highlight, 0.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, TS);
    ctx.lineTo(0, 0);
    ctx.lineTo(TS, 0);
    ctx.stroke();

    ctx.strokeStyle = hexToCSS(pal.shadow, 0.3);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(TS, 0);
    ctx.lineTo(TS, TS);
    ctx.lineTo(0, TS);
    ctx.stroke();

    // Rubble dots
    this.addNoise(ctx, pal.face, 4, [0.5, 1.5]);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateDestructible(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.rock;
    const TS = TILE_SIZE;

    // Ground underneath
    ctx.fillStyle = hexToCSS(TerrainPalette.ground.base);
    ctx.fillRect(0, 0, TS, TS);

    // Rock body (inset)
    const inset = 3;
    ctx.fillStyle = hexToCSS(pal.body);
    ctx.fillRect(inset, inset, TS - inset * 2, TS - inset * 2);
    ctx.strokeStyle = hexToCSS(pal.border);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(inset, inset, TS - inset * 2, TS - inset * 2);

    // Crack line
    ctx.strokeStyle = hexToCSS(pal.crack, 0.6);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(inset + 2, TS / 2 - 1);
    ctx.lineTo(TS / 2, TS / 2 + 2);
    ctx.lineTo(TS - inset - 2, TS / 2 - 2);
    ctx.stroke();

    // Highlight chip (top-left)
    ctx.fillStyle = hexToCSS(pal.chipLight, 0.4);
    ctx.fillRect(inset + 2, inset + 2, 4, 3);

    // Shadow chip (bottom-right)
    ctx.fillStyle = hexToCSS(pal.chipDark, 0.3);
    ctx.fillRect(TS - inset - 5, TS - inset - 4, 4, 3);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateMineralGround(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.minerals;
    const TS = TILE_SIZE;

    // Dark blue-grey ground
    ctx.fillStyle = hexToCSS(pal.ground);
    ctx.fillRect(0, 0, TS, TS);

    // Crystal dust speckle
    this.addNoise(ctx, pal.glow, 6, [0.3, 1.0]);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  private generateGasGround(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.gas;
    const TS = TILE_SIZE;

    // Dark green ground
    ctx.fillStyle = hexToCSS(pal.ground);
    ctx.fillRect(0, 0, TS, TS);

    // Subtle green glow speckle
    this.addNoise(ctx, pal.glow, 4, [0.3, 0.8]);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  // ── Cliff face textures for Task 4 ──

  generateCliffFace(direction: 'n' | 'e' | 's' | 'w'): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.cliff;
    const TS = TILE_SIZE;
    const thickness = 8;

    // Start transparent
    ctx.clearRect(0, 0, TS, TS);

    const drawCliffStrip = (sx: number, sy: number, sw: number, sh: number, shadowDir: 'h' | 'v', shadowInvert: boolean) => {
      // Rock face
      ctx.fillStyle = hexToCSS(pal.face, 0.9);
      ctx.fillRect(sx, sy, sw, sh);

      // Shadow gradient
      const grad = shadowDir === 'v'
        ? ctx.createLinearGradient(sx, sy, sx, sy + sh)
        : ctx.createLinearGradient(sx, sy, sx + sw, sy);
      if (shadowInvert) {
        grad.addColorStop(0, hexToCSS(pal.shadow, 0));
        grad.addColorStop(1, hexToCSS(pal.shadow, 0.5));
      } else {
        grad.addColorStop(0, hexToCSS(pal.shadow, 0.5));
        grad.addColorStop(1, hexToCSS(pal.shadow, 0));
      }
      ctx.fillStyle = grad;
      ctx.fillRect(sx, sy, sw, sh);

      // Highlight edge
      ctx.strokeStyle = hexToCSS(pal.highlight, 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (shadowDir === 'v') {
        const edgeY = shadowInvert ? sy : sy + sh;
        ctx.moveTo(sx, edgeY);
        ctx.lineTo(sx + sw, edgeY);
      } else {
        const edgeX = shadowInvert ? sx : sx + sw;
        ctx.moveTo(edgeX, sy);
        ctx.lineTo(edgeX, sy + sh);
      }
      ctx.stroke();
    };

    switch (direction) {
      case 'n': // High ground to south, cliff face on north side of low tile
        drawCliffStrip(0, 0, TS, thickness, 'v', false);
        break;
      case 's':
        drawCliffStrip(0, TS - thickness, TS, thickness, 'v', true);
        break;
      case 'w':
        drawCliffStrip(0, 0, thickness, TS, 'h', false);
        break;
      case 'e':
        drawCliffStrip(TS - thickness, 0, thickness, TS, 'h', true);
        break;
    }

    // Rubble dots near cliff base
    const rubbleCount = 3;
    for (let i = 0; i < rubbleCount; i++) {
      const hash = tileHash(i * 7, (direction.charCodeAt(0)) * 13 + i);
      const rx = (direction === 'w') ? thickness + 1 + (hash % 6)
               : (direction === 'e') ? TS - thickness - 2 - (hash % 6)
               : 3 + (hash % (TS - 6));
      const ry = (direction === 'n') ? thickness + 1 + ((hash >> 4) % 6)
               : (direction === 's') ? TS - thickness - 2 - ((hash >> 4) % 6)
               : 3 + ((hash >> 4) % (TS - 6));
      ctx.fillStyle = hexToCSS(pal.face, 0.4);
      ctx.beginPath();
      ctx.arc(rx, ry, 0.8 + (hash % 2) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  // ── Directional ramp textures for Task 4 ──

  generateDirectionalRamp(upDir: 'n' | 'e' | 's' | 'w'): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.ramp;
    const TS = TILE_SIZE;

    ctx.fillStyle = hexToCSS(pal.base);
    ctx.fillRect(0, 0, TS, TS);

    // Chevrons pointing uphill
    ctx.strokeStyle = hexToCSS(pal.stripe, 0.6);
    ctx.lineWidth = 1.5;

    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      switch (upDir) {
        case 'n': {
          const cy = 8 + i * 9;
          ctx.moveTo(6, cy + 4);
          ctx.lineTo(TS / 2, cy);
          ctx.lineTo(TS - 6, cy + 4);
          break;
        }
        case 's': {
          const cy = TS - 8 - i * 9;
          ctx.moveTo(6, cy - 4);
          ctx.lineTo(TS / 2, cy);
          ctx.lineTo(TS - 6, cy - 4);
          break;
        }
        case 'w': {
          const cx = 8 + i * 9;
          ctx.moveTo(cx + 4, 6);
          ctx.lineTo(cx, TS / 2);
          ctx.lineTo(cx + 4, TS - 6);
          break;
        }
        case 'e': {
          const cx = TS - 8 - i * 9;
          ctx.moveTo(cx - 4, 6);
          ctx.lineTo(cx, TS / 2);
          ctx.lineTo(cx - 4, TS - 6);
          break;
        }
      }
      ctx.stroke();
    }

    // Border on the high-ground side
    ctx.strokeStyle = hexToCSS(pal.border, 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    switch (upDir) {
      case 'n': ctx.moveTo(0, 0); ctx.lineTo(TS, 0); break;
      case 's': ctx.moveTo(0, TS); ctx.lineTo(TS, TS); break;
      case 'w': ctx.moveTo(0, 0); ctx.lineTo(0, TS); break;
      case 'e': ctx.moveTo(TS, 0); ctx.lineTo(TS, TS); break;
    }
    ctx.stroke();

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  // ── Creep textures for Task 7 ─��

  generateCreepFull(): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.creep;
    const TS = TILE_SIZE;

    ctx.clearRect(0, 0, TS, TS);

    // Vibrant purple base
    ctx.fillStyle = hexToCSS(pal.base, 0.55);
    ctx.fillRect(0, 0, TS, TS);

    // Vein details
    ctx.strokeStyle = hexToCSS(pal.veinDark, 0.35);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.quadraticCurveTo(16, 14, 30, 10);
    ctx.stroke();

    ctx.strokeStyle = hexToCSS(pal.veinLight, 0.25);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(5, 22);
    ctx.quadraticCurveTo(18, 18, 28, 24);
    ctx.stroke();

    // Speckle dots
    this.addNoise(ctx, pal.veinLight, 4, [0.3, 0.8]);

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  generateCreepEdge(dir: 'n' | 'e' | 's' | 'w'): Texture {
    const ctx = this.createCanvas();
    const pal = TerrainPalette.creep;
    const TS = TILE_SIZE;

    ctx.clearRect(0, 0, TS, TS);

    // Paint full creep first
    ctx.fillStyle = hexToCSS(pal.base, 0.55);
    ctx.fillRect(0, 0, TS, TS);

    // Organic fade-out on the edge side using bezier clip
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    const grad = (() => {
      switch (dir) {
        case 'n': return ctx.createLinearGradient(0, 0, 0, TS * 0.4);
        case 's': return ctx.createLinearGradient(0, TS, 0, TS * 0.6);
        case 'w': return ctx.createLinearGradient(0, 0, TS * 0.4, 0);
        case 'e': return ctx.createLinearGradient(TS, 0, TS * 0.6, 0);
      }
    })();
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;

    // Blobby edge using bezier curves
    ctx.beginPath();
    switch (dir) {
      case 'n':
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(8, 6, 16, 2, 24, 8);
        ctx.bezierCurveTo(28, 4, 32, 6, 32, 0);
        ctx.lineTo(0, 0);
        break;
      case 's':
        ctx.moveTo(0, TS);
        ctx.bezierCurveTo(8, TS - 6, 16, TS - 2, 24, TS - 8);
        ctx.bezierCurveTo(28, TS - 4, 32, TS - 6, 32, TS);
        ctx.lineTo(0, TS);
        break;
      case 'w':
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(6, 8, 2, 16, 8, 24);
        ctx.bezierCurveTo(4, 28, 6, 32, 0, 32);
        ctx.lineTo(0, 0);
        break;
      case 'e':
        ctx.moveTo(TS, 0);
        ctx.bezierCurveTo(TS - 6, 8, TS - 2, 16, TS - 8, 24);
        ctx.bezierCurveTo(TS - 4, 28, TS - 6, 32, TS, 32);
        ctx.lineTo(TS, 0);
        break;
    }
    ctx.fill();
    ctx.restore();

    // Veins on remaining creep area
    ctx.strokeStyle = hexToCSS(pal.veinDark, 0.25);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(8, 16);
    ctx.quadraticCurveTo(16, 20, 24, 15);
    ctx.stroke();

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  // ── Decoration textures for Task 8 ──

  generateDecoration(type: 'pebble' | 'grass_clump' | 'dirt_patch' | 'flower' | 'rock_small'): Texture {
    const size = type === 'rock_small' ? 12 : 8;
    const ctx = this.createCanvas(size, size);
    ctx.clearRect(0, 0, size, size);

    switch (type) {
      case 'pebble': {
        ctx.fillStyle = hexToCSS(0x888877, 0.6);
        ctx.beginPath();
        ctx.arc(3, 4, 1.5, 0, Math.PI * 2);
        ctx.arc(5, 3, 1.2, 0, Math.PI * 2);
        ctx.arc(4, 6, 1.0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'grass_clump': {
        const g = TerrainPalette.ground;
        ctx.strokeStyle = hexToCSS(g.tuft, 0.7);
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(2 + i * 1.5, 7);
          ctx.lineTo(1 + i * 1.5 + (i % 2), 2);
          ctx.stroke();
        }
        break;
      }
      case 'dirt_patch': {
        ctx.fillStyle = hexToCSS(TerrainPalette.ground.dirtTint, 0.3);
        ctx.beginPath();
        ctx.ellipse(4, 4, 3, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'flower': {
        const colors = [0xffdd44, 0xffffff, 0xff88aa];
        const color = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = hexToCSS(color, 0.8);
        ctx.beginPath();
        ctx.arc(4, 4, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = hexToCSS(0xffff88, 0.9);
        ctx.beginPath();
        ctx.arc(4, 4, 0.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rock_small': {
        const rp = TerrainPalette.rock;
        ctx.fillStyle = hexToCSS(rp.body, 0.5);
        ctx.beginPath();
        ctx.moveTo(2, 8);
        ctx.lineTo(4, 3);
        ctx.lineTo(9, 4);
        ctx.lineTo(10, 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = hexToCSS(rp.border, 0.3);
        ctx.lineWidth = 0.6;
        ctx.stroke();
        // Shadow
        ctx.fillStyle = hexToCSS(rp.chipDark, 0.2);
        ctx.fillRect(3, 9, 7, 2);
        break;
      }
    }

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  // ── Water transition textures for Task 9 ──

  generateTransition(fromType: 'ground' | 'cliff', toType: 'water' | 'cliff', mask: number): Texture {
    const ctx = this.createCanvas();
    const TS = TILE_SIZE;

    // Start with base terrain
    if (fromType === 'ground') {
      ctx.fillStyle = hexToCSS(TerrainPalette.ground.base);
    } else {
      ctx.fillStyle = hexToCSS(TerrainPalette.cliff.base);
    }
    ctx.fillRect(0, 0, TS, TS);

    const stripWidth = 6;

    // For each edge in the mask, paint a transition strip
    if (toType === 'water') {
      const wp = TerrainPalette.water;
      const sp = TerrainPalette.water.shore;

      // N edge (mask bit 0)
      if (mask & 1) {
        const grad = ctx.createLinearGradient(0, 0, 0, stripWidth);
        grad.addColorStop(0, hexToCSS(wp.base, 0.8));
        grad.addColorStop(0.5, hexToCSS(sp, 0.5));
        grad.addColorStop(1, hexToCSS(sp, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TS, stripWidth);
        // Foam dots
        ctx.fillStyle = hexToCSS(wp.foam, 0.3);
        ctx.beginPath();
        ctx.arc(8, 3, 1, 0, Math.PI * 2);
        ctx.arc(20, 2, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // E edge (mask bit 1)
      if (mask & 2) {
        const grad = ctx.createLinearGradient(TS, 0, TS - stripWidth, 0);
        grad.addColorStop(0, hexToCSS(wp.base, 0.8));
        grad.addColorStop(0.5, hexToCSS(sp, 0.5));
        grad.addColorStop(1, hexToCSS(sp, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(TS - stripWidth, 0, stripWidth, TS);
      }
      // S edge (mask bit 2)
      if (mask & 4) {
        const grad = ctx.createLinearGradient(0, TS, 0, TS - stripWidth);
        grad.addColorStop(0, hexToCSS(wp.base, 0.8));
        grad.addColorStop(0.5, hexToCSS(sp, 0.5));
        grad.addColorStop(1, hexToCSS(sp, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, TS - stripWidth, TS, stripWidth);
      }
      // W edge (mask bit 3)
      if (mask & 8) {
        const grad = ctx.createLinearGradient(0, 0, stripWidth, 0);
        grad.addColorStop(0, hexToCSS(wp.base, 0.8));
        grad.addColorStop(0.5, hexToCSS(sp, 0.5));
        grad.addColorStop(1, hexToCSS(sp, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, stripWidth, TS);
      }
    } else {
      // cliff transitions
      const cp = TerrainPalette.cliff;
      if (mask & 1) {
        const grad = ctx.createLinearGradient(0, 0, 0, stripWidth);
        grad.addColorStop(0, hexToCSS(cp.face, 0.6));
        grad.addColorStop(1, hexToCSS(cp.face, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, TS, stripWidth);
      }
      if (mask & 2) {
        const grad = ctx.createLinearGradient(TS, 0, TS - stripWidth, 0);
        grad.addColorStop(0, hexToCSS(cp.face, 0.6));
        grad.addColorStop(1, hexToCSS(cp.face, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(TS - stripWidth, 0, stripWidth, TS);
      }
      if (mask & 4) {
        const grad = ctx.createLinearGradient(0, TS, 0, TS - stripWidth);
        grad.addColorStop(0, hexToCSS(cp.face, 0.6));
        grad.addColorStop(1, hexToCSS(cp.face, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, TS - stripWidth, TS, stripWidth);
      }
      if (mask & 8) {
        const grad = ctx.createLinearGradient(0, 0, stripWidth, 0);
        grad.addColorStop(0, hexToCSS(cp.face, 0.6));
        grad.addColorStop(1, hexToCSS(cp.face, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, stripWidth, TS);
      }
    }

    return this.canvasToTexture(ctx.canvas as HTMLCanvasElement);
  }

  // ── Utility methods ──

  private createCanvas(w = TILE_SIZE, h = TILE_SIZE): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas.getContext('2d')!;
  }

  private canvasToTexture(canvas: HTMLCanvasElement): Texture {
    return Texture.from({ resource: canvas, antialias: false });
  }

  private addNoise(ctx: CanvasRenderingContext2D, color: number, count: number, radiusRange: [number, number]): void {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.fillStyle = hexToCSS(color, 0.3);
    for (let i = 0; i < count; i++) {
      const hash = tileHash(i * 37, i * 53);
      const nx = hash % w;
      const ny = (hash >> 8) % h;
      const r = radiusRange[0] + ((hash >> 4) % 10) / 10 * (radiusRange[1] - radiusRange[0]);
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private addGrassTufts(ctx: CanvasRenderingContext2D, count: number): void {
    const TS = ctx.canvas.width;
    ctx.strokeStyle = hexToCSS(TerrainPalette.ground.tuft, 0.5);
    ctx.lineWidth = 0.8;
    for (let t = 0; t < count; t++) {
      const hash = tileHash(t * 11, t * 17);
      const gx = 3 + (hash % (TS - 6));
      const gy = TS - 3 - ((hash >> 4) % 4);
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 1.5, gy - 4);
      ctx.moveTo(gx + 2, gy);
      ctx.lineTo(gx + 3, gy - 3.5);
      ctx.stroke();
    }
  }
}

/** Brighten a hex color by adding to each channel */
function brighten(hex: number, amount: number): number {
  const r = Math.min(255, ((hex >> 16) & 0xff) + amount);
  const g = Math.min(255, ((hex >> 8) & 0xff) + amount);
  const b = Math.min(255, (hex & 0xff) + amount);
  return (r << 16) | (g << 8) | b;
}
