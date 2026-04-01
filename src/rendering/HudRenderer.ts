/**
 * HTML-based resource HUD overlay (top-right corner).
 * Shows minerals, gas, supply, and game timer.
 */
export class HudRenderer {
  private mineralEl: HTMLSpanElement;
  private gasEl: HTMLSpanElement;
  private supplyEl: HTMLSpanElement;
  private timerEl: HTMLSpanElement;
  private workerEl: HTMLSpanElement;
  private upgradeEl: HTMLDivElement;

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

    // Timer
    const timerDiv = this.makeDiv();
    this.timerEl = document.createElement('span');
    this.timerEl.style.color = '#888';
    this.timerEl.textContent = '0:00';
    timerDiv.appendChild(this.timerEl);

    this.upgradeEl = document.createElement('div');
    this.upgradeEl.style.cssText = 'color: #88aaff; font-size: 11px; margin-top: 2px;';

    hud.appendChild(mineralDiv);
    hud.appendChild(gasDiv);
    hud.appendChild(supplyDiv);
    hud.appendChild(workerDiv);
    hud.appendChild(timerDiv);
    hud.appendChild(this.upgradeEl);
    container.appendChild(hud);
  }

  private makeDiv(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '4px';
    return div;
  }

  update(minerals: number, gas: number, supplyUsed: number, supplyProvided: number, gameTime: number, workerCount: number, upgrades?: Uint8Array): void {
    this.mineralEl.textContent = String(Math.floor(minerals));
    this.gasEl.textContent = String(Math.floor(gas));
    this.supplyEl.textContent = `${supplyUsed}/${supplyProvided}`;
    this.supplyEl.style.color = supplyUsed >= supplyProvided ? '#ff4444' : '#eee';
    this.workerEl.textContent = String(workerCount);

    // Format game timer as M:SS
    const totalSec = Math.floor(gameTime);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    this.timerEl.textContent = `${min}:${sec < 10 ? '0' : ''}${sec}`;

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
