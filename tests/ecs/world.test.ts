import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createWorld,
  addEntity,
  removeEntity,
  entityExists,
  hasComponents,
  queryEntities,
  queryEntitiesArray,
  type World,
} from '../../src/ecs/world';
import {
  addUnitComponents,
  resetComponents,
  POSITION,
  HEALTH,
  ATTACK,
  VELOCITY,
  MOVEMENT,
  SELECTABLE,
  RENDERABLE,
  UNIT_TYPE,
} from '../../src/ecs/components';

describe('ECS World', () => {
  let world: World;
  const usedEids: number[] = [];

  beforeEach(() => {
    world = createWorld();
    usedEids.length = 0;
  });

  afterEach(() => {
    for (const eid of usedEids) resetComponents(eid);
  });

  function track(eid: number): number {
    usedEids.push(eid);
    return eid;
  }

  // ── addEntity ──

  describe('addEntity', () => {
    it('returns entity IDs starting at 1', () => {
      const eid = track(addEntity(world));
      expect(eid).toBe(1);
    });

    it('returns sequential IDs', () => {
      const a = track(addEntity(world));
      const b = track(addEntity(world));
      const c = track(addEntity(world));
      expect(a).toBe(1);
      expect(b).toBe(2);
      expect(c).toBe(3);
    });

    it('increments entityCount', () => {
      expect(world.entityCount).toBe(0);
      track(addEntity(world));
      expect(world.entityCount).toBe(1);
      track(addEntity(world));
      expect(world.entityCount).toBe(2);
    });

    it('initializes mask to 0', () => {
      const eid = track(addEntity(world));
      expect(world.mask[eid]).toBe(0);
    });
  });

  // ── removeEntity ──

  describe('removeEntity', () => {
    it('sets mask to 0 and decrements entityCount', () => {
      const eid = track(addEntity(world));
      addUnitComponents(world, eid);
      expect(world.mask[eid]).not.toBe(0);
      expect(world.entityCount).toBe(1);

      removeEntity(world, eid);
      expect(world.mask[eid]).toBe(0);
      expect(world.entityCount).toBe(0);
    });

    it('recycles IDs via freeList', () => {
      const a = track(addEntity(world));
      addUnitComponents(world, a); // must have mask > 0 for removeEntity to work
      const b = track(addEntity(world));
      removeEntity(world, a);

      const c = track(addEntity(world));
      // 'a' was freed, so the next addEntity reuses it
      expect(c).toBe(a);
    });

    it('is idempotent (removing twice does not double-decrement)', () => {
      const eid = track(addEntity(world));
      addUnitComponents(world, eid);
      removeEntity(world, eid);
      expect(world.entityCount).toBe(0);
      removeEntity(world, eid);
      expect(world.entityCount).toBe(0);
    });
  });

  // ── entityExists ──

  describe('entityExists', () => {
    it('returns false for eid 0 (reserved)', () => {
      expect(entityExists(world, 0)).toBe(false);
    });

    it('returns false before any component is added', () => {
      const eid = track(addEntity(world));
      // mask is 0 right after addEntity
      expect(entityExists(world, eid)).toBe(false);
    });

    it('returns true after components are added', () => {
      const eid = track(addEntity(world));
      addUnitComponents(world, eid);
      expect(entityExists(world, eid)).toBe(true);
    });

    it('returns false after removal', () => {
      const eid = track(addEntity(world));
      addUnitComponents(world, eid);
      removeEntity(world, eid);
      expect(entityExists(world, eid)).toBe(false);
    });

    it('returns false for out-of-range IDs', () => {
      expect(entityExists(world, -1)).toBe(false);
      expect(entityExists(world, 99999)).toBe(false);
    });
  });

  // ── hasComponents ──

  describe('hasComponents', () => {
    it('returns true when entity has all requested bits', () => {
      const eid = track(addEntity(world));
      addUnitComponents(world, eid);
      expect(hasComponents(world, eid, POSITION | HEALTH)).toBe(true);
      expect(hasComponents(world, eid, ATTACK | VELOCITY)).toBe(true);
    });

    it('returns false when entity is missing bits', () => {
      const eid = track(addEntity(world));
      world.mask[eid] = POSITION; // only position
      expect(hasComponents(world, eid, POSITION | HEALTH)).toBe(false);
    });
  });

  // ── queryEntities (generator) ──

  describe('queryEntities', () => {
    it('yields entities matching the bitmask', () => {
      const a = track(addEntity(world));
      const b = track(addEntity(world));
      const c = track(addEntity(world));
      addUnitComponents(world, a);
      addUnitComponents(world, c);
      // b has no components

      const result = [...queryEntities(world, POSITION | HEALTH)];
      expect(result).toContain(a);
      expect(result).toContain(c);
      expect(result).not.toContain(b);
    });

    it('yields nothing for empty world', () => {
      const result = [...queryEntities(world, POSITION)];
      expect(result).toHaveLength(0);
    });
  });

  // ── queryEntitiesArray ──

  describe('queryEntitiesArray', () => {
    it('fills the output array with matching eids and returns count', () => {
      const a = track(addEntity(world));
      const b = track(addEntity(world));
      const c = track(addEntity(world));
      addUnitComponents(world, a);
      addUnitComponents(world, b);
      // c has no components

      const out = new Array(10);
      const count = queryEntitiesArray(world, POSITION | HEALTH, out);
      expect(count).toBe(2);
      expect(out.slice(0, count)).toContain(a);
      expect(out.slice(0, count)).toContain(b);
    });

    it('returns 0 when no entities match', () => {
      track(addEntity(world));
      const out = new Array(10);
      const count = queryEntitiesArray(world, POSITION, out);
      expect(count).toBe(0);
    });
  });

  // ── addUnitComponents bitmask ──

  describe('addUnitComponents', () => {
    it('sets all unit component bits', () => {
      const eid = track(addEntity(world));
      addUnitComponents(world, eid);
      const allBits = POSITION | VELOCITY | HEALTH | ATTACK | MOVEMENT | SELECTABLE | RENDERABLE | UNIT_TYPE;
      expect(hasComponents(world, eid, allBits)).toBe(true);
    });
  });
});
