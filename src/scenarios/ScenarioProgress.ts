export interface ScenarioBestScore {
  score: number;
  maxScore: number;
  grade: string;
}

const STORAGE_KEY = 'swarm_scenario_scores';

function loadScores(): Record<string, ScenarioBestScore> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ScenarioBestScore>;
  } catch {
    return {};
  }
}

function persistScores(scores: Record<string, ScenarioBestScore>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
}

export function getScenarioBestScore(scenarioId: string): ScenarioBestScore | null {
  const scores = loadScores();
  return scores[scenarioId] ?? null;
}

/**
 * Save a scenario score. Returns true if this is a new best (or first) score.
 */
export function saveScenarioScore(scenarioId: string, score: number, maxScore: number, grade: string): boolean {
  const scores = loadScores();
  const existing = scores[scenarioId];

  if (!existing || score > existing.score) {
    scores[scenarioId] = { score, maxScore, grade };
    persistScores(scores);
    return true;
  }

  return false;
}

export function getAllScenarioScores(): Record<string, ScenarioBestScore> {
  return loadScores();
}
