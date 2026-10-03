import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createInput } from './input.js';

let clock, canvas, input, muted;
const key = (type, code, extra = {}) => window.dispatchEvent(Object.assign(new Event(type), { code, repeat: false, metaKey: false, preventDefault() {}, ...extra }));
const pointer = (type, extra = {}) => canvas.dispatchEvent(Object.assign(new Event(type), { button: 0, pointerId: 1, movementX: 0, movementY: 0, preventDefault() {}, ...extra }));
const wait = ms => { clock += ms; };

beforeEach(() => {
  clock = 0; muted = 0;
  globalThis.window = new EventTarget();
  canvas = Object.assign(new EventTarget(), { focus() {}, setPointerCapture() {} });
  input = createInput(canvas, { now: () => clock, onMute: () => { muted++; } });
});
afterEach(() => { input.dispose(); delete globalThis.window; });

test('held keys move relative to where the camera faces', () => {
  key('keydown', 'KeyW');
  const ahead = input.sample(0, 1 / 60);
  assert.deepEqual([ahead.x, ahead.z], [0, 1]);
  const turned = input.sample(Math.PI / 2, 1 / 60);
  assert.ok(Math.abs(turned.x - 1) < 1e-9 && Math.abs(turned.z) < 1e-9);
  key('keydown', 'KeyD');
  const diagonal = input.sample(0, 1 / 60);
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 1e-9, 'diagonals are not faster');
  key('keyup', 'KeyW'); key('keyup', 'KeyD');
  assert.deepEqual([input.sample(0, 1 / 60).x, input.sample(0, 1 / 60).z], [0, 0]);
});

test('a jump fires once per press, and auto-repeat does not jump again', () => {
  key('keydown', 'Space');
  assert.equal(input.sample(0, 1 / 60).jump, true);
  key('keydown', 'Space', { repeat: true });
  assert.equal(input.sample(0, 1 / 60).jump, false);
});

test('a quick click is a light attack, a held click charges and releases a heavy', () => {
  pointer('pointerdown');
  assert.equal(input.sample(0, 1 / 60).attack, null, 'waits a moment to tell a click from a drag');
  wait(60);
  assert.equal(input.sample(0, 1 / 60).attack, 'light');
  assert.equal(input.sample(0, 1 / 60).attack, null, 'one attack per press');
  wait(300);
  const held = input.sample(0, 1 / 60);
  assert.equal(held.charging, true);
  pointer('pointerup');
  const released = input.sample(0, 1 / 60);
  assert.equal(released.release, true);
  assert.equal(released.charging, false);
});

test('dragging orbits the camera instead of attacking', () => {
  pointer('pointerdown');
  pointer('pointermove', { movementX: 40, movementY: -10 });
  wait(80);
  const out = input.sample(0, 1 / 60);
  assert.equal(out.attack, null);
  assert.ok(out.orbit.x > .1 && out.orbit.y < 0);
  assert.equal(out.steering, true);
  assert.equal(input.sample(0, 1 / 60).orbit.x, 0, 'orbit is consumed once');
});

test('ctrl and the right button both dodge, and M mutes without acting', () => {
  key('keydown', 'ControlLeft');
  assert.equal(input.sample(0, 1 / 60).dodge, true);
  pointer('pointerdown', { button: 2 });
  assert.equal(input.sample(0, 1 / 60).dodge, true);
  key('keydown', 'KeyM');
  const out = input.sample(0, 1 / 60);
  assert.equal(muted, 1);
  assert.equal(out.dodge || out.jump || out.lock || out.interact || out.skill, false);
});

test('a paused game ignores keys and forgets what was held', () => {
  key('keydown', 'KeyW');
  input.enabled = false;
  key('keydown', 'Space');
  input.enabled = true;
  const out = input.sample(0, 1 / 60);
  assert.equal(out.z, 0);
  assert.equal(out.jump, false);
});
