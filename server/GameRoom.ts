/**
 * GameRoom — A single game room/arena.
 *
 * Owns a Simulation instance, ticks at SERVER_TICK_RATE (20Hz),
 * collects commands from connected players, and broadcasts state snapshots.
 */

import { Simulation } from '../src/simulation/Simulation';
import { hasComponents } from '../src/ecs/world';
import {
  POSITION, HEALTH, RENDERABLE, BUILDING,
  posX, posY, hpCurrent, hpMax,
  faction, unitType, buildingType,
  renderWidth, renderHeight, renderTint,
  isAir,
} from '../src/ecs/components';
import { Faction, BuildingType, BuildState, UnitType, TILE_SIZE } from '../src/constants';
import { tileToWorld } from '../src/map/MapData';
import type { GameCommand } from '../src/input/CommandQueue';
import type { EntitySnapshot, ServerStateMsg } from './NetProtocol';

export const SERVER_TICK_RATE = 20; // Hz
const SERVER_DT = 1 / SERVER_TICK_RATE;

export interface Player {
  id: number;
  name: string;
  faction: number;
  /** Queued commands to process next tick */
  pendingCommands: GameCommand[];
}

export class GameRoom {
  sim: Simulation;
  players: Map<number, Player> = new Map();
  private nextPlayerId = 1;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor(seed?: number) {
    this.sim = new Simulation({
      fogEnabled: false, // Phase 1: no fog, full visibility
      gameSeed: seed,
    });
  }

  /** Add a player to the room. Returns player ID. */
  addPlayer(name: string, factionId: number): Player {
    const id = this.nextPlayerId++;
    const player: Player = {
      id,
      name,
      faction: factionId,
      pendingCommands: [],
    };
    this.players.set(id, player);

    // Initialize resources for this player's faction
    this.sim.addPlayer(factionId);

    // Spawn a starting base for this player
    this.spawnPlayerBase(player);

    return player;
  }

  /** Remove a player from the room. */
  removePlayer(playerId: number): void {
    this.players.delete(playerId);
  }

  /** Queue commands from a player for next tick. */
  queueCommands(playerId: number, commands: GameCommand[]): void {
    const player = this.players.get(playerId);
    if (!player) return;
    player.pendingCommands.push(...commands);
  }

  /** Start the tick loop. */
  start(): void {
    if (this.tickInterval) return;

    // Spawn resource nodes and rocks
    this.sim.spawnResourceNodes();
    this.sim.spawnRocks();

    this.tickInterval = setInterval(() => this.tick(), 1000 / SERVER_TICK_RATE);
  }

  /** Stop the tick loop. */
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /** Run one server tick. */
  private tick(): void {
    // Collect all player commands
    const allCommands: GameCommand[] = [];
    for (const player of this.players.values()) {
      allCommands.push(...player.pendingCommands);
      player.pendingCommands = [];
    }

    // Advance simulation
    this.sim.tick(SERVER_DT, allCommands);
  }

  /** Build a full state snapshot for broadcasting. */
  buildSnapshot(): ServerStateMsg {
    const entities: EntitySnapshot[] = [];
    const world = this.sim.world;

    for (let eid = 1; eid < world.nextEid; eid++) {
      if (!hasComponents(world, eid, POSITION | RENDERABLE)) continue;
      if (hpCurrent[eid] <= 0) continue;

      entities.push({
        eid,
        x: posX[eid],
        y: posY[eid],
        hp: hpCurrent[eid],
        hpMax: hpMax[eid],
        faction: faction[eid],
        unitType: unitType[eid],
        buildingType: buildingType[eid],
        width: renderWidth[eid],
        height: renderHeight[eid],
        tint: renderTint[eid],
        isAir: isAir[eid],
      });
    }

    // Build resource summary per faction
    const resources: ServerStateMsg['resources'] = {};
    for (const [fac, res] of Object.entries(this.sim.resources)) {
      resources[Number(fac)] = {
        minerals: res.minerals,
        gas: res.gas,
        supplyUsed: res.supplyUsed,
        supplyProvided: res.supplyProvided,
      };
    }

    return {
      type: 'state',
      tick: this.sim.tickCount,
      gameTime: this.sim.gameTime,
      entities,
      resources,
    };
  }

  /** Spawn a starting base for a player at an available position. */
  private spawnPlayerBase(player: Player): void {
    // Phase 1: Simple 2-player positions
    const positions = [
      { col: 15, row: 15 },
      { col: 112, row: 112 },
      { col: 15, row: 112 },
      { col: 112, row: 15 },
    ];
    const posIdx = (player.id - 1) % positions.length;
    const pos = positions[posIdx];

    const fac = player.faction as Faction;

    // Spawn HQ building (completed)
    if (fac === Faction.Zerg) {
      this.sim.spawnCompletedBuilding(BuildingType.Hatchery, fac, pos.col, pos.row);
      this.sim.spawnCompletedBuilding(BuildingType.SpawningPool, fac, pos.col - 3, pos.row);
    } else {
      this.sim.spawnCompletedBuilding(BuildingType.CommandCenter, fac, pos.col, pos.row);
    }

    // Spawn starting workers
    const wp = tileToWorld(pos.col, pos.row);
    const workerType = fac === Faction.Zerg ? UnitType.Drone : UnitType.SCV;
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      this.sim.spawnUnitAt(workerType, fac, wp.x + (col - 1) * TILE_SIZE, wp.y - TILE_SIZE * (2 + row));
    }

    // Auto-mine
    this.sim.sendWorkersToMine(fac);
  }
}
