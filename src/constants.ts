/**
 * RTS.io — Game Constants
 *
 * Original IP: 4 launch factions, 28 unit types, 28 building types.
 * No SC2 references.
 */

// ── World ──
export const TILE_SIZE = 32;
export const MAP_COLS = 96;
export const MAP_ROWS = 96;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

// ── ECS ──
export const MAX_ENTITIES = 4096;

// ── Timing ──
export const TICKS_PER_SECOND = 60;
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;

// ── Camera ──
export const EDGE_SCROLL_ZONE = 20;
export const EDGE_SCROLL_SPEED = 12;
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.0;

// ═══════════════════════════════════════════════════════════════════════
// FACTIONS
// ═══════════════════════════════════════════════════════════════════════

export const enum Faction {
  None = 0,
  IronLegion = 1,
  Swarm = 2,
  ArcaneCovenant = 3,
  Automata = 4,
  // Expansion factions (5-12) reserved for post-launch
}

/** Which faction the local player controls (client-side only) */
export let activePlayerFaction: number = Faction.IronLegion;
export function setActivePlayerFaction(f: number): void { activePlayerFaction = f; }

// ── Tile types ──
export const enum TileType {
  Ground = 0,
  Minerals = 1,
  Gas = 2,
  Ramp = 3,
  Unbuildable = 4,
  Water = 5,
  Destructible = 6,
}

// ═══════════════════════════════════════════════════════════════════════
// UNIT TYPES — 7 per faction, 28 total
// Ranges: 100s Iron Legion, 200s Swarm, 300s Arcane, 400s Automata
// ═══════════════════════════════════════════════════════════════════════

export const enum UnitType {
  // ── Iron Legion ──
  Trooper      = 101,
  Grenadier    = 102,
  Medic        = 103,
  Humvee       = 104,
  SiegeTank    = 105,
  Gunship      = 106,
  TitanWalker  = 107,

  // ── The Swarm ──
  Drone        = 201,
  Spitter      = 202,
  Burrower     = 203,
  Broodmother  = 204,
  Ravager      = 205,
  Flyer        = 206,
  Leviathan    = 207,

  // ── Arcane Covenant ──
  Acolyte      = 301,
  Warden       = 302,
  Enchanter    = 303,
  BlinkAssassin = 304,
  StormCaller  = 305,
  Golem        = 306,
  Archmage     = 307,

  // ── Automata ──
  Sentinel     = 401,
  Shredder     = 402,
  RepairDrone  = 403,
  Crawler      = 404,
  Disruptor    = 405,
  Harvester    = 406,
  Colossus     = 407,
}

// ── Command modes ──
export const enum CommandMode {
  Idle = 0,
  Move = 1,
  AttackMove = 2,
  AttackTarget = 3,
  HoldPosition = 6,
  Patrol = 7,
}

// ═══════════════════════════════════════════════════════════════════════
// BUILDING TYPES — 7 per faction + neutral
// Ranges: 100s Legion, 150s Swarm, 200s Arcane, 250s Automata, 900s neutral
// ═══════════════════════════════════════════════════════════════════════

export const enum BuildingType {
  // ── Iron Legion ──
  Headquarters  = 100,
  Barracks      = 101,
  WarFactory    = 102,
  Airfield      = 103,
  CommandUplink = 104,
  Bunker        = 105,
  Extractor_L   = 106,

  // ── The Swarm ──
  Hive          = 150,
  SpawnPit      = 151,
  EvolutionDen  = 152,
  Rookery       = 153,
  ApexChamber   = 154,
  SpineTower    = 155,
  Extractor_S   = 156,

  // ── Arcane Covenant ──
  Sanctum       = 200,
  Gateway       = 201,
  ArcaneLibrary = 202,
  Observatory   = 203,
  NexusPrime    = 204,
  WardStone     = 205,
  Extractor_A   = 206,

  // ── Automata ──
  CoreNode      = 250,
  AssemblyLine  = 251,
  AdvancedForge = 252,
  Skyport       = 253,
  OmegaReactor  = 254,
  TurretArray   = 255,
  Extractor_M   = 256,

  // ── Neutral ──
  Rock          = 900,
}

/** Returns true if the building is an HQ type (one per faction) */
export function isHQType(bt: number): boolean {
  return bt === BuildingType.Headquarters
    || bt === BuildingType.Hive
    || bt === BuildingType.Sanctum
    || bt === BuildingType.CoreNode;
}

// Legacy alias for compatibility during migration
export const isHatchType = isHQType;

// ── Building states ──
export const enum BuildState {
  UnderConstruction = 1,
  Complete = 2,
}

// ── Resource types ──
export const enum ResourceType {
  Mineral = 1,
  Gas = 2,
}

// ── Siege mode states (Iron Legion Siege Tank, Automata anchor) ──
export const enum SiegeMode {
  Mobile = 0,
  Sieged = 1,
  Packing = 2,
  Unpacking = 3,
}

// ── Armor classes ──
export const enum ArmorClass {
  Light = 0,
  Armored = 1,
  Heavy = 2,
  Massive = 3,
}

// ═══════════════════════════════════════════════════════════════════════
// UPGRADE TYPES — per-faction upgrade trees
// ═══════════════════════════════════════════════════════════════════════

export enum UpgradeType {
  // Shared patterns (level 0-3)
  Weapons1 = 0,
  Weapons2 = 1,
  Weapons3 = 2,
  Armor1 = 3,
  Armor2 = 4,
  Armor3 = 5,
  // Faction-specific (boolean: 0/1)
  FactionAbility1 = 6,  // e.g., Stim (Legion), Adrenal Surge (Swarm), Blink Range (Arcane), EMP Overcharge (Automata)
  FactionAbility2 = 7,
  FactionAbility3 = 8,
  FactionAbility4 = 9,
  COUNT = 10,
}

// ═══════════════════════════════════════════════════════════════════════
// ABILITY CONSTANTS — generic patterns, faction-flavored
// ═══════════════════════════════════════════════════════════════════════

// Self-buff (Iron Legion Trooper stim, Swarm Drone frenzy, etc.)
export const STIM_DURATION = 5.0;
export const STIM_HP_COST = 10;
export const STIM_SPEED_MULT = 1.4;
export const STIM_COOLDOWN_MULT = 0.6;

// Deploy mode (Siege Tank)
export const SIEGE_PACK_TIME = 2.5;
export const SIEGE_DAMAGE = 30;
export const SIEGE_RANGE = 12;
export const SIEGE_SPLASH = 1.25;
export const SIEGE_BONUS_DAMAGE = 20;
export const SIEGE_COOLDOWN = 2000;
export const SIEGE_MIN_RANGE = 2;

// Heal aura (Medic, Repair Drone)
export const HEAL_RATE = 9.0;
export const HEAL_RANGE = 4;

// Blink (Arcane Blink Assassin)
export const BLINK_RANGE = 8;
export const BLINK_COOLDOWN = 10;

// AOE Storm (Arcane Storm Caller)
export const STORM_DAMAGE = 50;
export const STORM_DURATION = 3.0;
export const STORM_RADIUS = 2.0;
export const STORM_ENERGY_COST = 100;

// EMP (Automata Disruptor)
export const EMP_RANGE = 7;
export const EMP_RADIUS = 2.0;
export const EMP_ENERGY_DRAIN = 100;
export const EMP_ENERGY_COST = 75;

// Stealth (Swarm Burrower)
export const BURROW_AMBUSH_MULT = 2.0;  // first attack damage multiplier

// Self-repair (all Automata units)
export const SELF_REPAIR_RATE = 1.0;      // HP/s out of combat
export const SELF_REPAIR_TIMEOUT = 3.0;   // seconds after last damage

// Broodmother passive spawn
export const BROODMOTHER_SPAWN_INTERVAL = 8.0;  // seconds per free drone
export const BROODMOTHER_MAX_SPAWNS = 4;         // max active free drones

// Shield regen (all Arcane Covenant units)
export const SHIELD_REGEN_RATE = 2.0;    // shield/s out of combat
export const SHIELD_REGEN_TIMEOUT = 5.0; // seconds after last damage

// Defender zone bonus
export const DEFENDER_DAMAGE_BONUS = 0.15;

// ── Economy ──
export const STARTING_MINERALS = 200;
export const STARTING_GAS = 0;
export const STARTING_SUPPLY = 15;
export const MINERAL_COLOR = 0x55ddff;
export const GAS_COLOR = 0x66ff88;

// Legacy compat — not used in arena mode but keep for map gen
export const MINERAL_PER_PATCH = 1500;
export const MINERAL_PER_PATCH_RICH = 1800;
export const GAS_PER_GEYSER = 2500;

// ── Game speed ──
export const GAME_SPEEDS = [0.5, 1.0, 1.5, 2.0] as const;
export type GameSpeed = typeof GAME_SPEEDS[number];

// ── Difficulty (for future PvE elements) ──
export enum Difficulty {
  Easy = 0,
  Normal = 1,
  Hard = 2,
  Brutal = 3,
}

// ═══════════════════════════════════════════════════════════════════════
// FACTION COLORS
// ═══════════════════════════════════════════════════════════════════════

export const FACTION_COLORS: Record<number, number> = {
  [Faction.IronLegion]: 0x4488cc,
  [Faction.Swarm]: 0x88cc44,
  [Faction.ArcaneCovenant]: 0xaa66dd,
  [Faction.Automata]: 0xcc8844,
};

export const FACTION_COLORS_LIGHT: Record<number, number> = {
  [Faction.IronLegion]: 0x66aaee,
  [Faction.Swarm]: 0xaaee66,
  [Faction.ArcaneCovenant]: 0xcc88ff,
  [Faction.Automata]: 0xeeaa66,
};

// General palette
export const GROUND_COLOR = 0x5aa830;
export const UNBUILDABLE_COLOR = 0x554433;
export const WATER_COLOR = 0x2288dd;
export const ROCK_COLOR = 0x998877;
export const SELECTION_COLOR = 0x00ff00;
export const NEUTRAL_STONE = 0xaaaaaa;

// ── Veterancy ──
export let veterancyEnabled = true;
