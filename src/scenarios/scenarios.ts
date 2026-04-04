import { Faction, UnitType } from '../constants';
import { MapType } from '../map/MapData';
import type { Scenario } from './ScenarioTypes';

export const SCENARIOS: Scenario[] = [
  // ─── TERRAN SCENARIOS ─────────────────────────────────────

  {
    id: 'stim-kite',
    title: 'Stim Kite',
    description: '12 Marines vs 20 Zerglings charging at you. Stim and kite backwards.',
    category: 'micro',
    difficulty: 1,
    sc2Concept: 'Stim timing and kiting vs melee',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 12 }, (_, i) => ({
        type: UnitType.Marine,
        col: 25 + (i % 4) * 2,
        row: 62 + Math.floor(i / 4) * 2,
      })),
      enemyUnits: Array.from({ length: 20 }, (_, i) => ({
        type: UnitType.Zergling,
        col: 75 + (i % 5) * 2,
        row: 60 + Math.floor(i / 5) * 2,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 90,
      enemyWaves: [{
        delay: 0,
        unitIndices: Array.from({ length: 20 }, (_, i) => i),
        targetCol: 25,
        targetRow: 64,
      }],
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 4,
      label: 'Kill all Zerglings. Lose fewer than 4 Marines.',
    },
    tips: [
      'Stim immediately (T) — the speed boost lets you kite',
      'Move backwards, stop to shoot, move again (stutter-step)',
      'Spread into a line so all Marines can fire',
    ],
  },

  {
    id: 'siege-positioning',
    title: 'Siege Positioning',
    description: '4 Siege Tanks + 8 Marines vs Roaches and Ravagers. You have 8 seconds to siege up.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Siege Tank placement and pre-positioning',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.SiegeTank,
          col: 25 + i * 4,
          row: 60,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 23 + i * 2,
          row: 64,
        })),
      ],
      enemyUnits: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: UnitType.Roach,
          col: 85 + (i % 5) * 3,
          row: 58 + Math.floor(i / 5) * 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          type: UnitType.Ravager,
          col: 87 + i * 4,
          row: 66,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 120,
      enemyWaves: [{
        delay: 8,
        unitIndices: Array.from({ length: 13 }, (_, i) => i),
        targetCol: 25,
        targetRow: 62,
      }],
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 4,
      label: 'Kill all enemies. Lose fewer than 4 units.',
    },
    tips: [
      'Siege Tanks immediately (E) — you have 8 seconds before they arrive',
      'Spread tanks apart to reduce splash overlap',
      'Marines screen in front to absorb damage',
    ],
  },

  {
    id: 'ghost-ops',
    title: 'Ghost Ops',
    description: '4 Ghosts + 6 Marines vs 12 Hydralisks. Cloak and snipe to thin the herd.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Ghost cloak and snipe ability usage',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Ghost,
          col: 25 + i * 3,
          row: 60,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Marine,
          col: 24 + i * 2,
          row: 65,
        })),
      ],
      enemyUnits: Array.from({ length: 12 }, (_, i) => ({
        type: UnitType.Hydralisk,
        col: 75 + (i % 4) * 3,
        row: 58 + Math.floor(i / 4) * 3,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 90,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 2,
      label: 'Kill all Hydralisks. Lose fewer than 2 units.',
    },
    tips: [
      'Cloak Ghosts (C) to approach without being targeted',
      'Snipe (D) kills Hydralisks in 1 hit — use it to thin the pack',
      'Each Ghost has 200 energy, snipe costs 75 — that\'s 2 snipes per Ghost',
      'Send Marines in after Ghosts have sniped several targets',
    ],
  },

  {
    id: 'bio-push',
    title: 'Bio Push',
    description: '14 Marines + 2 Marauders + 2 Medivacs vs a Roach-Hydra defense. Push fast.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Stim bio with Medivac support',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 14 }, (_, i) => ({
          type: UnitType.Marine,
          col: 20 + (i % 7) * 2,
          row: 62 + Math.floor(i / 7) * 2,
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          type: UnitType.Marauder,
          col: 24 + i * 4,
          row: 60,
        })),
        { type: UnitType.Medivac, col: 24, row: 57 },
        { type: UnitType.Medivac, col: 30, row: 57 },
      ],
      enemyUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Roach,
          col: 80 + (i % 4) * 3,
          row: 60 + Math.floor(i / 4) * 3,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Hydralisk,
          col: 82 + (i % 3) * 3,
          row: 68 + Math.floor(i / 3) * 3,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 90,
    },
    objective: {
      type: 'time_attack',
      label: 'Destroy all enemy units within 90 seconds.',
    },
    tips: [
      'Stim (T) immediately — Medivacs heal the HP loss',
      'Focus fire Roaches first (they hit hardest)',
      'Keep bio in a concave arc so all units can shoot',
    ],
  },

  {
    id: 'hold-the-line',
    title: 'Hold the Line',
    description: '6 Marines + 3 Siege Tanks vs 3 waves of Zerg. Siege up and hold position.',
    category: 'survival',
    difficulty: 3,
    sc2Concept: 'Siege defense with marine screen',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Marine,
          col: 28 + (i % 3) * 2,
          row: 66 + Math.floor(i / 3) * 2,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          type: UnitType.SiegeTank,
          col: 26 + i * 4,
          row: 62,
        })),
      ],
      enemyUnits: [
        // Wave 1: 12 Zerglings (indices 0-11)
        ...Array.from({ length: 12 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 95 + (i % 4) * 2,
          row: 62 + Math.floor(i / 4) * 2,
        })),
        // Wave 2: 8 Roaches (indices 12-19)
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Roach,
          col: 100 + (i % 4) * 3,
          row: 62 + Math.floor(i / 4) * 3,
        })),
        // Wave 3: 6 Roaches + 4 Hydralisks (indices 20-29)
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Roach,
          col: 105 + (i % 3) * 3,
          row: 60 + Math.floor(i / 3) * 3,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Hydralisk,
          col: 106 + (i % 2) * 3,
          row: 68 + Math.floor(i / 2) * 3,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 120,
      enemyWaves: [
        { delay: 0, unitIndices: Array.from({ length: 12 }, (_, i) => i), targetCol: 28, targetRow: 64 },
        { delay: 30, unitIndices: Array.from({ length: 8 }, (_, i) => i + 12), targetCol: 28, targetRow: 64 },
        { delay: 60, unitIndices: Array.from({ length: 10 }, (_, i) => i + 20), targetCol: 28, targetRow: 64 },
      ],
    },
    objective: {
      type: 'survive',
      targetValue: 120,
      label: 'Survive for 120 seconds.',
    },
    tips: [
      'Siege Tanks immediately (E) before the first wave arrives',
      'Hold Position (H) with Marines so they don\'t chase',
      'Stim Marines (T) when each wave connects for faster kills',
    ],
  },

  // ─── ZERG SCENARIOS ────────────���──────────────────────────

  {
    id: 'zergling-surround',
    title: 'Zergling Surround',
    description: '24 Zerglings vs Marines and Marauders. Surround from multiple angles.',
    category: 'micro',
    difficulty: 1,
    sc2Concept: 'Mass Zergling surround micro',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 24 }, (_, i) => ({
        type: UnitType.Zergling,
        col: 20 + (i % 6) * 2,
        row: 58 + Math.floor(i / 6) * 2,
      })),
      enemyUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 64 + (i % 4) * 2,
          row: 62 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Marauder,
          col: 65 + (i % 2) * 3,
          row: 67 + Math.floor(i / 2) * 3,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 8,
      label: 'Kill all enemy units. Lose fewer than 8 Zerglings.',
    },
    tips: [
      'Split Zerglings into 2-3 groups and attack from different sides',
      'Right-click BEHIND the Marines to wrap around them',
      'Surrounding prevents Marines from kiting',
    ],
  },

  {
    id: 'baneling-strike',
    title: 'Baneling Strike',
    description: '10 Banelings + 16 Zerglings vs a clumped Marine ball. Splash them.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Baneling splash into Marine ball',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: UnitType.Baneling,
          col: 22 + (i % 5) * 2,
          row: 60 + Math.floor(i / 5) * 2,
        })),
        ...Array.from({ length: 16 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 20 + (i % 8) * 2,
          row: 66 + Math.floor(i / 8) * 2,
        })),
      ],
      enemyUnits: Array.from({ length: 16 }, (_, i) => ({
        type: UnitType.Marine,
        // Tightly clumped — 1 tile spacing to maximize splash value
        col: 70 + (i % 4),
        row: 62 + Math.floor(i / 4),
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'time_attack',
      label: 'Destroy all Marines within 60 seconds.',
    },
    tips: [
      'Send Banelings in FIRST — they splash on attack (2.2 tile radius)',
      'Banelings die after attacking, so make each one count',
      'Follow up with Zerglings to clean up survivors',
    ],
  },

  {
    id: 'corrosive-bile',
    title: 'Corrosive Bile',
    description: '8 Roaches + 4 Ravagers vs a Terran line with Siege Tanks. Bile the tanks.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Ravager Corrosive Bile targeting',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Roach,
          col: 20 + (i % 4) * 3,
          row: 60 + Math.floor(i / 4) * 3,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Ravager,
          col: 22 + i * 4,
          row: 55,
        })),
      ],
      enemyUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 78 + (i % 4) * 2,
          row: 62 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Marauder,
          col: 79 + (i % 2) * 3,
          row: 67 + Math.floor(i / 2) * 3,
        })),
        { type: UnitType.SiegeTank, col: 80, row: 58 },
        { type: UnitType.SiegeTank, col: 86, row: 58 },
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 120,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 3,
      label: 'Kill all enemies. Lose fewer than 3 units.',
    },
    tips: [
      'Use Corrosive Bile (R + click) on the Siege Tanks first',
      'Bile deals 60 splash damage — tanks can\'t dodge',
      'Push with Roaches after tanks are down',
    ],
  },

  {
    id: 'muta-harass',
    title: 'Muta Harass',
    description: '8 Mutalisks vs scattered Marines and 2 Thors. Pick off Marines, avoid Thors.',
    category: 'micro',
    difficulty: 3,
    sc2Concept: 'Mutalisk hit-and-run harassment',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 8 }, (_, i) => ({
        type: UnitType.Mutalisk,
        col: 15 + (i % 4) * 3,
        row: 30 + Math.floor(i / 4) * 3,
      })),
      enemyUnits: [
        // Marines scattered in 4 pairs across the map
        { type: UnitType.Marine, col: 50, row: 30 },
        { type: UnitType.Marine, col: 52, row: 30 },
        { type: UnitType.Marine, col: 90, row: 35 },
        { type: UnitType.Marine, col: 92, row: 35 },
        { type: UnitType.Marine, col: 55, row: 80 },
        { type: UnitType.Marine, col: 57, row: 80 },
        { type: UnitType.Marine, col: 95, row: 85 },
        { type: UnitType.Marine, col: 97, row: 85 },
        // 2 Thors guarding key positions
        { type: UnitType.Thor, col: 70, row: 55 },
        { type: UnitType.Thor, col: 80, row: 70 },
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 120,
    },
    objective: {
      type: 'kill_all',
      label: 'Destroy all enemy units within 120 seconds.',
    },
    tips: [
      'Pick off isolated Marine pairs first — avoid Thors',
      'Thors deal 60 damage per hit — don\'t fight them head-on',
      'Mutalisk glaive bounce hits 2 additional targets at reduced damage',
      'After Marines are dead, focus-fire one Thor at a time',
    ],
  },

  {
    id: 'swarm-defense',
    title: 'Swarm Defense',
    description: '12 Zerglings + 6 Roaches + 2 Queens vs a Terran bio push. Use Transfuse.',
    category: 'survival',
    difficulty: 2,
    sc2Concept: 'Queen Transfuse and defensive positioning',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 12 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 28 + (i % 4) * 2,
          row: 66 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Roach,
          col: 26 + (i % 3) * 3,
          row: 62 + Math.floor(i / 3) * 3,
        })),
        { type: UnitType.Queen, col: 30, row: 58, energy: 100 },
        { type: UnitType.Queen, col: 34, row: 58, energy: 100 },
      ],
      enemyUnits: [
        // Wave 1: 12 Marines (indices 0-11)
        ...Array.from({ length: 12 }, (_, i) => ({
          type: UnitType.Marine,
          col: 95 + (i % 4) * 2,
          row: 62 + Math.floor(i / 4) * 2,
        })),
        // Wave 2: 8 Marines + 4 Marauders (indices 12-23)
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 100 + (i % 4) * 2,
          row: 60 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Marauder,
          col: 101 + (i % 2) * 3,
          row: 66 + Math.floor(i / 2) * 3,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 120,
      enemyWaves: [
        { delay: 0, unitIndices: Array.from({ length: 12 }, (_, i) => i), targetCol: 30, targetRow: 64 },
        { delay: 40, unitIndices: Array.from({ length: 12 }, (_, i) => i + 12), targetCol: 30, targetRow: 64 },
      ],
    },
    objective: {
      type: 'survive',
      targetValue: 120,
      label: 'Survive for 120 seconds.',
    },
    tips: [
      'Position Roaches in front — they have 145 HP and regenerate',
      'Use Queen Transfuse on damaged Roaches to keep them alive',
      'Zerglings surround enemies that reach your line',
    ],
  },
];
