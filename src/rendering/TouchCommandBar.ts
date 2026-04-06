import type { GameCommandQueue } from '../input/CommandQueue';
import { CommandType } from '../input/CommandQueue';
import type { InputProcessor } from '../input/InputProcessor';
import { UnitType } from '../constants';

interface AbilityButton {
  label: string;
  shortcut: string;
  color: string;
  forUnits: number[];    // UnitType values that have this ability
  action: () => void;
}

export class TouchCommandBar {
  private bar: HTMLDivElement;
  private row1: HTMLDivElement;  // movement commands
  private row2: HTMLDivElement;  // ability buttons
  private abilityBtns: Map<string, HTMLButtonElement> = new Map();
  private lastUnitTypeKey = '';

  constructor(
    container: HTMLElement,
    private simulationQueue: GameCommandQueue,
    private inputProcessor: InputProcessor,
    private snapshotSelection: () => number[],
  ) {
    this.bar = document.createElement('div');
    this.bar.style.cssText = `
      position: fixed;
      bottom: calc(16px + 88px);
      left: 12px;
      right: calc(172px + 12px);
      display: none;
      flex-direction: column;
      gap: 6px;
      z-index: 15;
      pointer-events: none;
    `;
    container.appendChild(this.bar);

    this.row1 = this.createRow();
    this.row2 = this.createRow();
    this.bar.appendChild(this.row1);
    this.bar.appendChild(this.row2);

    this.buildRow1();
  }

  private createRow(): HTMLDivElement {
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; gap: 4px; flex-wrap: wrap; pointer-events: auto;';
    return row;
  }

  private btn(label: string, shortcut: string, color: string, onClick: () => void, tooltip = ''): HTMLButtonElement {
    const b = document.createElement('button');
    b.style.cssText = `
      min-width: 56px; min-height: 56px;
      background: rgba(0,0,0,0.75); border: 1px solid rgba(100,160,255,0.35);
      color: #cce0ff; font-family: monospace; font-size: 10px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px; cursor: pointer; border-radius: 4px;
      touch-action: manipulation; -webkit-tap-highlight-color: transparent;
    `;
    b.innerHTML = `<span style="font-size:15px">${shortcut}</span><span>${label}</span>`;
    if (tooltip) b.title = tooltip;
    b.addEventListener('touchstart', (e) => { e.stopPropagation(); onClick(); }, { passive: true });
    b.addEventListener('click', onClick);
    return b;
  }

  private buildRow1(): void {
    this.row1.innerHTML = '';
    const push = (label: string, icon: string, color: string, action: () => void) => {
      this.row1.appendChild(this.btn(label, icon, color, action));
    };

    push('Attack', 'A', '#ff8844', () => {
      this.inputProcessor.setAttackMovePending(true);
    });
    push('Stop', 'S', '#ffcc44', () => {
      this.simulationQueue.push({ type: CommandType.Stop, units: this.snapshotSelection() });
    });
    push('Hold', 'H', '#44aaff', () => {
      this.simulationQueue.push({ type: CommandType.HoldPosition, units: this.snapshotSelection() });
    });
    push('Patrol', 'P', '#44ffaa', () => {
      this.inputProcessor.setPatrolPending(true);
    });
  }

  private abilityDefs: AbilityButton[] = [
    {
      label: 'Stim', shortcut: 'T', color: '#ffaa00',
      forUnits: [UnitType.Marine, UnitType.Marauder],
      action: () => this.simulationQueue.push({ type: CommandType.Stim, units: this.snapshotSelection() }),
    },
    {
      label: 'Siege', shortcut: 'E', color: '#6688aa',
      forUnits: [UnitType.SiegeTank, UnitType.Viking],
      action: () => this.simulationQueue.push({ type: CommandType.SiegeToggle, units: this.snapshotSelection() }),
    },
    {
      label: 'Cloak', shortcut: 'C', color: '#88aaff',
      forUnits: [UnitType.Ghost],
      action: () => this.simulationQueue.push({ type: CommandType.Cloak, units: this.snapshotSelection() }),
    },
    {
      label: 'Yamato', shortcut: 'Y', color: '#ff6600',
      forUnits: [UnitType.Battlecruiser],
      action: () => this.simulationQueue.push({ type: CommandType.Yamato, units: this.snapshotSelection() }),
    },
    {
      label: 'Bile', shortcut: 'R', color: '#cc4422',
      forUnits: [UnitType.Ravager],
      action: () => this.inputProcessor.setCorrosiveBilePending(true),
    },
    {
      label: 'Fungal', shortcut: 'F', color: '#446622',
      forUnits: [UnitType.Infestor],
      action: () => this.inputProcessor.setFungalPending(true),
    },
    {
      label: 'Inject', shortcut: 'V', color: '#bb44bb',
      forUnits: [UnitType.Queen],
      action: () => this.simulationQueue.push({ type: CommandType.InjectLarva, units: this.snapshotSelection() }),
    },
    {
      label: 'Abduct', shortcut: 'G', color: '#669944',
      forUnits: [UnitType.Viper],
      action: () => this.simulationQueue.push({ type: CommandType.Abduct, units: this.snapshotSelection() }),
    },
    {
      label: 'Snipe', shortcut: 'D', color: '#00ccff',
      forUnits: [UnitType.Ghost],
      action: () => this.simulationQueue.push({ type: CommandType.Snipe, units: this.snapshotSelection() }),
    },
    {
      label: 'Transfuse', shortcut: 'X', color: '#44ff44',
      forUnits: [UnitType.Queen],
      action: () => this.simulationQueue.push({ type: CommandType.Transfuse, units: this.snapshotSelection() }),
    },
  ];

  /** Call once per frame with the set of selected unit types */
  update(selectedTypes: Set<number>, anySelected: boolean): void {
    // Show/hide the whole bar
    this.bar.style.display = anySelected ? 'flex' : 'none';
    if (!anySelected) return;

    // Rebuild row 2 only when unit type selection changes
    const key = [...selectedTypes].sort().join(',');
    if (key === this.lastUnitTypeKey) return;
    this.lastUnitTypeKey = key;

    this.row2.innerHTML = '';
    this.abilityBtns.clear();

    for (const def of this.abilityDefs) {
      const relevant = def.forUnits.some(ut => selectedTypes.has(ut));
      if (!relevant) continue;
      const b = this.btn(def.label, def.shortcut, def.color, def.action, `${def.label} (${def.shortcut})`);
      this.row2.appendChild(b);
      this.abilityBtns.set(def.label, b);
    }
  }
}
