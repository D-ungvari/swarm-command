import { describe, it, expect } from 'vitest';
import {
  generateArenaLayout, generateArenaTiles, summarizeLayout,
  ARENA_COLS, ARENA_ROWS, HEX_SIZE,
} from '../../src/simulation/ArenaMap';
import {
  hexToPixel, pixelToHex, hexDistance, hexRing, hexDisk,
  hexCorners, hexNeighbors, isPointInHex, hexRound,
  type HexGridConfig,
} from '../../src/simulation/HexGrid';
import {
  NodeEconomyState, CaptureState, CAPTURE_TIME,
} from '../../src/simulation/NodeEconomy';
import type { PlayerResources } from '../../src/types';

// ─── HexGrid Tests ───────────────────────────────────────────────────────

describe('HexGrid', () => {
  const config: HexGridConfig = { hexSize: 128, originX: 1536, originY: 1536 };

  it('center hex maps to origin', () => {
    const px = hexToPixel(config, { q: 0, r: 0 });
    expect(px.x).toBe(1536);
    expect(px.y).toBe(1536);
  });

  it('hexToPixel and pixelToHex are inverse', () => {
    for (const hex of [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: 2, r: -1 }]) {
      const px = hexToPixel(config, hex);
      const back = pixelToHex(config, px.x, px.y);
      expect(back.q).toBe(hex.q);
      expect(back.r).toBe(hex.r);
    }
  });

  it('hexDistance is correct', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(hexDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
  });

  it('hexRing returns correct count', () => {
    expect(hexRing({ q: 0, r: 0 }, 0)).toHaveLength(1);
    expect(hexRing({ q: 0, r: 0 }, 1)).toHaveLength(6);
    expect(hexRing({ q: 0, r: 0 }, 2)).toHaveLength(12);
    expect(hexRing({ q: 0, r: 0 }, 3)).toHaveLength(18);
  });

  it('hexDisk returns correct total', () => {
    // 1 + 6 + 12 = 19
    expect(hexDisk({ q: 0, r: 0 }, 2)).toHaveLength(19);
    // 1 + 6 + 12 + 18 + 24 = 61
    expect(hexDisk({ q: 0, r: 0 }, 4)).toHaveLength(61);
  });

  it('hexCorners returns 6 points', () => {
    const corners = hexCorners(config, { q: 0, r: 0 });
    expect(corners).toHaveLength(6);
    // All corners should be hexSize away from center
    for (const c of corners) {
      const dx = c.x - 1536;
      const dy = c.y - 1536;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(128, 0);
    }
  });

  it('hexNeighbors returns 6 adjacent hexes', () => {
    const neighbors = hexNeighbors({ q: 0, r: 0 });
    expect(neighbors).toHaveLength(6);
    for (const n of neighbors) {
      expect(hexDistance({ q: 0, r: 0 }, n)).toBe(1);
    }
  });

  it('isPointInHex works for center', () => {
    expect(isPointInHex(config, { q: 0, r: 0 }, 1536, 1536)).toBe(true);
    // A point clearly in neighbor hex
    const neighborPx = hexToPixel(config, { q: 1, r: 0 });
    expect(isPointInHex(config, { q: 0, r: 0 }, neighborPx.x, neighborPx.y)).toBe(false);
    expect(isPointInHex(config, { q: 1, r: 0 }, neighborPx.x, neighborPx.y)).toBe(true);
  });

  it('hexRound snaps correctly', () => {
    expect(hexRound(0.1, -0.1)).toEqual({ q: 0, r: 0 });
    expect(hexRound(0.9, 0.1)).toEqual({ q: 1, r: 0 });
  });
});

// ─── ArenaMap Layout Tests ───────────────────────────────────────────────

describe('ArenaMap', () => {
  it('generates layout for 8 players', () => {
    const layout = generateArenaLayout(8);
    expect(layout.spawns).toHaveLength(8);
    expect(layout.cols).toBe(ARENA_COLS);
    expect(layout.rows).toBe(ARENA_ROWS);
  });

  it('has correct zone ring structure', () => {
    const layout = generateArenaLayout(8);
    const byRing: Record<number, number> = {};
    for (const z of layout.zones) {
      byRing[z.ring] = (byRing[z.ring] ?? 0) + 1;
    }
    expect(byRing[0]).toBe(1);  // center crown
    expect(byRing[1]).toBe(6);  // inner ring
    expect(byRing[2]).toBe(12); // mid ring
    expect(byRing[3]).toBeGreaterThanOrEqual(10); // outer-mid (some may be starter)
  });

  it('has ~70% mineral and ~30% gas zones', () => {
    const layout = generateArenaLayout(8);
    const total = layout.zones.length;
    const gasRatio = layout.totalGasZones / total;
    expect(gasRatio).toBeGreaterThan(0.15);
    expect(gasRatio).toBeLessThan(0.45);
  });

  it('assigns 2 starter zones per player', () => {
    const layout = generateArenaLayout(8);
    for (let i = 0; i < 8; i++) {
      const starters = layout.zones.filter(z => z.starterForPlayer === i);
      expect(starters).toHaveLength(2);
    }
  });

  it('center zone has highest income', () => {
    const layout = generateArenaLayout(8);
    const center = layout.zones.find(z => z.ring === 0)!;
    const maxOther = Math.max(
      ...layout.zones.filter(z => z.ring !== 0).map(z => z.incomePerMin)
    );
    expect(center.incomePerMin).toBeGreaterThanOrEqual(maxOther);
  });

  it('income decreases from center to edge', () => {
    const layout = generateArenaLayout(8);
    const avgByRing: Record<number, number> = {};
    const countByRing: Record<number, number> = {};
    for (const z of layout.zones) {
      if (z.starterForPlayer !== null) continue; // skip starters
      avgByRing[z.ring] = (avgByRing[z.ring] ?? 0) + z.incomePerMin;
      countByRing[z.ring] = (countByRing[z.ring] ?? 0) + 1;
    }
    for (const ring of Object.keys(avgByRing)) {
      avgByRing[+ring] /= countByRing[+ring];
    }
    // Each inner ring should have higher avg income than the next
    expect(avgByRing[0]).toBeGreaterThan(avgByRing[1]);
    expect(avgByRing[1]).toBeGreaterThan(avgByRing[2]);
    expect(avgByRing[2]).toBeGreaterThan(avgByRing[3]);
  });

  it('generates tiles with circular playable area', () => {
    const layout = generateArenaLayout(8);
    const map = generateArenaTiles(layout);
    expect(map.cols).toBe(ARENA_COLS);
    expect(map.rows).toBe(ARENA_ROWS);

    // Center should be walkable ground
    const centerIdx = Math.floor(ARENA_ROWS / 2) * ARENA_COLS + Math.floor(ARENA_COLS / 2);
    expect(map.walkable[centerIdx]).toBe(1);

    // Corner should be water (outside circle)
    const cornerIdx = 0; // top-left
    expect(map.walkable[cornerIdx]).toBe(0);
  });

  it('scales to different player counts', () => {
    for (const count of [2, 4, 6, 8, 12, 16]) {
      const layout = generateArenaLayout(count);
      expect(layout.spawns).toHaveLength(count);
      // Always has at least ring 0-2 zones
      expect(layout.zones.length).toBeGreaterThanOrEqual(19);
      // Every player gets 2 starters
      for (let i = 0; i < count; i++) {
        const starters = layout.zones.filter(z => z.starterForPlayer === i);
        expect(starters.length).toBe(2);
      }
    }
  });

  it('summarizeLayout produces readable output', () => {
    const layout = generateArenaLayout(8);
    const summary = summarizeLayout(layout);
    expect(summary).toContain('96×96');
    expect(summary).toContain('Players: 8');
    expect(summary).toContain('Ring 0');
    expect(summary).toContain('/min');
  });
});

// ─── NodeEconomy Tests ───────────────────────────────────────────────────

describe('NodeEconomy', () => {
  function setupEconomy(playerCount = 2) {
    const layout = generateArenaLayout(playerCount);
    const economy = new NodeEconomyState(layout.hexConfig);

    // Map player indices to faction IDs (1-based)
    const starterOwners = new Map<number, number>();
    for (let i = 0; i < playerCount; i++) {
      starterOwners.set(i, i + 1);
    }
    economy.initFromLayout(layout.zones, starterOwners);

    // Create resources for each faction
    const resources: Record<number, PlayerResources> = {};
    for (let i = 1; i <= playerCount; i++) {
      resources[i] = {
        minerals: 200, gas: 0,
        supplyUsed: 0, supplyProvided: 15,
        upgrades: new Uint8Array(16),
      };
    }

    return { layout, economy, resources };
  }

  it('starter zones are pre-captured', () => {
    const { economy } = setupEconomy(8);
    for (let i = 1; i <= 8; i++) {
      const owned = economy.countOwned(i);
      expect(owned).toBe(2); // 2 starter zones each
    }
  });

  it('tickIncome adds resources from owned zones', () => {
    const { economy, resources } = setupEconomy(2);
    const startMinerals = resources[1].minerals;

    // Tick for 1 second
    economy.tickIncome(1.0, resources);

    // Player 1 has 2 starter zones at 50/min each = 100/min = ~1.67/sec
    expect(resources[1].minerals).toBeGreaterThan(startMinerals);
    const gained = resources[1].minerals - startMinerals;
    expect(gained).toBeCloseTo(100 / 60, 0); // ~1.67 per second
  });

  it('uncontested capture takes CAPTURE_TIME seconds', () => {
    const { economy } = setupEconomy(2);

    // Find a neutral zone
    const neutralZone = economy.zones.find(z => z.owner === 0)!;
    expect(neutralZone).toBeDefined();

    // Simulate faction 1 units present
    const mockPresence = (zone: any) => ({
      factionCounts: zone === neutralZone
        ? new Map([[1, 3]]) // 3 units from faction 1
        : new Map(),
    });

    // Tick partially — should be capturing but not done
    economy.tickCapture(CAPTURE_TIME * 0.5, mockPresence);
    expect(neutralZone.state).toBe(CaptureState.Capturing);
    expect(neutralZone.owner).toBe(0);

    // Tick the rest — should be captured
    economy.tickCapture(CAPTURE_TIME * 0.6, mockPresence);
    expect(neutralZone.state).toBe(CaptureState.Owned);
    expect(neutralZone.owner).toBe(1);
  });

  it('contested zones freeze capture progress', () => {
    const { economy } = setupEconomy(2);
    const neutralZone = economy.zones.find(z => z.owner === 0)!;

    // Both factions present
    const contested = (_zone: any) => ({
      factionCounts: new Map([[1, 2], [2, 3]]),
    });

    economy.tickCapture(5.0, contested);
    expect(neutralZone.state).toBe(CaptureState.Contested);
    expect(neutralZone.owner).toBe(0); // Still uncaptured
  });

  it('capture decays when units leave', () => {
    const { economy } = setupEconomy(2);
    const neutralZone = economy.zones.find(z => z.owner === 0)!;

    // Start capturing
    const present = (zone: any) => ({
      factionCounts: zone === neutralZone ? new Map([[1, 2]]) : new Map(),
    });
    economy.tickCapture(CAPTURE_TIME * 0.5, present);
    expect(neutralZone.captureProgress).toBeGreaterThan(0);

    // Units leave
    const empty = () => ({ factionCounts: new Map() });
    economy.tickCapture(CAPTURE_TIME * 0.3, empty);
    expect(neutralZone.captureProgress).toBeLessThan(0.5);

    // Full decay
    economy.tickCapture(CAPTURE_TIME, empty);
    expect(neutralZone.state).toBe(CaptureState.Neutral);
    expect(neutralZone.captureProgress).toBe(0);
  });

  it('isInOwnedZone works with hex boundaries', () => {
    const { economy, layout } = setupEconomy(2);

    // Find a zone owned by faction 1
    const owned = economy.zones.find(z => z.owner === 1)!;
    expect(owned).toBeDefined();

    // Point at zone center should be in owned zone
    expect(economy.isInOwnedZone(owned.def.worldX, owned.def.worldY, 1)).toBe(true);

    // Same point for wrong faction
    expect(economy.isInOwnedZone(owned.def.worldX, owned.def.worldY, 2)).toBe(false);
  });

  it('getTotalIncome reflects owned zone types', () => {
    const { economy } = setupEconomy(2);
    const income = economy.getTotalIncome(1);
    // Player 1 has 2 starter zones at 50/min (all mineral for starters)
    expect(income.minerals).toBe(100);
    expect(income.gas).toBe(0);
  });
});
