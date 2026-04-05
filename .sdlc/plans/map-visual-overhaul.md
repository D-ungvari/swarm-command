---
scope: Map Visual Overhaul — Carbot-Inspired Vibrant Terrain with Procedural Texture Pipeline
created: 2026-04-05
backlog_items: new (map visual overhaul)
task_count: 10
status: READY
---

# Ultraplan: Map Visual Overhaul

## Vision Alignment

Swarm Command is a portfolio piece targeting Copenhagen full-stack employers. The map is the canvas everything sits on — it's the first and most persistent visual impression. Right now the terrain is near-black (`0x2a2a1a` ground), elevation is barely visible (5% alpha white overlay), and ramps/cliffs are almost impossible to distinguish from flat ground. The reference target is StarCraft Cartooned (Carbot) — bright, vibrant, high-contrast terrain where every terrain type pops and strategic features (ramps, cliffs, water, resources) are instantly readable.

This plan builds a **procedural texture generation pipeline** — TypeScript code that paints rich Canvas 2D textures at startup, caches them as PixiJS Textures, and renders the tilemap as Sprites instead of raw Graphics primitives. No external art files needed. The result: a dramatic visual transformation that's infinitely tweakable in code and a great portfolio talking point.

## Visual Design Target (from Carbot SC Reference)

| Feature | Current | Target |
|---------|---------|--------|
| Ground | Near-black `0x2a2a1a`, flat | Lush green grass / warm brown dirt, textured with speckle/noise |
| Elevation | 5% alpha white overlay, invisible | Visible cliff faces with shadow, clear height steps |
| Ramps | Diagonal stripes `0x4a4a38`, hard to spot | Distinct ramp texture with directional indicators |
| Water | Dark blue `0x0a2244`, subtle waves | Bright clear blue, animated ripples, visible shore blend |
| Cliffs | 2px dark line, 1px highlight | Thick cliff face with shadow casting, rocky texture |
| Minerals | Small diamonds, dark background | Chunky bright cyan crystals with glow aura |
| Gas | Dark vent ring | Bright green glow, pulsing vent, visible steam |
| Creep | 15% alpha flat purple | Vibrant purple with organic blobby edges |
| Transitions | 4px colored edge strips | Smooth organic blends between terrain types |
| Decorations | 2-3 grass tufts per tile | Rich scatter layer: rocks, grass tufts, pebbles, terrain detail |

## Scope Summary

- **Items planned:** 1 major feature (Map Visual Overhaul)
- **Tasks generated:** 10
- **Estimated total size:** 2S + 6M + 1L + 1S = ~2400 lines new/modified
- **Critical path:** Task 1 (Palette) + Task 2 (Texture Generator) → Task 3 (TilemapRenderer Switchover) → Tasks 4-8 (parallel visual upgrades) → Task 9 (Minimap) → Task 10 (Performance)
- **New patterns needed:** Canvas 2D texture generation, Sprite-based tilemap, neighbor bitmask utility

## Dependency Graph

```
Task 1: Color Palette Module ──────────────────────────────────┐
                                                                │
Task 2: Texture Generation System ─┬───────────────────────────┤
                                   │                            │
                                   v                            v
              Task 3: TilemapRenderer Switchover (Graphics → Sprites)
                     │
                     ├──→ Task 4: Elevation & Cliff Overhaul
                     ├──→ Task 5: Mineral & Gas Visual Upgrade
                     ├──→ Task 6: Water Overhaul
                     ├──→ Task 7: Creep Visual Upgrade
                     ├──→ Task 8: Map Decoration System
                     │
                     v (after 4-8 stabilize)
              Task 9: Auto-Tiling Terrain Transitions (L)
                     │
                     v
              Task 10: Minimap Sync + Performance Pass
```

## Execution Order

| # | Task | Size | Depends on | Summary |
|---|------|------|-----------|---------|
| 1 | Color Palette Module | S | — | Centralized bright terrain palette replacing scattered hex values |
| 2 | Texture Generation System | M | — | Canvas 2D → PixiJS Texture pipeline with tile texture generators |
| 3 | TilemapRenderer Switchover | M | 1, 2 | Replace Graphics drawing with Sprite-based tiles using generated textures |
| 4 | Elevation & Cliff Overhaul | M | 3 | Visible cliff faces, shadow casting, ramp indicators |
| 5 | Mineral & Gas Visual Upgrade | M | 3 | Bright chunky crystals, glow aura, pulsing gas |
| 6 | Water Overhaul | M | 3 | Animated bright blue water, shore blending |
| 7 | Creep Visual Upgrade | M | 3 | Vibrant purple creep with organic blobby edges |
| 8 | Map Decoration System | S | 3 | Scatter layer: rocks, grass tufts, pebbles, terrain details |
| 9 | Auto-Tiling Terrain Transitions | L | 3 | Neighbor-aware bitmask tile selection for smooth terrain blending |
| 10 | Minimap Sync + Performance Pass | M | 4-9 | Update minimap colors, viewport culling, texture atlas audit |

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| 16K Sprite objects may exceed batch limits | HIGH | Viewport culling — only render visible tiles (~400-600 at typical zoom). FogRenderer already demonstrates this pattern. |
| Canvas 2D texture generation slow at startup | MED | Generate textures async during loading screen. Total: ~50 unique textures × ~1ms each = <100ms. |
| Color palette change makes existing fog/selection/UI look wrong | MED | Task 1 updates all terrain colors in one pass. UI colors (HUD, info panel) are separate and unaffected. |
| Auto-tiling (Task 9) is complex — 16 variants per terrain type | MED | Do auto-tiling LAST. The game looks dramatically better after Tasks 1-8 even without smooth transitions. Task 9 is polish, not foundation. |
| Procedural textures look "programmer art" | MED | Focus on noise/speckle patterns, color variation, and contrast. The Carbot style is inherently simple — solid colors with texture detail, not photorealism. |
| Water animation performance regression (Sprites vs Graphics redraw) | LOW | Sprite tint/alpha animation is GPU-side, faster than Graphics geometry rebuild per frame. |

---

## Task Specs

---

### Task 1: Color Palette Module
**Parent:** Map Visual Overhaul
**Size:** S
**Depends on:** none
**Unblocks:** Tasks 2-10

#### Goal
Create a centralized terrain color palette module replacing the ~30 scattered hardcoded hex values across TilemapRenderer, MinimapRenderer, and constants.ts. Transform the palette from dark/muted to bright/vibrant Carbot-inspired colors.

#### Prerequisites
None — foundational task.

#### Changes (in execution order)

**Step 1: Create terrain palette module**
- File: `src/rendering/terrainPalette.ts` (NEW)
- Change: Create a `TerrainPalette` object with all terrain colors organized by tile type:
  ```typescript
  export const TerrainPalette = {
    ground: {
      base: 0x5aa830,        // Lush green (was 0x2a2a1a)
      grassTint: 0x66bb33,   // Grass overlay
      dirtTint: 0x8b7355,    // Dirt/brown variant
      dirtBase: 0x9b8465,    // Dirt-dominant ground
      noise: 0x4a9025,       // Speckle dots
      noiseDark: 0x3d7a1e,   // Dark speckle
      tuft: 0x3d8820,        // Grass tuft strokes
    },
    water: {
      base: 0x2288dd,        // Bright blue (was 0x0a2244)
      deep: 0x1166aa,        // Deep water tint
      wave: 0x44aaff,        // Wave highlight
      waveSecondary: 0x3399ee, // Secondary wave
      foam: 0xccddee,        // Shore foam
      shore: 0x88aa66,       // Shore-land transition
    },
    cliff: {
      face: 0x665544,        // Cliff wall color
      shadow: 0x3a2a1a,      // Cliff shadow
      highlight: 0xaa9977,   // Cliff top edge highlight
      base: 0x554433,        // Unbuildable ground
    },
    ramp: {
      base: 0x8b9955,        // Ramp ground (distinct greenish-tan)
      stripe: 0x99aa66,      // Directional stripe
      border: 0xaabb77,      // Ramp edge highlight
    },
    minerals: {
      crystal: 0x55ddff,     // Bright cyan crystal (was 0x44bbff)
      highlight: 0xbbeeFF,   // Crystal facet highlight
      sparkle: 0xffffff,     // Sparkle dot
      ground: 0x335566,      // Ground under minerals
      glow: 0x44ccee,        // Glow aura
    },
    gas: {
      vent: 0x55cc55,        // Vent ring
      glow: 0x66ff88,        // Inner glow (was 0x44ff66)
      center: 0xccffdd,      // Bright center
      steam: 0xaaffbb,       // Steam wisp
      ground: 0x3a553a,      // Ground under gas
    },
    rock: {
      body: 0x998877,        // Rock fill (was 0x888070 — brighter now)
      border: 0x776655,      // Rock outline
      crack: 0x554433,       // Crack line
      chipLight: 0xbbaa99,   // Highlight chip
      chipDark: 0x443322,    // Shadow chip
    },
    creep: {
      base: 0xaa55cc,        // Vibrant purple (was 0x6600aa)
      veinDark: 0x8833aa,    // Vein darker
      veinLight: 0x9944bb,   // Vein lighter
      edge: 0x7722aa,        // Edge blend
    },
    elevation: {
      highOverlay: 0xffffff, // High-ground brightness (alpha increased)
      highAlpha: 0.12,       // Was 0.05 — now actually visible
      rampTopAlpha: 0.08,    // Was 0.04
      rampBottomAlpha: 0.06, // Was 0.04
    },
    grid: {
      line: 0x000000,        // Grid line between tiles
      lineAlpha: 0.03,       // Was 0.015 — slightly more visible
    },
  } as const;
  ```
- Why: Single source of truth for all terrain visuals. Every other task references this palette.

**Step 2: Update constants.ts color exports**
- File: `src/constants.ts`
- Change: Update `GROUND_COLOR`, `WATER_COLOR`, `UNBUILDABLE_COLOR`, `ROCK_COLOR`, `MINERAL_COLOR`, `GAS_COLOR` to match the new palette values. Keep the exports for backward compatibility (other files import them), but their values change.
- Pattern: Constants at lines 43-52
- Why: MinimapRenderer and UnitRenderer import these constants directly.

**Step 3: Export shared tileHash utility**
- File: `src/rendering/terrainPalette.ts`
- Change: Export the `tileHash(col, row)` function currently defined at TilemapRenderer.ts:470-472. Also export a `varyColor(base, col, row, range)` utility for per-tile color variation.
- Why: Tasks 2, 7, 8 all need deterministic per-tile randomization. Currently it's file-local in TilemapRenderer.

**Step 4: Export neighbor mask utility**
- File: `src/rendering/terrainPalette.ts`
- Change: Add `getCardinalMask(tiles: Uint8Array, col: number, row: number, matchTileType: number): number` — returns a 4-bit bitmask (N=1, E=2, S=4, W=8) indicating which cardinal neighbors match the given tile type. Also add `get8Mask()` for 8-directional (adds NE=16, SE=32, SW=64, NW=128).
- Why: Tasks 4 (elevation edges), 7 (creep edges), 9 (auto-tiling) all need neighbor analysis. Currently duplicated in `drawTransitions()` and `drawElevationEdges()`.

#### Edge cases
- Other files importing old color constants (`GROUND_COLOR` etc.) get the new bright values automatically — no code change needed in those files.
- `MapEditor.ts` has hardcoded CSS color strings (lines 49-56) — update those too.

#### NOT in scope
- Changing UI panel colors (those are in the ui-look-and-feel plan)
- Changing unit rendering colors (faction colors stay the same)

#### Acceptance criteria
- [ ] `terrainPalette.ts` exists with complete palette, tileHash, varyColor, getCardinalMask exports
- [ ] `constants.ts` color exports updated to bright values
- [ ] All terrain colors come from one centralized source
- [ ] Minimap immediately looks brighter (it reads constants directly)
- [ ] Type-check passes clean
- [ ] Existing tests still pass

#### Test plan
- `npm run build` succeeds
- `npm test` passes
- Visual: launch game, minimap terrain should already look brighter

---

### Task 2: Texture Generation System
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Task 1 (palette)
**Unblocks:** Task 3

#### Goal
Create a `TextureGenerator` module that produces 32x32 tile textures using Canvas 2D, cached as PixiJS `Texture` objects. Each tile type gets a richly painted texture with noise, speckle, and color variation — replacing the flat `rect()` fills currently used.

#### Prerequisites
- Task 1 complete (palette colors available)
- PixiJS v8 `Texture` and `Sprite` imports (not currently used in codebase — new)

#### Changes (in execution order)

**Step 1: Create TextureGenerator module**
- File: `src/rendering/TextureGenerator.ts` (NEW)
- Change: Create class with these methods:
  ```typescript
  export class TextureGenerator {
    private cache = new Map<string, Texture>();

    // Generate all tile textures at startup
    generateAll(): void;

    // Get cached texture by key
    get(key: string): Texture;

    // Individual generators
    private generateGround(variant: number): Texture;    // 3 variants (grass, dirt, mixed)
    private generateWater(): Texture;
    private generateRamp(): Texture;
    private generateUnbuildable(): Texture;
    private generateDestructible(): Texture;
    private generateMineralGround(): Texture;
    private generateGasGround(): Texture;

    // Utility
    private createCanvas(width?: number, height?: number): CanvasRenderingContext2D;
    private canvasToTexture(canvas: HTMLCanvasElement): Texture;
    private addNoise(ctx: CanvasRenderingContext2D, color: number, count: number, radiusRange: [number, number]): void;
    private addGrassTufts(ctx: CanvasRenderingContext2D, count: number): void;
  }
  ```
- Why: Foundational infrastructure for the entire visual overhaul.

**Step 2: Implement Canvas → Texture pipeline**
- File: `src/rendering/TextureGenerator.ts`
- Change: Implement `createCanvas()` and `canvasToTexture()`:
  ```typescript
  private createCanvas(w = TILE_SIZE, h = TILE_SIZE): CanvasRenderingContext2D {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    return canvas.getContext('2d')!;
  }

  private canvasToTexture(canvas: HTMLCanvasElement): Texture {
    return Texture.from(canvas);
  }
  ```
- Pattern: PixiJS v8 `Texture.from(canvas)` creates a texture from any canvas element.
- Why: This is the bridge between Canvas 2D painting and PixiJS rendering.

**Step 3: Implement ground texture generator**
- File: `src/rendering/TextureGenerator.ts`
- Change: `generateGround(variant)` creates a 32x32 canvas and paints:
  - **Base fill**: Palette ground color with per-tile variation (±8 per channel using tileHash)
  - **Variant 0 (grass-dominant)**: Green tint overlay, 3-5 grass tuft strokes (short curved lines in tuft color)
  - **Variant 1 (dirt-dominant)**: Brown tint overlay, 1-2 subtle crack lines
  - **Variant 2 (mixed)**: Both grass and dirt details, blended
  - **Noise layer**: 4-8 small speckle dots (radius 0.5-1.5px) in noise colors
  - Total: 3 variant textures cached as `ground_0`, `ground_1`, `ground_2`
- Why: Ground is 80%+ of visible terrain — this single generator has the most visual impact.

**Step 4: Implement remaining tile type generators**
- File: `src/rendering/TextureGenerator.ts`
- Change: Implement generators for each remaining tile type:
  - `generateWater()`: Blue base, subtle depth gradient, 3-4 small wave highlight dots. Key: `water_base`
  - `generateRamp()`: Greenish-tan base, directional chevron/arrow pattern (3 parallel lines angled 30°, brighter than base). Key: `ramp`
  - `generateUnbuildable()`: Dark rocky base, 4-edge bevel (top/left light, bottom/right dark), small rubble dots. Key: `cliff`
  - `generateDestructible()`: Rock body fill, single crack line (random direction via hash), highlight/shadow chips. Key: `rock`
  - `generateMineralGround()`: Dark blue-grey ground underneath mineral crystals. Key: `mineral_ground`
  - `generateGasGround()`: Dark green ground underneath gas vents. Key: `gas_ground`
- Why: Each tile type needs its own rich texture.

**Step 5: Implement generateAll() and integrate into Game.ts**
- File: `src/rendering/TextureGenerator.ts` — implement `generateAll()` that calls all generators and populates cache.
- File: `src/Game.ts` — instantiate `TextureGenerator` during init (before TilemapRenderer), call `generateAll()`, pass to TilemapRenderer.
- Pattern: Add to init sequence after PixiJS app init, before renderer creation.
- Why: Textures must be generated before any renderer tries to use them.

#### Edge cases
- Canvas 2D not available: Won't happen in any modern browser that supports WebGL2 (which PixiJS v8 requires).
- DPI scaling: Generate at TILE_SIZE (32px) — PixiJS handles DPI via resolution setting.
- Memory: ~10 unique textures × 32x32x4 bytes = ~40KB total. Negligible.

#### NOT in scope
- Auto-tiling transition variants (Task 9)
- Elevation-aware texture variants (Task 4 handles elevation overlay)
- Water animation (Task 6 — water base texture is static, animation is tint/alpha)

#### Acceptance criteria
- [ ] `TextureGenerator` class exists with `generateAll()` and `get(key)` methods
- [ ] Ground generates 3 variants with visible grass/dirt/mixed patterns
- [ ] All 7 tile types have generated textures
- [ ] `Texture.from(canvas)` produces valid PixiJS Textures
- [ ] TextureGenerator instantiated in Game.ts init
- [ ] Type-check passes clean

#### Test plan
- `npm run build` succeeds
- Manual: Add temporary debug code to render a Sprite with each texture to verify they look correct
- `npm test` passes

#### Risk notes
- PixiJS v8's `Texture.from(canvas)` API — verify exact import path. In v8 it may be `Texture.from({ resource: canvas })` or `Texture.from(canvas)`. Check pixi.js v8 docs.

---

### Task 3: TilemapRenderer Switchover (Graphics → Sprites)
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Tasks 1, 2
**Unblocks:** Tasks 4-9

#### Goal
Replace the current `staticGraphics` approach (single Graphics object drawing 16K rectangles) with a Sprite-based tilemap where each visible tile is a Sprite using a generated texture. This is the core architectural switchover — everything downstream builds on this.

#### Prerequisites
- Task 1 (palette) and Task 2 (TextureGenerator) complete
- Generated textures available via `textureGen.get(key)`

#### Changes (in execution order)

**Step 1: Add Sprite pool and viewport culling infrastructure**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Add properties:
  ```typescript
  private textureGen: TextureGenerator;
  private tileSprites: (Sprite | null)[];  // sparse — only populated for visible tiles
  private tileContainer: Container;        // replaces staticGraphics for tiles
  private lastCullBounds = { left: -1, top: -1, right: -1, bottom: -1 };
  ```
- Change constructor to accept `TextureGenerator` instance.
- Why: Sprites need a container, and viewport culling needs bounds tracking.

**Step 2: Replace static tile drawing with Sprite creation**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Replace the `render(map)` method's tile-by-tile Graphics drawing loop (lines 39-267) with:
  1. For each tile in the map, determine the texture key based on `tiles[idx]` and `tileHash(col, row) % 3` for ground variant
  2. Store the mapping: `this.tileTextureKeys[idx] = key`
  3. Do NOT create Sprites for all 16K tiles — only create them on demand in `updateVisibleTiles()`
- Why: Creating 16K Sprites upfront wastes memory. Viewport culling creates only what's visible.

**Step 3: Implement viewport culling**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Add `updateVisibleTiles(viewport)` method called each frame:
  ```typescript
  updateVisibleTiles(viewport: Viewport): void {
    const left = Math.max(0, Math.floor(viewport.left / TILE_SIZE) - 1);
    const top = Math.max(0, Math.floor(viewport.top / TILE_SIZE) - 1);
    const right = Math.min(MAP_COLS - 1, Math.ceil(viewport.right / TILE_SIZE) + 1);
    const bottom = Math.min(MAP_ROWS - 1, Math.ceil(viewport.bottom / TILE_SIZE) + 1);

    // Skip if bounds haven't changed
    if (left === this.lastCullBounds.left && ...) return;

    // Remove sprites outside new bounds
    // Add sprites for newly visible tiles
    for (let r = top; r <= bottom; r++) {
      for (let c = left; c <= right; c++) {
        const idx = r * MAP_COLS + c;
        if (!this.tileSprites[idx]) {
          const key = this.tileTextureKeys[idx];
          const sprite = new Sprite(this.textureGen.get(key));
          sprite.x = c * TILE_SIZE;
          sprite.y = r * TILE_SIZE;
          this.tileContainer.addChild(sprite);
          this.tileSprites[idx] = sprite;
        }
      }
    }
    this.lastCullBounds = { left, top, right, bottom };
  }
  ```
- Pattern: FogRenderer.ts lines 41-44 already implements viewport culling with the same bounds computation.
- Why: Only ~400-600 tiles visible at typical zoom. Creating/destroying Sprites as camera moves.

**Step 4: Remove old Graphics drawing code**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Remove the old `staticGraphics` object and all inline drawing code (the massive tile-by-tile loop in `render()` that draws ground, minerals, gas, ramps, rocks with Graphics primitives). Keep `waterGraphics` and `creepGraphics` for now (Tasks 6 and 7 will upgrade those).
- Why: The old code is replaced by Sprite-based rendering.

**Step 5: Wire into Game.ts render loop**
- File: `src/Game.ts`
- Change: In the render section of the game loop, call `tilemapRenderer.updateVisibleTiles(this.viewport)` before other renderers.
- Pass TextureGenerator to TilemapRenderer constructor.
- Why: Viewport culling must update each frame as camera moves.

**Step 6: Keep transition and elevation edge drawing temporarily**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Keep `drawTransitions()` and `drawElevationEdges()` functions as a separate Graphics overlay on top of the Sprite tiles. They'll be replaced by Tasks 4 and 9, but keeping them prevents visual regression during the switchover.
- Add a `overlayGraphics` Graphics object for these temporary overlays.
- Why: Don't regress elevation/transition visuals while switching the base tile system.

#### Edge cases
- Zoom all the way out: At min zoom, all 16K tiles could be visible. Cap sprite creation at a reasonable limit (~2000) or increase min zoom slightly.
- Rapid camera panning: Don't remove sprites immediately when they go off-screen — keep a 2-tile margin to avoid flicker during fast pans.
- Map reload (new game): Clear all sprites and recreate texture keys.

#### NOT in scope
- Replacing water animation (Task 6)
- Replacing creep overlay (Task 7)
- Auto-tiling transitions (Task 9)

#### Acceptance criteria
- [ ] Tilemap renders using Sprites with generated textures instead of Graphics primitives
- [ ] Viewport culling — only visible tiles have Sprites
- [ ] Camera pan/zoom works smoothly with tile creation/destruction
- [ ] Ground shows 3 visual variants (grass, dirt, mixed) — clearly different from old dark tiles
- [ ] All 7 tile types render with correct textures
- [ ] Water and creep overlays still work (kept as Graphics)
- [ ] Elevation edges and transitions still visible (kept as Graphics overlay)
- [ ] No visible gaps or flickering during camera movement
- [ ] Type-check passes clean
- [ ] Existing tests pass

#### Test plan
- Manual: Launch game, verify terrain is bright and textured
- Manual: Pan camera in all directions, verify no gaps appear
- Manual: Zoom in/out, verify tiles render correctly at all zoom levels
- Manual: Start new game with different map, verify all 10 maps render
- `npm test` passes
- `npm run build` succeeds

#### Risk notes
- Sprite pool management is the highest-risk part. If sprites aren't cleaned up properly, memory will grow. Track active sprite count and log warnings if it exceeds 2000.
- `Texture.from(canvas)` creates a unique texture per canvas. Since we cache textures in TextureGenerator, all sprites of the same type share the same Texture object — GPU memory is minimal.

---

### Task 4: Elevation & Cliff Overhaul
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Task 3
**Unblocks:** Task 10

#### Goal
Make elevation immediately visible. Replace the current 2px dark lines with thick, textured cliff faces that cast visible shadows. Ramps should be obviously different from flat ground. A player should instantly see "that's high ground, that's a ramp, that's low ground" without any ambiguity.

#### Prerequisites
- Task 3 complete (Sprite-based tilemap working)
- Palette elevation colors available (Task 1)

#### Changes (in execution order)

**Step 1: Generate cliff face textures**
- File: `src/rendering/TextureGenerator.ts`
- Change: Add cliff face texture generators for each cardinal direction (N, E, S, W):
  - Each is a 32x32 texture with a rocky cliff face on the appropriate edge
  - **North cliff** (high ground to the south, low ground here): dark rocky strip (8px tall) on the south edge of the tile, with shadow gradient fading upward (4px, dark to transparent)
  - **East/South/West**: Same concept, rotated
  - Colors: `cliff.face` for rock, `cliff.shadow` for shadow, `cliff.highlight` for top edge
  - Add small rubble/pebble dots at cliff base
- Keys: `cliff_face_n`, `cliff_face_e`, `cliff_face_s`, `cliff_face_w`
- Why: Cliff faces need to be thick and visible, not just 2px lines.

**Step 2: Generate high-ground overlay texture**
- File: `src/rendering/TextureGenerator.ts`
- Change: Generate a subtle brightness overlay texture (32x32, white with alpha 0.12). Also generate a distinct ground variant for high-ground tiles — slightly lighter/brighter grass.
- Keys: `high_ground_overlay`, `ground_high_0`, `ground_high_1`, `ground_high_2`
- Why: High ground should be noticeably brighter than low ground — not just 5% brighter.

**Step 3: Generate ramp texture with directional indicator**
- File: `src/rendering/TextureGenerator.ts`
- Change: Update/enhance the ramp texture:
  - Greenish-tan base color (distinct from both grass green and cliff gray)
  - 3 chevron/arrow marks pointing uphill (determined by which neighbor is high-ground)
  - Subtle directional stripes following the ramp direction
- Keys: `ramp_n`, `ramp_e`, `ramp_s`, `ramp_w` (direction = which way is "up")
- Why: Ramps in the current game are nearly invisible. In SC2, ramps are a critical strategic feature.

**Step 4: Replace elevation edge drawing**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Remove `drawElevationEdges()` (lines 412-452) and the corresponding overlay Graphics calls. Replace with:
  - During `render(map)`, for each tile with elevation 0 adjacent to elevation 1:
    - Create an additional Sprite with the cliff face texture for the correct direction
    - Add to a `cliffContainer` (rendered between tile layer and unit layer)
  - For each high-ground tile (elevation 1): swap the tile's Sprite texture to the `ground_high_*` variant
  - For each ramp tile: determine uphill direction from neighbors, use directional ramp texture
- Why: Textured cliff faces are dramatically more visible than 2px lines.

**Step 5: Apply elevation tinting to tile sprites**
- File: `src/rendering/TilemapRenderer.ts`
- Change: When creating tile Sprites in `updateVisibleTiles()`, check elevation:
  - `elevation[idx] === 1`: Use the high-ground texture variant (brighter)
  - `elevation[idx] === 2`: Use directional ramp texture
  - `elevation[idx] === 0` adjacent to higher: Add cliff face overlay Sprite
- Why: Elevation is baked into the tile selection, not a post-process overlay.

#### Edge cases
- Corner cliffs (diagonal adjacency): Only render cliff faces for cardinal neighbors, not diagonals. Corners will naturally fill in.
- Ramp adjacent to water: Ramp should still show, even if odd placement.
- Multiple cliff faces on one tile (e.g., low ground surrounded by high ground on 3 sides): Stack up to 3 cliff face sprites. Rare but possible.

#### NOT in scope
- SC2-style fog-of-war vision penalty from low ground (game logic, not visual)
- Animated ramp effects

#### Acceptance criteria
- [ ] High ground is visibly brighter than low ground — noticeable at a glance
- [ ] Cliff faces render as thick rocky edges (not 2px lines)
- [ ] Cliffs cast a visible shadow toward low ground
- [ ] Ramps have distinct texture with directional indicators
- [ ] All 10 maps render correctly with new elevation visuals
- [ ] Type-check passes clean

#### Test plan
- Manual: Load Fortress map (heavy cliff usage) — verify cliffs are dramatic
- Manual: Load Plains map — verify ramp to natural is clearly visible
- Manual: Zoom out to minimap scale — elevation differences still readable
- `npm test` passes

---

### Task 5: Mineral & Gas Visual Upgrade
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Task 3
**Unblocks:** Task 10

#### Goal
Minerals should be bright, chunky, immediately recognizable cyan crystals with a subtle glow aura. Gas should be a bright green pulsing vent. Both should look like valuable resources worth fighting over — not small dark shapes lost in the terrain.

#### Prerequisites
- Task 3 complete (Sprite-based tilemap with bright ground)

#### Changes (in execution order)

**Step 1: Update mineral tile ground texture**
- File: `src/rendering/TextureGenerator.ts`
- Change: `generateMineralGround()` — darker blue-grey ground with subtle crystal dust speckle. Should contrast with the bright green ground tiles around it.
- Why: The ground under minerals should look like a mineral vein — blue-tinted rock.

**Step 2: Upgrade mineral entity rendering in UnitRenderer**
- File: `src/rendering/UnitRenderer.ts`
- Change: Update the mineral entity drawing section (around lines 148-186):
  - **Larger crystals**: Scale diamond shapes up 40% (from ~6px to ~9px per crystal)
  - **Brighter colors**: Use palette `minerals.crystal` (0x55ddff) instead of current
  - **Glow aura**: Draw a large circle (radius ~14px) underneath the crystals with `minerals.glow` at alpha 0.15 — creates soft glow effect
  - **Facet highlights**: Brighter white facet on top-left of each diamond
  - **Crystal count**: Keep 2-3 per tile but make them chunkier
- Pattern: Existing diamond drawing at lines 170-186, scale up
- Why: Minerals must pop against the bright green terrain.

**Step 3: Upgrade gas entity rendering in UnitRenderer**
- File: `src/rendering/UnitRenderer.ts`
- Change: Update gas entity drawing (around lines 188-206):
  - **Larger vent**: Scale vent ring radius up 30%
  - **Brighter glow**: Use palette `gas.glow` (0x66ff88), increase inner glow alpha from 0.4 to 0.6
  - **Pulsing center**: Animated bright center that pulses with `sin(gameTime * 2)` modulating alpha 0.4-0.8
  - **Steam jets**: 3 small rising dots that animate upward (already have steam wisps, make them brighter and more animated)
- Why: Gas geysers should look like active volcanic vents — bright and steaming.

**Step 4: Add crystal sparkle animation**
- File: `src/rendering/UnitRenderer.ts`
- Change: Add per-frame sparkle animation to mineral patches:
  - Each mineral entity gets 1-2 small white dots that twinkle (alpha modulated by `sin(gameTime * 3 + hash)` between 0 and 0.8)
  - Position cycles slightly (±1px) to create shimmer effect
- Why: Subtle animation draws the eye to resources — important for map readability.

#### Edge cases
- Depleted minerals (0 remaining): Keep dimmed rendering (already handled)
- Minerals under fog: Already handled by UnitRenderer fog check
- Gas with no extractor built: Full bright glow. With extractor: glow partially occluded by building rendering.

#### NOT in scope
- Changing mineral/gas depletion rates or gameplay values
- Mineral patch entity shapes (keep diamond, just bigger and brighter)

#### Acceptance criteria
- [ ] Mineral crystals are bright cyan and clearly visible against green terrain
- [ ] Mineral patches have a subtle glow aura underneath
- [ ] Crystals sparkle with animated twinkle effect
- [ ] Gas vents pulse brightly with visible steam
- [ ] Resources are instantly identifiable on any map
- [ ] Type-check passes clean

#### Test plan
- Manual: Load any map — minerals should be the most prominent map feature
- Manual: Compare mineral visibility at max zoom-out vs zoom-in
- `npm test` passes

---

### Task 6: Water Overhaul
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Task 3
**Unblocks:** Task 10

#### Goal
Water should be bright, animated, and clearly different from ground. Replace the current dark navy (`0x0a2244`) with bright blue. Add visible wave animation, shore foam, and depth variation. Water tiles should be the most obviously impassable terrain type.

#### Prerequisites
- Task 3 complete (Sprite-based tilemap)

#### Changes (in execution order)

**Step 1: Generate water textures (base + depth variants)**
- File: `src/rendering/TextureGenerator.ts`
- Change: Add water texture generators:
  - `water_shallow`: Bright blue base with subtle wave pattern (curved lighter lines)
  - `water_deep`: Deeper blue with less wave detail
  - `water_shore_N/E/S/W`: Shore transition textures — sand/foam strip on the land-facing edge blending into water
- Why: Water needs visual depth and clear shore boundaries.

**Step 2: Replace waterGraphics animation with Sprite tinting**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Replace `updateWater(gameTime)` (lines 336-370) which redraws all water tiles via Graphics every frame:
  - During `render(map)`, create water tile Sprites using water textures (already handled by Task 3's tile texture mapping)
  - Store water sprite references separately: `this.waterSprites: Sprite[]`
  - In `updateWater()`: Instead of `g.clear()` + redraw, modulate each water sprite's `tint` and `alpha` using the existing sine wave formula:
    ```typescript
    const phase = (col * 0.7 + row * 0.5) + gameTime * 1.5;
    sprite.alpha = 0.85 + 0.1 * Math.sin(phase);
    sprite.tint = lerpColor(palette.water.base, palette.water.wave, 0.1 + 0.05 * Math.sin(phase));
    ```
  - This is GPU-side (no geometry rebuild) — much faster than current approach.
- Why: Current water redraws ~1000 Graphics rects per frame. Sprite tint animation is nearly free.

**Step 3: Add foam sprites at shoreline**
- File: `src/rendering/TilemapRenderer.ts`
- Change: For each water tile adjacent to non-water, add a small foam/spray Sprite (white dots with animated alpha). These sit in a `foamContainer` above the tile layer.
- Foam animates with `sin(gameTime * 0.8 + hash)` modulating alpha 0.2-0.5.
- Why: Shore foam creates clear visual boundary between water and land.

**Step 4: Remove old waterGraphics object**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Remove `waterGraphics` from container children. All water rendering now via Sprites + tint animation.
- Why: Clean up old rendering path.

#### Edge cases
- Water at map border: All border tiles are water — these get water textures automatically.
- Island bridges: 4-tile wide land bridges through water should show shore foam on both sides.
- Zoom level: At max zoom-out, water tiles should still be clearly blue (not disappear into noise).

#### NOT in scope
- Water shader effects (reflection, refraction) — too complex for this pass
- Underwater terrain visibility

#### Acceptance criteria
- [ ] Water is bright blue, clearly distinct from all ground types
- [ ] Wave animation visible via tint/alpha modulation (no per-frame Graphics redraw)
- [ ] Shore foam visible where water meets land
- [ ] Water depth varies (deeper in center of large water bodies)
- [ ] All 10 maps look correct (Islands, Archipelago have lots of water)
- [ ] Type-check passes clean

#### Test plan
- Manual: Load Islands map — water should be bright blue with animated waves
- Manual: Load Archipelago — shore foam visible around all islands
- Manual: Verify frame rate is stable (no regression from water animation)
- `npm test` passes

---

### Task 7: Creep Visual Upgrade
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Task 3
**Unblocks:** Task 10

#### Goal
Zerg creep should be vibrant purple — an immediately recognizable terrain modifier. Currently it's a near-invisible 15% alpha flat purple rectangle. The target: bright purple biomass with organic blobby edges and visible vein details, inspired by the Carbot screenshots where creep is a dramatic lavender/purple spread.

#### Prerequisites
- Task 3 complete (Sprite-based tilemap)
- Palette creep colors (Task 1)

#### Changes (in execution order)

**Step 1: Generate creep textures**
- File: `src/rendering/TextureGenerator.ts`
- Change: Add creep texture generators:
  - `creep_full`: Full creep tile — vibrant purple base (0xaa55cc, alpha 0.55), organic vein detail (2-3 darker wavy lines), small speckle dots (lighter purple)
  - `creep_edge_N/E/S/W`: Edge tiles where creep meets ground — creep fades out with blobby organic edge (irregular curve, not straight line). Use Canvas 2D `bezierCurveTo()` for organic boundary.
  - `creep_corner_NE/SE/SW/NW`: Corner variants for diagonal edges
- Why: Organic edges are what make creep look like living biomass, not a grid overlay.

**Step 2: Replace creepGraphics with Sprite layer**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Replace `updateCreep(map, gameTime)` (lines 298-333):
  - Create a `creepContainer` with Sprites for each creep tile
  - For each tile where `map.creepMap[idx] === 1`:
    - Check cardinal neighbors: if all 4 neighbors are also creep → use `creep_full`
    - If missing neighbor N → use `creep_edge_N`, etc.
    - Use `getCardinalMask()` from palette module to determine which edges
  - Keep the 5-second update interval — only rebuild creep sprites when `Math.floor(gameTime / 5)` changes
  - When rebuilding: clear `creepContainer`, recreate sprites for current creep state
- Why: Edge-aware creep sprites create organic boundaries without complex Graphics drawing.

**Step 3: Add creep pulse animation**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Each frame, modulate creep sprites' alpha with a slow pulse:
  ```typescript
  const pulse = 0.5 + 0.08 * Math.sin(gameTime * 0.5 + tileHash(c, r) * 0.01);
  sprite.alpha = pulse;
  ```
- Why: Subtle pulsing makes creep look alive — like it's breathing.

**Step 4: Remove old creepGraphics**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Remove `creepGraphics` object and old `updateCreep` drawing code.
- Why: Replaced by Sprite-based creep.

#### Edge cases
- Creep spreading: When creepMap changes (new tumor, building placed), next 5s tick rebuilds sprites automatically.
- Creep receding (building destroyed): Same — next tick removes sprites for cleared tiles.
- Creep on water tiles: Should not happen (buildings can't be placed on water). Skip.
- Creep on ramps: Should render — creep overlays all ground-type tiles.

#### NOT in scope
- Creep spread animation (smooth growth effect) — would require per-frame creep edge interpolation
- Creep tumor entity visuals (handled by UnitRenderer)

#### Acceptance criteria
- [ ] Creep is vibrant purple, clearly visible against green terrain
- [ ] Creep edges are organic/blobby, not grid-aligned rectangles
- [ ] Creep subtly pulses (alive effect)
- [ ] Creep updates correctly when spreading/receding
- [ ] Type-check passes clean

#### Test plan
- Manual: Play as Zerg, build Hatchery — verify creep spreads with organic edges
- Manual: Build Creep Tumor — verify new creep tiles have correct edge textures
- `npm test` passes

---

### Task 8: Map Decoration System
**Parent:** Map Visual Overhaul
**Size:** S
**Depends on:** Task 3
**Unblocks:** Task 10

#### Goal
Add a scatter layer of terrain decorations (small rocks, pebbles, grass clumps, dirt patches) on ground tiles to break up the visual uniformity and add life to the terrain. These are non-interactive visual-only elements.

#### Prerequisites
- Task 3 complete (Sprite-based tilemap)

#### Changes (in execution order)

**Step 1: Generate decoration textures**
- File: `src/rendering/TextureGenerator.ts`
- Change: Add small decoration texture generators (16x16 or 8x8 — smaller than tiles):
  - `deco_pebble`: 2-3 small gray circles clustered together
  - `deco_grass_clump`: Dense grass tuft cluster (3-5 short green strokes)
  - `deco_dirt_patch`: Small brown irregular patch
  - `deco_flower`: Tiny bright dot (yellow, white, or pink) — very rare
  - `deco_rock`: Small rock (8x8 gray rounded rect with shadow)
- Why: Variety breaks up terrain uniformity.

**Step 2: Scatter decorations during render()**
- File: `src/rendering/TilemapRenderer.ts`
- Change: During `render(map)`, for each ground tile, use `tileHash(col, row)` to deterministically place 0-1 decorations:
  - ~15% of ground tiles get a decoration
  - Hash determines: which decoration type, position offset within tile (±8px from center), rotation
  - Create Sprite from decoration texture, add to `decorationContainer` (between tile layer and unit layer)
  - Respect viewport culling — only create decoration sprites for visible tiles
- Pattern: `scatterTerrainDebris()` in MapData.ts already uses hash-based placement at 2-5% density. Mirror that approach for visuals.
- Why: Decorations are the difference between "tiled game" and "living terrain."

**Step 3: Exclude decoration placement near resources and buildings**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Skip decoration placement on tiles that are: Minerals, Gas, Ramp, Unbuildable, Water, Destructible. Only decorate Ground tiles. Also skip tiles within 2 tiles of mineral/gas (to keep resource areas clean).
- Why: Decorations shouldn't clutter strategic areas.

#### Edge cases
- High zoom-out: Decorations are 8-16px — they become very small. This is fine — they add subtle texture.
- Map change (new game): Decorations are deterministic via hash — same map always produces same decorations.

#### NOT in scope
- Animated decorations (swaying grass, etc.)
- Clickable/interactive decorations

#### Acceptance criteria
- [ ] ~15% of ground tiles have a small decoration sprite
- [ ] Decorations are deterministic (same map = same placement)
- [ ] No decorations on resource tiles, ramps, cliffs, or water
- [ ] Decorations respect viewport culling
- [ ] Type-check passes clean

#### Test plan
- Manual: Load game — verify scattered rocks, grass clumps, pebbles on terrain
- Manual: Zoom in to see decoration detail, zoom out to verify they don't cause clutter
- `npm test` passes

---

### Task 9: Auto-Tiling Terrain Transitions
**Parent:** Map Visual Overhaul
**Size:** L
**Depends on:** Task 3
**Unblocks:** Task 10

#### Goal
Replace hard grid-aligned borders between terrain types with smooth transitions. When grass meets dirt, the edge should blend. When land meets water, there should be a natural shoreline. This uses a 4-bit cardinal bitmask system — each terrain boundary gets a transition texture variant based on which neighbors differ.

#### Prerequisites
- Task 3 complete
- `getCardinalMask()` utility from Task 1
- Understanding: this is the most complex visual task. Do it LAST.

#### Changes (in execution order)

**Step 1: Design transition variant system**
- File: `src/rendering/TextureGenerator.ts`
- Change: For key terrain boundaries, generate 16 transition variants (4-bit cardinal mask: N=1, E=2, S=4, W=8):
  - **Ground↔Water**: 16 shore transition textures. Mask indicates which sides have water. E.g., mask=5 (N+S) = water on north and south.
  - **Ground↔Unbuildable**: 16 cliff-edge transition textures.
  - **Ground↔Ramp**: Simpler — just 4 directional variants (one side connects to ramp).
- Each variant is a 32x32 canvas showing the base terrain type with a blended edge on the indicated sides.
- Total new textures: ~48 (3 boundary types × 16 variants). With caching, memory is ~200KB.
- Why: Auto-tiling is what makes terrain look organic instead of gridded.

**Step 2: Implement transition texture painting**
- File: `src/rendering/TextureGenerator.ts`
- Change: For each variant, paint using Canvas 2D:
  - Start with the base tile texture (e.g., ground)
  - For each edge in the mask, paint a transition strip:
    - **Shore**: 6px sandy-to-water gradient with foam dots
    - **Cliff**: 4px rocky-to-ground gradient with shadow
  - Use `ctx.globalCompositeOperation = 'source-atop'` for clean edge masking
  - Use `bezierCurveTo()` for slightly wavy/organic edge lines (not straight)
- Why: Canvas 2D compositing lets us paint clean transitions without complex math.

**Step 3: Integrate into TilemapRenderer tile selection**
- File: `src/rendering/TilemapRenderer.ts`
- Change: In `render(map)` tile texture selection, after determining base tile type:
  - If tile is Ground: compute water-neighbor mask with `getCardinalMask(tiles, col, row, TileType.Water)`
  - If mask > 0: use `transition_ground_water_${mask}` texture instead of plain ground
  - Same for unbuildable neighbors
  - If both water and unbuildable neighbors: prioritize water transition (it's more visually important)
- Why: Tile selection logic stays simple — just a mask lookup.

**Step 4: Remove old drawTransitions() function**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Remove `drawTransitions()` (lines 374-409) and any remaining transition overlay Graphics.
- Why: Replaced by auto-tiled texture selection.

#### Edge cases
- Triple junction (ground/water/cliff meeting at one tile): Use the highest-priority transition (water > cliff > ground).
- All 4 neighbors differ: Rare. Use base tile texture — transition would be confusing.
- Diagonal-only adjacency (e.g., water only at NW corner): Cardinal mask doesn't capture this. Acceptable visual artifact — corners will have slight hard edges.

#### NOT in scope
- 8-bit extended mask (256 variants per boundary) — too many textures for the visual benefit
- Wang tile system — overkill for this project's scale

#### Acceptance criteria
- [ ] Ground-water boundaries have smooth shore transitions (not hard grid edges)
- [ ] Ground-cliff boundaries have natural rocky transitions
- [ ] Transitions are neighbor-aware (correct edge on correct side)
- [ ] No visible grid edges at terrain boundaries
- [ ] All 10 maps render correctly
- [ ] Type-check passes clean

#### Test plan
- Manual: Load Islands map — shore transitions should be smooth
- Manual: Load Fortress map — cliff transitions should be natural
- Manual: Check all 10 maps for visual artifacts at terrain boundaries
- `npm test` passes

#### Risk notes
- This is the highest-complexity task. If it proves too time-consuming, it can be deferred without blocking the rest of the visual overhaul. Tasks 1-8 already produce a dramatic improvement.
- Start with ground↔water transitions only (most visible). Add cliff transitions as a follow-up if time allows.

---

### Task 10: Minimap Sync + Performance Pass
**Parent:** Map Visual Overhaul
**Size:** M
**Depends on:** Tasks 4-9 (all visual tasks)
**Unblocks:** none

#### Goal
Update the minimap to match the new terrain visuals, and do a final performance audit to ensure the texture-based rendering doesn't regress frame rate.

#### Prerequisites
- All visual tasks (1-9) complete or stable

#### Changes (in execution order)

**Step 1: Update minimap background colors**
- File: `src/rendering/MinimapRenderer.ts`
- Change: In `drawBackground()` (lines 81-139), update the color switch statement to use the new palette colors:
  - Ground: palette.ground.base (bright green)
  - Water: palette.water.base (bright blue)
  - Unbuildable: palette.cliff.base (dark brown)
  - Ramp: palette.ramp.base (greenish-tan)
  - Minerals: palette.minerals.crystal (bright cyan)
  - Gas: palette.gas.glow (bright green)
  - Destructible: palette.rock.body
- Increase elevation brightening from `+0x101010` to `+0x1a1a1a` for better visibility.
- Why: Minimap must match the terrain for visual consistency.

**Step 2: Add creep to minimap**
- File: `src/rendering/MinimapRenderer.ts`
- Change: In the dynamic render pass, for each creep tile, draw a small purple dot (palette.creep.base) at the minimap position. Since creep changes during the game, this goes in the per-frame dynamic rendering.
- Why: Creep spread is strategic information — visible on minimap in SC2.

**Step 3: Performance audit — sprite count monitoring**
- File: `src/rendering/TilemapRenderer.ts`
- Change: Add a debug counter tracking active sprite count (`tileContainer.children.length + decorationContainer.children.length + creepContainer.children.length`). Log if exceeding 2000 active sprites.
- Verify viewport culling is working: at typical zoom (1.0 scale), should see ~600-800 sprites. At max zoom-out, should cap at ~2000.
- Why: Sprite count is the primary performance variable.

**Step 4: Texture atlas audit**
- File: `src/rendering/TextureGenerator.ts`
- Change: Log total textures generated and GPU memory estimate at startup (`textures * 32 * 32 * 4 bytes`).
- Verify no duplicate textures are being created (each unique key should map to exactly one Texture).
- Why: Texture memory should be <500KB total. More than that indicates a bug.

**Step 5: Frame rate verification**
- File: `src/Game.ts`
- Change: Temporarily add FPS counter display (or use browser dev tools). Verify:
  - Static scene (no camera movement): 60 FPS
  - Camera panning: 60 FPS (tile creation/destruction shouldn't cause stuttering)
  - Large battle with many entities: no regression from old performance
  - Water animation: no regression (should be faster since Sprite tint vs Graphics redraw)
- Remove FPS counter after verification.
- Why: Performance regression would make the visual overhaul counterproductive.

#### Edge cases
- Minimap click navigation: Ensure click coordinates still map correctly to world positions (should be unaffected since minimap dimensions haven't changed).

#### NOT in scope
- Minimap visual overhaul (that's a separate ui-look-and-feel task)
- Performance optimization beyond viewport culling (premature without profiling data)

#### Acceptance criteria
- [ ] Minimap terrain colors match the new bright palette
- [ ] Minimap shows creep spread in purple
- [ ] Minimap elevation contrast is clearly visible
- [ ] Active sprite count stays under 2000 at all zoom levels
- [ ] Texture count and memory are reasonable (<100 textures, <500KB)
- [ ] Frame rate is stable 60 FPS during normal gameplay
- [ ] No visible stutter during camera panning
- [ ] Type-check passes clean
- [ ] All tests pass

#### Test plan
- Manual: Compare minimap to game view — colors should match
- Manual: Play full game, monitor frame rate throughout
- Manual: Rapidly pan camera, verify no stuttering or gaps
- `npm test` passes
- `npm run build` succeeds

---

## Cross-Cutting Concerns

### New Module: `src/rendering/terrainPalette.ts`
Centralized terrain color palette + utility functions. Created in Task 1, consumed by Tasks 2-10. Contains:
- `TerrainPalette` object with all color values
- `tileHash(col, row)` — deterministic per-tile hash
- `varyColor(base, col, row, range)` — per-tile color variation
- `getCardinalMask(tiles, col, row, matchType)` — 4-bit neighbor bitmask
- `get8Mask(tiles, col, row, matchType)` — 8-bit neighbor bitmask

### New Module: `src/rendering/TextureGenerator.ts`
Canvas 2D → PixiJS Texture pipeline. Created in Task 2, extended in Tasks 4-9. Manages:
- Texture cache (`Map<string, Texture>`)
- Per-tile-type texture generators
- Transition variant generators (Task 9)
- Decoration texture generators (Task 8)

### Rendering Layer Changes
The viewport container hierarchy changes from:
```
viewport/
  tilemapRenderer.container/
    staticGraphics     ← REMOVED
    waterGraphics      ← REMOVED (Task 6)
    creepGraphics      ← REMOVED (Task 7)
```
To:
```
viewport/
  tilemapRenderer.container/
    tileContainer      ← Sprites for base terrain tiles
    cliffContainer     ← Sprites for cliff face overlays (Task 4)
    decorationContainer ← Sprites for terrain decorations (Task 8)
    waterFoamContainer ← Sprites for shore foam (Task 6)
    creepContainer     ← Sprites for creep overlay (Task 7)
```

### New PixiJS Imports
Currently the codebase imports only `{ Container, Graphics }` from pixi.js. This overhaul adds:
- `Sprite` — tile rendering
- `Texture` — texture objects from Canvas
- No other new PixiJS imports needed.

### Constants Changes
In `src/constants.ts`, these color values change:
| Constant | Old | New |
|----------|-----|-----|
| GROUND_COLOR | 0x2a2a1a | 0x5aa830 |
| WATER_COLOR | 0x0a2244 | 0x2288dd |
| UNBUILDABLE_COLOR | 0x1a1a12 | 0x554433 |
| ROCK_COLOR | 0x666055 | 0x998877 |
| MINERAL_COLOR | 0x44bbff | 0x55ddff |
| GAS_COLOR | 0x44ff66 | 0x66ff88 |

---

## Architecture Model (snapshot)

### Rendering Layer Order (in viewport)
1. TilemapRenderer.tileContainer — base terrain Sprites
2. TilemapRenderer.cliffContainer — cliff face overlay Sprites
3. TilemapRenderer.decorationContainer — terrain decoration Sprites
4. TilemapRenderer.waterFoamContainer — shore foam Sprites
5. TilemapRenderer.creepContainer — Zerg creep Sprites
6. UnitRenderer.container — units, buildings, resources
7. WaypointRenderer.container — movement paths
8. ghostGraphics — building placement preview
9. ProjectileRenderer.container — projectiles
10. FogRenderer.container — fog of war overlay

### Data Flow
```
MapData (tiles[], elevation[], creepMap[])
  → TextureGenerator (Canvas 2D painting → Texture cache)
  → TilemapRenderer (Sprite creation + viewport culling)
  → PixiJS Renderer (GPU batched draw calls)
```

### Performance Budget
- **Tile sprites:** ~600-800 visible at typical zoom (viewport culled)
- **Cliff sprites:** ~50-100 (only at elevation boundaries)
- **Decoration sprites:** ~80-120 (15% of visible ground tiles)
- **Creep sprites:** ~30-60 (only on creep tiles)
- **Water foam sprites:** ~20-40 (only at shorelines)
- **Total active sprites:** ~800-1200 (well within PixiJS v8 batch limits of 4096/batch)
- **Textures in GPU memory:** ~100 unique × 4KB each = ~400KB
- **Startup texture generation:** ~100 canvases × ~1ms = ~100ms

### Key Files Modified
| File | Tasks | Change Scope |
|------|-------|-------------|
| `src/rendering/terrainPalette.ts` | 1 (new) | New module — palette + utilities |
| `src/rendering/TextureGenerator.ts` | 2, 4, 5, 6, 7, 8, 9 (new) | New module — texture pipeline |
| `src/rendering/TilemapRenderer.ts` | 3, 4, 6, 7, 8, 9 | Major rewrite — Graphics → Sprites |
| `src/rendering/UnitRenderer.ts` | 5 | Moderate — mineral/gas rendering |
| `src/rendering/MinimapRenderer.ts` | 10 | Moderate — color sync |
| `src/constants.ts` | 1 | Minor — color values |
| `src/Game.ts` | 2, 3 | Minor — init + render loop wiring |
