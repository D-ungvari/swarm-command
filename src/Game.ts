import { Application, Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  MAP_WIDTH, MAP_HEIGHT, MAP_COLS, MAP_ROWS, TILE_SIZE,
  EDGE_SCROLL_ZONE, EDGE_SCROLL_SPEED,
  MIN_ZOOM, MAX_ZOOM,
  MS_PER_TICK, Faction, UnitType, ResourceType, BuildingType, BuildState,
  MINERAL_PER_PATCH, MINERAL_PER_PATCH_RICH, GAS_PER_GEYSER, MINERAL_COLOR, GAS_COLOR, BUILDING_COLOR,
  STARTING_MINERALS, STARTING_GAS, STARTING_SUPPLY, SUPPLY_PER_UNIT,
  TileType, CommandMode, WorkerState,
  Difficulty, UpgradeType, AddonType, TECHLAB_UNITS, isHatchType, getMorphDef,
  GAME_SPEEDS, setActivePlayerFaction,
  SNIPE_RANGE, TRANSFUSE_RANGE, LOCKON_RANGE,
  EMP_RANGE, EMP_RADIUS,
  BLINDING_CLOUD_RANGE, BLINDING_CLOUD_RADIUS,
  PARASITIC_BOMB_RANGE,
  KD8_RANGE, KD8_RADIUS,
} from './constants';
import { createWorld, addEntity, hasComponents, type World } from './ecs/world';
import {
  addUnitComponents, addWorkerComponent, addResourceComponents, addBuildingComponents,
  POSITION, WORKER, MOVEMENT, BUILDING, UNIT_TYPE, SELECTABLE, HEALTH,
  posX, posY,
  moveSpeed, renderWidth, renderHeight, renderTint,
  hpCurrent, hpMax, faction, unitType,
  atkDamage, atkRange, atkCooldown, atkLastTime, atkSplash, atkHitCount, movePathIndex,
  bonusDmg, bonusVsTag, armorClass, baseArmor, pendingDamage, killCount,
  targetEntity, commandMode,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd, lastCombatTime,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  resourceType, resourceRemaining,
  buildingType, buildState, buildProgress, buildTimeTotal, builderEid,
  rallyX, rallyY, prodUnitType, prodProgress, prodTimeTotal,
  prodSlot2UnitType, prodSlot2Progress, prodSlot2TimeTotal,
  prodQueue, prodQueueLen, prodQueueProgress, prodQueueTimeTotal, PROD_QUEUE_MAX,
  supplyProvided, supplyCost,
  selected, setPath,
  energy, cloaked, veterancyLevel, cargoCapacity,
  isAir, canTargetGround, canTargetAir,
  larvaCount, larvaRegenTimer,
  addonType, workerCountOnResource, RESOURCE,
  upgradingTo, upgradeProgress, upgradeTimeTotal,
} from './ecs/components';
import { UNIT_DEFS } from './data/units';
import { BUILDING_DEFS } from './data/buildings';
import {
  generateMap, spawnRockEntities, tileToWorld, worldToTile, getResourceTiles,
  isBuildable, isGeyserTile, markBuildingTiles,
  findNearestWalkableTile,
  type MapData, type MapType,
} from './map/MapData';
import { hasCompletedBuilding } from './ecs/queries';
import { findPath } from './map/Pathfinder';
import { InputManager } from './input/InputManager';
import { TilemapRenderer } from './rendering/TilemapRenderer';
import { TextureGenerator } from './rendering/TextureGenerator';
import { UnitRenderer, addCommandPing, setAbilityPendingRange, setAoePreview } from './rendering/UnitRenderer';
import { SelectionRenderer } from './rendering/SelectionRenderer';
import { HudRenderer } from './rendering/HudRenderer';
import { BuildMenuRenderer } from './rendering/BuildMenuRenderer';
import { InfoPanelRenderer } from './rendering/InfoPanelRenderer';
import { ControlGroupRenderer } from './rendering/ControlGroupRenderer';
import { ModeIndicatorRenderer } from './rendering/ModeIndicatorRenderer';
import { HotkeyPanelRenderer } from './rendering/HotkeyPanelRenderer';
import { MinimapRenderer } from './rendering/MinimapRenderer';
import { GameOverRenderer } from './rendering/GameOverRenderer';
import { AlertRenderer } from './rendering/AlertRenderer';
import { DebugOverlay } from './rendering/DebugOverlay';
import { movementSystem } from './systems/MovementSystem';
import { spatialHash } from './ecs/SpatialHash';
import { selectionSystem, getControlGroupInfo, getLastActiveGroup, removeTypeFromControlGroup, controlGroupCenterX, controlGroupCenterY, controlGroupCenterFrame } from './systems/SelectionSystem';
import { commandSystem, issuePathCommand } from './systems/CommandSystem';
import { CommandType, GameCommandQueue } from './input/CommandQueue';
import { InputProcessor } from './input/InputProcessor';
import { buildSystem } from './systems/BuildSystem';
import { productionSystem } from './systems/ProductionSystem';
import { combatSystem, getLastTerranHit, damageEvents } from './systems/CombatSystem';
import { abilitySystem } from './systems/AbilitySystem';
import { gatherSystem } from './systems/GatherSystem';
import { deathSystem } from './systems/DeathSystem';
import { aiSystem, initAI, getAIState } from './systems/AISystem';
import { creepSystem, resetCreepSystem } from './systems/CreepSystem';
import { upgradeSystem, encodeResearch, getUpgradeCost, UPGRADE_RESEARCH_OFFSET } from './systems/UpgradeSystem';
import { fogSystem, resetFogSystem } from './systems/FogSystem';
import { detectionSystem } from './systems/DetectionSystem';
import { morphSystem } from './systems/MorphSystem';
import { FogRenderer } from './rendering/FogRenderer';
import { WaypointRenderer } from './rendering/WaypointRenderer';
import { ProjectileRenderer } from './rendering/ProjectileRenderer';
import type { PlayerResources } from './types';
import { soundManager } from './audio/SoundManager';
import { GameStats } from './stats/GameStats';
import { consumeCameraShake } from './rendering/CameraShake';
import { seedRng } from './utils/SeededRng';
import { CommandRecorder, type ReplayFrame } from './replay/CommandRecorder';
import { isTouchDevice } from './utils/DeviceDetect';
import { TouchCommandBar } from './rendering/TouchCommandBar';
import { ScenarioManager } from './scenarios/ScenarioManager';
import type { Scenario } from './scenarios/ScenarioTypes';
import { ScenarioResultRenderer } from './rendering/ScenarioResultRenderer';
import { ScenarioHudRenderer } from './rendering/ScenarioHudRenderer';
import { checkAchievements, showAchievementToast } from './stats/Achievements';

export class Game {
  app!: Application;
  viewport!: Viewport;
  world: World;
  map: MapData;
  input!: InputManager;

  // Per-player resource state
  resources: Record<number, PlayerResources> = {
    [Faction.Terran]: { minerals: STARTING_MINERALS, gas: STARTING_GAS, supplyUsed: 0, supplyProvided: STARTING_SUPPLY, upgrades: new Uint8Array(UpgradeType.COUNT) },
    [Faction.Zerg]: { minerals: STARTING_MINERALS, gas: STARTING_GAS, supplyUsed: 0, supplyProvided: STARTING_SUPPLY, upgrades: new Uint8Array(UpgradeType.COUNT) },
  };

  // Building placement state
  placementMode = false;
  placementBuildingType: number = 0;
  playerFaction: Faction = Faction.Terran;
  private scenarioManager?: ScenarioManager;
  private scenarioResult?: ScenarioResultRenderer;
  private scenarioHud?: ScenarioHudRenderer;
  private initialPlayerUnitCount = 0;
  private scenarioCountdown = 0;  // seconds remaining in pre-game countdown (0 = active)
  private scenarioCountdownEnded = false;
  private lastControlGroupCenterFrame = 0;
  private containerEl?: HTMLElement;

  setPlayerFaction(f: Faction): void {
    this.playerFaction = f;
    setActivePlayerFaction(f);
  }

  setScenario(scenario: Scenario): void {
    this.scenarioManager = new ScenarioManager();
    this.scenarioManager.load(scenario);
  }

  /**
   * Load a replay JSON (from localStorage) and start the game in replay mode.
   * Must be called before init().
   */
  prepareReplay(json: string): void {
    const data = CommandRecorder.fromJSON(json);
    this.gameSeed = data.seed;
    this.setDifficulty(data.difficulty as Difficulty);
    this.setPlayerFaction(data.faction as Faction);
    this.replayMode = true;
    this.replayFrames = data.frames;
    this.replayFrameIndex = 0;
  }

  // Renderers
  private tilemapRenderer!: TilemapRenderer;
  private unitRenderer!: UnitRenderer;
  private selectionRenderer!: SelectionRenderer;
  private hudRenderer!: HudRenderer;
  private buildMenuRenderer!: BuildMenuRenderer;
  private infoPanelRenderer!: InfoPanelRenderer;
  private controlGroupRenderer!: ControlGroupRenderer;
  private modeIndicatorRenderer!: ModeIndicatorRenderer;
  private hotkeyPanelRenderer!: HotkeyPanelRenderer;
  private minimapRenderer!: MinimapRenderer;
  private fogRenderer!: FogRenderer;
  private waypointRenderer!: WaypointRenderer;
  private projRenderer!: ProjectileRenderer;
  private gameOverRenderer!: GameOverRenderer;
  private alertRenderer!: AlertRenderer;
  private debugOverlay!: DebugOverlay;
  private touchCommandBar?: TouchCommandBar;
  private difficulty: Difficulty = Difficulty.Normal;
  private mapType: MapType = 0 as MapType; // MapType.Plains = 0
  private lastAIAttacking = false;
  private lastUnderAttackAlert = 0;
  private selectionQueue!: GameCommandQueue;
  private simulationQueue!: GameCommandQueue;
  private inputProcessor!: InputProcessor;
  private ghostGraphics!: Graphics;

  // Game speed
  private gameSpeedIndex = 1; // index into GAME_SPEEDS; 1 = 1.0x normal

  // Custom settings
  private startingMinerals = STARTING_MINERALS;
  private fogEnabled = true;
  private resizeHandler: (() => void) | null = null;
  private survivalMode = false;
  private turboMode = false;
  private winCondition: string = 'destroy';

  // Fixed timestep accumulator
  private accumulator = 0;
  private lastTime = 0;
  private gameTime = 0;
  private paused = false;

  // Income rate tracking (minerals and gas per minute)
  private mineralPrev = 0;
  private gasPrev = 0;
  private lastIncomeCheck = 0;
  private mineralIncomeRate = 0;
  private gasIncomeRate = 0;

  // Stats tracking
  private stats = new GameStats();
  private lastWaveCount = 0;
  private gameEnded = false;

  // RNG seed (stored for replay system)
  private gameSeed = 0;

  // Replay system
  private recorder = new CommandRecorder();
  private tickCount = 0;
  private replayMode = false;
  private replayFrames: ReplayFrame[] = [];
  private replayFrameIndex = 0;

  constructor() {
    this.world = createWorld();
    // Map is regenerated in init() once mapType is set; provide a default here
    this.map = generateMap();
  }

  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
  }

  setMapType(m: MapType): void {
    this.mapType = m;
  }

  /** Set custom tiles from the map editor (used instead of procedural generation) */
  private customTiles: Uint8Array | null = null;
  setCustomTiles(tiles: Uint8Array): void {
    this.customTiles = tiles;
  }

  setStartingMinerals(n: number): void {
    this.startingMinerals = n;
  }

  setFogEnabled(v: boolean): void {
    this.fogEnabled = v;
  }

  setGameSpeedIndex(n: number): void {
    this.gameSpeedIndex = Math.max(0, Math.min(3, n));
  }

  setSurvivalMode(v: boolean): void {
    this.survivalMode = v;
  }

  setTurboMode(v: boolean): void {
    this.turboMode = v;
    if (v) this.gameSpeedIndex = 3; // lock to 2x
  }

  setWinCondition(v: string): void {
    this.winCondition = v;
  }

  async init(container: HTMLElement): Promise<void> {
    this.containerEl = container;
    this.app = new Application();
    await this.app.init({
      background: 0x0a0a0a,
      resizeTo: window,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    container.appendChild(this.app.canvas as HTMLCanvasElement);

    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: MAP_WIDTH,
      worldHeight: MAP_HEIGHT,
      events: this.app.renderer.events,
    });
    this.app.stage.addChild(this.viewport);

    this.viewport
      .drag({ mouseButtons: 'middle' }) // middle-click pan; touch pan handled by pixi-viewport touch events
      .pinch()
      .wheel()
      .clampZoom({ minScale: MIN_ZOOM, maxScale: MAX_ZOOM })
      .clamp({ direction: 'all' });

    const startPos = tileToWorld(15, 15);
    this.viewport.moveCenter(startPos.x, startPos.y);

    // Re-initialize resources based on player faction
    if (this.playerFaction === Faction.Zerg) {
      this.resources = {
        [Faction.Terran]: { minerals: STARTING_MINERALS, gas: STARTING_GAS, supplyUsed: 0, supplyProvided: STARTING_SUPPLY, upgrades: new Uint8Array(UpgradeType.COUNT) },
        [Faction.Zerg]: { minerals: STARTING_MINERALS, gas: STARTING_GAS, supplyUsed: 0, supplyProvided: STARTING_SUPPLY, upgrades: new Uint8Array(UpgradeType.COUNT) },
      };
    }

    this.input = new InputManager(this.app.canvas as HTMLCanvasElement);

    this.selectionQueue = new GameCommandQueue();
    this.simulationQueue = new GameCommandQueue();
    this.inputProcessor = new InputProcessor(
      this.input,
      this.selectionQueue,
      this.simulationQueue,
      this.viewport,
      this.world,
      this.playerFaction,
    );

    if (isTouchDevice) {
      this.touchCommandBar = new TouchCommandBar(
        container,
        this.simulationQueue,
        this.inputProcessor,
        () => {
          const out: number[] = [];
          for (let eid = 1; eid < this.world.nextEid; eid++) {
            if (selected[eid] === 1 && faction[eid] === this.playerFaction) out.push(eid);
          }
          return out;
        },
      );
    }

    const textureGen = new TextureGenerator();
    textureGen.generateAll();
    this.tilemapRenderer = new TilemapRenderer(textureGen);
    this.viewport.addChild(this.tilemapRenderer.container);

    this.unitRenderer = new UnitRenderer();
    this.viewport.addChild(this.unitRenderer.container);

    this.waypointRenderer = new WaypointRenderer();
    this.viewport.addChild(this.waypointRenderer.container);

    // Ghost preview for building placement (world space)
    this.ghostGraphics = new Graphics();
    this.viewport.addChild(this.ghostGraphics);

    // Projectile renderer (world space, above units, below fog)
    this.projRenderer = new ProjectileRenderer();
    this.viewport.addChild(this.projRenderer.container);

    // Fog of war overlay (world space, above units and ghost)
    this.fogRenderer = new FogRenderer(this.viewport);
    this.viewport.addChild(this.fogRenderer.container);

    this.selectionRenderer = new SelectionRenderer();
    this.app.stage.addChild(this.selectionRenderer.container);

    this.hudRenderer = new HudRenderer(container);
    this.hudRenderer.setFaction(this.playerFaction);
    this.buildMenuRenderer = new BuildMenuRenderer(container);
    this.buildMenuRenderer.setFaction(this.playerFaction);
    this.infoPanelRenderer = new InfoPanelRenderer(container);
    this.controlGroupRenderer = new ControlGroupRenderer(container);
    this.controlGroupRenderer.setRecallCallback((group) => {
      this.selectionQueue.push({ type: CommandType.ControlGroupRecall, data: group });
    });
    this.controlGroupRenderer.setRemoveTypeCallback((group, ut) => {
      removeTypeFromControlGroup(group, ut);
    });
    this.controlGroupRenderer.setDoubleClickTypeCallback((group, ut) => {
      // Recall the group, then filter selection to just this unit type
      this.selectionQueue.push({ type: CommandType.ControlGroupRecall, data: group });
      // After recall, filter by type — push a ctrl+click-style filter
      // We use Select with data=1 trick, but that needs a screen coord of an entity of that type.
      // Simpler: recall the group, then deselect everything that isn't this type.
      // We'll do this inline after the recall processes. Use a microtask.
      queueMicrotask(() => {
        // After the recall is processed, deselect units that don't match the type
        for (let eid = 1; eid < this.world.nextEid; eid++) {
          if (selected[eid] === 1 && unitType[eid] !== ut) {
            selected[eid] = 0;
          }
        }
      });
    });
    this.modeIndicatorRenderer = new ModeIndicatorRenderer(container);
    this.hotkeyPanelRenderer = new HotkeyPanelRenderer(container);

    this.gameOverRenderer = new GameOverRenderer(container);
    this.scenarioResult = new ScenarioResultRenderer(container);
    if (this.scenarioManager) {
      this.scenarioHud = new ScenarioHudRenderer(container);
      // Panel shows after countdown ends; countdown overlay shows during countdown
      if (this.scenarioCountdown <= 0) {
        this.scenarioHud.show();
      } else {
        // Hide game UI during countdown
        container.classList.add('scenario-countdown');
      }
    }
    this.alertRenderer = new AlertRenderer(container);
    this.debugOverlay = new DebugOverlay(container);

    // Wire up production button callback
    this.infoPanelRenderer.setProductionCallback((buildingEid, uType) => {
      this.handleProductionButtonClick(buildingEid, uType);
    });

    // Wire up research button callback (Engineering Bay / Evolution Chamber)
    this.infoPanelRenderer.setResearchCallback((buildingEid, upgradeType) => {
      const res = this.resources[this.playerFaction];
      const currentLevel = res.upgrades[upgradeType];
      const cost = getUpgradeCost(upgradeType as UpgradeType, currentLevel);
      if (!cost) return; // maxed or invalid
      if (res.minerals < cost.minerals || res.gas < cost.gas) return;
      if (prodUnitType[buildingEid] !== 0) return; // already researching
      if (buildState[buildingEid] !== BuildState.Complete) return;
      res.minerals -= cost.minerals;
      res.gas -= cost.gas;
      prodUnitType[buildingEid] = encodeResearch(upgradeType as UpgradeType);
      prodProgress[buildingEid] = cost.time;
      prodTimeTotal[buildingEid] = cost.time;
    });

    // Wire up addon button callback (Tech Lab / Reactor for Barracks/Factory/Starport)
    this.infoPanelRenderer.setAddonCallback((buildingEid, addonTypeVal) => {
      const res = this.resources[this.playerFaction];
      if (res.minerals < 50 || res.gas < 25) return; // can't afford
      if (addonType[buildingEid] !== AddonType.None) return; // already has addon
      res.minerals -= 50;
      res.gas -= 25;
      addonType[buildingEid] = addonTypeVal; // 1=TechLab, 2=Reactor
    });

    // Wire up building upgrade callback (Hatchery→Lair→Hive)
    this.infoPanelRenderer.setUpgradeCallback((buildingEid, targetType) => {
      const res = this.resources[this.playerFaction];
      const def = BUILDING_DEFS[targetType];
      if (!def) return;
      if (res.minerals < def.costMinerals || res.gas < def.costGas) return;
      if (upgradingTo[buildingEid] !== 0) return; // already upgrading
      // Check tech requirement (Lair needs SpawningPool, Hive needs InfestationPit)
      if (def.requires !== null && !hasCompletedBuilding(this.world, this.playerFaction, def.requires)) return;
      res.minerals -= def.costMinerals;
      res.gas -= def.costGas;
      upgradingTo[buildingEid] = targetType;
      upgradeProgress[buildingEid] = def.buildTime;
      upgradeTimeTotal[buildingEid] = def.buildTime;
    });

    // Wire up ability button callback (subgroup abilities like Stim, Siege, Cloak, etc.)
    this.infoPanelRenderer.setAbilityCallback((commandType, _unitEids) => {
      // Targeted abilities enter pending mode instead of firing directly
      switch (commandType) {
        case CommandType.Snipe: this.inputProcessor.setSnipePending(true); return;
        case CommandType.Yamato: this.inputProcessor.setYamatoPending(true); return;
        case CommandType.Abduct: this.inputProcessor.setAbductPending(true); return;
        case CommandType.Transfuse: this.inputProcessor.setTransfusePending(true); return;
        case CommandType.CorrosiveBile: this.inputProcessor.cancelAllPending(); this.inputProcessor.setCorrosiveBilePending(true); return;
        case CommandType.FungalGrowth: this.inputProcessor.cancelAllPending(); this.inputProcessor.setFungalPending(true); return;
        default: break;
      }
      // Morph: determine target unit type from the first unit's type
      if (commandType === CommandType.Morph && _unitEids.length > 0) {
        const firstUnitType = unitType[_unitEids[0]];
        const mdef = getMorphDef(firstUnitType);
        if (mdef) {
          this.simulationQueue.push({ type: CommandType.Morph, units: _unitEids, data: mdef.to });
          return;
        }
      }
      this.simulationQueue.push({ type: commandType, units: _unitEids });
    });

    // Generate map with selected layout (setMapType is called before init)
    if (this.customTiles) {
      // Custom map from editor — build MapData from raw tiles
      const tiles = this.customTiles;
      const walkable = new Uint8Array(tiles.length);
      const destructibleHP = new Uint16Array(tiles.length);
      const creepMap = new Uint8Array(tiles.length);
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i];
        walkable[i] = (t === TileType.Ground || t === TileType.Ramp) ? 1 : 0;
        if (t === TileType.Destructible) destructibleHP[i] = 500;
      }
      const elevation = new Uint8Array(tiles.length);
      this.map = { tiles, walkable, destructibleHP, creepMap, elevation, cols: MAP_COLS, rows: MAP_ROWS };
    } else {
      this.map = generateMap(this.mapType);
    }

    // Minimap (screen space, bottom-right corner)
    this.minimapRenderer = new MinimapRenderer(this.app.stage, this.viewport, this.map);

    this.tilemapRenderer.render(this.map);

    // Apply custom starting minerals (set via setStartingMinerals before init)
    this.resources[this.playerFaction].minerals = this.startingMinerals;

    if (this.scenarioManager) {
      // Scenario mode: disable fog and spawn preset units, skip normal bases
      this.fogEnabled = false;
      this.scenarioManager.applySetup(
        (type, fac, x, y) => this.spawnUnitAt(type, fac, x, y),
        (minerals, gas) => {
          this.resources[this.playerFaction].minerals = minerals;
          this.resources[this.playerFaction].gas = gas;
        },
        tileToWorld,
        (eid, val) => { energy[eid] = val; },
      );
      // Countdown phase: freeze simulation, lock camera, start time set when countdown ends
      // Scale countdown by difficulty if not explicitly set: 1★=5s, 2★=7s, 3★=10s
      const sc = this.scenarioManager.getScenario();
      const difficultyDefault = sc ? [5, 5, 7, 10][sc.difficulty] ?? 10 : 10;
      const countdownDuration = sc?.setup.countdownDuration ?? difficultyDefault;
      this.scenarioCountdown = countdownDuration;
      this.paused = true;
      // Disable viewport interaction during countdown
      this.viewport.plugins.pause('drag');
      this.viewport.plugins.pause('wheel');
      this.viewport.plugins.pause('pinch');
      // Count initial player units and center camera on them
      let count = 0;
      let sumX = 0;
      let sumY = 0;
      for (let eid = 1; eid < this.world.nextEid; eid++) {
        if (hasComponents(this.world, eid, POSITION | HEALTH) && faction[eid] === this.playerFaction && hpCurrent[eid] > 0) {
          count++;
          sumX += posX[eid];
          sumY += posY[eid];
        }
      }
      this.initialPlayerUnitCount = count;
      if (count > 0) {
        this.viewport.moveCenter(sumX / count, sumY / count);
        // Set a comfortable zoom level for the countdown view
        this.viewport.setZoom(0.85, true);
      }
      spawnRockEntities(this.world, this.map);
    } else {
      // Normal game: spawn resource nodes + bases
      this.spawnResourceNodes();
      if (this.playerFaction === Faction.Zerg) {
        this.spawnZergBase(15, 15, true);   // player's Zerg base with 12 Drones
        this.spawnTerranAIBase();            // AI's Terran base at (112, 112)
        this.sendWorkersToMine(Faction.Terran); // auto-mine for AI workers
      } else {
        this.spawnStartingBase();            // player's Terran base with 12 SCVs
        this.spawnZergBase(117, 117, true);  // AI's Zerg base with 12 Drones
        this.sendWorkersToMine(Faction.Zerg);   // auto-mine for AI workers
      }
      spawnRockEntities(this.world, this.map);
    }

    // Seed RNG at game start (replayMode reuses stored seed; live game picks a new one)
    if (!this.replayMode) {
      this.gameSeed = Date.now() & 0x7fffffff;
    }
    seedRng(this.gameSeed);
    if (!this.replayMode) {
      this.recorder.startRecording(this.gameSeed, this.difficulty, this.playerFaction);
    }

    // Skip AI in scenario mode when disableAI is set
    const scenarioDisableAI = this.scenarioManager?.getScenario()?.setup.disableAI;
    if (!scenarioDisableAI) {
      initAI(this.difficulty, this.playerFaction === Faction.Zerg ? Faction.Terran : Faction.Zerg);
    }
    resetCreepSystem();
    resetFogSystem();

    this.resizeHandler = () => {
      this.viewport.resize(window.innerWidth, window.innerHeight);
      this.minimapRenderer.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this.resizeHandler);

    this.lastTime = performance.now();
    soundManager.startMusic();
    this.app.ticker.add(() => this.loop());
  }

  private loop(): void {
    const now = performance.now();
    const frameTime = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    this.accumulator += frameTime;
    this.debugOverlay.recordFrameTime(frameTime);

    this.input.update();

    // Scenario countdown — tick down using real frame time, then unpause
    if (this.scenarioCountdown > 0) {
      // Space or Enter skips countdown
      if (this.input.state.keysJustPressed.has('Space') || this.input.state.keysJustPressed.has('Enter')) {
        this.scenarioCountdown = 0;
      } else {
        this.scenarioCountdown -= frameTime / 1000;
      }
      if (this.scenarioCountdown <= 0) {
        this.scenarioCountdown = 0;
        this.paused = false;
        this.accumulator = 0;  // prevent tick burst from accumulated countdown time
        this.scenarioManager?.setStartTime(0);
        this.containerEl?.classList.remove('scenario-countdown');
        // Re-enable viewport interaction
        this.viewport.plugins.resume('drag');
        this.viewport.plugins.resume('wheel');
        this.viewport.plugins.resume('pinch');
      } else {
        // Lock camera on player unit center during countdown
        let cx = 0, cy = 0, n = 0;
        for (let eid = 1; eid < this.world.nextEid; eid++) {
          if (hasComponents(this.world, eid, POSITION | HEALTH) && faction[eid] === this.playerFaction && hpCurrent[eid] > 0) {
            cx += posX[eid];
            cy += posY[eid];
            n++;
          }
        }
        if (n > 0) this.viewport.moveCenter(cx / n, cy / n);
      }
      // During countdown: skip all input processing and simulation
      this.render();
      this.input.lateUpdate();
      return;
    }

    // Escape toggles pause — only when no modal modes are active
    if (this.input.state.keysJustPressed.has('Escape')
        && !this.placementMode
        && !this.inputProcessor.isAttackMovePending
        && !this.inputProcessor.isPatrolPending
        && !this.inputProcessor.isAnyAbilityPending) {
      if (this.paused && this.scenarioManager) {
        // Second Escape while paused in scenario mode → abandon to scenario browser
        sessionStorage.setItem('show-scenarios', '1');
        window.location.reload();
        return;
      }
      this.paused = !this.paused;
      if (this.paused && this.scenarioManager) {
        this.alertRenderer.show('ESC again to quit scenario', 3, this.gameTime);
      }
    }

    this.handleMinimapClick();         // runs first — consumes minimap clicks
    this.handleEdgeScroll();
    if (!this.replayMode) {
      this.handleBuildPlacement();       // runs second — consumes build placement clicks
      this.inputProcessor.processFrame(); // processes remaining raw events into queues
      this.applySelectionCommands();     // frame-rate: drain selectionQueue immediately
      // Double-tap control group → center camera
      if (controlGroupCenterFrame > this.lastControlGroupCenterFrame) {
        this.lastControlGroupCenterFrame = controlGroupCenterFrame;
        this.viewport.moveCenter(controlGroupCenterX, controlGroupCenterY);
      }
    }

    const currentMsPerTick = MS_PER_TICK / GAME_SPEEDS[this.gameSpeedIndex];
    if (!this.paused) {
      while (this.accumulator >= currentMsPerTick) {
        this.tick(currentMsPerTick / 1000);
        this.accumulator -= currentMsPerTick;
        // No manual flag clearing needed — InputProcessor already consumed raw events
      }
    }

    this.render();
    this.input.lateUpdate();
  }

  /** Drain selectionQueue and apply selection changes immediately (frame-rate). */
  private applySelectionCommands(): void {
    const cmds = this.selectionQueue.flushWithRecord(this.recorder, this.tickCount, this.gameTime);
    if (cmds.length > 0) {
      this.stats.recordAction();
      const touchExtra = isTouchDevice ? 8 / this.viewport.scale.x : 0;
      selectionSystem(this.world, cmds, this.viewport, this.playerFaction, touchExtra);
    }
  }

  private tick(dt: number): void {
    this.tickCount++;
    this.gameTime += dt;

    // In replay mode, inject recorded commands at their original ticks
    if (this.replayMode) {
      while (
        this.replayFrameIndex < this.replayFrames.length &&
        this.replayFrames[this.replayFrameIndex].tick <= this.tickCount
      ) {
        const frame = this.replayFrames[this.replayFrameIndex++];
        this.simulationQueue.push(frame.command);
      }
    }

    // Rebuild spatial hash once per tick — must run before any system that queries it
    spatialHash.rebuild(this.world);

    // APM: count simulation commands issued this tick
    if (this.simulationQueue.length > 0) {
      this.stats.recordAction();
    }
    commandSystem(this.world, this.simulationQueue.flushWithRecord(this.replayMode ? null : this.recorder, this.tickCount, this.gameTime), this.viewport, this.map, this.gameTime, this.resources, this.playerFaction);
    buildSystem(this.world, dt, this.resources, this.gameTime, this.map);
    productionSystem(this.world, dt, this.resources, this.map,
      (type, fac, x, y) => {
        const eid = this.spawnUnitAt(type, fac, x, y);
        if (fac === this.playerFaction) this.stats.recordUnitProduced();
        return eid;
      }, this.gameTime);
    upgradeSystem(this.world, dt, this.resources);
    movementSystem(this.world, dt, this.map, this.gameTime);

    // Fog must update BEFORE combat so Terran auto-acquire sees current visibility
    if (this.fogEnabled) fogSystem(this.world, this.map);

    // Snapshot resources before gather to calculate income delta
    const res = this.resources[this.playerFaction];
    const resBefore = res.minerals + res.gas;
    detectionSystem(this.world);
    combatSystem(this.world, dt, this.gameTime, this.map, this.resources);
    abilitySystem(this.world, dt, this.gameTime);
    morphSystem(this.world, dt,
      (type, fac, x, y) => this.spawnUnitAt(type, fac, x, y),
      (eid) => { hpCurrent[eid] = 0; },
    );
    gatherSystem(this.world, dt, this.map, this.resources);
    const resAfter = res.minerals + res.gas;
    const gathered = resAfter - resBefore;
    if (gathered > 0) this.stats.recordResourceGathered(gathered);

    // Tally damage dealt/taken from this tick's damage events
    for (const evt of damageEvents) {
      if (evt.time === this.gameTime) {
        if (evt.color === 0xaaddff) {
          // Zerg victim = damage dealt by Terran
          this.stats.recordDamageDealt(evt.amount);
        } else {
          // Terran victim = damage taken
          this.stats.recordDamageTaken(evt.amount);
        }
      }
    }

    deathSystem(this.world, this.gameTime, this.map, this.resources, dt);
    if (!this.scenarioManager?.getScenario()?.setup.disableAI) {
      aiSystem(this.world, dt, this.gameTime, this.map,
        (type, fac, x, y) => this.spawnUnitAt(type, fac, x, y), this.resources,
        (type, fac, col, row) => this.spawnBuilding(type as BuildingType, fac as Faction, col, row));
    }
    creepSystem(this.world, this.map, dt);

    // Scenario wave scripting — issue attack-move commands at scheduled times
    if (this.scenarioManager) {
      this.scenarioManager.tickBehavior(
        this.gameTime,
        (eids, targetX, targetY) => {
          const alive = eids.filter(eid => hpCurrent[eid] > 0);
          if (alive.length > 0) {
            issuePathCommand(this.world, alive, targetX, targetY, this.map, CommandMode.AttackMove);
          }
        },
        tileToWorld,
      );
    }

    // Track waves defeated
    const aiState = getAIState();
    if (aiState.waveCount > this.lastWaveCount) {
      const newWaves = aiState.waveCount - this.lastWaveCount;
      for (let i = 0; i < newWaves; i++) this.stats.recordWaveDefeated();
      this.lastWaveCount = aiState.waveCount;
    }

    // Scenario objective check
    if (this.scenarioManager) {
      let playerAlive = 0, enemyAlive = 0;
      const playerFac = this.playerFaction;
      const enemyFac = playerFac === Faction.Terran ? Faction.Zerg : Faction.Terran;
      for (let eid = 1; eid < this.world.nextEid; eid++) {
        if (!hasComponents(this.world, eid, POSITION | HEALTH)) continue;
        if (hpCurrent[eid] > 0) {
          if (faction[eid] === playerFac) playerAlive++;
          else if (faction[eid] === enemyFac) enemyAlive++;
        }
      }
      const playerLost = Math.max(0, this.initialPlayerUnitCount - playerAlive);

      const result = this.scenarioManager.checkObjective(
        this.gameTime, playerAlive, enemyAlive, playerLost
      );
      if (result?.completed && this.scenarioResult && !this.scenarioResult.isVisible) {
        const scenario = this.scenarioManager.getScenario()!;
        this.scenarioResult.show({
          scenarioId: scenario.id,
          scenarioTitle: scenario.title,
          won: result.won,
          score: result.score,
          maxScore: result.maxScore,
          timeElapsed: this.gameTime,
          unitsLost: playerLost,
          tips: scenario.tips,
          objectiveType: scenario.objective.type,
          totalPlayerUnits: this.initialPlayerUnitCount,
        });
        // Pause the game when result shows
        this.paused = true;
      }
    }
  }

  private render(): void {
    // Update positional audio and adaptive music
    soundManager.setCameraPosition(this.viewport.center.x, this.viewport.center.y);
    const recentDamage = damageEvents.filter(e => this.gameTime - e.time < 2).length;
    const intensity = Math.min(1, recentDamage / 10);
    soundManager.setCombatIntensity(intensity);

    this.tilemapRenderer.updateVisibleTiles(this.viewport);
    this.tilemapRenderer.updateWater(this.gameTime);
    this.tilemapRenderer.updateCreep(this.map, this.gameTime);
    // Set ability range info for renderer
    if (this.inputProcessor.isSnipePending) setAbilityPendingRange(SNIPE_RANGE * TILE_SIZE, UnitType.Ghost, 0x00ccff);
    else if (this.inputProcessor.isEmpPending) setAbilityPendingRange(EMP_RANGE * TILE_SIZE, UnitType.Ghost, 0x00ccff);
    else if (this.inputProcessor.isYamatoPending) setAbilityPendingRange(10 * TILE_SIZE, UnitType.Battlecruiser, 0xff6600);
    else if (this.inputProcessor.isAbductPending) setAbilityPendingRange(9 * TILE_SIZE, UnitType.Viper, 0xcc44ff);
    else if (this.inputProcessor.isTransfusePending) setAbilityPendingRange(TRANSFUSE_RANGE * TILE_SIZE, UnitType.Queen, 0x44ff44);
    else if (this.inputProcessor.isLockOnPending) setAbilityPendingRange(LOCKON_RANGE * TILE_SIZE, UnitType.Cyclone, 0xff4444);
    else if (this.inputProcessor.isCorrosiveBilePending) setAbilityPendingRange(9 * TILE_SIZE, UnitType.Ravager, 0xff4444);
    else if (this.inputProcessor.isFungalPending) setAbilityPendingRange(10 * TILE_SIZE, UnitType.Infestor, 0x44ff88);
    else if (this.inputProcessor.isBlindingCloudPending) setAbilityPendingRange(BLINDING_CLOUD_RANGE * TILE_SIZE, UnitType.Viper, 0x8844ff);
    else if (this.inputProcessor.isParasiticBombPending) setAbilityPendingRange(PARASITIC_BOMB_RANGE * TILE_SIZE, UnitType.Viper, 0xff4488);
    else if (this.inputProcessor.isKD8ChargePending) setAbilityPendingRange(KD8_RANGE * TILE_SIZE, UnitType.Reaper, 0xff6622);
    else setAbilityPendingRange(0, -1, 0);
    // AoE cursor preview for location-targeted abilities
    if (this.inputProcessor.isCorrosiveBilePending || this.inputProcessor.isFungalPending || this.inputProcessor.isBlindingCloudPending || this.inputProcessor.isEmpPending || this.inputProcessor.isKD8ChargePending) {
      const mouseWorld = this.viewport.toWorld(this.input.state.mouse.x, this.input.state.mouse.y);
      const radius = this.inputProcessor.isCorrosiveBilePending ? 1.5 * TILE_SIZE
        : this.inputProcessor.isBlindingCloudPending ? BLINDING_CLOUD_RADIUS * TILE_SIZE
        : this.inputProcessor.isEmpPending ? EMP_RADIUS * TILE_SIZE
        : this.inputProcessor.isKD8ChargePending ? KD8_RADIUS * TILE_SIZE
        : 2.25 * TILE_SIZE;
      const color = this.inputProcessor.isCorrosiveBilePending ? 0xff4444
        : this.inputProcessor.isBlindingCloudPending ? 0x8844ff
        : this.inputProcessor.isEmpPending ? 0x00ccff
        : this.inputProcessor.isKD8ChargePending ? 0xff6622
        : 0x44ff88;
      setAoePreview(mouseWorld.x, mouseWorld.y, radius, color);
    } else {
      setAoePreview(0, 0, 0, 0);
    }
    this.unitRenderer.render(this.world, this.gameTime, this.viewport.scale.x);
    this.projRenderer.update(this.gameTime);
    this.projRenderer.render(this.gameTime);
    this.waypointRenderer.render(this.world, this.input.state.shiftHeld, this.gameTime);
    this.selectionRenderer.render(this.input.state, this.gameTime);
    this.renderGhost();
    if (this.fogEnabled) this.fogRenderer.render(this.gameTime);
    const res = this.resources[this.playerFaction];
    const workerCount = this.countWorkers();
    let isSaturated = false;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, RESOURCE)) continue;
      if (workerCountOnResource[eid] > 2) { isSaturated = true; break; }
    }
    // Compute income rate every 5 seconds of game time
    if (this.gameTime - this.lastIncomeCheck >= 5) {
      const elapsed = this.gameTime - this.lastIncomeCheck;
      this.mineralIncomeRate = (res.minerals - this.mineralPrev) / elapsed * 60;
      this.gasIncomeRate = (res.gas - this.gasPrev) / elapsed * 60;
      this.mineralPrev = res.minerals;
      this.gasPrev = res.gas;
      this.lastIncomeCheck = this.gameTime;
    }
    this.hudRenderer.update(res.minerals, res.gas, res.supplyUsed, res.supplyProvided, this.gameTime, workerCount, res.upgrades, this.stats.getCurrentAPM(this.gameTime), GAME_SPEEDS[this.gameSpeedIndex], isSaturated, this.mineralIncomeRate, this.gasIncomeRate);
    this.buildMenuRenderer.update(this.placementMode, res.minerals, res.gas, this.placementBuildingType, this.getTechAvailability());
    this.infoPanelRenderer.update(this.world, this.gameTime, res);
    this.controlGroupRenderer.update(getControlGroupInfo(this.world), getLastActiveGroup());
    // Touch command bar update
    if (this.touchCommandBar) {
      const selectedTypes = new Set<number>();
      let anySelected = false;
      for (let eid = 1; eid < this.world.nextEid; eid++) {
        if (selected[eid] === 1 && faction[eid] === this.playerFaction) {
          selectedTypes.add(unitType[eid]);
          anySelected = true;
        }
      }
      this.touchCommandBar.update(selectedTypes, anySelected);
    }
    // Compute active ability targeting name
    const ip = this.inputProcessor;
    const abilityName = ip.isSnipePending ? 'SNIPE — click target'
      : ip.isYamatoPending ? 'YAMATO CANNON — click target'
      : ip.isAbductPending ? 'ABDUCT — click target'
      : ip.isTransfusePending ? 'TRANSFUSE — click friendly'
      : ip.isLockOnPending ? 'LOCK ON — click target'
      : ip.isCausticSprayPending ? 'CAUSTIC SPRAY — click building'
      : ip.isCorrosiveBilePending ? 'CORROSIVE BILE — click location'
      : ip.isFungalPending ? 'FUNGAL GROWTH — click location'
      : ip.isBlindingCloudPending ? 'BLINDING CLOUD — click location'
      : ip.isEmpPending ? 'EMP ROUND — click location'
      : ip.isKD8ChargePending ? 'KD8 CHARGE — click location'
      : ip.isParasiticBombPending ? 'PARASITIC BOMB — click air target'
      : ip.isNeuralParasitePending ? 'NEURAL PARASITE — click target'
      : '';
    this.modeIndicatorRenderer.update(ip.isAttackMovePending, this.placementMode, ip.isPatrolPending, abilityName);
    if (this.paused && this.scenarioCountdown <= 0) {
      this.modeIndicatorRenderer.showPaused();
    }
    this.hotkeyPanelRenderer.update(this.input.state.keysJustPressed);
    this.minimapRenderer.render(this.world, this.gameTime);

    // Scenario HUD: countdown or active timer
    if (this.scenarioHud && this.scenarioManager) {
      const sc = this.scenarioManager.getScenario();
      if (sc) {
        if (this.scenarioCountdown > 0) {
          this.scenarioHud.updateCountdown(this.scenarioCountdown, sc.title, sc.objective.label, sc.tips);
        } else {
          if (!this.scenarioCountdownEnded) {
            // One-time transition from countdown to active
            this.scenarioHud.updateCountdown(0, sc.title, sc.objective.label, sc.tips);
            this.scenarioHud.show();
            this.scenarioCountdownEnded = true;
          }
          this.scenarioHud.update(sc.title, sc.objective.label, this.gameTime, sc.setup.timeLimit);
        }
      }
    }

    if (this.input.state.keysJustPressed.has('F12')) this.debugOverlay.toggle();
    this.debugOverlay.update(this.world.nextEid - 1, 197, this.gameTime);

    const wasShown = this.gameOverRenderer.isShown;
    const snapshot = this.stats.getSnapshot(this.gameTime);
    // Skip normal game-over check in scenario mode — ScenarioManager handles win/loss
    if (!this.scenarioManager) {
      this.gameOverRenderer.update(this.world, this.gameTime, this.winCondition, snapshot.resourcesGathered);
    }
    if (!wasShown && this.gameOverRenderer.isShown && !this.gameEnded) {
      this.gameEnded = true;
      this.gameOverRenderer.setStats(snapshot);
      this.recorder.stopRecording();
      this.gameOverRenderer.setReplay(this.recorder.toJSON(), this.recorder.frameCount);

      // Check achievements
      const newAchievements = checkAchievements(snapshot);
      for (const title of newAchievements) {
        showAchievementToast(title);
      }
    }

    // AI attack warning — jump camera to base on attack
    const aiState = getAIState();
    if (aiState.isAttacking && !this.lastAIAttacking) {
      this.alertRenderer.show(`ENEMY WAVE ${aiState.waveCount} INCOMING`, 4, this.gameTime);
      soundManager.playWaveAlert();
      // Jump camera to player base (CC position)
      const ccPos = tileToWorld(15, 15);
      this.viewport.moveCenter(ccPos.x, ccPos.y);
    }
    this.lastAIAttacking = aiState.isAttacking;

    // Under-attack alert (throttled to every 10 seconds)
    const hit = getLastTerranHit();
    if (hit.time > 0 && hit.time > this.lastUnderAttackAlert + 10 && this.gameTime - hit.time < 1) {
      // Check if camera is far from the attack location
      const camX = this.viewport.center.x;
      const camY = this.viewport.center.y;
      const dx = hit.x - camX;
      const dy = hit.y - camY;
      if (dx * dx + dy * dy > (15 * TILE_SIZE) * (15 * TILE_SIZE)) {
        this.alertRenderer.show('UNDER ATTACK', 3, this.gameTime);
        this.lastUnderAttackAlert = this.gameTime;
      }
      // Always place a minimap ping regardless of camera distance
      this.minimapRenderer.showAttackPing(hit.x, hit.y, this.gameTime);
    }

    // Game speed: + / - (disabled in turbo mode and during countdown)
    if (!this.turboMode && this.scenarioCountdown <= 0) {
      if (this.input.state.keysJustPressed.has('Equal')) {
        this.gameSpeedIndex = Math.min(3, this.gameSpeedIndex + 1);
      }
      if (this.input.state.keysJustPressed.has('Minus')) {
        this.gameSpeedIndex = Math.max(0, this.gameSpeedIndex - 1);
      }
    }

    // F9 = toggle fog of war (disabled during countdown)
    if (this.input.state.keysJustPressed.has('F9') && this.scenarioCountdown <= 0) {
      this.fogEnabled = !this.fogEnabled;
    }

    // Soft camera nudge toward combat (not a hard jump)
    if (hit.time > 0 && this.gameTime - hit.time < 0.5) {
      const camX = this.viewport.center.x;
      const camY = this.viewport.center.y;
      const ndx = hit.x - camX;
      const ndy = hit.y - camY;
      const dist = Math.sqrt(ndx * ndx + ndy * ndy);
      if (dist > 10 * TILE_SIZE && dist < 40 * TILE_SIZE) {
        // Nudge 2% toward the attack each frame
        this.viewport.moveCenter(camX + ndx * 0.02, camY + ndy * 0.02);
      }
    }

    // Spacebar = jump camera to base (disabled during countdown)
    if (this.input.state.keysJustPressed.has('Space') && !this.placementMode && this.scenarioCountdown <= 0) {
      const ccPos = tileToWorld(15, 15);
      this.viewport.moveCenter(ccPos.x, ccPos.y);
    }

    // F2 = select all combat units, F3 = select all workers (disabled during countdown)
    if (this.input.state.keysJustPressed.has('F2') && this.scenarioCountdown <= 0) {
      this.selectAllCombatUnits();
    }
    if (this.input.state.keysJustPressed.has('F3') && this.scenarioCountdown <= 0) {
      this.selectAllWorkers();
    }
    this.alertRenderer.update(this.gameTime);

    // Cursor change based on current mode
    if (this.placementMode) {
      document.body.style.cursor = 'cell';
    } else if (this.inputProcessor.isAttackMovePending || this.inputProcessor.isAnyAbilityPending || this.inputProcessor.isPatrolPending) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }

    // Camera shake — offset the entire stage and restore each frame
    const shake = consumeCameraShake(1 / 60);
    if (shake > 0.5) {
      this.app.stage.x = Math.sin(this.gameTime * 45) * shake;
      this.app.stage.y = Math.cos(this.gameTime * 41) * shake * 0.7;
    } else {
      this.app.stage.x = 0;
      this.app.stage.y = 0;
    }
  }

  /** Check if tech prerequisite is met for a building type */
  private isTechAvailable(bType: BuildingType): boolean {
    const def = BUILDING_DEFS[bType];
    if (!def || def.requires === null) return true;
    return hasCompletedBuilding(this.world, this.playerFaction, def.requires);
  }

  /** Return the prerequisite building name for a locked slot tooltip. */
  private getRequiresName(bType: BuildingType): string {
    const def = BUILDING_DEFS[bType];
    if (!def || def.requires === null) return '';
    const reqDef = BUILDING_DEFS[def.requires];
    return reqDef ? reqDef.name : '';
  }

  /** Get tech availability for all 7 build menu entries */
  private getTechAvailability(): boolean[] {
    if (this.playerFaction === Faction.Zerg) {
      return [
        true,                                                                  // 1: Hatchery (always)
        true,                                                                  // 2: Extractor (always)
        true,                                                                  // 3: SpawningPool (always)
        this.isTechAvailable(BuildingType.RoachWarren),                       // 4: RoachWarren (req SpawningPool)
        this.isTechAvailable(BuildingType.HydraliskDen),                      // 5: HydraliskDen (req Hatchery)
        this.isTechAvailable(BuildingType.Spire),                             // 6: Spire (req Hatchery)
        this.isTechAvailable(BuildingType.EvolutionChamber),                  // 7: EvoChamber (req SpawningPool)
        this.isTechAvailable(BuildingType.InfestationPit),                    // 8: InfestationPit (req SpawningPool)
        this.isTechAvailable(BuildingType.SpineCrawler),                      // 9: SpineCrawler (req SpawningPool)
        this.isTechAvailable(BuildingType.BanelingNest),                      // 0: BanelingNest (req SpawningPool)
        this.isTechAvailable(BuildingType.UltraliskCavern),                   // -: UltraliskCavern (req Hive)
        this.isTechAvailable(BuildingType.LurkerDen),                         // =: LurkerDen (req Lair)
      ];
    }
    // Existing Terran logic
    return [
      this.isTechAvailable(BuildingType.CommandCenter),
      this.isTechAvailable(BuildingType.SupplyDepot),
      this.isTechAvailable(BuildingType.Barracks),
      this.isTechAvailable(BuildingType.Refinery),
      this.isTechAvailable(BuildingType.Factory),
      this.isTechAvailable(BuildingType.Starport),
      this.isTechAvailable(BuildingType.EngineeringBay),
      this.isTechAvailable(BuildingType.MissileTurret),
      this.isTechAvailable(BuildingType.Armory),           // 9: Armory (req Factory)
      this.isTechAvailable(BuildingType.GhostAcademy),     // 0: Ghost Academy (req Barracks)
      this.isTechAvailable(BuildingType.FusionCore),       // -: Fusion Core (req Starport)
      true,                                                  // =: unused
    ];
  }

  private handleBuildPlacement(): void {
    if (this.scenarioManager?.getScenario()?.setup.disableBuilding) return;

    const input = this.input.state;

    // B key opens build mode — only if a worker of this faction is selected
    if (input.keysJustPressed.has('KeyB') && !this.placementMode) {
      const workerType = this.playerFaction === Faction.Zerg ? UnitType.Drone : UnitType.SCV;
      let hasWorkerSelected = false;
      for (let eid = 1; eid < this.world.nextEid; eid++) {
        if (selected[eid] !== 1) continue;
        if (unitType[eid] !== workerType) continue;
        if (faction[eid] !== this.playerFaction) continue;
        if (hpCurrent[eid] <= 0) continue;
        hasWorkerSelected = true;
        break;
      }
      if (!hasWorkerSelected) return;

      this.placementMode = true;
      this.placementBuildingType = 0; // Wait for 1/2/3/4/5/6
      return;
    }

    if (this.placementMode) {
      if (this.playerFaction === Faction.Zerg) {
        // Zerg building select: 1=Hatchery, 2=Extractor, 3=SpawningPool,
        // 4=RoachWarren, 5=HydraliskDen, 6=Spire, 7=EvoChamber, 8=InfestationPit, 9=SpineCrawler
        if (input.keysJustPressed.has('Digit1')) {
          this.placementBuildingType = BuildingType.Hatchery;
        } else if (input.keysJustPressed.has('Digit2')) {
          this.placementBuildingType = BuildingType.Extractor;
        } else if (input.keysJustPressed.has('Digit3')) {
          this.placementBuildingType = BuildingType.SpawningPool;
        } else if (input.keysJustPressed.has('Digit4')) {
          if (this.isTechAvailable(BuildingType.RoachWarren)) {
            this.placementBuildingType = BuildingType.RoachWarren;
          } else {
            this.buildMenuRenderer.flashLocked(3, this.getRequiresName(BuildingType.RoachWarren));
          }
        } else if (input.keysJustPressed.has('Digit5')) {
          if (this.isTechAvailable(BuildingType.HydraliskDen)) {
            this.placementBuildingType = BuildingType.HydraliskDen;
          } else {
            this.buildMenuRenderer.flashLocked(4, this.getRequiresName(BuildingType.HydraliskDen));
          }
        } else if (input.keysJustPressed.has('Digit6')) {
          if (this.isTechAvailable(BuildingType.Spire)) {
            this.placementBuildingType = BuildingType.Spire;
          } else {
            this.buildMenuRenderer.flashLocked(5, this.getRequiresName(BuildingType.Spire));
          }
        } else if (input.keysJustPressed.has('Digit7')) {
          if (this.isTechAvailable(BuildingType.EvolutionChamber)) {
            this.placementBuildingType = BuildingType.EvolutionChamber;
          } else {
            this.buildMenuRenderer.flashLocked(6, this.getRequiresName(BuildingType.EvolutionChamber));
          }
        } else if (input.keysJustPressed.has('Digit8')) {
          if (this.isTechAvailable(BuildingType.InfestationPit)) {
            this.placementBuildingType = BuildingType.InfestationPit;
          } else {
            this.buildMenuRenderer.flashLocked(7, this.getRequiresName(BuildingType.InfestationPit));
          }
        } else if (input.keysJustPressed.has('Digit9')) {
          if (this.isTechAvailable(BuildingType.SpineCrawler)) {
            this.placementBuildingType = BuildingType.SpineCrawler;
          } else {
            this.buildMenuRenderer.flashLocked(8, this.getRequiresName(BuildingType.SpineCrawler));
          }
        } else if (input.keysJustPressed.has('Digit0')) {
          if (this.isTechAvailable(BuildingType.BanelingNest)) {
            this.placementBuildingType = BuildingType.BanelingNest;
          } else {
            this.buildMenuRenderer.flashLocked(9, this.getRequiresName(BuildingType.BanelingNest));
          }
        } else if (input.keysJustPressed.has('Minus')) {
          if (this.isTechAvailable(BuildingType.UltraliskCavern)) {
            this.placementBuildingType = BuildingType.UltraliskCavern;
          } else {
            this.buildMenuRenderer.flashLocked(10, this.getRequiresName(BuildingType.UltraliskCavern));
          }
        } else if (input.keysJustPressed.has('Equal')) {
          if (this.isTechAvailable(BuildingType.LurkerDen)) {
            this.placementBuildingType = BuildingType.LurkerDen;
          } else {
            this.buildMenuRenderer.flashLocked(11, this.getRequiresName(BuildingType.LurkerDen));
          }
        }
        if (input.keysJustPressed.has('Escape')) {
          this.placementMode = false;
          this.placementBuildingType = 0;
          return;
        }
        if (this.placementBuildingType > 0 && input.mouse.leftJustReleased && !input.mouse.isDragging) {
          const def = BUILDING_DEFS[this.placementBuildingType];
          if (!def) return;
          const worldPos = this.viewport.toWorld(input.mouse.x, input.mouse.y);
          let tile = worldToTile(worldPos.x, worldPos.y);
          const isExtractor = this.placementBuildingType === BuildingType.Extractor;

          // Extractor: snap to nearest gas geyser (same as Terran Refinery)
          if (isExtractor) {
            let bestDist = Infinity;
            let bestCol = tile.col;
            let bestRow = tile.row;
            for (let dr = -3; dr <= 3; dr++) {
              for (let dc = -3; dc <= 3; dc++) {
                const c = tile.col + dc;
                const r = tile.row + dr;
                if (c < 0 || c >= this.map.cols || r < 0 || r >= this.map.rows) continue;
                if (this.map.tiles[r * this.map.cols + c] === TileType.Gas) {
                  const dist = dc * dc + dr * dr;
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestCol = c;
                    bestRow = r;
                  }
                }
              }
            }
            if (bestDist < Infinity) {
              tile = { col: bestCol, row: bestRow };
            }
          }

          const valid = isExtractor
            ? isGeyserTile(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight)
            : isBuildable(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight);
          if (valid) {
            // Zerg buildings (except Hatchery and Extractor) require creep
            if (this.placementBuildingType !== BuildingType.Hatchery && !isExtractor) {
              const centerIdx = tile.row * this.map.cols + tile.col;
              if (!this.map.creepMap[centerIdx]) {
                return; // No creep — can't build here
              }
            }
            const res = this.resources[this.playerFaction];
            if (res.minerals >= def.costMinerals && res.gas >= def.costGas) {
              res.minerals -= def.costMinerals;
              res.gas -= def.costGas;
              this.spawnBuilding(this.placementBuildingType as BuildingType, this.playerFaction, tile.col, tile.row);
              soundManager.playBuild();
              // Find and consume a Drone (Drone morphs into building)
              for (let eid = 1; eid < this.world.nextEid; eid++) {
                if (unitType[eid] !== UnitType.Drone) continue;
                if (faction[eid] !== this.playerFaction) continue;
                if (hpCurrent[eid] <= 0) continue;
                if (selected[eid] !== 1) continue;
                hpCurrent[eid] = 0; // Drone consumed — DeathSystem cleans up
                break; // only consume 1 Drone
              }
              this.placementMode = false;
              this.placementBuildingType = 0;
              input.mouse.leftJustReleased = false;
              this.input.consumeLastEvent('leftup');
            }
          }
        }
        return; // Zerg handled — don't fall through to Terran logic
      }

      // Select building type (with tech tree check)
      if (input.keysJustPressed.has('Digit1')) {
        if (this.isTechAvailable(BuildingType.CommandCenter)) {
          this.placementBuildingType = BuildingType.CommandCenter;
        } else {
          this.buildMenuRenderer.flashLocked(0, this.getRequiresName(BuildingType.CommandCenter));
        }
      } else if (input.keysJustPressed.has('Digit2')) {
        if (this.isTechAvailable(BuildingType.SupplyDepot)) {
          this.placementBuildingType = BuildingType.SupplyDepot;
        } else {
          this.buildMenuRenderer.flashLocked(1, this.getRequiresName(BuildingType.SupplyDepot));
        }
      } else if (input.keysJustPressed.has('Digit3')) {
        if (this.isTechAvailable(BuildingType.Barracks)) {
          this.placementBuildingType = BuildingType.Barracks;
        } else {
          this.buildMenuRenderer.flashLocked(2, this.getRequiresName(BuildingType.Barracks));
        }
      } else if (input.keysJustPressed.has('Digit4')) {
        if (this.isTechAvailable(BuildingType.Refinery)) {
          this.placementBuildingType = BuildingType.Refinery;
        } else {
          this.buildMenuRenderer.flashLocked(3, this.getRequiresName(BuildingType.Refinery));
        }
      } else if (input.keysJustPressed.has('Digit5')) {
        if (this.isTechAvailable(BuildingType.Factory)) {
          this.placementBuildingType = BuildingType.Factory;
        } else {
          this.buildMenuRenderer.flashLocked(4, this.getRequiresName(BuildingType.Factory));
        }
      } else if (input.keysJustPressed.has('Digit6')) {
        if (this.isTechAvailable(BuildingType.Starport)) {
          this.placementBuildingType = BuildingType.Starport;
        } else {
          this.buildMenuRenderer.flashLocked(5, this.getRequiresName(BuildingType.Starport));
        }
      } else if (input.keysJustPressed.has('Digit7')) {
        if (this.isTechAvailable(BuildingType.EngineeringBay)) {
          this.placementBuildingType = BuildingType.EngineeringBay;
        } else {
          this.buildMenuRenderer.flashLocked(6, this.getRequiresName(BuildingType.EngineeringBay));
        }
      } else if (input.keysJustPressed.has('Digit8')) {
        if (this.isTechAvailable(BuildingType.MissileTurret)) {
          this.placementBuildingType = BuildingType.MissileTurret;
        } else {
          this.buildMenuRenderer.flashLocked(7, this.getRequiresName(BuildingType.MissileTurret));
        }
      } else if (input.keysJustPressed.has('Digit9')) {
        if (this.isTechAvailable(BuildingType.Armory)) {
          this.placementBuildingType = BuildingType.Armory;
        } else {
          this.buildMenuRenderer.flashLocked(8, this.getRequiresName(BuildingType.Armory));
        }
      } else if (input.keysJustPressed.has('Digit0')) {
        if (this.isTechAvailable(BuildingType.GhostAcademy)) {
          this.placementBuildingType = BuildingType.GhostAcademy;
        } else {
          this.buildMenuRenderer.flashLocked(9, this.getRequiresName(BuildingType.GhostAcademy));
        }
      } else if (input.keysJustPressed.has('Minus')) {
        if (this.isTechAvailable(BuildingType.FusionCore)) {
          this.placementBuildingType = BuildingType.FusionCore;
        } else {
          this.buildMenuRenderer.flashLocked(10, this.getRequiresName(BuildingType.FusionCore));
        }
      }

      // Escape cancels
      if (input.keysJustPressed.has('Escape')) {
        this.placementMode = false;
        this.placementBuildingType = 0;
        return;
      }

      // Left click places building
      if (this.placementBuildingType > 0 && input.mouse.leftJustReleased && !input.mouse.isDragging) {
        const def = BUILDING_DEFS[this.placementBuildingType];
        if (!def) return;

        const worldPos = this.viewport.toWorld(input.mouse.x, input.mouse.y);
        let tile = worldToTile(worldPos.x, worldPos.y);

        // Placement validation: gas buildings need gas geyser, others need normal buildable
        const isGasBuilding = this.placementBuildingType === BuildingType.Refinery ||
          this.placementBuildingType === BuildingType.Extractor;

        // Snap-to-geyser: find nearest gas tile within 3 tiles of cursor
        if (isGasBuilding) {
          let bestDist = Infinity;
          let bestCol = tile.col;
          let bestRow = tile.row;
          for (let dr = -3; dr <= 3; dr++) {
            for (let dc = -3; dc <= 3; dc++) {
              const c = tile.col + dc;
              const r = tile.row + dr;
              if (c < 0 || c >= this.map.cols || r < 0 || r >= this.map.rows) continue;
              if (this.map.tiles[r * this.map.cols + c] === TileType.Gas) {
                const dist = dc * dc + dr * dr;
                if (dist < bestDist) {
                  bestDist = dist;
                  bestCol = c;
                  bestRow = r;
                }
              }
            }
          }
          if (bestDist < Infinity) {
            tile = { col: bestCol, row: bestRow };
          }
        }

        const valid = isGasBuilding
          ? isGeyserTile(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight)
          : isBuildable(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight);

        if (valid) {
          const res = this.resources[this.playerFaction];
          if (res.minerals >= def.costMinerals && res.gas >= def.costGas) {
            res.minerals -= def.costMinerals;
            res.gas -= def.costGas;

            const bEid = this.spawnBuilding(this.placementBuildingType as BuildingType, this.playerFaction, tile.col, tile.row);
            soundManager.playBuild();

            // Find nearest selected SCV and command it to build
            this.assignBuilderToBuilding(bEid);

            this.placementMode = false;
            this.placementBuildingType = 0;
            // Consume click so selection system doesn't also process it
            input.mouse.leftJustReleased = false;
            this.input.consumeLastEvent('leftup');
          }
        }
      }
    }
  }

  private assignBuilderToBuilding(buildingEid: number): void {
    // Find first selected SCV, or nearest SCV if none selected
    let bestSCV = 0;
    let bestDist = Infinity;
    const bx = posX[buildingEid];
    const by = posY[buildingEid];

    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (unitType[eid] !== UnitType.SCV) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (hpCurrent[eid] <= 0) continue;
      if (commandMode[eid] === CommandMode.Build) continue; // already building

      const dx = posX[eid] - bx;
      const dy = posY[eid] - by;
      const dist = dx * dx + dy * dy;

      // Prefer selected SCVs
      if (selected[eid] === 1) {
        if (bestSCV === 0 || selected[bestSCV] !== 1 || dist < bestDist) {
          bestSCV = eid;
          bestDist = dist;
        }
      } else if (selected[bestSCV] !== 1 && dist < bestDist) {
        bestSCV = eid;
        bestDist = dist;
      }
    }

    if (bestSCV > 0) {
      builderEid[buildingEid] = bestSCV;
      commandMode[bestSCV] = CommandMode.Build;
      workerState[bestSCV] = WorkerState.Idle;
      workerTargetEid[bestSCV] = buildingEid;
      targetEntity[bestSCV] = -1;

      // Path SCV to building
      const startTile = worldToTile(posX[bestSCV], posY[bestSCV]);
      const buildTile = worldToTile(posX[buildingEid], posY[buildingEid]);
      const walkable = findNearestWalkableTile(this.map, buildTile.col, buildTile.row);
      if (walkable) {
        const tilePath = findPath(this.map, startTile.col, startTile.row, walkable.col, walkable.row);
        if (tilePath.length > 0) {
          const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
            const wp = tileToWorld(c, r);
            return [wp.x, wp.y] as [number, number];
          });
          setPath(bestSCV, worldPath);
        }
      }
    }
  }

  private renderGhost(): void {
    this.ghostGraphics.clear();
    if (!this.placementMode || this.placementBuildingType === 0) return;

    const def = BUILDING_DEFS[this.placementBuildingType];
    if (!def) return;

    const worldPos = this.viewport.toWorld(this.input.state.mouse.x, this.input.state.mouse.y);
    const tile = worldToTile(worldPos.x, worldPos.y);
    const center = tileToWorld(tile.col, tile.row);

    const w = def.tileWidth * TILE_SIZE;
    const h = def.tileHeight * TILE_SIZE;
    const isGasBuilding = this.placementBuildingType === BuildingType.Refinery ||
      this.placementBuildingType === BuildingType.Extractor;
    const valid = isGasBuilding
      ? isGeyserTile(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight)
      : isBuildable(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight);
    const color = valid ? 0x44ff44 : 0xff4444;

    this.ghostGraphics.rect(center.x - w / 2, center.y - h / 2, w, h);
    this.ghostGraphics.fill({ color, alpha: 0.3 });
    this.ghostGraphics.stroke({ color, width: 2, alpha: 0.6 });
  }

  /** If the player clicks/drags on the minimap, move camera and consume the click */
  private handleMinimapClick(): void {
    const m = this.input.state.mouse;

    // Drag on minimap — continuously pan camera
    this.minimapRenderer.handleDrag(m.x, m.y, m.leftDown);

    // Click on minimap — jump camera and consume click
    if (m.leftJustReleased && !m.isDragging) {
      if (this.minimapRenderer.handleClick(m.x, m.y)) {
        m.leftJustReleased = false;
        this.input.consumeLastEvent('leftup');
      }
    }
    // Also consume leftJustPressed on minimap to prevent drag-select
    if (m.leftJustPressed) {
      const localX = m.x - this.minimapRenderer.container.x;
      const localY = m.y - this.minimapRenderer.container.y;
      if (localX >= 0 && localX <= 160 && localY >= 0 && localY <= 160) {
        m.leftJustPressed = false;
        m.leftJustReleased = false;
        this.input.consumeLastEvent('leftdown');
        this.input.consumeLastEvent('leftup');
      }
    }

    // Right-click minimap — smart command (move to ground, attack enemy)
    if (m.rightJustPressed) {
      const dest = this.minimapRenderer.handleRightClick(m.x, m.y);
      if (dest) {
        // Check if there's an enemy unit near the click point (smart command)
        let enemyFound = false;
        const searchR = 2 * TILE_SIZE;
        const searchRSq = searchR * searchR;
        for (let eid = 1; eid < this.world.nextEid; eid++) {
          if (!hasComponents(this.world, eid, POSITION | HEALTH)) continue;
          if (faction[eid] === this.playerFaction || faction[eid] === Faction.None) continue;
          if (hpCurrent[eid] <= 0) continue;
          const edx = posX[eid] - dest.x;
          const edy = posY[eid] - dest.y;
          if (edx * edx + edy * edy <= searchRSq) {
            enemyFound = true;
            break;
          }
        }
        if (enemyFound) {
          // Attack-move toward the area
          const units = this.getSelectedCombatUnits();
          for (const eid of units) {
            commandMode[eid] = CommandMode.AttackMove;
          }
          this.moveSelectedUnitsTo(dest.x, dest.y);
        } else {
          this.moveSelectedUnitsTo(dest.x, dest.y);
        }
        m.rightJustPressed = false;
        this.input.consumeLastEvent('rightdown');
      }
    }
  }

  private moveSelectedUnitsTo(wx: number, wy: number): void {
    const units: number[] = [];
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] !== 1) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (!hasComponents(this.world, eid, POSITION | MOVEMENT)) continue;
      if (hasComponents(this.world, eid, BUILDING)) continue; // Buildings can't move
      if (hpCurrent[eid] <= 0) continue;
      units.push(eid);
    }
    if (units.length === 0) return;

    const cols = Math.ceil(Math.sqrt(units.length));
    const spacing = TILE_SIZE * 0.8;
    for (let i = 0; i < units.length; i++) {
      const eid = units[i];
      const row = Math.floor(i / cols);
      const col = i % cols;
      const offsetX = (col - (cols - 1) / 2) * spacing;
      const offsetY = (row - Math.floor(units.length / cols - 1) / 2) * spacing;
      const destX = wx + offsetX;
      const destY = wy + offsetY;

      const startTile = worldToTile(posX[eid], posY[eid]);
      let endTile = worldToTile(destX, destY);
      if (endTile.col >= 0 && endTile.col < this.map.cols && endTile.row >= 0 && endTile.row < this.map.rows) {
        if (this.map.walkable[endTile.row * this.map.cols + endTile.col] !== 1) {
          const walkable = findNearestWalkableTile(this.map, endTile.col, endTile.row);
          if (walkable) endTile = walkable;
        }
      }
      const tilePath = findPath(this.map, startTile.col, startTile.row, endTile.col, endTile.row);
      if (tilePath.length > 0) {
        const worldPath: Array<[number, number]> = tilePath.map(([c, r]) => {
          const wp = tileToWorld(c, r);
          return [wp.x, wp.y] as [number, number];
        });
        setPath(eid, worldPath);
      }
      commandMode[eid] = CommandMode.AttackMove;
    }
    addCommandPing(wx, wy, 0x44ff44, this.gameTime);
  }

  private countWorkers(): number {
    let count = 0;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, WORKER | POSITION)) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (hpCurrent[eid] <= 0) continue;
      count++;
    }
    return count;
  }

  private getSelectedCombatUnits(): number[] {
    const units: number[] = [];
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] !== 1) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (!hasComponents(this.world, eid, POSITION | MOVEMENT)) continue;
      if (hasComponents(this.world, eid, BUILDING)) continue;
      if (hpCurrent[eid] <= 0) continue;
      units.push(eid);
    }
    return units;
  }

  private selectAllCombatUnits(): void {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      selected[eid] = 0;
    }
    let found = false;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, UNIT_TYPE | POSITION | SELECTABLE)) continue;
      if (hasComponents(this.world, eid, BUILDING)) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (hpCurrent[eid] <= 0) continue;
      const ut = unitType[eid] as UnitType;
      if (ut === UnitType.SCV || ut === UnitType.Drone) continue; // exclude workers
      selected[eid] = 1;
      if (!found) {
        this.viewport.moveCenter(posX[eid], posY[eid]);
        found = true;
      }
    }
  }

  private selectAllWorkers(): void {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      selected[eid] = 0;
    }
    let found = false;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, WORKER | POSITION | SELECTABLE)) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (hpCurrent[eid] <= 0) continue;
      selected[eid] = 1;
      if (!found) {
        this.viewport.moveCenter(posX[eid], posY[eid]);
        found = true;
      }
    }
  }

  private selectIdleWorkers(): void {
    // Clear selection, then select all idle player workers
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      selected[eid] = 0;
    }
    let found = false;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, WORKER | POSITION)) continue;
      if (faction[eid] !== this.playerFaction) continue;
      if (hpCurrent[eid] <= 0) continue;
      if (workerState[eid] !== 0) continue; // Only idle workers (WorkerState.Idle = 0)
      if (commandMode[eid] !== 0) continue; // CommandMode.Idle = 0
      selected[eid] = 1;
      if (!found) {
        // Jump camera to first idle worker
        this.viewport.moveCenter(posX[eid], posY[eid]);
        found = true;
      }
    }
  }

  private handleEdgeScroll(): void {
    // Suppress edge-scroll on touch when finger-dragging (would jump camera unintentionally)
    if (isTouchDevice && this.input.state.mouse.isDragging) return;
    const m = this.input.state.mouse;
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    const speed = EDGE_SCROLL_SPEED / this.viewport.scale.x;

    let dx = 0;
    let dy = 0;
    if (m.x <= EDGE_SCROLL_ZONE) dx = -speed;
    if (m.x >= sw - EDGE_SCROLL_ZONE) dx = speed;
    if (m.y <= EDGE_SCROLL_ZONE) dy = -speed;
    if (m.y >= sh - EDGE_SCROLL_ZONE) dy = speed;

    if (this.input.state.keys.has('ArrowLeft')) dx = -speed;
    if (this.input.state.keys.has('ArrowRight')) dx = speed;
    if (this.input.state.keys.has('ArrowUp')) dy = -speed;
    if (this.input.state.keys.has('ArrowDown')) dy = speed;

    if (dx !== 0 || dy !== 0) {
      this.viewport.moveCenter(
        this.viewport.center.x + dx,
        this.viewport.center.y + dy,
      );
    }
  }

  private spawnStartingBase(): void {
    // Spawn a completed Command Center for Terran at (15, 15)
    const ccEid = this.spawnBuilding(BuildingType.CommandCenter, Faction.Terran, 15, 15);
    buildState[ccEid] = BuildState.Complete;
    buildProgress[ccEid] = 1.0;
    hpCurrent[ccEid] = hpMax[ccEid];
    supplyProvided[ccEid] = BUILDING_DEFS[BuildingType.CommandCenter].supplyProvided;

    // LotV: 12 starting workers
    const ccPos = tileToWorld(15, 15);
    for (let i = 0; i < 12; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const sEid = this.spawnUnitAt(UnitType.SCV, Faction.Terran, ccPos.x + (col - 1.5) * TILE_SIZE, ccPos.y - TILE_SIZE * (2 + row));
      workerBaseX[sEid] = ccPos.x;
      workerBaseY[sEid] = ccPos.y;
    }
  }

  private spawnZergBase(col = 117, row = 117, spawnWorkers = false): void {
    const hatchEid = this.spawnBuilding(BuildingType.Hatchery, Faction.Zerg, col, row);
    buildState[hatchEid] = BuildState.Complete;
    buildProgress[hatchEid] = 1.0;
    hpCurrent[hatchEid] = hpMax[hatchEid];
    supplyProvided[hatchEid] = BUILDING_DEFS[BuildingType.Hatchery].supplyProvided;

    const poolEid = this.spawnBuilding(BuildingType.SpawningPool, Faction.Zerg, col - 3, row);
    buildState[poolEid] = BuildState.Complete;
    buildProgress[poolEid] = 1.0;
    hpCurrent[poolEid] = hpMax[poolEid];

    // LotV: 12 starting workers
    if (spawnWorkers) {
      const hatchPos = tileToWorld(col, row);
      for (let i = 0; i < 12; i++) {
        const c = i % 4;
        const r = Math.floor(i / 4);
        const dEid = this.spawnUnitAt(UnitType.Drone, Faction.Zerg, hatchPos.x + (c - 1.5) * TILE_SIZE, hatchPos.y - TILE_SIZE * (2 + r));
        workerBaseX[dEid] = hatchPos.x;
        workerBaseY[dEid] = hatchPos.y;
      }
    }
  }

  private spawnTerranAIBase(): void {
    // Mirror of spawnStartingBase but for Terran AI at bottom-right
    const ccPos = tileToWorld(112, 112);
    const ccEid = this.spawnBuilding(BuildingType.CommandCenter, Faction.Terran, 112, 112);
    buildState[ccEid] = BuildState.Complete;
    buildProgress[ccEid] = 1.0;
    hpCurrent[ccEid] = hpMax[ccEid];
    supplyProvided[ccEid] = BUILDING_DEFS[BuildingType.CommandCenter].supplyProvided;
    // Supply depot
    const sdEid = this.spawnBuilding(BuildingType.SupplyDepot, Faction.Terran, 117, 112);
    buildState[sdEid] = BuildState.Complete;
    buildProgress[sdEid] = 1.0;
    hpCurrent[sdEid] = hpMax[sdEid];
    // Barracks
    const bEid = this.spawnBuilding(BuildingType.Barracks, Faction.Terran, 112, 117);
    buildState[bEid] = BuildState.Complete;
    buildProgress[bEid] = 1.0;
    hpCurrent[bEid] = hpMax[bEid];
    // Spawn 4 Marines near the Barracks (starting army for AI)
    for (let i = 0; i < 4; i++) {
      this.spawnUnitAt(UnitType.Marine, Faction.Terran, ccPos.x + (i - 2) * TILE_SIZE, ccPos.y + TILE_SIZE * 3);
    }
    // LotV: 12 starting SCVs near the CC
    for (let i = 0; i < 12; i++) {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const sEid = this.spawnUnitAt(UnitType.SCV, Faction.Terran, ccPos.x + (col - 1.5) * TILE_SIZE, ccPos.y - TILE_SIZE * (2 + row));
      workerBaseX[sEid] = ccPos.x;
      workerBaseY[sEid] = ccPos.y;
    }
  }

  /** Send all idle workers of a given faction to mine the nearest mineral patch. */
  private sendWorkersToMine(fac: number): void {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, WORKER | POSITION)) continue;
      if (faction[eid] !== fac) continue;
      if (workerState[eid] !== WorkerState.Idle) continue;

      // Find nearest mineral patch
      let bestDist = Infinity;
      let bestMineral = -1;
      for (let rid = 1; rid < this.world.nextEid; rid++) {
        if (!hasComponents(this.world, rid, RESOURCE | POSITION)) continue;
        if (resourceType[rid] !== ResourceType.Mineral) continue;
        const dx = posX[rid] - posX[eid];
        const dy = posY[rid] - posY[eid];
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestMineral = rid;
        }
      }
      if (bestMineral < 0) continue;

      // Set worker to gather from this mineral
      workerState[eid] = WorkerState.MovingToResource;
      workerTargetEid[eid] = bestMineral;
      commandMode[eid] = CommandMode.Gather;

      // Path the worker to the mineral patch
      const resTile = worldToTile(posX[bestMineral], posY[bestMineral]);
      const walkable = findNearestWalkableTile(this.map, resTile.col, resTile.row);
      if (walkable) {
        const startTile = worldToTile(posX[eid], posY[eid]);
        const tilePath = findPath(this.map, startTile.col, startTile.row, walkable.col, walkable.row);
        if (tilePath.length > 0) {
          setPath(eid, tilePath.map(([c, r]) => {
            const wp = tileToWorld(c, r);
            return [wp.x, wp.y] as [number, number];
          }));
        }
      }
    }
  }

  private spawnResourceNodes(): void {
    const tiles = getResourceTiles(this.map);
    let mineralIdx = 0;
    for (const t of tiles) {
      const eid = addEntity(this.world);
      addResourceComponents(this.world, eid);

      const wp = tileToWorld(t.col, t.row);
      posX[eid] = wp.x;
      posY[eid] = wp.y;

      if (t.type === TileType.Minerals) {
        resourceType[eid] = ResourceType.Mineral;
        // SC2: 4 rich (1800) + 4 normal (1500) per base, repeating
        const amount = (mineralIdx % 8) < 4 ? MINERAL_PER_PATCH_RICH : MINERAL_PER_PATCH;
        mineralIdx++;
        resourceRemaining[eid] = amount;
        hpCurrent[eid] = amount;
        hpMax[eid] = amount;
        renderWidth[eid] = TILE_SIZE - 6;
        renderHeight[eid] = TILE_SIZE - 10;
        renderTint[eid] = MINERAL_COLOR;
      } else {
        resourceType[eid] = ResourceType.Gas;
        resourceRemaining[eid] = GAS_PER_GEYSER;
        hpCurrent[eid] = GAS_PER_GEYSER;
        hpMax[eid] = GAS_PER_GEYSER;
        renderWidth[eid] = TILE_SIZE - 4;
        renderHeight[eid] = TILE_SIZE - 4;
        renderTint[eid] = GAS_COLOR;
      }

      faction[eid] = Faction.None;
    }
  }

  private spawnDemoUnits(): void {
    // Terran units near starting CC
    const ccPos = tileToWorld(15, 15);
    const terranUnits = [
      { type: UnitType.Marine, col: 18, row: 14 },
      { type: UnitType.Marine, col: 19, row: 14 },
      { type: UnitType.Marine, col: 20, row: 14 },
      { type: UnitType.Marine, col: 18, row: 15 },
      { type: UnitType.Marine, col: 19, row: 15 },
      { type: UnitType.Marauder, col: 20, row: 15 },
      { type: UnitType.Marauder, col: 21, row: 15 },
      { type: UnitType.SiegeTank, col: 19, row: 17 },
      { type: UnitType.Medivac, col: 20, row: 13 },
      { type: UnitType.SCV, col: 12, row: 12 },
      { type: UnitType.SCV, col: 13, row: 12 },
    ];

    for (const u of terranUnits) {
      const eid = this.spawnUnit(u.type, Faction.Terran, u.col, u.row);
      // Workers get CC as base position
      if (u.type === UnitType.SCV) {
        workerBaseX[eid] = ccPos.x;
        workerBaseY[eid] = ccPos.y;
      }
    }

    // Zerg units are spawned by AISystem — no hardcoded demo units
  }

  spawnBuilding(type: BuildingType, fac: Faction, col: number, row: number): number {
    const def = BUILDING_DEFS[type];
    if (!def) throw new Error(`Unknown building type: ${type}`);

    const eid = addEntity(this.world);
    addBuildingComponents(this.world, eid);

    const wp = tileToWorld(col, row);
    posX[eid] = wp.x;
    posY[eid] = wp.y;

    hpCurrent[eid] = def.hp * 0.1; // starts at 10% HP
    hpMax[eid] = def.hp;

    buildingType[eid] = type;
    buildState[eid] = BuildState.UnderConstruction;
    buildProgress[eid] = 0;
    buildTimeTotal[eid] = def.buildTime;
    builderEid[eid] = -1;
    rallyX[eid] = -1;
    rallyY[eid] = -1;
    prodUnitType[eid] = 0;
    prodProgress[eid] = 0;
    prodTimeTotal[eid] = 0;
    supplyProvided[eid] = 0;
    supplyCost[eid] = 0;

    renderWidth[eid] = def.tileWidth * TILE_SIZE;
    renderHeight[eid] = def.tileHeight * TILE_SIZE;
    renderTint[eid] = def.color;

    faction[eid] = fac;

    // Zerg Hatchery/Lair/Hive start with full larva
    if (isHatchType(type)) {
      larvaCount[eid] = 3;
      larvaRegenTimer[eid] = 0;
    }

    // Gas buildings: store resource data on the building entity
    if (type === BuildingType.Refinery || type === BuildingType.Extractor) {
      resourceType[eid] = ResourceType.Gas;
      resourceRemaining[eid] = GAS_PER_GEYSER;
    }

    // Mark tiles as occupied
    markBuildingTiles(this.map, col, row, def.tileWidth, def.tileHeight);

    return eid;
  }

  private spawnUnit(type: UnitType, fac: Faction, col: number, row: number): number {
    const wp = tileToWorld(col, row);
    return this.spawnUnitAt(type, fac, wp.x, wp.y);
  }

  /** Spawn a unit at world coordinates — used by both demo setup and ProductionSystem */
  spawnUnitAt(type: number, fac: number, x: number, y: number): number {
    const def = UNIT_DEFS[type];
    if (!def) throw new Error(`Unknown unit type: ${type}`);

    const eid = addEntity(this.world);
    addUnitComponents(this.world, eid);

    posX[eid] = x;
    posY[eid] = y;

    hpCurrent[eid] = def.hp;
    hpMax[eid] = def.hp;
    moveSpeed[eid] = def.speed * TILE_SIZE;
    movePathIndex[eid] = -1;

    atkDamage[eid] = def.damage;
    atkRange[eid] = def.range * TILE_SIZE;
    atkCooldown[eid] = def.attackCooldown;
    atkSplash[eid] = def.splashRadius;
    atkLastTime[eid] = 0;
    // Multi-hit units: Reaper 4×2, Queen 4×2 (ground), Thor 6×4 (Javelin)
    if (type === UnitType.Reaper) atkHitCount[eid] = 2;
    else if (type === UnitType.Queen) atkHitCount[eid] = 2;
    else if (type === UnitType.Thor) atkHitCount[eid] = 4;
    else atkHitCount[eid] = 1;
    bonusDmg[eid] = def.bonusDamage;
    bonusVsTag[eid] = def.bonusVsTag;
    armorClass[eid] = def.armorClass;
    baseArmor[eid] = def.baseArmor;
    pendingDamage[eid] = 0;
    killCount[eid] = 0;
    targetEntity[eid] = -1;
    commandMode[eid] = 0;
    stimEndTime[eid] = 0;
    slowEndTime[eid] = 0;
    slowFactor[eid] = 0;
    siegeMode[eid] = 0;
    siegeTransitionEnd[eid] = 0;
    lastCombatTime[eid] = 0;
    supplyCost[eid] = def.supply;

    renderWidth[eid] = def.width;
    renderHeight[eid] = def.height;
    renderTint[eid] = def.color;

    faction[eid] = fac;
    unitType[eid] = def.type;
    isAir[eid] = def.isAir;
    canTargetGround[eid] = def.canTargetGround;
    canTargetAir[eid] = def.canTargetAir;
    cloaked[eid] = 0;
    veterancyLevel[eid] = 0;

    // Energy setup for caster units (SC2: casters spawn with 50 energy, Queen with 25)
    if (type === UnitType.Ghost) {
      energy[eid] = 50;
    }
    if (type === UnitType.Infestor) {
      energy[eid] = 50;
    }
    if (type === UnitType.Viper) {
      energy[eid] = 50;
    }
    if (type === UnitType.Queen) {
      energy[eid] = 25;
    }
    if (type === UnitType.Medivac) {
      cargoCapacity[eid] = 8;
    }

    // Overlord provides 8 supply when spawned
    if (type === UnitType.Overlord) {
      const res = this.resources[fac];
      if (res) res.supplyProvided += 8;
    }

    // Worker setup
    if (type === UnitType.SCV || type === UnitType.Drone) {
      addWorkerComponent(this.world, eid);
      workerBaseX[eid] = x;
      workerBaseY[eid] = y;
      workerTargetEid[eid] = -1;
      workerState[eid] = 0;
      workerCarrying[eid] = 0;
      workerMineTimer[eid] = 0;
    }

    // Track supply
    const res = this.resources[fac];
    if (res) {
      res.supplyUsed += def.supply;
    }

    // Apply already-researched stat buffs to newly spawned units
    if (res) {
      if (type === UnitType.Marine && res.upgrades[UpgradeType.CombatShield]) {
        hpMax[eid] += 10;
        hpCurrent[eid] += 10;
      }
      if (type === UnitType.Zergling && res.upgrades[UpgradeType.MetabolicBoost]) {
        moveSpeed[eid] += 0.87 * TILE_SIZE;
      }
      if (type === UnitType.Zergling && res.upgrades[UpgradeType.AdrenalGlands]) {
        atkCooldown[eid] = Math.round(atkCooldown[eid] * 0.82);
      }
      if (type === UnitType.Hydralisk && res.upgrades[UpgradeType.GroovedSpines]) {
        atkRange[eid] += 1 * TILE_SIZE;
      }
      if (type === UnitType.Hydralisk && res.upgrades[UpgradeType.MuscularAugments]) {
        moveSpeed[eid] += 0.5 * TILE_SIZE;
      }
    }

    return eid;
  }

  /** Handle production button click from info panel */
  private handleProductionButtonClick(buildingEid: number, uType: number): void {
    if (this.scenarioManager?.getScenario()?.setup.disableProduction) return;

    // Must be a completed building
    if (buildState[buildingEid] !== BuildState.Complete) return;

    // Check if queue is full (account for Reactor slot 2)
    const qLen = prodQueueLen[buildingEid];
    const hasReactor = addonType[buildingEid] === AddonType.Reactor;
    const slot1Active = prodUnitType[buildingEid] !== 0 ? 1 : 0;
    const slot2Active = hasReactor && prodSlot2UnitType[buildingEid] !== 0 ? 1 : 0;
    const totalQueued = slot1Active + slot2Active + qLen;
    if (totalQueued >= PROD_QUEUE_MAX) return;

    const fac = faction[buildingEid];
    const res = this.resources[fac];
    if (!res) return;

    const uDef = UNIT_DEFS[uType];
    if (!uDef) return;

    // Check resources
    if (res.minerals < uDef.costMinerals || res.gas < uDef.costGas) return;

    // Check supply
    if (uDef.supply > 0 && res.supplyUsed + uDef.supply > res.supplyProvided) return;

    // Deduct cost
    res.minerals -= uDef.costMinerals;
    res.gas -= uDef.costGas;

    // Check tech requirement
    const UNIT_TECH_REQS_MAP: Record<number, number | undefined> = {
      [UnitType.Ghost]:     BuildingType.GhostAcademy,
      [UnitType.Thor]:      BuildingType.Armory,
      [UnitType.Battlecruiser]: BuildingType.FusionCore,
      [UnitType.Zergling]:  BuildingType.SpawningPool,
      [UnitType.Queen]:     BuildingType.SpawningPool,
      [UnitType.Baneling]:  BuildingType.SpawningPool,
      [UnitType.Roach]:     BuildingType.RoachWarren,
      [UnitType.Ravager]:   BuildingType.RoachWarren,
      [UnitType.Hydralisk]: BuildingType.HydraliskDen,
      [UnitType.Lurker]:    BuildingType.HydraliskDen,
      [UnitType.Mutalisk]:  BuildingType.Spire,
      [UnitType.Corruptor]: BuildingType.Spire,
      [UnitType.Infestor]:  BuildingType.InfestationPit,
      [UnitType.Viper]:     BuildingType.InfestationPit,
      [UnitType.Ultralisk]: BuildingType.InfestationPit,
    };
    const techReq = UNIT_TECH_REQS_MAP[uType];
    if (techReq !== undefined && !hasCompletedBuilding(this.world, fac as Faction, techReq as BuildingType)) return;

    // TechLab gating: advanced units require TechLab addon on the producing building
    if (TECHLAB_UNITS.has(uType) && addonType[buildingEid] !== AddonType.TechLab) return;

    // Zerg Hatchery/Lair/Hive: consume larva when starting production
    if (isHatchType(buildingType[buildingEid])) {
      if (larvaCount[buildingEid] <= 0) return;
    }

    // If nothing is currently producing, start immediately
    if (prodUnitType[buildingEid] === 0) {
      // Consume larva for Zerg
      if (isHatchType(buildingType[buildingEid])) {
        larvaCount[buildingEid]--;
        if (larvaRegenTimer[buildingEid] <= 0 && larvaCount[buildingEid] < 3) {
          larvaRegenTimer[buildingEid] = 11; // LARVA_REGEN_TIME
        }
      }
      prodUnitType[buildingEid] = uType;
      prodProgress[buildingEid] = uDef.buildTime;
      prodTimeTotal[buildingEid] = uDef.buildTime;
    } else if (hasReactor && prodSlot2UnitType[buildingEid] === 0) {
      // Reactor slot 2: start in parallel slot
      prodSlot2UnitType[buildingEid] = uType;
      prodSlot2Progress[buildingEid] = uDef.buildTime;
      prodSlot2TimeTotal[buildingEid] = uDef.buildTime;
    } else {
      // Add to queue
      const qBase = buildingEid * PROD_QUEUE_MAX;
      prodQueue[qBase + qLen] = uType;
      prodQueueLen[buildingEid] = qLen + 1;

      // Zerg instant morph: consume larva and start timer immediately (all morphs run in parallel)
      if (isHatchType(buildingType[buildingEid])) {
        larvaCount[buildingEid]--;
        if (larvaRegenTimer[buildingEid] <= 0 && larvaCount[buildingEid] < 3) {
          larvaRegenTimer[buildingEid] = 11;
        }
        prodQueueProgress[qBase + qLen - 1] = uDef.buildTime;
        prodQueueTimeTotal[qBase + qLen - 1] = uDef.buildTime;
      }
    }
  }

  destroy(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
    this.input?.destroy();
    this.app?.ticker.stop();
  }
}
