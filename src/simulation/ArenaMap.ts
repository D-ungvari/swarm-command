/**
 * ArenaMap — Circular arena map generator for 8+ player .io matches.
 *
 * Map: 96×96 tiles (3072×3072 px) — circular playable area
 *
 * Layout (concentric rings from center outward):
 *   Center (r < 12):  6 high-value zones (200-250/min)
 *   Mid    (r 12-25): 12 medium zones (100-175/min)
 *   Outer  (r 25-35): 8 zones between adjacent spawns (60-100/min)
 *   Starter(r 35-42): 16 zones, 2 per player pre-captured (50-75/min)
 *   Spawns (r ~38):   8 player bases around the perimeter
 *
 * Total: 42 zones, 70% mineral / 30% gas
 * Players spawn evenly spaced around perimeter.
 */

import type { MapData } from '../map/MapData';
import { TileType, TILE_SIZE } from '../constants';

// ─── Arena Constants ─────────────────────────────────────────────────────

export const ARENA_COLS = 96;
export const ARENA_ROWS = 96;
export const ARENA_WIDTH = ARENA_COLS * TILE_SIZE;   // 3072px
export const ARENA_HEIGHT = ARENA_ROWS * TILE_SIZE;  // 3072px

/** Max players the arena supports */
export const MAX_ARENA_PLAYERS = 16;

/** Default player count */
export const DEFAULT_PLAYER_COUNT = 8;

/** Tiles from map center to spawn ring */
const SPAWN_RING_RADIUS = 38;

/** Playable radius (circular arena) — tiles outside are water/walls */
const PLAYABLE_RADIUS = 44;

// ─── Zone Layout Constants ───────────────────────────────────────────────

/** Zone capture radius in tiles (must match NodeEconomy.CAPTURE_RADIUS) */
export const ZONE_RADIUS = 4;

/** Minimum tile distance between zone centers */
const MIN_ZONE_SPACING = 9; // slightly over 2× capture radius

// Ring boundaries (distance from center in tiles)
const CENTER_RING_MAX = 12;
const MID_RING_MAX = 25;
const OUTER_RING_MAX = 35;

// Zone counts per ring
const CENTER_ZONE_COUNT = 6;
const MID_ZONE_COUNT = 12;
const OUTER_ZONE_COUNT = 8;
const STARTER_ZONES_PER_PLAYER = 2;

// Income per minute by ring
const CENTER_INCOME = 250;
const MID_INCOME = 150;
const OUTER_INCOME = 85;
const STARTER_INCOME = 50;

// ─── Types ───────────────────────────────────────────────────────────────

export interface ArenaZoneDef {
  id: number;
  col: number;
  row: number;
  type: 'mineral' | 'gas';
  incomePerMin: number;
  ring: 'center' | 'mid' | 'outer' | 'starter';
  /** If starter, which player index (0-based) owns it at match start */
  starterForPlayer: number | null;
}

export interface ArenaSpawn {
  playerIndex: number;  // 0-based
  col: number;
  row: number;
  angle: number;        // radians, for reference
}

export interface ArenaLayout {
  cols: number;
  rows: number;
  spawns: ArenaSpawn[];
  zones: ArenaZoneDef[];
  totalMineralZones: number;
  totalGasZones: number;
}

// ─── Seeded RNG (local) ──────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    },
    nextInt(max: number): number {
      return Math.floor(this.next() * max);
    },
  };
}

// ─── Layout Generation ───────────────────────────────────────────────────

/**
 * Generate the full arena layout: spawns + zones.
 *
 * @param playerCount Number of players (2-16, default 8)
 * @param seed Deterministic seed for zone placement jitter
 */
export function generateArenaLayout(
  playerCount: number = DEFAULT_PLAYER_COUNT,
  seed: number = 12345,
): ArenaLayout {
  const rng = makeRng(seed);
  const cx = ARENA_COLS / 2;
  const cy = ARENA_ROWS / 2;

  // ── Spawns ──
  const spawns: ArenaSpawn[] = [];
  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    spawns.push({
      playerIndex: i,
      col: Math.round(cx + SPAWN_RING_RADIUS * Math.cos(angle)),
      row: Math.round(cy + SPAWN_RING_RADIUS * Math.sin(angle)),
      angle,
    });
  }

  // ── Zone placement ──
  const zones: ArenaZoneDef[] = [];
  let nextId = 1;
  let mineralCount = 0;
  let gasCount = 0;

  // Track placed zone centers to enforce minimum spacing
  const placed: Array<{ col: number; row: number }> = [];

  function tooClose(col: number, row: number): boolean {
    for (const p of placed) {
      const dx = col - p.col;
      const dy = row - p.row;
      if (dx * dx + dy * dy < MIN_ZONE_SPACING * MIN_ZONE_SPACING) return true;
    }
    return false;
  }

  function pickType(): 'mineral' | 'gas' {
    // Maintain 70/30 split
    const totalPlaced = mineralCount + gasCount;
    if (totalPlaced === 0) return 'mineral';
    const currentGasRatio = gasCount / totalPlaced;
    if (currentGasRatio < 0.25) return rng.next() < 0.5 ? 'gas' : 'mineral';
    if (currentGasRatio >= 0.35) return 'mineral';
    return rng.next() < 0.3 ? 'gas' : 'mineral';
  }

  function addZone(
    col: number, row: number, ring: ArenaZoneDef['ring'],
    income: number, starterFor: number | null = null,
    forceType?: 'mineral' | 'gas',
  ): void {
    const type = forceType ?? pickType();
    if (type === 'gas') gasCount++; else mineralCount++;
    zones.push({
      id: nextId++,
      col: Math.round(col),
      row: Math.round(row),
      type,
      incomePerMin: income,
      ring,
      starterForPlayer: starterFor,
    });
    placed.push({ col: Math.round(col), row: Math.round(row) });
  }

  // ── 1. Starter zones (2 per player, near spawn, pointing inward) ──
  for (let i = 0; i < playerCount; i++) {
    const sp = spawns[i];
    // Direction from spawn toward center
    const toCenter = Math.atan2(cy - sp.row, cx - sp.col);
    const dist = 7; // tiles from spawn toward center

    // Two zones flanking the spawn-to-center line
    for (let j = 0; j < STARTER_ZONES_PER_PLAYER; j++) {
      const offset = (j === 0 ? 0.35 : -0.35);
      const zCol = sp.col + dist * Math.cos(toCenter + offset);
      const zRow = sp.row + dist * Math.sin(toCenter + offset);
      addZone(zCol, zRow, 'starter', STARTER_INCOME, i, 'mineral');
    }
  }

  // ── 2. Outer ring zones (between adjacent player spawns) ──
  const outerCount = Math.min(OUTER_ZONE_COUNT, playerCount);
  for (let i = 0; i < outerCount; i++) {
    // Midpoint between spawn i and spawn (i+1)
    const sp1 = spawns[i];
    const sp2 = spawns[(i + 1) % playerCount];
    const midAngle = (sp1.angle + sp2.angle) / 2 +
      (Math.abs(sp1.angle - sp2.angle) > Math.PI ? Math.PI : 0);
    const r = (OUTER_RING_MAX + MID_RING_MAX) / 2 + (rng.next() - 0.5) * 4;
    const col = cx + r * Math.cos(midAngle);
    const row = cy + r * Math.sin(midAngle);

    if (!tooClose(col, row)) {
      addZone(col, row, 'outer', OUTER_INCOME + Math.round(rng.next() * 30));
    }
  }

  // ── 3. Mid ring zones (ring of 12, evenly spaced) ──
  for (let i = 0; i < MID_ZONE_COUNT; i++) {
    const angle = (2 * Math.PI * i) / MID_ZONE_COUNT + rng.next() * 0.3;
    const r = (CENTER_RING_MAX + MID_RING_MAX) / 2 + (rng.next() - 0.5) * 6;
    const col = cx + r * Math.cos(angle);
    const row = cy + r * Math.sin(angle);

    if (!tooClose(col, row)) {
      // Income varies slightly: closer to center = more
      const distFromCenter = r / (ARENA_COLS / 2);
      const income = Math.round(MID_INCOME + (1 - distFromCenter) * 50);
      addZone(col, row, 'mid', Math.min(income, 200));
    }
  }

  // ── 4. Center ring zones (high-value cluster) ──
  for (let i = 0; i < CENTER_ZONE_COUNT; i++) {
    const angle = (2 * Math.PI * i) / CENTER_ZONE_COUNT;
    const r = 5 + rng.next() * (CENTER_RING_MAX - 6);
    const col = cx + r * Math.cos(angle);
    const row = cy + r * Math.sin(angle);

    if (!tooClose(col, row)) {
      const income = CENTER_INCOME - Math.round(rng.next() * 40);
      addZone(col, row, 'center', income);
    }
  }

  return {
    cols: ARENA_COLS,
    rows: ARENA_ROWS,
    spawns,
    zones,
    totalMineralZones: mineralCount,
    totalGasZones: gasCount,
  };
}

// ─── Tile Map Generation ─────────────────────────────────────────────────

/**
 * Generate the tile grid for the arena.
 * Circular playable area with water/walls outside.
 * Zone centers get special tile markers for rendering.
 */
export function generateArenaTiles(layout: ArenaLayout): MapData {
  const { cols, rows } = layout;
  const total = cols * rows;
  const tiles = new Uint8Array(total);
  const walkable = new Uint8Array(total);
  const destructibleHP = new Uint16Array(total);
  const creepMap = new Uint8Array(total);
  const elevation = new Uint8Array(total);
  const watchtowerPositions: Array<{ col: number; row: number }> = [];

  const cx = cols / 2;
  const cy = rows / 2;

  // Fill tile grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > PLAYABLE_RADIUS) {
        // Outside playable area — water
        tiles[idx] = TileType.Water;
        walkable[idx] = 0;
      } else if (dist > PLAYABLE_RADIUS - 2) {
        // Edge ring — unbuildable but walkable (shore)
        tiles[idx] = TileType.Unbuildable;
        walkable[idx] = 1;
      } else {
        // Playable ground
        tiles[idx] = TileType.Ground;
        walkable[idx] = 1;
      }
    }
  }

  // Mark zone centers as unbuildable ground (so buildings can't cover them)
  for (const zone of layout.zones) {
    const idx = zone.row * cols + zone.col;
    if (idx >= 0 && idx < total) {
      tiles[idx] = TileType.Unbuildable;
      // Zone center + neighbors stay walkable
    }
  }

  // Add some terrain variety: scatter a few rock clusters for tactical cover
  // Place rocks at midpoints between rings, avoiding zones and spawns
  const rng = makeRng(54321);
  const rockCount = 16 + layout.spawns.length * 2;
  for (let i = 0; i < rockCount; i++) {
    const angle = rng.next() * 2 * Math.PI;
    const r = 10 + rng.next() * (PLAYABLE_RADIUS - 16);
    const rc = Math.round(cx + r * Math.cos(angle));
    const rr = Math.round(cy + r * Math.sin(angle));

    // Check it's not too close to a zone or spawn
    let blocked = false;
    for (const z of layout.zones) {
      if (Math.abs(z.col - rc) < 6 && Math.abs(z.row - rr) < 6) { blocked = true; break; }
    }
    for (const s of layout.spawns) {
      if (Math.abs(s.col - rc) < 8 && Math.abs(s.row - rr) < 8) { blocked = true; break; }
    }
    if (blocked) continue;

    // Place a small 2×2 rock cluster
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const tr = rr + dr;
        const tc = rc + dc;
        if (tr >= 0 && tr < rows && tc >= 0 && tc < cols) {
          const tidx = tr * cols + tc;
          if (tiles[tidx] === TileType.Ground) {
            tiles[tidx] = TileType.Destructible;
            walkable[tidx] = 0;
            destructibleHP[tidx] = 500;
          }
        }
      }
    }
  }

  // Add elevation: center plateau (slight high ground)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CENTER_RING_MAX - 2) {
        elevation[r * cols + c] = 1; // high ground
      } else if (dist < CENTER_RING_MAX) {
        elevation[r * cols + c] = 2; // ramp
      }
    }
  }

  return {
    tiles,
    walkable,
    destructibleHP,
    creepMap,
    elevation,
    watchtowerPositions,
    cols,
    rows,
  };
}

// ─── Summary Helper ──────────────────────────────────────────────────────

/** Print a human-readable summary of the arena layout (for debugging). */
export function summarizeLayout(layout: ArenaLayout): string {
  const lines: string[] = [];
  lines.push(`Arena: ${layout.cols}×${layout.rows} tiles (${layout.cols * TILE_SIZE}×${layout.rows * TILE_SIZE}px)`);
  lines.push(`Players: ${layout.spawns.length}`);
  lines.push(`Zones: ${layout.zones.length} (${layout.totalMineralZones} mineral, ${layout.totalGasZones} gas)`);

  const byRing = { center: 0, mid: 0, outer: 0, starter: 0 };
  const incomeByRing: Record<string, number[]> = { center: [], mid: [], outer: [], starter: [] };
  for (const z of layout.zones) {
    byRing[z.ring]++;
    incomeByRing[z.ring].push(z.incomePerMin);
  }

  for (const ring of ['center', 'mid', 'outer', 'starter'] as const) {
    const incomes = incomeByRing[ring];
    const min = Math.min(...incomes);
    const max = Math.max(...incomes);
    const avg = Math.round(incomes.reduce((a, b) => a + b, 0) / incomes.length);
    lines.push(`  ${ring}: ${byRing[ring]} zones, income ${min}-${max}/min (avg ${avg})`);
  }

  // Total income if one player held everything
  const totalIncome = layout.zones.reduce((sum, z) => sum + z.incomePerMin, 0);
  lines.push(`Total map income: ${totalIncome}/min`);
  lines.push(`Per-player starter income: ${STARTER_INCOME * STARTER_ZONES_PER_PLAYER}/min`);

  return lines.join('\n');
}
