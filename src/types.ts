/**
 * RTS.io — Shared TypeScript types
 */

import type { Faction, UnitType, BuildingType } from './constants';

/** Per-player resource state */
export interface PlayerResources {
  minerals: number;
  gas: number;
  supplyUsed: number;
  supplyProvided: number;
  upgrades: Uint8Array;
}

/** Unit stat definition from data tables */
export interface UnitDef {
  type: UnitType;
  name: string;
  faction: Faction;
  tier: 1 | 2 | 3 | 4;
  hp: number;
  shield: number;       // Arcane Covenant shields (0 for other factions)
  damage: number;
  range: number;         // tiles
  speed: number;         // tiles/sec
  attackCooldown: number; // milliseconds
  splashRadius: number;  // tiles (0 = no splash)
  width: number;         // px
  height: number;        // px
  color: number;         // hex tint
  costMinerals: number;
  costGas: number;
  buildTime: number;     // seconds
  bonusDamage: number;
  bonusVsTag: number;    // ArmorClass value (-1 = none)
  armorClass: number;
  baseArmor: number;
  isAir: number;
  canTargetGround: number;
  canTargetAir: number;
  supply: number;
}

/** Building stat definition from data tables */
export interface BuildingDef {
  type: BuildingType;
  name: string;
  faction: Faction;
  tier: 0 | 1 | 2 | 3 | 4;
  hp: number;
  costMinerals: number;
  costGas: number;
  buildTime: number;
  tileWidth: number;
  tileHeight: number;
  supplyProvided: number;
  produces: UnitType[];
  color: number;
  requires: BuildingType | null;
  damage?: number;
  range?: number;
  attackCooldown?: number;
  canTargetGround?: number;
  canTargetAir?: number;
}
