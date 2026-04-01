import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { selectionSystem } from '../../src/systems/SelectionSystem';
import { selected, faction, posX, posY, renderWidth, renderHeight } from '../../src/ecs/components';
import {
  createTestWorld, spawnUnit, cleanupEntities,
  Faction, UnitType, CommandType,
} from '../helpers';
import type { World } from '../../src/ecs/world';

/** Minimal mock viewport for tests: screen coords = world coords */
function mockViewport() {
  return {
    toWorld: (x: number, y: number) => ({ x, y }),
    toScreen: (x: number, y: number) => ({ x, y }),
    screenWidth: 1920,
    screenHeight: 1080,
  } as any;
}

describe('selectionSystem', () => {
  let world: World;
  let eids: number[] = [];
  const viewport = mockViewport();

  beforeEach(() => {
    world = createTestWorld();
    eids = [];
  });

  afterEach(() => {
    cleanupEntities(eids);
  });

  function spawn(opts = {}) {
    const eid = spawnUnit(world, opts);
    eids.push(eid);
    renderWidth[eid] = 12;
    renderHeight[eid] = 12;
    return eid;
  }

  it('Select command at unit position selects that unit', () => {
    const eid = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    selectionSystem(world, [{ type: CommandType.Select, sx: 100, sy: 100 }], viewport);
    expect(selected[eid]).toBe(1);
  });

  it('Select command clears previous selection when shiftHeld is false', () => {
    const a = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    const b = spawn({ x: 300, y: 300, factionId: Faction.Terran });
    selected[a] = 1;

    selectionSystem(world, [{ type: CommandType.Select, sx: 300, sy: 300, shiftHeld: false }], viewport);
    expect(selected[a]).toBe(0);
    expect(selected[b]).toBe(1);
  });

  it('Select command with shiftHeld adds to selection', () => {
    const a = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    const b = spawn({ x: 300, y: 300, factionId: Faction.Terran });
    selected[a] = 1;

    selectionSystem(world, [{ type: CommandType.Select, sx: 300, sy: 300, shiftHeld: true }], viewport);
    expect(selected[a]).toBe(1);
    expect(selected[b]).toBe(1);
  });

  it('Select on empty space clears selection', () => {
    const eid = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    selected[eid] = 1;

    selectionSystem(world, [{ type: CommandType.Select, sx: 900, sy: 900 }], viewport);
    expect(selected[eid]).toBe(0);
  });

  it('does not select Zerg units via left-click', () => {
    const zerg = spawn({ x: 100, y: 100, factionId: Faction.Zerg });
    selectionSystem(world, [{ type: CommandType.Select, sx: 100, sy: 100 }], viewport);
    expect(selected[zerg]).toBe(0);
  });

  it('BoxSelect selects all Terran units within bounds', () => {
    const inside1 = spawn({ x: 150, y: 150, factionId: Faction.Terran });
    const inside2 = spawn({ x: 250, y: 250, factionId: Faction.Terran });
    const outside = spawn({ x: 500, y: 500, factionId: Faction.Terran });

    selectionSystem(world, [{
      type: CommandType.BoxSelect,
      sx: 100, sy: 100, sx2: 300, sy2: 300,
      shiftHeld: false,
    }], viewport);

    expect(selected[inside1]).toBe(1);
    expect(selected[inside2]).toBe(1);
    expect(selected[outside]).toBe(0);
  });

  it('BoxSelect clears previous selection when shiftHeld is false', () => {
    const prev = spawn({ x: 10, y: 10, factionId: Faction.Terran });
    const inbox = spawn({ x: 150, y: 150, factionId: Faction.Terran });
    selected[prev] = 1;

    selectionSystem(world, [{
      type: CommandType.BoxSelect,
      sx: 100, sy: 100, sx2: 200, sy2: 200,
      shiftHeld: false,
    }], viewport);

    expect(selected[prev]).toBe(0);
    expect(selected[inbox]).toBe(1);
  });

  it('BoxSelect with shiftHeld adds to selection', () => {
    const prev = spawn({ x: 10, y: 10, factionId: Faction.Terran });
    const inbox = spawn({ x: 150, y: 150, factionId: Faction.Terran });
    selected[prev] = 1;

    selectionSystem(world, [{
      type: CommandType.BoxSelect,
      sx: 100, sy: 100, sx2: 200, sy2: 200,
      shiftHeld: true,
    }], viewport);

    expect(selected[prev]).toBe(1);
    expect(selected[inbox]).toBe(1);
  });

  it('BoxSelect does not select Zerg units', () => {
    const zerg = spawn({ x: 150, y: 150, factionId: Faction.Zerg });
    selectionSystem(world, [{
      type: CommandType.BoxSelect,
      sx: 100, sy: 100, sx2: 200, sy2: 200,
    }], viewport);
    expect(selected[zerg]).toBe(0);
  });

  it('DoubleClickSelect selects all on-screen units of same type', () => {
    const a = spawn({ x: 100, y: 100, factionId: Faction.Terran, unitTypeId: UnitType.Marine });
    const b = spawn({ x: 400, y: 400, factionId: Faction.Terran, unitTypeId: UnitType.Marine });
    const c = spawn({ x: 200, y: 200, factionId: Faction.Terran, unitTypeId: UnitType.SCV });

    selectionSystem(world, [{ type: CommandType.DoubleClickSelect, sx: 100, sy: 100 }], viewport);

    expect(selected[a]).toBe(1);
    expect(selected[b]).toBe(1); // same type, on screen
    expect(selected[c]).toBe(0); // different type
  });

  it('ControlGroupAssign stores current selection in group', () => {
    const a = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    const b = spawn({ x: 200, y: 200, factionId: Faction.Terran });
    selected[a] = 1;
    selected[b] = 1;

    selectionSystem(world, [{ type: CommandType.ControlGroupAssign, data: 1 }], viewport);

    // After assign, selection is unchanged — group is stored internally
    expect(selected[a]).toBe(1);
    expect(selected[b]).toBe(1);

    // Recall should restore the group
    selected[a] = 0;
    selected[b] = 0;
    selectionSystem(world, [{ type: CommandType.ControlGroupRecall, data: 1 }], viewport);
    expect(selected[a]).toBe(1);
    expect(selected[b]).toBe(1);
  });

  it('ControlGroupRecall replaces current selection', () => {
    const a = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    const b = spawn({ x: 200, y: 200, factionId: Faction.Terran });
    selected[a] = 1;
    selectionSystem(world, [{ type: CommandType.ControlGroupAssign, data: 2 }], viewport);

    // Now select b, then recall group 2
    selected[a] = 0;
    selected[b] = 1;
    selectionSystem(world, [{ type: CommandType.ControlGroupRecall, data: 2 }], viewport);

    expect(selected[a]).toBe(1);
    expect(selected[b]).toBe(0);
  });

  it('processes multiple commands in order within one call', () => {
    const a = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    const b = spawn({ x: 300, y: 300, factionId: Faction.Terran });

    selectionSystem(world, [
      { type: CommandType.Select, sx: 100, sy: 100 },          // select a
      { type: CommandType.Select, sx: 300, sy: 300, shiftHeld: true }, // add b
    ], viewport);

    expect(selected[a]).toBe(1);
    expect(selected[b]).toBe(1);
  });

  it('empty command list is a no-op', () => {
    const eid = spawn({ x: 100, y: 100, factionId: Faction.Terran });
    selected[eid] = 1;

    selectionSystem(world, [], viewport);
    expect(selected[eid]).toBe(1);
  });
});
