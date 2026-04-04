/**
 * In-game HUD overlay showing scenario objective, countdown timer, and pre-game countdown.
 * Fixed at top-center of screen, minimal dark styling.
 */
export class ScenarioHudRenderer {
  private panel: HTMLDivElement;
  private titleEl: HTMLDivElement;
  private objectiveEl: HTMLDivElement;
  private timerEl: HTMLDivElement;

  // Countdown overlay elements
  private countdownOverlay: HTMLDivElement;
  private countdownHeader: HTMLDivElement;
  private countdownNumber: HTMLDivElement;
  private countdownLabel: HTMLDivElement;
  private countdownObjective: HTMLDivElement;
  private countdownTips: HTMLDivElement;
  private goFlash: HTMLDivElement;
  private goFlashTimer = 0;
  private lastCountdownSecond = -1;

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
      transition: opacity 0.4s ease-out;
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

    // ── Countdown overlay (full-screen center) ──
    this.countdownOverlay = document.createElement('div');
    this.countdownOverlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 40;
      pointer-events: none;
      user-select: none;
      font-family: 'Consolas', 'Courier New', monospace;
      background: radial-gradient(ellipse at center, rgba(0,0,0,0.05) 30%, rgba(0,0,0,0.5) 100%);
      padding-bottom: 10vh;
    `;

    this.countdownHeader = document.createElement('div');
    this.countdownHeader.style.cssText = `
      font-size: 11px;
      color: #556677;
      letter-spacing: 5px;
      text-transform: uppercase;
      margin-bottom: 8px;
    `;
    this.countdownHeader.textContent = 'GET READY';

    this.countdownNumber = document.createElement('div');
    this.countdownNumber.style.cssText = `
      font-size: 140px;
      font-weight: bold;
      color: #cce0ff;
      text-shadow: 0 0 40px rgba(100,180,255,0.5), 0 0 80px rgba(60,120,200,0.2);
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease-out, color 0.4s ease-out, text-shadow 0.4s ease-out;
      line-height: 1;
    `;

    this.countdownLabel = document.createElement('div');
    this.countdownLabel.style.cssText = `
      font-size: 16px;
      color: #8899aa;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-top: 20px;
    `;

    this.countdownObjective = document.createElement('div');
    this.countdownObjective.style.cssText = `
      font-size: 13px;
      color: #aabbcc;
      margin-top: 10px;
      padding: 6px 16px;
      background: rgba(0,0,0,0.3);
      border-radius: 3px;
      border: 1px solid rgba(60,100,160,0.25);
      transition: opacity 0.5s ease-out;
    `;

    this.countdownTips = document.createElement('div');
    this.countdownTips.style.cssText = `
      font-size: 11px;
      color: #667788;
      max-width: 420px;
      text-align: center;
      margin-top: 28px;
      line-height: 1.8;
      transition: opacity 0.5s ease-out;
    `;

    const skipHint = document.createElement('div');
    skipHint.style.cssText = `
      font-size: 10px;
      color: #445566;
      letter-spacing: 2px;
      margin-top: 32px;
    `;
    skipHint.textContent = 'PRESS SPACE TO SKIP';

    this.countdownOverlay.appendChild(this.countdownHeader);
    this.countdownOverlay.appendChild(this.countdownNumber);
    this.countdownOverlay.appendChild(this.countdownLabel);
    this.countdownOverlay.appendChild(this.countdownObjective);
    this.countdownOverlay.appendChild(this.countdownTips);
    this.countdownOverlay.appendChild(skipHint);
    container.appendChild(this.countdownOverlay);

    // ── "GO!" flash overlay ──
    this.goFlash = document.createElement('div');
    this.goFlash.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 41;
      pointer-events: none;
      user-select: none;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 160px;
      font-weight: bold;
      color: #44ff88;
      text-shadow: 0 0 60px rgba(68,255,136,0.7), 0 0 120px rgba(68,255,136,0.3);
      transition: opacity 0.8s ease-out, transform 0.8s ease-out;
      padding-bottom: 10vh;
    `;
    this.goFlash.textContent = 'GO!';
    container.appendChild(this.goFlash);
  }

  /** Update countdown display. Returns true if countdown is active. */
  updateCountdown(remaining: number, scenarioTitle: string, objectiveLabel: string, tips: string[]): boolean {
    if (remaining <= 0) {
      // Hide countdown, trigger GO flash
      if (this.countdownOverlay.style.display !== 'none') {
        this.countdownOverlay.style.display = 'none';
        this.triggerGoFlash();
      }
      return false;
    }

    this.countdownOverlay.style.display = 'flex';
    const seconds = Math.ceil(remaining);

    // Set static content once on first call
    if (this.lastCountdownSecond === -1) {
      this.countdownLabel.textContent = scenarioTitle;
      this.countdownObjective.textContent = objectiveLabel;
      this.countdownTips.innerHTML = tips.map(t => `<div style="margin-bottom:4px">\u2022 ${t}</div>`).join('');
    }

    // Pulse animation on number change
    if (seconds !== this.lastCountdownSecond) {
      this.lastCountdownSecond = seconds;
      this.countdownNumber.textContent = String(seconds);
      this.countdownNumber.style.transform = 'scale(1.2)';
      this.countdownNumber.style.opacity = '1';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.countdownNumber.style.transform = 'scale(1.0)';
        });
      });
    }

    // Color shifts: blue → yellow → red as countdown progresses
    if (seconds <= 3) {
      this.countdownNumber.style.color = '#ff6644';
      this.countdownNumber.style.textShadow = '0 0 40px rgba(255,100,60,0.6), 0 0 80px rgba(255,60,30,0.3)';
    } else if (seconds <= 5) {
      this.countdownNumber.style.color = '#ffaa44';
      this.countdownNumber.style.textShadow = '0 0 40px rgba(255,170,68,0.5), 0 0 80px rgba(255,140,40,0.2)';
    } else {
      this.countdownNumber.style.color = '#cce0ff';
      this.countdownNumber.style.textShadow = '0 0 40px rgba(100,180,255,0.5), 0 0 80px rgba(60,120,200,0.2)';
    }

    // Fade out tips in final 3 seconds — focus on the countdown
    if (seconds <= 3) {
      this.countdownTips.style.opacity = '0.3';
      this.countdownObjective.style.opacity = '0.5';
      this.countdownHeader.textContent = 'STARTING';
    } else {
      this.countdownTips.style.opacity = '1';
      this.countdownObjective.style.opacity = '1';
    }

    return true;
  }

  private triggerGoFlash(): void {
    // Brief background flash
    this.goFlash.style.background = 'rgba(68,255,136,0.08)';
    this.goFlash.style.display = 'flex';
    this.goFlash.style.opacity = '1';
    this.goFlash.style.transform = 'scale(1.0)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.goFlash.style.opacity = '0';
        this.goFlash.style.transform = 'scale(1.4)';
        this.goFlash.style.background = 'transparent';
      });
    });

    this.goFlashTimer = window.setTimeout(() => {
      this.goFlash.style.display = 'none';
    }, 1000);
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

  show(): void {
    if (this.panel.style.display === 'flex') return;
    this.panel.style.opacity = '0';
    this.panel.style.display = 'flex';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => { this.panel.style.opacity = '1'; });
    });
  }
  hide(): void {
    this.panel.style.display = 'none';
    this.countdownOverlay.style.display = 'none';
    this.goFlash.style.display = 'none';
    if (this.goFlashTimer) clearTimeout(this.goFlashTimer);
    this.lastCountdownSecond = -1;
  }
}
