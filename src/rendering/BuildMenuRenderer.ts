import { BuildingType, Faction } from '../constants';
import { BUILDING_DEFS } from '../data/buildings';

/**
 * HTML-based build menu overlay (bottom-center of screen).
 * Shows available buildings when placement mode is active.
 */
export class BuildMenuRenderer {
  private panel: HTMLDivElement;
  private options: HTMLDivElement[] = [];
  /** Prerequisite building name per slot index (empty string = no requirement). */
  private prereqNames: string[] = [];
  /** Per-slot flash state: timestamp until which the slot border is bright red. */
  private flashUntil: number[] = new Array(9).fill(0);
  private tooltip: HTMLDivElement;
  private tooltipTimeout = 0;
  private wasVisible = false;
  private playerFaction: Faction = Faction.Terran;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.id = 'build-menu';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      gap: 8px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 13px;
      color: #eee;
      background: rgba(0, 0, 0, 0.75);
      padding: 10px 16px;
      border-radius: 4px;
      border: 1px solid rgba(100, 160, 255, 0.3);
      z-index: 10;
      pointer-events: none;
      user-select: none;
      flex-direction: row;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'width: 100%; text-align: center; color: #88bbff; margin-bottom: 4px; font-size: 11px; letter-spacing: 1px;';
    title.textContent = 'BUILD';
    this.panel.appendChild(title);

    const optionsRow = document.createElement('div');
    optionsRow.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap;';
    this.panel.appendChild(optionsRow);

    const entries: Array<{ key: string; type: BuildingType }> = [
      { key: '1', type: BuildingType.CommandCenter },
      { key: '2', type: BuildingType.SupplyDepot },
      { key: '3', type: BuildingType.Barracks },
      { key: '4', type: BuildingType.Refinery },
      { key: '5', type: BuildingType.Factory },
      { key: '6', type: BuildingType.Starport },
      { key: '7', type: BuildingType.EngineeringBay },
      { key: '8', type: BuildingType.MissileTurret },
      { key: '9', type: BuildingType.MissileTurret }, // placeholder; overwritten by setFaction
    ];

    for (const entry of entries) {
      const def = BUILDING_DEFS[entry.type];
      const opt = document.createElement('div');
      opt.style.cssText = `
        padding: 4px 8px;
        border: 1px solid rgba(100, 160, 255, 0.2);
        border-radius: 3px;
        white-space: nowrap;
      `;
      const costText = def.costGas > 0
        ? `${def.costMinerals}m ${def.costGas}g`
        : `${def.costMinerals}m`;
      opt.textContent = `${entry.key}: ${def.name} (${costText})`;
      // Store prerequisite name for this slot
      const prereqName = def.requires !== null && BUILDING_DEFS[def.requires]
        ? BUILDING_DEFS[def.requires].name
        : '';
      this.prereqNames.push(prereqName);
      optionsRow.appendChild(opt);
      this.options.push(opt);
    }

    // Tooltip div shown briefly when a locked slot is pressed
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      display: none;
      background: rgba(80, 0, 0, 0.85);
      color: #ff8888;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 12px;
      padding: 5px 12px;
      border-radius: 4px;
      border: 1px solid rgba(200, 60, 60, 0.5);
      z-index: 11;
      pointer-events: none;
      user-select: none;
      white-space: nowrap;
    `;
    container.appendChild(this.tooltip);

    container.appendChild(this.panel);
  }

  private static readonly TERRAN_BUILDING_TYPES: Array<BuildingType | 0> = [
    BuildingType.CommandCenter,
    BuildingType.SupplyDepot,
    BuildingType.Barracks,
    BuildingType.Refinery,
    BuildingType.Factory,
    BuildingType.Starport,
    BuildingType.EngineeringBay,
    BuildingType.MissileTurret,
    0, // unused slot (Zerg has 9 buildings)
  ];

  private static readonly ZERG_BUILDING_TYPES: Array<BuildingType | 0> = [
    BuildingType.Hatchery,
    BuildingType.SpawningPool,
    BuildingType.RoachWarren,
    BuildingType.HydraliskDen,
    BuildingType.Spire,
    BuildingType.EvolutionChamber,
    BuildingType.InfestationPit,
    BuildingType.SpineCrawler,
    BuildingType.SporeCrawler,
  ];

  private get buildingTypes(): Array<BuildingType | 0> {
    return this.playerFaction === Faction.Zerg
      ? BuildMenuRenderer.ZERG_BUILDING_TYPES
      : BuildMenuRenderer.TERRAN_BUILDING_TYPES;
  }

  setFaction(f: Faction): void {
    this.playerFaction = f;
    const types = this.buildingTypes;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    this.prereqNames = [];
    for (let i = 0; i < this.options.length; i++) {
      const bType = types[i];
      if (bType === 0) {
        this.options[i].textContent = '';
        this.options[i].style.display = 'none';
        this.prereqNames.push('');
      } else {
        const def = BUILDING_DEFS[bType];
        const costText = def.costGas > 0
          ? `${def.costMinerals}m ${def.costGas}g`
          : `${def.costMinerals}m`;
        this.options[i].textContent = `${keys[i]}: ${def.name} (${costText})`;
        this.options[i].style.display = '';
        const prereqName = def.requires !== null && BUILDING_DEFS[def.requires]
          ? BUILDING_DEFS[def.requires].name
          : '';
        this.prereqNames.push(prereqName);
      }
    }
  }

  update(
    visible: boolean,
    minerals: number,
    gas: number,
    selectedType: number = 0,
    techAvailable?: boolean[],
  ): void {
    if (visible !== this.wasVisible) {
      this.panel.style.display = visible ? 'flex' : 'none';
      this.wasVisible = visible;
    }
    if (!visible) return;

    const now = Date.now();
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

    for (let i = 0; i < this.options.length; i++) {
      const bType = this.buildingTypes[i];
      if (bType === 0) continue; // blank slot
      const def = BUILDING_DEFS[bType];
      const canAfford = minerals >= def.costMinerals && gas >= def.costGas;
      const techOk = techAvailable ? techAvailable[i] : true;
      const isActive = selectedType === bType;
      const isFlashing = now < this.flashUntil[i];

      // Build label text (always update innerHTML to keep req line in sync)
      const costText = def.costGas > 0
        ? `${def.costMinerals}m ${def.costGas}g`
        : `${def.costMinerals}m`;
      const mainText = `${keys[i]}: ${def.name} (${costText})`;
      const prereq = this.prereqNames[i] ?? '';

      if (!techOk && prereq) {
        this.options[i].innerHTML = `${mainText}<br><span style="color:#aa4444;font-size:9px;letter-spacing:0">Req: ${prereq}</span>`;
      } else {
        this.options[i].textContent = mainText;
      }

      if (isFlashing) {
        this.options[i].style.color = '#ff6666';
        this.options[i].style.borderColor = 'rgba(255, 60, 60, 0.9)';
        this.options[i].style.background = 'rgba(80, 0, 0, 0.4)';
      } else if (isActive) {
        this.options[i].style.color = '#fff';
        this.options[i].style.borderColor = 'rgba(100, 180, 255, 0.8)';
        this.options[i].style.background = 'rgba(40, 80, 160, 0.5)';
      } else if (!techOk) {
        // Tech requirement not met — grayed out with red tint
        this.options[i].style.color = '#555';
        this.options[i].style.borderColor = 'rgba(100, 50, 50, 0.3)';
        this.options[i].style.background = 'transparent';
      } else {
        this.options[i].style.color = canAfford ? '#eee' : '#666';
        this.options[i].style.borderColor = canAfford
          ? 'rgba(100, 160, 255, 0.4)'
          : 'rgba(100, 100, 100, 0.2)';
        this.options[i].style.background = 'transparent';
      }
    }
  }

  /**
   * Flash a locked slot bright red and show a tooltip.
   * Called when the player presses a digit key for a tech-locked building.
   */
  flashLocked(slotIndex: number, requiresName: string): void {
    this.flashUntil[slotIndex] = Date.now() + 2000;

    // Show tooltip
    this.tooltip.textContent = `Build ${requiresName} first`;
    this.tooltip.style.display = 'block';

    // Clear any existing timeout
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
    }
    this.tooltipTimeout = window.setTimeout(() => {
      this.tooltip.style.display = 'none';
      this.tooltipTimeout = 0;
    }, 2000);
  }
}
