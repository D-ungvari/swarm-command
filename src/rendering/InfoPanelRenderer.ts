import { Faction, BuildState, BuildingType, ResourceType, UnitType, UpgradeType, AddonType, TECHLAB_UNITS, STIM_DURATION, activePlayerFaction, isHatchType } from '../constants';
import { CommandType } from '../input/CommandQueue';
import { hasCompletedBuilding } from '../ecs/queries';
import {
  BUILDING, RESOURCE, UNIT_TYPE,
  buildingType, buildState, prodUnitType, prodProgress, prodTimeTotal,
  prodSlot2UnitType, prodSlot2Progress, prodSlot2TimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  resourceRemaining, resourceType, unitType,
  selected, hpCurrent, hpMax, faction, renderTint, killCount, veterancyLevel,
  POSITION, SELECTABLE, RENDERABLE, HEALTH,
  energy, cloaked, stimEndTime,
  larvaCount, addonType,
  upgradingTo, upgradeProgress, upgradeTimeTotal,
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
    { name: 'EMP Round', key: 'E', commandType: CommandType.EMP },
  ],
  [UnitType.Reaper]: [{ name: 'KD8 Charge', key: 'D', commandType: CommandType.KD8Charge }],
  [UnitType.Viking]: [{ name: 'Transform', key: 'E', commandType: CommandType.SiegeToggle }],
  [UnitType.Hellion]: [{ name: 'Hellbat Mode', key: 'E', commandType: CommandType.SiegeToggle }],
  [UnitType.Cyclone]: [{ name: 'Lock-On', key: 'Q', commandType: CommandType.LockOn }],
  [UnitType.Thor]: [{ name: 'AA Mode', key: 'E', commandType: CommandType.SiegeToggle }],
  [UnitType.Battlecruiser]: [{ name: 'Yamato', key: 'Y', commandType: CommandType.Yamato }],
  [UnitType.Queen]: [
    { name: 'Inject Larva', key: 'V', commandType: CommandType.InjectLarva },
    { name: 'Transfuse', key: 'X', commandType: CommandType.Transfuse },
  ],
  [UnitType.Baneling]: [{ name: 'Burrow', key: 'R', commandType: CommandType.BanelingBurrow }],
  [UnitType.Roach]: [{ name: 'Burrow', key: 'R', commandType: CommandType.RoachBurrow }],
  [UnitType.Ravager]: [{ name: 'Bile', key: 'R', commandType: CommandType.CorrosiveBile }],
  [UnitType.Infestor]: [
    { name: 'Fungal', key: 'F', commandType: CommandType.FungalGrowth },
    { name: 'Neural', key: 'N', commandType: CommandType.NeuralParasite },
  ],
  [UnitType.Corruptor]: [{ name: 'Caustic Spray', key: 'C', commandType: CommandType.CausticSpray }],
  [UnitType.Viper]: [
    { name: 'Abduct', key: 'G', commandType: CommandType.Abduct },
    { name: 'Blinding Cloud', key: 'B', commandType: CommandType.BlindingCloud },
    { name: 'Parasitic Bomb', key: 'P', commandType: CommandType.ParasiticBomb },
  ],
};

/** Labels for Engineering Bay upgrades */
const ENGBAY_UPGRADES: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.InfantryWeapons, label: 'Inf Weapons' },
  { type: UpgradeType.InfantryArmor,   label: 'Inf Armor'   },
];

const EVOCHAMBER_UPGRADES: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.ZergMelee,    label: 'Melee Atk'    },
  { type: UpgradeType.ZergRanged,   label: 'Ranged Atk'   },
  { type: UpgradeType.ZergCarapace, label: 'Carapace'     },
];

const ARMORY_UPGRADES: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.VehicleWeapons, label: 'Veh Weapons' },
  { type: UpgradeType.VehicleArmor,   label: 'Veh Armor'   },
];

const BARRACKS_RESEARCH: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.StimPack,         label: 'Stim Pack'   },
  { type: UpgradeType.CombatShield,     label: 'Combat Shld' },
  { type: UpgradeType.ConcussiveShells, label: 'Conc Shells' },
];

const FACTORY_RESEARCH: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.SiegeTech, label: 'Siege Tech' },
];

const SPAWNING_POOL_RESEARCH: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.MetabolicBoost, label: 'Meta Boost'  },
  { type: UpgradeType.AdrenalGlands,  label: 'Adrl Glands' },
];

const HYDRALISK_DEN_RESEARCH: { type: UpgradeType; label: string }[] = [
  { type: UpgradeType.GroovedSpines,    label: 'Grooved Spn' },
  { type: UpgradeType.MuscularAugments, label: 'Musc Augmnt' },
];

/** Units that require a tech building before they can be trained. */
const UNIT_TECH_REQUIREMENTS: Partial<Record<number, number>> = {
  [UnitType.Ghost]:     BuildingType.GhostAcademy,
  [UnitType.Thor]:      BuildingType.Armory,
  [UnitType.Battlecruiser]: BuildingType.FusionCore,
  [UnitType.Zergling]:  BuildingType.SpawningPool,
  [UnitType.Queen]:     BuildingType.SpawningPool,
  [UnitType.Baneling]:  BuildingType.BanelingNest,
  [UnitType.Roach]:     BuildingType.RoachWarren,
  [UnitType.Ravager]:   BuildingType.RoachWarren,       // SC2: morphs from Roach, simplified here
  [UnitType.Hydralisk]: BuildingType.HydraliskDen,
  [UnitType.Lurker]:    BuildingType.LurkerDen,
  [UnitType.Mutalisk]:  BuildingType.Spire,
  [UnitType.Corruptor]: BuildingType.Spire,
  [UnitType.Infestor]:  BuildingType.InfestationPit,
  [UnitType.Viper]:     BuildingType.InfestationPit,
  [UnitType.Ultralisk]: BuildingType.UltraliskCavern,
};

const UPGRADE_NAMES: Record<number, string> = {
  [UpgradeType.InfantryWeapons]: 'Inf Weapons',
  [UpgradeType.InfantryArmor]:   'Inf Armor',
  [UpgradeType.VehicleWeapons]:  'Veh Weapons',
  [UpgradeType.ZergMelee]:       'Zerg Melee',
  [UpgradeType.ZergRanged]:      'Zerg Ranged',
  [UpgradeType.ZergCarapace]:    'Zerg Carapace',
  [UpgradeType.VehicleArmor]:    'Veh Armor',
  [UpgradeType.StimPack]:         'Stim Pack',
  [UpgradeType.CombatShield]:     'Combat Shield',
  [UpgradeType.ConcussiveShells]: 'Conc Shells',
  [UpgradeType.SiegeTech]:        'Siege Tech',
  [UpgradeType.MetabolicBoost]:   'Meta Boost',
  [UpgradeType.AdrenalGlands]:    'Adrl Glands',
  [UpgradeType.GroovedSpines]:    'Grooved Spines',
  [UpgradeType.MuscularAugments]: 'Musc Augments',
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
  private prodSlot2Row: HTMLDivElement;
  private prodSlot2BarFill: HTMLDivElement;
  private prodSlot2Label: HTMLDivElement;
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
  private upgradeCallback: ((buildingEid: number, targetType: number) => void) | null = null;
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

    // Reactor Slot 2 production row
    this.prodSlot2Row = document.createElement('div');
    this.prodSlot2Row.style.cssText = 'display: none; flex-direction: column; gap: 2px; margin-top: 2px;';

    this.prodSlot2Label = document.createElement('div');
    this.prodSlot2Label.style.cssText = 'font-size: 11px; color: #ffaa44;';
    this.prodSlot2Row.appendChild(this.prodSlot2Label);

    const prodSlot2BarContainer = document.createElement('div');
    prodSlot2BarContainer.style.cssText = `
      width: 100%; height: 6px; background: rgba(40, 30, 10, 0.6);
      border: 1px solid rgba(255, 160, 44, 0.3); border-radius: 2px; overflow: hidden;
    `;
    this.prodSlot2BarFill = document.createElement('div');
    this.prodSlot2BarFill.style.cssText = 'height: 100%; background: #ff8822; transition: width 0.1s;';
    prodSlot2BarContainer.appendChild(this.prodSlot2BarFill);
    this.prodSlot2Row.appendChild(prodSlot2BarContainer);

    this.panel.appendChild(this.prodSlot2Row);

    // Production buttons row (clickable buttons for available units)
    this.prodButtonsRow = document.createElement('div');
    this.prodButtonsRow.style.cssText = 'display: none; flex-direction: row; flex-wrap: wrap; gap: 3px; margin-top: 4px; pointer-events: auto; max-width: 340px;';
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

  setUpgradeCallback(fn: (buildingEid: number, targetType: number) => void): void {
    this.upgradeCallback = fn;
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
      this.prodSlot2Row.style.display = 'none';
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

          // Ability icon symbols for visual distinctness
          const ABILITY_ICONS: Record<string, { symbol: string; color: string }> = {
            'Stim Pack': { symbol: '\u2B06', color: '#ff4444' },
            'Siege Mode': { symbol: '\u2693', color: '#ffaa22' },
            'Cloak': { symbol: '\u{1F441}', color: '#88ddff' },
            'Snipe': { symbol: '\u2316', color: '#ff6644' },
            'EMP Round': { symbol: '\u26A1', color: '#44ccff' },
            'Transform': { symbol: '\u21C4', color: '#6699ff' },
            'Hellbat Mode': { symbol: '\u21C4', color: '#ff6600' },
            'AA Mode': { symbol: '\u21C4', color: '#ffcc22' },
            'Lock-On': { symbol: '\u25CE', color: '#ff2222' },
            'Yamato': { symbol: '\u2604', color: '#ff4488' },
            'KD8 Charge': { symbol: '\u25C9', color: '#ff6622' },
            'Inject Larva': { symbol: '\u2B50', color: '#88ff44' },
            'Transfuse': { symbol: '\u2764', color: '#44ff88' },
            'Bile': { symbol: '\u25CF', color: '#88cc22' },
            'Fungal': { symbol: '\u25A0', color: '#44cc44' },
            'Neural': { symbol: '\u2B55', color: '#cc44ff' },
            'Abduct': { symbol: '\u21A9', color: '#cc88ff' },
            'Blinding Cloud': { symbol: '\u2601', color: '#8844cc' },
            'Parasitic Bomb': { symbol: '\u2622', color: '#ff4488' },
            'Caustic Spray': { symbol: '\u2623', color: '#44cc88' },
            'Burrow': { symbol: '\u25BC', color: '#886644' },
          };

          for (const ability of abilities) {
            const iconInfo = ABILITY_ICONS[ability.name] || { symbol: '\u2726', color: '#aaccff' };
            const btn = document.createElement('div');
            btn.style.cssText = `
              display: flex; align-items: center; gap: 5px;
              padding: 4px 8px;
              background: rgba(20, 35, 70, 0.7);
              border: 1px solid rgba(100, 160, 255, 0.4);
              border-radius: 3px;
              cursor: pointer; pointer-events: auto;
              transition: background 0.1s, border-color 0.1s;
              user-select: none;
            `;

            // Hotkey badge
            const hotkeyEl = document.createElement('span');
            hotkeyEl.style.cssText = `
              font-size: 9px; font-family: Consolas, monospace;
              color: rgba(180,210,255,0.5);
              background: rgba(0,0,0,0.3);
              padding: 0 3px; border-radius: 2px;
              min-width: 12px; text-align: center;
            `;
            hotkeyEl.textContent = ability.key;
            btn.appendChild(hotkeyEl);

            // Icon
            const iconEl = document.createElement('span');
            iconEl.style.cssText = `font-size: 14px; color: ${iconInfo.color}; line-height: 1;`;
            iconEl.textContent = iconInfo.symbol;
            btn.appendChild(iconEl);

            // Name
            const nameEl = document.createElement('span');
            nameEl.style.cssText = 'font-size: 10px; font-family: Consolas, monospace; color: #cce0ff;';
            nameEl.textContent = ability.name;
            btn.appendChild(nameEl);

            btn.addEventListener('mouseenter', () => {
              btn.style.background = 'rgba(40, 80, 160, 0.6)';
              btn.style.borderColor = 'rgba(100, 180, 255, 0.7)';
            });
            btn.addEventListener('mouseleave', () => {
              btn.style.background = 'rgba(20, 35, 70, 0.7)';
              btn.style.borderColor = 'rgba(100, 160, 255, 0.4)';
            });
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
      this.prodSlot2Row.style.display = 'none';
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

      // Pure research buildings: Engineering Bay, Evolution Chamber, Armory
      if (bt === BuildingType.EngineeringBay || bt === BuildingType.Armory || bt === BuildingType.EvolutionChamber) {
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
      this.prodSlot2Row.style.display = 'none';
          if (bs === BuildState.Complete) {
            this.updateResearchButtons(eid, playerResources);
          } else {
            this.researchButtonsRow.style.display = 'none';
          }
        }
      // Standard production building
      } else {
        const pType = prodUnitType[eid];
        const isResearchInProgress = pType >= UPGRADE_RESEARCH_OFFSET && prodTimeTotal[eid] > 0;

        // Show research in-progress bar for hybrid buildings (Barracks w/ TechLab, SpawningPool, etc.)
        if (isResearchInProgress) {
          const upgradeType = pType - UPGRADE_RESEARCH_OFFSET;
          const upgradeName = UPGRADE_NAMES[upgradeType] ?? 'Research';
          const pct = prodTimeTotal[eid] > 0 ? Math.min(1, 1 - prodProgress[eid] / prodTimeTotal[eid]) : 0;
          this.prodLabel.textContent = `Researching: ${upgradeName}`;
          this.prodBarFill.style.width = `${pct * 100}%`;
          this.prodRow.style.display = 'flex';
          this.researchButtonsRow.style.display = 'none';
        } else if (pType > 0 && prodTimeTotal[eid] > 0) {
        // Show training progress bar if producing
          const unitDef = UNIT_DEFS[pType];
          const unitName = unitDef ? unitDef.name : 'Unit';
          const progress = prodProgress[eid];
          const total = prodTimeTotal[eid];
          const pct = total > 0 ? Math.min(1, 1 - progress / total) : 0;
          this.prodLabel.textContent = `Training: ${unitName}`;
          this.prodBarFill.style.width = `${pct * 100}%`;
          this.prodRow.style.display = 'flex';
          this.updateQueueDisplay(eid);
        } else {
          this.prodRow.style.display = 'none';
      this.prodSlot2Row.style.display = 'none';
          this.queueRow.style.display = 'none';
        }

        // Reactor slot 2 progress bar
        const s2Type = prodSlot2UnitType[eid];
        if (s2Type > 0 && prodSlot2TimeTotal[eid] > 0) {
          const s2Def = UNIT_DEFS[s2Type];
          const s2Name = s2Def ? s2Def.name : 'Unit';
          const s2pct = prodSlot2TimeTotal[eid] > 0
            ? Math.min(1, 1 - prodSlot2Progress[eid] / prodSlot2TimeTotal[eid]) : 0;
          this.prodSlot2Label.textContent = `Slot 2: ${s2Name}`;
          this.prodSlot2BarFill.style.width = `${s2pct * 100}%`;
          this.prodSlot2Row.style.display = 'flex';
        } else {
          this.prodSlot2Row.style.display = 'none';
        }

        // Addon-capable buildings: Barracks, Factory, Starport
        const isAddonBuilding = bt === BuildingType.Barracks
          || bt === BuildingType.Factory
          || bt === BuildingType.Starport;

        // Always show production buttons for completed buildings (can queue while training)
        if (bs === BuildState.Complete && def && def.produces.length > 0) {
          this.detailEl.textContent = facName;
          this.updateProductionButtons(eid, def.produces, playerResources, world, fac);

          if (isAddonBuilding) {
            this.updateAddonButtons(eid);
          } else if (isHatchType(bt)) {
            this.updateUpgradeButton(eid, bt, world, fac);
          } else {
            this.addonButtonsRow.style.display = 'none';
          }

          // Show unit-specific research buttons for hybrid buildings
          const hasResearch = bt === BuildingType.SpawningPool || bt === BuildingType.HydraliskDen
            || ((bt === BuildingType.Barracks || bt === BuildingType.Factory) && addonType[eid] === AddonType.TechLab);
          if (hasResearch && !isResearchInProgress) {
            this.updateResearchButtons(eid, playerResources);
          } else if (!hasResearch) {
            this.researchButtonsRow.style.display = 'none';
          }
        } else {
          this.detailEl.textContent = bs === BuildState.UnderConstruction
            ? `${facName} | Under Construction`
            : facName;
          this.prodButtonsRow.style.display = 'none';
          this.addonButtonsRow.style.display = 'none';
        }
      }
      // Hatchery/Lair/Hive: show larva count
      if (isHatchType(bt)) {
        const larva = larvaCount[eid];
        const larvaText = larva > 0 ? `  Larva: ${larva}/3` : '  Larva: 0/3 (regenerating)';
        this.detailEl.textContent += larvaText;
      }

      // Gas building: show gas worker count
      if ((bt === BuildingType.Refinery || bt === BuildingType.Extractor) && bs === BuildState.Complete) {
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
      this.prodSlot2Row.style.display = 'none';
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
          width: 46px; height: 54px;
          border: 1px solid rgba(100, 160, 255, 0.4);
          border-radius: 3px;
          cursor: pointer; pointer-events: auto;
          transition: background 0.1s, border-color 0.1s;
          background: rgba(10, 18, 30, 0.8);
          position: relative;
          display: flex; flex-direction: column; align-items: center;
          overflow: hidden; box-sizing: border-box;
          padding-top: 2px;
        `;

        const hotkey = i < hotkeys.length ? hotkeys[i] : '';

        // Hotkey badge (top-left)
        const hotkeyEl = document.createElement('div');
        hotkeyEl.style.cssText = 'position: absolute; top: 1px; left: 2px; font-size: 8px; color: rgba(180,210,255,0.6); font-family: Consolas, monospace; z-index: 1;';
        hotkeyEl.textContent = hotkey;
        btn.appendChild(hotkeyEl);

        // Supply badge (top-right)
        if (uDef.supply > 0) {
          const supEl = document.createElement('div');
          supEl.style.cssText = 'position: absolute; top: 1px; right: 2px; font-size: 7px; color: rgba(255,220,80,0.6); font-family: Consolas, monospace; z-index: 1;';
          supEl.textContent = uDef.supply === 0.5 ? '½' : String(uDef.supply);
          btn.appendChild(supEl);
        }

        // Portrait (32x32 scaled from 44x44)
        const portrait = this.portraitRenderer.getPortrait(uType);
        portrait.style.cssText = 'width: 32px; height: 32px; image-rendering: pixelated; flex-shrink: 0;';
        btn.appendChild(portrait);

        // Cost line (bottom)
        const costEl = document.createElement('div');
        costEl.style.cssText = 'font-size: 8px; font-family: Consolas, monospace; text-align: center; line-height: 1; margin-top: 1px;';
        if (uDef.costGas > 0) {
          costEl.innerHTML = `<span style="color:#66ccff">${uDef.costMinerals}</span><span style="color:#555">/</span><span style="color:#66ff88">${uDef.costGas}</span>`;
        } else {
          costEl.innerHTML = `<span style="color:#66ccff">${uDef.costMinerals}</span>`;
        }
        btn.appendChild(costEl);

        btn.addEventListener('mouseenter', () => {
          if (!btn.classList.contains('prod-disabled')) {
            btn.style.background = 'rgba(40, 80, 160, 0.5)';
            btn.style.borderColor = 'rgba(100, 180, 255, 0.7)';
          }
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = btn.classList.contains('prod-disabled')
            ? 'rgba(10, 14, 20, 0.9)'
            : 'rgba(10, 18, 30, 0.8)';
          btn.style.borderColor = btn.classList.contains('prod-disabled')
            ? 'rgba(60, 60, 60, 0.3)'
            : 'rgba(100, 160, 255, 0.4)';
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

      // Check unit tech requirement (building prerequisite)
      const requiredBuilding = UNIT_TECH_REQUIREMENTS[uType];
      const techMet = requiredBuilding === undefined
        || !world
        || !fac
        || hasCompletedBuilding(world, fac, requiredBuilding as BuildingType);

      // Check TechLab addon requirement
      const needsTechLab = TECHLAB_UNITS.has(uType);
      const hasTechLab = addonType[buildingEid] === AddonType.TechLab;
      const addonMet = !needsTechLab || hasTechLab;

      const canAfford = playerResources
        ? playerResources.minerals >= uDef.costMinerals && playerResources.gas >= uDef.costGas
        : false;
      const supplyCapped = playerResources
        ? playerResources.supplyUsed >= playerResources.supplyProvided
        : false;
      const enabled = canAfford && !supplyCapped && techMet && addonMet;
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

      // Update styling without rebuilding DOM (preserves portrait canvas)
      if (!techMet && requiredBuilding !== undefined) {
        const reqDef = BUILDING_DEFS[requiredBuilding];
        const reqName = reqDef ? reqDef.name : 'Required';
        btn.style.opacity = '0.4';
        btn.title = `Requires: ${reqName}`;
        const canvas = btn.querySelector('canvas');
        if (canvas) canvas.style.opacity = '0.3';
      } else if (!addonMet) {
        btn.style.opacity = '0.4';
        btn.title = 'Requires: Tech Lab';
        // Dim the portrait
        const canvas = btn.querySelector('canvas');
        if (canvas) canvas.style.opacity = '0.3';
      } else {
        btn.style.opacity = enabled ? '1' : '0.5';
        btn.title = '';
        const canvas = btn.querySelector('canvas');
        if (canvas) canvas.style.opacity = enabled ? '1' : '0.4';
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
    label.style.cssText = 'font-size: 9px; color: #888; margin-right: 3px; align-self: center;';
    label.textContent = 'Q';
    this.queueRow.appendChild(label);

    const qBase = buildingEid * PROD_QUEUE_MAX;
    for (let i = 0; i < qLen; i++) {
      const uType = prodQueue[qBase + i];

      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 26px; height: 26px;
        border: 1px solid rgba(255, 180, 44, 0.4);
        border-radius: 2px;
        background: rgba(40, 30, 10, 0.7);
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
      `;

      const portrait = this.portraitRenderer.getPortrait(uType);
      portrait.style.cssText = 'width: 22px; height: 22px; image-rendering: pixelated;';
      slot.appendChild(portrait);

      this.queueRow.appendChild(slot);
    }
  }

  /** Show upgrade button for Hatchery→Lair or Lair→Hive. */
  private updateUpgradeButton(buildingEid: number, bt: number, world: World, fac: Faction): void {
    // Determine upgrade target
    let targetType: BuildingType | 0 = 0;
    if (bt === BuildingType.Hatchery) targetType = BuildingType.Lair;
    else if (bt === BuildingType.Lair) targetType = BuildingType.Hive;

    if (targetType === 0 || upgradingTo[buildingEid] !== 0) {
      // Hive can't upgrade further, or already upgrading — show progress
      if (upgradingTo[buildingEid] !== 0) {
        this.addonButtonsRow.innerHTML = '';
        const pct = upgradeTimeTotal[buildingEid] > 0
          ? Math.min(1, 1 - upgradeProgress[buildingEid] / upgradeTimeTotal[buildingEid]) : 0;
        const tgtDef = BUILDING_DEFS[upgradingTo[buildingEid]];
        const tgtName = tgtDef ? tgtDef.name : 'Upgrading';
        const badge = document.createElement('div');
        badge.style.cssText = 'padding: 4px 8px; border: 1px solid rgba(255,160,60,0.4); border-radius: 3px; font-size: 10px; color: #ffcc88; font-family: Consolas, monospace;';
        badge.textContent = `Upgrading to ${tgtName}: ${Math.round(pct * 100)}%`;
        this.addonButtonsRow.appendChild(badge);
        this.addonButtonsRow.style.display = 'flex';
      } else {
        this.addonButtonsRow.style.display = 'none';
      }
      return;
    }

    const targetDef = BUILDING_DEFS[targetType];
    if (!targetDef) { this.addonButtonsRow.style.display = 'none'; return; }

    // Check tech requirement
    const techMet = targetDef.requires === null || hasCompletedBuilding(world, fac, targetDef.requires);

    this.addonButtonsRow.innerHTML = '';
    const btn = document.createElement('div');
    const canAfford = true; // visual only — actual check in callback
    btn.style.cssText = `
      padding: 4px 8px;
      border: 1px solid ${techMet ? 'rgba(100, 160, 255, 0.4)' : 'rgba(60, 60, 60, 0.3)'};
      border-radius: 3px;
      cursor: ${techMet ? 'pointer' : 'default'};
      pointer-events: auto;
      opacity: ${techMet ? '1' : '0.5'};
      font-family: Consolas, monospace; font-size: 10px; color: #eee;
    `;
    const costText = targetDef.costGas > 0
      ? `${targetDef.costMinerals}m ${targetDef.costGas}g`
      : `${targetDef.costMinerals}m`;
    btn.textContent = `Upgrade to ${targetDef.name} (${costText})`;
    if (!techMet && targetDef.requires !== null) {
      const reqDef = BUILDING_DEFS[targetDef.requires];
      btn.title = `Requires: ${reqDef ? reqDef.name : 'Unknown'}`;
    }
    btn.addEventListener('click', () => {
      if (techMet && this.upgradeCallback) {
        this.upgradeCallback(buildingEid, targetType);
      }
    });
    btn.addEventListener('mouseenter', () => {
      if (techMet) btn.style.background = 'rgba(40, 80, 160, 0.5)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });
    this.addonButtonsRow.appendChild(btn);
    this.addonButtonsRow.style.display = 'flex';
  }

  /** Render addon buttons (Tech Lab / Reactor) for Barracks/Factory/Starport. */
  private updateAddonButtons(buildingEid: number): void {
    const addon = addonType[buildingEid];
    if (addon !== AddonType.None) {
      // Already has an addon — show "BUILT" status badge
      this.addonButtonsRow.innerHTML = '';
      const badge = document.createElement('div');
      const isTechLab = addon === AddonType.TechLab;
      badge.style.cssText = `
        display: flex; align-items: center; gap: 5px;
        padding: 4px 8px;
        border: 1px solid ${isTechLab ? 'rgba(80,180,255,0.4)' : 'rgba(255,160,60,0.4)'};
        border-radius: 3px;
        background: ${isTechLab ? 'rgba(20,40,80,0.6)' : 'rgba(60,30,10,0.6)'};
      `;
      const icon = document.createElement('span');
      icon.style.cssText = `font-size: 14px; color: ${isTechLab ? '#44aaff' : '#ffaa44'};`;
      icon.textContent = isTechLab ? '\u2697' : '\u26A1';
      badge.appendChild(icon);
      const text = document.createElement('span');
      text.style.cssText = `font-size: 10px; color: ${isTechLab ? '#88ccff' : '#ffcc88'}; font-family: Consolas, monospace;`;
      text.textContent = isTechLab ? 'Tech Lab' : 'Reactor';
      badge.appendChild(text);
      this.addonButtonsRow.appendChild(badge);
      this.addonButtonsRow.style.display = 'flex';
      return;
    }

    // No addon — show build buttons
    this.addonButtonsRow.innerHTML = '';

    const addons: { label: string; symbol: string; color: string; typeVal: AddonType }[] = [
      { label: 'Tech Lab', symbol: '\u2697', color: '#44aaff', typeVal: AddonType.TechLab },
      { label: 'Reactor', symbol: '\u26A1', color: '#ffaa44', typeVal: AddonType.Reactor },
    ];

    for (const { label, symbol, color, typeVal } of addons) {
      const btn = document.createElement('div');
      btn.style.cssText = `
        width: 80px; padding: 4px 6px;
        border: 1px solid rgba(100, 160, 255, 0.4);
        border-radius: 3px;
        cursor: pointer; pointer-events: auto;
        transition: background 0.1s, border-color 0.1s;
        color: #eee;
      `;
      // Icon + name
      const topRow = document.createElement('div');
      topRow.style.cssText = 'display: flex; align-items: center; gap: 3px;';
      const iconEl = document.createElement('span');
      iconEl.style.cssText = `font-size: 13px; color: ${color};`;
      iconEl.textContent = symbol;
      topRow.appendChild(iconEl);
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-size: 10px; font-family: Consolas, monospace;';
      nameEl.textContent = label;
      topRow.appendChild(nameEl);
      btn.appendChild(topRow);
      // Cost
      const costRow = document.createElement('div');
      costRow.style.cssText = 'font-size: 8px; font-family: Consolas, monospace; margin-top: 2px;';
      costRow.innerHTML = '<span style="color:#66ccff">50</span><span style="color:#555">/</span><span style="color:#66ff88">25</span>';
      btn.appendChild(costRow);

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

    // Upgrade type icons: swords (weapons), shield (armor), claw (melee)
    const UPGRADE_ICONS: Record<number, { symbol: string; color: string }> = {
      [UpgradeType.InfantryWeapons]: { symbol: '\u2694', color: '#ff6644' },
      [UpgradeType.InfantryArmor]:   { symbol: '\u26E8', color: '#4488ff' },
      [UpgradeType.VehicleWeapons]:  { symbol: '\u2699', color: '#ff8822' },
      [UpgradeType.VehicleArmor]:    { symbol: '\u26E8', color: '#88aacc' },
      [UpgradeType.ZergMelee]:       { symbol: '\u2694', color: '#cc3333' },
      [UpgradeType.ZergRanged]:      { symbol: '\u2739', color: '#88ff22' },
      [UpgradeType.ZergCarapace]:    { symbol: '\u26E8', color: '#cc3333' },
      [UpgradeType.StimPack]:         { symbol: '\u26A1', color: '#ff4444' },
      [UpgradeType.CombatShield]:     { symbol: '\u26E8', color: '#4488ff' },
      [UpgradeType.ConcussiveShells]: { symbol: '\u25C9', color: '#88aaff' },
      [UpgradeType.SiegeTech]:        { symbol: '\u2316', color: '#cc8844' },
      [UpgradeType.MetabolicBoost]:   { symbol: '\u26A1', color: '#88ff44' },
      [UpgradeType.AdrenalGlands]:    { symbol: '\u2694', color: '#ff4444' },
      [UpgradeType.GroovedSpines]:    { symbol: '\u2191', color: '#88ff22' },
      [UpgradeType.MuscularAugments]: { symbol: '\u26A1', color: '#44cc88' },
    };

    const bt = buildingType[buildingEid] as BuildingType;
    const hasTechLab = addonType[buildingEid] === AddonType.TechLab;
    let upgradeList: { type: UpgradeType; label: string }[];
    if (bt === BuildingType.Armory) upgradeList = ARMORY_UPGRADES;
    else if (bt === BuildingType.EvolutionChamber) upgradeList = EVOCHAMBER_UPGRADES;
    else if (bt === BuildingType.Barracks && hasTechLab) upgradeList = BARRACKS_RESEARCH;
    else if (bt === BuildingType.Factory && hasTechLab) upgradeList = FACTORY_RESEARCH;
    else if (bt === BuildingType.SpawningPool) upgradeList = SPAWNING_POOL_RESEARCH;
    else if (bt === BuildingType.HydraliskDen) upgradeList = HYDRALISK_DEN_RESEARCH;
    else upgradeList = ENGBAY_UPGRADES;
    for (const { type, label } of upgradeList) {
      const currentLevel = playerResources ? playerResources.upgrades[type] : 0;
      const cost = getUpgradeCost(type, currentLevel);
      const maxed = cost === null;
      const canAfford = !maxed && playerResources
        ? playerResources.minerals >= cost.minerals && playerResources.gas >= cost.gas
        : false;
      const enabled = !maxed && canAfford && !isResearching;

      const btn = document.createElement('div');
      btn.style.cssText = `
        width: 80px; padding: 4px 6px;
        border: 1px solid ${enabled ? 'rgba(100, 160, 255, 0.4)' : 'rgba(80, 80, 80, 0.25)'};
        border-radius: 3px;
        cursor: ${enabled ? 'pointer' : 'default'};
        pointer-events: auto;
        transition: background 0.1s, border-color 0.1s;
        color: ${enabled ? '#eee' : '#666'};
        opacity: ${maxed ? '0.5' : '1'};
      `;
      btn.title = maxed ? `${label} (maxed)` : `${label} — ${cost.minerals}m ${cost.gas}g`;

      // Icon + label row
      const iconInfo = UPGRADE_ICONS[type] || { symbol: '\u2B06', color: '#aaa' };
      const topRow = document.createElement('div');
      topRow.style.cssText = 'display: flex; align-items: center; gap: 3px;';
      const icon = document.createElement('span');
      icon.style.cssText = `font-size: 13px; color: ${iconInfo.color};`;
      icon.textContent = iconInfo.symbol;
      topRow.appendChild(icon);
      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'font-size: 9px; font-family: Consolas, monospace; color: inherit;';
      nameEl.textContent = label;
      topRow.appendChild(nameEl);
      btn.appendChild(topRow);

      // Level pips: 3 for leveled upgrades, 1 for boolean research
      const isBoolean = type >= UpgradeType.StimPack;
      const maxPips = isBoolean ? 1 : 3;
      const pipRow = document.createElement('div');
      pipRow.style.cssText = 'display: flex; gap: 3px; margin-top: 2px; margin-left: 1px;';
      for (let lvl = 0; lvl < maxPips; lvl++) {
        const pip = document.createElement('div');
        const filled = lvl < currentLevel;
        pip.style.cssText = `
          width: 8px; height: 8px; border-radius: 50%;
          border: 1px solid ${filled ? iconInfo.color : 'rgba(120,120,120,0.4)'};
          background: ${filled ? iconInfo.color : 'transparent'};
        `;
        pipRow.appendChild(pip);
      }
      btn.appendChild(pipRow);

      // Cost line
      if (!maxed && cost) {
        const costRow = document.createElement('div');
        costRow.style.cssText = 'font-size: 8px; font-family: Consolas, monospace; margin-top: 2px;';
        costRow.innerHTML = `<span style="color:${enabled ? '#66ccff' : '#446'}">${cost.minerals}</span><span style="color:#555">/</span><span style="color:${enabled ? '#66ff88' : '#464'}">${cost.gas}</span>`;
        btn.appendChild(costRow);
      } else {
        const maxLabel = document.createElement('div');
        maxLabel.style.cssText = 'font-size: 8px; color: #888; font-family: Consolas, monospace; margin-top: 2px;';
        maxLabel.textContent = 'MAX';
        btn.appendChild(maxLabel);
      }

      if (enabled) {
        btn.addEventListener('mouseenter', () => {
          btn.style.background = 'rgba(40, 80, 160, 0.5)';
          btn.style.borderColor = 'rgba(100, 180, 255, 0.6)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.background = 'transparent';
          btn.style.borderColor = 'rgba(100, 160, 255, 0.4)';
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
