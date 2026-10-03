import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWildsNavigation } from './navigation.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(load) {
  const calls = [], container = { hidden: true, replaceChildren() { calls.push('clear'); }, remove() { calls.push('remove'); } };
  const app = {
    state: { session: { kind: 'focus', running: false }, avatar: { skin: 'warm', style: 'waves' } },
    toast() { calls.push('toast'); },
    nav: { setHouseOpen(value) { calls.push(['houseOpen', value]); } },
    room: { setSuspended(value) { calls.push(['suspended', value]); } },
    houseUI: { releaseView() { calls.push('release'); }, restoreAtTrailhead() { calls.push('trailhead'); } },
  };
  let disposed = false;
  const game = { dispose() { disposed = true; calls.push('dispose'); }, diagnostics: () => ({ disposed }), pause() {}, resume() {} };
  const factory = async options => { calls.push(['create', options]); return game; };
  const forest = createWildsNavigation(app, container, load || (async () => ({ createWildsGame: factory })));
  return { app, container, calls, game, factory, forest };
}

test('Wilds loads only on entry, releases island first, and restores trailhead after disposal', async () => {
  const f = fixture();
  assert.deepEqual(f.calls, []);
  assert.equal(await f.forest.open(), true);
  assert.ok(f.calls.indexOf('release') < f.calls.findIndex(item => item[0] === 'create'));
  assert.equal(f.container.hidden, false);
  assert.equal(f.forest.diagnostics().ready, true);
  const options = f.calls.find(item => item[0] === 'create')[1];
  assert.deepEqual(options.appearance, f.app.state.avatar);
  assert.notEqual(options.appearance, f.app.state.avatar);
  await options.onLeave();
  assert.equal(f.forest.active, false);
  assert.ok(f.calls.indexOf('dispose') < f.calls.indexOf('trailhead'));
  assert.deepEqual(f.forest.diagnostics().disposed, { disposed: true });
  assert.equal(f.calls.some(item => Array.isArray(item) && item[0] === 'suspended' && item[1] === false), false);
});

test('study blocks loading and starting study during import prevents creating a game', async () => {
  const loading = deferred();
  const f = fixture(() => { f.calls.push('load'); return loading.promise; });
  f.app.state.session.running = true;
  assert.equal(await f.forest.open(), false);
  assert.equal(f.calls.includes('load'), false);
  f.app.state.session.running = false;
  const opening = f.forest.open();
  await Promise.resolve();
  f.app.state.session.running = true;
  f.forest.render();
  loading.resolve({ createWildsGame: f.factory });
  assert.equal(await opening, false);
  await Promise.resolve();
  assert.equal(f.forest.active, false);
  assert.equal(f.calls.some(item => item[0] === 'create'), false);
  assert.ok(f.calls.includes('trailhead'));
});

test('leave while a game initializes disposes it before rebuilding the island', async () => {
  const creating = deferred();
  const f = fixture(async () => ({ createWildsGame: () => creating.promise }));
  const opening = f.forest.open();
  await Promise.resolve();
  await Promise.resolve();
  const leaving = f.forest.close();
  assert.equal(f.calls.includes('trailhead'), false);
  creating.resolve(f.game);
  assert.equal(await opening, false);
  await leaving;
  assert.ok(f.calls.indexOf('dispose') < f.calls.indexOf('trailhead'));
});

test('external focus leaves a running Wilds and HMR disposal never rebuilds its house', async () => {
  const f = fixture();
  await f.forest.open();
  f.app.state.session.running = true;
  f.forest.render();
  assert.equal(f.forest.active, false);
  assert.equal(f.forest.diagnostics().game, null);
  f.app.state.session.running = false;
  await f.forest.open();
  const restores = f.calls.filter(item => item === 'trailhead').length;
  f.forest.dispose();
  assert.equal(f.calls.filter(item => item === 'trailhead').length, restores);
  assert.equal(f.calls.at(-1), 'remove');
});

test('failed load restores island and repeated entry keeps one live game', async () => {
  const f = fixture(async () => { throw new Error('offline'); });
  const original = console.error;
  console.error = () => {};
  try { assert.equal(await f.forest.open(), false); } finally { console.error = original; }
  assert.ok(f.calls.includes('trailhead'));
  const ready = fixture();
  const first = ready.forest.open(), second = ready.forest.open();
  assert.equal(first, second);
  await first;
  await ready.forest.open();
  assert.equal(ready.calls.filter(item => item[0] === 'create').length, 1);
});

test('focus that starts during renderer initialization discards the new game', async () => {
  const creating = deferred();
  const f = fixture(async () => ({ createWildsGame: () => creating.promise }));
  const opening = f.forest.open();
  await Promise.resolve();
  await Promise.resolve();
  f.app.state.session.running = true;
  creating.resolve(f.game);
  assert.equal(await opening, false);
  assert.equal(f.forest.active, false);
  assert.ok(f.calls.indexOf('dispose') < f.calls.indexOf('trailhead'));
});

test('disposing during import never constructs a renderer or restores a torn-down island', async () => {
  const loading = deferred();
  const f = fixture(() => loading.promise);
  const opening = f.forest.open();
  await Promise.resolve();
  f.forest.dispose();
  loading.resolve({ createWildsGame: f.factory });
  assert.equal(await opening, false);
  await Promise.resolve();
  assert.equal(f.calls.some(item => item[0] === 'create'), false);
  assert.equal(f.calls.includes('trailhead'), false);
});
