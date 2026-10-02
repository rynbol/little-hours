import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pinScript } from './lh/app.mjs';
import { idle } from './lh/measure.mjs';
import { advance, steeringKeys, fightInput } from './lh/flows/wilds.mjs';

test('the Forest route driver steers with real camera-relative keys and stops at its destination', () => {
  assert.deepEqual(steeringKeys({ x: 0, z: 0 }, { x: 0, z: -10 }, 0), ['KeyW']);
  assert.deepEqual(steeringKeys({ x: 0, z: 0 }, { x: 0, z: -10 }, Math.PI / 2), ['KeyD']);
  assert.deepEqual(steeringKeys({ x: -106.5, z: -180 }, { x: -120, z: -200 }, .6), ['KeyW']);
  assert.deepEqual(steeringKeys({ x: 1, z: 1 }, { x: 1.5, z: 1.5 }, 0), []);
});

test('the fight driver uses attack, lock and pet keys and reacts to a charge with a sideways dodge', () => {
  const state = { player: { position: { x: 0, z: 0 }, stamina: 100 }, cameraYaw: 0, elapsedMs: 1000, combat: { targetId: null, playerAction: null, pet: { health: 70, mode: 'follow', position: { x: 1, z: 0 }, skillReadyAt: 0 }, boss: { position: { x: 0, z: -3 }, health: 420, mode: 'recovery', nextActionAt: 2000 } } };
  assert.deepEqual(fightInput(state), { keys: [], actions: ['Tab', 'KeyT', 'KeyQ', 'KeyF'] });
  state.combat.targetId = 'mossback-warden';
  state.combat.pet.mode = 'fight'; state.combat.pet.skillReadyAt = 5000;
  Object.assign(state.combat.boss, { mode: 'telegraph', move: 'charge', nextActionAt: 1200 });
  assert.deepEqual(fightInput(state), { keys: ['KeyD'], actions: ['ControlLeft'] });
});

function storage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), clear: () => values.clear() };
}

test('the Wilds flow advances the complete fractional duration and waits for its final frame', async () => {
  const window = { __littleHours: { wilds: { diagnostics: () => ({ now: window.__lhFrozenAt }) } }, __lhFrozenAt: 1000 };
  const frames = [];
  const app = {
    async js(expression) { return vm.runInNewContext(expression, { window }); },
    async waitFor(expression) { assert.equal(vm.runInNewContext(expression, { window }), true); frames.push(window.__lhFrozenAt); },
  };
  await advance(app, 127.5);
  assert.deepEqual(frames, [1050, 1100, 1127.5]);
  await advance(app, 0);
  await advance(app, 2.5);
  assert.deepEqual(frames, [1050, 1100, 1127.5, 1130]);
});

test('Wilds browser fixtures seed only the independent key and preserve reload changes', () => {
  const localStorage = storage({ 'little-hours-v1': 'production sentinel', other: 'keep' });
  const sessionStorage = storage();
  const context = { window: {}, Date, Math, localStorage, sessionStorage, location: { protocol: 'http:' } };
  const code = pinScript({ state: { theme: 'rain', house: { coins: 87 } }, seed: 7, startAt: 1000, storageKey: 'little-hours-wilds-check-v1' });
  vm.runInNewContext(code, context);
  assert.deepEqual(JSON.parse(localStorage.getItem('little-hours-wilds-check-v1')), { theme: 'rain', house: { coins: 87 } });
  assert.equal(localStorage.getItem('little-hours-v1'), 'production sentinel');
  assert.equal(localStorage.getItem('other'), 'keep');
  localStorage.setItem('little-hours-wilds-check-v1', '{"theme":"dusk"}');
  vm.runInNewContext(code, context);
  assert.equal(localStorage.getItem('little-hours-wilds-check-v1'), '{"theme":"dusk"}');
  context.window.__lhFrozenAt = 2500;
  assert.equal(context.window.__littleHoursTest.now(), 2500);
});

test('default app fixtures keep their existing production-key seed behaviour', () => {
  const localStorage = storage({ old: 'replace' });
  vm.runInNewContext(pinScript({ state: { theme: 'day' }, seed: 7, startAt: 1000 }), { window: {}, Date, Math, localStorage, sessionStorage: storage(), location: { protocol: 'http:' } });
  assert.equal(localStorage.getItem('old'), null);
  assert.deepEqual(JSON.parse(localStorage.getItem('little-hours-v1')), { theme: 'day' });
});

test('the performance sample divides rendered frames by measured elapsed time', async () => {
  const evaluations = [];
  const app = {
    async send(method) { return method === 'Performance.getMetrics' ? { metrics: [{ name: 'TaskDuration', value: 1 }] } : {}; },
    async js(expression) {
      evaluations.push(expression);
      return evaluations.length === 1 ? { at: 1000, renderCount: 20 } : { at: 3000, renderCount: 140, gaps: [16, 17, 16] };
    },
  };
  const result = await idle(app, .001, { view: 'wilds' });
  assert.equal(result.renderPerSecond, 60);
  assert.equal(result.rafPerSecond, 1.5);
  assert.equal(result.slowGaps, 0);
  assert.equal(result.p95GapMs, 17);
  assert.equal(result.maxGapMs, 17);
  assert.match(evaluations[0], /stats\("wilds"\)/);
  assert.match(evaluations[1], /stats\("wilds"\)/);
});

test('the Wilds check installs the shared hook and keeps the game modules free of test globals', () => {
  const check = readFileSync(new URL('../checks/wilds.html', import.meta.url), 'utf8');
  assert.match(check, /import \{ installTestHook \} from '\.\.\/src\/dev\/test-hook\.js'/);
  assert.doesNotMatch(check, /little-hours-v1|__littleHours/);
  for (const file of ['index.js', 'scene.js']) {
    const code = readFileSync(new URL(`../src/features/wilds/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(code, /test-hook|__littleHours|localStorage|Date\.now|Math\.random/);
  }
});
