/**
 * Always-visible horizontal strip showing control groups 1-9.
 * Highlights groups that have units assigned, and marks the last-recalled group as active.
 * Hover to expand and see unit type breakdown with colored badges.
 * Click to recall, right-click type badge to remove type, double-click type badge to filter.
 */
import { UNIT_DEFS } from '../data/units';

/** Convert a 0xRRGGBB number to a CSS hex string. */
function hexColor(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export interface ControlGroupSlotInfo {
  count: number;
  types?: Record<number, number>;
}

export class ControlGroupRenderer {
  private panel: HTMLDivElement;
  private slots: HTMLDivElement[] = [];
  private tooltips: HTMLDivElement[] = [];
  private hoveredSlot = -1;

  private recallCb: ((group: number) => void) | null = null;
  private removeTypeCb: ((group: number, unitType: number) => void) | null = null;

  /** Cached group info from last update — needed for tooltip interactions. */
  private lastGroupInfo: Array<ControlGroupSlotInfo> = [];
  private lastActiveGroup = -1;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed; top: 8px; left: 12px;
      display: flex; gap: 3px; z-index: 10;
      pointer-events: auto;
    `;

    for (let i = 1; i <= 9; i++) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = `position: relative; display: inline-block;`;

      const slot = document.createElement('div');
      slot.dataset.group = String(i);
      slot.style.cssText = `
        min-width: 36px; height: 28px; padding: 0 5px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5); border: 1px solid rgba(60,100,160,0.3);
        color: #557799; font-family: monospace; font-size: 10px; border-radius: 3px;
        cursor: pointer; user-select: none; white-space: nowrap;
        transition: background 0.12s, border-color 0.12s;
      `;
      slot.textContent = `${i}`;

      // Tooltip (dropdown below slot)
      const tooltip = document.createElement('div');
      tooltip.style.cssText = `
        display: none; position: absolute; top: 30px; left: 0;
        background: rgba(8,16,32,0.92); border: 1px solid rgba(60,120,200,0.5);
        border-radius: 4px; padding: 4px 6px; z-index: 20;
        font-family: monospace; font-size: 10px; white-space: nowrap;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6);
        pointer-events: auto;
      `;

      // Hover events on the wrapper (covers both slot and tooltip)
      const groupIdx = i;
      wrapper.addEventListener('mouseenter', () => {
        this.hoveredSlot = groupIdx;
        this.rebuildTooltip(groupIdx);
      });
      wrapper.addEventListener('mouseleave', () => {
        if (this.hoveredSlot === groupIdx) {
          this.hoveredSlot = -1;
          tooltip.style.display = 'none';
        }
      });

      // Left-click on slot → recall
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.recallCb) this.recallCb(groupIdx);
      });

      // Prevent context menu on the whole wrapper
      wrapper.addEventListener('contextmenu', (e) => e.preventDefault());

      wrapper.appendChild(slot);
      wrapper.appendChild(tooltip);
      this.panel.appendChild(wrapper);
      this.slots.push(slot);
      this.tooltips.push(tooltip);
    }
    container.appendChild(this.panel);
  }

  setRecallCallback(fn: (group: number) => void): void {
    this.recallCb = fn;
  }

  setRemoveTypeCallback(fn: (group: number, unitType: number) => void): void {
    this.removeTypeCb = fn;
  }

  /** Rebuild the tooltip content for a specific group. */
  private rebuildTooltip(groupIdx: number): void {
    const slotIdx = groupIdx - 1;
    const tooltip = this.tooltips[slotIdx];
    const info = this.lastGroupInfo[groupIdx];

    if (!info || info.count === 0 || !info.types) {
      tooltip.style.display = 'none';
      return;
    }

    // Clear previous content
    tooltip.innerHTML = '';

    const types = info.types;
    const entries = Object.entries(types)
      .map(([ut, count]) => ({ ut: Number(ut), count: count as number }))
      .filter(e => e.count > 0)
      .sort((a, b) => {
        // Sort by priority: higher supply/cost types first for readability
        const defA = UNIT_DEFS[a.ut];
        const defB = UNIT_DEFS[b.ut];
        if (defA && defB) return (defB.costMinerals + defB.costGas) - (defA.costMinerals + defA.costGas);
        return a.ut - b.ut;
      });

    if (entries.length === 0) {
      tooltip.style.display = 'none';
      return;
    }

    for (const entry of entries) {
      const def = UNIT_DEFS[entry.ut];
      const badge = document.createElement('div');
      badge.style.cssText = `
        display: flex; align-items: center; gap: 4px;
        padding: 2px 4px; margin: 1px 0; border-radius: 2px;
        cursor: pointer; user-select: none;
        transition: background 0.1s;
      `;

      // Color swatch
      const swatch = document.createElement('span');
      const color = def ? hexColor(def.color) : '#888';
      swatch.style.cssText = `
        display: inline-block; width: 10px; height: 10px;
        background: ${color}; border: 1px solid rgba(255,255,255,0.15);
        border-radius: 2px; flex-shrink: 0;
      `;

      // Name + count
      const label = document.createElement('span');
      label.style.cssText = `color: #aaccee; font-size: 10px;`;
      const name = def ? def.name : `Type ${entry.ut}`;
      label.textContent = `${name} \u00d7${entry.count}`;

      badge.appendChild(swatch);
      badge.appendChild(label);

      // Hover highlight
      badge.addEventListener('mouseenter', () => {
        badge.style.background = 'rgba(60,120,200,0.25)';
      });
      badge.addEventListener('mouseleave', () => {
        badge.style.background = 'transparent';
      });

      // Double-click: recall group then filter selection to only this unit type
      badge.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.recallCb) this.recallCb(groupIdx);
        if (this.dblClickTypeCb) this.dblClickTypeCb(groupIdx, entry.ut);
      });

      // Right-click: remove all of this type from the group
      badge.addEventListener('contextmenu', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (this.removeTypeCb) {
          this.removeTypeCb(groupIdx, entry.ut);
          // Rebuild tooltip after removal
          // The data will be stale until next update(), but we can optimistically patch
          if (info.types) {
            delete info.types[entry.ut];
            info.count = Object.values(info.types).reduce((s, c) => s + c, 0);
          }
          this.rebuildTooltip(groupIdx);
          this.updateSlotVisuals(slotIdx, info, groupIdx === this.lastActiveGroup);
        }
      });

      tooltip.appendChild(badge);
    }

    tooltip.style.display = 'block';
  }

  /** Update visuals of a single slot. */
  private updateSlotVisuals(slotIdx: number, info: ControlGroupSlotInfo | undefined, isActive: boolean): void {
    const slot = this.slots[slotIdx];
    const groupNum = slotIdx + 1;

    if (info && info.count > 0) {
      slot.style.color = isActive ? '#cce0ff' : '#88aacc';
      slot.style.borderColor = isActive ? 'rgba(100,180,255,0.8)' : 'rgba(60,120,200,0.5)';
      slot.style.background = isActive ? 'rgba(30,60,120,0.7)' : 'rgba(10,30,60,0.6)';
      slot.textContent = `${groupNum}:${info.count}`;
    } else {
      slot.style.color = '#334';
      slot.style.borderColor = 'rgba(40,60,80,0.2)';
      slot.style.background = 'rgba(0,0,0,0.3)';
      slot.textContent = `${groupNum}`;
    }
  }

  // Optional double-click-on-type callback
  private dblClickTypeCb: ((group: number, unitType: number) => void) | null = null;

  setDoubleClickTypeCallback(fn: (group: number, unitType: number) => void): void {
    this.dblClickTypeCb = fn;
  }

  update(groupInfo: Array<ControlGroupSlotInfo>, activeGroup: number): void {
    this.lastGroupInfo = groupInfo;
    this.lastActiveGroup = activeGroup;

    for (let i = 0; i < 9; i++) {
      const info = groupInfo[i + 1]; // groups are 1-indexed for display, stored 0-9
      const isActive = (i + 1) === activeGroup;
      this.updateSlotVisuals(i, info, isActive);
    }

    // If we're hovering a slot, keep the tooltip up-to-date
    if (this.hoveredSlot > 0) {
      this.rebuildTooltip(this.hoveredSlot);
    }
  }
}
