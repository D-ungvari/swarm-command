import { type World, hasComponents } from '../ecs/world';
import { selected, faction, BUILDING } from '../ecs/components';
import { InputManager, type InputState } from './InputManager';
import { CommandType, type GameCommand, GameCommandQueue } from './CommandQueue';
import { Faction } from '../constants';
import type { Viewport } from 'pixi-viewport';

export class InputProcessor {
  private attackMovePending = false;
  private patrolPending = false;
  private corrosiveBilePending = false;
  private fungalPending = false;

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

  private processKeys(state: InputState): void {
    const keys = state.keysJustPressed;

    // Control groups: Ctrl+0–9 assign, Shift+0–9 add, 0–9 recall
    for (let i = 0; i <= 9; i++) {
      const key = `Digit${i}`;
      if (keys.has(key)) {
        if (state.ctrlHeld) {
          this.selectionQueue.push({ type: CommandType.ControlGroupAssign, data: i });
        } else if (state.shiftHeld) {
          this.selectionQueue.push({ type: CommandType.ControlGroupAdd, data: i });
        } else {
          this.selectionQueue.push({ type: CommandType.ControlGroupRecall, data: i });
        }
      }
    }

    // Escape: cancel attack-move / patrol / ability targeting modes
    if (keys.has('Escape')) {
      this.attackMovePending = false;
      this.patrolPending = false;
      this.corrosiveBilePending = false;
      this.fungalPending = false;
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
        this.patrolPending = true;
      }
      if (keys.has('KeyT')) {
        this.simulationQueue.push({ type: CommandType.Stim, units: this.snapshotSelection() });
      }
      if (keys.has('KeyE')) {
        this.simulationQueue.push({ type: CommandType.SiegeToggle, units: this.snapshotSelection() });
      }
      if (keys.has('KeyC')) {
        this.simulationQueue.push({ type: CommandType.Cloak, units: this.snapshotSelection() });
      }
      if (keys.has('KeyV')) {
        this.simulationQueue.push({ type: CommandType.InjectLarva, units: this.snapshotSelection() });
      }
      // Yamato Cannon (Battlecruiser) — fires at current attack target
      if (keys.has('KeyY')) {
        this.simulationQueue.push({ type: CommandType.Yamato, units: this.snapshotSelection() });
      }
      // Corrosive Bile (Ravager) — location ability, left-click to place
      if (keys.has('KeyR')) {
        this.corrosiveBilePending = true;
        this.fungalPending = false;
      }
      // Fungal Growth (Infestor) — location ability, left-click to place
      if (keys.has('KeyF')) {
        this.fungalPending = true;
        this.corrosiveBilePending = false;
      }
      // Abduct (Viper) — pulls current attack target to Viper
      if (keys.has('KeyG')) {
        this.simulationQueue.push({ type: CommandType.Abduct, units: this.snapshotSelection() });
      }
      // Snipe (Ghost) — instant 170 damage to nearest enemy bio
      if (keys.has('KeyD')) {
        this.simulationQueue.push({ type: CommandType.Snipe, units: this.snapshotSelection() });
      }
      // Transfuse (Queen) — heal 75 HP to nearest damaged friendly
      if (keys.has('KeyX')) {
        this.simulationQueue.push({ type: CommandType.Transfuse, units: this.snapshotSelection() });
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
        } else {
          // Single click — select
          const type: CommandType = evt.isDouble
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
        this.attackMovePending = false;
        this.patrolPending = false;
        this.corrosiveBilePending = false;
        this.fungalPending = false;
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
