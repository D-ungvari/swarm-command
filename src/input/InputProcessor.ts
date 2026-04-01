import { type World } from '../ecs/world';
import { selected, faction } from '../ecs/components';
import { InputManager, type InputState } from './InputManager';
import { CommandType, type GameCommand, GameCommandQueue } from './CommandQueue';
import { Faction } from '../constants';
import type { Viewport } from 'pixi-viewport';

export class InputProcessor {
  private attackMovePending = false;
  private patrolPending = false;

  constructor(
    private input: InputManager,
    public readonly selectionQueue: GameCommandQueue,
    public readonly simulationQueue: GameCommandQueue,
    private viewport: Viewport,
    private world: World,
  ) {}

  get isAttackMovePending(): boolean {
    return this.attackMovePending;
  }

  get isPatrolPending(): boolean {
    return this.patrolPending;
  }

  /** Call once per frame, after InputManager.update(), before the tick loop. */
  processFrame(): void {
    const state = this.input.state;

    this.processKeys(state);
    this.processMouseEvents(state);
  }

  private processKeys(state: InputState): void {
    const keys = state.keysJustPressed;

    // Control groups: Ctrl+0–9 assign, 0–9 recall
    for (let i = 0; i <= 9; i++) {
      const key = `Digit${i}`;
      if (keys.has(key)) {
        if (state.ctrlHeld) {
          this.selectionQueue.push({ type: CommandType.ControlGroupAssign, data: i });
        } else {
          this.selectionQueue.push({ type: CommandType.ControlGroupRecall, data: i });
        }
      }
    }

    // Escape: cancel attack-move / patrol mode
    if (keys.has('Escape')) {
      this.attackMovePending = false;
      this.patrolPending = false;
    }

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
    if (keys.has('Delete')) {
      this.simulationQueue.push({ type: CommandType.Cancel, units: this.snapshotSelection() });
    }
    if (keys.has('KeyQ')) {
      this.simulationQueue.push({ type: CommandType.Produce, data: 0, units: this.snapshotSelection() });
    }
    if (keys.has('KeyW')) {
      this.simulationQueue.push({ type: CommandType.Produce, data: 1, units: this.snapshotSelection() });
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

        if (isDrag) {
          // Box select — coordinates stay in screen space; SelectionSystem converts
          this.selectionQueue.push({
            type: CommandType.BoxSelect,
            sx: dragStartX, sy: dragStartY,
            sx2: evt.x,    sy2: evt.y,
            shiftHeld: state.shiftHeld,
          });
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
        } else {
          // Single click — select
          const type: CommandType = evt.isDouble
            ? CommandType.DoubleClickSelect
            : CommandType.Select;
          this.selectionQueue.push({
            type,
            sx: evt.x, sy: evt.y,
            shiftHeld: state.shiftHeld,
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
      }
    }

    this.input.clearPendingEvents();
  }

  /** Snapshot currently selected Terran unit/building EIDs. */
  private snapshotSelection(): number[] {
    const out: number[] = [];
    for (let eid = 1; eid < this.world.nextEid; eid++) {
      if (selected[eid] === 1 && faction[eid] === Faction.Terran) {
        out.push(eid);
      }
    }
    return out;
  }
}
