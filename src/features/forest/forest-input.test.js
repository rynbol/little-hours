import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOREST_INPUT, createForestInput } from './forest-input.js';

test('W, S, A, D and the arrow keys walk and strafe, and opposite keys cancel', () => {
  const input = createForestInput();
  input.key('KeyW', true); input.key('KeyD', true);
  assert.deepEqual({ ...input.read(0.1) }, { forward: 1, strafe: 1, turn: 0, look: 0 });
  input.key('ArrowDown', true);
  assert.equal(input.read(0.1).forward, 0);
  input.key('KeyW', false); input.key('KeyD', false);
  assert.deepEqual({ ...input.read(0.1) }, { forward: -1, strafe: 0, turn: 0, look: 0 });
});

test('the left and right arrows turn at a steady rate whatever the frame length', () => {
  const input = createForestInput();
  input.key('ArrowRight', true);
  assert.equal(input.read(0.5).turn, FOREST_INPUT.turnRate * 0.5);
  assert.equal(input.read(0.016).turn, FOREST_INPUT.turnRate * 0.016);
});

test('a drag is spent by the frame that reads it: right turns right, down looks down', () => {
  const input = createForestInput();
  input.drag(100, 50); input.drag(20, 0);
  const first = { ...input.read(0.016) };
  assert.ok(Math.abs(first.turn - 120 * FOREST_INPUT.drag) < 1e-12 && Math.abs(first.look + 50 * FOREST_INPUT.drag) < 1e-12, JSON.stringify(first));
  assert.deepEqual({ ...input.read(0.016) }, { forward: 0, strafe: 0, turn: 0, look: 0 });
});

test('the thumb stick walks forward when pushed up and adds to the keys without exceeding full speed', () => {
  const input = createForestInput();
  input.stick(0.5, -3);
  assert.deepEqual({ ...input.read(0.016) }, { forward: 1, strafe: 0.5, turn: 0, look: 0 });
  input.key('KeyW', true);
  assert.equal(input.read(0.016).forward, 1);
});

test('moving is true only while something is held or a drag is waiting, and release drops everything', () => {
  const input = createForestInput();
  assert.equal(input.moving, false);
  input.key('KeyQ', true);
  assert.equal(input.moving, false); assert.equal(input.handles('KeyQ'), false); assert.equal(input.handles('KeyW'), true);
  input.key('KeyW', true); input.stick(1, 0);
  assert.equal(input.moving, true);
  input.release();
  assert.equal(input.moving, false);
  input.drag(4, 0);
  assert.equal(input.moving, true);
  input.read(0.016);
  assert.equal(input.moving, false);
});
