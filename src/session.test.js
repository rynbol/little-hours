import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, remainingAt, startSession, pauseSession, formatTime } from './session.js';
import { createStateStore, freshState, localDate, restoreState, storageKey } from './state.js';
import { createLayout } from './layout.js';

function memoryStorage(initial = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (key, value) => { assert.equal(key, storageKey); raw = value; } };
}

test('elapsed wall time survives a throttled or sleeping browser tab', () => {
  const session = startSession(createSession(25), 1000);
  assert.equal(remainingAt(session, 1000 + 14 * 60_000), 11 * 60_000);
  assert.equal(remainingAt(JSON.parse(JSON.stringify(session)), 1000 + 30 * 60_000), 0);
});

test('pause freezes remaining time and resume preserves it', () => {
  const paused = pauseSession(startSession(createSession(25), 0), 120_000);
  assert.equal(remainingAt(paused, 900_000), 23 * 60_000);
  const resumed = startSession(paused, 900_000);
  assert.equal(remainingAt(resumed, 960_000), 22 * 60_000);
  assert.deepEqual(startSession(resumed, 960_000), resumed);
});

test('clock displays remaining partial seconds and never becomes negative', () => {
  assert.equal(formatTime(60_001), '01:01');
  assert.equal(formatTime(1), '00:01');
  assert.equal(formatTime(-300), '00:00');
});

test('pause intent at the deadline completes once without starting another session', () => {
  let now = 1000;
  const store = createStateStore(memoryStorage(), () => now);
  store.setRunning(true);
  now += 25 * 60_000;
  const paused = store.setRunning(false);
  assert.equal(paused.completed, true);
  assert.equal(paused.state.session.running, false);
  assert.equal(paused.state.session.remaining, 0);
  assert.equal(paused.state.history.length, 1);
  assert.equal(store.setRunning(false).completed, false);
  assert.equal(store.state.history.length, 1);
  const restarted = store.setRunning(true);
  assert.equal(restarted.state.session.running, true);
  assert.equal(remainingAt(restarted.state.session, now), 25 * 60_000);
  assert.equal(restarted.state.history.length, 1);
});

test('a stale second tab preserves the latest timer and unrelated preferences when editing', () => {
  const storage = memoryStorage();
  const first = createStateStore(storage, () => 1000);
  const second = createStateStore(storage, () => 1000);
  first.setRunning(true);
  second.update(draft => { draft.task = 'Read one chapter'; draft.theme = 'rain'; });
  first.update(draft => { draft.decor.plants = false; });
  const restored = second.refresh();
  assert.equal(restored.session.running, true);
  assert.equal(restored.session.endsAt, 1000 + 25 * 60_000);
  assert.equal(restored.task, 'Read one chapter');
  assert.equal(restored.theme, 'rain');
  assert.equal(restored.decor.plants, false);
});

test('two stores settling the same expired session preserve a single completion', () => {
  let now = 1000;
  const storage = memoryStorage();
  const first = createStateStore(storage, () => now);
  first.setRunning(true);
  const second = createStateStore(storage, () => now);
  now += 25 * 60_000;
  assert.equal(first.update().completed, true);
  assert.equal(second.update().completed, false);
  second.update(draft => { draft.task = 'Next chapter'; });
  assert.equal(first.refresh().history.length, 1);
  assert.equal(createStateStore(storage, () => now).update().completed, false);
});

test('restoring tomorrow credits the deadline date rather than the reopen date', () => {
  let now = new Date(2026, 8, 21, 10, 0).getTime();
  const storage = memoryStorage();
  const first = createStateStore(storage, () => now);
  first.setRunning(true);
  const deadline = first.state.session.endsAt;
  now = new Date(2026, 8, 22, 10, 0).getTime();
  const reopened = createStateStore(storage, () => now);
  const result = reopened.update();
  assert.equal(result.completed, true);
  assert.deepEqual(result.state.history, [{ date: localDate(deadline), minutes: 25 }]);
  assert.notEqual(result.state.history[0].date, localDate(now));
});

test('resetting immediately after expiry keeps the earned completion', () => {
  let now = 1000;
  const store = createStateStore(memoryStorage(), () => now);
  store.setRunning(true);
  now += 25 * 60_000;
  store.update(draft => { draft.session = createSession(draft.session.duration / 60_000); });
  assert.equal(store.state.history.length, 1);
  assert.deepEqual(store.state.session, createSession());
});

test('restore skips corrupted history entries without discarding valid preferences or sessions', () => {
  const saved = freshState();
  saved.theme = 'rain';
  saved.task = 'Keep this task';
  saved.session = startSession(createSession(50), 1000);
  saved.history = [null, {}, { date: '2026-09-21', minutes: -25 }, { date: 'invalid', minutes: 25 }, { date: '2026-09-21', minutes: 50 }];
  const restored = restoreState(JSON.stringify(saved));
  assert.equal(restored.theme, 'rain');
  assert.equal(restored.task, 'Keep this task');
  assert.deepEqual(restored.session, saved.session);
  assert.deepEqual(restored.history, [{ date: '2026-09-21', minutes: 50 }]);
});

test('restore rejects malformed session values and invalid JSON safely', () => {
  const valid = startSession(createSession(), 1000);
  for (const invalid of [
    { ...valid, duration: '1500000' }, { ...valid, remaining: -1 },
    { ...valid, remaining: valid.duration + 1 }, { ...valid, running: 'yes' },
    { ...valid, endsAt: null }, { ...valid, endsAt: 1e20 },
  ]) {
    assert.deepEqual(restoreState(JSON.stringify({ session: invalid })).session, createSession());
  }
  assert.deepEqual(restoreState('{broken json'), freshState());
});

test('blocked writes preserve this visit across later edits and refreshes', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); } };
  const store = createStateStore(storage, () => 1000);
  assert.equal(store.setRunning(true).persisted, false);
  store.update(draft => { draft.task = 'Still working'; });
  const current = store.refresh();
  assert.equal(current.session.running, true);
  assert.equal(current.task, 'Still working');
});

test('existing focus saves gain a furnished room without losing their session', () => {
  const session = startSession(createSession(50), 1234);
  const restored = restoreState(JSON.stringify({ theme: 'rain', task: 'An old room', session }));
  assert.deepEqual(restored.layout, createLayout());
  assert.deepEqual(restored.session, session);
  assert.equal(restored.task, 'An old room');
});

test('restoring furniture drops invalid pieces while preserving the active study desk', () => {
  const layout = createLayout('creative-corner');
  const deskId = layout.activeDeskId;
  layout.items.push(null, { id: 'unknown', type: 'not-in-the-collection', x: 0, z: 0, rotation: 0 }, { id: 'outside', type: 'plant', x: 100, z: 100, rotation: 0 });
  const restored = restoreState(JSON.stringify({ layout }));
  assert.deepEqual(restored.layout, createLayout('creative-corner'));
  assert.equal(restored.layout.activeDeskId, deskId);
});

test('furniture edits from a stale tab preserve the current timer and persist the chosen arrangement', () => {
  const storage = memoryStorage();
  const first = createStateStore(storage, () => 1000);
  const second = createStateStore(storage, () => 1000);
  first.setRunning(true);
  second.update(draft => { draft.layout = createLayout('quiet-library'); });
  const restored = first.refresh();
  assert.equal(restored.session.running, true);
  assert.deepEqual(restored.layout, createLayout('quiet-library'));
  assert.deepEqual(createStateStore(storage).state.layout, createLayout('quiet-library'));
});
