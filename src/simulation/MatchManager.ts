/**
 * MatchManager — Manages match lifecycle, player elimination, and scoring.
 *
 * Match lifecycle: lobby → countdown → play → eliminations → victory
 * Elimination: base destroyed = out of match (spectate or leave)
 */

// ─── Match State ─────────────────────────────────────────────────────────

export const enum MatchPhase {
  Lobby = 0,     // Waiting for players
  Countdown = 1, // Starting in 3... 2... 1...
  Playing = 2,   // Active match
  Ended = 3,     // Match over
}

export interface PlayerScore {
  playerId: number;
  name: string;
  faction: number;
  kills: number;
  unitsProduced: number;
  buildingsDestroyed: number;
  nodesHeld: number;
  timeAlive: number;   // seconds
  eliminated: boolean;
  eliminatedAt: number; // gameTime when eliminated (0 = still alive)
  score: number;        // computed final score
}

export interface MatchConfig {
  maxPlayers: number;      // 8-16
  countdownSeconds: number; // 5-10
  mode: 'ffa' | 'timed' | 'teams';
  timeLimitSeconds: number; // 0 = no limit (ffa last standing)
}

const DEFAULT_CONFIG: MatchConfig = {
  maxPlayers: 8,
  countdownSeconds: 5,
  mode: 'ffa',
  timeLimitSeconds: 0, // Last standing
};

// ─── Scoring ─────────────────────────────────────────────────────────────

const SCORE_PER_KILL = 10;
const SCORE_PER_BUILDING = 25;
const SCORE_PER_NODE_SEC = 0.5;
const SCORE_PER_ALIVE_SEC = 0.1;

function computeScore(p: PlayerScore): number {
  return Math.round(
    p.kills * SCORE_PER_KILL +
    p.buildingsDestroyed * SCORE_PER_BUILDING +
    p.nodesHeld * p.timeAlive * SCORE_PER_NODE_SEC +
    p.timeAlive * SCORE_PER_ALIVE_SEC
  );
}

// ─── MatchManager ────────────────────────────────────────────────────────

export class MatchManager {
  config: MatchConfig;
  phase: MatchPhase = MatchPhase.Lobby;
  players: Map<number, PlayerScore> = new Map();
  startTime = 0;
  countdownRemaining = 0;

  constructor(config: Partial<MatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a player. */
  addPlayer(playerId: number, name: string, faction: number): void {
    this.players.set(playerId, {
      playerId,
      name,
      faction,
      kills: 0,
      unitsProduced: 0,
      buildingsDestroyed: 0,
      nodesHeld: 0,
      timeAlive: 0,
      eliminated: false,
      eliminatedAt: 0,
      score: 0,
    });
  }

  /** Remove a player (disconnected). */
  removePlayer(playerId: number): void {
    this.players.delete(playerId);
  }

  /** Start the countdown. */
  startCountdown(): void {
    this.phase = MatchPhase.Countdown;
    this.countdownRemaining = this.config.countdownSeconds;
  }

  /** Tick the match. Called once per server tick. */
  tick(dt: number, gameTime: number): void {
    if (this.phase === MatchPhase.Countdown) {
      this.countdownRemaining -= dt;
      if (this.countdownRemaining <= 0) {
        this.phase = MatchPhase.Playing;
        this.startTime = gameTime;
      }
      return;
    }

    if (this.phase !== MatchPhase.Playing) return;

    // Update alive time for non-eliminated players
    for (const p of this.players.values()) {
      if (!p.eliminated) {
        p.timeAlive += dt;
      }
    }

    // Check timed mode end
    if (this.config.mode === 'timed' && this.config.timeLimitSeconds > 0) {
      if (gameTime - this.startTime >= this.config.timeLimitSeconds) {
        this.endMatch();
      }
    }

    // Check last-standing (FFA)
    if (this.config.mode === 'ffa') {
      const alivePlayers = [...this.players.values()].filter(p => !p.eliminated);
      if (alivePlayers.length <= 1 && this.players.size > 1) {
        this.endMatch();
      }
    }
  }

  /** Eliminate a player (base destroyed). */
  eliminatePlayer(playerId: number, gameTime: number): void {
    const p = this.players.get(playerId);
    if (!p || p.eliminated) return;
    p.eliminated = true;
    p.eliminatedAt = gameTime;
    p.score = computeScore(p);
  }

  /** Record a kill for a player. */
  recordKill(playerId: number): void {
    const p = this.players.get(playerId);
    if (p) p.kills++;
  }

  /** Record a building destroyed by a player. */
  recordBuildingDestroyed(playerId: number): void {
    const p = this.players.get(playerId);
    if (p) p.buildingsDestroyed++;
  }

  /** Update node count for scoring. */
  updateNodesHeld(playerId: number, count: number): void {
    const p = this.players.get(playerId);
    if (p) p.nodesHeld = count;
  }

  /** End the match and compute final scores. */
  private endMatch(): void {
    this.phase = MatchPhase.Ended;
    for (const p of this.players.values()) {
      p.score = computeScore(p);
    }
  }

  /** Get the leaderboard (sorted by score descending). */
  getLeaderboard(): PlayerScore[] {
    const scores = [...this.players.values()];
    // Recompute scores for living players
    for (const p of scores) {
      p.score = computeScore(p);
    }
    return scores.sort((a, b) => b.score - a.score);
  }

  /** Get the winner (highest score, or last standing in FFA). */
  getWinner(): PlayerScore | null {
    const board = this.getLeaderboard();
    return board.length > 0 ? board[0] : null;
  }

  /** Check if match is over. */
  isOver(): boolean {
    return this.phase === MatchPhase.Ended;
  }
}
