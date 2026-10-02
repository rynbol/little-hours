import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function installFixture(registerHooks) {
  const root = process.env.LH_TRACE_TEST_ROOT;
  globalThis.fixture = { elapsed: 0, held: new Set(), inputs: [], placements: [], focused: false, listeners: new Set(), tracing: false, traceStart: null, holds: [] };
  const sources = {
    'chrome.mjs': `
      export const slow = 1, chromePath = '', gpuFlag = '';
      export const killAllNow = () => {}, closeAll = async () => {};
      export const launch = async () => { throw new Error('Unexpected browser launch'); };
      export const sleep = async ms => {
        const f = globalThis.fixture;
        if (f.held.size) f.holds.push({ milliseconds: ms, keys: [...f.held].sort(), focused: f.focused });
        if (ms === 20000 && process.env.LH_TRACE_TEST_FAILURE === 'hold') throw new Error('Interrupted traversal');
        f.elapsed += ms;
      };
    `,
    'state.mjs': `
      export const repoRoot = process.cwd(), lhDir = process.env.LH_TRACE_TEST_OUT;
      export const outDir = () => lhDir, commandOf = () => '', tracked = () => [], stopTracked = () => [];
    `,
    'server.mjs': `export const serve = async () => { throw new Error('Unexpected server launch'); };`,
    'app.mjs': `
      import vm from 'node:vm';
      import { writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      export async function openApp(url, settings) {
        const f = globalThis.fixture;
        f.url = url; f.settings = settings;
        if (settings.path !== '/checks/wilds.html') throw new Error('The command opened the room instead of the Wilds');
        const context = {
          window: { __littleHours: { wilds: {
            ready: () => f.elapsed >= 1600,
            diagnostics: () => ({ world: { pending: f.elapsed < 1700, lighting: { pending: f.elapsed < 1800 } } }),
            place: value => { f.placements.push({ value, at: f.elapsed }); return process.env.LH_TRACE_TEST_FAILURE !== 'place'; },
          } } },
          document: { getElementById: id => ({ focus() { f.focused = id === 'wilds-canvas'; } }) },
        };
        const app = {
          errors: [],
          async settle() {},
          async js(expression) { return vm.runInNewContext(expression, context); },
          async waitFor(expression) {
            for (let i = 0; i < 100; i++, f.elapsed += 50) if (await app.js(expression)) return true;
            throw new Error('The traversal never became ready');
          },
          on(listener) { f.listeners.add(listener); return () => f.listeners.delete(listener); },
          async send(method, event) {
            if (method === 'Input.dispatchKeyEvent') {
              if (event.type === 'keyDown') f.held.add(event.code);
              else f.held.delete(event.code);
              f.inputs.push({ ...event, at: f.elapsed });
              if (event.code === 'KeyW' && event.type === process.env.LH_TRACE_TEST_FAILURE) throw new Error('Interrupted input');
            }
            if (method === 'Tracing.start') { f.tracing = true; f.traceStart = f.elapsed; }
            if (method === 'Tracing.end') {
              for (const listener of f.listeners) {
                listener({ method: 'Tracing.dataCollected', params: { value: [{ name: 'RunTask', ph: 'X', ts: f.traceStart * 1000, dur: (f.elapsed - f.traceStart) * 1000 }] } });
                listener({ method: 'Tracing.tracingComplete' });
              }
            }
            return {};
          },
          async close() { writeFileSync(join(process.env.LH_TRACE_TEST_OUT, 'browser.json'), JSON.stringify({ ...f, held: [...f.held], listeners: f.listeners.size })); },
        };
        return app;
      }
    `,
  };
  registerHooks({ load(url, context, nextLoad) {
    const name = url.startsWith(root) ? url.slice(root.length) : '';
    return sources[name] ? { format: 'module', source: sources[name], shortCircuit: true } : nextLoad(url, context);
  } });
}

function runTrace({ cold = true, failure = '' } = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'lh-wilds-trace-'));
  const env = { ...process.env, LH_TRACE_TEST_ROOT: new URL('./lh/', import.meta.url).href, LH_TRACE_TEST_OUT: folder, LH_TRACE_TEST_FAILURE: failure };
  delete env.GIT_WORK_TREE;
  delete env.GIT_DIR;
  try {
    const fixture = `import { registerHooks } from 'node:module'; (${installFixture.toString()})(registerHooks);`;
    const result = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(fixture)}`, fileURLToPath(new URL('./lh.mjs', import.meta.url)), 'trace', 'wilds-traversal', '--url', 'http://fixture.invalid', '--size', '960x640', '--scale', '1', '--seed', 'one-room', '--theme', 'day', ...(cold ? ['--cold'] : [])], { env, encoding: 'utf8', timeout: 10000 });
    let browser = null, trace = null;
    try { browser = JSON.parse(readFileSync(join(folder, 'browser.json'), 'utf8')); } catch {}
    try { trace = JSON.parse(readFileSync(join(folder, 'trace-wilds-traversal.json'), 'utf8')); } catch {}
    return { ...result, browser, trace };
  } finally { rmSync(folder, { recursive: true, force: true }); }
}

test('lh trace wilds-traversal --cold opens the isolated Wilds route and records one real-time traversal', () => {
  const result = runTrace();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.browser.settings, { width: 960, height: 640, headed: false, reducedMotion: false, path: '/checks/wilds.html', storageKey: 'little-hours-wilds-check-v1', scale: 1, seed: 'one-room', theme: 'day' });
  assert.deepEqual(result.browser.placements, [{ value: { position: { x: 0, z: 0 }, yaw: 0, stamina: 100, camera: { yaw: 0 } }, at: 1800 }]);
  assert.deepEqual(result.browser.holds, [{ milliseconds: 20000, keys: ['KeyW', 'ShiftLeft'], focused: true }]);
  assert.deepEqual(result.browser.inputs.map(({ type, code, at }) => ({ type, code, at })), [
    { type: 'keyDown', code: 'ShiftLeft', at: 1800 },
    { type: 'keyDown', code: 'KeyW', at: 1800 },
    { type: 'keyUp', code: 'KeyW', at: 21800 },
    { type: 'keyUp', code: 'ShiftLeft', at: 21800 },
  ]);
  assert.deepEqual(result.browser.held, []);
  assert.deepEqual(result.trace, { traceEvents: [{ name: 'RunTask', ph: 'X', ts: 1800000, dur: 20000000 }] });
  assert.match(result.stdout, /lh trace wilds-traversal/);
});

test('a warm Wilds trace traverses before recording and only places during setup', () => {
  const result = runTrace({ cold: false });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.browser.placements.length, 1);
  assert.deepEqual(result.browser.holds, Array(2).fill({ milliseconds: 20000, keys: ['KeyW', 'ShiftLeft'], focused: true }));
  assert.deepEqual(result.trace, { traceEvents: [{ name: 'RunTask', ph: 'X', ts: 21800000, dur: 20000000 }] });
});

for (const failure of ['hold', 'keyDown', 'keyUp']) test(`an interrupted Wilds traversal releases both keys after ${failure} fails`, () => {
  const result = runTrace({ failure });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Interrupted/);
  assert.deepEqual(result.browser.inputs.slice(-2).map(({ type, code }) => ({ type, code })), [{ type: 'keyUp', code: 'KeyW' }, { type: 'keyUp', code: 'ShiftLeft' }]);
  assert.deepEqual(result.browser.held, []);
});

test('a missing clearing prevents a traversal from being recorded', () => {
  const result = runTrace({ failure: 'place' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /clearing is outside loaded terrain/);
  assert.equal(result.browser.placements.length, 1);
  assert.deepEqual(result.browser.inputs, []);
  assert.equal(result.browser.traceStart, null);
});
