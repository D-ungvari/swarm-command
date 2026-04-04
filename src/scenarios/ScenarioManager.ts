import type { Scenario } from './ScenarioTypes';
import { Faction } from '../constants';

export class ScenarioManager {
  private activeScenario: Scenario | null = null;
  private startTime = 0;
  private objectiveComplete = false;
  private enemyEids: number[] = [];
  private wavesFired: boolean[] = [];

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
    setEnergy?: (eid: number, value: number) => void,
  ): void {
    const s = this.activeScenario;
    if (!s) return;

    for (const u of s.setup.playerUnits) {
      const wp = tileToWorld(u.col, u.row);
      const eid = spawnUnit(u.type, s.setup.playerFaction, wp.x, wp.y);
      if (u.energy !== undefined && setEnergy) {
        setEnergy(eid, u.energy);
      }
    }

    const enemyFaction = s.setup.playerFaction === Faction.Terran ? Faction.Zerg : Faction.Terran;
    this.enemyEids = [];
    for (const u of s.setup.enemyUnits) {
      const wp = tileToWorld(u.col, u.row);
      const eid = spawnUnit(u.type, enemyFaction, wp.x, wp.y);
      this.enemyEids.push(eid);
      if (u.energy !== undefined && setEnergy) {
        setEnergy(eid, u.energy);
      }
    }

    this.wavesFired = (s.setup.enemyWaves ?? []).map(() => false);

    if (s.setup.playerMinerals !== undefined || s.setup.playerGas !== undefined) {
      setResources(s.setup.playerMinerals ?? 0, s.setup.playerGas ?? 0);
    }
  }

  setStartTime(t: number): void {
    this.startTime = t;
  }

  /** Process scenario wave timers. Issues attack-move commands at scheduled times. */
  tickBehavior(
    gameTime: number,
    issueAttackMove: (eids: number[], targetX: number, targetY: number) => void,
    tileToWorld: (col: number, row: number) => { x: number; y: number },
  ): void {
    const s = this.activeScenario;
    if (!s || !s.setup.enemyWaves) return;

    const elapsed = gameTime - this.startTime;

    for (let i = 0; i < s.setup.enemyWaves.length; i++) {
      if (this.wavesFired[i]) continue;
      const wave = s.setup.enemyWaves[i];
      if (elapsed >= wave.delay) {
        this.wavesFired[i] = true;
        const eids: number[] = [];
        for (const idx of wave.unitIndices) {
          if (idx >= 0 && idx < this.enemyEids.length) {
            eids.push(this.enemyEids[idx]);
          }
        }
        if (eids.length > 0) {
          const wp = tileToWorld(wave.targetCol, wave.targetRow);
          issueAttackMove(eids, wp.x, wp.y);
        }
      }
    }
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

    const totalPlayerUnits = playerUnitsAlive + playerUnitsLost;

    // Time limit exceeded
    if (s.setup.timeLimit && elapsed >= s.setup.timeLimit) {
      this.objectiveComplete = true;
      if (obj.type === 'survive') {
        // Survived! Base 50 for completing + up to 50 for unit preservation
        const preserveBonus = totalPlayerUnits > 0 ? Math.round((playerUnitsAlive / totalPlayerUnits) * 50) : 0;
        return { completed: true, won: true, score: 50 + preserveBonus, maxScore: 100 };
      }
      return { completed: true, won: false, score: 0, maxScore: 100 };
    }

    // Early loss detection: all player units dead = immediate failure (except survive which uses unit count as score)
    if (playerUnitsAlive === 0 && obj.type !== 'kill_without_losing') {
      this.objectiveComplete = true;
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
          // Score = unit preservation percentage (0-100 scale)
          const preservePct = totalPlayerUnits > 0 ? playerUnitsAlive / totalPlayerUnits : 0;
          const score = Math.round(preservePct * 100);
          return { completed: true, won: playerUnitsLost < maxLoss, score, maxScore: 100 };
        }
        if (playerUnitsAlive === 0) {
          this.objectiveComplete = true;
          return { completed: true, won: false, score: 0, maxScore: 100 };
        }
        break;

      case 'time_attack':
        if (enemyUnitsAlive === 0) {
          this.objectiveComplete = true;
          const timePct = Math.max(0, 1 - elapsed / (s.setup.timeLimit ?? 60));
          return { completed: true, won: true, score: Math.round(timePct * 100), maxScore: 100 };
        }
        break;

      case 'survive':
        // Success handled by time limit check above
        break;
    }

    return null;
  }

  reset(): void {
    this.activeScenario = null;
    this.objectiveComplete = false;
    this.startTime = 0;
    this.enemyEids = [];
    this.wavesFired = [];
  }
}
