/**
 * GameServer — WebSocket server entry point.
 *
 * Accepts player connections, manages game rooms, and relays
 * commands/state between clients and the GameRoom simulation.
 *
 * Usage: npx tsx server/GameServer.ts
 */

import { WebSocketServer, WebSocket } from 'ws';
import { GameRoom, SERVER_TICK_RATE } from './GameRoom';
import {
  type ClientMsg, type ServerMsg,
  encodeMsg, decodeMsg,
} from './NetProtocol';

const PORT = Number(process.env.PORT) || 8080;

// ─── Single room for Phase 1 ──────────────────────────────────────────

const room = new GameRoom();

interface ConnectedClient {
  ws: WebSocket;
  playerId: number;
  name: string;
  faction: number;
}

const clients: Map<WebSocket, ConnectedClient> = new Map();

function broadcast(msg: ServerMsg): void {
  const data = encodeMsg(msg);
  for (const client of clients.values()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(data);
    }
  }
}

// ─── WebSocket Server ─────────────────────────────────────────────────

const wss = new WebSocketServer({ port: PORT });

console.log(`[GameServer] Listening on ws://localhost:${PORT}`);
console.log(`[GameServer] Tick rate: ${SERVER_TICK_RATE}Hz`);

wss.on('connection', (ws: WebSocket) => {
  console.log('[GameServer] Client connected');

  ws.on('message', (raw: Buffer) => {
    let msg: ClientMsg;
    try {
      msg = decodeMsg(raw.toString()) as ClientMsg;
    } catch {
      console.warn('[GameServer] Invalid message:', raw.toString().slice(0, 100));
      return;
    }

    switch (msg.type) {
      case 'join': {
        // Create player in room
        const player = room.addPlayer(msg.name, msg.faction);
        const client: ConnectedClient = {
          ws,
          playerId: player.id,
          name: msg.name,
          faction: msg.faction,
        };
        clients.set(ws, client);

        // Send welcome
        const welcome: ServerMsg = {
          type: 'welcome',
          playerId: player.id,
          faction: msg.faction,
          seed: room.sim.getSeed(),
          mapType: 0,
          tickRate: SERVER_TICK_RATE,
        };
        ws.send(encodeMsg(welcome));

        // Notify others
        broadcast({
          type: 'player_joined',
          playerId: player.id,
          name: msg.name,
          faction: msg.faction,
        });

        console.log(`[GameServer] Player ${msg.name} joined as faction ${msg.faction} (id: ${player.id})`);

        // Start room on first player
        if (clients.size === 1) {
          room.start();
          console.log('[GameServer] Room started');
        }
        break;
      }

      case 'command': {
        const client = clients.get(ws);
        if (!client) return;
        room.queueCommands(client.playerId, msg.commands);
        break;
      }
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (client) {
      room.removePlayer(client.playerId);
      clients.delete(ws);

      broadcast({
        type: 'player_left',
        playerId: client.playerId,
      });

      console.log(`[GameServer] Player ${client.name} disconnected`);

      // Stop room if empty
      if (clients.size === 0) {
        room.stop();
        console.log('[GameServer] Room stopped (no players)');
      }
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[GameServer] WebSocket error:', err.message);
  });
});

// ─── State broadcast loop ─────────────────────────────────────────────

// Broadcast state at tick rate (20Hz) — separate from simulation tick
// so network and simulation are decoupled
setInterval(() => {
  if (clients.size === 0) return;
  const snapshot = room.buildSnapshot();
  broadcast(snapshot);
}, 1000 / SERVER_TICK_RATE);

console.log('[GameServer] Ready for connections');
