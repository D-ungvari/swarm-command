import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestWorld,
  spawnUnit,
  cleanupEntities,
  Faction,
} from '../helpers';
import { deathSystem, deathEvents } from '../../src/systems/DeathSystem';
import {
  hpCurrent,
  posX,
  posY,
  faction,
  resetComponents,
} from '../../src/ecs/components';
import { entityExists, type World } from '../../src/ecs/world';

describe('DeathSystem', () => {
  let world: World;
  const eids: number[] = [];

  beforeEach(() => {
    world = createTestWorld();
    eids.length = 0;
    // Drain any leftover death events from previous tests
    deathEvents.length = 0;
  });

  afterEach(() => {
    cleanupEntities(eids);
    deathEvents.length = 0;
  });

  function track(eid: number): number {
    eids.push(eid);
    return eid;
  }

  // ── Entity removal ──

  describe('entity removal', () => {
    it('removes entities with hp <= 0', () => {
      const eid = track(spawnUnit(world, {
        x: 200, y: 300, factionId: Faction.Zerg, hp: 50,
      }));
      hpCurrent[eid] = 0;

      // First tick: starts death animation
      deathSystem(world, 1.0);
      // Second tick: after animation duration (0.3s), entity is removed
      deathSystem(world, 1.4);

      expect(entityExists(world, eid)).toBe(false);
    });

    it('removes entities with negative hp', () => {
      const eid = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, hp: 50,
      }));
      hpCurrent[eid] = -10;

      // First tick: starts death animation
      deathSystem(world, 1.0);
      // Second tick: after animation duration (0.3s), entity is removed
      deathSystem(world, 1.4);

      expect(entityExists(world, eid)).toBe(false);
    });

    it('does not remove entities with hp > 0', () => {
      const eid = track(spawnUnit(world, {
        x: 100, y: 100, factionId: Faction.Terran, hp: 50,
      }));

      deathSystem(world, 1.0);

      expect(entityExists(world, eid)).toBe(true);
    });

    it('removes multiple dead entities in one pass', () => {
      const a = track(spawnUnit(world, { factionId: Faction.Terran, hp: 10 }));
      const b = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 10 }));
      const alive = track(spawnUnit(world, { factionId: Faction.Terran, hp: 50 }));
      hpCurrent[a] = 0;
      hpCurrent[b] = -5;

      // First tick: starts death animation; second tick: removes after animation
      deathSystem(world, 1.0);
      deathSystem(world, 1.4);

      expect(entityExists(world, a)).toBe(false);
      expect(entityExists(world, b)).toBe(false);
      expect(entityExists(world, alive)).toBe(true);
    });
  });

  // ── Death events ──

  describe('death events', () => {
    it('records a death event with correct position and faction', () => {
      const eid = track(spawnUnit(world, {
        x: 250, y: 350, factionId: Faction.Zerg, hp: 10,
      }));
      hpCurrent[eid] = 0;

      deathSystem(world, 5.0);

      expect(deathEvents).toHaveLength(1);
      expect(deathEvents[0]).toEqual({
        x: 250,
        y: 350,
        faction: Faction.Zerg,
        time: 5.0,
      });
    });

    it('records multiple death events', () => {
      const a = track(spawnUnit(world, { x: 10, y: 20, factionId: Faction.Terran, hp: 5 }));
      const b = track(spawnUnit(world, { x: 30, y: 40, factionId: Faction.Zerg, hp: 5 }));
      hpCurrent[a] = 0;
      hpCurrent[b] = 0;

      deathSystem(world, 2.0);

      expect(deathEvents).toHaveLength(2);
    });

    it('cleans up old death events beyond lifetime', () => {
      // Manually push an old event
      deathEvents.push({ x: 0, y: 0, faction: 1, time: 0.0 });
      deathEvents.push({ x: 1, y: 1, faction: 2, time: 0.1 });

      // Run at a time where both old events have expired (lifetime = 0.5s)
      deathSystem(world, 1.0);

      expect(deathEvents).toHaveLength(0);
    });

    it('keeps recent death events', () => {
      deathEvents.push({ x: 0, y: 0, faction: 1, time: 0.8 });

      // Run at t=1.0 — the event at t=0.8 is only 0.2s old (< 0.5s lifetime)
      deathSystem(world, 1.0);

      expect(deathEvents).toHaveLength(1);
    });
  });

  // ── Component reset ──

  describe('component reset', () => {
    it('resets component data for dead entities', () => {
      const eid = track(spawnUnit(world, {
        x: 123, y: 456, factionId: Faction.Terran, hp: 10,
      }));
      hpCurrent[eid] = 0;

      // First tick: starts death animation; second tick: removes after animation
      deathSystem(world, 1.0);
      deathSystem(world, 1.4);

      // After resetComponents, all values should be zeroed
      expect(posX[eid]).toBe(0);
      expect(posY[eid]).toBe(0);
      expect(hpCurrent[eid]).toBe(0);
      expect(faction[eid]).toBe(0);
    });
  });

  // ── World entity count ──

  describe('entity count', () => {
    it('decrements entityCount for each removed entity', () => {
      track(spawnUnit(world, { factionId: Faction.Terran, hp: 50 }));
      const dead = track(spawnUnit(world, { factionId: Faction.Zerg, hp: 10 }));
      hpCurrent[dead] = 0;

      expect(world.entityCount).toBe(2);
      // First tick: starts death animation; second tick: removes after animation
      deathSystem(world, 1.0);
      deathSystem(world, 1.4);
      expect(world.entityCount).toBe(1);
    });
  });
});
