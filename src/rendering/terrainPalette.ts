import { MAP_COLS, MAP_ROWS, TileType } from '../constants';

// ── Carbot-inspired vibrant terrain palette ──
// Single source of truth for all terrain colors. Every renderer references this.
export const TerrainPalette = {
  ground: {
    base: 0x5aa830,
    grassTint: 0x66bb33,
    dirtTint: 0x8b7355,
    dirtBase: 0x9b8465,
    noise: 0x4a9025,
    noiseDark: 0x3d7a1e,
    tuft: 0x3d8820,
  },
  water: {
    base: 0x2288dd,
    deep: 0x1166aa,
    wave: 0x44aaff,
    waveSecondary: 0x3399ee,
    foam: 0xccddee,
    shore: 0x88aa66,
  },
  cliff: {
    face: 0x665544,
    shadow: 0x3a2a1a,
    highlight: 0xaa9977,
    base: 0x554433,
  },
  ramp: {
    base: 0x8b9955,
    stripe: 0x99aa66,
    border: 0xaabb77,
  },
  minerals: {
    crystal: 0x55ddff,
    highlight: 0xbbeeff,
    sparkle: 0xffffff,
    ground: 0x335566,
    glow: 0x44ccee,
  },
  gas: {
    vent: 0x55cc55,
    glow: 0x66ff88,
    center: 0xccffdd,
    steam: 0xaaffbb,
    ground: 0x3a553a,
  },
  rock: {
    body: 0x998877,
    border: 0x776655,
    crack: 0x554433,
    chipLight: 0xbbaa99,
    chipDark: 0x443322,
  },
  creep: {
    base: 0xaa55cc,
    veinDark: 0x8833aa,
    veinLight: 0x9944bb,
    edge: 0x7722aa,
  },
  elevation: {
    highOverlay: 0xffffff,
    highAlpha: 0.12,
    rampTopAlpha: 0.08,
    rampBottomAlpha: 0.06,
  },
  grid: {
    line: 0x000000,
    lineAlpha: 0.03,
  },
} as const;

/** Fast deterministic hash from tile position */
export function tileHash(col: number, row: number): number {
  return (((col * 73856093) ^ (row * 19349663)) >>> 0);
}

/** Deterministic per-tile color variation using position-based hash */
export function varyColor(base: number, col: number, row: number, range = 8): number {
  const hash = tileHash(col, row);
  const variation = ((hash % (range * 2 + 1)) - range);

  const r = Math.max(0, Math.min(255, ((base >> 16) & 0xff) + variation));
  const g = Math.max(0, Math.min(255, ((base >> 8) & 0xff) + variation));
  const b = Math.max(0, Math.min(255, (base & 0xff) + variation));

  return (r << 16) | (g << 8) | b;
}

/**
 * 4-bit cardinal neighbor bitmask: N=1, E=2, S=4, W=8.
 * Returns which cardinal neighbors match the given tile type.
 */
export function getCardinalMask(
  tiles: Uint8Array, col: number, row: number, matchTileType: number,
): number {
  let mask = 0;
  // North
  if (row > 0 && tiles[(row - 1) * MAP_COLS + col] === matchTileType) mask |= 1;
  // East
  if (col < MAP_COLS - 1 && tiles[row * MAP_COLS + col + 1] === matchTileType) mask |= 2;
  // South
  if (row < MAP_ROWS - 1 && tiles[(row + 1) * MAP_COLS + col] === matchTileType) mask |= 4;
  // West
  if (col > 0 && tiles[row * MAP_COLS + col - 1] === matchTileType) mask |= 8;
  return mask;
}

/**
 * 8-bit neighbor bitmask: N=1, E=2, S=4, W=8, NE=16, SE=32, SW=64, NW=128.
 */
export function get8Mask(
  tiles: Uint8Array, col: number, row: number, matchTileType: number,
): number {
  let mask = getCardinalMask(tiles, col, row, matchTileType);
  // NE
  if (row > 0 && col < MAP_COLS - 1 && tiles[(row - 1) * MAP_COLS + col + 1] === matchTileType) mask |= 16;
  // SE
  if (row < MAP_ROWS - 1 && col < MAP_COLS - 1 && tiles[(row + 1) * MAP_COLS + col + 1] === matchTileType) mask |= 32;
  // SW
  if (row < MAP_ROWS - 1 && col > 0 && tiles[(row + 1) * MAP_COLS + col - 1] === matchTileType) mask |= 64;
  // NW
  if (row > 0 && col > 0 && tiles[(row - 1) * MAP_COLS + col - 1] === matchTileType) mask |= 128;
  return mask;
}
