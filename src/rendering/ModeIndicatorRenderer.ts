/**
 * HTML-based mode indicator overlay (top-left of screen).
 * Shows the current input mode: ATTACK MOVE, BUILD MODE, ability names, or hidden for normal.
 */
export class ModeIndicatorRenderer {
  private el: HTMLDivElement;
  private lastText = '';

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.id = 'mode-indicator';
    this.el.style.cssText = `
      position: fixed;
      top: 10px;
      left: 12px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 14px;
      font-weight: bold;
      letter-spacing: 1px;
      padding: 4px 10px;
      border-radius: 3px;
      z-index: 10;
      pointer-events: none;
      user-select: none;
      display: none;
    `;
    container.appendChild(this.el);
  }

  showPaused(): void {
    this.el.style.display = 'block';
    this.el.textContent = '\u23f8 PAUSED';
    this.el.style.color = '#ffffff';
    this.el.style.background = 'rgba(0, 0, 0, 0.7)';
  }

  update(attackMoveMode: boolean, placementMode: boolean, isPatrolPending: boolean = false, abilityName: string = ''): void {
    let text = '';
    let color = '';
    let bg = '';

    if (abilityName) {
      text = abilityName;
      color = '#ff88cc';
      bg = 'rgba(100, 20, 60, 0.6)';
    } else if (attackMoveMode) {
      text = 'ATTACK MOVE';
      color = '#ffcc44';
      bg = 'rgba(100, 80, 0, 0.6)';
    } else if (isPatrolPending) {
      text = 'PATROL';
      color = '#44ffaa';
      bg = 'rgba(0, 80, 50, 0.6)';
    } else if (placementMode) {
      text = 'BUILD MODE';
      color = '#88bbff';
      bg = 'rgba(20, 40, 100, 0.6)';
    }

    if (text !== this.lastText) {
      this.lastText = text;
      if (text === '') {
        this.el.style.display = 'none';
      } else {
        this.el.style.display = 'block';
        this.el.textContent = text;
        this.el.style.color = color;
        this.el.style.background = bg;
      }
    }
  }
}
