/**
 * Always-visible horizontal strip showing control groups 1-9.
 * Highlights groups that have units assigned, and marks the last-recalled group as active.
 */
export class ControlGroupRenderer {
  private panel: HTMLDivElement;
  private slots: HTMLDivElement[] = [];

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed; top: 8px; left: 12px;
      display: flex; gap: 3px; z-index: 10; pointer-events: none;
    `;
    for (let i = 1; i <= 9; i++) {
      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5); border: 1px solid rgba(60,100,160,0.3);
        color: #557799; font-family: monospace; font-size: 10px; border-radius: 3px;
      `;
      slot.textContent = `${i}`;
      this.panel.appendChild(slot);
      this.slots.push(slot);
    }
    container.appendChild(this.panel);
  }

  update(groupInfo: Array<{ count: number }>, activeGroup: number): void {
    for (let i = 0; i < 9; i++) {
      const info = groupInfo[i + 1]; // groups are 1-indexed for display, stored 0-9
      const slot = this.slots[i];
      const isActive = (i + 1) === activeGroup;

      if (info && info.count > 0) {
        slot.style.color = isActive ? '#cce0ff' : '#88aacc';
        slot.style.borderColor = isActive ? 'rgba(100,180,255,0.8)' : 'rgba(60,120,200,0.5)';
        slot.style.background = isActive ? 'rgba(30,60,120,0.7)' : 'rgba(10,30,60,0.6)';
        slot.textContent = `${i + 1}:${info.count}`;
      } else {
        slot.style.color = '#334';
        slot.style.borderColor = 'rgba(40,60,80,0.2)';
        slot.style.background = 'rgba(0,0,0,0.3)';
        slot.textContent = `${i + 1}`;
      }
    }
  }
}
