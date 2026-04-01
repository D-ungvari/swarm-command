import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, BUILDING, UNIT_TYPE,
  faction, hpCurrent, buildingType, buildState, unitType,
} from '../ecs/components';
import { Faction, BuildingType, BuildState } from '../constants';
import { getAIState } from '../systems/AISystem';
import type { GameStatsSnapshot } from '../stats/GameStats';

/**
 * HTML overlay for victory/defeat screen.
 */
export class GameOverRenderer {
  private overlay: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private subtitleEl: HTMLDivElement;
  private statsEl: HTMLDivElement;
  private playAgainBtn: HTMLButtonElement;
  private shown = false;

  constructor(container: HTMLElement) {
    this.overlay = document.createElement('div');
    this.overlay.id = 'game-over';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.7);
      z-index: 100;
      pointer-events: none;
      user-select: none;
    `;

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 48px;
      font-weight: bold;
      letter-spacing: 4px;
      text-shadow: 0 0 20px currentColor;
    `;

    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.cssText = `
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 16px;
      color: #aaa;
      margin-top: 12px;
    `;

    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = `
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 13px;
      color: #ccc;
      margin-top: 24px;
      text-align: left;
      background: rgba(0, 0, 0, 0.4);
      padding: 12px 20px;
      border-radius: 4px;
      line-height: 1.8;
      display: none;
    `;

    this.playAgainBtn = document.createElement('button');
    this.playAgainBtn.id = 'play-again-btn';
    this.playAgainBtn.textContent = 'PLAY AGAIN';
    this.playAgainBtn.style.cssText = `
      margin-top: 16px;
      padding: 10px 28px;
      background: #1a3a5a;
      color: #cce0ff;
      border: 1px solid #3a6a9a;
      font-size: 14px;
      cursor: pointer;
      letter-spacing: 1px;
      display: none;
      pointer-events: auto;
    `;
    this.playAgainBtn.addEventListener('click', () => { window.location.reload(); });

    this.overlay.appendChild(this.titleEl);
    this.overlay.appendChild(this.subtitleEl);
    this.overlay.appendChild(this.statsEl);
    this.overlay.appendChild(this.playAgainBtn);
    container.appendChild(this.overlay);
  }

  get isShown(): boolean {
    return this.shown;
  }

  update(world: World, gameTime: number): void {
    if (this.shown) return;
    if (gameTime < 45) return; // Don't check too early

    // Check defeat: player has no Command Centers
    let playerHasCC = false;
    let zergBuildingCount = 0;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (hpCurrent[eid] <= 0) continue;

      // Check for player CC
      if (hasComponents(world, eid, BUILDING) &&
          faction[eid] === Faction.Terran &&
          buildingType[eid] === BuildingType.CommandCenter &&
          buildState[eid] === BuildState.Complete) {
        playerHasCC = true;
      }

      // Count enemy buildings (Zerg buildings with hp > 0)
      if (hasComponents(world, eid, POSITION | HEALTH | BUILDING) &&
          faction[eid] === Faction.Zerg) {
        zergBuildingCount++;
      }
    }

    if (!playerHasCC) {
      this.show('DEFEAT', 'Your Command Center has been destroyed.', '#ff4444');
      return;
    }

    // Victory: all Zerg BUILDINGS destroyed AND AI has sent at least 1 wave
    const aiState = getAIState();
    if (zergBuildingCount === 0 && aiState.waveCount >= 1) {
      this.show('VICTORY', 'The Zerg base has been destroyed.', '#44ff44');
    }
  }

  setStats(stats: GameStatsSnapshot): void {
    const totalSec = Math.floor(stats.duration);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    const duration = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    this.statsEl.innerHTML = [
      `Duration          ${duration}`,
      `Units produced    ${stats.unitsProduced}`,
      `Units lost        ${stats.unitsLost}`,
      `Resources gathered  ${Math.floor(stats.resourcesGathered)}`,
      `Damage dealt      ${Math.floor(stats.damageDealt)}`,
      `Damage taken      ${Math.floor(stats.damageTaken)}`,
      `APM               ${stats.apm}`,
      `Waves defeated    ${stats.wavesDefeated}`,
    ].map(line => `<div>${line}</div>`).join('');
    this.statsEl.style.display = 'block';
  }

  private show(title: string, subtitle: string, color: string): void {
    this.shown = true;
    this.titleEl.textContent = title;
    this.titleEl.style.color = color;
    this.subtitleEl.textContent = subtitle;
    this.overlay.style.display = 'flex';
    this.playAgainBtn.style.display = 'block';
  }
}
