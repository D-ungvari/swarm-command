/**
 * Network protocol — message types shared between client and server.
 *
 * All messages are JSON for simplicity in Phase 1.
 * Phase 2+ will migrate to binary for bandwidth efficiency.
 */

import type { GameCommand } from '../src/input/CommandQueue';

// ─── Client → Server ────────────────────────────────────────────────────

export interface ClientJoinMsg {
  type: 'join';
  name: string;
  faction: number; // Faction enum value
}

export interface ClientCommandMsg {
  type: 'command';
  commands: GameCommand[];
}

export type ClientMsg = ClientJoinMsg | ClientCommandMsg;

// ─── Server → Client ────────────────────────────────────────────────────

export interface ServerWelcomeMsg {
  type: 'welcome';
  playerId: number;
  faction: number;
  seed: number;
  mapType: number;
  tickRate: number;
}

export interface EntitySnapshot {
  eid: number;
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  faction: number;
  unitType: number;
  buildingType: number;
  width: number;
  height: number;
  tint: number;
  isAir: number;
  selected?: number; // client-local, not sent
}

export interface ServerStateMsg {
  type: 'state';
  tick: number;
  gameTime: number;
  entities: EntitySnapshot[];
  resources: Record<number, {
    minerals: number;
    gas: number;
    supplyUsed: number;
    supplyProvided: number;
  }>;
}

export interface ServerPlayerJoinedMsg {
  type: 'player_joined';
  playerId: number;
  name: string;
  faction: number;
}

export interface ServerPlayerLeftMsg {
  type: 'player_left';
  playerId: number;
}

export type ServerMsg = ServerWelcomeMsg | ServerStateMsg | ServerPlayerJoinedMsg | ServerPlayerLeftMsg;

// ─── Serialization helpers ───────────────────────────────────────────────

export function encodeMsg(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function decodeMsg(data: string): ClientMsg | ServerMsg {
  return JSON.parse(data);
}
