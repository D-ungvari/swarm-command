import { describe, it, expect, beforeEach } from 'vitest';
import { GameCommandQueue } from '../../src/input/CommandQueue';
import { CommandType } from '../helpers';

describe('GameCommandQueue', () => {
  let queue: GameCommandQueue;

  beforeEach(() => {
    queue = new GameCommandQueue();
  });

  it('starts empty', () => {
    expect(queue.length).toBe(0);
    expect(queue.flush()).toEqual([]);
  });

  it('push increases length', () => {
    queue.push({ type: CommandType.Move, wx: 100, wy: 200 });
    expect(queue.length).toBe(1);
  });

  it('flush returns commands in FIFO order', () => {
    queue.push({ type: CommandType.Move, wx: 10, wy: 20 });
    queue.push({ type: CommandType.Stop });
    queue.push({ type: CommandType.Stim });

    const result = queue.flush();
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe(CommandType.Move);
    expect(result[1].type).toBe(CommandType.Stop);
    expect(result[2].type).toBe(CommandType.Stim);
  });

  it('flush drains the queue', () => {
    queue.push({ type: CommandType.Move, wx: 1, wy: 2 });
    queue.flush();

    expect(queue.length).toBe(0);
    expect(queue.flush()).toEqual([]);
  });

  it('flush after flush returns empty array (idempotent drain)', () => {
    queue.push({ type: CommandType.AttackMove, wx: 50, wy: 50 });
    queue.flush();
    const second = queue.flush();
    expect(second).toEqual([]);
  });

  it('two Move commands both survive — zero event drop', () => {
    queue.push({ type: CommandType.Move, wx: 100, wy: 100 });
    queue.push({ type: CommandType.Move, wx: 200, wy: 200 });

    const result = queue.flush();
    expect(result).toHaveLength(2);
    expect(result[0].wx).toBe(100);
    expect(result[1].wx).toBe(200);
  });

  it('two right-clicks produce two separate Move commands', () => {
    // This is the core regression test for the click-loss bug
    queue.push({ type: CommandType.Move, wx: 300, wy: 400, units: [1, 2] });
    queue.push({ type: CommandType.Move, wx: 500, wy: 600, units: [1, 2] });

    const cmds = queue.flush();
    expect(cmds).toHaveLength(2);
    expect(cmds[0].wx).toBe(300);
    expect(cmds[0].wy).toBe(400);
    expect(cmds[1].wx).toBe(500);
    expect(cmds[1].wy).toBe(600);
  });

  it('preserves all GameCommand fields', () => {
    const cmd = {
      type: CommandType.Move,
      wx: 128, wy: 256,
      targetEid: 42,
      units: [1, 2, 3],
      data: 7,
      shiftHeld: true,
    };
    queue.push(cmd);
    const result = queue.flush();
    expect(result[0]).toEqual(cmd);
  });

  it('can mix different command types', () => {
    queue.push({ type: CommandType.Select, sx: 10, sy: 20 });
    queue.push({ type: CommandType.Move, wx: 50, wy: 60, units: [1] });
    queue.push({ type: CommandType.ControlGroupAssign, data: 3 });

    const result = queue.flush();
    expect(result[0].type).toBe(CommandType.Select);
    expect(result[1].type).toBe(CommandType.Move);
    expect(result[2].type).toBe(CommandType.ControlGroupAssign);
    expect(result[2].data).toBe(3);
  });

  it('push after flush works correctly', () => {
    queue.push({ type: CommandType.Stop });
    queue.flush();

    queue.push({ type: CommandType.Stim, units: [5] });
    const result = queue.flush();
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(CommandType.Stim);
    expect(result[0].units).toEqual([5]);
  });
});
