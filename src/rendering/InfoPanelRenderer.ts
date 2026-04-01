import { Faction, BuildState, BuildingType, ResourceType, UnitType, UpgradeType, STIM_DURATION } from '../constants';
import {
  BUILDING, RESOURCE, UNIT_TYPE,
  buildingType, buildState, prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  resourceRemaining, resourceType, unitType,
  selected, hpCurrent, hpMax, faction, renderTint, killCount,
  POSITION, SELECTABLE, RENDERABLE, HEALTH,
  energy, cloaked, stimEndTime,
  larvaCount,
} from '../ecs/components';
import { type World, hasComponents } from '../ecs/world';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { encodeResearch, getUpgradeCost, UPGRADE_RESEARCH_OFFSET } from '../systems/UpgradeSystem';
import type { PlayerResources } from '../types';

/** Callback type for production button clicks */
export type ProductionCallback = (buildingEid: number, unitType: number) => void;

/** Callback type for research button clicks */
export type ResearchCallback = (buildingEid: number, upgradeType: number) => void;

/** Labels for the 3 Engineering Bay upgrades */
const ENGBAY_UPGRADES: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.InfantryWeapons, label: 'Inf Weapons' },
  { type: UpgradeType.InfantryArmor,   label: 'Inf Armor'   },
  { type: UpgradeType.VehicleWeapons,  label: 'Veh Weapons' },
];

const UPGRADE_NAMES: Record<number, string> = {
  [UpgradeType.InfantryWeapons]: 'Inf Weapons',
  [UpgradeType.InfantryArmor]:   'Inf Armor',
  [UpgradeType.VehicleWeapons]:  'Veh Weapons',
  [UpgradeType.ZergMelee]:       'Zerg Melee',
  [UpgradeType.ZergRanged]:      'Zerg Ranged',
  [UpgradeType.ZergCarapace]:    'Zerg Carapace',
};

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
  private prodButtonsRow: HTMLDivElement;
  private prodButtons: HTMLDivElement[] = [];
  private queueRow: HTMLDivElement;
  private researchButtonsRow: HTMLDivElement;
  private researchButtons: HTMLDivElement[] = [];
  private wasVisible = false;
  private productionCallback: ProductionCallback | null = null;
  private researchCallback: ResearchCallback | null = null;
  private lastButtonConfig = '';

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

    // Production progress row (for buildings currently producing)
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

    // Production buttons row (clickable buttons for available units)
    this.prodButtonsRow = document.createElement('div');
    this.prodButtonsRow.style.cssText = 'display: none; flex-direction: row; gap: 4px; margin-top: 4px; pointer-events: auto;';
    this.panel.appendChild(this.prodButtonsRow);

    // Production queue display row
    this.queueRow = document.createElement('div');
    this.queueRow.style.cssText = 'display: none; flex-direction: row; gap: 3px; margin-top: 4px; align-items: center;';
    this.panel.appendChild(this.queueRow);

    // Research buttons row (Engineering Bay / Evolution Chamber)
    this.researchButtonsRow = document.createElement('div');
    this.researchButtonsRow.style.cssText = 'display: none; flex-direction: row; gap: 4px; margin-top: 4px; pointer-events: auto; flex-wrap: wrap;';
    this.panel.appendChild(this.researchButtonsRow);

    container.appendChild(this.panel);
  }

  /** Wire up a callback for production button clicks */
  setProductionCallback(fn: ProductionCallback): void {
    this.productionCallback = fn;
  }

  /** Wire up a callback for research button clicks */
  setResearchCallback(fn: ResearchCallback): void {
    this.researchCallback = fn;
  }

  update(world: World, gameTime: number, playerResources?: PlayerResources): void {
    // Count selected entities and find first one
    let sel = -1;
    let selCount = 0;
    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, SELECTABLE) || selected[eid] !== 1) continue;
      if (!hasComponents(world, eid, POSITION | RENDERABLE)) continue;
      selCount++;
      if (sel < 0) sel = eid;
    }

    const visible = sel > 0;
    if (visible !== this.wasVisible) {
      this.panel.style.display = visible ? 'flex' : 'none';
      this.wasVisible = visible;
    }
    if (!visible) {
      this.prodButtonsRow.style.display = 'none';
      this.researchButtonsRow.style.display = 'none';
      this.queueRow.style.display = 'none';
      return;
    }

    // Multiple units selected — show group breakdown with total HP
    if (selCount > 1) {
      // Count units by type and accumulate HP
      const typeCounts: Record<number, number> = {};
      const typeTints: Record<number, number> = {};
      let totalHp = 0;
      let totalMaxHp = 0;
      for (let e = 1; e < world.nextEid; e++) {
        if (!hasComponents(world, e, SELECTABLE) || selected[e] !== 1) continue;
        if (!hasComponents(world, e, POSITION | RENDERABLE)) continue;
        if (hasComponents(world, e, UNIT_TYPE)) {
          const ut = unitType[e];
          typeCounts[ut] = (typeCounts[ut] || 0) + 1;
          if (!typeTints[ut]) typeTints[ut] = renderTint[e];
        }
        if (hasComponents(world, e, HEALTH)) {
          totalHp += hpCurrent[e];
          totalMaxHp += hpMax[e];
        }
      }

      // Build compact type breakdown string
      const parts: string[] = [];
      for (const ut of Object.keys(typeCounts)) {
        const uType = Number(ut);
        const def = UNIT_DEFS[uType];
        const name = def ? def.name : 'Unit';
        parts.push(`${typeCounts[uType]}x ${name}`);
      }

      this.nameEl.textContent = `${selCount} units selected`;
      // Use innerHTML to color each type entry
      let detailHtml = '';
      for (const ut of Object.keys(typeCounts)) {
        const uType = Number(ut);
        const def = UNIT_DEFS[uType];
        const name = def ? def.name : 'Unit';
        const tint = typeTints[uType] || 0xeeeeee;
        const r = (tint >> 16) & 0xff;
        const g = (tint >> 8) & 0xff;
        const b = tint & 0xff;
        if (detailHtml) detailHtml += '&nbsp;&nbsp;';
        detailHtml += `<span style="color:rgb(${r},${g},${b})">${typeCounts[uType]}x ${name}</span>`;
      }
      this.detailEl.innerHTML = detailHtml;

      // Show total HP bar
      this.barContainer.style.display = 'block';
      const ratio = totalMaxHp > 0 ? Math.max(0, totalHp / totalMaxHp) : 0;
      this.barFill.style.width = `${ratio * 100}%`;
      this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
      this.barLabel.textContent = `${Math.floor(totalHp)}/${Math.floor(totalMaxHp)}`;

      this.prodRow.style.display = 'none';
      this.prodButtonsRow.style.display = 'none';
      this.researchButtonsRow.style.display = 'none';
      this.queueRow.style.display = 'none';
      // Border stays blue (player's faction)
      this.panel.style.borderColor = 'rgba(100, 160, 255, 0.3)';
      return;
    }

    this.barContainer.style.display = 'block';

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
      this.prodButtonsRow.style.display = 'none';
      this.researchButtonsRow.style.display = 'none';
      this.queueRow.style.display = 'none';
      // Cyan border for resources
      this.panel.style.borderColor = 'rgba(80, 200, 255, 0.3)';
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

      const hp = hpCurrent[eid];
      const maxHp = hpMax[eid];
      const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
      this.barFill.style.width = `${ratio * 100}%`;
      this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
      this.barLabel.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;

      // Engineering Bay: research buttons + research progress
      if (bt === BuildingType.EngineeringBay) {
        this.detailEl.textContent = bs === BuildState.UnderConstruction
          ? `${facName} | Under Construction`
          : facName;
        this.queueRow.style.display = 'none';
        this.prodButtonsRow.style.display = 'none';

        const pType = prodUnitType[eid];
        if (pType >= UPGRADE_RESEARCH_OFFSET && prodTimeTotal[eid] > 0) {
          // Research in progress — show progress bar
          const upgradeType = pType - UPGRADE_RESEARCH_OFFSET;
          const upgradeName = UPGRADE_NAMES[upgradeType] ?? 'Research';
          const pct = prodTimeTotal[eid] > 0 ? Math.min(1, 1 - prodProgress[eid] / prodTimeTotal[eid]) : 0;
          this.prodLabel.textContent = `Researching: ${upgradeName}`;
          this.prodBarFill.style.width = `${pct * 100}%`;
          this.prodRow.style.display = 'flex';
          this.researchButtonsRow.style.display = 'none';
        } else {
          this.prodRow.style.display = 'none';
          if (bs === BuildState.Complete) {
            this.updateResearchButtons(eid, playerResources);
          } else {
            this.researchButtonsRow.style.display = 'none';
          }
        }
      // Standard production building
      } else {
        this.researchButtonsRow.style.display = 'none';

        const pType = prodUnitType[eid];
        if (pType > 0 && prodTimeTotal[eid] > 0) {
          const unitDef = UNIT_DEFS[pType];
          const unitName = unitDef ? unitDef.name : 'Unit';
          const progress = prodProgress[eid];
          const total = prodTimeTotal[eid];
          const pct = total > 0 ? Math.min(1, 1 - progress / total) : 0;
          this.prodLabel.textContent = `Training: ${unitName}`;
          this.prodBarFill.style.width = `${pct * 100}%`;
          this.prodRow.style.display = 'flex';
          this.detailEl.textContent = bs === BuildState.UnderConstruction
            ? `${facName} | Under Construction`
            : facName;

          // Show production queue
          this.updateQueueDisplay(eid);

          this.prodButtonsRow.style.display = 'none';
        } else {
          this.prodRow.style.display = 'none';
          this.queueRow.style.display = 'none';

          // Show available production hotkeys/buttons for completed buildings
          if (bs === BuildState.Complete && def && def.produces.length > 0) {
            const hotkeys = ['Q', 'W'];
            const hotkeyParts: string[] = [];
            for (let i = 0; i < def.produces.length; i++) {
              const uDef = UNIT_DEFS[def.produces[i]];
              if (uDef && i < hotkeys.length) {
                hotkeyParts.push(`${hotkeys[i]}: ${uDef.name}`);
              }
            }
            this.detailEl.textContent = `${facName} | ${hotkeyParts.join('  ')}`;

            // Show clickable production buttons
            this.updateProductionButtons(eid, def.produces, playerResources);
          } else {
            this.detailEl.textContent = bs === BuildState.UnderConstruction
              ? `${facName} | Under Construction`
              : facName;
            this.prodButtonsRow.style.display = 'none';
          }
        }
      }
      // Hatchery: show larva count
      if (bt === BuildingType.Hatchery) {
        const larva = larvaCount[eid];
        const larvaText = larva > 0 ? `  Larva: ${larva}/3` : '  Larva: 0/3 (regenerating)';
        this.detailEl.textContent += larvaText;
      }

      // Faction-colored border for buildings
      this.panel.style.borderColor = fac === Faction.Zerg
        ? 'rgba(255, 80, 80, 0.3)'
        : 'rgba(100, 160, 255, 0.3)';
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
      const kills = killCount[eid];
      this.detailEl.textContent = kills > 0 ? `${facName}  Kills: ${kills}` : facName;

      // Ghost: show energy and cloak status
      if (ut === UnitType.Ghost) {
        const energyVal = energy[eid];
        const cloakStatus = cloaked[eid] === 1 ? ' [CLOAKED]' : '';
        this.detailEl.textContent += `  E:${Math.floor(energyVal)}${cloakStatus}`;
      }

      // Marine: show stim pack status
      if (ut === UnitType.Marine) {
        const stimRemaining = stimEndTime[eid] - gameTime;
        if (stimRemaining > 0) {
          this.detailEl.textContent += `  STIM: ${stimRemaining.toFixed(1)}s`;
        } else {
          this.detailEl.textContent += `  T: Stim Pack`;
        }
      }

      // Show upgrade bonuses
      if (playerResources?.upgrades && fac === Faction.Terran) {
        const upgrades = playerResources.upgrades;
        const ut = unitType[eid] as UnitType;
        let wBonus = 0;
        let aBonus = 0;
        if (ut === UnitType.SiegeTank) {
          wBonus = upgrades[2]; // VehicleWeapons
        } else {
          wBonus = upgrades[0]; // InfantryWeapons
        }
        aBonus = upgrades[1]; // InfantryArmor
        if (wBonus > 0 || aBonus > 0) {
          const bonusParts: string[] = [];
          if (wBonus > 0) bonusParts.push(`+${wBonus} dmg`);
          if (aBonus > 0) bonusParts.push(`+${aBonus} armor`);
          this.detailEl.textContent += `  ${bonusParts.join(' ')}`;
        }
      }

      if (hasComponents(world, eid, HEALTH)) {
        const hp = hpCurrent[eid];
        const maxHp = hpMax[eid];
        const ratio = maxHp > 0 ? Math.max(0, hp / maxHp) : 0;
        this.barFill.style.width = `${ratio * 100}%`;
        this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
        this.barLabel.textContent = `${Math.floor(hp)}/${Math.floor(maxHp)}`;
      }

      this.prodRow.style.display = 'none';
      this.prodButtonsRow.style.display = 'none';
      this.researchButtonsRow.style.display = 'none';
      this.queueRow.style.display = 'none';
      // Faction-colored border for units
      this.panel.style.borderColor = fac === Faction.Zerg
        ? 'rgba(255, 80, 80, 0.3)'
        : 'rgba(100, 160, 255, 0.3)';
      return;
    }

    // Fallback — generic entity
    this.nameEl.textContent = 'Entity';
    this.detailEl.textContent = '';
    this.prodRow.style.display = 'none';
    this.prodButtonsRow.style.display = 'none';
    this.researchButtonsRow.style.display = 'none';
    this.queueRow.style.display = 'none';
    this.panel.style.borderColor = 'rgba(100, 160, 255, 0.3)';
  }

  private updateProductionButtons(buildingEid: number, produces: readonly number[], playerResources?: PlayerResources): void {
    const hotkeys = ['Q', 'W'];
    // Build a config string to detect changes and avoid unnecessary DOM rebuilds
    const configKey = `${buildingEid}:${produces.join(',')}`;

    if (configKey !== this.lastButtonConfig) {
      this.lastButtonConfig = configKey;
      // Rebuild buttons
      this.prodButtonsRow.innerHTML = '';
      this.prodButtons = [];

      for (let i = 0; i < produces.length; i++) {
        const uType = produces[i];
        const uDef = UNIT_DEFS[uType];
        if (!uDef || i >= hotkeys.length) continue;

        const btn = document.createElement('div');
        btn.style.cssText = `
          padding: 3px 6px;
          border: 1px solid rgba(100, 160, 255, 0.4);
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
          white-space: nowrap;
          pointer-events: auto;
          transition: background 0.1s;
        `;
        const costText = uDef.costGas > 0
          ? `${uDef.costMinerals}m ${uDef.costGas}g`
          : `${uDef.costMinerals}m`;
        btn.textContent = `${hotkeys[i]}: ${uDef.name} ${costText}`;

        btn.addEventListener('mouseenter', () => {
          if (btn.style.color !== 'rgb(102, 102, 102)') {
            btn.style.background = 'rgba(40, 80, 160, 0.5)';
          }
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
        });
        btn.addEventListener('click', () => {
          if (this.productionCallback) {
            this.productionCallback(buildingEid, uType);
          }
        });

        this.prodButtonsRow.appendChild(btn);
        this.prodButtons.push(btn);
      }
    }

    // Update button affordability styling
    for (let i = 0; i < this.prodButtons.length && i < produces.length; i++) {
      const uDef = UNIT_DEFS[produces[i]];
      if (!uDef) continue;

      const canAfford = playerResources
        ? playerResources.minerals >= uDef.costMinerals && playerResources.gas >= uDef.costGas
        : false;
      const supplyCapped = playerResources
        ? playerResources.supplyUsed >= playerResources.supplyProvided
        : false;
      const enabled = canAfford && !supplyCapped;

      this.prodButtons[i].style.color = enabled ? '#eee' : '#666';
      this.prodButtons[i].style.borderColor = enabled
        ? 'rgba(100, 160, 255, 0.4)'
        : 'rgba(100, 100, 100, 0.2)';
      this.prodButtons[i].style.cursor = enabled ? 'pointer' : 'default';
    }

    this.prodButtonsRow.style.display = produces.length > 0 ? 'flex' : 'none';
  }

  /** Show the production queue (up to 5 slots) below the production bar */
  private updateQueueDisplay(buildingEid: number): void {
    const qLen = prodQueueLen[buildingEid];
    if (qLen === 0) {
      this.queueRow.style.display = 'none';
      return;
    }

    this.queueRow.style.display = 'flex';
    this.queueRow.innerHTML = '';

    // Label
    const label = document.createElement('span');
    label.style.cssText = 'font-size: 10px; color: #999; margin-right: 2px;';
    label.textContent = 'Queue:';
    this.queueRow.appendChild(label);

    const qBase = buildingEid * PROD_QUEUE_MAX;
    for (let i = 0; i < qLen; i++) {
      const uType = prodQueue[qBase + i];
      const uDef = UNIT_DEFS[uType];
      const name = uDef ? uDef.name : '?';

      const slot = document.createElement('span');
      slot.style.cssText = `
        font-size: 10px;
        color: #ffcc44;
        background: rgba(255, 170, 34, 0.15);
        border: 1px solid rgba(255, 170, 34, 0.3);
        border-radius: 2px;
        padding: 1px 4px;
      `;
      slot.textContent = name;
      this.queueRow.appendChild(slot);
    }
  }

  /** Render research buttons for Engineering Bay (and similar research buildings). */
  private updateResearchButtons(buildingEid: number, playerResources?: PlayerResources): void {
    const isResearching = prodUnitType[buildingEid] >= UPGRADE_RESEARCH_OFFSET;

    // Rebuild buttons (always — the level label must stay current)
    this.researchButtonsRow.innerHTML = '';
    this.researchButtons = [];

    for (const { type, label } of ENGBAY_UPGRADES) {
      const currentLevel = playerResources ? playerResources.upgrades[type] : 0;
      const cost = getUpgradeCost(type, currentLevel);
      const maxed = cost === null;
      const canAfford = !maxed && playerResources
        ? playerResources.minerals >= cost.minerals && playerResources.gas >= cost.gas
        : false;
      const enabled = !maxed && canAfford && !isResearching;

      const btn = document.createElement('div');
      btn.style.cssText = `
        padding: 3px 6px;
        border: 1px solid rgba(100, 160, 255, 0.4);
        border-radius: 3px;
        font-size: 11px;
        cursor: ${enabled ? 'pointer' : 'default'};
        white-space: nowrap;
        pointer-events: auto;
        transition: background 0.1s;
        color: ${enabled ? '#eee' : '#666'};
        border-color: ${enabled ? 'rgba(100, 160, 255, 0.4)' : 'rgba(100, 100, 100, 0.2)'};
      `;

      const levelStr = maxed ? ' (max)' : ` +${currentLevel}`;
      btn.title = maxed ? `${label} (maxed)` : `${label} — ${cost.minerals}m ${cost.gas}g`;

      // Two-line inner layout: label + level on top, cost below
      const topLine = document.createElement('div');
      topLine.textContent = `${label}${levelStr}`;
      const bottomLine = document.createElement('div');
      bottomLine.style.cssText = 'font-size: 10px; color: #aaa;';
      bottomLine.textContent = maxed ? 'maxed' : `${cost.minerals}m ${cost.gas}g`;
      btn.appendChild(topLine);
      btn.appendChild(bottomLine);

      if (enabled) {
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(40, 80, 160, 0.5)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
        });
        btn.addEventListener('click', () => {
          if (this.researchCallback) {
            this.researchCallback(buildingEid, type);
          }
        });
      }

      this.researchButtonsRow.appendChild(btn);
      this.researchButtons.push(btn);
    }

    this.researchButtonsRow.style.display = 'flex';
  }
}
