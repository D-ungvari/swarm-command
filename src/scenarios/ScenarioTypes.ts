import { Faction, UnitType } from '../constants';
import { MapType } from '../map/MapData';

export type ScenarioCategory = 'micro' | 'macro' | 'build-order' | 'timing' | 'survival';
export type ScenarioGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface ScenarioUnit {
  type: UnitType;
  col: number;
  row: number;
}

export interface ScenarioSetup {
  playerFaction: Faction;
  mapType: MapType;
  playerUnits: ScenarioUnit[];
  enemyUnits: ScenarioUnit[];
  playerMinerals?: number;
  playerGas?: number;
  disableAI?: boolean;        // no AI waves — static enemy units only
  disableBuilding?: boolean;  // cannot place buildings
  disableProduction?: boolean; // cannot train units
  timeLimit?: number;         // seconds — scenario ends when exceeded
}

export interface ScenarioObjective {
  type: 'kill_all' | 'survive' | 'kill_without_losing' | 'time_attack';
  targetValue?: number;  // e.g. survive 60 seconds, or lose < 4 units
  label: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category: ScenarioCategory;
  difficulty: 1 | 2 | 3;
  sc2Concept: string;       // e.g. "Marine splitting vs Banelings"
  setup: ScenarioSetup;
  objective: ScenarioObjective;
  tips: string[];
}

export function gradeFromScore(score: number, maxScore: number): ScenarioGrade {
  const pct = score / maxScore;
  if (pct >= 0.95) return 'S';
  if (pct >= 0.85) return 'A';
  if (pct >= 0.70) return 'B';
  if (pct >= 0.50) return 'C';
  if (pct >= 0.30) return 'D';
  return 'F';
}
