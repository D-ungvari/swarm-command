import { Application, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import {
  MAP_WIDTH, MAP_HEIGHT, TILE_SIZE,
  EDGE_SCROLL_ZONE, EDGE_SCROLL_SPEED,
  MIN_ZOOM, MAX_ZOOM,
  MS_PER_TICK, Faction, UnitType,
} from './constants';
import { createWorld, addEntity, type World } from './ecs/world';
import {
  addUnitComponents, posX, posY,
  moveSpeed, renderWidth, renderHeight, renderTint,
  hpCurrent, hpMax, faction, unitType,
  atkDamage, atkRange, atkCooldown, atkLastTime, movePathIndex,
  targetEntity, commandMode,
  stimEndTime, slowEndTime, slowFactor,
  siegeMode, siegeTransitionEnd, lastCombatTime,
} from './ecs/components';
import { UNIT_DEFS } from './data/units';
import { generateMap, tileToWorld, type MapData } from './map/MapData';
import { InputManager } from './input/InputManager';
import { TilemapRenderer } from './rendering/TilemapRenderer';
import { UnitRenderer } from './rendering/UnitRenderer';
import { SelectionRenderer } from './rendering/SelectionRenderer';
import { movementSystem } from './systems/MovementSystem';
import { selectionSystem } from './systems/SelectionSystem';
import { commandSystem } from './systems/CommandSystem';
import { combatSystem } from './systems/CombatSystem';
import { abilitySystem } from './systems/AbilitySystem';
import { deathSystem } from './systems/DeathSystem';

export class Game {
  app!: Application;
  viewport!: Viewport;
  world: World;
  map: MapData;
  input!: InputManager;

  // Renderers
  private tilemapRenderer!: TilemapRenderer;
  private unitRenderer!: UnitRenderer;
  private selectionRenderer!: SelectionRenderer;

  // Fixed timestep accumulator
  private accumulator = 0;
  private lastTime = 0;
  private gameTime = 0;

  constructor() {
    this.world = createWorld();
    this.map = generateMap();
  }

  async init(container: HTMLElement): Promise<void> {
    // Create PixiJS app
    this.app = new Application();
    await this.app.init({
      background: 0x0a0a0a,
      resizeTo: window,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    container.appendChild(this.app.canvas as HTMLCanvasElement);

    // Create viewport (camera)
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

    // Start camera near player 1 base
    const startPos = tileToWorld(15, 15);
    this.viewport.moveCenter(startPos.x, startPos.y);

    // Input
    this.input = new InputManager(this.app.canvas as HTMLCanvasElement);

    // Renderers
    this.tilemapRenderer = new TilemapRenderer();
    this.viewport.addChild(this.tilemapRenderer.container);

    this.unitRenderer = new UnitRenderer();
    this.viewport.addChild(this.unitRenderer.container);

    // Selection box renders in screen space (above viewport)
    this.selectionRenderer = new SelectionRenderer();
    this.app.stage.addChild(this.selectionRenderer.container);

    // Render the tilemap once
    this.tilemapRenderer.render(this.map);

    // Spawn demo units
    this.spawnDemoUnits();

    // Handle resize
    window.addEventListener('resize', () => {
      this.viewport.resize(window.innerWidth, window.innerHeight);
    });

    // Start game loop
    this.lastTime = performance.now();
    this.app.ticker.add(() => this.loop());
  }

  private loop(): void {
    const now = performance.now();
    const frameTime = Math.min(now - this.lastTime, 100); // cap to avoid spiral of death
    this.lastTime = now;
    this.accumulator += frameTime;

    // Snapshot input once per frame
    this.input.update();

    // Edge scrolling
    this.handleEdgeScroll();

    // Fixed timestep game logic
    while (this.accumulator >= MS_PER_TICK) {
      this.tick(MS_PER_TICK / 1000); // dt in seconds
      this.accumulator -= MS_PER_TICK;
    }

    // Render (runs every frame, not tied to tick rate)
    this.render();

    this.input.lateUpdate();
  }

  private tick(dt: number): void {
    this.gameTime += dt;
    selectionSystem(this.world, this.input.state, this.viewport);
    commandSystem(this.world, this.input.state, this.viewport, this.map, this.gameTime);
    movementSystem(this.world, dt);
    combatSystem(this.world, dt, this.gameTime, this.map);
    abilitySystem(this.world, dt, this.gameTime);
    deathSystem(this.world, this.gameTime);
  }

  private render(): void {
    this.unitRenderer.render(this.world, this.gameTime);
    this.selectionRenderer.render(this.input.state);
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

    // Arrow keys
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

  /** Spawn some test units for Phase 1 demo */
  private spawnDemoUnits(): void {
    // Terran squad near top-left base
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
      this.spawnUnit(u.type, Faction.Terran, u.col, u.row);
    }

    // Zerg swarm near bottom-right base
    const zergUnits = [
      { type: UnitType.Zergling, col: 115, row: 115 },
      { type: UnitType.Zergling, col: 116, row: 115 },
      { type: UnitType.Zergling, col: 117, row: 115 },
      { type: UnitType.Zergling, col: 115, row: 116 },
      { type: UnitType.Zergling, col: 116, row: 116 },
      { type: UnitType.Zergling, col: 117, row: 116 },
      { type: UnitType.Hydralisk, col: 116, row: 117 },
      { type: UnitType.Hydralisk, col: 117, row: 117 },
      { type: UnitType.Roach, col: 115, row: 118 },
      { type: UnitType.Baneling, col: 118, row: 116 },
      { type: UnitType.Drone, col: 118, row: 118 },
      { type: UnitType.Drone, col: 119, row: 118 },
    ];

    for (const u of zergUnits) {
      this.spawnUnit(u.type, Faction.Zerg, u.col, u.row);
    }
  }

  private spawnUnit(type: UnitType, fac: Faction, col: number, row: number): number {
    const def = UNIT_DEFS[type];
    if (!def) throw new Error(`Unknown unit type: ${type}`);

    const eid = addEntity(this.world);
    addUnitComponents(this.world, eid);

    const wp = tileToWorld(col, row);
    posX[eid] = wp.x;
    posY[eid] = wp.y;

    hpCurrent[eid] = def.hp;
    hpMax[eid] = def.hp;
    moveSpeed[eid] = def.speed * TILE_SIZE; // convert tile-speed to px/s
    movePathIndex[eid] = -1;

    atkDamage[eid] = def.damage;
    atkRange[eid] = def.range * TILE_SIZE;
    atkCooldown[eid] = def.attackCooldown;
    atkLastTime[eid] = 0;
    targetEntity[eid] = -1;
    commandMode[eid] = 0;
    stimEndTime[eid] = 0;
    slowEndTime[eid] = 0;
    slowFactor[eid] = 0;
    siegeMode[eid] = 0;
    siegeTransitionEnd[eid] = 0;
    lastCombatTime[eid] = 0;

    renderWidth[eid] = def.width;
    renderHeight[eid] = def.height;
    renderTint[eid] = def.color;

    faction[eid] = fac;
    unitType[eid] = def.type;

    return eid;
  }
}
