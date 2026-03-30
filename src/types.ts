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
}
