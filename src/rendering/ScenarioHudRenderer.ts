/**
 * In-game HUD overlay showing scenario objective and countdown timer.
 * Fixed at top-center of screen, minimal dark styling.
 */
export class ScenarioHudRenderer {
  private panel: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private objectiveEl: HTMLDivElement;
  private timerEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      font-family: 'Consolas', 'Courier New', monospace;
      background: rgba(0, 0, 0, 0.55);
      padding: 6px 18px;
      border-radius: 4px;
      border: 1px solid rgba(60, 100, 160, 0.3);
      z-index: 30;
      pointer-events: none;
      user-select: none;
    `;

    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = `
      font-size: 10px;
      color: #667788;
      letter-spacing: 2px;
      text-transform: uppercase;
    `;

    this.objectiveEl = document.createElement('div');
    this.objectiveEl.style.cssText = `
      font-size: 13px;
      color: #cce0ff;
    `;

    this.timerEl = document.createElement('div');
    this.timerEl.style.cssText = `
      font-size: 12px;
      color: #88aacc;
      margin-top: 2px;
    `;

    this.panel.appendChild(this.titleEl);
    this.panel.appendChild(this.objectiveEl);
    this.panel.appendChild(this.timerEl);
    container.appendChild(this.panel);
  }

  update(title: string, objectiveLabel: string, gameTime: number, timeLimit?: number): void {
    this.titleEl.textContent = title;
    this.objectiveEl.textContent = objectiveLabel;

    if (timeLimit !== undefined && timeLimit > 0) {
      const remaining = Math.max(0, timeLimit - gameTime);
      const seconds = Math.ceil(remaining);
      if (remaining <= 0) {
        this.timerEl.textContent = 'TIME!';
        this.timerEl.style.color = '#ff4444';
      } else if (seconds <= 10) {
        this.timerEl.textContent = `Time: ${seconds}s`;
        this.timerEl.style.color = '#ff8844';
      } else {
        this.timerEl.textContent = `Time: ${seconds}s`;
        this.timerEl.style.color = '#88aacc';
      }
    } else {
      this.timerEl.textContent = '';
    }
  }

  show(): void { this.panel.style.display = 'flex'; }
  hide(): void { this.panel.style.display = 'none'; }
}
