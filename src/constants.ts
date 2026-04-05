// ── World ──
export const TILE_SIZE = 32;
export const MAP_COLS = 128;
export const MAP_ROWS = 128;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

// ── ECS ──
export const MAX_ENTITIES = 4096;

// ── Timing ──
export const TICKS_PER_SECOND = 60;
export const MS_PER_TICK = 1000 / TICKS_PER_SECOND;

// ── Camera ──
export const EDGE_SCROLL_ZONE = 20; // px from screen edge
export const EDGE_SCROLL_SPEED = 12; // px per frame
export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 2.0;

// ── Factions ──
export const enum Faction {
  None = 0,
  Terran = 1,
  Zerg = 2,
}

/** Which faction the human player controls (set at game init, default Terran) */
export let activePlayerFaction: number = Faction.Terran;
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

// ── Unit types ──
export const enum UnitType {
  // Terran
  SCV = 1,
  Marine = 2,
  Marauder = 3,
  SiegeTank = 4,
  Medivac = 5,
  Ghost = 6,
  Hellion = 7,
  // Zerg
  Drone = 10,
  Zergling = 11,
  Baneling = 12,
  Hydralisk = 13,
  Roach = 14,
  Mutalisk = 15,
  Queen    = 16,
  Overlord = 17,
  // Additional Terran
  Reaper = 18,
  Viking = 19,
  WidowMine = 20,
  Cyclone = 21,
  Thor = 22,
  Battlecruiser = 23,
  // Additional Zerg
  Ravager   = 24,
  Lurker    = 25,
  Infestor  = 26,
  Ultralisk = 27,
  Corruptor = 28,
  Viper     = 29,
}

// ── Command modes ──
export const enum CommandMode {
  Idle = 0,
  Move = 1,
  AttackMove = 2,
  AttackTarget = 3,
  Gather = 4,
  Build = 5,
  HoldPosition = 6,
  Patrol = 7,
}

// ── Building types ──
export const enum BuildingType {
  CommandCenter = 20,
  SupplyDepot = 21,
  Barracks = 22,
  Refinery = 23,
  Factory = 24,
  Starport = 25,
  EngineeringBay = 26,
  MissileTurret = 27,
  Armory = 28,
  GhostAcademy = 29,
  // Zerg
  Hatchery = 30,
  SpawningPool = 31,
  EvolutionChamber = 32,
  Extractor = 33,
  RoachWarren = 34,
  HydraliskDen = 35,
  Spire = 36,
  InfestationPit = 37,
  SpineCrawler = 38,
  SporeCrawler = 39,
  // Neutral / Map objects
  Rock = 40,
  // Terran Advanced
  FusionCore = 44,
}

/** Units that require a TechLab addon on the producing building */
export const TECHLAB_UNITS: ReadonlySet<number> = new Set([
  UnitType.Marauder, UnitType.Ghost,       // Barracks
  UnitType.SiegeTank, UnitType.Thor, UnitType.Cyclone, // Factory
  UnitType.Battlecruiser,                  // Starport
]);

// ── Addon types ──
export const enum AddonType {
  None = 0,
  TechLab = 1,
  Reactor = 2,
}

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

// ── Worker states ──
export const enum WorkerState {
  Idle = 0,
  MovingToResource = 1,
  Mining = 2,
  ReturningToBase = 3,
  Repairing = 4,
}

// ── Siege mode states ──
export const enum SiegeMode {
  Mobile = 0,
  Sieged = 1,
  Packing = 2,
  Unpacking = 3,
}

export const enum ArmorClass {
  Light = 0,
  Armored = 1,
}

// ── Upgrade types ──
export enum UpgradeType {
  InfantryWeapons = 0,
  InfantryArmor   = 1,
  VehicleWeapons  = 2,
  ZergMelee       = 3,
  ZergRanged      = 4,
  ZergCarapace    = 5,
  COUNT           = 6,
}

// ── Ability constants ──
// Ghost Snipe
export const SNIPE_DAMAGE = 170;
export const SNIPE_ENERGY_COST = 75;
export const SNIPE_RANGE = 10; // tiles
export const SNIPE_CHANNEL_TIME = 1.5; // seconds (instant for now)

// Corruptor Caustic Spray
export const CAUSTIC_SPRAY_DPS = 4.7;
export const CAUSTIC_SPRAY_RANGE = 6; // tiles

// Cyclone Lock-On
export const LOCKON_TOTAL_DAMAGE = 400;
export const LOCKON_DURATION = 14; // seconds
export const LOCKON_RANGE = 7; // tiles (activation range)
export const LOCKON_BREAK_RANGE = 15; // tiles (lock breaks beyond this)
export const LOCKON_COOLDOWN = 4; // seconds

// Queen Transfuse
export const TRANSFUSE_HEAL = 75;
export const TRANSFUSE_ENERGY_COST = 50;
export const TRANSFUSE_RANGE = 7; // tiles

// Stim Pack (Marine + Marauder)
export const STIM_DURATION = 7.5;
export const STIM_HP_COST = 10;            // Marine HP cost
export const STIM_HP_COST_MARAUDER = 20;   // Marauder HP cost
export const STIM_SPEED_MULT = 1.5;
export const STIM_COOLDOWN_MULT = 0.5;

// Concussive Shells (Marauder)
export const SLOW_DURATION = 1.07;
export const SLOW_FACTOR = 0.5;

// Siege Mode (Siege Tank)
export const SIEGE_PACK_TIME = 2.7;
export const SIEGE_DAMAGE = 35;
export const SIEGE_RANGE = 13;
export const SIEGE_SPLASH = 1.25;
export const SIEGE_BONUS_DAMAGE = 30;      // +30 vs Armored
export const SIEGE_COOLDOWN = 2140;        // ms (mobile is 860ms)
export const SIEGE_MIN_RANGE = 2;          // tiles

// Medivac Heal
export const MEDIVAC_HEAL_RATE = 9.0;
export const MEDIVAC_HEAL_RANGE = 4;

// Roach Regen
export const ROACH_REGEN_COMBAT = 0.38;
export const ROACH_REGEN_IDLE = 7.0;
export const ROACH_COMBAT_TIMEOUT = 3.0;

// Reaper Regen (passive out-of-combat only)
export const REAPER_REGEN_RATE = 2.0;      // HP per second
export const REAPER_REGEN_TIMEOUT = 3.0;   // seconds after last damage

// Larva / Queen (Hatchery mechanics)
export const LARVA_MAX = 3;            // natural regen cap per Hatchery
export const LARVA_INJECT_MAX = 19;    // max larva including injects
export const LARVA_REGEN_TIME = 11;        // seconds per larva
export const QUEEN_ENERGY_MAX = 200;
export const QUEEN_ENERGY_REGEN = 0.7875;  // per second
export const INJECT_LARVA_COST = 25;       // energy cost
export const INJECT_LARVA_BONUS = 3;       // extra larva added after inject
export const INJECT_LARVA_TIME = 29;       // seconds for inject to complete

// ── Building constants ──
export const STARTING_SUPPLY = 10;
export const SUPPLY_PER_DEPOT = 8;
export const SUPPLY_PER_UNIT = 1;
export const BUILDING_COLOR = 0x3377bb;

// ── Economy constants ──
export const MINERAL_PER_PATCH = 1500;
export const GAS_PER_GEYSER = 2500;
export const WORKER_CARRY_MINERALS = 5;
export const WORKER_CARRY_GAS = 4;
export const MINE_DURATION = 1.5; // seconds
export const STARTING_MINERALS = 50;
export const STARTING_GAS = 0;
export const WORKER_MINE_RANGE = 48; // px (~1.5 tiles)

// ── Repair constants ──
export const REPAIR_RATE = 22.4;       // HP per second (SC2 SCV repair rate)
export const REPAIR_COST_RATIO = 0.25; // minerals per HP restored (approximate)

// Reaper KD8 Charge
export const KD8_DAMAGE = 5;
export const KD8_RADIUS = 1.5;      // tiles
export const KD8_RANGE = 5;         // tiles
export const KD8_COOLDOWN = 14;     // seconds
export const KD8_DELAY = 1.0;       // seconds before detonation

// Ghost EMP Round
export const EMP_RANGE = 10;        // tiles (cast range)
export const EMP_RADIUS = 1.5;      // tiles (effect area)
export const EMP_ENERGY_DRAIN = 100; // energy drained from targets
export const EMP_ENERGY_COST = 75;   // energy cost to cast

// Viper: Blinding Cloud
export const BLINDING_CLOUD_RANGE = 11;      // tiles (cast range)
export const BLINDING_CLOUD_RADIUS = 2;      // tiles (effect area)
export const BLINDING_CLOUD_DURATION = 6;    // seconds
export const BLINDING_CLOUD_COST = 100;      // energy

// Viper: Parasitic Bomb
export const PARASITIC_BOMB_RANGE = 8;       // tiles (cast range)
export const PARASITIC_BOMB_RADIUS = 3;      // tiles (damage area)
export const PARASITIC_BOMB_DURATION = 7;    // seconds
export const PARASITIC_BOMB_DPS = 17.14;     // ≈120 total over 7s
export const PARASITIC_BOMB_COST = 125;      // energy

// Viper Consume
export const VIPER_CONSUME_RANGE = 7;       // tiles
export const VIPER_CONSUME_HP_COST = 200;   // HP drained from allied building
export const VIPER_CONSUME_ENERGY = 50;     // energy restored

// Infestor Neural Parasite
export const NEURAL_PARASITE_RANGE = 9;     // tiles (cast range)
export const NEURAL_PARASITE_DURATION = 7;  // seconds
export const NEURAL_PARASITE_COST = 100;    // energy cost

// ── Game speed ──
export const GAME_SPEEDS = [0.5, 1.0, 1.5, 2.0] as const;
export type GameSpeed = typeof GAME_SPEEDS[number];

// ── Difficulty ──
export enum Difficulty {
  Easy = 0,
  Normal = 1,
  Hard = 2,
  Brutal = 3,
}

export interface DifficultyConfig {
  incomeMultiplier: number;       // multiply base AI income
  upgradeStartWave: number;       // wave at which AI starts upgrading (99 = never)
  waveIntervalBase: number;       // seconds between waves
  armySizeCapMultiplier: number;  // multiply max army size
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  [Difficulty.Easy]:   { incomeMultiplier: 0.5,  upgradeStartWave: 99, waveIntervalBase: 45, armySizeCapMultiplier: 0.7 },
  [Difficulty.Normal]: { incomeMultiplier: 1.0,  upgradeStartWave: 5,  waveIntervalBase: 25, armySizeCapMultiplier: 1.0 },
  [Difficulty.Hard]:   { incomeMultiplier: 1.5,  upgradeStartWave: 3,  waveIntervalBase: 18, armySizeCapMultiplier: 1.3 },
  [Difficulty.Brutal]: { incomeMultiplier: 2.0,  upgradeStartWave: 1,  waveIntervalBase: 12, armySizeCapMultiplier: 1.6 },
};

// ── AI constants ──
// Most AI tuning is now in AISystem.ts (phase-based build orders, wave timing)
export const AI_SPAWN_BASE_COL = 117;
export const AI_SPAWN_BASE_ROW = 117;

// ── Colors ──
export const TERRAN_COLOR = 0x55aaff;
export const ZERG_COLOR = 0xee4444;
export const MINERAL_COLOR = 0x55ddff;
export const GAS_COLOR = 0x66ff88;
export const GROUND_COLOR = 0x5aa830;
export const UNBUILDABLE_COLOR = 0x554433;
export const WATER_COLOR = 0x2288dd;
export const ROCK_COLOR = 0x998877;
export const SELECTION_COLOR = 0x00ff00;

// ── Unified Colour Palette ──
export const TERRAN_VISOR     = 0x22ffff;
export const TERRAN_METAL     = 0x667788;
export const TERRAN_DARK      = 0x223355;
export const TERRAN_HIGHLIGHT = 0x88bbee;
export const TERRAN_WARNING   = 0xff7733;
export const ZERG_ACID        = 0x99ff44;
export const ZERG_EYE         = 0xff4422;
export const ZERG_FLESH       = 0xaa3355;
export const MINERAL_CRYSTAL  = 0x55ddff;
export const GAS_GREEN        = 0x66ff88;
export const NEUTRAL_STONE    = 0xaaaaaa;
