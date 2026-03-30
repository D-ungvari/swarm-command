import { type World, hasComponents } from '../ecs/world';
import {
  POSITION, HEALTH, BUILDING, UNIT_TYPE,
  faction, hpCurrent, buildingType, buildState, unitType,
} from '../ecs/components';
import { Faction, BuildingType, BuildState } from '../constants';
import { getAIState } from '../systems/AISystem';

/**
 * HTML overlay for victory/defeat screen.
 */
export class GameOverRenderer {
  private overlay: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private subtitleEl: HTMLDivElement;
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

    this.overlay.appendChild(this.titleEl);
    this.overlay.appendChild(this.subtitleEl);
    container.appendChild(this.overlay);
  }

  update(world: World, gameTime: number): void {
    if (this.shown) return;
    if (gameTime < 45) return; // Don't check too early

    // Check defeat: player has no Command Centers
    let playerHasCC = false;
    let zergUnitCount = 0;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (hpCurrent[eid] <= 0) continue;

      // Check for player CC
      if (hasComponents(world, eid, BUILDING) &&
          faction[eid] === Faction.Terran &&
          buildingType[eid] === BuildingType.CommandCenter &&
          buildState[eid] === BuildState.Complete) {
        playerHasCC = true;
      }

      // Count enemy units (non-building Zerg entities with UNIT_TYPE)
      if (hasComponents(world, eid, POSITION | HEALTH | UNIT_TYPE) &&
          faction[eid] === Faction.Zerg &&
          !hasComponents(world, eid, BUILDING)) {
        zergUnitCount++;
      }
    }

    if (!playerHasCC) {
      this.show('DEFEAT', 'Your Command Center has been destroyed.', '#ff4444');
      return;
    }

    // Victory: all Zerg units dead AND AI has sent at least 1 wave
    const aiState = getAIState();
    if (zergUnitCount === 0 && aiState.waveCount >= 1 && aiState.armySize === 0) {
      this.show('VICTORY', 'All enemy forces have been eliminated.', '#44ff44');
    }
  }

  private show(title: string, subtitle: string, color: string): void {
    this.shown = true;
    this.titleEl.textContent = title;
    this.titleEl.style.color = color;
    this.subtitleEl.textContent = subtitle;
    this.overlay.style.display = 'flex';
  }
}
