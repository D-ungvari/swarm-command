/**
 * RTS.io Building Definitions — 4 Launch Factions
 *
 * 4-tier building chains per faction.
 * Each tier gates access to stronger units.
 */

import { FactionId } from './factions';
import { ArenaUnitType } from './arena-units';

// ─── Building Type Enum ──────────────────────────────────────────────────
// Ranges: 100-149 Iron Legion, 150-199 Swarm, 200-249 Arcane, 250-299 Automata
// 900+ = neutral/shared

export const enum ArenaBuildingType {
  // ── Iron Legion ──
  Headquarters    = 100, // T1 HQ, provides supply
  Barracks        = 101, // T1 infantry production
  WarFactory      = 102, // T2 vehicle production (requires Barracks)
  Airfield        = 103, // T3 air production (requires WarFactory)
  CommandUplink   = 104, // T4 unlocks Titan Walker (requires Airfield)
  Bunker          = 105, // Defensive structure
  Extractor_L     = 106, // Resource node extractor

  // ── The Swarm ──
  Hive            = 150, // T1 HQ, provides supply
  SpawnPit        = 151, // T1 basic unit spawner
  EvolutionDen    = 152, // T2 advanced units (requires SpawnPit)
  Rookery         = 153, // T3 air units (requires EvolutionDen)
  ApexChamber     = 154, // T4 unlocks Leviathan (requires Rookery)
  SpineTower      = 155, // Defensive structure
  Extractor_S     = 156, // Resource node extractor

  // ── Arcane Covenant ──
  Sanctum         = 200, // T1 HQ, provides supply
  Gateway         = 201, // T1 basic unit warp-in
  ArcaneLibrary   = 202, // T2 advanced units (requires Gateway)
  Observatory     = 203, // T3 air + tier3 (requires ArcaneLibrary)
  NexusPrime      = 204, // T4 unlocks Archmage (requires Observatory)
  WardStone       = 205, // Defensive structure
  Extractor_A     = 206, // Resource node extractor

  // ── Automata ──
  CoreNode        = 250, // T1 HQ, provides supply
  AssemblyLine    = 251, // T1 basic unit production
  AdvancedForge   = 252, // T2 advanced units (requires AssemblyLine)
  Skyport         = 253, // T3 air + tier3 (requires AdvancedForge)
  OmegaReactor    = 254, // T4 unlocks Colossus (requires Skyport)
  TurretArray     = 255, // Defensive structure
  Extractor_M     = 256, // Resource node extractor

  // ── Neutral ──
  ResourceNode    = 900, // Map resource node (claimable)
  Rock            = 901, // Destructible obstacle
}

// ─── Building Definition ─────────────────────────────────────────────────

export interface ArenaBuildingDef {
  type: ArenaBuildingType;
  name: string;
  faction: FactionId;
  tier: 0 | 1 | 2 | 3 | 4; // 0 = neutral

  hp: number;
  costMinerals: number;
  costGas: number;
  buildTime: number;     // seconds
  tileWidth: number;
  tileHeight: number;
  supplyProvided: number;
  color: number;

  produces: ArenaUnitType[]; // Units this building can train
  requires: ArenaBuildingType | null; // Prerequisite building

  // Defensive buildings
  damage?: number;
  range?: number;
  attackCooldown?: number;
  canTargetGround?: 0 | 1;
  canTargetAir?: 0 | 1;
}

// ─── Faction Colors ──────────────────────────────────────────────────────

const LEGION_COLOR = 0x4488cc;
const SWARM_COLOR = 0x88cc44;
const ARCANE_COLOR = 0xaa66dd;
const AUTOMATA_COLOR = 0xcc8844;

// ─── Building Tables ─────────────────────────────────────────────────────

export const ARENA_BUILDING_DEFS: Record<number, ArenaBuildingDef> = {

  // ════════════════════════════════════════════════════════════════════════
  // IRON LEGION
  // ════════════════════════════════════════════════════════════════════════

  [ArenaBuildingType.Headquarters]: {
    type: ArenaBuildingType.Headquarters, name: 'Headquarters', faction: FactionId.IronLegion, tier: 1,
    hp: 1500, costMinerals: 400, costGas: 0, buildTime: 60, tileWidth: 3, tileHeight: 3,
    supplyProvided: 15, color: LEGION_COLOR,
    produces: [], requires: null,
  },
  [ArenaBuildingType.Barracks]: {
    type: ArenaBuildingType.Barracks, name: 'Barracks', faction: FactionId.IronLegion, tier: 1,
    hp: 800, costMinerals: 150, costGas: 0, buildTime: 30, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: LEGION_COLOR,
    produces: [ArenaUnitType.Trooper, ArenaUnitType.Grenadier, ArenaUnitType.Medic],
    requires: null,
  },
  [ArenaBuildingType.WarFactory]: {
    type: ArenaBuildingType.WarFactory, name: 'War Factory', faction: FactionId.IronLegion, tier: 2,
    hp: 1000, costMinerals: 200, costGas: 100, buildTime: 40, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: LEGION_COLOR,
    produces: [ArenaUnitType.Humvee, ArenaUnitType.SiegeTank],
    requires: ArenaBuildingType.Barracks,
  },
  [ArenaBuildingType.Airfield]: {
    type: ArenaBuildingType.Airfield, name: 'Airfield', faction: FactionId.IronLegion, tier: 3,
    hp: 900, costMinerals: 200, costGas: 150, buildTime: 45, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: LEGION_COLOR,
    produces: [ArenaUnitType.Gunship],
    requires: ArenaBuildingType.WarFactory,
  },
  [ArenaBuildingType.CommandUplink]: {
    type: ArenaBuildingType.CommandUplink, name: 'Command Uplink', faction: FactionId.IronLegion, tier: 4,
    hp: 600, costMinerals: 300, costGas: 200, buildTime: 50, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: LEGION_COLOR,
    produces: [ArenaUnitType.TitanWalker],
    requires: ArenaBuildingType.Airfield,
  },
  [ArenaBuildingType.Bunker]: {
    type: ArenaBuildingType.Bunker, name: 'Bunker', faction: FactionId.IronLegion, tier: 1,
    hp: 400, costMinerals: 100, costGas: 0, buildTime: 20, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: LEGION_COLOR,
    produces: [], requires: null,
    damage: 10, range: 6, attackCooldown: 800, canTargetGround: 1, canTargetAir: 1,
  },
  [ArenaBuildingType.Extractor_L]: {
    type: ArenaBuildingType.Extractor_L, name: 'Extractor', faction: FactionId.IronLegion, tier: 1,
    hp: 300, costMinerals: 75, costGas: 0, buildTime: 15, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: LEGION_COLOR,
    produces: [], requires: null,
  },

  // ════════════════════════════════════════════════════════════════════════
  // THE SWARM
  // ════════════════════════════════════════════════════════════════════════

  [ArenaBuildingType.Hive]: {
    type: ArenaBuildingType.Hive, name: 'Hive', faction: FactionId.Swarm, tier: 1,
    hp: 1400, costMinerals: 350, costGas: 0, buildTime: 55, tileWidth: 3, tileHeight: 3,
    supplyProvided: 15, color: SWARM_COLOR,
    produces: [], requires: null,
  },
  [ArenaBuildingType.SpawnPit]: {
    type: ArenaBuildingType.SpawnPit, name: 'Spawn Pit', faction: FactionId.Swarm, tier: 1,
    hp: 700, costMinerals: 125, costGas: 0, buildTime: 25, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: SWARM_COLOR,
    produces: [ArenaUnitType.Drone, ArenaUnitType.Spitter, ArenaUnitType.Burrower],
    requires: null,
  },
  [ArenaBuildingType.EvolutionDen]: {
    type: ArenaBuildingType.EvolutionDen, name: 'Evolution Den', faction: FactionId.Swarm, tier: 2,
    hp: 900, costMinerals: 175, costGas: 75, buildTime: 35, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: SWARM_COLOR,
    produces: [ArenaUnitType.Broodmother, ArenaUnitType.Ravager],
    requires: ArenaBuildingType.SpawnPit,
  },
  [ArenaBuildingType.Rookery]: {
    type: ArenaBuildingType.Rookery, name: 'Rookery', faction: FactionId.Swarm, tier: 3,
    hp: 800, costMinerals: 175, costGas: 125, buildTime: 40, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: SWARM_COLOR,
    produces: [ArenaUnitType.Flyer],
    requires: ArenaBuildingType.EvolutionDen,
  },
  [ArenaBuildingType.ApexChamber]: {
    type: ArenaBuildingType.ApexChamber, name: 'Apex Chamber', faction: FactionId.Swarm, tier: 4,
    hp: 600, costMinerals: 250, costGas: 200, buildTime: 50, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: SWARM_COLOR,
    produces: [ArenaUnitType.Leviathan],
    requires: ArenaBuildingType.Rookery,
  },
  [ArenaBuildingType.SpineTower]: {
    type: ArenaBuildingType.SpineTower, name: 'Spine Tower', faction: FactionId.Swarm, tier: 1,
    hp: 350, costMinerals: 75, costGas: 0, buildTime: 18, tileWidth: 1, tileHeight: 1,
    supplyProvided: 0, color: SWARM_COLOR,
    produces: [], requires: null,
    damage: 12, range: 7, attackCooldown: 1000, canTargetGround: 1, canTargetAir: 0,
  },
  [ArenaBuildingType.Extractor_S]: {
    type: ArenaBuildingType.Extractor_S, name: 'Extractor', faction: FactionId.Swarm, tier: 1,
    hp: 250, costMinerals: 60, costGas: 0, buildTime: 12, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: SWARM_COLOR,
    produces: [], requires: null,
  },

  // ════════════════════════════════════════════════════════════════════════
  // ARCANE COVENANT
  // ════════════════════════════════════════════════════════════════════════

  [ArenaBuildingType.Sanctum]: {
    type: ArenaBuildingType.Sanctum, name: 'Sanctum', faction: FactionId.ArcaneCovenant, tier: 1,
    hp: 1200, costMinerals: 400, costGas: 0, buildTime: 60, tileWidth: 3, tileHeight: 3,
    supplyProvided: 15, color: ARCANE_COLOR,
    produces: [], requires: null,
  },
  [ArenaBuildingType.Gateway]: {
    type: ArenaBuildingType.Gateway, name: 'Gateway', faction: FactionId.ArcaneCovenant, tier: 1,
    hp: 750, costMinerals: 150, costGas: 0, buildTime: 30, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: ARCANE_COLOR,
    produces: [ArenaUnitType.Acolyte, ArenaUnitType.Warden],
    requires: null,
  },
  [ArenaBuildingType.ArcaneLibrary]: {
    type: ArenaBuildingType.ArcaneLibrary, name: 'Arcane Library', faction: FactionId.ArcaneCovenant, tier: 2,
    hp: 850, costMinerals: 200, costGas: 100, buildTime: 40, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: ARCANE_COLOR,
    produces: [ArenaUnitType.Enchanter, ArenaUnitType.BlinkAssassin],
    requires: ArenaBuildingType.Gateway,
  },
  [ArenaBuildingType.Observatory]: {
    type: ArenaBuildingType.Observatory, name: 'Observatory', faction: FactionId.ArcaneCovenant, tier: 3,
    hp: 750, costMinerals: 200, costGas: 150, buildTime: 45, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: ARCANE_COLOR,
    produces: [ArenaUnitType.StormCaller, ArenaUnitType.Golem],
    requires: ArenaBuildingType.ArcaneLibrary,
  },
  [ArenaBuildingType.NexusPrime]: {
    type: ArenaBuildingType.NexusPrime, name: 'Nexus Prime', faction: FactionId.ArcaneCovenant, tier: 4,
    hp: 500, costMinerals: 350, costGas: 250, buildTime: 55, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: ARCANE_COLOR,
    produces: [ArenaUnitType.Archmage],
    requires: ArenaBuildingType.Observatory,
  },
  [ArenaBuildingType.WardStone]: {
    type: ArenaBuildingType.WardStone, name: 'Ward Stone', faction: FactionId.ArcaneCovenant, tier: 1,
    hp: 300, costMinerals: 100, costGas: 25, buildTime: 22, tileWidth: 1, tileHeight: 1,
    supplyProvided: 0, color: ARCANE_COLOR,
    produces: [], requires: null,
    damage: 15, range: 8, attackCooldown: 1200, canTargetGround: 1, canTargetAir: 1,
  },
  [ArenaBuildingType.Extractor_A]: {
    type: ArenaBuildingType.Extractor_A, name: 'Extractor', faction: FactionId.ArcaneCovenant, tier: 1,
    hp: 250, costMinerals: 75, costGas: 0, buildTime: 15, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: ARCANE_COLOR,
    produces: [], requires: null,
  },

  // ════════════════════════════════════════════════════════════════════════
  // AUTOMATA
  // ════════════════════════════════════════════════════════════════════════

  [ArenaBuildingType.CoreNode]: {
    type: ArenaBuildingType.CoreNode, name: 'Core Node', faction: FactionId.Automata, tier: 1,
    hp: 1600, costMinerals: 400, costGas: 0, buildTime: 60, tileWidth: 3, tileHeight: 3,
    supplyProvided: 15, color: AUTOMATA_COLOR,
    produces: [], requires: null,
  },
  [ArenaBuildingType.AssemblyLine]: {
    type: ArenaBuildingType.AssemblyLine, name: 'Assembly Line', faction: FactionId.Automata, tier: 1,
    hp: 850, costMinerals: 150, costGas: 0, buildTime: 30, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: AUTOMATA_COLOR,
    produces: [ArenaUnitType.Sentinel, ArenaUnitType.Shredder],
    requires: null,
  },
  [ArenaBuildingType.AdvancedForge]: {
    type: ArenaBuildingType.AdvancedForge, name: 'Advanced Forge', faction: FactionId.Automata, tier: 2,
    hp: 1000, costMinerals: 200, costGas: 100, buildTime: 40, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: AUTOMATA_COLOR,
    produces: [ArenaUnitType.RepairDrone, ArenaUnitType.Crawler],
    requires: ArenaBuildingType.AssemblyLine,
  },
  [ArenaBuildingType.Skyport]: {
    type: ArenaBuildingType.Skyport, name: 'Skyport', faction: FactionId.Automata, tier: 3,
    hp: 900, costMinerals: 200, costGas: 150, buildTime: 45, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: AUTOMATA_COLOR,
    produces: [ArenaUnitType.Disruptor, ArenaUnitType.Harvester],
    requires: ArenaBuildingType.AdvancedForge,
  },
  [ArenaBuildingType.OmegaReactor]: {
    type: ArenaBuildingType.OmegaReactor, name: 'Omega Reactor', faction: FactionId.Automata, tier: 4,
    hp: 600, costMinerals: 300, costGas: 200, buildTime: 55, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: AUTOMATA_COLOR,
    produces: [ArenaUnitType.Colossus],
    requires: ArenaBuildingType.Skyport,
  },
  [ArenaBuildingType.TurretArray]: {
    type: ArenaBuildingType.TurretArray, name: 'Turret Array', faction: FactionId.Automata, tier: 1,
    hp: 400, costMinerals: 100, costGas: 0, buildTime: 20, tileWidth: 1, tileHeight: 1,
    supplyProvided: 0, color: AUTOMATA_COLOR,
    produces: [], requires: null,
    damage: 8, range: 7, attackCooldown: 600, canTargetGround: 1, canTargetAir: 1,
  },
  [ArenaBuildingType.Extractor_M]: {
    type: ArenaBuildingType.Extractor_M, name: 'Extractor', faction: FactionId.Automata, tier: 1,
    hp: 350, costMinerals: 75, costGas: 0, buildTime: 15, tileWidth: 2, tileHeight: 2,
    supplyProvided: 0, color: AUTOMATA_COLOR,
    produces: [], requires: null,
  },
};

// ─── Helper: Get HQ building type for a faction ──────────────────────────

export function getHQType(factionId: FactionId): ArenaBuildingType {
  switch (factionId) {
    case FactionId.IronLegion: return ArenaBuildingType.Headquarters;
    case FactionId.Swarm: return ArenaBuildingType.Hive;
    case FactionId.ArcaneCovenant: return ArenaBuildingType.Sanctum;
    case FactionId.Automata: return ArenaBuildingType.CoreNode;
    default: return ArenaBuildingType.Headquarters;
  }
}

/** Get extractor building type for a faction */
export function getExtractorType(factionId: FactionId): ArenaBuildingType {
  switch (factionId) {
    case FactionId.IronLegion: return ArenaBuildingType.Extractor_L;
    case FactionId.Swarm: return ArenaBuildingType.Extractor_S;
    case FactionId.ArcaneCovenant: return ArenaBuildingType.Extractor_A;
    case FactionId.Automata: return ArenaBuildingType.Extractor_M;
    default: return ArenaBuildingType.Extractor_L;
  }
}
