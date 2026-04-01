export const enum CommandType {
  Move = 0,
  AttackMove = 1,
  AttackTarget = 2,
  Stop = 3,
  HoldPosition = 4,
  Patrol = 5,
  Stim = 6,
  SiegeToggle = 7,
  Gather = 8,
  SetRally = 9,
  BuildPlace = 10,
  Produce = 11,
  Cancel = 12,
  Select = 13,
  BoxSelect = 14,
  AddSelect = 15,
  DoubleClickSelect = 16,
  ControlGroupAssign = 17,
  ControlGroupRecall = 18,
  CycleSubgroup = 19,
  Cloak = 20,
  InjectLarva = 21,
}

export interface GameCommand {
  type: CommandType;
  wx?: number;
  wy?: number;
  sx?: number;
  sy?: number;
  sx2?: number;
  sy2?: number;
  targetEid?: number;
  units?: number[];
  data?: number;
  shiftHeld?: boolean;
}

export class GameCommandQueue {
  private _commands: GameCommand[] = [];

  push(cmd: GameCommand): void {
    this._commands.push(cmd);
  }

  /** Drain and return all queued commands. Queue is empty after this call. */
  flush(): GameCommand[] {
    const out = this._commands;
    this._commands = [];
    return out;
  }

  /**
   * Drain commands, recording each into a CommandRecorder before returning.
   * Pass null recorder to skip recording (no-op equivalent to flush()).
   */
  flushWithRecord(
    recorder: { record(tick: number, gameTime: number, command: GameCommand): void } | null,
    tick: number,
    gt: number,
  ): GameCommand[] {
    const out = this._commands;
    if (recorder) {
      for (const c of out) recorder.record(tick, gt, c);
    }
    this._commands = [];
    return out;
  }

  get length(): number {
    return this._commands.length;
  }
}
