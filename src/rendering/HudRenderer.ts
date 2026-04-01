import { Faction } from '../constants';

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

  constructor(container: HTMLElement) {
    const hud = document.createElement('div');
    hud.id = 'resource-hud';
    hud.style.cssText = `
      position: fixed;
      top: 8px;
      right: 12px;
      display: flex;
      gap: 16px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 14px;
      color: #eee;
      background: rgba(0, 0, 0, 0.6);
      padding: 6px 12px;
      border-radius: 4px;
      z-index: 10;
      pointer-events: none;
      user-select: none;
    `;

    // Minerals
    const mineralDiv = this.makeDiv();
    const mineralIcon = document.createElement('span');
    mineralIcon.style.cssText = 'display:inline-block;width:10px;height:10px;background:#44bbff;border-radius:2px;';
    this.mineralEl = document.createElement('span');
    this.mineralEl.textContent = '0';
    mineralDiv.appendChild(mineralIcon);
    mineralDiv.appendChild(this.mineralEl);

    // Gas
    const gasDiv = this.makeDiv();
    const gasIcon = document.createElement('span');
    gasIcon.style.cssText = 'display:inline-block;width:10px;height:10px;background:#44ff66;border-radius:50%;';
    this.gasEl = document.createElement('span');
    this.gasEl.textContent = '0';
    gasDiv.appendChild(gasIcon);
    gasDiv.appendChild(this.gasEl);

    // Supply
    const supplyDiv = this.makeDiv();
    const supplyIcon = document.createElement('span');
    supplyIcon.style.cssText = 'display:inline-block;width:10px;height:10px;background:#ffcc44;border-radius:1px;';
    this.supplyEl = document.createElement('span');
    this.supplyEl.textContent = '0/0';
    supplyDiv.appendChild(supplyIcon);
    supplyDiv.appendChild(this.supplyEl);

    // Workers
    const workerDiv = this.makeDiv();
    const workerIcon = document.createElement('span');
    workerIcon.style.cssText = 'display:inline-block;width:10px;height:10px;background:#88aacc;border-radius:1px;font-size:8px;line-height:10px;text-align:center;';
    workerIcon.textContent = 'W';
    this.workerEl = document.createElement('span');
    this.workerEl.style.color = '#88aacc';
    this.workerEl.textContent = '0';
    workerDiv.appendChild(workerIcon);
    workerDiv.appendChild(this.workerEl);

    // Timer + speed indicator
    const timerDiv = this.makeDiv();
    this.timerEl = document.createElement('span');
    this.timerEl.style.color = '#888';
    this.timerEl.textContent = '0:00';
    this.speedEl = document.createElement('span');
    this.speedEl.style.cssText = 'color:#ffcc44;font-size:11px;margin-left:4px;display:none;';
    timerDiv.appendChild(this.timerEl);
    timerDiv.appendChild(this.speedEl);

    // APM
    const apmDiv = this.makeDiv();
    const apmLabel = document.createElement('span');
    apmLabel.style.color = '#888';
    apmLabel.textContent = 'APM:';
    this.apmEl = document.createElement('span');
    this.apmEl.style.color = '#ffaa44';
    this.apmEl.textContent = '0';
    apmDiv.appendChild(apmLabel);
    apmDiv.appendChild(this.apmEl);

    this.upgradeEl = document.createElement('div');
    this.upgradeEl.style.cssText = 'color: #88aaff; font-size: 11px; margin-top: 2px;';

    this.incomeEl = document.createElement('div');
    this.incomeEl.style.cssText = 'color: #888; font-size: 11px; margin-top: 2px; display: none;';

    hud.appendChild(mineralDiv);
    hud.appendChild(gasDiv);
    hud.appendChild(supplyDiv);
    hud.appendChild(workerDiv);
    hud.appendChild(timerDiv);
    hud.appendChild(apmDiv);
    hud.appendChild(this.upgradeEl);
    hud.appendChild(this.incomeEl);
    container.appendChild(hud);
  }

  setFaction(f: Faction): void {
    // Zerg: amber mineral color, red supply indicator
    const isZerg = f === Faction.Zerg;
    const mineralColor = isZerg ? '#ffaa22' : '#44bbff';
    const supplyColor = isZerg ? '#ff6644' : '#ffaa44';
    if (this.mineralEl) this.mineralEl.style.color = mineralColor;
    if (this.supplyEl) this.supplyEl.style.color = supplyColor;
  }

  private makeDiv(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '4px';
    return div;
  }

  update(minerals: number, gas: number, supplyUsed: number, supplyProvided: number, gameTime: number, workerCount: number, upgrades?: Uint8Array, apm?: number, speed?: number, isSaturated?: boolean, mineralIncome?: number, gasIncome?: number): void {
    this.mineralEl.textContent = String(Math.floor(minerals));
    this.gasEl.textContent = String(Math.floor(gas));
    this.supplyEl.textContent = `${supplyUsed}/${supplyProvided}`;
    this.supplyEl.style.color = supplyUsed >= supplyProvided ? '#ff4444' : '#eee';
    this.workerEl.textContent = String(workerCount);
    this.workerEl.style.color = isSaturated ? '#ffaa22' : '#88aacc';

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
  }
}
