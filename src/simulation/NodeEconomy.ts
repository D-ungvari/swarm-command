/**
 * NodeEconomy — Hex-based capture zone economy for .io arena.
 *
 * Core mechanic:
 * - Map has hex-shaped resource zones in concentric rings
 * - Capture by uncontested unit presence inside the hex (3s timer)
 * - Contested (both sides have units in hex) = capture frozen
 * - Captured zones generate passive income per tick
 * - Defender bonus: +15% damage for owner's units inside their hex
 *
 * Value gradient (center → edge):
 * - Ring 0 center crown: 250/min
 * - Ring 1 inner: ~210/min
 * - Ring 2 mid: ~155/min
 * - Ring 3 outer-mid: ~105/min
 * - Ring 4 outer: ~70/min
 * - Starter zones: 50/min (pre-captured)
 *
 * 70% mineral zones, 30% gas zones
 */

import type { PlayerResources } from '../types';
import type { HexCoord, HexGridConfig } from './HexGrid';
import { pixelToHex } from './HexGrid';
import type { ArenaZoneDef } from './ArenaMap';

// ─── Constants ───────────────────────────────────────────────────────────

/** Seconds of uncontested presence to capture a zone */
export const CAPTURE_TIME = 3.0;

/** Damage multiplier bonus for owner's units inside their own zone */
export const DEFENDER_DAMAGE_BONUS = 0.15;

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

// ─── Capture State ───────────────────────────────────────────────────────

export const enum CaptureState {
  Neutral = 0,
  Capturing = 1,
  Owned = 2,
  Contested = 3,
}

// ─── Live Zone (runtime state layered on top of ArenaZoneDef) ────────────

export interface LiveZone {
  /** Static definition from ArenaMap */
  def: ArenaZoneDef;
  /** Current owner faction (0 = unclaimed) */
  owner: number;
  /** Capture state */
  state: CaptureState;
  /** Faction currently attempting capture (0 = none) */
  capturingFaction: number;
  /** Capture progress 0.0 → 1.0 */
  captureProgress: number;
}

// ─── Zone Presence Query ─────────────────────────────────────────────────

/**
 * Faction unit counts inside a zone.
 * Provided by caller who has access to the ECS.
 */
export interface ZonePresence {
  factionCounts: Map<number, number>;
}

// ─── NodeEconomyState ────────────────────────────────────────────────────

export class NodeEconomyState {
  zones: LiveZone[] = [];
  private hexConfig: HexGridConfig;

  constructor(hexConfig: HexGridConfig) {
    this.hexConfig = hexConfig;
  }

  /** Initialize live zones from arena layout definitions. */
  initFromLayout(defs: ArenaZoneDef[], starterOwners: Map<number, number>): void {
    this.zones = defs.map(def => {
      // If it's a starter zone, set the owner immediately
      let owner = 0;
      if (def.starterForPlayer !== null) {
        owner = starterOwners.get(def.starterForPlayer) ?? 0;
      }
      return {
        def,
        owner,
        state: owner !== 0 ? CaptureState.Owned : CaptureState.Neutral,
        capturingFaction: 0,
        captureProgress: 0,
      };
    });
  }

  /**
   * Determine which hex zone a world-space point falls in.
   * Returns the LiveZone or undefined if not in any zone.
   */
  getZoneAtWorld(worldX: number, worldY: number): LiveZone | undefined {
    const hex = pixelToHex(this.hexConfig, worldX, worldY);
    return this.zones.find(z => z.def.hex.q === hex.q && z.def.hex.r === hex.r);
  }

  /**
   * Check if a world-space point is inside a zone owned by the given faction.
   * Used for defender bonus.
   */
  isInOwnedZone(worldX: number, worldY: number, unitFaction: number): boolean {
    const zone = this.getZoneAtWorld(worldX, worldY);
    return zone !== undefined && zone.owner === unitFaction;
  }

  // ─── Tick: Capture ─────────────────────────────────────────────────────

  /**
   * Update capture state for all zones based on unit presence.
   *
   * @param dt Time step in seconds
   * @param getPresence Function returning which factions have units in a zone's hex
   */
  tickCapture(dt: number, getPresence: (zone: LiveZone) => ZonePresence): void {
    for (const zone of this.zones) {
      const presence = getPresence(zone);
      const factions = [...presence.factionCounts.entries()].filter(([_, count]) => count > 0);

      if (factions.length === 0) {
        // No units — decay any in-progress capture, leave owned zones alone
        if (zone.state === CaptureState.Capturing) {
          zone.captureProgress = Math.max(0, zone.captureProgress - dt / CAPTURE_TIME);
          if (zone.captureProgress <= 0) {
            zone.state = zone.owner !== 0 ? CaptureState.Owned : CaptureState.Neutral;
            zone.capturingFaction = 0;
          }
        } else if (zone.state === CaptureState.Contested) {
          // Was contested, now empty — revert to owned or neutral
          zone.state = zone.owner !== 0 ? CaptureState.Owned : CaptureState.Neutral;
        }
        continue;
      }

      if (factions.length > 1) {
        // Multiple factions present — contested, freeze
        zone.state = CaptureState.Contested;
        continue;
      }

      // Exactly one faction present
      const [presentFaction] = factions[0];

      if (zone.owner === presentFaction) {
        // Owner defending — zone stays owned
        zone.state = CaptureState.Owned;
        zone.capturingFaction = 0;
        zone.captureProgress = 0;
        continue;
      }

      // Capturing (neutral or enemy zone)
      if (zone.capturingFaction !== presentFaction) {
        zone.capturingFaction = presentFaction;
        zone.captureProgress = 0;
      }

      zone.state = CaptureState.Capturing;
      zone.captureProgress += dt / CAPTURE_TIME;

      if (zone.captureProgress >= 1.0) {
        zone.owner = presentFaction;
        zone.state = CaptureState.Owned;
        zone.capturingFaction = 0;
        zone.captureProgress = 0;
      }
    }
  }

  // ─── Tick: Income ──────────────────────────────────────────────────────

  /**
   * Add passive income from owned zones.
   */
  tickIncome(dt: number, resources: Record<number, PlayerResources>): void {
    for (const zone of this.zones) {
      if (zone.owner === 0) continue;
      const res = resources[zone.owner];
      if (!res) continue;

      const perSec = zone.def.incomePerMin / 60;
      if (zone.def.type === 'mineral') {
        res.minerals += perSec * dt;
      } else {
        res.gas += perSec * dt;
      }
    }
  }

  // ─── Queries ───────────────────────────────────────────────────────────

  countOwned(factionId: number): number {
    return this.zones.filter(z => z.owner === factionId).length;
  }

  getTotalIncome(factionId: number): { minerals: number; gas: number } {
    let minerals = 0;
    let gas = 0;
    for (const zone of this.zones) {
      if (zone.owner !== factionId) continue;
      if (zone.def.type === 'mineral') minerals += zone.def.incomePerMin;
      else gas += zone.def.incomePerMin;
    }
    return { minerals, gas };
  }

  getOwnedZones(factionId: number): LiveZone[] {
    return this.zones.filter(z => z.owner === factionId);
  }
}

// ─── Bounty Helpers ──────────────────────────────────────────────────────

export function awardKillBounty(
  attackerFaction: number,
  victimSupply: number,
  resources: Record<number, PlayerResources>,
): void {
  const res = resources[attackerFaction];
  if (!res) return;
  res.minerals += Math.round(victimSupply * KILL_BOUNTY_PER_SUPPLY);
}

export function awardBuildingBounty(
  attackerFaction: number,
  buildingMineralCost: number,
  resources: Record<number, PlayerResources>,
): void {
  const res = resources[attackerFaction];
  if (!res) return;
  res.minerals += Math.round(buildingMineralCost * BUILDING_DESTROY_BOUNTY_PCT);
}
