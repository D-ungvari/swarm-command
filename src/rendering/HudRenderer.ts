import { Faction } from '../constants';
import { createPanelFrame, updatePanelFaction } from '../ui/panelFrame';
import { getFactionPalette, colors, fonts, spacing, TERRAN_PALETTE, type FactionPalette } from '../ui/theme';

/**
 * HTML-based resource HUD overlay (top-right corner).
 * Shows minerals, gas, supply, and game timer.
 */
export class HudRenderer {
  private mineralEl: HTMLSpanElement;
  private gasEl: HTMLSpanElement;
  private supplyEl: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private speedEl: HTMLSpanElement;
  private workerEl: HTMLSpanElement;
  private upgradeEl: HTMLDivElement;
  private apmEl: HTMLSpanElement;
  private incomeEl: HTMLDivElement;
  private idleProductionEl: HTMLDivElement;
  private hud: HTMLDivElement;
  private currentPalette: FactionPalette = TERRAN_PALETTE;

  constructor(container: HTMLElement) {
    const hud = createPanelFrame({
      id: 'resource-hud',
      position: { top: '8px', right: '12px' },
      faction: Faction.Terran,
    });
    hud.style.display = 'flex';
    hud.style.flexDirection = 'row';
    hud.style.gap = spacing.xl;
    hud.style.fontSize = fonts.sizeLG;
    this.hud = hud;

    // Minerals
    const mineralDiv = this.makeDiv();
    const mineralIcon = document.createElement('span');
    mineralIcon.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:${colors.mineral};border-radius:3px;border:1px solid rgba(85,221,255,0.3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);flex-shrink:0;`;
    this.mineralEl = document.createElement('span');
    this.mineralEl.textContent = '0';
    mineralDiv.appendChild(mineralIcon);
    mineralDiv.appendChild(this.mineralEl);

    // Gas
    const gasDiv = this.makeDiv();
    const gasIcon = document.createElement('span');
    gasIcon.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:${colors.gas};border-radius:50%;border:1px solid rgba(102,255,136,0.3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);flex-shrink:0;`;
    this.gasEl = document.createElement('span');
    this.gasEl.textContent = '0';
    gasDiv.appendChild(gasIcon);
    gasDiv.appendChild(this.gasEl);

    // Supply
    const supplyDiv = this.makeDiv();
    const supplyIcon = document.createElement('span');
    supplyIcon.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:${colors.supply};border-radius:3px;border:1px solid rgba(255,204,68,0.3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);flex-shrink:0;`;
    this.supplyEl = document.createElement('span');
    this.supplyEl.textContent = '0/0';
    supplyDiv.appendChild(supplyIcon);
    supplyDiv.appendChild(this.supplyEl);

    // Workers
    const workerDiv = this.makeDiv();
    const workerIcon = document.createElement('span');
    workerIcon.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;background:${TERRAN_PALETTE.textDim};border-radius:3px;border:1px solid rgba(136,170,204,0.3);box-shadow:inset 0 1px 0 rgba(255,255,255,0.1);flex-shrink:0;font-size:${fonts.sizeHotkey};line-height:14px;text-align:center;`;
    workerIcon.textContent = 'W';
    this.workerEl = document.createElement('span');
    this.workerEl.style.color = this.currentPalette.textDim;
    this.workerEl.textContent = '0';
    workerDiv.appendChild(workerIcon);
    workerDiv.appendChild(this.workerEl);

    // Timer + speed indicator
    const timerDiv = this.makeDiv();
    this.timerEl = document.createElement('span');
    this.timerEl.style.color = this.currentPalette.textMuted;
    this.timerEl.textContent = '0:00';
    this.speedEl = document.createElement('span');
    this.speedEl.style.cssText = `color:${colors.warning};font-size:${fonts.sizeSM};margin-left:4px;display:none;`;
    timerDiv.appendChild(this.timerEl);
    timerDiv.appendChild(this.speedEl);

    // APM
    const apmDiv = this.makeDiv();
    const apmLabel = document.createElement('span');
    apmLabel.style.color = this.currentPalette.textMuted;
    apmLabel.textContent = 'APM:';
    this.apmEl = document.createElement('span');
    this.apmEl.style.color = colors.production;
    this.apmEl.textContent = '0';
    apmDiv.appendChild(apmLabel);
    apmDiv.appendChild(this.apmEl);

    this.upgradeEl = document.createElement('div');
    this.upgradeEl.style.cssText = `color: ${TERRAN_PALETTE.secondary}; font-size: ${fonts.sizeSM}; margin-top: ${spacing.xs};`;

    this.incomeEl = document.createElement('div');
    this.incomeEl.style.cssText = `color: ${this.currentPalette.textMuted}; font-size: ${fonts.sizeSM}; margin-top: ${spacing.xs}; display: none;`;

    hud.appendChild(mineralDiv);
    hud.appendChild(gasDiv);
    hud.appendChild(supplyDiv);
    hud.appendChild(workerDiv);
    hud.appendChild(timerDiv);
    hud.appendChild(apmDiv);
    hud.appendChild(this.upgradeEl);
    hud.appendChild(this.incomeEl);
    this.idleProductionEl = document.createElement('div');
    this.idleProductionEl.style.cssText = `color: ${colors.warning}; font-size: ${fonts.sizeSM}; display: none;`;
    this.idleProductionEl.textContent = '\u26A0 Idle Production';
    hud.appendChild(this.idleProductionEl);
    container.appendChild(hud);
  }

  setFaction(f: Faction): void {
    this.currentPalette = getFactionPalette(f);
    updatePanelFaction(this.hud, f);
  }

  private makeDiv(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '4px';
    return div;
  }

  update(minerals: number, gas: number, supplyUsed: number, supplyProvided: number, gameTime: number, workerCount: number, upgrades?: Uint8Array, apm?: number, speed?: number, isSaturated?: boolean, mineralIncome?: number, gasIncome?: number, hasIdleProduction?: boolean): void {
    this.mineralEl.textContent = String(Math.floor(minerals));
    this.gasEl.textContent = String(Math.floor(gas));
    this.supplyEl.textContent = `${supplyUsed}/${supplyProvided}`;
    this.supplyEl.style.color = supplyUsed >= supplyProvided ? colors.error : this.currentPalette.text;
    this.workerEl.textContent = String(workerCount);
    this.workerEl.style.color = isSaturated ? colors.warning : this.currentPalette.textDim;

    // Format game timer as M:SS
    const totalSec = Math.floor(gameTime);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    this.timerEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

    // Speed indicator — only visible when not 1.0x
    if (speed !== undefined && speed !== 1.0) {
      this.speedEl.textContent = `${speed}x`;
      this.speedEl.style.display = 'inline';
    } else {
      this.speedEl.style.display = 'none';
    }

    if (apm !== undefined) {
      this.apmEl.textContent = String(apm);
    }

    if (mineralIncome !== undefined || gasIncome !== undefined) {
      const mRate = mineralIncome !== undefined ? Math.round(mineralIncome) : 0;
      const gRate = gasIncome !== undefined ? Math.round(gasIncome) : 0;
      if (mRate > 0 || gRate > 0) {
        this.incomeEl.textContent = `⚡ ${mRate}m/min  ${gRate}g/min`;
        this.incomeEl.style.display = 'block';
      } else {
        this.incomeEl.style.display = 'none';
      }
    } else {
      this.incomeEl.style.display = 'none';
    }

    if (upgrades) {
      const w = upgrades[0]; // InfantryWeapons
      const a = upgrades[1]; // InfantryArmor
      const v = upgrades[2]; // VehicleWeapons
      const parts: string[] = [];
      if (w > 0) parts.push(`Inf W+${w}`);
      if (a > 0) parts.push(`Inf A+${a}`);
      if (v > 0) parts.push(`Veh W+${v}`);
      this.upgradeEl.textContent = parts.join('  ');
      this.upgradeEl.style.display = parts.length > 0 ? 'block' : 'none';
    } else {
      this.upgradeEl.style.display = 'none';
    }

    // Idle production indicator
    this.idleProductionEl.style.display = hasIdleProduction ? 'block' : 'none';
  }
}
