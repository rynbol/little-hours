import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedStateStore } from './shared-store.js';
import { createStateStore, freshState, storageKey, restoreState } from './state.js';
import { createSession, isFocusing, sessionStarted, normalizeSession } from './session.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

function fixture(initial = freshState()) {
  const values = new Map([[storageKey, JSON.stringify(initial)]]);
  let time = Date.UTC(2026, 8, 25, 23, 50), queue = Promise.resolve();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const locks = { request(name, callback) {
    assert.equal(name, 'little-hours-home-write');
    const result = queue.then(() => new Promise(resolve => setImmediate(resolve))).then(callback);
    queue = result.catch(() => {});
    return result;
  } };
  return { storage, locks, now: () => time, advance: ms => { time += ms; }, open: () => createSharedStateStore(storage, { locks, now: () => time }) };
}

test('concurrent tabs serialize completion with unrelated whole-home saves and pay every reward once', async () => {
  const f = fixture(), first = f.open(), second = f.open();
  await first.update(draft => { draft.task = 'Read <chapter one>'; });
  await first.setRunning(true, null);
  const id = first.state.session.id;
  assert.ok(id);
  f.advance(25 * 60_000);
  const results = await Promise.all([
    first.update(), second.update(draft => { draft.theme = 'rain'; }),
    first.renamePet('cat', 'Maple'), second.renameHouse('Quiet Cottage'),
  ]);
  assert.equal(results.filter(result => result.completion).length, 1);
  const state = f.open().state;
  assert.equal(state.history.length, 1);
  assert.equal(state.history[0].id, id);
  assert.equal(state.history[0].task, 'Read <chapter one>');
  assert.equal(state.house.coins, 25);
  assert.equal(state.house.sessions.length, 1);
  assert.deepEqual(state.pond.bait, [{ minutes: 10, at: 0 }, { minutes: 25, at: f.now() }]);
  assert.deepEqual([state.petBonds.cat.minutes, state.petBonds.cat.sessions, state.petBonds.cat.affection], [25, 1, 5]);
  assert.equal(state.theme, 'rain');
  assert.equal(state.house.name, 'Quiet Cottage');
  assert.equal(state.petBonds.cat.name, 'Maple');
  assert.equal((await first.update()).completion, null);
});

test('pause, resume and backup preserve the starting task, pet and session identity', async () => {
  const f = fixture(), store = f.open();
  await store.update(draft => { draft.task = 'First task'; });
  await store.setRunning(true);
  const original = store.state.session;
  f.advance(60_000);
  await store.setRunning(false, original.id);
  await store.update(draft => { draft.task = 'Next task'; draft.pet = 'dog'; });
  const imported = readBackup(createBackup(store.state, f.now())).state;
  assert.equal(imported.session.id, original.id);
  assert.equal(imported.session.phase, 'paused');
  await store.setRunning(true, original.id);
  assert.equal(store.state.session.taskSnapshot, 'First task');
  assert.equal(store.state.session.petId, 'cat');
  assert.equal(store.state.session.startedAt, original.startedAt);
  f.advance(24 * 60_000);
  await store.update();
  assert.equal(store.state.history[0].task, 'First task');
  assert.equal(store.state.petBonds.cat.minutes, 25);
  assert.equal(store.state.petBonds.dog.minutes, 0);
});

test('timed breaks persist, expire once and never award focus rewards', async () => {
  for (const minutes of [5, 15]) {
    const f = fixture(), store = f.open();
    await store.resetSession(50); await store.setRunning(true); f.advance(50 * 60_000); await store.update();
    const rewards = structuredClone({ history: store.state.history, house: store.state.house, pond: store.state.pond, bonds: store.state.petBonds });
    await store.startBreak(minutes, store.state.session.id);
    const id = store.state.session.id;
    assert.equal(isFocusing(store.state.session), false);
    assert.equal(sessionStarted(store.state.session), false);
    assert.equal(store.state.session.duration, minutes * 60_000);
    const reopened = f.open();
    assert.equal(reopened.state.session.id, id);
    f.advance(minutes * 60_000);
    const result = await reopened.update();
    assert.deepEqual(result.completion, { id, kind: 'break', at: f.now(), minutes, coins: 0 });
    assert.deepEqual({ history: reopened.state.history, house: reopened.state.house, pond: reopened.state.pond, bonds: reopened.state.petBonds }, rewards);
    assert.equal((await store.update()).completion, null);
    assert.equal(store.state.session.phase, 'completed');
    assert.equal(store.state.session.remaining, 0);
    await store.setRunning(true, id);
    assert.equal(store.state.session.kind, 'focus');
    assert.equal(store.state.session.duration, 50 * 60_000);
    assert.notEqual(store.state.session.id, id);
  }
});

test('stale commands cannot replace another tab session or resurrect a completed wardrobe pause', async () => {
  const f = fixture(), a = f.open(), b = f.open();
  await Promise.all([a.setRunning(true, null), b.setRunning(true, null)]);
  const id = a.refresh().session.id;
  await a.setRunning(false, id);
  await b.resetSession(50, id); await b.setRunning(true, null);
  const next = b.state.session.id;
  await Promise.all([a.resetSession(90, id), a.setRunning(false, id), a.resumeFocus(id)]);
  assert.equal(a.refresh().session.id, next);
  assert.equal(a.state.session.running, true);
  f.advance(50 * 60_000);
  await a.setRunning(false, next); await a.resumeFocus(next);
  assert.equal(a.state.session.phase, 'completed');
  assert.equal(a.state.session.running, false);
});

test('ending a break early and rejecting invalid breaks cannot mint rewards', async () => {
  const f = fixture(), store = f.open();
  await store.startBreak(5, null);
  assert.equal(store.state.session.kind, 'focus');
  await store.setRunning(true); f.advance(25 * 60_000); await store.update();
  await store.startBreak(10, store.state.session.id);
  assert.equal(store.state.session.kind, 'focus');
  await store.startBreak(5, store.state.session.id);
  const id = store.state.session.id;
  f.advance(60_000); await store.endBreak(id); await store.endBreak(id);
  assert.equal(store.state.session.phase, 'ready');
  assert.equal(store.state.house.coins, 25);
  assert.equal(store.state.history.length, 1);
});

test('completion uses the starting time zone even when restored after midnight elsewhere', () => {
  const state = freshState();
  state.session = { ...createSession(), id: 'zone-session', phase: 'running', running: true, endsAt: Date.UTC(2026, 8, 26, 0, 15), timeZone: 'America/Los_Angeles', taskSnapshot: 'Late chapter' };
  const f = fixture(state); f.advance(86_400_000);
  const store = createStateStore(f.storage, f.now);
  store.update();
  assert.equal(store.state.history[0].date, '2026-09-25');
  assert.equal(store.state.history[0].timeZone, 'America/Los_Angeles');
});

test('legacy timers migrate deterministically and malformed metadata cannot poison saves', () => {
  const legacy = { duration: 1_500_000, remaining: 900_000, endsAt: null, running: false };
  const first = restoreState(JSON.stringify({ task: 'Legacy task', session: legacy }));
  const second = restoreState(JSON.stringify(first));
  assert.equal(first.session.phase, 'paused');
  assert.equal(first.session.taskSnapshot, 'Legacy task');
  assert.deepEqual(first.session, second.session);
  assert.equal(normalizeSession({ ...legacy, timeZone: 'bogus', id: {} }).timeZone, undefined);
  assert.deepEqual(normalizeSession({ ...legacy, duration: '1500000' }), createSession());
});

test('unsupported or failed coordination never writes an unlocked shared save', async () => {
  const f = fixture(), before = f.storage.getItem(storageKey);
  const isolated = createSharedStateStore(f.storage, { locks: null, now: f.now });
  assert.equal((await isolated.setRunning(true)).persisted, false);
  await isolated.update(draft => { draft.task = 'This visit only'; });
  assert.equal(isolated.refresh().task, 'This visit only');
  assert.equal(f.storage.getItem(storageKey), before);
  const denied = createSharedStateStore(f.storage, { locks: { request: () => Promise.reject(new Error('denied')) }, now: f.now });
  assert.equal((await denied.setRunning(true)).persisted, false);
  assert.equal(f.storage.getItem(storageKey), before);
});

test('running break backups preserve identity and resume focus duration without auto-awarding', async () => {
  const f = fixture(), store = f.open();
  await store.resetSession(90); await store.setRunning(true); f.advance(90 * 60_000); await store.update();
  await store.startBreak(15, store.state.session.id); f.advance(60_000);
  const imported = readBackup(createBackup(store.state, f.now())).state;
  assert.equal(imported.session.kind, 'break');
  assert.equal(imported.session.phase, 'paused');
  assert.equal(imported.session.remaining, 14 * 60_000);
  assert.equal(imported.session.id, store.state.session.id);
  assert.equal(imported.session.focusMinutes, 90);
  assert.deepEqual(imported.history, store.state.history);
});

test('replaying an already credited identity cannot re-award any focus side effect', async () => {
  const f = fixture(), store = f.open();
  await store.setRunning(true);
  const running = structuredClone(store.state.session);
  f.advance(25 * 60_000); await store.update();
  const before = structuredClone(store.state);
  await store.update(draft => { draft.session = running; });
  assert.equal((await store.update()).completion, null);
  assert.deepEqual(store.state.history, before.history);
  assert.deepEqual(store.state.house, before.house);
  assert.deepEqual(store.state.pond, before.pond);
  assert.deepEqual(store.state.petBonds, before.petBonds);
});
