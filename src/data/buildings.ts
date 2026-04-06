/**
 * RTS.io — Building Definitions (4 Launch Factions, 28 buildings + neutral)
 */

import { Faction, BuildingType, UnitType, FACTION_COLORS, ROCK_COLOR, NEUTRAL_STONE } from '../constants';
import type { BuildingDef } from '../types';

const L = FACTION_COLORS[Faction.IronLegion];
const S = FACTION_COLORS[Faction.Swarm];
const A = FACTION_COLORS[Faction.ArcaneCovenant];
const M = FACTION_COLORS[Faction.Automata];

export const BUILDING_DEFS: Record<number, BuildingDef> = {

  // ═══════════════════════════════════════════════════════════════════
  // IRON LEGION
  // ═══════════════════════════════════════════════════════════════════

  [BuildingType.Headquarters]: {
    type: BuildingType.Headquarters, name: 'Headquarters', faction: Faction.IronLegion, tier: 1,
    hp: 1500, costMinerals: 400, costGas: 0, buildTime: 60,
    tileWidth: 3, tileHeight: 3, supplyProvided: 15, color: L,
    produces: [], requires: null,
  },
  [BuildingType.Barracks]: {
    type: BuildingType.Barracks, name: 'Barracks', faction: Faction.IronLegion, tier: 1,
    hp: 800, costMinerals: 150, costGas: 0, buildTime: 30,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: L,
    produces: [UnitType.Trooper, UnitType.Grenadier, UnitType.Medic],
    requires: null,
  },
  [BuildingType.WarFactory]: {
    type: BuildingType.WarFactory, name: 'War Factory', faction: Faction.IronLegion, tier: 2,
    hp: 1000, costMinerals: 200, costGas: 100, buildTime: 40,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: L,
    produces: [UnitType.Humvee, UnitType.SiegeTank],
    requires: BuildingType.Barracks,
  },
  [BuildingType.Airfield]: {
    type: BuildingType.Airfield, name: 'Airfield', faction: Faction.IronLegion, tier: 3,
    hp: 900, costMinerals: 200, costGas: 150, buildTime: 45,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: L,
    produces: [UnitType.Gunship],
    requires: BuildingType.WarFactory,
  },
  [BuildingType.CommandUplink]: {
    type: BuildingType.CommandUplink, name: 'Command Uplink', faction: Faction.IronLegion, tier: 4,
    hp: 600, costMinerals: 300, costGas: 200, buildTime: 50,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: L,
    produces: [UnitType.TitanWalker],
    requires: BuildingType.Airfield,
  },
  [BuildingType.Bunker]: {
    type: BuildingType.Bunker, name: 'Bunker', faction: Faction.IronLegion, tier: 1,
    hp: 400, costMinerals: 100, costGas: 0, buildTime: 20,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: L,
    produces: [], requires: null,
    damage: 10, range: 6, attackCooldown: 800, canTargetGround: 1, canTargetAir: 1,
  },
  [BuildingType.Extractor_L]: {
    type: BuildingType.Extractor_L, name: 'Extractor', faction: Faction.IronLegion, tier: 1,
    hp: 300, costMinerals: 75, costGas: 0, buildTime: 15,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: L,
    produces: [], requires: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // THE SWARM
  // ═══════════════════════════════════════════════════════════════════

  [BuildingType.Hive]: {
    type: BuildingType.Hive, name: 'Hive', faction: Faction.Swarm, tier: 1,
    hp: 1400, costMinerals: 350, costGas: 0, buildTime: 55,
    tileWidth: 3, tileHeight: 3, supplyProvided: 15, color: S,
    produces: [], requires: null,
  },
  [BuildingType.SpawnPit]: {
    type: BuildingType.SpawnPit, name: 'Spawn Pit', faction: Faction.Swarm, tier: 1,
    hp: 700, costMinerals: 125, costGas: 0, buildTime: 25,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: S,
    produces: [UnitType.Drone, UnitType.Spitter, UnitType.Burrower],
    requires: null,
  },
  [BuildingType.EvolutionDen]: {
    type: BuildingType.EvolutionDen, name: 'Evolution Den', faction: Faction.Swarm, tier: 2,
    hp: 900, costMinerals: 175, costGas: 75, buildTime: 35,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: S,
    produces: [UnitType.Broodmother, UnitType.Ravager],
    requires: BuildingType.SpawnPit,
  },
  [BuildingType.Rookery]: {
    type: BuildingType.Rookery, name: 'Rookery', faction: Faction.Swarm, tier: 3,
    hp: 800, costMinerals: 175, costGas: 125, buildTime: 40,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: S,
    produces: [UnitType.Flyer],
    requires: BuildingType.EvolutionDen,
  },
  [BuildingType.ApexChamber]: {
    type: BuildingType.ApexChamber, name: 'Apex Chamber', faction: Faction.Swarm, tier: 4,
    hp: 600, costMinerals: 250, costGas: 200, buildTime: 50,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: S,
    produces: [UnitType.Leviathan],
    requires: BuildingType.Rookery,
  },
  [BuildingType.SpineTower]: {
    type: BuildingType.SpineTower, name: 'Spine Tower', faction: Faction.Swarm, tier: 1,
    hp: 350, costMinerals: 75, costGas: 0, buildTime: 18,
    tileWidth: 1, tileHeight: 1, supplyProvided: 0, color: S,
    produces: [], requires: null,
    damage: 12, range: 7, attackCooldown: 1000, canTargetGround: 1, canTargetAir: 0,
  },
  [BuildingType.Extractor_S]: {
    type: BuildingType.Extractor_S, name: 'Extractor', faction: Faction.Swarm, tier: 1,
    hp: 250, costMinerals: 60, costGas: 0, buildTime: 12,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: S,
    produces: [], requires: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ARCANE COVENANT
  // ═══════════════════════════════════════════════════════════════════

  [BuildingType.Sanctum]: {
    type: BuildingType.Sanctum, name: 'Sanctum', faction: Faction.ArcaneCovenant, tier: 1,
    hp: 1200, costMinerals: 400, costGas: 0, buildTime: 60,
    tileWidth: 3, tileHeight: 3, supplyProvided: 15, color: A,
    produces: [], requires: null,
  },
  [BuildingType.Gateway]: {
    type: BuildingType.Gateway, name: 'Gateway', faction: Faction.ArcaneCovenant, tier: 1,
    hp: 750, costMinerals: 150, costGas: 0, buildTime: 30,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: A,
    produces: [UnitType.Acolyte, UnitType.Warden],
    requires: null,
  },
  [BuildingType.ArcaneLibrary]: {
    type: BuildingType.ArcaneLibrary, name: 'Arcane Library', faction: Faction.ArcaneCovenant, tier: 2,
    hp: 850, costMinerals: 200, costGas: 100, buildTime: 40,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: A,
    produces: [UnitType.Enchanter, UnitType.BlinkAssassin],
    requires: BuildingType.Gateway,
  },
  [BuildingType.Observatory]: {
    type: BuildingType.Observatory, name: 'Observatory', faction: Faction.ArcaneCovenant, tier: 3,
    hp: 750, costMinerals: 200, costGas: 150, buildTime: 45,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: A,
    produces: [UnitType.StormCaller, UnitType.Golem],
    requires: BuildingType.ArcaneLibrary,
  },
  [BuildingType.NexusPrime]: {
    type: BuildingType.NexusPrime, name: 'Nexus Prime', faction: Faction.ArcaneCovenant, tier: 4,
    hp: 500, costMinerals: 350, costGas: 250, buildTime: 55,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: A,
    produces: [UnitType.Archmage],
    requires: BuildingType.Observatory,
  },
  [BuildingType.WardStone]: {
    type: BuildingType.WardStone, name: 'Ward Stone', faction: Faction.ArcaneCovenant, tier: 1,
    hp: 300, costMinerals: 100, costGas: 25, buildTime: 22,
    tileWidth: 1, tileHeight: 1, supplyProvided: 0, color: A,
    produces: [], requires: null,
    damage: 15, range: 8, attackCooldown: 1200, canTargetGround: 1, canTargetAir: 1,
  },
  [BuildingType.Extractor_A]: {
    type: BuildingType.Extractor_A, name: 'Extractor', faction: Faction.ArcaneCovenant, tier: 1,
    hp: 250, costMinerals: 75, costGas: 0, buildTime: 15,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: A,
    produces: [], requires: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // AUTOMATA
  // ═══════════════════════════════════════════════════════════════════

  [BuildingType.CoreNode]: {
    type: BuildingType.CoreNode, name: 'Core Node', faction: Faction.Automata, tier: 1,
    hp: 1600, costMinerals: 400, costGas: 0, buildTime: 60,
    tileWidth: 3, tileHeight: 3, supplyProvided: 15, color: M,
    produces: [], requires: null,
  },
  [BuildingType.AssemblyLine]: {
    type: BuildingType.AssemblyLine, name: 'Assembly Line', faction: Faction.Automata, tier: 1,
    hp: 850, costMinerals: 150, costGas: 0, buildTime: 30,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: M,
    produces: [UnitType.Sentinel, UnitType.Shredder],
    requires: null,
  },
  [BuildingType.AdvancedForge]: {
    type: BuildingType.AdvancedForge, name: 'Advanced Forge', faction: Faction.Automata, tier: 2,
    hp: 1000, costMinerals: 200, costGas: 100, buildTime: 40,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: M,
    produces: [UnitType.RepairDrone, UnitType.Crawler],
    requires: BuildingType.AssemblyLine,
  },
  [BuildingType.Skyport]: {
    type: BuildingType.Skyport, name: 'Skyport', faction: Faction.Automata, tier: 3,
    hp: 900, costMinerals: 200, costGas: 150, buildTime: 45,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: M,
    produces: [UnitType.Disruptor, UnitType.Harvester],
    requires: BuildingType.AdvancedForge,
  },
  [BuildingType.OmegaReactor]: {
    type: BuildingType.OmegaReactor, name: 'Omega Reactor', faction: Faction.Automata, tier: 4,
    hp: 600, costMinerals: 300, costGas: 200, buildTime: 55,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: M,
    produces: [UnitType.Colossus],
    requires: BuildingType.Skyport,
  },
  [BuildingType.TurretArray]: {
    type: BuildingType.TurretArray, name: 'Turret Array', faction: Faction.Automata, tier: 1,
    hp: 400, costMinerals: 100, costGas: 0, buildTime: 20,
    tileWidth: 1, tileHeight: 1, supplyProvided: 0, color: M,
    produces: [], requires: null,
    damage: 8, range: 7, attackCooldown: 600, canTargetGround: 1, canTargetAir: 1,
  },
  [BuildingType.Extractor_M]: {
    type: BuildingType.Extractor_M, name: 'Extractor', faction: Faction.Automata, tier: 1,
    hp: 350, costMinerals: 75, costGas: 0, buildTime: 15,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: M,
    produces: [], requires: null,
  },

  // ═══════════════════════════════════════════════════════════════════
  // NEUTRAL
  // ═══════════════════════════════════════════════════════════════════

  [BuildingType.Rock]: {
    type: BuildingType.Rock, name: 'Rock', faction: Faction.None, tier: 0,
    hp: 500, costMinerals: 0, costGas: 0, buildTime: 0,
    tileWidth: 2, tileHeight: 2, supplyProvided: 0, color: ROCK_COLOR,
    produces: [], requires: null,
  },
};

/** Get the HQ building type for a faction. */
export function getHQBuildingType(fac: number): BuildingType {
  switch (fac) {
    case Faction.IronLegion: return BuildingType.Headquarters;
    case Faction.Swarm: return BuildingType.Hive;
    case Faction.ArcaneCovenant: return BuildingType.Sanctum;
    case Faction.Automata: return BuildingType.CoreNode;
    default: return BuildingType.Headquarters;
  }
}

/** Get the first production building type for a faction. */
export function getT1ProductionType(fac: number): BuildingType {
  switch (fac) {
    case Faction.IronLegion: return BuildingType.Barracks;
    case Faction.Swarm: return BuildingType.SpawnPit;
    case Faction.ArcaneCovenant: return BuildingType.Gateway;
    case Faction.Automata: return BuildingType.AssemblyLine;
    default: return BuildingType.Barracks;
  }
}
