import type { Faction, UnitType, BuildingType } from './constants';

/** Command issued by player or AI */
export interface Command {
  type: 'move' | 'attack' | 'stop' | 'hold' | 'gather' | 'build';
  targetX?: number;
  targetY?: number;
  targetEntity?: number;
}

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
  hp: number;
  damage: number;
  range: number;
  speed: number;
  attackCooldown: number;
  splashRadius: number;
  width: number;
  height: number;
  color: number;
  costMinerals: number;
  costGas: number;
  buildTime: number;
  bonusDamage: number;    // extra damage vs specific armor class (0 = no bonus)
  bonusVsTag: number;     // ArmorClass value that triggers bonus (-1 = none)
  armorClass: number;
  baseArmor: number;      // SC2 per-unit base armor value
  isAir: number;          // 1 = air unit (Medivac, Mutalisk)
  canTargetGround: number; // 1 = can attack ground units
  canTargetAir: number;   // 1 = can attack air units
}

/** Building stat definition from data tables */
export interface BuildingDef {
  type: BuildingType;
  name: string;
  faction: Faction;
  hp: number;
  costMinerals: number;
  costGas: number;
  buildTime: number;
  tileWidth: number;
  tileHeight: number;
  supplyProvided: number;
  produces: UnitType[];
  color: number;
  /** Prerequisite building type that must exist and be complete, null = no requirement */
  requires: BuildingType | null;
}
