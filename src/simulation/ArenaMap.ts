/**
 * ArenaMap — Hex-grid arena map generator for 8+ player .io matches.
 *
 * Map: 96×96 tiles (3072×3072 px) — circular playable area
 * Hex grid: flat-top hexagons, 128px outer radius (~8 tiles across)
 *
 * Layout (hex rings from center outward):
 *   Ring 0:  1 hex  — center crown (250/min)
 *   Ring 1:  6 hexes — inner ring (200-220/min)
 *   Ring 2: 12 hexes — mid ring (140-170/min)
 *   Ring 3: 18 hexes — outer-mid ring (90-120/min)
 *   Ring 4: 24 hexes — outer ring (60-80/min, partially used)
 *   Spawns sit between ring 4 and map edge
 *
 * ~42 resource zones total, 70% mineral / 30% gas
 * Players spawn evenly around the perimeter, each with 2 pre-captured hexes.
 */

import type { MapData } from '../map/MapData';
import { TileType, TILE_SIZE } from '../constants';
import {
  type HexCoord, type HexGridConfig,
  hexToPixel, pixelToHex, hexRing, hexDistance, hexCorners, hexToTile,
} from './HexGrid';

// ─── Arena Constants ─────────────────────────────────────────────────────

export const ARENA_COLS = 96;
export const ARENA_ROWS = 96;
export const ARENA_WIDTH = ARENA_COLS * TILE_SIZE;   // 3072px
export const ARENA_HEIGHT = ARENA_ROWS * TILE_SIZE;  // 3072px

/** Hex outer radius in pixels (center to corner) */
export const HEX_SIZE = 128;

/** Max players the arena supports */
export const MAX_ARENA_PLAYERS = 16;

/** Playable radius from center in tiles — outside is water */
const PLAYABLE_RADIUS = 44;

/** Spawn distance from center in tiles */
const SPAWN_RING_RADIUS = 38;

// ─── Income by Ring ──────────────────────────────────────────────────────

const RING_INCOME: Record<number, number> = {
  0: 250,  // Center crown — king of the hill
  1: 210,  // Inner — very high value
  2: 155,  // Mid — solid income
  3: 105,  // Outer-mid — moderate
  4: 70,   // Outer — low but accessible
};

const STARTER_INCOME = 50;

// ─── Types ───────────────────────────────────────────────────────────────

export interface ArenaZoneDef {
  id: number;
  /** Hex axial coordinates */
  hex: HexCoord;
  /** World pixel center */
  worldX: number;
  worldY: number;
  /** Tile-space center (approximate) */
  col: number;
  row: number;

  type: 'mineral' | 'gas';
  incomePerMin: number;
  ring: number;

  /** If starter zone, which player index (0-based) owns it at match start. null = unclaimed */
  starterForPlayer: number | null;
}

export interface ArenaSpawn {
  playerIndex: number;
  col: number;
  row: number;
  worldX: number;
  worldY: number;
  angle: number;
}

export interface ArenaLayout {
  cols: number;
  rows: number;
  hexConfig: HexGridConfig;
  spawns: ArenaSpawn[];
  zones: ArenaZoneDef[];
  totalMineralZones: number;
  totalGasZones: number;
}

// ─── Seeded RNG ──────────────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      return s / 4294967296;
    },
  };
}

// ─── Layout Generation ───────────────────────────────────────────────────

/**
 * Generate the full hex-based arena layout.
 *
 * @param playerCount Number of players (2-16, default 8)
 * @param seed Deterministic seed for type assignment jitter
 */
export function generateArenaLayout(
  playerCount: number = 8,
  seed: number = 12345,
): ArenaLayout {
  const rng = makeRng(seed);

  // Hex grid centered on map
  const hexConfig: HexGridConfig = {
    hexSize: HEX_SIZE,
    originX: ARENA_WIDTH / 2,
    originY: ARENA_HEIGHT / 2,
  };

  // ── Spawns ──
  const cx = ARENA_COLS / 2;
  const cy = ARENA_ROWS / 2;
  const spawns: ArenaSpawn[] = [];
  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    const col = Math.round(cx + SPAWN_RING_RADIUS * Math.cos(angle));
    const row = Math.round(cy + SPAWN_RING_RADIUS * Math.sin(angle));
    spawns.push({
      playerIndex: i,
      col, row,
      worldX: col * TILE_SIZE,
      worldY: row * TILE_SIZE,
      angle,
    });
  }

  // ── Resource zones from hex rings 0-4 ──
  const zones: ArenaZoneDef[] = [];
  let nextId = 1;
  let mineralCount = 0;
  let gasCount = 0;
  const center: HexCoord = { q: 0, r: 0 };

  function pickType(): 'mineral' | 'gas' {
    const total = mineralCount + gasCount;
    if (total === 0) return 'mineral';
    const gasRatio = gasCount / total;
    if (gasRatio < 0.25) return rng.next() < 0.5 ? 'gas' : 'mineral';
    if (gasRatio >= 0.35) return 'mineral';
    return rng.next() < 0.3 ? 'gas' : 'mineral';
  }

  function addZone(
    hex: HexCoord,
    ring: number,
    income: number,
    starterFor: number | null = null,
    forceType?: 'mineral' | 'gas',
  ): void {
    const px = hexToPixel(hexConfig, hex);
    const tile = hexToTile(hexConfig, hex, TILE_SIZE);
    const type = forceType ?? pickType();
    if (type === 'gas') gasCount++; else mineralCount++;

    zones.push({
      id: nextId++,
      hex,
      worldX: px.x,
      worldY: px.y,
      col: tile.col,
      row: tile.row,
      type,
      incomePerMin: income,
      ring,
      starterForPlayer: starterFor,
    });
  }

  // Ring 0: center hex — always mineral (the crown jewel)
  addZone(center, 0, RING_INCOME[0], null, 'mineral');

  // Ring 1: 6 inner hexes
  for (const hex of hexRing(center, 1)) {
    const income = RING_INCOME[1] + Math.round((rng.next() - 0.5) * 20);
    addZone(hex, 1, income);
  }

  // Ring 2: 12 mid hexes
  for (const hex of hexRing(center, 2)) {
    const income = RING_INCOME[2] + Math.round((rng.next() - 0.5) * 30);
    addZone(hex, 2, income);
  }

  // Ring 3: 18 outer-mid hexes — use all of them
  for (const hex of hexRing(center, 3)) {
    const income = RING_INCOME[3] + Math.round((rng.next() - 0.5) * 20);
    addZone(hex, 3, income);
  }

  // Ring 4: 24 outer hexes — only use those within the playable circle
  for (const hex of hexRing(center, 4)) {
    const px = hexToPixel(hexConfig, hex);
    const tile = hexToTile(hexConfig, hex, TILE_SIZE);
    const dx = tile.col - cx;
    const dy = tile.row - cy;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);

    if (distFromCenter < PLAYABLE_RADIUS - 4) {
      const income = RING_INCOME[4] + Math.round((rng.next() - 0.5) * 15);
      addZone(hex, 4, income);
    }
  }

  // ── Starter zones: 2 per player, placed near their spawn ──
  // Find the closest unassigned ring 3-4 hexes to each spawn and mark them
  for (let i = 0; i < playerCount; i++) {
    const sp = spawns[i];
    const spawnHex = pixelToHex(hexConfig, sp.worldX, sp.worldY);

    // Find the 2 closest zones (ring 3-4) to this spawn that aren't already assigned
    const candidates = zones
      .filter(z => z.ring >= 3 && z.starterForPlayer === null)
      .map(z => ({
        zone: z,
        dist: hexDistance(spawnHex, z.hex),
      }))
      .sort((a, b) => a.dist - b.dist);

    let assigned = 0;
    for (const c of candidates) {
      if (assigned >= 2) break;
      c.zone.starterForPlayer = i;
      c.zone.incomePerMin = STARTER_INCOME;
      c.zone.type = 'mineral'; // starters are always mineral
      assigned++;
    }
  }

  return {
    cols: ARENA_COLS,
    rows: ARENA_ROWS,
    hexConfig,
    spawns,
    zones,
    totalMineralZones: mineralCount,
    totalGasZones: gasCount,
  };
}

// ─── Tile Map Generation ─────────────────────────────────────────────────

/**
 * Generate the tile grid for the arena.
 * Circular playable area, water outside, hex zone markers.
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

  // Base terrain: circular arena with water border
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > PLAYABLE_RADIUS) {
        tiles[idx] = TileType.Water;
        walkable[idx] = 0;
      } else if (dist > PLAYABLE_RADIUS - 2) {
        tiles[idx] = TileType.Unbuildable;
        walkable[idx] = 1;
      } else {
        tiles[idx] = TileType.Ground;
        walkable[idx] = 1;
      }
    }
  }

  // Elevated center plateau (ring 0-1 area)
  const centerRadiusTiles = HEX_SIZE * 2.2 / TILE_SIZE; // ~ring 1 boundary
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < centerRadiusTiles - 1) {
        elevation[r * cols + c] = 1; // high ground
      } else if (dist < centerRadiusTiles + 1) {
        elevation[r * cols + c] = 2; // ramp
      }
    }
  }

  // Scatter destructible rocks for tactical cover (avoid zones and spawns)
  const rng = makeRng(54321);
  const rockClusters = 20;
  for (let i = 0; i < rockClusters; i++) {
    const angle = rng.next() * 2 * Math.PI;
    const dist = 8 + rng.next() * (PLAYABLE_RADIUS - 14);
    const rc = Math.round(cx + dist * Math.cos(angle));
    const rr = Math.round(cy + dist * Math.sin(angle));

    // Skip if too close to a zone center or spawn
    let blocked = false;
    for (const z of layout.zones) {
      if (Math.abs(z.col - rc) < 5 && Math.abs(z.row - rr) < 5) { blocked = true; break; }
    }
    if (!blocked) {
      for (const s of layout.spawns) {
        if (Math.abs(s.col - rc) < 7 && Math.abs(s.row - rr) < 7) { blocked = true; break; }
      }
    }
    if (blocked) continue;

    // 2×2 rock cluster
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

  return {
    tiles, walkable, destructibleHP, creepMap, elevation,
    watchtowerPositions, cols, rows,
  };
}

// ─── Summary ─────────────────────────────────────────────────────────────

export function summarizeLayout(layout: ArenaLayout): string {
  const lines: string[] = [];
  lines.push(`Arena: ${layout.cols}×${layout.rows} tiles, hex size ${HEX_SIZE}px`);
  lines.push(`Players: ${layout.spawns.length}`);
  lines.push(`Zones: ${layout.zones.length} (${layout.totalMineralZones} mineral, ${layout.totalGasZones} gas)`);
  lines.push(`Gas ratio: ${(layout.totalGasZones / layout.zones.length * 100).toFixed(0)}%`);

  const byRing: Record<number, ArenaZoneDef[]> = {};
  for (const z of layout.zones) {
    (byRing[z.ring] ??= []).push(z);
  }
  for (const [ring, ringZones] of Object.entries(byRing).sort((a, b) => +a[0] - +b[0])) {
    const incomes = ringZones.map(z => z.incomePerMin);
    const starters = ringZones.filter(z => z.starterForPlayer !== null).length;
    const min = Math.min(...incomes);
    const max = Math.max(...incomes);
    const starterNote = starters > 0 ? ` (${starters} are starter zones)` : '';
    lines.push(`  Ring ${ring}: ${ringZones.length} zones, ${min}-${max}/min${starterNote}`);
  }

  const totalIncome = layout.zones.reduce((s, z) => s + z.incomePerMin, 0);
  lines.push(`Total map income: ${totalIncome}/min`);

  return lines.join('\n');
}
