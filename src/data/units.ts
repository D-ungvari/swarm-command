/**
 * RTS.io — Unit Definitions (4 Launch Factions, 28 units)
 */

import { Faction, UnitType, ArmorClass, FACTION_COLORS } from '../constants';
import type { UnitDef } from '../types';

const L = FACTION_COLORS[Faction.IronLegion];
const S = FACTION_COLORS[Faction.Swarm];
const A = FACTION_COLORS[Faction.ArcaneCovenant];
const M = FACTION_COLORS[Faction.Automata];

export const UNIT_DEFS: Record<number, UnitDef> = {

  // ═══════════════════════════════════════════════════════════════════
  // IRON LEGION — balanced combined-arms military
  // ═══════════════════════════════════════════════════════════════════

  [UnitType.Trooper]: {
    type: UnitType.Trooper, name: 'Trooper', faction: Faction.IronLegion, tier: 1,
    hp: 50, shield: 0, damage: 7, range: 5, speed: 3.0, attackCooldown: 650, splashRadius: 0,
    width: 16, height: 16, color: L,
    costMinerals: 50, costGas: 0, buildTime: 12, supply: 1,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Grenadier]: {
    type: UnitType.Grenadier, name: 'Grenadier', faction: Faction.IronLegion, tier: 1,
    hp: 75, shield: 0, damage: 12, range: 4, speed: 2.5, attackCooldown: 1200, splashRadius: 0.8,
    width: 18, height: 18, color: L,
    costMinerals: 75, costGas: 25, buildTime: 16, supply: 2,
    bonusDamage: 8, bonusVsTag: ArmorClass.Light, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Medic]: {
    type: UnitType.Medic, name: 'Medic', faction: Faction.IronLegion, tier: 2,
    hp: 60, shield: 0, damage: 0, range: 0, speed: 3.0, attackCooldown: 0, splashRadius: 0,
    width: 16, height: 16, color: L,
    costMinerals: 75, costGas: 50, buildTime: 18, supply: 1,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 0, canTargetAir: 0,
  },
  [UnitType.Humvee]: {
    type: UnitType.Humvee, name: 'Humvee', faction: Faction.IronLegion, tier: 2,
    hp: 90, shield: 0, damage: 8, range: 5, speed: 4.5, attackCooldown: 500, splashRadius: 0,
    width: 22, height: 14, color: L,
    costMinerals: 100, costGas: 50, buildTime: 16, supply: 2,
    bonusDamage: 4, bonusVsTag: ArmorClass.Light, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.SiegeTank]: {
    type: UnitType.SiegeTank, name: 'Siege Tank', faction: Faction.IronLegion, tier: 2,
    hp: 160, shield: 0, damage: 15, range: 7, speed: 2.5, attackCooldown: 1800, splashRadius: 0,
    width: 24, height: 24, color: L,
    costMinerals: 150, costGas: 100, buildTime: 24, supply: 3,
    bonusDamage: 10, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Gunship]: {
    type: UnitType.Gunship, name: 'Gunship', faction: Faction.IronLegion, tier: 3,
    hp: 140, shield: 0, damage: 12, range: 6, speed: 3.5, attackCooldown: 800, splashRadius: 0,
    width: 28, height: 20, color: L,
    costMinerals: 200, costGas: 150, buildTime: 30, supply: 3,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 1, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.TitanWalker]: {
    type: UnitType.TitanWalker, name: 'Titan Walker', faction: Faction.IronLegion, tier: 4,
    hp: 500, shield: 0, damage: 25, range: 8, speed: 1.8, attackCooldown: 1500, splashRadius: 1.0,
    width: 40, height: 40, color: L,
    costMinerals: 400, costGas: 300, buildTime: 50, supply: 6,
    bonusDamage: 15, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Massive, baseArmor: 3,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },

  // ═══════════════════════════════════════════════════════════════════
  // THE SWARM — cheap, expendable, overwhelming numbers
  // ═══════════════════════════════════════════════════════════════════

  [UnitType.Drone]: {
    type: UnitType.Drone, name: 'Drone', faction: Faction.Swarm, tier: 1,
    hp: 30, shield: 0, damage: 5, range: 0.5, speed: 4.0, attackCooldown: 500, splashRadius: 0,
    width: 12, height: 12, color: S,
    costMinerals: 25, costGas: 0, buildTime: 8, supply: 0.5,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Spitter]: {
    type: UnitType.Spitter, name: 'Spitter', faction: Faction.Swarm, tier: 1,
    hp: 35, shield: 0, damage: 8, range: 5, speed: 3.0, attackCooldown: 900, splashRadius: 0,
    width: 14, height: 14, color: S,
    costMinerals: 40, costGas: 10, buildTime: 10, supply: 1,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Burrower]: {
    type: UnitType.Burrower, name: 'Burrower', faction: Faction.Swarm, tier: 2,
    hp: 80, shield: 0, damage: 20, range: 0.5, speed: 3.5, attackCooldown: 1200, splashRadius: 0,
    width: 16, height: 16, color: S,
    costMinerals: 75, costGas: 25, buildTime: 16, supply: 2,
    bonusDamage: 5, bonusVsTag: ArmorClass.Light, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Broodmother]: {
    type: UnitType.Broodmother, name: 'Broodmother', faction: Faction.Swarm, tier: 2,
    hp: 120, shield: 0, damage: 0, range: 0, speed: 2.0, attackCooldown: 0, splashRadius: 0,
    width: 24, height: 24, color: S,
    costMinerals: 100, costGas: 50, buildTime: 24, supply: 2,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 0, canTargetAir: 0,
  },
  [UnitType.Ravager]: {
    type: UnitType.Ravager, name: 'Ravager', faction: Faction.Swarm, tier: 2,
    hp: 140, shield: 0, damage: 14, range: 1, speed: 3.0, attackCooldown: 1000, splashRadius: 0,
    width: 22, height: 22, color: S,
    costMinerals: 100, costGas: 50, buildTime: 18, supply: 2,
    bonusDamage: 8, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Armored, baseArmor: 2,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Flyer]: {
    type: UnitType.Flyer, name: 'Flyer', faction: Faction.Swarm, tier: 3,
    hp: 80, shield: 0, damage: 10, range: 3, speed: 5.0, attackCooldown: 700, splashRadius: 0,
    width: 18, height: 18, color: S,
    costMinerals: 100, costGas: 75, buildTime: 20, supply: 2,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 1, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Leviathan]: {
    type: UnitType.Leviathan, name: 'Leviathan', faction: Faction.Swarm, tier: 4,
    hp: 450, shield: 0, damage: 30, range: 2, speed: 1.5, attackCooldown: 2000, splashRadius: 1.5,
    width: 44, height: 44, color: S,
    costMinerals: 350, costGas: 250, buildTime: 50, supply: 6,
    bonusDamage: 20, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Massive, baseArmor: 3,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  // ═══════════════════════════════════════════════════════════════════
  // ARCANE COVENANT — expensive, shielded, powerful casters
  // ═══════════════════════════════════════════════════════════════════

  [UnitType.Acolyte]: {
    type: UnitType.Acolyte, name: 'Acolyte', faction: Faction.ArcaneCovenant, tier: 1,
    hp: 40, shield: 30, damage: 8, range: 6, speed: 2.8, attackCooldown: 800, splashRadius: 0,
    width: 16, height: 16, color: A,
    costMinerals: 60, costGas: 10, buildTime: 14, supply: 1,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Warden]: {
    type: UnitType.Warden, name: 'Warden', faction: Faction.ArcaneCovenant, tier: 1,
    hp: 80, shield: 60, damage: 10, range: 1, speed: 2.5, attackCooldown: 900, splashRadius: 0,
    width: 20, height: 20, color: A,
    costMinerals: 75, costGas: 25, buildTime: 18, supply: 2,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Enchanter]: {
    type: UnitType.Enchanter, name: 'Enchanter', faction: Faction.ArcaneCovenant, tier: 2,
    hp: 50, shield: 40, damage: 0, range: 0, speed: 2.5, attackCooldown: 0, splashRadius: 0,
    width: 16, height: 16, color: A,
    costMinerals: 100, costGas: 75, buildTime: 22, supply: 2,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 0, canTargetAir: 0,
  },
  [UnitType.BlinkAssassin]: {
    type: UnitType.BlinkAssassin, name: 'Blink Assassin', faction: Faction.ArcaneCovenant, tier: 2,
    hp: 60, shield: 50, damage: 18, range: 5, speed: 3.5, attackCooldown: 1100, splashRadius: 0,
    width: 16, height: 16, color: A,
    costMinerals: 125, costGas: 75, buildTime: 24, supply: 2,
    bonusDamage: 5, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.StormCaller]: {
    type: UnitType.StormCaller, name: 'Storm Caller', faction: Faction.ArcaneCovenant, tier: 3,
    hp: 45, shield: 60, damage: 25, range: 9, speed: 2.0, attackCooldown: 2500, splashRadius: 2.0,
    width: 16, height: 16, color: A,
    costMinerals: 200, costGas: 150, buildTime: 35, supply: 3,
    bonusDamage: 10, bonusVsTag: ArmorClass.Light, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Golem]: {
    type: UnitType.Golem, name: 'Golem', faction: Faction.ArcaneCovenant, tier: 3,
    hp: 200, shield: 100, damage: 20, range: 2, speed: 1.8, attackCooldown: 1400, splashRadius: 0,
    width: 30, height: 30, color: A,
    costMinerals: 175, costGas: 100, buildTime: 30, supply: 4,
    bonusDamage: 15, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Massive, baseArmor: 2,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Archmage]: {
    type: UnitType.Archmage, name: 'Archmage', faction: Faction.ArcaneCovenant, tier: 4,
    hp: 120, shield: 200, damage: 30, range: 10, speed: 3.0, attackCooldown: 2000, splashRadius: 1.5,
    width: 28, height: 28, color: A,
    costMinerals: 400, costGas: 350, buildTime: 55, supply: 6,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 1, canTargetGround: 1, canTargetAir: 1,
  },

  // ═══════════════════════════════════════════════════════════════════
  // AUTOMATA — self-repairing machines, attrition warfare
  // ═══════════════════════════════════════════════════════════════════

  [UnitType.Sentinel]: {
    type: UnitType.Sentinel, name: 'Sentinel', faction: Faction.Automata, tier: 1,
    hp: 55, shield: 0, damage: 6, range: 5, speed: 2.8, attackCooldown: 700, splashRadius: 0,
    width: 16, height: 16, color: M,
    costMinerals: 55, costGas: 0, buildTime: 13, supply: 1,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Armored, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Shredder]: {
    type: UnitType.Shredder, name: 'Shredder', faction: Faction.Automata, tier: 1,
    hp: 70, shield: 0, damage: 12, range: 0.5, speed: 3.5, attackCooldown: 600, splashRadius: 0,
    width: 16, height: 16, color: M,
    costMinerals: 60, costGas: 10, buildTime: 12, supply: 1,
    bonusDamage: 4, bonusVsTag: ArmorClass.Light, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.RepairDrone]: {
    type: UnitType.RepairDrone, name: 'Repair Drone', faction: Faction.Automata, tier: 2,
    hp: 50, shield: 0, damage: 0, range: 0, speed: 3.5, attackCooldown: 0, splashRadius: 0,
    width: 14, height: 14, color: M,
    costMinerals: 75, costGas: 50, buildTime: 16, supply: 1,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 1, canTargetGround: 0, canTargetAir: 0,
  },
  [UnitType.Crawler]: {
    type: UnitType.Crawler, name: 'Crawler', faction: Faction.Automata, tier: 2,
    hp: 130, shield: 0, damage: 10, range: 6, speed: 3.0, attackCooldown: 900, splashRadius: 0,
    width: 22, height: 14, color: M,
    costMinerals: 125, costGas: 50, buildTime: 20, supply: 2,
    bonusDamage: 5, bonusVsTag: ArmorClass.Armored, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Disruptor]: {
    type: UnitType.Disruptor, name: 'Disruptor', faction: Faction.Automata, tier: 3,
    hp: 80, shield: 0, damage: 8, range: 7, speed: 2.5, attackCooldown: 1200, splashRadius: 0,
    width: 18, height: 18, color: M,
    costMinerals: 150, costGas: 125, buildTime: 28, supply: 3,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Armored, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },
  [UnitType.Harvester]: {
    type: UnitType.Harvester, name: 'Harvester', faction: Faction.Automata, tier: 3,
    hp: 100, shield: 0, damage: 5, range: 3, speed: 2.5, attackCooldown: 1500, splashRadius: 0,
    width: 20, height: 20, color: M,
    costMinerals: 125, costGas: 75, buildTime: 22, supply: 2,
    bonusDamage: 0, bonusVsTag: -1, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
  [UnitType.Colossus]: {
    type: UnitType.Colossus, name: 'Colossus', faction: Faction.Automata, tier: 4,
    hp: 550, shield: 0, damage: 20, range: 9, speed: 1.5, attackCooldown: 1200, splashRadius: 1.0,
    width: 36, height: 44, color: M,
    costMinerals: 400, costGas: 300, buildTime: 55, supply: 6,
    bonusDamage: 10, bonusVsTag: ArmorClass.Light, armorClass: ArmorClass.Massive, baseArmor: 2,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },
};
