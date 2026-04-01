import { BuildingType, Faction } from '../constants';
import { BUILDING_DEFS } from '../data/buildings';

/**
 * HTML-based build menu overlay (bottom-center of screen).
 * Shows available buildings when placement mode is active.
 */
export class BuildMenuRenderer {
  private panel: HTMLDivElement;
  private options: HTMLDivElement[] = [];
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
      optionsRow.appendChild(opt);
      this.options.push(opt);
    }

    container.appendChild(this.panel);
  }

  private static readonly TERRAN_BUILDING_TYPES: BuildingType[] = [
    BuildingType.CommandCenter,
    BuildingType.SupplyDepot,
    BuildingType.Barracks,
    BuildingType.Refinery,
    BuildingType.Factory,
    BuildingType.Starport,
    BuildingType.EngineeringBay,
  ];

  private static readonly ZERG_BUILDING_TYPES: Array<BuildingType | 0> = [
    BuildingType.Hatchery,
    BuildingType.SpawningPool,
    BuildingType.EvolutionChamber,
    0, 0, 0, 0,
  ];

  private get buildingTypes(): Array<BuildingType | 0> {
    return this.playerFaction === Faction.Zerg
      ? BuildMenuRenderer.ZERG_BUILDING_TYPES
      : BuildMenuRenderer.TERRAN_BUILDING_TYPES;
  }

  setFaction(f: Faction): void {
    this.playerFaction = f;
    const types = this.buildingTypes;
    const keys = ['1', '2', '3', '4', '5', '6', '7'];
    for (let i = 0; i < this.options.length; i++) {
      const bType = types[i];
      if (bType === 0) {
        this.options[i].textContent = '';
        this.options[i].style.display = 'none';
      } else {
        const def = BUILDING_DEFS[bType];
        const costText = def.costGas > 0
          ? `${def.costMinerals}m ${def.costGas}g`
          : `${def.costMinerals}m`;
        this.options[i].textContent = `${keys[i]}: ${def.name} (${costText})`;
        this.options[i].style.display = '';
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

    for (let i = 0; i < this.options.length; i++) {
      const bType = this.buildingTypes[i];
      if (bType === 0) continue; // blank slot
      const def = BUILDING_DEFS[bType];
      const canAfford = minerals >= def.costMinerals && gas >= def.costGas;
      const techOk = techAvailable ? techAvailable[i] : true;
      const isActive = selectedType === bType;

      if (isActive) {
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
}
