import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, BUILDING, UNIT_TYPE,
  faction, hpCurrent, buildingType, buildState, unitType,
} from '../ecs/components';
import { Faction, BuildingType, BuildState, activePlayerFaction, isHatchType } from '../constants';
import { getAIState } from '../systems/AISystem';
import type { GameStatsSnapshot } from '../stats/GameStats';
import { colors, fonts, spacing, TERRAN_PALETTE } from '../ui/theme';

/**
 * HTML overlay for victory/defeat screen.
 */
export class GameOverRenderer {
  private overlay: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private subtitleEl: HTMLDivElement;
  private statsEl: HTMLDivElement;
  private playAgainBtn: HTMLButtonElement;
  private saveReplayBtn: HTMLButtonElement;
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
      opacity: 0;
      transition: opacity 0.5s ease-out;
    `;

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      font-family: ${fonts.family};
      font-size: 48px;
      font-weight: bold;
      letter-spacing: 4px;
      text-shadow: 0 0 20px currentColor;
      transform: scale(0.85);
      opacity: 0;
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out;
    `;

    this.subtitleEl = document.createElement('div');
    this.subtitleEl.style.cssText = `
      font-family: ${fonts.family};
      font-size: 16px;
      color: ${TERRAN_PALETTE.textDim};
      margin-top: ${spacing.lg};
    `;

    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = `
      font-family: ${fonts.family};
      font-size: ${fonts.sizeMD};
      color: ${TERRAN_PALETTE.textDim};
      margin-top: 24px;
      text-align: left;
      background: linear-gradient(180deg, rgba(12,20,32,0.8) 0%, rgba(6,10,18,0.85) 100%);
      border: 1px solid ${TERRAN_PALETTE.borderDim};
      box-shadow: ${TERRAN_PALETTE.panelBevel}, 0 2px 8px rgba(0,0,0,0.5);
      padding: ${spacing.lg} 20px;
      border-radius: 4px;
      line-height: 1.8;
      display: none;
      transform: translateY(8px);
      opacity: 0;
      transition: transform 0.4s ease-out 0.25s, opacity 0.4s ease-out 0.25s;
    `;

    this.playAgainBtn = document.createElement('button');
    this.playAgainBtn.id = 'play-again-btn';
    this.playAgainBtn.textContent = 'PLAY AGAIN';
    this.playAgainBtn.style.cssText = `
      margin-top: ${spacing.xl};
      padding: 10px 28px;
      background: linear-gradient(180deg, rgba(22,38,60,0.85) 0%, rgba(14,24,42,0.9) 100%);
      color: ${TERRAN_PALETTE.text};
      border: 1px solid ${TERRAN_PALETTE.border};
      border-radius: 3px;
      font-family: ${fonts.family};
      font-size: ${fonts.sizeLG};
      cursor: pointer;
      letter-spacing: 1px;
      display: none;
      pointer-events: auto;
      transform: translateY(8px);
      opacity: 0;
      transition: transform 0.4s ease-out 0.35s, opacity 0.4s ease-out 0.35s, background 0.12s, border-color 0.12s;
    `;
    this.playAgainBtn.addEventListener('mouseenter', () => {
      this.playAgainBtn.style.background = TERRAN_PALETTE.buttonBgHover;
      this.playAgainBtn.style.borderColor = TERRAN_PALETTE.borderHover;
    });
    this.playAgainBtn.addEventListener('mouseleave', () => {
      this.playAgainBtn.style.background = TERRAN_PALETTE.buttonBg;
      this.playAgainBtn.style.borderColor = TERRAN_PALETTE.border;
    });
    this.playAgainBtn.addEventListener('click', () => { window.location.reload(); });

    this.saveReplayBtn = document.createElement('button');
    this.saveReplayBtn.id = 'save-replay-btn';
    this.saveReplayBtn.textContent = 'SAVE REPLAY';
    this.saveReplayBtn.style.cssText = `
      margin-top: ${spacing.md};
      padding: 8px 24px;
      background: linear-gradient(180deg, rgba(12,20,32,0.85) 0%, rgba(6,10,18,0.9) 100%);
      color: ${TERRAN_PALETTE.textDim};
      border: 1px solid ${TERRAN_PALETTE.borderDim};
      border-radius: 3px;
      font-family: ${fonts.family};
      font-size: ${fonts.sizeMD};
      cursor: pointer;
      letter-spacing: 1px;
      display: none;
      pointer-events: auto;
      transform: translateY(8px);
      opacity: 0;
      transition: transform 0.4s ease-out 0.4s, opacity 0.4s ease-out 0.4s, background 0.12s, border-color 0.12s;
    `;
    this.saveReplayBtn.addEventListener('mouseenter', () => {
      this.saveReplayBtn.style.background = TERRAN_PALETTE.buttonBgHover;
      this.saveReplayBtn.style.borderColor = TERRAN_PALETTE.borderHover;
    });
    this.saveReplayBtn.addEventListener('mouseleave', () => {
      this.saveReplayBtn.style.background = 'linear-gradient(180deg, rgba(12,20,32,0.85) 0%, rgba(6,10,18,0.9) 100%)';
      this.saveReplayBtn.style.borderColor = TERRAN_PALETTE.borderDim;
    });

    this.overlay.appendChild(this.titleEl);
    this.overlay.appendChild(this.subtitleEl);
    this.overlay.appendChild(this.statsEl);
    this.overlay.appendChild(this.playAgainBtn);
    this.overlay.appendChild(this.saveReplayBtn);
    container.appendChild(this.overlay);
  }

  get isShown(): boolean {
    return this.shown;
  }

  update(world: World, gameTime: number, winCondition: string = 'destroy', totalResourcesGathered: number = 0): void {
    if (this.shown) return;
    if (gameTime < 45) return; // Don't check too early

    // Check defeat: player has no main base building
    const enemyFaction = activePlayerFaction === Faction.Zerg ? Faction.Terran : Faction.Zerg;
    let playerHasBase = false;
    let enemyBuildingCount = 0;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (hpCurrent[eid] <= 0) continue;

      // Check for player's main base building
      if (hasComponents(world, eid, BUILDING) &&
          faction[eid] === activePlayerFaction &&
          buildState[eid] === BuildState.Complete) {
        const isBase = activePlayerFaction === Faction.Zerg
          ? isHatchType(buildingType[eid])
          : buildingType[eid] === BuildingType.CommandCenter;
        if (isBase) playerHasBase = true;
      }

      // Count enemy buildings with hp > 0
      if (hasComponents(world, eid, POSITION | HEALTH | BUILDING) &&
          faction[eid] === enemyFaction) {
        enemyBuildingCount++;
      }
    }

    if (!playerHasBase) {
      const baseName = activePlayerFaction === Faction.Zerg ? 'Hatchery' : 'Command Center';
      this.show('DEFEAT', `Your ${baseName} has been destroyed.`, colors.error);
      return;
    }

    // Check win condition
    if (winCondition === 'timed') {
      if (gameTime >= 600) {
        this.show('VICTORY', 'Survived 10 minutes!', colors.success);
      }
    } else if (winCondition === 'economy') {
      if (totalResourcesGathered >= 5000) {
        this.show('VICTORY', 'Gathered 5000 resources!', colors.success);
      }
    } else {
      // Default: destroy all enemy buildings AND AI has sent at least 1 wave
      const aiState = getAIState();
      if (enemyBuildingCount === 0 && aiState.waveCount >= 1) {
        this.show('VICTORY', 'The Zerg base has been destroyed.', colors.success);
      }
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

  /** Called by Game when a game ends — stores replay JSON and wires Save button. */
  setReplay(replayJson: string, frameCount: number): void {
    this.saveReplayBtn.style.display = 'block';
    this.saveReplayBtn.textContent = 'SAVE REPLAY';
    this.saveReplayBtn.onclick = () => {
      try {
        localStorage.setItem('swarm_last_replay', replayJson);
        this.saveReplayBtn.textContent = `REPLAY SAVED (${frameCount} commands)`;
        this.saveReplayBtn.style.color = colors.success;
        this.saveReplayBtn.style.borderColor = '#2a6a4a';
      } catch {
        this.saveReplayBtn.textContent = 'SAVE FAILED';
        this.saveReplayBtn.style.color = colors.error;
      }
    };
  }

  private show(title: string, subtitle: string, color: string): void {
    this.shown = true;
    this.titleEl.textContent = title;
    this.titleEl.style.color = color;
    this.subtitleEl.textContent = subtitle;
    this.overlay.style.display = 'flex';
    this.playAgainBtn.style.display = 'block';

    // Trigger entrance animation via double-rAF
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.overlay.style.opacity = '1';
        this.titleEl.style.transform = 'scale(1)';
        this.titleEl.style.opacity = '1';
        this.statsEl.style.transform = 'translateY(0)';
        this.statsEl.style.opacity = '1';
        this.playAgainBtn.style.transform = 'translateY(0)';
        this.playAgainBtn.style.opacity = '1';
        this.saveReplayBtn.style.transform = 'translateY(0)';
        this.saveReplayBtn.style.opacity = '1';
      });
    });
  }
}
