/**
 * NodeEconomy — Capture-based resource zone system for .io arena.
 *
 * Core mechanic:
 * - Map has resource zones (nodes) scattered from edge to center
 * - Capture by uncontested unit presence (3s timer)
 * - Contested (both sides have units) = capture frozen
 * - Captured zones generate passive income per tick
 * - Defender bonus: +15% damage for owner's units inside the zone
 *
 * Value gradient:
 * - Edge zones (near spawns): ~50 income/min — safe, low reward
 * - Mid zones: ~150 income/min — contested, medium reward
 * - Center zones: ~250 income/min — high risk, high reward
 *
 * Resource distribution: 70% minerals, 30% gas
 */

import type { PlayerResources } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────

/** Radius around a node where units count for capture (tiles) */
export const CAPTURE_RADIUS = 4;

/** Seconds of uncontested presence to capture a node */
export const CAPTURE_TIME = 3.0;

/** Damage bonus for owner's units inside their own node zone (multiplier) */
export const DEFENDER_DAMAGE_BONUS = 0.15;

/** Income per minute for the lowest-value (edge) zones */
export const EDGE_ZONE_INCOME = 50;

/** Income per minute for the highest-value (center) zones */
export const CENTER_ZONE_INCOME = 250;

/** Kill bounty: minerals per supply point of destroyed unit */
export const KILL_BOUNTY_PER_SUPPLY = 10;

/** Building destruction bounty: % of mineral cost */
export const BUILDING_DESTROY_BOUNTY_PCT = 0.25;

/** Starting minerals */
export const ARENA_STARTING_MINERALS = 200;

/** Starting gas */
export const ARENA_STARTING_GAS = 0;

/** Starting supply cap */
export const ARENA_STARTING_SUPPLY = 15;

// ─── Resource Zone ───────────────────────────────────────────────────────

export const enum CaptureState {
  Neutral = 0,     // No owner, no capture in progress
  Capturing = 1,   // One faction is capturing (timer filling)
  Owned = 2,       // Fully captured by a faction
  Contested = 3,   // Multiple factions present — frozen
}

export interface ResourceZone {
  id: number;
  col: number;          // Tile center
  row: number;
  type: 'mineral' | 'gas';

  /** Income per minute this zone generates (50-250, based on distance from center) */
  incomePerMin: number;

  /** Current owner faction (0 = unclaimed) */
  owner: number;

  /** Capture state */
  state: CaptureState;

  /** Faction currently attempting capture (0 = none) */
  capturingFaction: number;

  /** Capture progress (0.0 to 1.0) */
  captureProgress: number;

  /** Normalized distance from center (0.0 = center, 1.0 = edge) */
  distFromCenter: number;
}

// ─── Unit Presence Query ─────────────────────────────────────────────────

/**
 * Result of counting faction units near a zone.
 * Provided by the caller (Simulation or GameRoom) since it knows the ECS.
 */
export interface ZonePresence {
  /** Map of faction ID → unit count inside the zone radius */
  factionCounts: Map<number, number>;
}

// ─── NodeEconomyState ────────────────────────────────────────────────────

export class NodeEconomyState {
  zones: ResourceZone[] = [];
  private nextId = 1;

  /**
   * Add a resource zone to the map.
   * @param col Tile column
   * @param row Tile row
   * @param type 'mineral' or 'gas'
   * @param mapCols Total map columns (for distance calc)
   * @param mapRows Total map rows (for distance calc)
   */
  addZone(col: number, row: number, type: 'mineral' | 'gas', mapCols: number, mapRows: number): ResourceZone {
    const cx = mapCols / 2;
    const cy = mapRows / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    const dist = Math.sqrt((col - cx) ** 2 + (row - cy) ** 2);
    const normalized = Math.min(1.0, dist / maxDist);

    // Income scales linearly: center (0.0) = CENTER_ZONE_INCOME, edge (1.0) = EDGE_ZONE_INCOME
    const incomePerMin = Math.round(
      CENTER_ZONE_INCOME + (EDGE_ZONE_INCOME - CENTER_ZONE_INCOME) * normalized
    );

    const zone: ResourceZone = {
      id: this.nextId++,
      col, row, type,
      incomePerMin,
      owner: 0,
      state: CaptureState.Neutral,
      capturingFaction: 0,
      captureProgress: 0,
      distFromCenter: normalized,
    };
    this.zones.push(zone);
    return zone;
  }

  /**
   * Update capture state for all zones based on unit presence.
   * Called once per server tick.
   *
   * @param dt Time step in seconds
   * @param getPresence Function that returns which factions have units near a zone
   */
  tickCapture(dt: number, getPresence: (zone: ResourceZone) => ZonePresence): void {
    for (const zone of this.zones) {
      const presence = getPresence(zone);
      const factions = [...presence.factionCounts.entries()].filter(([_, count]) => count > 0);

      if (factions.length === 0) {
        // No units nearby — state unchanged (owned stays owned, neutral stays neutral)
        if (zone.state === CaptureState.Capturing) {
          // Capturing faction left — progress decays
          zone.captureProgress = Math.max(0, zone.captureProgress - dt / CAPTURE_TIME);
          if (zone.captureProgress <= 0) {
            zone.state = CaptureState.Neutral;
            zone.capturingFaction = 0;
          }
        }
        continue;
      }

      if (factions.length > 1) {
        // Multiple factions — contested, freeze capture
        zone.state = CaptureState.Contested;
        continue;
      }

      // Exactly one faction present
      const [presentFaction] = factions[0];

      if (zone.owner === presentFaction) {
        // Owner's units are here — zone stays owned, reset any capture attempts
        zone.state = CaptureState.Owned;
        zone.capturingFaction = 0;
        zone.captureProgress = 0;
        continue;
      }

      // Enemy or neutral capture attempt
      if (zone.capturingFaction !== presentFaction) {
        // New faction starting capture — reset progress
        zone.capturingFaction = presentFaction;
        zone.captureProgress = 0;
      }

      zone.state = CaptureState.Capturing;
      zone.captureProgress += dt / CAPTURE_TIME;

      if (zone.captureProgress >= 1.0) {
        // Captured!
        zone.owner = presentFaction;
        zone.state = CaptureState.Owned;
        zone.capturingFaction = 0;
        zone.captureProgress = 0;
      }
    }
  }

  /**
   * Tick passive income for all owned zones.
   * Called once per server tick.
   */
  tickIncome(dt: number, resources: Record<number, PlayerResources>): void {
    for (const zone of this.zones) {
      if (zone.owner === 0) continue;
      const res = resources[zone.owner];
      if (!res) continue;

      const incomePerSec = zone.incomePerMin / 60;
      if (zone.type === 'mineral') {
        res.minerals += incomePerSec * dt;
      } else {
        res.gas += incomePerSec * dt;
      }
    }
  }

  /**
   * Check if a unit at (worldX, worldY) is inside a zone owned by its faction.
   * Used for applying defender bonus.
   */
  isInOwnedZone(col: number, row: number, unitFaction: number): boolean {
    for (const zone of this.zones) {
      if (zone.owner !== unitFaction) continue;
      const dx = col - zone.col;
      const dy = row - zone.row;
      if (dx * dx + dy * dy <= CAPTURE_RADIUS * CAPTURE_RADIUS) {
        return true;
      }
    }
    return false;
  }

  /** Count zones owned by a faction. */
  countOwned(factionId: number): number {
    return this.zones.filter(z => z.owner === factionId).length;
  }

  /** Get total income per minute for a faction. */
  getTotalIncome(factionId: number): { minerals: number; gas: number } {
    let minerals = 0;
    let gas = 0;
    for (const zone of this.zones) {
      if (zone.owner !== factionId) continue;
      if (zone.type === 'mineral') minerals += zone.incomePerMin;
      else gas += zone.incomePerMin;
    }
    return { minerals, gas };
  }

  /** Find zone at a tile position. */
  findZoneAt(col: number, row: number): ResourceZone | undefined {
    return this.zones.find(z => {
      const dx = col - z.col;
      const dy = row - z.row;
      return dx * dx + dy * dy <= CAPTURE_RADIUS * CAPTURE_RADIUS;
    });
  }
}

// ─── Bounty Helpers ──────────────────────────────────────────────────────

/** Award kill bounty to attacker's faction. */
export function awardKillBounty(
  attackerFaction: number,
  victimSupply: number,
  resources: Record<number, PlayerResources>,
): void {
  const res = resources[attackerFaction];
  if (!res) return;
  res.minerals += Math.round(victimSupply * KILL_BOUNTY_PER_SUPPLY);
}

/** Award building destruction bounty. */
export function awardBuildingBounty(
  attackerFaction: number,
  buildingMineralCost: number,
  resources: Record<number, PlayerResources>,
): void {
  const res = resources[attackerFaction];
  if (!res) return;
  res.minerals += Math.round(buildingMineralCost * BUILDING_DESTROY_BOUNTY_PCT);
}
