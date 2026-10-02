import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSource, commentLines, untestedChange } from './guard.mjs';

const rules = (file, code) => checkSource(file, code).map(problem => problem.rule);

test('game code reads time and chance only through test-pins', () => {
  assert.deepEqual(rules('src/features/room/room.js', 'const a = Date.now(); const b = Math.random(); const c = new Date();'), ['clock', 'clock', 'clock']);
  assert.deepEqual(rules('src/features/room/room.js', 'const a = new Date(clockNow()); const b = performance.now();'), []);
  assert.deepEqual(rules('src/core/test-pins.js', 'export const clockNow = () => Date.now();'), []);
  assert.deepEqual(rules('src/features/room/room.test.js', 'const a = Date.now();'), []);
});

test('only the hook files touch the test globals', () => {
  assert.deepEqual(rules('src/features/room/room.js', 'window.__littleHours = {}; globalThis.__littleHoursTest?.now;'), ['test-hook', 'test-hook']);
  assert.deepEqual(rules('src/dev/test-hook.js', 'window.__littleHours = {};'), []);
});

test('import boundaries hold', () => {
  assert.deepEqual(rules('src/core/state.js', "import x from '../../scripts/lh/app.mjs';"), ['imports']);
  assert.deepEqual(rules('src/features/room/room.js', "import { installTestHook } from '../../dev/test-hook.js';"), ['imports', 'layers']);
  assert.deepEqual(rules('src/main.js', "import { installTestHook } from './dev/test-hook.js';"), []);
  assert.deepEqual(rules('scripts/lh/flows/x.mjs', "const m = await import('../../../src/layout.js');"), ['imports']);
  assert.deepEqual(rules('scripts/verify-room.mjs', "import { createRoom } from '../src/features/room/index.js';"), []);
});

test('comment lines are found, strings with slashes are not comments', () => {
  assert.deepEqual([...commentLines('a.js', "const url = 'https://x';\n// note\nconst b = 1; /* two\nlines */")], [2, 3, 4]);
});

test('features meet only through their index, and layers point one way', () => {
  assert.deepEqual(rules('src/features/room/room.js', "import { createPetModel } from '../pet/index.js'; import { walls } from './room-passages.js'; import { FURNITURE } from '../../core/catalog.js'; import { build } from '../../models/furniture.js';"), []);
  assert.deepEqual(rules('src/features/room/room.js', "import { createPetModel } from '../pet/pets.js';"), ['layers']);
  assert.deepEqual(rules('src/core/state.js', "import { createRoom } from '../features/room/index.js';"), ['layers']);
  assert.deepEqual(rules('src/core/state.js', "import { build } from '../models/furniture.js';"), ['layers']);
  assert.deepEqual(rules('src/models/furniture.js', "import { AVATAR_DEFAULT } from '../core/avatar.js';"), []);
  assert.deepEqual(rules('src/features/pet/pet.js', "import { x } from '../../main.js';"), ['layers']);
  assert.deepEqual(rules('src/features/pet/pet-ui.js', "import { icon } from '../../app/panels.js';"), ['layers']);
  assert.deepEqual(rules('src/main.js', "import { createPanels } from './app/panels.js';"), []);
  assert.deepEqual(rules('src/app/panels.js', "import { createRoom } from '../features/room/index.js'; import { x } from '../features/room/room.js';"), ['layers']);
  assert.deepEqual(rules('src/stray.js', "import { FURNITURE } from './core/catalog.js';"), ['layers']);
  assert.deepEqual(rules('src/features/pet/pet.test.js', "import { walkable } from '../companion/companion.js';"), []);
});

test('game code changes come with a test, or a No-test trailer says why', () => {
  assert.equal(untestedChange(['src/features/house/house-garden.js'], 'Garden gets a pond')?.rule, 'tests-with-changes');
  assert.equal(untestedChange(['src/features/house/house-garden.js', 'scripts/lh/flows/house.mjs'], ''), null);
  assert.equal(untestedChange(['src/core/garden.js', 'src/core/garden.test.js'], ''), null);
  assert.equal(untestedChange(['src/features/house/whole-house.css', 'README.md'], ''), null);
  assert.equal(untestedChange(['src/features/room/room.js'], 'Tidy\n\nNo-test: rename only'), null);
  assert.equal(untestedChange(['src/features/room/room.js'], 'No-test:')?.rule, 'tests-with-changes');
});

test('guard checks comments after a Git diff larger than the default child-process buffer', t => {
  const root = mkdtempSync(join(tmpdir(), 'little-hours-guard-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'src/core'), { recursive: true });
  copyFileSync(new URL('./guard.mjs', import.meta.url), join(root, 'scripts/guard.mjs'));
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(root, 'node_modules'), 'dir');
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  git(['init', '--quiet']);
  git(['-c', 'user.name=Guard Test', '-c', 'user.email=guard@example.test', 'commit', '--quiet', '--allow-empty', '-m', 'Baseline']);
  const file = join(root, 'src/core/large.js');
  const source = `export const payload = '${'x'.repeat(1200000)}';\n`;
  writeFileSync(file, source + '// new comment after a large diff\n');
  writeFileSync(join(root, 'src/core/large.test.js'), 'export const covered = true;\n');
  git(['add', 'src/core/large.js', 'src/core/large.test.js']);
  const run = () => spawnSync(process.execPath, ['scripts/guard.mjs', '--base=HEAD'], { cwd: root, encoding: 'utf8' });
  const rejected = run();
  assert.equal(rejected.status, 1);
  assert.equal(rejected.stderr, '');
  assert.match(rejected.stdout, /src\/core\/large\.js:2  no-new-comments/);
  assert.match(rejected.stdout, /1 problem\(s\)/);
  writeFileSync(file, source);
  const accepted = run();
  assert.equal(accepted.status, 0);
  assert.equal(accepted.stderr, '');
  assert.match(accepted.stdout, /0 problem\(s\), new comments checked against/);
});
