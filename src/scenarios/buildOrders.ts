export interface BuildOrderStep {
  supply: number;        // supply count when this action should happen
  action: string;        // human-readable: "Train SCV", "Build Barracks"
  idealTime: number;     // seconds into the game (at Faster speed)
}

export interface BuildOrder {
  id: string;
  name: string;
  faction: string;
  matchup: string;       // e.g. "TvZ", "ZvT"
  steps: BuildOrderStep[];
}

export const BUILD_ORDERS: BuildOrder[] = [
  {
    id: 'terran-111',
    name: '1-1-1 Opener',
    faction: 'Terran',
    matchup: 'TvZ',
    steps: [
      { supply: 14, action: 'SCV', idealTime: 17 },
      { supply: 15, action: 'Supply Depot', idealTime: 20 },
      { supply: 16, action: 'Barracks', idealTime: 37 },
      { supply: 16, action: 'Refinery', idealTime: 43 },
      { supply: 19, action: 'Marine', idealTime: 62 },
      { supply: 20, action: 'Factory', idealTime: 75 },
      { supply: 20, action: 'Starport', idealTime: 120 },
    ],
  },
  {
    id: 'terran-3rax',
    name: '3-Barracks Marine Push',
    faction: 'Terran',
    matchup: 'TvZ',
    steps: [
      { supply: 14, action: 'SCV', idealTime: 17 },
      { supply: 15, action: 'Supply Depot', idealTime: 20 },
      { supply: 16, action: 'Barracks', idealTime: 37 },
      { supply: 16, action: 'Barracks', idealTime: 40 },
      { supply: 17, action: 'Barracks', idealTime: 55 },
      { supply: 19, action: 'Marine x3', idealTime: 65 },
      { supply: 22, action: 'Push out!', idealTime: 90 },
    ],
  },
  {
    id: 'zerg-12pool',
    name: '12-Pool Rush',
    faction: 'Zerg',
    matchup: 'ZvT',
    steps: [
      { supply: 12, action: 'Spawning Pool', idealTime: 18 },
      { supply: 13, action: 'Overlord', idealTime: 24 },
      { supply: 14, action: 'Zergling x6', idealTime: 50 },
      { supply: 17, action: 'Queen', idealTime: 55 },
      { supply: 18, action: 'Attack!', idealTime: 65 },
    ],
  },
  {
    id: 'zerg-roach',
    name: 'Roach-Ravager All-In',
    faction: 'Zerg',
    matchup: 'ZvT',
    steps: [
      { supply: 14, action: 'Spawning Pool', idealTime: 22 },
      { supply: 16, action: 'Hatchery (expand)', idealTime: 30 },
      { supply: 17, action: 'Roach Warren', idealTime: 60 },
      { supply: 22, action: 'Roach x4', idealTime: 90 },
      { supply: 28, action: 'Ravager x2', idealTime: 120 },
      { supply: 34, action: 'Push out!', idealTime: 150 },
    ],
  },
  {
    id: 'zerg-macro',
    name: '3-Hatch before Pool',
    faction: 'Zerg',
    matchup: 'ZvT',
    steps: [
      { supply: 14, action: 'Hatchery (natural)', idealTime: 18 },
      { supply: 16, action: 'Hatchery (third)', idealTime: 30 },
      { supply: 17, action: 'Spawning Pool', idealTime: 40 },
      { supply: 18, action: 'Overlord', idealTime: 44 },
      { supply: 20, action: 'Queen x2', idealTime: 60 },
      { supply: 24, action: 'Zergling x4', idealTime: 75 },
    ],
  },
];
