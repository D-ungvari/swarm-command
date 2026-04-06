export class DebugOverlay {
  private panel: HTMLDivElement;
  private visible = false;
  private frameTimeSamples: number[] = [];
  private lastUpdate = 0;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed; top: 8px; right: 8px;
      background: rgba(0,0,0,0.8); color: #88ff88;
      font: 11px monospace; padding: 8px 12px;
      border: 1px solid #334; pointer-events: none;
      line-height: 1.6; display: none; z-index: 1000;
    `;
    container.appendChild(this.panel);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? 'block' : 'none';
  }

  recordFrameTime(ms: number): void {
    this.frameTimeSamples.push(ms);
    if (this.frameTimeSamples.length > 60) this.frameTimeSamples.shift();
  }

  update(entityCount: number, testCount: number, gameTime: number): void {
    if (!this.visible) return;
    const now = performance.now();
    if (now - this.lastUpdate < 200) return; // update 5x/sec
    this.lastUpdate = now;

    const avgFrame = this.frameTimeSamples.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimeSamples.length);
    const fps = 1000 / Math.max(1, avgFrame);

    this.panel.innerHTML = [
      `FPS:     ${fps.toFixed(1)}`,
      `Frame:   ${avgFrame.toFixed(2)}ms`,
      `Entities:${entityCount}`,
      `Tests:   ${testCount}`,
      `Time:    ${gameTime.toFixed(1)}s`,
      `Memory:  ${(performance as any).memory?.usedJSHeapSize
        ? ((performance as any).memory.usedJSHeapSize / 1048576).toFixed(1) + 'MB'
        : 'n/a'}`,
    ].join('<br>');
  }
}
