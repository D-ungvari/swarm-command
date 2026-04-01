import { Application, Container, Graphics } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  MAP_WIDTH, MAP_HEIGHT, TILE_SIZE,
  EDGE_SCROLL_ZONE, EDGE_SCROLL_SPEED,
  MIN_ZOOM, MAX_ZOOM,
  MS_PER_TICK, Faction, UnitType, ResourceType, BuildingType, BuildState,
  MINERAL_PER_PATCH, GAS_PER_GEYSER, MINERAL_COLOR, GAS_COLOR, BUILDING_COLOR,
  STARTING_MINERALS, STARTING_GAS, STARTING_SUPPLY, SUPPLY_PER_UNIT,
  TileType, CommandMode, WorkerState, ArmorClass,
  Difficulty,
} from './constants';
import { createWorld, addEntity, hasComponents, type World } from './ecs/world';
import {
  addUnitComponents, addWorkerComponent, addResourceComponents, addBuildingComponents,
  POSITION, WORKER, MOVEMENT, BUILDING, UNIT_TYPE, SELECTABLE,
  posX, posY,
  moveSpeed, renderWidth, renderHeight, renderTint,
  hpCurrent, hpMax, faction, unitType,
  atkDamage, atkRange, atkCooldown, atkLastTime, movePathIndex,
  atkDamageType, armorClass, baseArmor, pendingDamage, killCount,
  targetEntity, commandMode,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd, lastCombatTime,
  workerState, workerCarrying, workerTargetEid, workerMineTimer,
  workerBaseX, workerBaseY,
  resourceType, resourceRemaining,
  buildingType, buildState, buildProgress, buildTimeTotal, builderEid,
  rallyX, rallyY, prodUnitType, prodProgress, prodTimeTotal,
  prodQueue, prodQueueLen, PROD_QUEUE_MAX,
  supplyProvided, supplyCost,
  selected, setPath,
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
import { UnitRenderer, addCommandPing } from './rendering/UnitRenderer';
import { SelectionRenderer } from './rendering/SelectionRenderer';
import { HudRenderer } from './rendering/HudRenderer';
import { BuildMenuRenderer } from './rendering/BuildMenuRenderer';
import { InfoPanelRenderer } from './rendering/InfoPanelRenderer';
import { ModeIndicatorRenderer } from './rendering/ModeIndicatorRenderer';
import { HotkeyPanelRenderer } from './rendering/HotkeyPanelRenderer';
import { MinimapRenderer } from './rendering/MinimapRenderer';
import { GameOverRenderer } from './rendering/GameOverRenderer';
import { AlertRenderer } from './rendering/AlertRenderer';
import { movementSystem } from './systems/MovementSystem';
import { spatialHash } from './ecs/SpatialHash';
import { selectionSystem } from './systems/SelectionSystem';
import { commandSystem } from './systems/CommandSystem';
import { GameCommandQueue } from './input/CommandQueue';
import { InputProcessor } from './input/InputProcessor';
import { buildSystem } from './systems/BuildSystem';
import { productionSystem } from './systems/ProductionSystem';
import { combatSystem, getLastTerranHit, damageEvents } from './systems/CombatSystem';
import { abilitySystem } from './systems/AbilitySystem';
import { gatherSystem } from './systems/GatherSystem';
import { deathSystem } from './systems/DeathSystem';
import { aiSystem, initAI, getAIState } from './systems/AISystem';
import { creepSystem, resetCreepSystem } from './systems/CreepSystem';
import { upgradeSystem } from './systems/UpgradeSystem';
import { fogSystem } from './systems/FogSystem';
import { FogRenderer } from './rendering/FogRenderer';
import { WaypointRenderer } from './rendering/WaypointRenderer';
import { ProjectileRenderer } from './rendering/ProjectileRenderer';
import type { PlayerResources } from './types';
import { soundManager } from './audio/SoundManager';
import { GameStats } from './stats/GameStats';

export class Game {
  app!: Application;
  viewport!: Viewport;
  world: World;
  map: MapData;
  input!: InputManager;

  // Per-player resource state
  resources: Record<number, PlayerResources> = {
    [Faction.Terran]: { minerals: STARTING_MINERALS, gas: STARTING_GAS, supplyUsed: 0, supplyProvided: STARTING_SUPPLY, upgrades: new Uint8Array(6) },
    [Faction.Zerg]: { minerals: 0, gas: 0, supplyUsed: 0, supplyProvided: 200, upgrades: new Uint8Array(6) }, // Cheating AI: unlimited supply
  };

  // Building placement state
  placementMode = false;
  placementBuildingType: number = 0;

  // Renderers
  private tilemapRenderer!: TilemapRenderer;
  private unitRenderer!: UnitRenderer;
  private selectionRenderer!: SelectionRenderer;
  private hudRenderer!: HudRenderer;
  private buildMenuRenderer!: BuildMenuRenderer;
  private infoPanelRenderer!: InfoPanelRenderer;
  private modeIndicatorRenderer!: ModeIndicatorRenderer;
  private hotkeyPanelRenderer!: HotkeyPanelRenderer;
  private minimapRenderer!: MinimapRenderer;
  private fogRenderer!: FogRenderer;
  private waypointRenderer!: WaypointRenderer;
  private projRenderer!: ProjectileRenderer;
  private gameOverRenderer!: GameOverRenderer;
  private alertRenderer!: AlertRenderer;
  private difficulty: Difficulty = Difficulty.Normal;
  private mapType: MapType = 0 as MapType; // MapType.Plains = 0
  private lastAIAttacking = false;
  private lastUnderAttackAlert = 0;
  private selectionQueue!: GameCommandQueue;
  private simulationQueue!: GameCommandQueue;
  private inputProcessor!: InputProcessor;
  private ghostGraphics!: Graphics;

  // Fixed timestep accumulator
  private accumulator = 0;
  private lastTime = 0;
  private gameTime = 0;

  // Stats tracking
  private stats = new GameStats();
  private lastWaveCount = 0;
  private gameEnded = false;

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

  async init(container: HTMLElement): Promise<void> {
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
      .drag({ mouseButtons: 'middle' })
      .pinch()
      .wheel()
      .clampZoom({ minScale: MIN_ZOOM, maxScale: MAX_ZOOM })
      .clamp({ direction: 'all' });

    const startPos = tileToWorld(15, 15);
    this.viewport.moveCenter(startPos.x, startPos.y);

    this.input = new InputManager(this.app.canvas as HTMLCanvasElement);

    this.selectionQueue = new GameCommandQueue();
    this.simulationQueue = new GameCommandQueue();
    this.inputProcessor = new InputProcessor(
      this.input,
      this.selectionQueue,
      this.simulationQueue,
      this.viewport,
      this.world,
    );

    this.tilemapRenderer = new TilemapRenderer();
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
    this.buildMenuRenderer = new BuildMenuRenderer(container);
    this.infoPanelRenderer = new InfoPanelRenderer(container);
    this.modeIndicatorRenderer = new ModeIndicatorRenderer(container);
    this.hotkeyPanelRenderer = new HotkeyPanelRenderer(container);

    this.gameOverRenderer = new GameOverRenderer(container);
    this.alertRenderer = new AlertRenderer(container);

    // Wire up production button callback
    this.infoPanelRenderer.setProductionCallback((buildingEid, uType) => {
      this.handleProductionButtonClick(buildingEid, uType);
    });

    // Generate map with selected layout (setMapType is called before init)
    this.map = generateMap(this.mapType);

    // Minimap (screen space, bottom-right corner)
    this.minimapRenderer = new MinimapRenderer(this.app.stage, this.viewport, this.map);

    this.tilemapRenderer.render(this.map);

    this.spawnResourceNodes();
    this.spawnStartingBase();
    this.spawnZergBase();
    this.spawnDemoUnits();
    spawnRockEntities(this.world, this.map);
    initAI(this.difficulty);
    resetCreepSystem();

    window.addEventListener('resize', () => {
      this.viewport.resize(window.innerWidth, window.innerHeight);
      this.minimapRenderer.resize(window.innerWidth, window.innerHeight);
    });

    this.lastTime = performance.now();
    this.app.ticker.add(() => this.loop());
  }

  private loop(): void {
    const now = performance.now();
    const frameTime = Math.min(now - this.lastTime, 100);
    this.lastTime = now;
    this.accumulator += frameTime;

    this.input.update();
    this.handleMinimapClick();         // runs first — consumes minimap clicks
    this.handleEdgeScroll();
    this.handleBuildPlacement();       // runs second — consumes build placement clicks
    this.inputProcessor.processFrame(); // processes remaining raw events into queues
    this.applySelectionCommands();     // frame-rate: drain selectionQueue immediately

    while (this.accumulator >= MS_PER_TICK) {
      this.tick(MS_PER_TICK / 1000);
      this.accumulator -= MS_PER_TICK;
      // No manual flag clearing needed — InputProcessor already consumed raw events
    }

    this.render();
    this.input.lateUpdate();
  }

  /** Drain selectionQueue and apply selection changes immediately (frame-rate). */
  private applySelectionCommands(): void {
    const cmds = this.selectionQueue.flush();
    if (cmds.length > 0) {
      this.stats.recordAction();
      selectionSystem(this.world, cmds, this.viewport);
    }
  }

  private tick(dt: number): void {
    this.gameTime += dt;

    // Rebuild spatial hash once per tick — must run before any system that queries it
    spatialHash.rebuild(this.world);

    // APM: count simulation commands issued this tick
    if (this.simulationQueue.length > 0) {
      this.stats.recordAction();
    }
    commandSystem(this.world, this.simulationQueue.flush(), this.viewport, this.map, this.gameTime, this.resources);
    buildSystem(this.world, dt, this.resources);
    productionSystem(this.world, dt, this.resources, this.map,
      (type, fac, x, y) => {
        const eid = this.spawnUnitAt(type, fac, x, y);
        if (fac === Faction.Terran) this.stats.recordUnitProduced();
        return eid;
      });
    upgradeSystem(this.world, dt, this.resources);
    movementSystem(this.world, dt, this.map);

    // Snapshot resources before gather to calculate income delta
    const res = this.resources[Faction.Terran];
    const resBefore = res.minerals + res.gas;
    combatSystem(this.world, dt, this.gameTime, this.map, this.resources);
    abilitySystem(this.world, dt, this.gameTime);
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

    deathSystem(this.world, this.gameTime, this.map, this.resources);
    aiSystem(this.world, dt, this.gameTime, this.map,
      (type, fac, x, y) => this.spawnUnitAt(type, fac, x, y), this.resources);
    fogSystem(this.world);
    creepSystem(this.world, this.map, dt);

    // Track waves defeated
    const aiState = getAIState();
    if (aiState.waveCount > this.lastWaveCount) {
      const newWaves = aiState.waveCount - this.lastWaveCount;
      for (let i = 0; i < newWaves; i++) this.stats.recordWaveDefeated();
      this.lastWaveCount = aiState.waveCount;
    }
  }

  private render(): void {
    this.tilemapRenderer.updateWater(this.gameTime);
    this.tilemapRenderer.updateCreep(this.map, this.gameTime);
    this.unitRenderer.render(this.world, this.gameTime);
    this.projRenderer.update(this.gameTime);
    this.projRenderer.render(this.gameTime);
    this.waypointRenderer.render(this.world, this.input.state.shiftHeld);
    this.selectionRenderer.render(this.input.state, this.gameTime);
    this.renderGhost();
    this.fogRenderer.render();
    const res = this.resources[Faction.Terran];
    const workerCount = this.countWorkers();
    this.hudRenderer.update(res.minerals, res.gas, res.supplyUsed, res.supplyProvided, this.gameTime, workerCount, res.upgrades, this.stats.getCurrentAPM(this.gameTime));
    this.buildMenuRenderer.update(this.placementMode, res.minerals, res.gas, this.placementBuildingType, this.getTechAvailability());
    this.infoPanelRenderer.update(this.world, this.gameTime, res);
    this.modeIndicatorRenderer.update(this.inputProcessor.isAttackMovePending, this.placementMode);
    this.hotkeyPanelRenderer.update(this.input.state.keysJustPressed);
    this.minimapRenderer.render(this.world);

    const wasShown = this.gameOverRenderer.isShown;
    this.gameOverRenderer.update(this.world, this.gameTime);
    if (!wasShown && this.gameOverRenderer.isShown && !this.gameEnded) {
      this.gameEnded = true;
      this.gameOverRenderer.setStats(this.stats.getSnapshot(this.gameTime));
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
    }

    // Spacebar = jump camera to base
    if (this.input.state.keysJustPressed.has('Space') && !this.placementMode) {
      const ccPos = tileToWorld(15, 15);
      this.viewport.moveCenter(ccPos.x, ccPos.y);
    }

    // F2 = select all combat units, F3 = select all workers
    if (this.input.state.keysJustPressed.has('F2')) {
      this.selectAllCombatUnits();
    }
    if (this.input.state.keysJustPressed.has('F3')) {
      this.selectAllWorkers();
    }
    this.alertRenderer.update(this.gameTime);

    // Cursor change based on current mode
    if (this.placementMode) {
      document.body.style.cursor = 'cell';
    } else if (this.inputProcessor.isAttackMovePending) {
      document.body.style.cursor = 'crosshair';
    } else {
      document.body.style.cursor = 'default';
    }
  }

  /** Check if tech prerequisite is met for a building type */
  private isTechAvailable(bType: BuildingType): boolean {
    const def = BUILDING_DEFS[bType];
    if (!def || def.requires === null) return true;
    return hasCompletedBuilding(this.world, Faction.Terran, def.requires);
  }

  /** Get tech availability for all 7 build menu entries */
  private getTechAvailability(): boolean[] {
    return [
      this.isTechAvailable(BuildingType.CommandCenter),
      this.isTechAvailable(BuildingType.SupplyDepot),
      this.isTechAvailable(BuildingType.Barracks),
      this.isTechAvailable(BuildingType.Refinery),
      this.isTechAvailable(BuildingType.Factory),
      this.isTechAvailable(BuildingType.Starport),
      this.isTechAvailable(BuildingType.EngineeringBay),
    ];
  }

  private handleBuildPlacement(): void {
    const input = this.input.state;

    // B key opens build mode
    if (input.keysJustPressed.has('KeyB') && !this.placementMode) {
      this.placementMode = true;
      this.placementBuildingType = 0; // Wait for 1/2/3/4/5/6
      return;
    }

    if (this.placementMode) {
      // Select building type (with tech tree check)
      if (input.keysJustPressed.has('Digit1') && this.isTechAvailable(BuildingType.CommandCenter)) {
        this.placementBuildingType = BuildingType.CommandCenter;
      } else if (input.keysJustPressed.has('Digit2') && this.isTechAvailable(BuildingType.SupplyDepot)) {
        this.placementBuildingType = BuildingType.SupplyDepot;
      } else if (input.keysJustPressed.has('Digit3') && this.isTechAvailable(BuildingType.Barracks)) {
        this.placementBuildingType = BuildingType.Barracks;
      } else if (input.keysJustPressed.has('Digit4') && this.isTechAvailable(BuildingType.Refinery)) {
        this.placementBuildingType = BuildingType.Refinery;
      } else if (input.keysJustPressed.has('Digit5') && this.isTechAvailable(BuildingType.Factory)) {
        this.placementBuildingType = BuildingType.Factory;
      } else if (input.keysJustPressed.has('Digit6') && this.isTechAvailable(BuildingType.Starport)) {
        this.placementBuildingType = BuildingType.Starport;
      } else if (input.keysJustPressed.has('Digit7') && this.isTechAvailable(BuildingType.EngineeringBay)) {
        this.placementBuildingType = BuildingType.EngineeringBay;
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
        const tile = worldToTile(worldPos.x, worldPos.y);

        // Placement validation: Refinery needs gas geyser, others need normal buildable
        const isRefinery = this.placementBuildingType === BuildingType.Refinery;
        const valid = isRefinery
          ? isGeyserTile(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight)
          : isBuildable(this.map, tile.col, tile.row, def.tileWidth, def.tileHeight);

        if (valid) {
          const res = this.resources[Faction.Terran];
          if (res.minerals >= def.costMinerals && res.gas >= def.costGas) {
            res.minerals -= def.costMinerals;
            res.gas -= def.costGas;

            const bEid = this.spawnBuilding(this.placementBuildingType as BuildingType, Faction.Terran, tile.col, tile.row);
            soundManager.playBuild();

            // For Refinery, store gas resource data on the building entity
            if (isRefinery) {
              resourceType[bEid] = ResourceType.Gas;
              resourceRemaining[bEid] = GAS_PER_GEYSER;
            }

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
      if (faction[eid] !== Faction.Terran) continue;
      if (hpCurrent[eid] <= 0) continue;

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
    const isRefinery = this.placementBuildingType === BuildingType.Refinery;
    const valid = isRefinery
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

    // Right-click minimap — issue move command to that world position
    if (m.rightJustPressed) {
      const dest = this.minimapRenderer.handleRightClick(m.x, m.y);
      if (dest) {
        // Issue move command to selected units at the minimap world position
        // Fake a right-click at that world position by temporarily overriding
        // We import issuePathCommand indirectly — instead, just set the world pos
        // and let CommandSystem handle it. But CommandSystem converts screen→world.
        // Simpler: directly set paths for selected units here.
        this.moveSelectedUnitsTo(dest.x, dest.y);
        m.rightJustPressed = false; // Consume so CommandSystem doesn't also process
        this.input.consumeLastEvent('rightdown');
      }
    }
  }

  private moveSelectedUnitsTo(wx: number, wy: number): void {
    const units: number[] = [];
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] !== 1) continue;
      if (faction[eid] !== Faction.Terran) continue;
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
      if (faction[eid] !== Faction.Terran) continue;
      if (hpCurrent[eid] <= 0) continue;
      count++;
    }
    return count;
  }

  private selectAllCombatUnits(): void {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      selected[eid] = 0;
    }
    let found = false;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, UNIT_TYPE | POSITION | SELECTABLE)) continue;
      if (hasComponents(this.world, eid, BUILDING)) continue;
      if (faction[eid] !== Faction.Terran) continue;
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
      if (faction[eid] !== Faction.Terran) continue;
      if (hpCurrent[eid] <= 0) continue;
      selected[eid] = 1;
      if (!found) {
        this.viewport.moveCenter(posX[eid], posY[eid]);
        found = true;
      }
    }
  }

  private selectIdleWorkers(): void {
    // Clear selection, then select all idle Terran workers
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      selected[eid] = 0;
    }
    let found = false;
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (!hasComponents(this.world, eid, WORKER | POSITION)) continue;
      if (faction[eid] !== Faction.Terran) continue;
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
    // Starting supply already set in resources init
  }

  private spawnZergBase(): void {
    // Spawn a completed Hatchery at AI spawn location
    const hatchEid = this.spawnBuilding(BuildingType.Hatchery, Faction.Zerg, 117, 117);
    buildState[hatchEid] = BuildState.Complete;
    buildProgress[hatchEid] = 1.0;
    hpCurrent[hatchEid] = hpMax[hatchEid];
    supplyProvided[hatchEid] = BUILDING_DEFS[BuildingType.Hatchery].supplyProvided;

    // Spawn a completed Spawning Pool nearby
    const poolEid = this.spawnBuilding(BuildingType.SpawningPool, Faction.Zerg, 114, 117);
    buildState[poolEid] = BuildState.Complete;
    buildProgress[poolEid] = 1.0;
    hpCurrent[poolEid] = hpMax[poolEid];
  }

  private spawnResourceNodes(): void {
    const tiles = getResourceTiles(this.map);
    for (const t of tiles) {
      const eid = addEntity(this.world);
      addResourceComponents(this.world, eid);

      const wp = tileToWorld(t.col, t.row);
      posX[eid] = wp.x;
      posY[eid] = wp.y;

      if (t.type === TileType.Minerals) {
        resourceType[eid] = ResourceType.Mineral;
        resourceRemaining[eid] = MINERAL_PER_PATCH;
        hpCurrent[eid] = MINERAL_PER_PATCH;
        hpMax[eid] = MINERAL_PER_PATCH;
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
    atkLastTime[eid] = 0;
    atkDamageType[eid] = def.damageType;
    armorClass[eid] = def.armorClass;
    baseArmor[eid] = def.armorClass === ArmorClass.Armored ? 1 : 0;
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
    supplyCost[eid] = SUPPLY_PER_UNIT;

    renderWidth[eid] = def.width;
    renderHeight[eid] = def.height;
    renderTint[eid] = def.color;

    faction[eid] = fac;
    unitType[eid] = def.type;

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
      res.supplyUsed += SUPPLY_PER_UNIT;
    }

    return eid;
  }

  /** Handle production button click from info panel */
  private handleProductionButtonClick(buildingEid: number, uType: number): void {
    // Must be a completed building
    if (buildState[buildingEid] !== BuildState.Complete) return;

    // Check if queue is full
    const qLen = prodQueueLen[buildingEid];
    const totalQueued = (prodUnitType[buildingEid] !== 0 ? 1 : 0) + qLen;
    if (totalQueued >= PROD_QUEUE_MAX) return;

    const fac = faction[buildingEid];
    const res = this.resources[fac];
    if (!res) return;

    const uDef = UNIT_DEFS[uType];
    if (!uDef) return;

    // Check resources
    if (res.minerals < uDef.costMinerals || res.gas < uDef.costGas) return;

    // Check supply
    if (res.supplyUsed >= res.supplyProvided) return;

    // Deduct cost
    res.minerals -= uDef.costMinerals;
    res.gas -= uDef.costGas;

    // If nothing is currently producing, start immediately
    if (prodUnitType[buildingEid] === 0) {
      prodUnitType[buildingEid] = uType;
      prodProgress[buildingEid] = uDef.buildTime;
      prodTimeTotal[buildingEid] = uDef.buildTime;
    } else {
      // Add to queue
      const qBase = buildingEid * PROD_QUEUE_MAX;
      prodQueue[qBase + qLen] = uType;
      prodQueueLen[buildingEid] = qLen + 1;
    }
  }
}
