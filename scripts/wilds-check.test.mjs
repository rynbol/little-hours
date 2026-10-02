import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pinScript } from './lh/app.mjs';
import { idle } from './lh/measure.mjs';

function storage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), clear: () => values.clear() };
}

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
