import { type World, hasComponents } from '../ecs/world';
import { selected, faction, BUILDING, unitType } from '../ecs/components';
import { InputManager, type InputState } from './InputManager';
import { CommandType, type GameCommand, GameCommandQueue } from './CommandQueue';
import { Faction, UnitType } from '../constants';
import type { Viewport } from 'pixi-viewport';

export class InputProcessor {
  private attackMovePending = false;
  private patrolPending = false;
  private corrosiveBilePending = false;
  private fungalPending = false;
  private snipePending = false;
  private yamatoPending = false;
  private abductPending = false;
  private transfusePending = false;
  private lockOnPending = false;
  private causticSprayPending = false;
  private blindingCloudPending = false;
  private parasiticBombPending = false;
  private empPending = false;
  private kd8ChargePending = false;
  private neuralParasitePending = false;
  private tacticalJumpPending = false;
  private lastRecalledGroup = -1;
  private lastRecalledTime = 0;
  private pendingDoubleClick = false;

  constructor(
    private input: InputManager,
    public readonly selectionQueue: GameCommandQueue,
    public readonly simulationQueue: GameCommandQueue,
    private viewport: Viewport,
    private world: World,
    private playerFaction: Faction = Faction.Terran,
  ) {}

  setPlayerFaction(f: Faction): void { this.playerFaction = f; }

  get isAttackMovePending(): boolean {
    return this.attackMovePending;
  }

  get isPatrolPending(): boolean {
    return this.patrolPending;
  }

  get isCorrosiveBilePending(): boolean {
    return this.corrosiveBilePending;
  }

  get isFungalPending(): boolean {
    return this.fungalPending;
  }

  get isSnipePending(): boolean { return this.snipePending; }
  get isYamatoPending(): boolean { return this.yamatoPending; }
  get isAbductPending(): boolean { return this.abductPending; }
  get isTransfusePending(): boolean { return this.transfusePending; }
  get isLockOnPending(): boolean { return this.lockOnPending; }
  get isCausticSprayPending(): boolean { return this.causticSprayPending; }
  get isBlindingCloudPending(): boolean { return this.blindingCloudPending; }
  get isParasiticBombPending(): boolean { return this.parasiticBombPending; }
  get isEmpPending(): boolean { return this.empPending; }
  get isKD8ChargePending(): boolean { return this.kd8ChargePending; }
  get isNeuralParasitePending(): boolean { return this.neuralParasitePending; }
  get isTacticalJumpPending(): boolean { return this.tacticalJumpPending; }

  /** True if any ability targeting mode is active */
  get isAnyAbilityPending(): boolean {
    return this.corrosiveBilePending || this.fungalPending ||
      this.snipePending || this.yamatoPending || this.abductPending || this.transfusePending ||
      this.lockOnPending || this.causticSprayPending ||
      this.blindingCloudPending || this.parasiticBombPending || this.empPending ||
      this.kd8ChargePending || this.neuralParasitePending || this.tacticalJumpPending;
  }

  /** Allow external UI (TouchCommandBar) to set attack-move mode */
  setAttackMovePending(v: boolean): void {
    this.attackMovePending = v;
  }

  /** Allow external UI (TouchCommandBar) to set patrol mode */
  setPatrolPending(v: boolean): void {
    this.patrolPending = v;
  }

  /** Allow external UI (TouchCommandBar) to set corrosive bile mode */
  setCorrosiveBilePending(v: boolean): void {
    this.corrosiveBilePending = v;
  }

  /** Allow external UI (TouchCommandBar) to set fungal growth mode */
  setFungalPending(v: boolean): void {
    this.fungalPending = v;
  }

  setSnipePending(v: boolean): void { this.cancelAllPending(); this.snipePending = v; }
  setYamatoPending(v: boolean): void { this.cancelAllPending(); this.yamatoPending = v; }
  setAbductPending(v: boolean): void { this.cancelAllPending(); this.abductPending = v; }
  setTransfusePending(v: boolean): void { this.cancelAllPending(); this.transfusePending = v; }
  setLockOnPending(v: boolean): void { this.cancelAllPending(); this.lockOnPending = v; }
  setCausticSprayPending(v: boolean): void { this.cancelAllPending(); this.causticSprayPending = v; }
  setBlindingCloudPending(v: boolean): void { this.cancelAllPending(); this.blindingCloudPending = v; }
  setParasiticBombPending(v: boolean): void { this.cancelAllPending(); this.parasiticBombPending = v; }
  setEmpPending(v: boolean): void { this.cancelAllPending(); this.empPending = v; }
  setKD8ChargePending(v: boolean): void { this.cancelAllPending(); this.kd8ChargePending = v; }
  setNeuralParasitePending(v: boolean): void { this.cancelAllPending(); this.neuralParasitePending = v; }
  setTacticalJumpPending(v: boolean): void { this.cancelAllPending(); this.tacticalJumpPending = v; }

  /** Cancel all pending ability modes */
  cancelAllPending(): void {
    this.attackMovePending = false;
    this.patrolPending = false;
    this.corrosiveBilePending = false;
    this.fungalPending = false;
    this.snipePending = false;
    this.yamatoPending = false;
    this.abductPending = false;
    this.transfusePending = false;
    this.lockOnPending = false;
    this.causticSprayPending = false;
    this.blindingCloudPending = false;
    this.parasiticBombPending = false;
    this.empPending = false;
    this.kd8ChargePending = false;
    this.neuralParasitePending = false;
    this.tacticalJumpPending = false;
  }

  pushSimulation(cmd: GameCommand): void {
    this.simulationQueue.push(cmd);
  }

  /** Call once per frame, after InputManager.update(), before the tick loop. */
  processFrame(): void {
    const state = this.input.state;

    this.processKeys(state);
    this.processMouseEvents(state);
  }

  /** Check if any selected entity is a building */
  private isSelectedBuilding(): boolean {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] === 1 && hasComponents(this.world, eid, BUILDING)) return true;
    }
    return false;
  }

  /** Check if any selected unit matches a specific UnitType */
  private hasSelectedUnitOfType(ut: UnitType): boolean {
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] === 1 && faction[eid] === this.playerFaction && unitType[eid] === ut) return true;
    }
    return false;
  }

  private processKeys(state: InputState): void {
    const keys = state.keysJustPressed;

    // Control groups: Ctrl+0–9 assign, Alt+0–9 steal, Shift+0–9 add, 0–9 recall, double-tap centers camera
    const now = performance.now();
    for (let i = 0; i <= 9; i++) {
      const key = `Digit${i}`;
      if (keys.has(key)) {
        if (state.ctrlHeld) {
          this.selectionQueue.push({ type: CommandType.ControlGroupAssign, data: i });
        } else if (state.altHeld) {
          this.selectionQueue.push({ type: CommandType.ControlGroupSteal, data: i });
        } else if (state.shiftHeld) {
          this.selectionQueue.push({ type: CommandType.ControlGroupAdd, data: i });
        } else {
          // Double-tap detection: same group within 400ms → center camera
          if (this.lastRecalledGroup === i && now - this.lastRecalledTime < 400) {
            this.selectionQueue.push({ type: CommandType.ControlGroupRecallCenter, data: i });
            this.lastRecalledGroup = -1; // reset to avoid triple-tap
          } else {
            this.selectionQueue.push({ type: CommandType.ControlGroupRecall, data: i });
            this.lastRecalledGroup = i;
            this.lastRecalledTime = now;
          }
        }
      }
    }

    // Escape: cancel all pending targeting modes
    if (keys.has('Escape')) {
      this.cancelAllPending();
    }

    // Tab / CycleSubgroup — works in both building and unit contexts
    if (keys.has('Tab') || keys.has('ArrowRight')) {
      this.selectionQueue.push({ type: CommandType.CycleSubgroup, data: 1 });
    }
    if (keys.has('ArrowLeft')) {
      this.selectionQueue.push({ type: CommandType.CycleSubgroup, data: -1 });
    }

    // Delete (Cancel) — works in both contexts
    if (keys.has('Delete')) {
      this.simulationQueue.push({ type: CommandType.Cancel, units: this.snapshotSelection() });
    }

    // Context-aware hotkeys: building vs unit selection
    const selectionIsBuilding = this.isSelectedBuilding();

    if (selectionIsBuilding) {
      // Production hotkeys (mapped to produces[] slot index)
      // Row 1: Q=0  W=1  E=2  R=3  T=4
      // Row 2: A=5  S=6  D=7  F=8  G=9
      // Row 3: Z=10 X=11 C=12 V=13
      const prodKeys: [string, number][] = [
        ['KeyQ', 0], ['KeyW', 1], ['KeyE', 2], ['KeyR', 3], ['KeyT', 4],
        ['KeyA', 5], ['KeyS', 6], ['KeyD', 7], ['KeyF', 8], ['KeyG', 9],
        ['KeyZ', 10], ['KeyX', 11], ['KeyC', 12], ['KeyV', 13],
      ];
      for (const [key, slot] of prodKeys) {
        if (keys.has(key)) {
          this.simulationQueue.push({ type: CommandType.Produce, data: slot, units: this.snapshotSelection() });
        }
      }
      // L: toggle Supply Depot lowering
      if (keys.has('KeyL')) {
        this.simulationQueue.push({ type: CommandType.DepotLower, units: this.snapshotSelection() });
      }
    } else {
      // Unit ability keybindings

      // A: enter attack-move mode
      if (keys.has('KeyA')) {
        this.attackMovePending = true;
      }

      // Unit orders — snapshot selection at key time
      if (keys.has('KeyS')) {
        this.simulationQueue.push({ type: CommandType.Stop, units: this.snapshotSelection() });
      }
      if (keys.has('KeyH')) {
        this.simulationQueue.push({ type: CommandType.HoldPosition, units: this.snapshotSelection() });
      }
      if (keys.has('KeyP')) {
        // Context-aware: Viper → Parasitic Bomb (targeted), otherwise → Patrol
        if (this.hasSelectedUnitOfType(UnitType.Viper)) {
          this.cancelAllPending();
          this.parasiticBombPending = true;
        } else {
          this.patrolPending = true;
        }
      }
      if (keys.has('KeyT')) {
        this.simulationQueue.push({ type: CommandType.Stim, units: this.snapshotSelection() });
      }
      if (keys.has('KeyE')) {
        // Context-aware: Ghost → EMP (ground-targeted AoE), otherwise → SiegeToggle
        if (this.hasSelectedUnitOfType(UnitType.Ghost)) {
          this.cancelAllPending();
          this.empPending = true;
        } else {
          this.simulationQueue.push({ type: CommandType.SiegeToggle, units: this.snapshotSelection() });
        }
      }
      if (keys.has('KeyC')) {
        // Context-aware: Corruptor → Caustic Spray (targeted), otherwise → Cloak (toggle)
        if (this.hasSelectedUnitOfType(UnitType.Corruptor)) {
          this.cancelAllPending();
          this.causticSprayPending = true;
        } else {
          this.simulationQueue.push({ type: CommandType.Cloak, units: this.snapshotSelection() });
        }
      }
      // V: Inject Larva (Queen only)
      if (keys.has('KeyV') && this.hasSelectedUnitOfType(UnitType.Queen)) {
        this.simulationQueue.push({ type: CommandType.InjectLarva, units: this.snapshotSelection() });
      }
      // Y: Yamato Cannon (Battlecruiser only)
      if (keys.has('KeyY') && this.hasSelectedUnitOfType(UnitType.Battlecruiser)) {
        this.cancelAllPending();
        this.yamatoPending = true;
      }
      // R: context-aware — Roach → Burrow, Baneling → Burrow, Ravager → Corrosive Bile
      if (keys.has('KeyR')) {
        if (this.hasSelectedUnitOfType(UnitType.Roach)) {
          this.simulationQueue.push({ type: CommandType.RoachBurrow, units: this.snapshotSelection() });
        } else if (this.hasSelectedUnitOfType(UnitType.Baneling)) {
          this.simulationQueue.push({ type: CommandType.BanelingBurrow, units: this.snapshotSelection() });
        } else if (this.hasSelectedUnitOfType(UnitType.Ravager)) {
          this.cancelAllPending();
          this.corrosiveBilePending = true;
        }
      }
      // F: Fungal Growth (Infestor only)
      if (keys.has('KeyF') && this.hasSelectedUnitOfType(UnitType.Infestor)) {
        this.cancelAllPending();
        this.fungalPending = true;
      }
      // G: Abduct (Viper only)
      if (keys.has('KeyG') && this.hasSelectedUnitOfType(UnitType.Viper)) {
        this.cancelAllPending();
        this.abductPending = true;
      }
      // D: context-aware — Reaper → KD8 Charge, Ghost → Snipe
      if (keys.has('KeyD')) {
        if (this.hasSelectedUnitOfType(UnitType.Reaper)) {
          this.cancelAllPending();
          this.kd8ChargePending = true;
        } else if (this.hasSelectedUnitOfType(UnitType.Ghost)) {
          this.cancelAllPending();
          this.snipePending = true;
        }
      }
      // X: Transfuse (Queen only)
      if (keys.has('KeyX') && this.hasSelectedUnitOfType(UnitType.Queen)) {
        this.cancelAllPending();
        this.transfusePending = true;
      }
      // Q: Lock-On (Cyclone only)
      if (keys.has('KeyQ') && this.hasSelectedUnitOfType(UnitType.Cyclone)) {
        this.cancelAllPending();
        this.lockOnPending = true;
      }
      // B: Blinding Cloud (Viper only) — does NOT fire for workers (B = build menu in Game.ts)
      if (keys.has('KeyB') && this.hasSelectedUnitOfType(UnitType.Viper)) {
        this.cancelAllPending();
        this.blindingCloudPending = true;
      }
      // Neural Parasite (Infestor) — enter aim mode, click enemy to mind-control
      if (keys.has('KeyN')) {
        if (this.hasSelectedUnitOfType(UnitType.Infestor)) {
          this.cancelAllPending();
          this.neuralParasitePending = true;
        }
      }
    }
  }

  private processMouseEvents(state: InputState): void {
    const events = this.input.rawMouseEvents;
    let dragStartX = state.mouse.dragStartX;
    let dragStartY = state.mouse.dragStartY;

    for (const evt of events) {
      if (evt.type === 'leftdown') {
        dragStartX = evt.x;
        dragStartY = evt.y;
        if (evt.isDouble) this.pendingDoubleClick = true;
      } else if (evt.type === 'leftup') {
        const dx = evt.x - dragStartX;
        const dy = evt.y - dragStartY;
        const isDrag = dx * dx + dy * dy > 100; // 10px threshold

        if (isDrag && !evt.fromTouch) {
          // Box select — coordinates stay in screen space; SelectionSystem converts
          // Suppressed on touch: single-finger drag pans the viewport instead
          this.selectionQueue.push({
            type: CommandType.BoxSelect,
            sx: dragStartX, sy: dragStartY,
            sx2: evt.x,    sy2: evt.y,
            shiftHeld: state.shiftHeld,
          });
        } else if (isDrag && evt.fromTouch) {
          // Touch drag = pan (handled by viewport). No-op here.
        } else if (this.attackMovePending) {
          // Attack-move: convert to world space now
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.AttackMove,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.attackMovePending = false;
        } else if (this.patrolPending) {
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.Patrol,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.patrolPending = false;
        } else if (this.corrosiveBilePending) {
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.CorrosiveBile,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.corrosiveBilePending = false;
        } else if (this.fungalPending) {
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.FungalGrowth,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.fungalPending = false;
        } else if (this.snipePending) {
          // Snipe: click on enemy to snipe
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.Snipe,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.snipePending = false;
        } else if (this.yamatoPending) {
          // Yamato Cannon: click on enemy to fire
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.Yamato,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.yamatoPending = false;
        } else if (this.abductPending) {
          // Abduct: click on enemy to pull
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.Abduct,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.abductPending = false;
        } else if (this.transfusePending) {
          // Transfuse: click on friendly to heal
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.Transfuse,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.transfusePending = false;
        } else if (this.lockOnPending) {
          // Lock-On: click on enemy to lock onto
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.LockOn,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.lockOnPending = false;
        } else if (this.causticSprayPending) {
          // Caustic Spray: click on enemy building to channel
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.CausticSpray,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.causticSprayPending = false;
        } else if (this.empPending) {
          // EMP Round: ground-targeted AoE
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.EMP,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.empPending = false;
        } else if (this.kd8ChargePending) {
          // KD8 Charge: ground-targeted AoE
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.KD8Charge,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.kd8ChargePending = false;
        } else if (this.blindingCloudPending) {
          // Blinding Cloud: ground-targeted AoE
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.BlindingCloud,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.blindingCloudPending = false;
        } else if (this.parasiticBombPending) {
          // Parasitic Bomb: click on enemy air unit
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.ParasiticBomb,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.parasiticBombPending = false;
        } else if (this.neuralParasitePending) {
          // Neural Parasite: click on enemy to mind-control (stun)
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.NeuralParasite,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.neuralParasitePending = false;
        } else if (this.tacticalJumpPending) {
          // BC Tactical Jump: click on ground to teleport
          const worldPos = this.viewport.toWorld(evt.x, evt.y);
          this.simulationQueue.push({
            type: CommandType.TacticalJump,
            wx: worldPos.x, wy: worldPos.y,
            units: this.snapshotSelection(),
          });
          this.tacticalJumpPending = false;
        } else {
          // Single click — select (isDouble is on leftdown, not leftup)
          const isDouble = this.pendingDoubleClick;
          this.pendingDoubleClick = false;
          const type: CommandType = isDouble
            ? CommandType.DoubleClickSelect
            : CommandType.Select;
          this.selectionQueue.push({
            type,
            sx: evt.x, sy: evt.y,
            shiftHeld: state.shiftHeld,
            data: (state.ctrlHeld && type === CommandType.Select) ? 1 : undefined,
          });
        }
      } else if (evt.type === 'rightdown') {
        // Right-click: issue move/attack/gather command
        // CommandSystem reclassifies based on what's at wx/wy
        const worldPos = this.viewport.toWorld(evt.x, evt.y);
        this.simulationQueue.push({
          type: CommandType.Move,
          wx: worldPos.x, wy: worldPos.y,
          units: this.snapshotSelection(),
          shiftHeld: state.shiftHeld,
        });
        this.cancelAllPending();
      }
    }

    this.input.clearPendingEvents();
  }

  /** Snapshot currently selected Terran unit/building EIDs. */
  private snapshotSelection(): number[] {
    const out: number[] = [];
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] === 1 && faction[eid] === this.playerFaction) {
        out.push(eid);
      }
    }
    return out;
  }
}
