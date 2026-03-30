import type { Faction, UnitType } from './constants';

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
}
