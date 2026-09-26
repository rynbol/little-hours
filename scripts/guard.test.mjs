import test from 'node:test';
import assert from 'node:assert/strict';
import { checkSource, commentLines } from './guard.mjs';

const rules = (file, code) => checkSource(file, code).map(problem => problem.rule);

test('game code reads time and chance only through test-pins', () => {
  assert.deepEqual(rules('src/room.js', 'const a = Date.now(); const b = Math.random(); const c = new Date();'), ['clock', 'clock', 'clock']);
  assert.deepEqual(rules('src/room.js', 'const a = new Date(clockNow()); const b = performance.now();'), []);
  assert.deepEqual(rules('src/test-pins.js', 'export const clockNow = () => Date.now();'), []);
  assert.deepEqual(rules('src/room.test.js', 'const a = Date.now();'), []);
});

test('only the hook files touch the test globals', () => {
  assert.deepEqual(rules('src/room.js', 'window.__littleHours = {}; globalThis.__littleHoursTest?.now;'), ['test-hook', 'test-hook']);
  assert.deepEqual(rules('src/test-hook.js', 'window.__littleHours = {};'), []);
});

test('import boundaries hold', () => {
  assert.deepEqual(rules('src/room.js', "import x from '../scripts/lh/app.mjs';"), ['imports']);
  assert.deepEqual(rules('src/room.js', "import { installTestHook } from './test-hook.js';"), ['imports']);
  assert.deepEqual(rules('src/main.js', "import { installTestHook } from './test-hook.js';"), []);
  assert.deepEqual(rules('scripts/lh/flows/x.mjs', "const m = await import('../../../src/layout.js');"), ['imports']);
  assert.deepEqual(rules('scripts/verify-room.mjs', "import { createRoom } from '../src/room.js';"), []);
});

test('comment lines are found, strings with slashes are not comments', () => {
  assert.deepEqual([...commentLines('a.js', "const url = 'https://x';\n// note\nconst b = 1; /* two\nlines */")], [2, 3, 4]);
});
