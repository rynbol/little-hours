import test from 'node:test';
import assert from 'node:assert/strict';
import { createWildsInput } from './input.js';

function fixture() {
  const owner = new EventTarget(), host = new EventTarget(), canvas = new EventTarget();
  owner.defaultView = host;
  owner.hidden = false;
  owner.body = {};
  owner.activeElement = owner.body;
  owner.pointerLockElement = null;
  owner.exitPointerLock = () => { owner.pointerLockElement = null; };
  canvas.ownerDocument = owner;
  canvas.tabIndex = -1;
  canvas.focus = () => { owner.activeElement = canvas; };
  canvas.requestPointerLock = () => { owner.pointerLockElement = canvas; return Promise.resolve(); };
  const input = createWildsInput(canvas);
  function send(target, type, properties = {}) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, properties);
    target.dispatchEvent(event);
    return event;
  }
  return { owner, host, canvas, input, send, key: (type, code, properties) => send(host, type, { code, ...properties }) };
}

test('WASD and both Shift keys produce held axes, while opposing keys cancel', () => {
  const f = fixture();
  try {
    assert.equal(f.canvas.tabIndex, 0);
    assert.equal(f.key('keydown', 'KeyW').defaultPrevented, true);
    f.key('keydown', 'KeyD');
    f.key('keydown', 'ShiftRight');
    const first = f.input.read();
    assert.deepEqual([first.forward, first.strafe, first.sprint], [1, 1, true]);
    assert.equal(f.input.read().forward, 1);
    f.key('keydown', 'KeyS');
    assert.equal(f.input.read().forward, 0);
    f.key('keyup', 'KeyW');
    f.key('keyup', 'ShiftRight');
    const last = f.input.read();
    assert.deepEqual([last.forward, last.strafe, last.sprint], [-1, 1, false]);
  } finally { f.input.dispose(); }
});

test('Space has one jump edge and a held climb state despite repeated keyboard events', () => {
  const f = fixture();
  try {
    f.key('keydown', 'Space');
    assert.deepEqual([f.input.read().jump, f.input.read().climb], [true, true]);
    f.key('keydown', 'Space', { repeat: true });
    assert.equal(f.input.read().jump, false);
    f.key('keydown', 'Space');
    assert.equal(f.input.read().jump, false);
    f.key('keyup', 'Space');
    assert.equal(f.input.read().climb, false);
    f.key('keydown', 'Space');
    assert.equal(f.input.read().jump, true);
  } finally { f.input.dispose(); }
});

test('typing, menu focus, browser modifiers and previously handled events stay outside gameplay', () => {
  const f = fixture();
  try {
    f.owner.activeElement = { tagName: 'INPUT' };
    assert.equal(f.key('keydown', 'KeyW').defaultPrevented, false);
    assert.equal(f.input.read().forward, 0);
    f.owner.activeElement = f.canvas;
    f.key('keydown', 'KeyW');
    assert.equal(f.input.read().forward, 1);
    f.owner.activeElement = { tagName: 'BUTTON' };
    assert.equal(f.input.read().forward, 0);
    assert.equal(f.key('keydown', 'Space').defaultPrevented, false);
    f.owner.activeElement = f.canvas;
    assert.equal(f.key('keydown', 'KeyW', { metaKey: true }).defaultPrevented, false);
    assert.equal(f.key('keydown', 'KeyW', { altKey: true }).defaultPrevented, false);
    assert.equal(f.input.read().forward, 0);
    const handled = new Event('keydown', { cancelable: true });
    handled.code = 'KeyW';
    handled.preventDefault();
    f.host.dispatchEvent(handled);
    assert.equal(f.input.read().forward, 0);
  } finally { f.input.dispose(); }
});

test('blur and visibility transitions clear held movement and unconsumed actions', () => {
  const f = fixture();
  try {
    f.key('keydown', 'KeyW');
    f.key('keydown', 'Space');
    assert.equal(f.input.read().forward, 1);
    f.send(f.host, 'blur');
    assert.deepEqual([f.input.read().forward, f.input.read().climb], [0, false]);
    f.key('keydown', 'KeyD');
    assert.equal(f.input.read().strafe, 1);
    f.owner.hidden = true;
    f.send(f.owner, 'visibilitychange');
    f.owner.hidden = false;
    f.send(f.owner, 'visibilitychange');
    const resumed = f.input.read();
    assert.deepEqual([resumed.strafe, resumed.jump, resumed.climb], [0, false, false]);
  } finally { f.input.dispose(); }
});

test('a drag changes camera deltas once, then pointer release ends the drag', () => {
  const f = fixture();
  try {
    f.send(f.canvas, 'pointerdown', { pointerId: 3, button: 0, clientX: 10, clientY: 20 });
    f.send(f.host, 'pointermove', { pointerId: 3, clientX: 50, clientY: 35 });
    const dragged = f.input.read();
    assert.deepEqual([dragged.lookX, dragged.lookY, dragged.attackHeld], [40, 15, true]);
    assert.deepEqual(dragged.actions, ['attack']);
    assert.deepEqual([f.input.read().lookX, f.input.read().lookY], [0, 0]);
    f.send(f.host, 'pointerup', { pointerId: 3, button: 0 });
    f.send(f.host, 'pointermove', { pointerId: 3, clientX: 90, clientY: 75 });
    const released = f.input.read();
    assert.deepEqual([released.lookX, released.lookY, released.attackHeld], [0, 0, false]);
    assert.equal(f.owner.activeElement, f.canvas);
  } finally { f.input.dispose(); }
});

test('pointer lock consumes relative motion and Escape releases it with cleared held input', () => {
  const f = fixture();
  try {
    f.send(f.canvas, 'dblclick');
    assert.equal(f.owner.pointerLockElement, f.canvas);
    f.send(f.host, 'pointermove', { movementX: -18, movementY: 7 });
    const locked = f.input.read();
    assert.deepEqual([locked.lookX, locked.lookY], [-18, 7]);
    f.key('keydown', 'KeyW');
    assert.equal(f.input.read().forward, 1);
    f.key('keydown', 'Escape');
    assert.equal(f.owner.pointerLockElement, null);
    assert.equal(f.input.read().forward, 0);
  } finally { f.input.dispose(); }
});

test('future action keys have edges and disposal removes every gameplay listener', () => {
  const f = fixture();
  f.key('keydown', 'KeyE');
  f.key('keydown', 'KeyQ');
  assert.deepEqual(f.input.consume().actions, ['interact', 'skill']);
  f.key('keydown', 'KeyE', { repeat: true });
  assert.deepEqual(f.input.read().actions, []);
  f.input.dispose();
  f.input.dispose();
  assert.equal(f.canvas.tabIndex, -1);
  assert.equal(f.key('keydown', 'KeyW').defaultPrevented, false);
  f.send(f.canvas, 'pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0 });
  f.send(f.host, 'pointermove', { pointerId: 1, clientX: 20, clientY: 20 });
  const disposed = f.input.read();
  assert.deepEqual([disposed.forward, disposed.lookX, disposed.lookY, disposed.block], [0, 0, 0, false]);
});
