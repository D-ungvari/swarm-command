import { fonts, spacing, TERRAN_PALETTE } from '../ui/theme';

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
      gap: ${spacing.xs};
      font-family: ${fonts.family};
      font-size: ${fonts.sizeSM};
      color: ${TERRAN_PALETTE.textDim};
      background: linear-gradient(180deg, rgba(12,20,32,0.88) 0%, rgba(6,10,18,0.92) 100%);
      padding: ${spacing.md} ${spacing.lg};
      border-radius: 4px;
      border: 1px solid ${TERRAN_PALETTE.borderDim};
      box-shadow: ${TERRAN_PALETTE.panelBevel}, 0 2px 8px rgba(0,0,0,0.5);
      z-index: 10;
      pointer-events: none;
      user-select: none;
      line-height: 1.6;
    `;

    const title = document.createElement('div');
    title.style.cssText = `color: ${TERRAN_PALETTE.secondary}; font-size: ${fonts.sizeMD}; font-weight: bold; margin-bottom: ${spacing.xs};`;
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
