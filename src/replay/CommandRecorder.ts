import type { GameCommand } from '../input/CommandQueue';

export interface ReplayFrame {
  tick: number;       // game tick number when command was issued
  gameTime: number;   // gameTime (seconds) at time of command
  command: GameCommand;
}

export interface ReplayData {
  version: number;
  seed: number;
  difficulty: number;
  faction: number;
  frames: ReplayFrame[];
}

export class CommandRecorder {
  private frames: ReplayFrame[] = [];
  private recording = false;
  private startSeed = 0;
  private startDifficulty = 0;
  private startFaction = 0;

  startRecording(seed: number, difficulty: number, faction: number): void {
    this.frames = [];
    this.recording = true;
    this.startSeed = seed;
    this.startDifficulty = difficulty;
    this.startFaction = faction;
  }

  record(tick: number, gameTime: number, command: GameCommand): void {
    if (!this.recording) return;
    this.frames.push({ tick, gameTime, command });
  }

  stopRecording(): void {
    this.recording = false;
  }

  /** Serialize to JSON string for storage */
  toJSON(): string {
    return JSON.stringify({
      version: 1,
      seed: this.startSeed,
      difficulty: this.startDifficulty,
      faction: this.startFaction,
      frames: this.frames,
    } satisfies ReplayData);
  }

  /** Deserialize from JSON string */
  static fromJSON(json: string): ReplayData {
    return JSON.parse(json) as ReplayData;
  }

  get frameCount(): number { return this.frames.length; }
  get isRecording(): boolean { return this.recording; }
}
