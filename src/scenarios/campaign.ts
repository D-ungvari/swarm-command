import { Faction, UnitType } from '../constants';
import { MapType } from '../map/MapData';
import type { Scenario } from './ScenarioTypes';

// ── Terran Campaign ──

export const TERRAN_CAMPAIGN: Scenario[] = [
  {
    id: 'campaign-t1',
    title: 'First Contact',
    description: 'Defend against waves with your starting squad. No building allowed.',
    category: 'survival',
    difficulty: 1,
    sc2Concept: 'Combat micro basics — attack-move, hold position',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 15 + (i % 4) * 2,
          row: 15 + Math.floor(i / 4) * 2,
        })),
        { type: UnitType.Medivac, col: 17, row: 11 },
      ],
      enemyUnits: Array.from({ length: 20 }, (_, i) => ({
        type: UnitType.Zergling,
        col: 100 + (i % 5) * 2,
        row: 100 + Math.floor(i / 5) * 3,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 120,
    },
    objective: {
      type: 'survive',
      targetValue: 120,
      label: 'Survive for 2 minutes.',
    },
    tips: [
      'Use Hold Position (H) at choke points',
      'Stim Pack (T) when Zerglings arrive',
      'Medivac heals nearby Marines automatically',
    ],
  },
  {
    id: 'campaign-t2',
    title: 'Establish Base',
    description: 'Build a base and train Marines while defending Zergling waves.',
    category: 'macro',
    difficulty: 2,
    sc2Concept: 'Economy and production under pressure',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 4 }, (_, i) => ({
        type: UnitType.SCV,
        col: 12 + i * 2,
        row: 12,
      })),
      enemyUnits: Array.from({ length: 18 }, (_, i) => ({
        type: UnitType.Zergling,
        col: 100 + (i % 6) * 2,
        row: 100 + Math.floor(i / 6) * 3,
      })),
      playerMinerals: 200,
      disableAI: true,
      disableBuilding: false,
      disableProduction: false,
      timeLimit: 180,
    },
    objective: {
      type: 'survive',
      targetValue: 180,
      label: 'Survive for 3 minutes. Build a Barracks and train Marines.',
    },
    tips: [
      'Build a Barracks (B+2) immediately',
      'Keep SCVs mining — you need minerals for Marines',
      'Rally your Barracks to a defensive position',
    ],
  },
  {
    id: 'campaign-t3',
    title: 'Break the Line',
    description: 'Push through a fortified Zerg position with Siege Tanks and Marines.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Siege Tank positioning and slow push',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.SiegeTank,
          col: 15 + i * 4,
          row: 20,
        })),
        ...Array.from({ length: 12 }, (_, i) => ({
          type: UnitType.Marine,
          col: 14 + (i % 6) * 2,
          row: 24 + Math.floor(i / 6) * 2,
        })),
        { type: UnitType.Medivac, col: 17, row: 16 },
        { type: UnitType.Medivac, col: 23, row: 16 },
      ],
      enemyUnits: [
        ...Array.from({ length: 10 }, (_, i) => ({
          type: UnitType.Roach,
          col: 70 + (i % 5) * 3,
          row: 20 + Math.floor(i / 5) * 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          type: UnitType.Ravager,
          col: 72 + i * 4,
          row: 28,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 90,
    },
    objective: {
      type: 'time_attack',
      targetValue: 90,
      label: 'Kill all enemies within 90 seconds.',
    },
    tips: [
      'Siege Tanks immediately (E) before advancing',
      'Spread tanks to avoid Corrosive Bile splash',
      'Marines screen in front to protect tanks from melee',
    ],
  },
  {
    id: 'campaign-t4',
    title: 'Air Superiority',
    description: 'Defend against Mutalisks and Hydralisks without losing any Vikings.',
    category: 'micro',
    difficulty: 3,
    sc2Concept: 'Air defense and mixed army control',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 30 + (i % 4) * 2,
          row: 60 + Math.floor(i / 4) * 2,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Viking,
          col: 32 + (i % 2) * 4,
          row: 55 + Math.floor(i / 2) * 4,
        })),
        { type: UnitType.Medivac, col: 34, row: 52 },
        { type: UnitType.Medivac, col: 38, row: 52 },
      ],
      enemyUnits: [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Mutalisk,
          col: 80 + (i % 3) * 4,
          row: 55 + Math.floor(i / 3) * 4,
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.Hydralisk,
          col: 82 + (i % 2) * 4,
          row: 65 + Math.floor(i / 2) * 3,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 1, // lose fewer than 1 Viking = lose 0
      label: 'Kill all enemies without losing any Vikings.',
    },
    tips: [
      'Vikings outrange Mutalisks — keep them behind Marines',
      'Focus Marines on Hydralisks first',
      'Medivacs keep your Marines alive while Vikings handle air',
    ],
  },
  {
    id: 'campaign-t5',
    title: 'Total War',
    description: 'Full game — build your base, train an army, and destroy the enemy.',
    category: 'macro',
    difficulty: 3,
    sc2Concept: 'Full game — build order, army composition, timing attack',
    setup: {
      playerFaction: Faction.Terran,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 4 }, (_, i) => ({
        type: UnitType.SCV,
        col: 12 + i * 2,
        row: 12,
      })),
      enemyUnits: [],
      playerMinerals: 200,
      playerGas: 100,
      disableAI: false,
      disableBuilding: false,
      disableProduction: false,
    },
    objective: {
      type: 'kill_all',
      label: 'Destroy all enemy buildings.',
    },
    tips: [
      'Start with SCVs mining, then Barracks, then expand',
      'Scout early to see what the enemy is building',
      'A timing attack at 5-6 minutes can end the game quickly',
    ],
  },
];

// ── Zerg Campaign ──

export const ZERG_CAMPAIGN: Scenario[] = [
  {
    id: 'campaign-z1',
    title: 'Hatching',
    description: 'Overwhelm a Terran squad with Zerglings. Surround and destroy.',
    category: 'micro',
    difficulty: 1,
    sc2Concept: 'Zergling surround micro',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Plains,
      playerUnits: [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Drone,
          col: 10 + (i % 3) * 2,
          row: 10 + Math.floor(i / 3) * 2,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 15 + (i % 4) * 2,
          row: 15 + Math.floor(i / 4) * 2,
        })),
      ],
      enemyUnits: Array.from({ length: 8 }, (_, i) => ({
        type: UnitType.Marine,
        col: 80 + (i % 4) * 2,
        row: 60 + Math.floor(i / 4) * 2,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'kill_all',
      label: 'Kill all Marines.',
    },
    tips: [
      'Surround the Marines from multiple angles',
      'Right-click BEHIND the Marines to wrap around them',
      'Keep Drones away from the fight',
    ],
  },
  {
    id: 'campaign-z2',
    title: 'Consume',
    description: 'Break a Marine wall with Banelings, then clean up with Zerglings.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Baneling bust execution',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 20 }, (_, i) => ({
          type: UnitType.Zergling,
          col: 15 + (i % 5) * 2,
          row: 55 + Math.floor(i / 5) * 2,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Baneling,
          col: 18 + (i % 4) * 2,
          row: 50 + Math.floor(i / 4) * 2,
        })),
      ],
      enemyUnits: Array.from({ length: 16 }, (_, i) => ({
        type: UnitType.Marine,
        col: 65 + (i % 4) * 2,
        row: 55 + Math.floor(i / 4) * 2,
      })),
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 12,
      label: 'Kill all Marines. Lose fewer than 12 Zerglings.',
    },
    tips: [
      'Send Banelings in FIRST to splash the Marine ball',
      'Follow up with Zerglings after Banelings detonate',
      'Spread Banelings to maximize splash coverage',
    ],
  },
  {
    id: 'campaign-z3',
    title: 'The Swarm Rises',
    description: 'Break a Terran siege line with Roaches and Ravager Corrosive Bile.',
    category: 'timing',
    difficulty: 2,
    sc2Concept: 'Roach-Ravager timing — use Corrosive Bile on Tanks',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Canyon,
      playerUnits: [
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Roach,
          col: 15 + (i % 4) * 3,
          row: 55 + Math.floor(i / 4) * 3,
        })),
        ...Array.from({ length: 3 }, (_, i) => ({
          type: UnitType.Ravager,
          col: 18 + i * 4,
          row: 50,
        })),
      ],
      enemyUnits: [
        ...Array.from({ length: 4 }, (_, i) => ({
          type: UnitType.SiegeTank,
          col: 75 + i * 5,
          row: 50,
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.Marine,
          col: 75 + (i % 4) * 2,
          row: 55 + Math.floor(i / 4) * 2,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'time_attack',
      targetValue: 60,
      label: 'Kill all enemies within 60 seconds.',
    },
    tips: [
      'Use Corrosive Bile (R+click) on Siege Tanks — they cannot dodge',
      'Push aggressively — Roaches are cost-effective and tanky',
      'Focus fire Tanks first, then clean up Marines',
    ],
  },
  {
    id: 'campaign-z4',
    title: 'Mutalisk Raid',
    description: 'Use Mutalisks to pick off workers while avoiding Thors.',
    category: 'micro',
    difficulty: 2,
    sc2Concept: 'Mutalisk hit-and-run worker harassment',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 8 }, (_, i) => ({
        type: UnitType.Mutalisk,
        col: 15 + (i % 4) * 3,
        row: 30 + Math.floor(i / 4) * 3,
      })),
      enemyUnits: [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: UnitType.Marine,
          col: 70 + (i % 3) * 4,
          row: 50 + Math.floor(i / 3) * 10,
        })),
        { type: UnitType.Thor, col: 80, row: 45 },
        { type: UnitType.Thor, col: 90, row: 65 },
        ...Array.from({ length: 8 }, (_, i) => ({
          type: UnitType.SCV,
          col: 75 + (i % 4) * 3,
          row: 75 + Math.floor(i / 4) * 2,
        })),
      ],
      disableAI: true,
      disableBuilding: true,
      disableProduction: true,
      timeLimit: 60,
    },
    objective: {
      type: 'kill_without_losing',
      targetValue: 2,
      label: 'Kill all SCVs without losing more than 2 Mutalisks.',
    },
    tips: [
      'Never fight Thors head-on — Mutalisks lose to anti-air',
      'Pick off SCVs first, they have low HP',
      'Kite Marines — Mutalisks are faster',
    ],
  },
  {
    id: 'campaign-z5',
    title: 'Final Evolution',
    description: 'Full game as Zerg — inject, spread creep, build an army, crush the enemy.',
    category: 'macro',
    difficulty: 3,
    sc2Concept: 'Full game as Zerg — inject, creep, army composition',
    setup: {
      playerFaction: Faction.Zerg,
      mapType: MapType.Plains,
      playerUnits: Array.from({ length: 4 }, (_, i) => ({
        type: UnitType.Drone,
        col: 12 + i * 2,
        row: 12,
      })),
      enemyUnits: [],
      playerMinerals: 200,
      disableAI: false,
      disableBuilding: false,
      disableProduction: false,
    },
    objective: {
      type: 'kill_all',
      label: 'Destroy all enemy buildings.',
    },
    tips: [
      'Build Drones first for economy, then tech into an army',
      'Spawn Overlords to avoid supply block',
      'Zerglings are cheap and fast — great for early pressure',
    ],
  },
];

/** All campaign missions in order, both factions */
export const ALL_CAMPAIGN_MISSIONS: Scenario[] = [...TERRAN_CAMPAIGN, ...ZERG_CAMPAIGN];

/** Check if a mission ID is a campaign mission */
export function isCampaignMission(id: string): boolean {
  return id.startsWith('campaign-');
}

/** Get completed campaign mission IDs from localStorage */
export function getCampaignProgress(): string[] {
  try {
    return JSON.parse(localStorage.getItem('campaign_progress') || '[]');
  } catch {
    return [];
  }
}

/** Save a completed campaign mission to localStorage */
export function saveCampaignProgress(missionId: string): void {
  const progress = getCampaignProgress();
  if (!progress.includes(missionId)) {
    progress.push(missionId);
    localStorage.setItem('campaign_progress', JSON.stringify(progress));
  }
}

/** Check if a mission is unlocked (first mission always unlocked, rest require previous completion) */
export function isMissionUnlocked(missions: Scenario[], index: number, progress: string[]): boolean {
  if (index === 0) return true;
  return progress.includes(missions[index - 1].id);
}
