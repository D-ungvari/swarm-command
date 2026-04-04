import { Faction, BuildState, BuildingType, ResourceType, UnitType, UpgradeType, AddonType, STIM_DURATION, activePlayerFaction } from '../constants';
import { CommandType } from '../input/CommandQueue';
import { hasCompletedBuilding } from '../ecs/queries';
import {
  BUILDING, RESOURCE, UNIT_TYPE,
  buildingType, buildState, prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  resourceRemaining, resourceType, unitType,
  selected, hpCurrent, hpMax, faction, renderTint, killCount, veterancyLevel,
  POSITION, SELECTABLE, RENDERABLE, HEALTH,
  energy, cloaked, stimEndTime,
  larvaCount, addonType,
  workerTargetEid,
} from '../ecs/components';
import { type World, hasComponents } from '../ecs/world';
import { BUILDING_DEFS } from '../data/buildings';
import { UNIT_DEFS } from '../data/units';
import { encodeResearch, getUpgradeCost, UPGRADE_RESEARCH_OFFSET } from '../systems/UpgradeSystem';
import { getActiveSubgroupIndex } from '../systems/SelectionSystem';
import { PortraitRenderer } from './PortraitRenderer';
import type { PlayerResources } from '../types';

/** Callback type for production button clicks */
export type ProductionCallback = (buildingEid: number, unitType: number) => void;

/** Callback type for research button clicks */
export type ResearchCallback = (buildingEid: number, upgradeType: number) => void;

/** Callback type for addon build button clicks */
export type AddonCallback = (buildingEid: number, addonTypeVal: number) => void;

/** Callback type for ability button clicks */
export type AbilityCallback = (commandType: number, unitEids: number[]) => void;

/** Active abilities per unit type (units without abilities are omitted) */
const UNIT_ABILITIES: Record<number, Array<{ name: string; key: string; commandType: number }>> = {
  [UnitType.Marine]: [{ name: 'Stim Pack', key: 'T', commandType: CommandType.Stim }],
  [UnitType.SiegeTank]: [{ name: 'Siege Mode', key: 'E', commandType: CommandType.SiegeToggle }],
  [UnitType.Ghost]: [
    { name: 'Cloak', key: 'C', commandType: CommandType.Cloak },
    { name: 'Snipe', key: 'D', commandType: CommandType.Snipe },
  ],
  [UnitType.Viking]: [{ name: 'Transform', key: 'E', commandType: CommandType.SiegeToggle }],
  [UnitType.Battlecruiser]: [{ name: 'Yamato', key: 'Y', commandType: CommandType.Yamato }],
  [UnitType.Queen]: [
    { name: 'Inject Larva', key: 'V', commandType: CommandType.InjectLarva },
    { name: 'Transfuse', key: 'X', commandType: CommandType.Transfuse },
  ],
  [UnitType.Ravager]: [{ name: 'Bile', key: 'R', commandType: CommandType.CorrosiveBile }],
  [UnitType.Infestor]: [{ name: 'Fungal', key: 'F', commandType: CommandType.FungalGrowth }],
  [UnitType.Viper]: [{ name: 'Abduct', key: 'G', commandType: CommandType.Abduct }],
};

/** Labels for the 3 Engineering Bay upgrades */
const ENGBAY_UPGRADES: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.InfantryWeapons, label: 'Inf Weapons' },
  { type: UpgradeType.InfantryArmor,   label: 'Inf Armor'   },
  { type: UpgradeType.VehicleWeapons,  label: 'Veh Weapons' },
];

/** Units that require a tech building before they can be trained. */
const UNIT_TECH_REQUIREMENTS: Partial<Record<number, number>> = {
  [UnitType.Zergling]:  BuildingType.SpawningPool,
  [UnitType.Queen]:     BuildingType.SpawningPool,
  [UnitType.Baneling]:  BuildingType.SpawningPool,     // SC2: morphs from Zergling, simplified here
  [UnitType.Roach]:     BuildingType.RoachWarren,
  [UnitType.Ravager]:   BuildingType.RoachWarren,       // SC2: morphs from Roach, simplified here
  [UnitType.Hydralisk]: BuildingType.HydraliskDen,
  [UnitType.Lurker]:    BuildingType.HydraliskDen,      // SC2: morphs from Hydralisk, simplified here
  [UnitType.Mutalisk]:  BuildingType.Spire,
  [UnitType.Corruptor]: BuildingType.Spire,
  [UnitType.Infestor]:  BuildingType.InfestationPit,
  [UnitType.Viper]:     BuildingType.InfestationPit,
  [UnitType.Ultralisk]: BuildingType.InfestationPit,    // SC2: requires Hive (simplified to InfPit)
};

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
  private statsEl: HTMLDivElement;
  private prodRow: HTMLDivElement;
  private prodBarFill: HTMLDivElement;
  private prodLabel: HTMLDivElement;
  private prodButtonsRow: HTMLDivElement;
  private prodButtons: HTMLDivElement[] = [];
  private queueRow: HTMLDivElement;
  private researchButtonsRow: HTMLDivElement;
  private researchButtons: HTMLDivElement[] = [];
  private addonButtonsRow: HTMLDivElement;
  private abilityButtonsRow: HTMLDivElement;
  private portraitContainer: HTMLDivElement;
  private portraitRenderer = new PortraitRenderer();
  private wasVisible = false;
  private productionCallback: ProductionCallback | null = null;
  private researchCallback: ResearchCallback | null = null;
  private addonCallback: AddonCallback | null = null;
  private abilityCallback: AbilityCallback | null = null;
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

    // Portrait container (flex row for portrait thumbnails)
    this.portraitContainer = document.createElement('div');
    this.portraitContainer.style.cssText = 'display: flex; gap: 4px; align-items: center; flex-wrap: wrap;';
    this.panel.appendChild(this.portraitContainer);

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

    // Combat stats row (shown for single unit selection)
    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = `
      display: none;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 11px;
      margin-top: 4px;
      line-height: 1.5;
    `;
    this.panel.appendChild(this.statsEl);

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
    this.prodButtonsRow.style.cssText = 'display: none; flex-direction: row; flex-wrap: wrap; gap: 3px; margin-top: 4px; pointer-events: auto; max-width: 228px;';
    this.panel.appendChild(this.prodButtonsRow);

    // Production queue display row
    this.queueRow = document.createElement('div');
    this.queueRow.style.cssText = 'display: none; flex-direction: row; gap: 3px; margin-top: 4px; align-items: center;';
    this.panel.appendChild(this.queueRow);

    // Research buttons row (Engineering Bay / Evolution Chamber)
    this.researchButtonsRow = document.createElement('div');
    this.researchButtonsRow.style.cssText = 'display: none; flex-direction: row; gap: 4px; margin-top: 4px; pointer-events: auto; flex-wrap: wrap;';
    this.panel.appendChild(this.researchButtonsRow);

    // Addon buttons row (Tech Lab / Reactor for Barracks/Factory/Starport)
    this.addonButtonsRow = document.createElement('div');
    this.addonButtonsRow.style.cssText = 'display: none; flex-direction: row; gap: 4px; margin-top: 4px; pointer-events: auto; flex-wrap: wrap;';
    this.panel.appendChild(this.addonButtonsRow);

    // Ability buttons row (subgroup abilities for selected units)
    this.abilityButtonsRow = document.createElement('div');
    this.abilityButtonsRow.style.cssText = 'display: none; flex-direction: row; gap: 4px; margin-top: 4px; pointer-events: auto;';
    this.panel.appendChild(this.abilityButtonsRow);

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

  /** Wire up a callback for addon build button clicks */
  setAddonCallback(fn: AddonCallback): void {
    this.addonCallback = fn;
  }

  /** Wire up a callback for ability button clicks */
  setAbilityCallback(fn: AbilityCallback): void {
    this.abilityCallback = fn;
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
      this.addonButtonsRow.style.display = 'none';
      this.abilityButtonsRow.style.display = 'none';
      this.statsEl.style.display = 'none';
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

      // Portrait row for multi-select: one portrait per type with count badge
      this.portraitContainer.innerHTML = '';
      const MAX_PORTRAITS = 8;
      const typeEntries = Object.keys(typeCounts);
      const showCount = Math.min(typeEntries.length, MAX_PORTRAITS);
      for (let i = 0; i < showCount; i++) {
        const uType = Number(typeEntries[i]);
        const count = typeCounts[uType];
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; width: 44px; height: 44px;';
        const portrait = this.portraitRenderer.getPortrait(uType).cloneNode(true) as HTMLCanvasElement;
        portrait.style.cssText = 'display: block;';
        wrapper.appendChild(portrait);
        // Count badge
        if (count > 1) {
          const badge = document.createElement('div');
          badge.style.cssText = `
            position: absolute; bottom: 1px; right: 1px;
            background: rgba(0,0,0,0.8); color: #fff;
            font-size: 9px; padding: 0 3px; border-radius: 2px;
            line-height: 14px; font-family: 'Consolas', monospace;
          `;
          badge.textContent = `${count}`;
          wrapper.appendChild(badge);
        }
        this.portraitContainer.appendChild(wrapper);
      }
      if (typeEntries.length > MAX_PORTRAITS) {
        const overflow = document.createElement('div');
        overflow.style.cssText = 'color: #aaa; font-size: 11px; align-self: center;';
        overflow.textContent = `+${typeEntries.length - MAX_PORTRAITS}`;
        this.portraitContainer.appendChild(overflow);
      }

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
      // Subgroup breadcrumb: show tab-cycling indicator when multiple types
      const typeKeys = Object.keys(typeCounts).map(Number);
      if (typeKeys.length > 1) {
        const activeIdx = getActiveSubgroupIndex();
        const breadcrumb = typeKeys.map((ut, idx) => {
          const name = UNIT_DEFS[ut]?.name ?? 'Unit';
          const count = typeCounts[ut];
          const isActive = idx === (activeIdx % typeKeys.length);
          return `<span style="color:${isActive ? '#cce0ff' : '#557799'};${isActive ? 'font-weight:bold;' : ''}">${name} \u00d7${count}</span>`;
        }).join(' <span style="color:#334">|</span> ');
        this.detailEl.innerHTML = breadcrumb;
      } else {
        this.detailEl.innerHTML = detailHtml;
      }

      // Show total HP bar
      this.barContainer.style.display = 'block';
      const ratio = totalMaxHp > 0 ? Math.max(0, totalHp / totalMaxHp) : 0;
      this.barFill.style.width = `${ratio * 100}%`;
      this.barFill.style.background = ratio > 0.5 ? '#44ff44' : ratio > 0.25 ? '#ffaa00' : '#ff3333';
      this.barLabel.textContent = `${Math.floor(totalHp)}/${Math.floor(totalMaxHp)}`;

      this.prodRow.style.display = 'none';
      this.prodButtonsRow.style.display = 'none';
      this.researchButtonsRow.style.display = 'none';
      this.addonButtonsRow.style.display = 'none';
      this.statsEl.style.display = 'none';
      this.queueRow.style.display = 'none';

      // Subgroup ability panel: show when exactly one unit type is in selection
      // (either Tab cycling isolated a type, or only one type was selected)
      const selectedTypes = Object.keys(typeCounts).map(Number);
      if (selectedTypes.length === 1) {
        const activeType = selectedTypes[0];
        const abilities = UNIT_ABILITIES[activeType];
        if (abilities && abilities.length > 0) {
          this.abilityButtonsRow.innerHTML = '';
          this.abilityButtonsRow.style.display = 'flex';

          // Collect all selected unit eids of this type
          const unitEids: number[] = [];
          for (let e = 1; e < world.nextEid; e++) {
            if (selected[e] === 1 && hasComponents(world, e, UNIT_TYPE) && unitType[e] === activeType) {
              unitEids.push(e);
            }
          }

          for (const ability of abilities) {
            const btn = document.createElement('button');
            btn.textContent = `[${ability.key}] ${ability.name}`;
            btn.style.cssText = `
              background: rgba(40,80,140,0.6); color: #cce0ff; border: 1px solid rgba(100,160,255,0.4);
              padding: 4px 10px; font-family: 'Consolas', monospace; font-size: 11px; cursor: pointer;
              border-radius: 3px;
            `;
            btn.addEventListener('click', () => {
              if (this.abilityCallback) this.abilityCallback(ability.commandType, [...unitEids]);
            });
            this.abilityButtonsRow.appendChild(btn);
          }
        } else {
          this.abilityButtonsRow.style.display = 'none';
        }
      } else {
        this.abilityButtonsRow.style.display = 'none';
      }

      // Border stays blue (player's faction)
      this.panel.style.borderColor = 'rgba(100, 160, 255, 0.3)';
      return;
    }

    this.barContainer.style.display = 'block';

    const eid = sel;

    // Resource entity
    if (hasComponents(world, eid, RESOURCE)) {
      this.portraitContainer.innerHTML = '';
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
      this.addonButtonsRow.style.display = 'none';
      this.abilityButtonsRow.style.display = 'none';
      this.statsEl.style.display = 'none';
      this.queueRow.style.display = 'none';
      // Cyan border for resources
      this.panel.style.borderColor = 'rgba(80, 200, 255, 0.3)';
      return;
    }

    // Building entity
    if (hasComponents(world, eid, BUILDING)) {
      this.abilityButtonsRow.style.display = 'none';
      this.statsEl.style.display = 'none';
      this.portraitContainer.innerHTML = '';
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
        this.addonButtonsRow.style.display = 'none';

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
          this.addonButtonsRow.style.display = 'none';
        } else {
          this.prodRow.style.display = 'none';
          this.queueRow.style.display = 'none';

          // Addon-capable buildings: Barracks, Factory, Starport
          const isAddonBuilding = bt === BuildingType.Barracks
            || bt === BuildingType.Factory
            || bt === BuildingType.Starport;

          // Show available production hotkeys/buttons for completed buildings
          if (bs === BuildState.Complete && def && def.produces.length > 0) {
            this.detailEl.textContent = `${facName} | ${def.produces.length} trainable`;

            // Show clickable production buttons
            this.updateProductionButtons(eid, def.produces, playerResources, world, fac);

            // Show addon buttons if no addon yet (and building is addon-capable)
            if (isAddonBuilding) {
              this.updateAddonButtons(eid);
            } else {
              this.addonButtonsRow.style.display = 'none';
            }
          } else {
            this.detailEl.textContent = bs === BuildState.UnderConstruction
              ? `${facName} | Under Construction`
              : facName;
            this.prodButtonsRow.style.display = 'none';
            this.addonButtonsRow.style.display = 'none';
          }
        }
      }
      // Hatchery: show larva count
      if (bt === BuildingType.Hatchery) {
        const larva = larvaCount[eid];
        const larvaText = larva > 0 ? `  Larva: ${larva}/3` : '  Larva: 0/3 (regenerating)';
        this.detailEl.textContent += larvaText;
      }

      // Refinery: show gas worker count
      if (bt === BuildingType.Refinery && bs === BuildState.Complete) {
        let gasWorkers = 0;
        for (let w = 1; w < world.nextEid; w++) {
          if (workerTargetEid[w] === eid && hpCurrent[w] > 0) gasWorkers++;
        }
        this.detailEl.textContent += `  Gas Workers: ${gasWorkers}/3`;
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

      // Single-unit portrait
      this.portraitContainer.innerHTML = '';
      const portrait = this.portraitRenderer.getPortrait(ut).cloneNode(true) as HTMLCanvasElement;
      portrait.style.cssText = 'display: block;';
      this.portraitContainer.appendChild(portrait);

      this.nameEl.textContent = name;

      const fac = faction[eid] as Faction;
      const facName = fac === Faction.Terran ? 'Terran' : fac === Faction.Zerg ? 'Zerg' : '';
      const kills = killCount[eid];
      const vet = veterancyLevel[eid];
      let detailText = kills > 0 ? `${facName}  Kills: ${kills}` : facName;
      if (vet > 0) {
        const vetNames = ['', 'Veteran', 'Elite', 'Hero'];
        detailText += `  ${vetNames[vet]} ${'\u2605'.repeat(vet)}`;
      }
      this.detailEl.textContent = detailText;

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
      if (playerResources?.upgrades && fac === activePlayerFaction) {
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

      // Combat stats row
      if (def) {
        const atkSpd = def.attackCooldown > 0 ? (1000 / def.attackCooldown).toFixed(2) : '0';
        this.statsEl.innerHTML =
          `<span style="color:#88bbff">DMG:</span> <span style="color:#cce0ff">${def.damage}</span>` +
          `&nbsp;&nbsp;<span style="color:#88bbff">ARM:</span> <span style="color:#cce0ff">${def.baseArmor}</span>` +
          `&nbsp;&nbsp;<span style="color:#88bbff">SPD:</span> <span style="color:#cce0ff">${atkSpd}/s</span>` +
          `<br>` +
          `<span style="color:#88bbff">RNG:</span> <span style="color:#cce0ff">${def.range}</span>` +
          `&nbsp;&nbsp;<span style="color:#88bbff">MOV:</span> <span style="color:#cce0ff">${def.speed}</span>`;
        this.statsEl.style.display = 'block';
      } else {
        this.statsEl.style.display = 'none';
      }

      this.prodRow.style.display = 'none';
      this.prodButtonsRow.style.display = 'none';
      this.researchButtonsRow.style.display = 'none';
      this.addonButtonsRow.style.display = 'none';
      this.abilityButtonsRow.style.display = 'none';
      this.queueRow.style.display = 'none';
      // Faction-colored border for units
      this.panel.style.borderColor = fac === Faction.Zerg
        ? 'rgba(255, 80, 80, 0.3)'
        : 'rgba(100, 160, 255, 0.3)';
      return;
    }

    // Fallback — generic entity
    this.portraitContainer.innerHTML = '';
    this.nameEl.textContent = 'Entity';
    this.detailEl.textContent = '';
    this.prodRow.style.display = 'none';
    this.prodButtonsRow.style.display = 'none';
    this.researchButtonsRow.style.display = 'none';
    this.addonButtonsRow.style.display = 'none';
    this.abilityButtonsRow.style.display = 'none';
    this.statsEl.style.display = 'none';
    this.queueRow.style.display = 'none';
    this.panel.style.borderColor = 'rgba(100, 160, 255, 0.3)';
  }

  private updateProductionButtons(
    buildingEid: number,
    produces: readonly number[],
    playerResources?: PlayerResources,
    world?: World,
    fac?: Faction,
  ): void {
    const hotkeys = ['Q','W','E','R','T','A','S','D','F','G','Z','X','C','V'];
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
        if (!uDef) continue;

        const btn = document.createElement('div');
        btn.style.cssText = `
          width: 42px;
          height: 42px;
          border: 1px solid rgba(100, 160, 255, 0.4);
          border-radius: 3px;
          cursor: pointer;
          pointer-events: auto;
          transition: background 0.1s;
          background: rgba(10, 18, 30, 0.8);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-sizing: border-box;
        `;

        const hotkey = i < hotkeys.length ? hotkeys[i] : '';

        // Hotkey label (top-left)
        const hotkeyEl = document.createElement('div');
        hotkeyEl.style.cssText = 'position: absolute; top: 1px; left: 3px; font-size: 9px; color: rgba(180,200,255,0.5); font-family: Consolas, monospace;';
        hotkeyEl.textContent = hotkey;
        btn.appendChild(hotkeyEl);

        // Unit name (centered)
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-size: 9px; color: #cce0ff; font-family: Consolas, monospace; text-align: center; line-height: 1.1; margin-top: 2px; padding: 0 1px;';
        nameEl.textContent = uDef.name;
        btn.appendChild(nameEl);

        // Cost line (below name)
        const costEl = document.createElement('div');
        const mineralColor = '#66ccff';
        const gasColor = '#66ff88';
        costEl.style.cssText = 'font-size: 8px; font-family: Consolas, monospace; text-align: center; line-height: 1;';
        if (uDef.costGas > 0) {
          costEl.innerHTML = `<span style="color:${mineralColor}">${uDef.costMinerals}</span><span style="color:#555">/</span><span style="color:${gasColor}">${uDef.costGas}</span>`;
        } else {
          costEl.innerHTML = `<span style="color:${mineralColor}">${uDef.costMinerals}</span>`;
        }
        btn.appendChild(costEl);

        btn.addEventListener('mouseenter', () => {
          if (!btn.classList.contains('prod-disabled')) {
            btn.style.background = 'rgba(40, 80, 160, 0.5)';
          }
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = btn.classList.contains('prod-disabled')
            ? 'rgba(10, 14, 20, 0.9)'
            : 'rgba(10, 18, 30, 0.8)';
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

    // Update button affordability + tech gate styling
    for (let i = 0; i < this.prodButtons.length && i < produces.length; i++) {
      const uType = produces[i];
      const uDef = UNIT_DEFS[uType];
      if (!uDef) continue;

      // Check unit tech requirement
      const requiredBuilding = UNIT_TECH_REQUIREMENTS[uType];
      const techMet = requiredBuilding === undefined
        || !world
        || !fac
        || hasCompletedBuilding(world, fac, requiredBuilding as BuildingType);

      const canAfford = playerResources
        ? playerResources.minerals >= uDef.costMinerals && playerResources.gas >= uDef.costGas
        : false;
      const supplyCapped = playerResources
        ? playerResources.supplyUsed >= playerResources.supplyProvided
        : false;
      const enabled = canAfford && !supplyCapped && techMet;
      const btn = this.prodButtons[i];
      const hotkey = i < hotkeys.length ? hotkeys[i] : '';

      if (enabled) {
        btn.classList.remove('prod-disabled');
        btn.style.borderColor = 'rgba(100, 160, 255, 0.4)';
        btn.style.cursor = 'pointer';
        btn.style.background = 'rgba(10, 18, 30, 0.8)';
        btn.style.opacity = '1';
      } else {
        btn.classList.add('prod-disabled');
        btn.style.borderColor = 'rgba(60, 60, 60, 0.3)';
        btn.style.cursor = 'default';
        btn.style.background = 'rgba(10, 14, 20, 0.9)';
        btn.style.opacity = '0.5';
      }

      // Rebuild inner content to show tech requirement indicator
      if (!techMet && requiredBuilding !== undefined) {
        const reqDef = BUILDING_DEFS[requiredBuilding];
        const reqName = reqDef ? reqDef.name : 'Required';
        btn.innerHTML = '';
        // Hotkey
        const hk = document.createElement('div');
        hk.style.cssText = 'position: absolute; top: 1px; left: 3px; font-size: 9px; color: rgba(180,200,255,0.3); font-family: Consolas, monospace;';
        hk.textContent = hotkey;
        btn.appendChild(hk);
        // Name
        const nm = document.createElement('div');
        nm.style.cssText = 'font-size: 9px; color: #777; font-family: Consolas, monospace; text-align: center; line-height: 1.1; margin-top: 2px; padding: 0 1px;';
        nm.textContent = uDef.name;
        btn.appendChild(nm);
        // REQ indicator
        const req = document.createElement('div');
        req.style.cssText = 'font-size: 7px; color: #aa4444; font-family: Consolas, monospace; text-align: center; line-height: 1;';
        req.textContent = `REQ`;
        req.title = `Requires: ${reqName}`;
        btn.appendChild(req);
      } else {
        // Rebuild with normal content (cost line)
        btn.innerHTML = '';
        const hk = document.createElement('div');
        hk.style.cssText = `position: absolute; top: 1px; left: 3px; font-size: 9px; color: rgba(180,200,255,${enabled ? '0.5' : '0.3'}); font-family: Consolas, monospace;`;
        hk.textContent = hotkey;
        btn.appendChild(hk);
        const nm = document.createElement('div');
        nm.style.cssText = `font-size: 9px; color: ${enabled ? '#cce0ff' : '#777'}; font-family: Consolas, monospace; text-align: center; line-height: 1.1; margin-top: 2px; padding: 0 1px;`;
        nm.textContent = uDef.name;
        btn.appendChild(nm);
        const costEl = document.createElement('div');
        const mineralColor = enabled ? '#66ccff' : '#446';
        const gasColor = enabled ? '#66ff88' : '#464';
        costEl.style.cssText = 'font-size: 8px; font-family: Consolas, monospace; text-align: center; line-height: 1;';
        if (uDef.costGas > 0) {
          costEl.innerHTML = `<span style="color:${mineralColor}">${uDef.costMinerals}</span><span style="color:#555">/</span><span style="color:${gasColor}">${uDef.costGas}</span>`;
        } else {
          costEl.innerHTML = `<span style="color:${mineralColor}">${uDef.costMinerals}</span>`;
        }
        btn.appendChild(costEl);
      }
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

  /** Render addon buttons (Tech Lab / Reactor) for Barracks/Factory/Starport. */
  private updateAddonButtons(buildingEid: number): void {
    const addon = addonType[buildingEid];
    if (addon !== AddonType.None) {
      // Already has an addon — show status label only, no build buttons
      this.addonButtonsRow.innerHTML = '';
      const label = document.createElement('div');
      label.style.cssText = 'font-size: 11px; color: #88ffcc;';
      label.textContent = addon === AddonType.TechLab ? 'Addon: Tech Lab' : 'Addon: Reactor (2x speed)';
      this.addonButtonsRow.appendChild(label);
      this.addonButtonsRow.style.display = 'flex';
      return;
    }

    // No addon — show build buttons
    this.addonButtonsRow.innerHTML = '';

    const addons: { label: string; typeVal: AddonType }[] = [
      { label: 'Tech Lab (50m/25g)', typeVal: AddonType.TechLab },
      { label: 'Reactor (50m/25g)', typeVal: AddonType.Reactor },
    ];

    for (const { label, typeVal } of addons) {
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
        color: #eee;
      `;
      btn.textContent = label;

      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(40, 80, 160, 0.5)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
      });
      btn.addEventListener('click', () => {
        if (this.addonCallback) {
          this.addonCallback(buildingEid, typeVal);
        }
      });

      this.addonButtonsRow.appendChild(btn);
    }

    this.addonButtonsRow.style.display = 'flex';
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
