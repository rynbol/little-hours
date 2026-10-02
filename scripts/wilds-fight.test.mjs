import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { prepareFight, driveFight } from './lh/wilds-fight.mjs';

function frame({ elapsedMs = 1000, health = 420, events = [], position = { x: -132, y: -31, z: -212 }, mode = 'recovery', frozen = false, phase = 'running' } = {}) {
  return {
    player: { position, stamina: 100 }, cameraYaw: 0, elapsedMs, phase, frozen, events,
    combat: { targetId: 'mossback-warden', playerAction: null, boss: { id: 'mossback-warden', position: { x: -132, y: -31, z: -215 }, health, phase: 1, mode, nextActionAt: elapsedMs + 1000 }, pet: { id: 'cat', mode: 'fight', health: 70, position: { x: -132, z: -213 }, skillReadyAt: 0 } },
  };
}

function mockApp(frames, { failSnapshot = 0, failKey = null } = {}) {
  const calls = [], inputs = [], held = new Set();
  let snapshots = 0;
  return {
    calls, inputs, held,
    async js(source) {
      calls.push(source);
      snapshots++;
      if (snapshots === failSnapshot) throw new Error('diagnostics disconnected');
      return structuredClone(frames[Math.min(snapshots - 1, frames.length - 1)]);
    },
    async send(method, input) {
      assert.equal(method, 'Input.dispatchKeyEvent');
      inputs.push(input);
      if (input.type === 'keyDown') held.add(input.code); else held.delete(input.code);
      if (input.type === 'keyDown' && input.code === failKey) throw new Error('input disconnected');
    },
  };
}

test('fight preparation places only position and facing, resumes the real clock, and locks through CDP input', async () => {
  const state = frame(), placements = [], inputs = [];
  let focused = false;
  const context = vm.createContext({
    window: { __lhFrozenAt: 50, __littleHours: { wilds: {
      ready: () => true,
      diagnostics: () => ({ ...state, eventHistory: [] }),
      place(fixture) { placements.push(fixture); state.combat.targetId = null; return true; },
    } } },
    document: { getElementById: id => ({ focus() { assert.equal(id, 'wilds-canvas'); focused = true; } }) },
  });
  const app = {
    async js(source) { return vm.runInContext(source, context); },
    async waitFor(source) { assert.equal(vm.runInContext(source, context), true); },
    async send(method, input) {
      assert.equal(method, 'Input.dispatchKeyEvent'); inputs.push([input.type, input.code]);
      if (input.type === 'keyDown' && input.code === 'Tab') state.combat.targetId = 'mossback-warden';
    },
  };
  const result = await prepareFight(app);
  assert.deepEqual(JSON.parse(JSON.stringify(placements)), [{ position: { x: -120, z: -200 }, yaw: .6747409422235527, camera: { yaw: .6747409422235527 } }]);
  assert.deepEqual(inputs, [['keyDown', 'Tab'], ['keyUp', 'Tab']]);
  assert.equal(focused, true);
  assert.equal(result.frozen, false);
  assert.equal(result.combat.boss.health, 420);
  assert.equal(result.combat.targetId, 'mossback-warden');
});

test('real-time fight input measures only new player and pet damage and releases all inputs', async () => {
  const old = { type: 'damage', targetId: 'mossback-warden', sourceId: 'cat', amount: 7, at: 900 };
  const hits = [old, { type: 'damage', targetId: 'mossback-warden', sourceId: 'player', amount: 10, at: 1050 }, { type: 'damage', targetId: 'mossback-warden', sourceId: 'cat', amount: 24, at: 1050 }];
  const app = mockApp([frame({ events: [old] }), frame({ elapsedMs: 1100, health: 386, events: hits })]);
  const result = await driveFight(app, { durationMs: 1 });
  assert.deepEqual(app.inputs.filter(input => input.type === 'keyDown').map(input => input.code), ['KeyQ', 'KeyF']);
  assert.equal(result.bossHealthBefore, 420);
  assert.equal(result.bossHealthAfter, 386);
  assert.equal(result.playerDamage, 10);
  assert.equal(result.petDamage, 24);
  assert.equal(result.elapsedMs, 100);
  assert.equal(result.events.length, 2);
  assert.equal(result.active, true);
  assert.equal(result.defeated, false);
  assert.equal(app.held.size, 0);
  assert.ok(app.calls.every(source => !source.includes('.place(') && !source.includes('delete ') && !source.includes('__lhFrozenAt =')));
});

test('fight driver holds real movement keys and releases them when diagnostics fail', async () => {
  const app = mockApp([frame({ position: { x: -132, y: -31, z: -203 } })], { failSnapshot: 2 });
  await assert.rejects(driveFight(app, { durationMs: 1 }), /diagnostics disconnected/);
  assert.ok(app.inputs.some(input => input.type === 'keyDown' && input.code === 'KeyW'));
  assert.ok(app.inputs.some(input => input.type === 'keyUp' && input.code === 'KeyW'));
  assert.equal(app.held.size, 0);
});

test('action key release still runs when key-down reports a transport error', async () => {
  const app = mockApp([frame()], { failKey: 'KeyQ' });
  await assert.rejects(driveFight(app, { durationMs: 1 }), /input disconnected/);
  assert.ok(app.inputs.some(input => input.type === 'keyUp' && input.code === 'KeyQ'));
  assert.equal(app.held.size, 0);
});

test('frozen or nonadvancing clocks cannot produce a successful fight measurement', async () => {
  const frozen = mockApp([frame({ frozen: true })]);
  await assert.rejects(driveFight(frozen, { durationMs: 1 }), /unfrozen/);
  assert.equal(frozen.inputs.filter(input => input.type === 'keyDown').length, 0);
  const stalled = mockApp([frame()]);
  await assert.rejects(driveFight(stalled, { durationMs: 1 }), /did not advance/);
  assert.equal(stalled.held.size, 0);
});

test('invalid durations reject before interacting with the app', async () => {
  const app = mockApp([frame()]);
  await assert.rejects(driveFight(app, { durationMs: 0 }), /duration/);
  assert.equal(app.calls.length, 0);
  assert.equal(app.inputs.length, 0);
});

test('preparation refuses completed encounters and invalid fixture placement without combat input', async () => {
  const defeated = mockApp([frame({ health: 0 })]);
  defeated.waitFor = async () => true;
  await assert.rejects(prepareFight(defeated), /fresh undefeated/);
  assert.equal(defeated.calls.length, 1);
  assert.equal(defeated.inputs.length, 0);
  assert.ok(defeated.calls.every(source => !source.includes('.place(')));
  const invalid = mockApp([frame(), false]);
  invalid.waitFor = async () => true;
  await assert.rejects(prepareFight(invalid), /outside loaded terrain/);
  assert.equal(invalid.inputs.length, 0);
});
