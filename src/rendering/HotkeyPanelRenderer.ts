/**
 * HTML-based hotkey reference panel (top-right area, below resource HUD).
 * Toggled by pressing F1 or ?.
 */
export class HotkeyPanelRenderer {
  private panel: HTMLDivElement;
  private visible = false;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.id = 'hotkey-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 42px;
      right: 12px;
      display: none;
      flex-direction: column;
      gap: 2px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 11px;
      color: #ccc;
      background: rgba(0, 0, 0, 0.7);
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid rgba(100, 160, 255, 0.2);
      z-index: 10;
      pointer-events: none;
      user-select: none;
      line-height: 1.6;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'color: #88bbff; font-size: 12px; font-weight: bold; margin-bottom: 2px;';
    title.textContent = 'Controls';
    this.panel.appendChild(title);

    const lines = [
      'LMB: Select / Box Select',
      'RMB: Move / Attack / Gather',
      'A+Click: Attack Move',
      'S: Stop  H: Hold',
      'T: Stim (Marine)',
      'E: Siege (Tank)',
      'B+1-6: Build',
      'Q/W: Produce Unit',
      'Ctrl+0-9: Set Group',
      '0-9: Recall Group',
      'Space: Jump to Base',
      'F2: Select Idle Workers',
      'F1: Toggle Help',
    ];

    for (const line of lines) {
      const row = document.createElement('div');
      row.textContent = line;
      this.panel.appendChild(row);
    }

    container.appendChild(this.panel);
  }

  update(keysJustPressed: Set<string>): void {
    if (keysJustPressed.has('F1')) {
      this.visible = !this.visible;
      this.panel.style.display = this.visible ? 'flex' : 'none';
    }
  }
}
