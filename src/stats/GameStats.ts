export interface GameStatsSnapshot {
  duration: number;          // seconds
  unitsProduced: number;
  unitsLost: number;
  resourcesGathered: number; // total minerals + gas
  damageDealt: number;
  damageTaken: number;
  apm: number;               // average actions per minute over game
  wavesDefeated: number;
}

export class GameStats {
  private unitsProduced = 0;
  private unitsLost = 0;
  private resourcesGathered = 0;
  private damageDealt = 0;
  private damageTaken = 0;
  private actionTimestamps: number[] = []; // real timestamps (ms)
  private wavesDefeated = 0;

  recordAction(): void {
    this.actionTimestamps.push(performance.now());
  }

  recordUnitProduced(): void { this.unitsProduced++; }
  recordUnitLost(): void { this.unitsLost++; }
  recordResourceGathered(amount: number): void { this.resourcesGathered += amount; }
  recordDamageDealt(amount: number): void { this.damageDealt += amount; }
  recordDamageTaken(amount: number): void { this.damageTaken += amount; }
  recordWaveDefeated(): void { this.wavesDefeated++; }

  getCurrentAPM(gameTime: number): number {
    if (gameTime <= 0) return 0;
    const minutes = gameTime / 60;
    return Math.round(this.actionTimestamps.length / Math.max(minutes, 0.1));
  }

  getSnapshot(gameTime: number): GameStatsSnapshot {
    return {
      duration: gameTime,
      unitsProduced: this.unitsProduced,
      unitsLost: this.unitsLost,
      resourcesGathered: this.resourcesGathered,
      damageDealt: this.damageDealt,
      damageTaken: this.damageTaken,
      apm: this.getCurrentAPM(gameTime),
      wavesDefeated: this.wavesDefeated,
    };
  }

  reset(): void {
    this.unitsProduced = 0;
    this.unitsLost = 0;
    this.resourcesGathered = 0;
    this.damageDealt = 0;
    this.damageTaken = 0;
    this.actionTimestamps = [];
    this.wavesDefeated = 0;
  }
}
