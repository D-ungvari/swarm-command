import type { Scenario } from './ScenarioTypes';
import { Faction } from '../constants';

export class ScenarioManager {
  private activeScenario: Scenario | null = null;
  private startTime = 0;
  private objectiveComplete = false;

  load(scenario: Scenario): void {
    this.activeScenario = scenario;
    this.objectiveComplete = false;
  }

  getScenario(): Scenario | null {
    return this.activeScenario;
  }

  /** Called by Game.init() to spawn scenario units */
  applySetup(
    spawnUnit: (type: number, fac: number, x: number, y: number) => number,
    setResources: (minerals: number, gas: number) => void,
    tileToWorld: (col: number, row: number) => { x: number; y: number },
  ): void {
    const s = this.activeScenario;
    if (!s) return;

    for (const u of s.setup.playerUnits) {
      const wp = tileToWorld(u.col, u.row);
      spawnUnit(u.type, s.setup.playerFaction, wp.x, wp.y);
    }

    const enemyFaction = s.setup.playerFaction === Faction.Terran ? Faction.Zerg : Faction.Terran;
    for (const u of s.setup.enemyUnits) {
      const wp = tileToWorld(u.col, u.row);
      spawnUnit(u.type, enemyFaction, wp.x, wp.y);
    }

    if (s.setup.playerMinerals !== undefined || s.setup.playerGas !== undefined) {
      setResources(s.setup.playerMinerals ?? 0, s.setup.playerGas ?? 0);
    }
  }

  setStartTime(t: number): void {
    this.startTime = t;
  }

  /** Check objective completion each tick. Returns grade info or null. */
  checkObjective(
    gameTime: number,
    playerUnitsAlive: number,
    enemyUnitsAlive: number,
    playerUnitsLost: number,
  ): { completed: boolean; won: boolean; score: number; maxScore: number } | null {
    const s = this.activeScenario;
    if (!s || this.objectiveComplete) return null;

    const elapsed = gameTime - this.startTime;
    const obj = s.objective;

    // Time limit exceeded
    if (s.setup.timeLimit && elapsed >= s.setup.timeLimit) {
      this.objectiveComplete = true;
      if (obj.type === 'survive') {
        return { completed: true, won: true, score: playerUnitsAlive, maxScore: playerUnitsAlive + playerUnitsLost };
      }
      return { completed: true, won: false, score: 0, maxScore: 100 };
    }

    switch (obj.type) {
      case 'kill_all':
        if (enemyUnitsAlive === 0) {
          this.objectiveComplete = true;
          const timePct = Math.max(0, 1 - elapsed / (s.setup.timeLimit ?? 60));
          return { completed: true, won: true, score: Math.round(timePct * 100), maxScore: 100 };
        }
        break;

      case 'kill_without_losing':
        if (enemyUnitsAlive === 0) {
          this.objectiveComplete = true;
          const maxLoss = obj.targetValue ?? 0;
          const score = Math.max(0, maxLoss - playerUnitsLost) * 25;
          return { completed: true, won: playerUnitsLost < maxLoss, score, maxScore: maxLoss * 25 };
        }
        if (playerUnitsAlive === 0) {
          this.objectiveComplete = true;
          return { completed: true, won: false, score: 0, maxScore: (obj.targetValue ?? 1) * 25 };
        }
        break;

      case 'time_attack':
        // Same as kill_all but objective explicitly requires clearing within time limit
        if (enemyUnitsAlive === 0) {
          this.objectiveComplete = true;
          const timePct = Math.max(0, 1 - elapsed / (s.setup.timeLimit ?? 60));
          return { completed: true, won: true, score: Math.round(timePct * 100), maxScore: 100 };
        }
        break;

      case 'survive':
        // Handled by time limit above
        break;
    }

    return null;
  }

  reset(): void {
    this.activeScenario = null;
    this.objectiveComplete = false;
    this.startTime = 0;
  }
}
