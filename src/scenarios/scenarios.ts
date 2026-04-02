import { Faction, UnitType } from '../constants';
import { MapType } from '../map/MapData';
import type { Scenario } from './ScenarioTypes';

export const SCENARIOS: Scenario[] = [
  {
    id: 'marine-split',
    title: 'Marine Split',
    description: 'Split your Marines before the Banelings connect. Classic SC2 micro drill.',
    category: 'micro',
    difficulty: 1,
    sc2Concept: 'Marine splitting vs Banelings',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 20 }, (_, i) => ({
        type: UnitType.Marine,
        col: 20 + (i % 5) * 2,
        row: 64 + Math.floor(i / 5) * 2,
      })),
      enemyUnits: Array.from({ length: 8 }, (_, i) => ({
        type: UnitType.Baneling,
        col: 40 + (i % 4) * 2,
        row: 64 + Math.floor(i / 4) * 3,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 30,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 4,  // lose fewer than 4 Marines
      label: 'Kill all Banelings. Lose fewer than 4 Marines.',
    },
    tips: [
      'Select all Marines (Ctrl+A or box select), then split by shift-clicking groups',
      'Move Marines AWAY from Banelings before they connect',
      'Spread in a line, not a ball — Banelings splash',
    ],
  },
  {
    id: 'stim-push',
    title: 'Stimmed Push',
    description: '16 Marines + 2 Medivacs vs a Zerg wall. Push through in under 45 seconds.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Stim timing with Medivac support',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 16 }, (_, i) => ({
          type: UnitType.Marine,
          col: 15 + (i % 4) * 2,
          row: 30 + Math.floor(i / 4) * 2,
        })),
        { type: UnitType.Medivac, col: 17, row: 26 },
        { type: UnitType.Medivac, col: 21, row: 26 },
      ],
      enemyUnits: [
        ...Array.from({ length: 12 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 40 + (i % 4) * 2,
          row: 30 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Roach,
          col: 42 + i * 3,
          row: 36,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 45,
    },
    objective: {
      type: 'kill_all',
      label: 'Destroy all Zerg units within 45 seconds.',
    },
    tips: [
      'Stim immediately (T) — Medivacs will heal the HP loss',
      'Focus fire Roaches first (they hit hardest)',
      'Keep Marines in a concave, not a line',
    ],
  },
  {
    id: 'bunker-hold',
    title: 'Bunker Hold',
    description: 'Hold the line with 1 Bunker + 4 Marines vs 3 waves of Zerglings.',
    category: 'survival',
    difficulty: 1,
    sc2Concept: 'Early game bunker defense',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Canyon,
      playerUnits: Array.from({ length: 8 }, (_, i) => ({
        type: UnitType.Marine,
        col: 15 + (i % 4),
        row: 15 + Math.floor(i / 4),
      })),
      enemyUnits: Array.from({ length: 30 }, (_, i) => ({
        type: UnitType.Zergling,
        col: 100 + (i % 6) * 2,
        row: 100 + Math.floor(i / 6) * 2,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'survive',
      targetValue: 60,
      label: 'Survive for 60 seconds.',
    },
    tips: [
      'Position Marines behind a narrow choke',
      'Hold Position (H) so they do not chase',
      'Use Stim Pack when the wave arrives, not before',
    ],
  },
  {
    id: 'tank-line',
    title: 'Tank Line',
    description: 'Position Siege Tanks to stop a Roach-Ravager push.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Siege Tank positioning',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.SiegeTank,
          col: 20 + i * 4,
          row: 20,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 18 + i * 2,
          row: 24,
        })),
      ],
      enemyUnits: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: UnitType.Roach,
          col: 60 + (i % 5) * 3,
          row: 20 + Math.floor(i / 5) * 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          type: UnitType.Ravager,
          col: 62 + i * 4,
          row: 28,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'kill_all',
      label: 'Destroy all Roaches and Ravagers without losing any Siege Tanks.',
    },
    tips: [
      'Siege Tanks immediately (E) before the enemy arrives',
      'Spread tanks to avoid Corrosive Bile splash',
      'Marines screen in front to protect tanks from melee',
    ],
  },
  {
    id: 'drop-defense',
    title: 'Drop Defense',
    description: 'Zerglings are dropped at multiple points. React fast to protect your workers.',
    category: 'micro',
    difficulty: 3,
    sc2Concept: 'Defensive reaction micro',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 12 }, (_, i) => ({
          type: UnitType.Marine,
          col: 64 + (i % 4) * 2,
          row: 64 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.SCV,
          col: 10 + i * 2,
          row: 10,
        })),
      ],
      enemyUnits: [
        // Drop 1: top-left near workers
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 15 + i,
          row: 15,
        })),
        // Drop 2: bottom-right
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 100 + i,
          row: 100,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 30,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 2,
      label: 'Kill all Zerglings. Lose fewer than 2 SCVs.',
    },
    tips: [
      'Split Marines: send half to each drop location',
      'A-move (attack-move) toward each Zergling group',
      'Workers can be pulled to safety while Marines engage',
    ],
  },
  {
    id: 'stim-mirror',
    title: 'Perfect Stim',
    description: '16 Marines vs 16 Marines. Use Stim timing to win the mirror match.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Stim Pack timing in bio mirror',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 16 }, (_, i) => ({
        type: UnitType.Marine,
        col: 20 + (i % 4) * 2,
        row: 60 + Math.floor(i / 4) * 2,
      })),
      enemyUnits: Array.from({ length: 16 }, (_, i) => ({
        type: UnitType.Marine,
        col: 80 + (i % 4) * 2,
        row: 60 + Math.floor(i / 4) * 2,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 30,
    },
    objective: {
      type: 'kill_all',
      label: 'Destroy all enemy Marines. Your Marines must survive.',
    },
    tips: [
      'Stim just before engaging — the attack speed boost is huge',
      'Do NOT stim too early or you lose HP before the fight',
      'Spread into a concave so more Marines can fire simultaneously',
    ],
  },
];
