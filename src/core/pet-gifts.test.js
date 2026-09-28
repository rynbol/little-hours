import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petGifts } from './pet-gifts.js';
import { recordPetFocus } from './pet-bonds.js';
import { freshState, restoreState, createStateStore, storageKey } from './state.js';
import { createSession } from './session.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

function fixture(initial = freshState()) {
  let now = 1_800_000_000_000;
  const values = new Map([[storageKey, JSON.stringify(initial)]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const open = () => createStateStore(storage, () => now);
  return { store: open(), open, advance: ms => { now += ms; }, get now() { return now; } };
}
function finish(f, minutes) {
  f.store.update(draft => { draft.session = createSession(minutes); });
  f.store.setRunning(true); f.advance(minutes * 60_000);
  return f.store.update();
}

test('focus gifts unlock at exact completed-minute thresholds and show the next distance', () => {
  for (const [minutes, earned, next, remaining, selected] of [
    [0, [], 'daisy', 25, null],
    [24, [], 'daisy', 1, null],
    [25, ['daisy'], 'star', 50, 'daisy'],
    [74, ['daisy'], 'star', 1, 'daisy'],
    [75, ['daisy', 'star'], 'moon', 75, 'star'],
    [149, ['daisy', 'star'], 'moon', 1, 'star'],
    [150, ['daisy', 'star', 'moon'], null, 0, 'moon'],
    [200, ['daisy', 'star', 'moon'], null, 0, 'moon'],
  ]) {
    const result = petGifts({ minutes });
    assert.deepEqual([result.earned.map(gift => gift.id), result.next?.id ?? null, result.remaining, result.selected?.id ?? null], [earned, next, remaining, selected]);
  }
  assert.equal(petGifts({ minutes: 150, gift: 'daisy' }).selected.label, 'A daisy for you');
  assert.deepEqual(petGifts({ minutes: 75 }).earned.map(gift => gift.label), ['A daisy for you', 'A paper star']);
  assert.equal(petGifts({ minutes: 150 }).selected.label, 'A moon nightlight');
});

test('imports repair missing, invalid and locked selections using completed minutes alone', () => {
  for (const [minutes, gift, expected] of [[0, 'moon', null], [24, 'daisy', null], [25, 'moon', 'daisy'], [75, undefined, 'star'], [150, null, 'moon'], [150, '__proto__', 'moon'], [150, {}, 'moon'], [150, 'daisy', 'daisy'], [-1, 'moon', null], ['150', 'moon', null], [Infinity, 'moon', null], [7.5, 'moon', null]]) {
    const state = freshState();
    state.petBonds.cat.minutes = minutes; state.petBonds.cat.gift = gift; state.petBonds.cat.affection = 100;
    const restored = restoreState(JSON.stringify(state));
    assert.equal(restored.petBonds.cat.gift, expected);
    assert.deepEqual(restoreState(JSON.stringify(restored)), restored);
  }
  const legacy = restoreState(JSON.stringify({ history: [{ date: '2026-09-01', minutes: 90 }] }));
  assert.equal(legacy.petBonds.cat.gift, null);
  assert.equal(legacy.petBonds.cat.minutes, 0);
});

test('one focus reward can cross several gifts and selects the latest newly earned one', () => {
  const state = freshState();
  state.petBonds.cat.minutes = 40; state.petBonds.cat.gift = 'daisy';
  const reward = recordPetFocus(state, 120, 1000);
  assert.deepEqual(reward.gifts.map(gift => [gift.id, gift.label]), [['star', 'A paper star'], ['moon', 'A moon nightlight']]);
  assert.equal(state.petBonds.cat.gift, 'moon');
  assert.equal(state.petBonds.cat.minutes, 160);
  assert.equal(state.petBonds.cat.affection, 24);
  state.petBonds.cat.gift = 'daisy';
  assert.deepEqual(recordPetFocus(state, 5, 2000).gifts, []);
  assert.equal(state.petBonds.cat.gift, 'daisy');
});

test('only finished qualifying focus grants gifts, never care or abandoned timers', () => {
  const state = freshState(); state.petBonds.cat.minutes = 24; state.house.coins = 10;
  const f = fixture(state);
  f.store.petRitual('cat', 'cuddle'); f.store.petRitual('cat', 'play'); f.store.feedPet('cat', 'supper');
  assert.equal(f.store.state.petBonds.cat.gift, null);
  assert.deepEqual(finish(f, 1).completion.pet.gifts, []);
  assert.equal(f.store.state.petBonds.cat.minutes, 24);
  f.store.update(draft => { draft.session = createSession(25); }); f.store.setRunning(true); f.advance(24 * 60_000);
  f.store.setRunning(false); f.store.update(draft => { draft.session = createSession(25); });
  assert.equal(f.store.state.petBonds.cat.gift, null);
  const result = finish(f, 5);
  assert.deepEqual(result.completion.pet.gifts, [{ id: 'daisy', label: 'A daisy for you' }]);
  assert.equal(result.state.petBonds.cat.gift, 'daisy');
});

test('a captured session pet earns gifts after an immediate pause, reload and pet switch', () => {
  const f = fixture();
  f.store.setRunning(true); f.store.setRunning(false);
  f.store.update(draft => { draft.pet = 'dog'; });
  const resumed = f.open(); resumed.setRunning(true); f.advance(25 * 60_000);
  const result = resumed.update();
  assert.equal(result.state.pet, 'dog');
  assert.equal(result.completion.pet.id, 'cat');
  assert.deepEqual(result.completion.pet.gifts, [{ id: 'daisy', label: 'A daisy for you' }]);
  assert.equal(result.state.petBonds.cat.gift, 'daisy');
  assert.equal(result.state.petBonds.dog.gift, null);
  assert.equal(result.state.petBonds.dog.minutes, 0);
});

test('repeated settlement and stale tabs cannot duplicate focus gifts or rewards', () => {
  const f = fixture(), stale = f.open();
  f.store.setRunning(true); f.advance(25 * 60_000);
  const first = stale.update();
  assert.deepEqual(first.completion.pet.gifts, [{ id: 'daisy', label: 'A daisy for you' }]);
  assert.equal(f.store.update().completion, null);
  assert.equal(stale.update().completion, null);
  assert.equal(f.open().update().completion, null);
  const state = f.open().state;
  assert.equal(state.house.coins, 25);
  assert.deepEqual([state.petBonds.cat.minutes, state.petBonds.cat.sessions, state.petBonds.cat.affection, state.petBonds.cat.gift], [25, 1, 5, 'daisy']);
});

test('gift selection uses current ownership and progress with an explicit pet identity', () => {
  const f = fixture(); finish(f, 25);
  const stale = f.open(); finish(f, 50);
  f.store.update(draft => { draft.pet = 'dog'; });
  const before = structuredClone(f.store.state);
  const result = stale.selectPetGift('cat', 'star');
  assert.equal(result.state.pet, 'dog');
  assert.equal(result.state.petBonds.cat.gift, 'star');
  assert.equal(result.state.petBonds.dog.gift, null);
  stale.selectPetGift('cat', 'daisy');
  assert.equal(f.open().state.petBonds.cat.gift, 'daisy');
  for (const [id, gift] of [['cat', 'moon'], ['dog', 'daisy'], ['fox', 'daisy'], ['cat', 'unknown'], ['__proto__', 'daisy'], ['cat', null]]) stale.selectPetGift(id, gift);
  assert.equal(stale.state.petBonds.cat.gift, 'daisy');
  assert.equal(stale.state.petBonds.dog.gift, null);
  assert.equal(stale.state.petBonds.fox, undefined);
  assert.equal(stale.state.house.coins, before.house.coins);
  assert.equal(stale.state.petBonds.cat.affection, before.petBonds.cat.affection);
  assert.equal(stale.state.petBonds.cat.minutes, before.petBonds.cat.minutes);
});

test('a selection can use a gift unlocked by the same transaction settling focus', () => {
  const f = fixture(); finish(f, 25);
  f.store.update(draft => { draft.session = createSession(50); }); f.store.setRunning(true); f.advance(50 * 60_000);
  const result = f.store.selectPetGift('cat', 'daisy');
  assert.deepEqual(result.completion.pet.gifts, [{ id: 'star', label: 'A paper star' }]);
  assert.equal(result.state.petBonds.cat.gift, 'daisy');
  assert.equal(result.state.house.coins, 75);
  assert.equal(result.state.petBonds.cat.affection, 15);
});

test('completion gift snapshots survive same-transaction replacement and later edits', () => {
  const f = fixture();
  f.store.setRunning(true); f.advance(25 * 60_000);
  const result = f.store.update(draft => {
    draft.petBonds.cat.minutes = 0; draft.petBonds.cat.gift = null; draft.petBonds.cat.name = 'Maple';
    draft.pet = 'dog'; draft.session = createSession(50);
  });
  assert.deepEqual(result.completion.pet, { id: 'cat', name: 'Miso', hearts: 5, bondTitle: 'Getting to know you', gifts: [{ id: 'daisy', label: 'A daisy for you' }] });
  assert.equal(result.state.petBonds.cat.gift, null);
  assert.throws(() => { result.completion.pet.gifts[0].label = 'Changed'; }, TypeError);
  assert.throws(() => { result.completion.pet.gifts.push({ id: 'moon', label: 'Changed' }); }, TypeError);
  assert.equal(f.store.update().completion, null);
});

test('selected gifts and legacy entitlement survive backup without replaying unlocks', () => {
  const f = fixture(); finish(f, 75); f.store.selectPetGift('cat', 'daisy');
  const backup = readBackup(createBackup(f.store.state, f.now));
  assert.equal(backup.ok, true);
  assert.equal(backup.state.petBonds.cat.gift, 'daisy');
  const imported = fixture(backup.state);
  assert.equal(imported.store.update().completion, null);
  assert.equal(imported.open().state.petBonds.cat.gift, 'daisy');
  assert.deepEqual(finish(imported, 5).completion.pet.gifts, []);
  const legacy = JSON.parse(createBackup(f.store.state, f.now));
  delete legacy.save.petBonds.cat.gift;
  const migrated = readBackup(JSON.stringify(legacy));
  assert.equal(migrated.state.petBonds.cat.gift, 'star');
  assert.equal(migrated.state.petBonds.cat.minutes, 75);
  assert.equal(migrated.state.house.coins, 75);
});

test('a running backup keeps its captured pet and earns the gift only after resuming', () => {
  const f = fixture(); f.store.setRunning(true); f.advance(10 * 60_000);
  f.store.update(draft => { draft.pet = 'dog'; });
  const restored = readBackup(createBackup(f.store.state, f.now));
  assert.equal(restored.state.session.running, false);
  assert.equal(restored.state.session.petId, 'cat');
  const imported = fixture(restored.state);
  imported.store.setRunning(true); imported.advance(15 * 60_000);
  const result = imported.store.update();
  assert.deepEqual(result.completion.pet.gifts, [{ id: 'daisy', label: 'A daisy for you' }]);
  assert.equal(result.completion.pet.id, 'cat');
  assert.equal(result.state.petBonds.dog.gift, null);
});
