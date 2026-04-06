/**
 * RTS.io Unit Definitions — 4 Launch Factions
 *
 * ~8 units per faction across 4 tiers.
 * Stats are balanced for fast-paced .io arena play (15-25 min matches).
 */

import { FactionId } from './factions';

// ─── Unit Type Enum ──────────────────────────────────────────────────────
// Ranges: 100-199 Iron Legion, 200-299 Swarm, 300-399 Arcane, 400-499 Automata

export const enum ArenaUnitType {
  // ── Iron Legion (100s) ──
  Trooper      = 101, // T1 basic ranged infantry
  Grenadier    = 102, // T1 splash damage anti-swarm
  Medic        = 103, // T2 healer (aura heal)
  Humvee       = 104, // T2 fast light vehicle
  SiegeTank    = 105, // T2 deployable artillery
  Gunship      = 106, // T3 air-to-ground
  TitanWalker  = 107, // T4 heavy mech

  // ── The Swarm (200s) ──
  Drone        = 201, // T1 cheap melee
  Spitter      = 202, // T1 ranged acid
  Burrower     = 203, // T2 stealth ambush
  Broodmother  = 204, // T2 auto-spawns drones
  Ravager      = 205, // T2 heavy melee armored
  Flyer        = 206, // T3 fast air harasser
  Leviathan    = 207, // T4 massive siege beast

  // ── Arcane Covenant (300s) ──
  Acolyte      = 301, // T1 basic ranged caster
  Warden       = 302, // T1 melee tank with shield
  Enchanter    = 303, // T2 buff aura (+attack speed)
  BlinkAssassin = 304, // T2 teleport burst damage
  StormCaller  = 305, // T3 AOE lightning
  Golem        = 306, // T3 slow armored construct
  Archmage     = 307, // T4 flying caster

  // ── Automata (400s) ──
  Sentinel     = 401, // T1 basic ranged bot
  Shredder     = 402, // T1 melee buzzsaw
  RepairDrone  = 403, // T2 heals mechanical
  Crawler      = 404, // T2 spider tank all-terrain
  Disruptor    = 405, // T3 EMP blast
  Harvester    = 406, // T3 reclaims wreckage
  Colossus     = 407, // T4 walking fortress
}

// ─── Armor Classes ───────────────────────────────────────────────────────

export const enum ArmorClass {
  Light = 0,
  Heavy = 1,
  Armored = 2,
  Massive = 3,
}

// ─── Unit Definition ─────────────────────────────────────────────────────

export interface ArenaUnitDef {
  type: ArenaUnitType;
  name: string;
  faction: FactionId;
  tier: 1 | 2 | 3 | 4;

  // Combat stats
  hp: number;
  shield: number;       // Arcane Covenant units have shields
  damage: number;
  range: number;         // tiles
  speed: number;         // tiles/sec
  attackCooldown: number; // milliseconds
  splashRadius: number;  // tiles (0 = no splash)

  // Rendering
  width: number;   // px
  height: number;  // px
  color: number;   // hex tint

  // Economy
  costMinerals: number;
  costGas: number;
  buildTime: number;  // seconds
  supply: number;

  // Armor
  bonusDamage: number;
  bonusVsClass: ArmorClass | -1;
  armorClass: ArmorClass;
  baseArmor: number;

  // Flags
  isAir: 0 | 1;
  canTargetGround: 0 | 1;
  canTargetAir: 0 | 1;
}

// ─── Faction Colors ──────────────────────────────────────────────────────

const LEGION_COLOR = 0x4488cc;
const SWARM_COLOR = 0x88cc44;
const ARCANE_COLOR = 0xaa66dd;
const AUTOMATA_COLOR = 0xcc8844;

// ─── Unit Tables ─────────────────────────────────────────────────────────

export const ARENA_UNIT_DEFS: Record<number, ArenaUnitDef> = {

  // ════════════════════════════════════════════════════════════════════════
  // IRON LEGION — balanced combined-arms military
  // ════════════════════════════════════════════════════════════════════════

  [ArenaUnitType.Trooper]: {
    type: ArenaUnitType.Trooper, name: 'Trooper', faction: FactionId.IronLegion, tier: 1,
    hp: 50, shield: 0, damage: 7, range: 5, speed: 3.0, attackCooldown: 650, splashRadius: 0,
    width: 16, height: 16, color: LEGION_COLOR,
    costMinerals: 50, costGas: 0, buildTime: 12, supply: 1,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },

  [ArenaUnitType.Grenadier]: {
    type: ArenaUnitType.Grenadier, name: 'Grenadier', faction: FactionId.IronLegion, tier: 1,
    hp: 75, shield: 0, damage: 12, range: 4, speed: 2.5, attackCooldown: 1200, splashRadius: 0.8,
    width: 18, height: 18, color: LEGION_COLOR,
    costMinerals: 75, costGas: 25, buildTime: 16, supply: 2,
    bonusDamage: 8, bonusVsClass: ArmorClass.Light, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  [ArenaUnitType.Medic]: {
    type: ArenaUnitType.Medic, name: 'Medic', faction: FactionId.IronLegion, tier: 2,
    hp: 60, shield: 0, damage: 0, range: 0, speed: 3.0, attackCooldown: 0, splashRadius: 0,
    width: 16, height: 16, color: LEGION_COLOR,
    costMinerals: 75, costGas: 50, buildTime: 18, supply: 1,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 0, canTargetAir: 0,
    // Special: heals nearby friendly bio units at 9 HP/s in 4-tile radius
  },

  [ArenaUnitType.Humvee]: {
    type: ArenaUnitType.Humvee, name: 'Humvee', faction: FactionId.IronLegion, tier: 2,
    hp: 90, shield: 0, damage: 8, range: 5, speed: 4.5, attackCooldown: 500, splashRadius: 0,
    width: 22, height: 14, color: LEGION_COLOR,
    costMinerals: 100, costGas: 50, buildTime: 16, supply: 2,
    bonusDamage: 4, bonusVsClass: ArmorClass.Light, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  [ArenaUnitType.SiegeTank]: {
    type: ArenaUnitType.SiegeTank, name: 'Siege Tank', faction: FactionId.IronLegion, tier: 2,
    hp: 160, shield: 0, damage: 15, range: 7, speed: 2.5, attackCooldown: 1800, splashRadius: 0,
    width: 24, height: 24, color: LEGION_COLOR,
    costMinerals: 150, costGas: 100, buildTime: 24, supply: 3,
    bonusDamage: 10, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
    // Special: deploys into siege mode — 30 dmg, 13 range, 1.25 splash, can't move
  },

  [ArenaUnitType.Gunship]: {
    type: ArenaUnitType.Gunship, name: 'Gunship', faction: FactionId.IronLegion, tier: 3,
    hp: 140, shield: 0, damage: 12, range: 6, speed: 3.5, attackCooldown: 800, splashRadius: 0,
    width: 28, height: 20, color: LEGION_COLOR,
    costMinerals: 200, costGas: 150, buildTime: 30, supply: 3,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 1, canTargetGround: 1, canTargetAir: 1,
  },

  [ArenaUnitType.TitanWalker]: {
    type: ArenaUnitType.TitanWalker, name: 'Titan Walker', faction: FactionId.IronLegion, tier: 4,
    hp: 500, shield: 0, damage: 25, range: 8, speed: 1.8, attackCooldown: 1500, splashRadius: 1.0,
    width: 40, height: 40, color: LEGION_COLOR,
    costMinerals: 400, costGas: 300, buildTime: 50, supply: 6,
    bonusDamage: 15, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Massive, baseArmor: 3,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },

  // ════════════════════════════════════════════════════════════════════════
  // THE SWARM — cheap, expendable, overwhelming numbers
  // ════════════════════════════════════════════════════════════════════════

  [ArenaUnitType.Drone]: {
    type: ArenaUnitType.Drone, name: 'Drone', faction: FactionId.Swarm, tier: 1,
    hp: 30, shield: 0, damage: 5, range: 0.5, speed: 4.0, attackCooldown: 500, splashRadius: 0,
    width: 12, height: 12, color: SWARM_COLOR,
    costMinerals: 25, costGas: 0, buildTime: 8, supply: 0.5,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  [ArenaUnitType.Spitter]: {
    type: ArenaUnitType.Spitter, name: 'Spitter', faction: FactionId.Swarm, tier: 1,
    hp: 35, shield: 0, damage: 8, range: 5, speed: 3.0, attackCooldown: 900, splashRadius: 0,
    width: 14, height: 14, color: SWARM_COLOR,
    costMinerals: 40, costGas: 10, buildTime: 10, supply: 1,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },

  [ArenaUnitType.Burrower]: {
    type: ArenaUnitType.Burrower, name: 'Burrower', faction: FactionId.Swarm, tier: 2,
    hp: 80, shield: 0, damage: 20, range: 0.5, speed: 3.5, attackCooldown: 1200, splashRadius: 0,
    width: 16, height: 16, color: SWARM_COLOR,
    costMinerals: 75, costGas: 25, buildTime: 16, supply: 2,
    bonusDamage: 5, bonusVsClass: ArmorClass.Light, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
    // Special: can burrow (stealth + immobile), ambush bonus = 2x first attack damage
  },

  [ArenaUnitType.Broodmother]: {
    type: ArenaUnitType.Broodmother, name: 'Broodmother', faction: FactionId.Swarm, tier: 2,
    hp: 120, shield: 0, damage: 0, range: 0, speed: 2.0, attackCooldown: 0, splashRadius: 0,
    width: 24, height: 24, color: SWARM_COLOR,
    costMinerals: 100, costGas: 50, buildTime: 24, supply: 2,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 0, canTargetAir: 0,
    // Special: passively spawns 1 free Drone every 8 seconds (max 4 active)
  },

  [ArenaUnitType.Ravager]: {
    type: ArenaUnitType.Ravager, name: 'Ravager', faction: FactionId.Swarm, tier: 2,
    hp: 140, shield: 0, damage: 14, range: 1, speed: 3.0, attackCooldown: 1000, splashRadius: 0,
    width: 22, height: 22, color: SWARM_COLOR,
    costMinerals: 100, costGas: 50, buildTime: 18, supply: 2,
    bonusDamage: 8, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Armored, baseArmor: 2,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  [ArenaUnitType.Flyer]: {
    type: ArenaUnitType.Flyer, name: 'Flyer', faction: FactionId.Swarm, tier: 3,
    hp: 80, shield: 0, damage: 10, range: 3, speed: 5.0, attackCooldown: 700, splashRadius: 0,
    width: 18, height: 18, color: SWARM_COLOR,
    costMinerals: 100, costGas: 75, buildTime: 20, supply: 2,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 1, canTargetGround: 1, canTargetAir: 1,
    // Special: bounce attack (hits 2 additional nearby targets at 33% damage)
  },

  [ArenaUnitType.Leviathan]: {
    type: ArenaUnitType.Leviathan, name: 'Leviathan', faction: FactionId.Swarm, tier: 4,
    hp: 450, shield: 0, damage: 30, range: 2, speed: 1.5, attackCooldown: 2000, splashRadius: 1.5,
    width: 44, height: 44, color: SWARM_COLOR,
    costMinerals: 350, costGas: 250, buildTime: 50, supply: 6,
    bonusDamage: 20, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Massive, baseArmor: 3,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  // ════════════════════════════════════════════════════════════════════════
  // ARCANE COVENANT — expensive, shielded, powerful casters
  // ════════════════════════════════════════════════════════════════════════

  [ArenaUnitType.Acolyte]: {
    type: ArenaUnitType.Acolyte, name: 'Acolyte', faction: FactionId.ArcaneCovenant, tier: 1,
    hp: 40, shield: 30, damage: 8, range: 6, speed: 2.8, attackCooldown: 800, splashRadius: 0,
    width: 16, height: 16, color: ARCANE_COLOR,
    costMinerals: 60, costGas: 10, buildTime: 14, supply: 1,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
  },

  [ArenaUnitType.Warden]: {
    type: ArenaUnitType.Warden, name: 'Warden', faction: FactionId.ArcaneCovenant, tier: 1,
    hp: 80, shield: 60, damage: 10, range: 1, speed: 2.5, attackCooldown: 900, splashRadius: 0,
    width: 20, height: 20, color: ARCANE_COLOR,
    costMinerals: 75, costGas: 25, buildTime: 18, supply: 2,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  [ArenaUnitType.Enchanter]: {
    type: ArenaUnitType.Enchanter, name: 'Enchanter', faction: FactionId.ArcaneCovenant, tier: 2,
    hp: 50, shield: 40, damage: 0, range: 0, speed: 2.5, attackCooldown: 0, splashRadius: 0,
    width: 16, height: 16, color: ARCANE_COLOR,
    costMinerals: 100, costGas: 75, buildTime: 22, supply: 2,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 0, canTargetAir: 0,
    // Special: aura — nearby allies get +25% attack speed in 4-tile radius
  },

  [ArenaUnitType.BlinkAssassin]: {
    type: ArenaUnitType.BlinkAssassin, name: 'Blink Assassin', faction: FactionId.ArcaneCovenant, tier: 2,
    hp: 60, shield: 50, damage: 18, range: 5, speed: 3.5, attackCooldown: 1100, splashRadius: 0,
    width: 16, height: 16, color: ARCANE_COLOR,
    costMinerals: 125, costGas: 75, buildTime: 24, supply: 2,
    bonusDamage: 5, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
    // Special: blink — teleport 8 tiles, 10s cooldown
  },

  [ArenaUnitType.StormCaller]: {
    type: ArenaUnitType.StormCaller, name: 'Storm Caller', faction: FactionId.ArcaneCovenant, tier: 3,
    hp: 45, shield: 60, damage: 25, range: 9, speed: 2.0, attackCooldown: 2500, splashRadius: 2.0,
    width: 16, height: 16, color: ARCANE_COLOR,
    costMinerals: 200, costGas: 150, buildTime: 35, supply: 3,
    bonusDamage: 10, bonusVsClass: ArmorClass.Light, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
    // Special: energy-based AOE storm (50 dmg over 3s in 2-tile radius, 100 energy cost)
  },

  [ArenaUnitType.Golem]: {
    type: ArenaUnitType.Golem, name: 'Golem', faction: FactionId.ArcaneCovenant, tier: 3,
    hp: 200, shield: 100, damage: 20, range: 2, speed: 1.8, attackCooldown: 1400, splashRadius: 0,
    width: 30, height: 30, color: ARCANE_COLOR,
    costMinerals: 175, costGas: 100, buildTime: 30, supply: 4,
    bonusDamage: 15, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Massive, baseArmor: 2,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
  },

  [ArenaUnitType.Archmage]: {
    type: ArenaUnitType.Archmage, name: 'Archmage', faction: FactionId.ArcaneCovenant, tier: 4,
    hp: 120, shield: 200, damage: 30, range: 10, speed: 3.0, attackCooldown: 2000, splashRadius: 1.5,
    width: 28, height: 28, color: ARCANE_COLOR,
    costMinerals: 400, costGas: 350, buildTime: 55, supply: 6,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 1, canTargetGround: 1, canTargetAir: 1,
    // Special: chain spell (bounces to 3 targets), mass heal (150 HP AOE, 150 energy)
  },

  // ════════════════════════════════════════════════════════════════════════
  // AUTOMATA — self-repairing machines, attrition warfare
  // ════════════════════════════════════════════════════════════════════════

  [ArenaUnitType.Sentinel]: {
    type: ArenaUnitType.Sentinel, name: 'Sentinel', faction: FactionId.Automata, tier: 1,
    hp: 55, shield: 0, damage: 6, range: 5, speed: 2.8, attackCooldown: 700, splashRadius: 0,
    width: 16, height: 16, color: AUTOMATA_COLOR,
    costMinerals: 55, costGas: 0, buildTime: 13, supply: 1,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Armored, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
    // Passive: self-repair 1 HP/s out of combat
  },

  [ArenaUnitType.Shredder]: {
    type: ArenaUnitType.Shredder, name: 'Shredder', faction: FactionId.Automata, tier: 1,
    hp: 70, shield: 0, damage: 12, range: 0.5, speed: 3.5, attackCooldown: 600, splashRadius: 0,
    width: 16, height: 16, color: AUTOMATA_COLOR,
    costMinerals: 60, costGas: 10, buildTime: 12, supply: 1,
    bonusDamage: 4, bonusVsClass: ArmorClass.Light, armorClass: ArmorClass.Heavy, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
    // Passive: self-repair 1 HP/s out of combat
  },

  [ArenaUnitType.RepairDrone]: {
    type: ArenaUnitType.RepairDrone, name: 'Repair Drone', faction: FactionId.Automata, tier: 2,
    hp: 50, shield: 0, damage: 0, range: 0, speed: 3.5, attackCooldown: 0, splashRadius: 0,
    width: 14, height: 14, color: AUTOMATA_COLOR,
    costMinerals: 75, costGas: 50, buildTime: 16, supply: 1,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Light, baseArmor: 0,
    isAir: 1, canTargetGround: 0, canTargetAir: 0,
    // Special: repairs nearby mechanical allies at 12 HP/s in 4-tile radius
  },

  [ArenaUnitType.Crawler]: {
    type: ArenaUnitType.Crawler, name: 'Crawler', faction: FactionId.Automata, tier: 2,
    hp: 130, shield: 0, damage: 10, range: 6, speed: 3.0, attackCooldown: 900, splashRadius: 0,
    width: 22, height: 14, color: AUTOMATA_COLOR,
    costMinerals: 125, costGas: 50, buildTime: 20, supply: 2,
    bonusDamage: 5, bonusVsClass: ArmorClass.Armored, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
    // Passive: self-repair 2 HP/s out of combat, ignores terrain (cliff walk)
  },

  [ArenaUnitType.Disruptor]: {
    type: ArenaUnitType.Disruptor, name: 'Disruptor', faction: FactionId.Automata, tier: 3,
    hp: 80, shield: 0, damage: 8, range: 7, speed: 2.5, attackCooldown: 1200, splashRadius: 0,
    width: 18, height: 18, color: AUTOMATA_COLOR,
    costMinerals: 150, costGas: 125, buildTime: 28, supply: 3,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Armored, baseArmor: 0,
    isAir: 0, canTargetGround: 1, canTargetAir: 1,
    // Special: EMP blast — 2-tile radius, drains 100 shield + disables abilities for 3s, 75 energy, 12s cd
  },

  [ArenaUnitType.Harvester]: {
    type: ArenaUnitType.Harvester, name: 'Harvester', faction: FactionId.Automata, tier: 3,
    hp: 100, shield: 0, damage: 5, range: 3, speed: 2.5, attackCooldown: 1500, splashRadius: 0,
    width: 20, height: 20, color: AUTOMATA_COLOR,
    costMinerals: 125, costGas: 75, buildTime: 22, supply: 2,
    bonusDamage: 0, bonusVsClass: -1, armorClass: ArmorClass.Armored, baseArmor: 1,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
    // Special: reclaims wreckage of destroyed mechanical units for 25% of their mineral cost
  },

  [ArenaUnitType.Colossus]: {
    type: ArenaUnitType.Colossus, name: 'Colossus', faction: FactionId.Automata, tier: 4,
    hp: 550, shield: 0, damage: 20, range: 9, speed: 1.5, attackCooldown: 1200, splashRadius: 1.0,
    width: 36, height: 44, color: AUTOMATA_COLOR,
    costMinerals: 400, costGas: 300, buildTime: 55, supply: 6,
    bonusDamage: 10, bonusVsClass: ArmorClass.Light, armorClass: ArmorClass.Massive, baseArmor: 2,
    isAir: 0, canTargetGround: 1, canTargetAir: 0,
    // Passive: self-repair 5 HP/s at all times (even in combat)
  },
};
