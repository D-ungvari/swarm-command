/**
 * HexGrid — Flat-top hexagonal grid utilities.
 *
 * Uses axial coordinates (q, r) for hex addressing.
 * Flat-top orientation: pointy sides on left/right, flat edges on top/bottom.
 *
 * Reference: https://www.redblobgames.com/grids/hexagons/
 *
 *     ___
 *    /   \
 *   / q,r \
 *   \     /
 *    \___/
 */

// ─── Core Types ──────────────────────────────────────────────────────────

/** Axial hex coordinate */
export interface HexCoord {
  q: number;
  r: number;
}

/** Pixel position (world space) */
export interface PixelPos {
  x: number;
  y: number;
}

// ─── Hex Grid Configuration ──────────────────────────────────────────────

/**
 * Create a hex grid configuration.
 * @param hexSize Distance from center to corner (outer radius) in pixels
 * @param originX World-space X of the hex grid origin (center hex)
 * @param originY World-space Y of the hex grid origin (center hex)
 */
export interface HexGridConfig {
  /** Distance from hex center to any corner (outer radius), in pixels */
  hexSize: number;
  /** World X of the grid origin (q=0, r=0) */
  originX: number;
  /** World Y of the grid origin (q=0, r=0) */
  originY: number;
}

// ─── Coordinate Conversions ──────────────────────────────────────────────

/** Convert axial hex coordinate to world pixel position (center of hex). */
export function hexToPixel(config: HexGridConfig, hex: HexCoord): PixelPos {
  const { hexSize, originX, originY } = config;
  // Flat-top layout:
  // x = size * (3/2 * q)
  // y = size * (sqrt(3)/2 * q + sqrt(3) * r)
  const x = originX + hexSize * (3 / 2 * hex.q);
  const y = originY + hexSize * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
  return { x, y };
}

/** Convert world pixel position to fractional axial hex coordinate. */
export function pixelToHexFractional(config: HexGridConfig, px: number, py: number): { q: number; r: number } {
  const { hexSize, originX, originY } = config;
  const relX = px - originX;
  const relY = py - originY;
  // Inverse of flat-top:
  const q = (2 / 3 * relX) / hexSize;
  const r = (-1 / 3 * relX + Math.sqrt(3) / 3 * relY) / hexSize;
  return { q, r };
}

/** Round fractional axial coordinates to the nearest hex. */
export function hexRound(q: number, r: number): HexCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else rs would be corrected, but we don't store it

  return { q: rq || 0, r: rr || 0 }; // normalize -0 to 0
}

/** Convert world pixel position to the nearest hex coordinate. */
export function pixelToHex(config: HexGridConfig, px: number, py: number): HexCoord {
  const frac = pixelToHexFractional(config, px, py);
  return hexRound(frac.q, frac.r);
}

// ─── Hex Properties ──────────────────────────────────────────────────────

/** Width of a flat-top hex (corner to corner, horizontal). */
export function hexWidth(hexSize: number): number {
  return hexSize * 2;
}

/** Height of a flat-top hex (flat edge to flat edge, vertical). */
export function hexHeight(hexSize: number): number {
  return hexSize * Math.sqrt(3);
}

/** Get the 6 corner vertices of a hex in pixel space. */
export function hexCorners(config: HexGridConfig, hex: HexCoord): PixelPos[] {
  const center = hexToPixel(config, hex);
  const corners: PixelPos[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i); // flat-top: starts at 0°
    corners.push({
      x: center.x + config.hexSize * Math.cos(angle),
      y: center.y + config.hexSize * Math.sin(angle),
    });
  }
  return corners;
}

// ─── Point-in-Hex Test ───────────────────────────────────────────────────

/**
 * Test if a world pixel point is inside a specific hex.
 * Uses the nearest-hex approach (faster than polygon test).
 */
export function isPointInHex(config: HexGridConfig, hex: HexCoord, px: number, py: number): boolean {
  const nearest = pixelToHex(config, px, py);
  return nearest.q === hex.q && nearest.r === hex.r;
}

// ─── Ring & Distance ─────────────────────────────────────────────────────

/** Hex distance (number of steps between two hexes). */
export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (-a.q - a.r) - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/** Get all hexes in a ring of given radius around center. */
export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  if (radius === 0) return [{ q: center.q, r: center.r }];

  const results: HexCoord[] = [];

  // 6 direction vectors for flat-top hex grid
  const directions: HexCoord[] = [
    { q: 1, r: 0 },   { q: 0, r: 1 },   { q: -1, r: 1 },
    { q: -1, r: 0 },  { q: 0, r: -1 },  { q: 1, r: -1 },
  ];

  // Start at the "top" of the ring
  let hex: HexCoord = {
    q: center.q + directions[4].q * radius,
    r: center.r + directions[4].r * radius,
  };

  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push({ q: hex.q, r: hex.r });
      hex = { q: hex.q + directions[side].q, r: hex.r + directions[side].r };
    }
  }

  return results;
}

/** Get all hexes within a given radius (filled disk). */
export function hexDisk(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let ring = 0; ring <= radius; ring++) {
    results.push(...hexRing(center, ring));
  }
  return results;
}

// ─── Neighbor ────────────────────────────────────────────────────────────

const HEX_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },   { q: 1, r: -1 },  { q: 0, r: -1 },
  { q: -1, r: 0 },  { q: -1, r: 1 },  { q: 0, r: 1 },
];

/** Get the 6 neighboring hex coordinates. */
export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

// ─── Tile Coordinate Helpers ─────────────────────────────────────────────

/** Convert hex coordinate to tile coordinate (approximate center tile). */
export function hexToTile(config: HexGridConfig, hex: HexCoord, tileSize: number): { col: number; row: number } {
  const px = hexToPixel(config, hex);
  return {
    col: Math.round(px.x / tileSize),
    row: Math.round(px.y / tileSize),
  };
}

/** Convert tile coordinate to nearest hex. */
export function tileToHex(config: HexGridConfig, col: number, row: number, tileSize: number): HexCoord {
  return pixelToHex(config, col * tileSize, row * tileSize);
}
