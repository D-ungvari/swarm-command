import { Faction, UnitType, TERRAN_COLOR, ZERG_COLOR } from '../constants';
import type { UnitDef } from '../types';

export const UNIT_DEFS: Record<number, UnitDef> = {
  // ── Terran ──
  [UnitType.SCV]: {
    type: UnitType.SCV,
    name: 'SCV',
    faction: Faction.Terran,
    hp: 45, damage: 5, range: 0.5, speed: 2.8,
    attackCooldown: 1000, splashRadius: 0,
    width: 14, height: 14, color: TERRAN_COLOR,
  },
  [UnitType.Marine]: {
    type: UnitType.Marine,
    name: 'Marine',
    faction: Faction.Terran,
    hp: 45, damage: 6, range: 5, speed: 2.8,
    attackCooldown: 600, splashRadius: 0,
    width: 12, height: 12, color: TERRAN_COLOR,
  },
  [UnitType.Marauder]: {
    type: UnitType.Marauder,
    name: 'Marauder',
    faction: Faction.Terran,
    hp: 125, damage: 10, range: 6, speed: 2.3,
    attackCooldown: 1200, splashRadius: 0,
    width: 16, height: 16, color: TERRAN_COLOR,
  },
  [UnitType.SiegeTank]: {
    type: UnitType.SiegeTank,
    name: 'Siege Tank',
    faction: Faction.Terran,
    hp: 160, damage: 15, range: 7, speed: 2.3,
    attackCooldown: 1500, splashRadius: 0,
    width: 20, height: 20, color: TERRAN_COLOR,
  },
  [UnitType.Medivac]: {
    type: UnitType.Medivac,
    name: 'Medivac',
    faction: Faction.Terran,
    hp: 150, damage: 0, range: 4, speed: 3.5,
    attackCooldown: 0, splashRadius: 0,
    width: 18, height: 18, color: TERRAN_COLOR,
  },

  // ── Zerg ──
  [UnitType.Drone]: {
    type: UnitType.Drone,
    name: 'Drone',
    faction: Faction.Zerg,
    hp: 40, damage: 5, range: 0.5, speed: 2.8,
    attackCooldown: 1000, splashRadius: 0,
    width: 12, height: 12, color: ZERG_COLOR,
  },
  [UnitType.Zergling]: {
    type: UnitType.Zergling,
    name: 'Zergling',
    faction: Faction.Zerg,
    hp: 35, damage: 5, range: 0.5, speed: 4.0,
    attackCooldown: 400, splashRadius: 0,
    width: 10, height: 10, color: ZERG_COLOR,
  },
  [UnitType.Baneling]: {
    type: UnitType.Baneling,
    name: 'Baneling',
    faction: Faction.Zerg,
    hp: 30, damage: 20, range: 0.3, speed: 3.5,
    attackCooldown: 0, splashRadius: 2,
    width: 12, height: 12, color: 0x44cc44,
  },
  [UnitType.Hydralisk]: {
    type: UnitType.Hydralisk,
    name: 'Hydralisk',
    faction: Faction.Zerg,
    hp: 80, damage: 12, range: 6, speed: 2.8,
    attackCooldown: 700, splashRadius: 0,
    width: 14, height: 14, color: ZERG_COLOR,
  },
  [UnitType.Roach]: {
    type: UnitType.Roach,
    name: 'Roach',
    faction: Faction.Zerg,
    hp: 145, damage: 8, range: 4, speed: 2.8,
    attackCooldown: 1000, splashRadius: 0,
    width: 16, height: 16, color: ZERG_COLOR,
  },
};
