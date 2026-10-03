import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWildsInput } from './input.js';
import { createFeelSimulation } from '../../core/wilds/feel.js';

function fixture(t, options = {}) {
  const originals = new Map(['document', 'window', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const document = new EventTarget(), window = new EventTarget(), canvas = new EventTarget(), captures = new Set(), calls = [];
  document.closest = () => null;
  canvas.focus = () => {};
  canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => captures.delete(id);
  let pads = [];
  for (const [key, value] of Object.entries({ document, window, navigator: { getGamepads: () => pads } })) Object.defineProperty(globalThis, key, { configurable: true, value });
  const input = createWildsInput(canvas, { pause: () => calls.push('pause'), lock: () => calls.push('lock'), mute: () => calls.push('mute'), orbit: (...args) => calls.push(['orbit', ...args]), zoom: value => calls.push(['zoom', value]), ...options });
  t.after(() => {
    input.dispose();
    for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  });
  const send = (target, type, values = {}) => { const event = new Event(type, { cancelable: true }); Object.assign(event, values); target.dispatchEvent(event); return event; };
  return { input, canvas, document, window, captures, calls, send, key: code => send(document, 'keydown', { code }), pads: value => { pads = value; } };
}
function pad(...pressed) {
  return { connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })) };
}

test('Space keeps its native button activation in the pause menu', t => {
  const f = fixture(t);
  f.document.closest = selector => selector.includes('button') ? f.document : null;
  assert.equal(f.key('Space').defaultPrevented, false);
  assert.equal(f.send(f.document, 'keyup', { code: 'Space' }).defaultPrevented, false);
  assert.equal(f.input.read(0, 1 / 60).jump, undefined);
});

test('release discards queued movement, jump, dodge and attacks and frees pointer capture', t => {
  const f = fixture(t);
  f.key('KeyW'); f.key('Space'); f.key('ControlLeft');
  f.send(f.canvas, 'pointerdown', { button: 0, pointerId: 2, clientX: 0, clientY: 0 });
  f.input.release();
  const result = f.input.read(0, 1 / 60);
  assert.equal(result.moveZ, 0);
  assert.equal(result.jump, undefined);
  assert.equal(result.dodge, undefined);
  assert.equal(result.attackPressed, undefined);
  assert.equal(result.attackHeld, false);
  assert.equal(result.attackCancelled, true);
  assert.equal(f.captures.size, 0);
});

test('Escape immediately after a paused jump does not queue an action on resume', t => {
  const f = fixture(t), sim = createFeelSimulation();
  f.key('Space'); f.key('Escape');
  sim.step(1 / 60, f.input.read(0, 1 / 60));
  assert.deepEqual(f.calls, ['pause']);
  assert.equal(sim.state.counts.jump, 0);
  f.key('Space');
  sim.step(1 / 60, f.input.read(0, 1 / 60));
  assert.equal(sim.state.counts.jump, 1);
});

test('blur clears a queued dodge while dragging cancels attack and orbits', t => {
  const f = fixture(t);
  f.key('ControlRight'); f.send(f.window, 'blur');
  assert.equal(f.input.read(0, 1 / 60).dodge, undefined);
  f.send(f.canvas, 'pointerdown', { button: 0, pointerId: 3, clientX: 1, clientY: 1 });
  f.input.read(0, 1 / 60);
  f.send(f.canvas, 'pointermove', { pointerId: 3, clientX: 20, clientY: 5 });
  const result = f.input.read(0, 1 / 60);
  assert.equal(result.attackCancelled, true);
  assert.equal(result.attackHeld, false);
  assert.deepEqual(f.calls.at(-1), ['orbit', 19, 4]);
});

test('gamepad attacks hold, release and cancel on device disconnection', t => {
  const f = fixture(t), sim = createFeelSimulation();
  f.pads([pad(7)]);
  const first = f.input.read(0, 1 / 60);
  assert.equal(first.attackPressed, true);
  assert.equal(first.attackHeld, true);
  sim.step(1 / 60, first);
  assert.equal(sim.state.action.kind, 'charge');
  assert.equal(f.input.read(0, 1 / 60).attackPressed, undefined);
  f.pads([]);
  const disconnected = f.input.read(0, 1 / 60);
  assert.equal(disconnected.attackHeld, false);
  assert.equal(disconnected.attackCancelled, true);
  sim.step(1 / 60, disconnected);
  assert.equal(sim.state.action.kind, 'idle');
  f.pads([pad(2)]); sim.step(1 / 60, f.input.read(0, 1 / 60));
  f.pads([pad()]); sim.step(1 / 60, f.input.read(0, 1 / 60));
  assert.equal(sim.state.counts.lightAttacks, 1);
});

test('press and camera drag within one frame cancel charging and preserve the next click', t => {
  const f = fixture(t), sim = createFeelSimulation();
  f.send(f.canvas, 'pointerdown', { button: 0, pointerId: 4, clientX: 0, clientY: 0 });
  f.send(f.canvas, 'pointermove', { pointerId: 4, clientX: 20, clientY: 5 });
  f.send(f.canvas, 'pointerup', { pointerId: 4 });
  sim.step(1 / 30, f.input.read(0, 1 / 30));
  assert.equal(sim.state.action.kind, 'idle');
  assert.equal(sim.state.counts.attack, 0);
  f.key('KeyW');
  for (let frame = 0; frame < 10; frame++) sim.step(1 / 30, f.input.read(0, 1 / 30));
  assert.equal(sim.state.action.kind, 'run');
  assert.ok(sim.state.player.z < 1);
  f.send(f.canvas, 'pointerdown', { button: 0, pointerId: 5, clientX: 0, clientY: 0 });
  f.send(f.canvas, 'pointerup', { pointerId: 5 });
  sim.step(1 / 30, f.input.read(0, 1 / 30));
  assert.equal(sim.state.action.kind, 'light1');
  assert.equal(sim.state.counts.lightAttacks, 1);
});

test('gamepad button edges map to jump, roll, lock, sprint and pause', t => {
  const f = fixture(t);
  f.pads([pad(0, 1, 4, 10)]);
  const first = f.input.read(0, 1 / 60), second = f.input.read(0, 1 / 60);
  assert.equal(first.jump, true);
  assert.equal(first.dodge, true);
  assert.equal(first.sprint, true);
  assert.equal(second.jump, undefined);
  assert.equal(second.dodge, undefined);
  assert.equal(f.calls.filter(value => value === 'lock').length, 1);
  f.pads([pad(9)]); f.input.read(0, 1 / 60); f.input.read(0, 1 / 60);
  assert.equal(f.calls.filter(value => value === 'pause').length, 1);
});

test('disposing input removes document and canvas behavior', t => {
  const f = fixture(t);
  f.input.dispose(); f.input.read(0, 1 / 60);
  f.key('Escape'); f.key('Space');
  f.send(f.canvas, 'wheel', { deltaY: 100 });
  assert.deepEqual(f.calls, []);
  assert.equal(f.input.read(0, 1 / 60).jump, undefined);
});

test('partner and camp inputs are edge-triggered on keyboard and gamepad', t => {
  const f = fixture(t);
  f.key('KeyQ'); f.key('KeyE');
  let controls = f.input.read(0, 1 / 60);
  assert.equal(controls.petSkill, true);
  assert.equal(controls.interact, true);
  controls = f.input.read(0, 1 / 60);
  assert.equal(controls.petSkill, undefined);
  assert.equal(controls.interact, undefined);
  f.pads([pad(3, 6)]);
  controls = f.input.read(0, 1 / 60);
  assert.equal(controls.petSkill, true);
  assert.equal(controls.interact, true);
  assert.equal(f.input.read(0, 1 / 60).petSkill, undefined);
});

test('accepted keyboard input unlocks synchronously before capture blocks later listeners', t => {
  const order = [], f = fixture(t, { onInteraction: () => order.push('unlock') });
  f.document.addEventListener('keydown', () => order.push('bubble'));
  f.key('KeyW');
  assert.deepEqual(order, ['unlock']);
  f.send(f.document, 'keydown', { code: 'KeyW', repeat: true });
  assert.deepEqual(order, ['unlock']);
  f.document.closest = selector => selector.includes('input') ? f.document : null;
  f.key('KeyW');
  assert.deepEqual(order, ['unlock', 'bubble']);
});

test('only deliberate pointer controls trigger interaction and disposal removes the callback', t => {
  let count = 0;
  const f = fixture(t, { onInteraction: () => count++ });
  f.send(f.canvas, 'pointermove', { pointerId: 1, clientX: 1, clientY: 1 });
  f.send(f.canvas, 'pointerdown', { button: 4, pointerId: 1 });
  f.send(f.canvas, 'wheel', { deltaY: 0 });
  assert.equal(count, 0);
  f.send(f.canvas, 'pointerdown', { button: 2, pointerId: 1 });
  f.send(f.canvas, 'wheel', { deltaY: 12 });
  assert.equal(count, 2);
  f.input.dispose();
  f.key('KeyW'); f.send(f.canvas, 'pointerdown', { button: 0, pointerId: 2 });
  assert.equal(count, 2);
});

test('gamepad connection and stick drift remain silent until an active button or axis interaction', t => {
  let count = 0;
  const f = fixture(t, { onInteraction: () => count++ });
  f.pads([pad()]); f.input.read(0, 1 / 60);
  const drifting = pad(); drifting.axes = [.16, -.05, .1, 0];
  f.pads([drifting]); f.input.read(0, 1 / 60);
  assert.equal(count, 0);
  const moving = pad(); moving.axes = [.4, 0, 0, 0];
  f.pads([moving]); f.input.read(0, 1 / 60); f.input.read(0, 1 / 60);
  assert.equal(count, 1);
  f.pads([pad()]); f.input.read(0, 1 / 60);
  f.pads([pad(7)]); f.input.read(0, 1 / 60); f.input.read(0, 1 / 60);
  assert.equal(count, 2);
  f.input.dispose(); f.input.read(0, 1 / 60);
  assert.equal(count, 2);
});
