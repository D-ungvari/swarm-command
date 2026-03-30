import { Faction, BuildState, BuildingType, ResourceType } from '../constants';
import {
  BUILDING, RESOURCE, UNIT_TYPE,
  buildingType, buildState, prodUnitType, prodProgress, prodTimeTotal,
  resourceRemaining, resourceType, unitType,
  selected, hpCurrent, hpMax, faction,
  POSITION, SELECTABLE, RENDERABLE, HEALTH,
} from '../ecs/components';
import { type World, hasComponents } from '../ecs/world';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';

/**
 * HTML-based info panel (bottom-left of screen).
 * Shows details about the first selected entity.
 */
export class InfoPanelRenderer {
  private panel: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private detailEl: HTMLDivElement;
  private barContainer: HTMLDivElement;
  private barFill: HTMLDivElement;
  private barLabel: HTMLDivElement;
  private prodRow: HTMLDivElement;
  private prodBarFill: HTMLDivElement;
  private prodLabel: HTMLDivElement;
  private wasVisible = false;

  constructor(container: HTMLElement) {
    this.panel = document.createElement('div');
    this.panel.id = 'info-panel';
    this.panel.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 12px;
      display: none;
      flex-direction: column;
      gap: 4px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 13px;
      color: #eee;
      background: rgba(0, 0, 0, 0.75);
      padding: 8px 12px;
      border-radius: 4px;
      border: 1px solid rgba(100, 160, 255, 0.3);
      z-index: 10;
      pointer-events: none;
      user-select: none;
      min-width: 160px;
    `;

    // Name
    this.nameEl = document.createElement('div');
    this.nameEl.style.cssText = 'color: #88bbff; font-size: 14px; font-weight: bold;';
    this.panel.appendChild(this.nameEl);

    // Detail line (faction, etc.)
    this.detailEl = document.createElement('div');
    this.detailEl.style.cssText = 'color: #aaa; font-size: 11px;';
    this.panel.appendChild(this.detailEl);

    // HP bar
    this.barContainer = document.createElement('div');
    this.barContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 12px;
      background: #222;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 2px;
    `;
    this.barFill = document.createElement('div');
    this.barFill.style.cssText = 'height: 100%; background: #44ff44; transition: width 0.1s;';
    this.barLabel = document.createElement('div');
    this.barLabel.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 9px; color: #fff; text-shadow: 0 0 2px #000;
    `;
    this.barContainer.appendChild(this.barFill);
    this.barContainer.appendChild(this.barLabel);
    this.panel.appendChild(this.barContainer);

    // Production row (for buildings)
    this.prodRow = document.createElement('div');
    this.prodRow.style.cssText = 'display: none; flex-direction: column; gap: 2px; margin-top: 4px;';

    this.prodLabel = document.createElement('div');
    this.prodLabel.style.cssText = 'font-size: 11px; color: #ffcc44;';
    this.prodRow.appendChild(this.prodLabel);

    const prodBarContainer = document.createElement('div');
    prodBarContainer.style.cssText = `
      width: 100%;
      height: 8px;
      background: #222;
      border-radius: 2px;
      overflow: hidden;
    `;
    this.prodBarFill = document.createElement('div');
    this.prodBarFill.style.cssText = 'height: 100%; background: #ffaa22; transition: width 0.1s;';
    prodBarContainer.appendChild(this.prodBarFill);
    this.prodRow.appendChild(prodBarContainer);

    this.panel.appendChild(this.prodRow);

    container.appendChild(this.panel);
  }

  update(world: World, _gameTime: number): void {
    // Find first selected entity
    let sel = -1;
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, SELECTABLE) || selected[eid] !== 1) continue;
      if (!hasComponents(world, eid, POSITION | RENDERABLE)) continue;
      sel = eid;
      break;
    }

    const visible = sel > 0;
    if (visible !== this.wasVisible) {
      this.panel.style.display = visible ? 'flex' : 'none';
      this.wasVisible = visible;
    }
    if (!visible) return;

    const eid = sel;

    // Resource entity
    if (hasComponents(world, eid, RESOURCE)) {
      const rt = resourceType[eid] as ResourceType;
      const name = rt === ResourceType.Mineral ? 'Mineral Patch' : 'Vespene Geyser';
      this.nameEl.textContent = name;
      this.detailEl.textContent = `Remaining: ${Math.floor(resourceRemaining[eid])}`;
      const hp = hpCurrent[eid];
      const maxHp = hpMax[eid];
      const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
      this.barFill.style.width = `${ratio * 100}%`;
      this.barFill.style.background = rt === ResourceType.Mineral ? '#44bbff' : '#44ff66';
      this.barLabel.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
      this.prodRow.style.display = 'none';
      return;
    }

    // Building entity
    if (hasComponents(world, eid, BUILDING)) {
      const bt = buildingType[eid] as BuildingType;
      const def = BUILDING_DEFS[bt];
      const name = def ? def.name : 'Building';
      const bs = buildState[eid] as BuildState;
      this.nameEl.textContent = name;

      const fac = faction[eid] as Faction;
      const facName = fac === Faction.Terran ? 'Terran' : fac === Faction.Zerg ? 'Zerg' : '';
      this.detailEl.textContent = bs === BuildState.UnderConstruction
        ? `${facName} | Under Construction`
        : facName;

      const hp = hpCurrent[eid];
      const maxHp = hpMax[eid];
      const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
      this.barFill.style.width = `${ratio * 100}%`;
      this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
      this.barLabel.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;

      // Production info
      const pType = prodUnitType[eid];
      if (pType > 0 && prodTimeTotal[eid] > 0) {
        const unitDef = UNIT_DEFS[pType];
        const unitName = unitDef ? unitDef.name : 'Unit';
        const progress = prodProgress[eid];
        const total = prodTimeTotal[eid];
        const pct = total > 0 ? Math.min(1, progress / total) : 0;
        this.prodLabel.textContent = `Training: ${unitName}`;
        this.prodBarFill.style.width = `${pct * 100}%`;
        this.prodRow.style.display = 'flex';
      } else {
        this.prodRow.style.display = 'none';
      }
      return;
    }

    // Unit entity
    if (hasComponents(world, eid, UNIT_TYPE)) {
      const ut = unitType[eid];
      const def = UNIT_DEFS[ut];
      const name = def ? def.name : 'Unit';
      this.nameEl.textContent = name;

      const fac = faction[eid] as Faction;
      const facName = fac === Faction.Terran ? 'Terran' : fac === Faction.Zerg ? 'Zerg' : '';
      this.detailEl.textContent = facName;

      if (hasComponents(world, eid, HEALTH)) {
        const hp = hpCurrent[eid];
        const maxHp = hpMax[eid];
        const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
        this.barFill.style.width = `${ratio * 100}%`;
        this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
        this.barLabel.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
      }

      this.prodRow.style.display = 'none';
      return;
    }

    // Fallback — generic entity
    this.nameEl.textContent = 'Entity';
    this.detailEl.textContent = '';
    this.prodRow.style.display = 'none';
  }
}
