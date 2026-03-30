/**
 * HTML-based resource HUD overlay (top-right corner).
 */
export class HudRenderer {
  private mineralEl: HTMLSpanElement;
  private gasEl: HTMLSpanElement;

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
    const mineralDiv = document.createElement('div');
    mineralDiv.style.display = 'flex';
    mineralDiv.style.alignItems = 'center';
    mineralDiv.style.gap = '4px';

    const mineralIcon = document.createElement('span');
    mineralIcon.style.cssText = 'display:inline-block;width:10px;height:10px;background:#44bbff;border-radius:2px;';
    this.mineralEl = document.createElement('span');
    this.mineralEl.textContent = '0';

    mineralDiv.appendChild(mineralIcon);
    mineralDiv.appendChild(this.mineralEl);

    // Gas
    const gasDiv = document.createElement('div');
    gasDiv.style.display = 'flex';
    gasDiv.style.alignItems = 'center';
    gasDiv.style.gap = '4px';

    const gasIcon = document.createElement('span');
    gasIcon.style.cssText = 'display:inline-block;width:10px;height:10px;background:#44ff66;border-radius:50%;';
    this.gasEl = document.createElement('span');
    this.gasEl.textContent = '0';

    gasDiv.appendChild(gasIcon);
    gasDiv.appendChild(this.gasEl);

    hud.appendChild(mineralDiv);
    hud.appendChild(gasDiv);
    container.appendChild(hud);
  }

  update(minerals: number, gas: number): void {
    this.mineralEl.textContent = String(Math.floor(minerals));
    this.gasEl.textContent = String(Math.floor(gas));
  }
}
