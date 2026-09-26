import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, readBackup, BACKUP_FORMAT } from './backup.js';
import { createStateStore, freshState, recoveryKey, restoreState, storageKey } from './state.js';
import { startSession } from './session.js';

function mapStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return { map, getItem: key => map.get(key) ?? null, setItem: (key, value) => { map.set(key, value); } };
}

function furnishedState() {
  const state = freshState();
  state.house.name = 'Pebble Cottage';
  state.house.coins = 40;
  state.history = [{ date: '2026-09-20', minutes: 25 }, { date: '2026-09-21', minutes: 50 }];
  state.theme = 'rain';
  return state;
}

test('a backup round-trips the home exactly', () => {
  const state = restoreState(JSON.stringify(furnishedState()));
  const result = readBackup(createBackup(state, Date.UTC(2026, 8, 25)));
  assert.equal(result.ok, true);
  assert.deepEqual(result.state, state);
  assert.equal(result.summary.houseName, 'Pebble Cottage');
  assert.equal(result.summary.coins, 40);
  assert.equal(result.summary.sessions, 2);
  assert.equal(result.summary.rooms, 1);
  assert.equal(result.summary.exportedAt, Date.UTC(2026, 8, 25));
});

test('unreadable, foreign, newer and houseless files are refused', () => {
  assert.equal(readBackup('{nope').ok, false);
  assert.equal(readBackup(JSON.stringify({ app: 'other', format: 1, save: freshState() })).ok, false);
  const newer = readBackup(JSON.stringify({ app: 'little-hours', format: BACKUP_FORMAT + 1, save: freshState() }));
  assert.equal(newer.ok, false);
  assert.match(newer.reason, /newer/);
  assert.equal(readBackup(JSON.stringify({ app: 'little-hours', format: 1, save: { theme: 'day' } })).ok, false);
  assert.equal(readBackup('x'.repeat(2_000_001)).ok, false);
});

test('a session running in a backup comes back paused where it was', () => {
  const state = furnishedState();
  state.session = startSession(state.session, 0);
  const result = readBackup(createBackup(state, 10 * 60_000));
  assert.equal(result.state.session.running, false);
  assert.equal(result.state.session.remaining, 15 * 60_000);
  // Long past its deadline when exported: it returns fresh, never completable.
  const late = readBackup(createBackup(state, 60 * 60_000));
  assert.equal(late.state.session.remaining, late.state.session.duration);
});

test('restoring keeps the previous home aside and can swap back', () => {
  const storage = mapStorage();
  const store = createStateStore(storage);
  store.update(draft => { draft.house.coins = 7; draft.house.name = 'First Home'; });
  assert.equal(store.hasRecovery(), false);

  const imported = readBackup(createBackup(furnishedState())).state;
  const result = store.restore(imported);
  assert.equal(result.restored, true);
  assert.equal(result.persisted, true);
  assert.equal(store.state.house.name, 'Pebble Cottage');
  assert.equal(store.state.house.coins, 40);
  assert.equal(JSON.parse(storage.map.get(recoveryKey)).house.name, 'First Home');
  assert.equal(JSON.parse(storage.map.get(storageKey)).house.name, 'Pebble Cottage');

  store.undoRestore();
  assert.equal(store.state.house.name, 'First Home');
  assert.equal(store.state.house.coins, 7);
});

test('restoring the same backup twice never adds coins', () => {
  const store = createStateStore(mapStorage());
  const imported = readBackup(createBackup(furnishedState())).state;
  store.restore(imported);
  store.restore(imported);
  assert.equal(store.state.house.coins, 40);
});

test('nothing changes if the current home cannot be kept aside', () => {
  const storage = mapStorage();
  const store = createStateStore(storage);
  store.update(draft => { draft.house.name = 'First Home'; });
  storage.setItem = () => { throw new Error('quota'); };
  const result = store.restore(furnishedState());
  assert.equal(result.restored, false);
  assert.equal(store.state.house.name, 'First Home');
});
