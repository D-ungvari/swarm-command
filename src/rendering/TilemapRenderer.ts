import { Graphics, Container, Sprite, Texture } from 'pixi.js';
import type { Viewport } from 'pixi-viewport';
import type { MapData } from '../map/MapData';
import {
  TILE_SIZE, MAP_COLS, MAP_ROWS, TileType,
} from '../constants';
import { TerrainPalette, tileHash, varyColor, getCardinalMask } from './terrainPalette';
import type { TextureGenerator } from './TextureGenerator';

/**
 * Sprite-based tilemap renderer with viewport culling.
 * Base tiles use generated Canvas 2D textures cached as PixiJS Textures.
 * Water, creep, cliffs, and decorations use separate sprite containers.
 */
export class TilemapRenderer {
  container: Container;
  private textureGen: TextureGenerator;
  private tileContainer: Container;
  private cliffContainer: Container;
  private decorationContainer: Container;
  private creepContainer: Container;

  // Sparse arrays — only populated for visible tiles
  private tileSprites: (Sprite | null)[];
  private tileTextureKeys: string[];
  private cliffSprites: Map<number, Sprite[]> = new Map();
  private decoSprites: Map<number, Sprite> = new Map();
  private creepSprites: Map<number, Sprite> = new Map();

  // Water sprite refs for animation
  private waterSpriteIndices: number[] = [];

  // Viewport culling bounds
  private lastCullBounds = { left: -1, top: -1, right: -1, bottom: -1 };

  private mapRef: MapData | null = null;
  private lastCreepUpdate = -1;

  // Decoration textures (cached)
  private decoTextures: Texture[] = [];

  constructor(textureGen: TextureGenerator) {
    this.textureGen = textureGen;
    this.container = new Container();
    this.tileContainer = new Container();
    this.cliffContainer = new Container();
    this.decorationContainer = new Container();
    this.creepContainer = new Container();

    this.container.addChild(this.tileContainer);
    this.container.addChild(this.cliffContainer);
    this.container.addChild(this.decorationContainer);
    this.container.addChild(this.creepContainer);

    const total = MAP_COLS * MAP_ROWS;
    this.tileSprites = new Array(total).fill(null);
    this.tileTextureKeys = new Array(total).fill('ground_0');

    // Pre-generate decoration textures
    const decoTypes = ['pebble', 'grass_clump', 'dirt_patch', 'flower', 'rock_small'] as const;
    for (const t of decoTypes) {
      this.decoTextures.push(textureGen.generateDecoration(t));
    }

    // Pre-generate cliff face textures
    for (const dir of ['n', 'e', 's', 'w'] as const) {
      const key = `cliff_face_${dir}`;
      if (!textureGen.get(key) || textureGen.get(key) === Texture.WHITE) {
        // Generate and store in the texture gen cache (via get key convention)
      }
    }
  }

  /** Called once per map to compute texture keys for all tiles */
  render(map: MapData): void {
    this.mapRef = map;

    // Clear all existing sprites
    this.tileContainer.removeChildren();
    this.cliffContainer.removeChildren();
    this.decorationContainer.removeChildren();
    this.creepContainer.removeChildren();
    this.tileSprites.fill(null);
    this.cliffSprites.clear();
    this.decoSprites.clear();
    this.creepSprites.clear();
    this.waterSpriteIndices = [];
    this.lastCullBounds = { left: -1, top: -1, right: -1, bottom: -1 };
    this.lastCreepUpdate = -1;

    // Pre-generate cliff face textures if not already cached
    const cliffTextures = new Map<string, Texture>();
    for (const dir of ['n', 'e', 's', 'w'] as const) {
      cliffTextures.set(dir, this.textureGen.generateCliffFace(dir));
    }
    // Pre-generate directional ramp textures
    const rampTextures = new Map<string, Texture>();
    for (const dir of ['n', 'e', 's', 'w'] as const) {
      rampTextures.set(dir, this.textureGen.generateDirectionalRamp(dir));
    }
    // Cache them on the instance for use in updateVisibleTiles
    (this as any)._cliffTextures = cliffTextures;
    (this as any)._rampTextures = rampTextures;

    // Pre-generate transition textures (ground→water, ground→cliff) for all 15 mask variants
    const transitionTextures = new Map<string, Texture>();
    for (let mask = 1; mask <= 15; mask++) {
      transitionTextures.set(`ground_water_${mask}`, this.textureGen.generateTransition('ground', 'water', mask));
      transitionTextures.set(`ground_cliff_${mask}`, this.textureGen.generateTransition('ground', 'cliff', mask));
    }
    (this as any)._transitionTextures = transitionTextures;

    // Compute texture key for each tile
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const idx = row * MAP_COLS + col;
        const tile = map.tiles[idx] as TileType;
        const hash = tileHash(col, row);
        const variant = hash % 3;
        const elev = map.elevation[idx];

        let key: string;
        switch (tile) {
          case TileType.Water:
            key = 'water_base';
            this.waterSpriteIndices.push(idx);
            break;
          case TileType.Ground: {
            // Check for water/cliff neighbors for auto-tiling transitions
            const waterMask = getCardinalMask(map.tiles, col, row, TileType.Water);
            const cliffMask = getCardinalMask(map.tiles, col, row, TileType.Unbuildable);
            if (waterMask > 0) {
              key = `transition_ground_water_${waterMask}`;
            } else if (cliffMask > 0) {
              key = `transition_ground_cliff_${cliffMask}`;
            } else if (elev === 1) {
              key = `ground_high_${variant}`;
            } else {
              key = `ground_${variant}`;
            }
            break;
          }
          case TileType.Unbuildable:
            key = 'cliff';
            break;
          case TileType.Ramp: {
            const dir = this.getRampDirection(map, col, row);
            key = `ramp_${dir}`;
            break;
          }
          case TileType.Minerals:
            key = 'mineral_ground';
            break;
          case TileType.Gas:
            key = 'gas_ground';
            break;
          case TileType.Destructible:
            key = 'rock';
            break;
          default:
            key = `ground_${variant}`;
        }
        this.tileTextureKeys[idx] = key;
      }
    }
  }

  /** Called each frame to create/destroy sprites based on viewport bounds */
  updateVisibleTiles(viewport: Viewport): void {
    if (!this.mapRef) return;

    const left = Math.max(0, Math.floor(viewport.left / TILE_SIZE) - 2);
    const top = Math.max(0, Math.floor(viewport.top / TILE_SIZE) - 2);
    const right = Math.min(MAP_COLS - 1, Math.ceil((viewport.left + viewport.screenWidthInWorldPixels) / TILE_SIZE) + 2);
    const bottom = Math.min(MAP_ROWS - 1, Math.ceil((viewport.top + viewport.screenHeightInWorldPixels) / TILE_SIZE) + 2);

    // Skip if bounds haven't changed
    if (left === this.lastCullBounds.left && top === this.lastCullBounds.top &&
        right === this.lastCullBounds.right && bottom === this.lastCullBounds.bottom) return;

    const oldBounds = this.lastCullBounds;
    this.lastCullBounds = { left, top, right, bottom };

    // Remove sprites outside new bounds
    if (oldBounds.left >= 0) {
      for (let r = oldBounds.top; r <= oldBounds.bottom; r++) {
        for (let c = oldBounds.left; c <= oldBounds.right; c++) {
          if (r >= top && r <= bottom && c >= left && c <= right) continue;
          const idx = r * MAP_COLS + c;
          this.removeTileSprite(idx);
          this.removeCliffSprites(idx);
          this.removeDecoSprite(idx);
        }
      }
    }

    // Add sprites for newly visible tiles
    const map = this.mapRef;
    const cliffTextures = (this as any)._cliffTextures as Map<string, Texture>;
    const rampTextures = (this as any)._rampTextures as Map<string, Texture>;
    const transitionTextures = (this as any)._transitionTextures as Map<string, Texture>;

    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const idx = r * MAP_COLS + c;

        // Base tile sprite
        if (!this.tileSprites[idx]) {
          const key = this.tileTextureKeys[idx];
          let texture: Texture;

          if (key.startsWith('ramp_')) {
            const dir = key.slice(5) as 'n' | 'e' | 's' | 'w';
            texture = rampTextures.get(dir) ?? this.textureGen.get('ramp');
          } else if (key.startsWith('transition_')) {
            // e.g. transition_ground_water_5
            const transKey = key.slice(11); // ground_water_5
            texture = transitionTextures.get(transKey) ?? this.textureGen.get('ground_0');
          } else {
            texture = this.textureGen.get(key);
          }

          const sprite = new Sprite(texture);
          sprite.x = c * TILE_SIZE;
          sprite.y = r * TILE_SIZE;
          this.tileContainer.addChild(sprite);
          this.tileSprites[idx] = sprite;
        }

        // Cliff face overlays (Task 4)
        if (!this.cliffSprites.has(idx)) {
          const elev = map.elevation[idx];
          const tile = map.tiles[idx] as TileType;
          // Low-ground tile adjacent to high ground → cliff face
          if (elev === 0 && tile !== TileType.Water) {
            const cliffDirs: Sprite[] = [];
            const dirs: [number, number, 'n' | 'e' | 's' | 'w'][] = [
              [0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w'],
            ];
            for (const [dc, dr, dir] of dirs) {
              const nc = c + dc;
              const nr = r + dr;
              if (nc < 0 || nc >= MAP_COLS || nr < 0 || nr >= MAP_ROWS) continue;
              const nIdx = nr * MAP_COLS + nc;
              const nElev = map.elevation[nIdx];
              const nTile = map.tiles[nIdx] as TileType;
              if (nElev === 1 && nTile !== TileType.Ramp) {
                const cSprite = new Sprite(cliffTextures.get(dir)!);
                cSprite.x = c * TILE_SIZE;
                cSprite.y = r * TILE_SIZE;
                this.cliffContainer.addChild(cSprite);
                cliffDirs.push(cSprite);
              }
            }
            if (cliffDirs.length > 0) {
              this.cliffSprites.set(idx, cliffDirs);
            }
          }
        }

        // Decorations (Task 8) — only on walkable ground tiles
        if (!this.decoSprites.has(idx)) {
          const tile = map.tiles[idx] as TileType;
          if (tile === TileType.Ground) {
            const hash = tileHash(c, r);
            // ~15% of ground tiles get a decoration
            if (hash % 7 === 0) {
              // Check not near resources (within 2 tiles)
              if (!this.isNearResource(map, c, r)) {
                const decoType = hash % this.decoTextures.length;
                const dSprite = new Sprite(this.decoTextures[decoType]);
                dSprite.anchor.set(0.5, 0.5);
                dSprite.x = c * TILE_SIZE + TILE_SIZE / 2 + ((hash >> 4) % 12) - 6;
                dSprite.y = r * TILE_SIZE + TILE_SIZE / 2 + ((hash >> 8) % 12) - 6;
                dSprite.rotation = ((hash >> 12) % 4) * Math.PI / 2;
                dSprite.alpha = 0.7 + ((hash >> 16) % 3) * 0.1;
                this.decorationContainer.addChild(dSprite);
                this.decoSprites.set(idx, dSprite);
              }
            }
          }
        }
      }
    }
  }

  /** Animate water tiles via tint/alpha modulation (GPU-side, no geometry rebuild) */
  updateWater(gameTime: number): void {
    for (const idx of this.waterSpriteIndices) {
      const sprite = this.tileSprites[idx];
      if (!sprite) continue;
      const col = idx % MAP_COLS;
      const row = Math.floor(idx / MAP_COLS);

      // Wave highlight
      const phase = (col * 0.7 + row * 0.5) + gameTime * 1.5;
      const pulse = 0.85 + 0.1 * Math.sin(phase);
      sprite.alpha = pulse;

      // Tint modulation between base and wave color
      const t = 0.5 + 0.15 * Math.sin(phase);
      sprite.tint = lerpColor(TerrainPalette.water.base, TerrainPalette.water.wave, t);
    }
  }

  /** Rebuild creep sprites when creepMap changes */
  updateCreep(map: MapData, gameTime: number): void {
    const bucket = Math.floor(gameTime / 5);
    if (bucket === this.lastCreepUpdate) {
      // Still animate existing creep sprites each frame
      this.animateCreep(gameTime);
      return;
    }
    this.lastCreepUpdate = bucket;

    // Clear existing creep sprites
    this.creepContainer.removeChildren();
    this.creepSprites.clear();

    // Generate creep textures on first use
    if (!(this as any)._creepFullTex) {
      (this as any)._creepFullTex = this.textureGen.generateCreepFull();
      (this as any)._creepEdgeTex = new Map<string, Texture>();
      for (const dir of ['n', 'e', 's', 'w'] as const) {
        (this as any)._creepEdgeTex.set(dir, this.textureGen.generateCreepEdge(dir));
      }
    }

    const fullTex = (this as any)._creepFullTex as Texture;
    const edgeTex = (this as any)._creepEdgeTex as Map<string, Texture>;

    // Only create sprites within current viewport
    const b = this.lastCullBounds;
    if (b.left < 0) return;

    for (let r = b.top; r <= b.bottom; r++) {
      for (let c = b.left; c <= b.right; c++) {
        const idx = r * MAP_COLS + c;
        if (map.creepMap[idx] !== 1) continue;

        // Check which neighbors don't have creep to determine edge type
        const mask = getCardinalMask(map.creepMap, c, r, 1);
        let tex: Texture;

        if (mask === 15) {
          // All 4 cardinal neighbors have creep → full tile
          tex = fullTex;
        } else {
          // Missing at least one neighbor — use edge texture for the first missing direction
          // For simplicity, use the first missing cardinal direction
          if (!(mask & 1)) tex = edgeTex.get('n')!;
          else if (!(mask & 2)) tex = edgeTex.get('e')!;
          else if (!(mask & 4)) tex = edgeTex.get('s')!;
          else tex = edgeTex.get('w')!;
        }

        const sprite = new Sprite(tex);
        sprite.x = c * TILE_SIZE;
        sprite.y = r * TILE_SIZE;
        sprite.alpha = 0.55;
        this.creepContainer.addChild(sprite);
        this.creepSprites.set(idx, sprite);
      }
    }

    this.animateCreep(gameTime);
  }

  // ── Private helpers ──

  private animateCreep(gameTime: number): void {
    for (const [idx, sprite] of this.creepSprites) {
      const col = idx % MAP_COLS;
      const row = Math.floor(idx / MAP_COLS);
      const pulse = 0.5 + 0.08 * Math.sin(gameTime * 0.5 + tileHash(col, row) * 0.01);
      sprite.alpha = pulse;
    }
  }

  private removeTileSprite(idx: number): void {
    const sprite = this.tileSprites[idx];
    if (sprite) {
      this.tileContainer.removeChild(sprite);
      sprite.destroy();
      this.tileSprites[idx] = null;
    }
  }

  private removeCliffSprites(idx: number): void {
    const sprites = this.cliffSprites.get(idx);
    if (sprites) {
      for (const s of sprites) {
        this.cliffContainer.removeChild(s);
        s.destroy();
      }
      this.cliffSprites.delete(idx);
    }
  }

  private removeDecoSprite(idx: number): void {
    const sprite = this.decoSprites.get(idx);
    if (sprite) {
      this.decorationContainer.removeChild(sprite);
      sprite.destroy();
      this.decoSprites.delete(idx);
    }
  }

  private getRampDirection(map: MapData, col: number, row: number): 'n' | 'e' | 's' | 'w' {
    // Find which cardinal neighbor is high-ground
    const dirs: [number, number, 'n' | 'e' | 's' | 'w'][] = [
      [0, -1, 'n'], [1, 0, 'e'], [0, 1, 's'], [-1, 0, 'w'],
    ];
    for (const [dc, dr, dir] of dirs) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= MAP_COLS || nr < 0 || nr >= MAP_ROWS) continue;
      if (map.elevation[nr * MAP_COLS + nc] === 1) return dir;
    }
    return 'n'; // fallback
  }

  private isNearResource(map: MapData, col: number, row: number): boolean {
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nc >= MAP_COLS || nr < 0 || nr >= MAP_ROWS) continue;
        const t = map.tiles[nr * MAP_COLS + nc] as TileType;
        if (t === TileType.Minerals || t === TileType.Gas) return true;
      }
    }
    return false;
  }
}

/** Linearly interpolate between two hex colors */
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bv;
}
