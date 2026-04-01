import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  createTestMap,
  Faction,
  CommandType,
} from '../helpers';
import { combatSystem } from '../../src/systems/CombatSystem';
import { commandSystem } from '../../src/systems/CommandSystem';
import { findFriendlyAt } from '../../src/ecs/queries';
import { hasComponents } from '../../src/ecs/world';
import {
  posX, posY,
  hpCurrent,
  atkRange, atkLastTime,
  targetEntity,
  commandMode,
  movePathIndex,
  patrolOriginX, patrolOriginY,
} from '../../src/ecs/components';
import type { World } from '../../src/ecs/world';
import type { MapData } from '../../src/map/MapData';

// CommandMode raw values — const enum erased at compile time, not in helpers
const CM_IDLE = 0;
const CM_HOLD_POSITION = 6;
const CM_PATROL = 7;

// Viewport mock — toWorld returns identity (screen coords === world coords)
const viewport = { toWorld: (x: number, y: number) => ({ x, y }) } as any;

describe('ControlQoL', () => {
  let world: World;
  let map: MapData;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    map = createTestMap();
    eids.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function unit(opts: Parameters<typeof spawnUnit>[1] = {}): number {
    const eid = spawnUnit(world, opts);
    eids.push(eid);
    return eid;
  }

  // ── Group 1: HoldPosition (combat behaviour) ────────────────────────────────

  describe('HoldPosition — combat behaviour', () => {
    it('fires at a target that is within attack range', () => {
      const attacker = unit({ x: 100, y: 100, factionId: Faction.Terran, range: 160, damage: 10 });
      const enemy = unit({ x: 140, y: 100, factionId: Faction.Zerg, hp: 50 });

      commandMode[attacker] = CM_HOLD_POSITION;
      atkLastTime[attacker] = -999; // allow immediate attack

      combatSystem(world, 1 / 60, 1.0, map);

      expect(hpCurrent[enemy]).toBe(40); // 50 - 10
    });

    it('does NOT chase a target that is out of attack range', () => {
      // atkRange default = 160px; place enemy 300px away
      const attacker = unit({ x: 100, y: 100, factionId: Faction.Terran, range: 160 });
      const enemy = unit({ x: 400, y: 100, factionId: Faction.Zerg, hp: 50 });

      commandMode[attacker] = CM_HOLD_POSITION;
      // Pre-assign the out-of-range target so we can verify it gets dropped
      targetEntity[attacker] = enemy;
      atkLastTime[attacker] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      // HoldPosition must drop the target rather than chase
      expect(targetEntity[attacker]).toBe(-1);
    });

    it('does NOT auto-acquire an enemy within 6-tile aggro range but outside attack range', () => {
      // Aggro range for HoldPosition === atkRange (no wider sweep).
      // Place enemy at 170px, which is inside the normal 6-tile (192px) aggro bubble
      // but outside the unit's 130px attack range.
      const attacker = unit({ x: 100, y: 100, factionId: Faction.Terran, range: 130 });
      const enemy = unit({ x: 270, y: 100, factionId: Faction.Zerg, hp: 50 }); // 170px away

      commandMode[attacker] = CM_HOLD_POSITION;
      atkLastTime[attacker] = -999;

      combatSystem(world, 1 / 60, 1.0, map);

      // Should not have acquired the out-of-range target
      expect(targetEntity[attacker]).toBe(-1);
    });
  });

  // ── Group 2: Patrol — origin recording ──────────────────────────────────────

  describe('Patrol — origin recording', () => {
    it('records the unit position as patrol origin on Patrol command', () => {
      const eid = unit({ x: 200, y: 200, factionId: Faction.Terran });

      commandSystem(world, [{ type: CommandType.Patrol, wx: 500, wy: 500, units: [eid] }], viewport, map, 0);

      expect(patrolOriginX[eid]).toBe(posX[eid]);
      expect(patrolOriginY[eid]).toBe(posY[eid]);
    });

    it('records the exact spawn coordinates as patrol origin', () => {
      const eid = unit({ x: 200, y: 200, factionId: Faction.Terran });

      commandSystem(world, [{ type: CommandType.Patrol, wx: 500, wy: 500, units: [eid] }], viewport, map, 0);

      expect(patrolOriginX[eid]).toBe(200);
      expect(patrolOriginY[eid]).toBe(200);
    });

    it('sets commandMode to Patrol (7) after a Patrol command', () => {
      const eid = unit({ x: 200, y: 200, factionId: Faction.Terran });

      commandSystem(world, [{ type: CommandType.Patrol, wx: 500, wy: 500, units: [eid] }], viewport, map, 0);

      expect(commandMode[eid]).toBe(CM_PATROL);
    });
  });

  // ── Group 3: HoldPosition command ───────────────────────────────────────────

  describe('HoldPosition command', () => {
    it('sets commandMode to HoldPosition (6) and clears the move path', () => {
      const eid = unit({ x: 100, y: 100, factionId: Faction.Terran });
      // Give the unit a fake active path index to confirm it gets cleared
      movePathIndex[eid] = 2;

      commandSystem(world, [{ type: CommandType.HoldPosition, units: [eid] }], viewport, map, 0);

      expect(commandMode[eid]).toBe(CM_HOLD_POSITION);
      expect(movePathIndex[eid]).toBe(-1);
    });

    it('Stop command sets commandMode to Idle (0) — separate from HoldPosition', () => {
      const eid = unit({ x: 100, y: 100, factionId: Faction.Terran });
      commandMode[eid] = CM_HOLD_POSITION; // start in hold

      commandSystem(world, [{ type: CommandType.Stop, units: [eid] }], viewport, map, 0);

      expect(commandMode[eid]).toBe(CM_IDLE);
    });
  });

  // ── Group 4: findFriendlyAt ──────────────────────────────────────────────────

  describe('findFriendlyAt', () => {
    it('returns a friendly unit entity within 32px tolerance', () => {
      const eid = unit({ x: 100, y: 100, factionId: Faction.Terran });

      // Query at the exact same position — should find it
      const result = findFriendlyAt(world, 100, 100, Faction.Terran);

      expect(result).toBe(eid);
    });

    it('does NOT return an enemy faction unit', () => {
      unit({ x: 100, y: 100, factionId: Faction.Zerg });

      const result = findFriendlyAt(world, 100, 100, Faction.Terran);

      expect(result).toBe(0);
    });

    it('does NOT return a dead unit (hpCurrent = 0)', () => {
      const eid = unit({ x: 100, y: 100, factionId: Faction.Terran });
      hpCurrent[eid] = 0;

      const result = findFriendlyAt(world, 100, 100, Faction.Terran);

      expect(result).toBe(0);
    });

    it('returns 0 when nothing is in range', () => {
      unit({ x: 100, y: 100, factionId: Faction.Terran });

      // Query far away — beyond 32px tolerance
      const result = findFriendlyAt(world, 500, 500, Faction.Terran);

      expect(result).toBe(0);
    });
  });
});
