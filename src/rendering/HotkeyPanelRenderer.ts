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
      'LMB          Select / Box Select',
      'RMB          Move / Attack / Gather',
      'A + LMB      Attack Move',
      'S            Stop',
      'H            Hold Position',
      'P + LMB      Patrol',
      'T            Stim Pack (Marine)',
      'E            Siege Mode (Tank/Viking)',
      'C            Cloak (Ghost)',
      'Y            Yamato Cannon (BC)',
      'V            Inject Larva (Queen)',
      'R + click    Corrosive Bile (Ravager)',
      'F + click    Fungal Growth (Infestor)',
      'G            Abduct (Viper)',
      'D            Snipe (Ghost)',
      'X            Transfuse (Queen)',
      'B + 1-7      Build Structure',
      'Q / W        Produce Unit (slot 1/2)',
      'Ctrl+0-9     Set Control Group',
      '0-9          Recall Group',
      'Ctrl+click   Select Type in Group',
      'Tab          Cycle Subgroup',
      'Dbl-click    Select All Same Type',
      'F2           Select Army',
      'F3           Select Workers',
      'Space        Jump to Base',
      '+/-          Game Speed',
      'Escape       Pause / Cancel Mode',
      'F1           Toggle Help',
    ];

    for (const line of lines) {
      const row = document.createElement('div');
      row.textContent = line;
      this.panel.appendChild(row);
    }

    container.appendChild(this.panel);
  }

  update(keysJustPressed: Set<string>): void {
    if (keysJustPressed.has('F11')) {
      this.visible = !this.visible;
      this.panel.style.display = this.visible ? 'flex' : 'none';
    }
  }
}
