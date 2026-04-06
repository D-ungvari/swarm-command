import { colors, fonts } from '../ui/theme';

/**
 * HTML overlay for timed alert notifications (e.g., "ENEMY WAVE INCOMING").
 */
export class AlertRenderer {
  private panel: HTMLDivElement;
  private currentAlert = '';
  private hideTime = 0;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.id = 'alert-panel';
    this.panel.style.cssText = `
      position: fixed;
      top: 25%;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      font-family: ${fonts.family};
      font-size: ${fonts.sizeXL};
      font-weight: bold;
      letter-spacing: 2px;
      color: ${colors.error};
      text-shadow: 0 0 12px rgba(255, 50, 50, 0.7);
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      padding: 10px 24px;
      border-radius: 4px;
      border: 1px solid rgba(255, 80, 80, 0.45);
      z-index: 50;
      pointer-events: none;
      user-select: none;
      animation: alertPulse 0.5s ease-in-out infinite alternate;
    `;

    // Add keyframe animation via a style tag
    const style = document.createElement('style');
    style.textContent = `
      @keyframes alertPulse {
        from { opacity: 0.7; }
        to { opacity: 1.0; }
      }
    `;
    document.head.appendChild(style);

    container.appendChild(this.panel);
  }

  show(text: string, duration: number, gameTime: number): void {
    if (this.currentAlert === text && this.hideTime > gameTime) return; // Already showing
    this.currentAlert = text;
    this.hideTime = gameTime + duration;
    this.panel.textContent = text;
    this.panel.style.display = 'block';
  }

  update(gameTime: number): void {
    if (this.hideTime > 0 && gameTime >= this.hideTime) {
      this.panel.style.display = 'none';
      this.currentAlert = '';
      this.hideTime = 0;
    }
  }
}
