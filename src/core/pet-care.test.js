import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, createStateStore, storageKey } from './state.js';
import { normalizePetCare } from './pet-care.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

function home(coins = 25) {
  const state = freshState(); state.house.coins = coins;
  let raw = JSON.stringify(state), at = 1_800_000_000_000;
  const storage = { getItem: key => key === storageKey ? raw : null, setItem: (_, value) => { raw = value; } };
  return { open: () => createStateStore(storage, () => at), advance: value => { at += value; } };
}

test('a meal spends coins once and grows the intended pet bond atomically', () => {
  const f = home(), first = f.open(), stale = f.open();
  assert.equal(first.feedPet('cat', 'supper').meal.ok, true);
  assert.equal(first.state.house.coins, 20);
  assert.equal(first.state.petBonds.cat.affection, 1);
  assert.equal(stale.feedPet('cat', 'supper').meal.ok, false);
  assert.equal(stale.state.house.coins, 20);
  assert.equal(stale.state.petBonds.cat.care.meals, 1);
  assert.equal(stale.state.petBonds.dog.affection, 0);
  assert.equal(stale.petRitual('cat', 'treat').ritual.ok, false);
});

test('unaffordable meals, unknown food and unowned pets never spend coins', () => {
  const store = home(4).open();
  for (const [id, food] of [['cat', 'supper'], ['cat', '__proto__'], ['fox', 'supper'], ['__proto__', 'supper']]) assert.equal(store.feedPet(id, food).meal.ok, false);
  assert.equal(store.state.house.coins, 4);
  assert.equal(store.state.petBonds.cat.affection, 0);
  assert.deepEqual(store.state.petBonds.cat.care.foods, []);
});

test('meal and play deadlines survive reload and reject an earlier clock', () => {
  const f = home(), store = f.open();
  store.feedPet('cat', 'supper');
  assert.equal(store.petRitual('cat', 'play').ritual.earned, 1);
  assert.equal(store.petRitual('cat', 'play').ritual.earned, 0);
  f.advance(-60_000);
  assert.equal(f.open().feedPet('cat', 'supper').meal.ok, false);
  assert.equal(f.open().petRitual('cat', 'play').ritual.earned, 0);
  f.advance(21 * 60_000);
  assert.equal(f.open().feedPet('cat', 'crunch').meal.ok, true);
  assert.equal(f.open().petRitual('cat', 'play').ritual.earned, 0);
  f.advance(5 * 60_000);
  assert.equal(f.open().petRitual('cat', 'play').ritual.earned, 1);
  assert.deepEqual(f.open().state.petBonds.cat.care.foods, ['supper', 'crunch']);
  f.advance(365 * 86400_000);
  assert.equal(f.open().state.petBonds.cat.affection, 4);
});

test('belongings are bought once and selected independently for each pet', () => {
  const f = home(), a = f.open(), b = f.open();
  assert.equal(a.choosePetFabric('cat', 'rose').fabric.price, 15);
  assert.equal(b.choosePetFabric('cat', 'rose').fabric.price, 0);
  assert.equal(b.state.house.coins, 10);
  assert.equal(b.choosePetFabric('cat', 'blue').fabric.ok, false);
  assert.equal(b.choosePetFabric('cat', 'linen').fabric.ok, true);
  assert.equal(b.choosePetFabric('cat', 'rose').fabric.price, 0);
  assert.equal(b.state.petBonds.cat.care.fabric, 'rose');
  assert.equal(b.state.petBonds.dog.care.fabric, 'linen');
  assert.equal(b.choosePetFabric('fox', 'linen').fabric.ok, false);
});

test('care fields normalize without granting malformed ownership or future rewards', () => {
  assert.deepEqual(normalizePetCare({ fedUntil: -1, playedUntil: Infinity, meals: -1, foods: ['supper', 'supper', 'x'], fabric: 'blue', belongings: ['rose', 'x'] }), {
    fedUntil: 0, playedUntil: 0, meals: 0, foods: ['supper'], food: 'supper', fabric: 'linen', belongings: ['linen', 'rose'],
  });
  assert.deepEqual(normalizePetCare({ belongings: 'rose' }).belongings, ['linen']);
});

test('legacy progress migrates without multiplying player hearts and a running focus retains its pet', () => {
  const state = freshState(), pair = '["pet:cat","pet:dog"]';
  state.petBonds.cat.name = 'Maple'; state.petBonds.cat.affection = 24; state.petBonds.cat.ribbon = 2;
  state.friendships = { pairs: { [pair]: { affection: 20, minutes: 25, sessions: 1 } }, focusBuddies: { 'pet:cat': 'pet:dog' } };
  state.session = { duration: 1_500_000, remaining: 1_500_000, endsAt: 1_800_000_000_000, running: true, petId: 'cat', friendPair: ['pet:cat', 'pet:dog'] };
  const migrated = restoreState(JSON.stringify(state));
  assert.equal(migrated.petBonds.cat.name, 'Maple'); assert.equal(migrated.petBonds.cat.affection, 24); assert.equal(migrated.petBonds.cat.ribbon, 2);
  assert.equal(migrated.friendships, undefined); assert.equal(migrated.session.friendPair, undefined);
  assert.equal(migrated.legacyPetFriendships.pairs[pair].affection, 20);
  assert.deepEqual(restoreState(JSON.stringify(migrated)), migrated);
  const raw = JSON.stringify(migrated), store = createStateStore({ getItem: () => raw, setItem() {} }, () => 1_800_000_000_001);
  const result = store.update();
  assert.equal(result.completion.pet.id, 'cat'); assert.equal(result.completion.friendship, undefined);
  assert.equal(result.state.petBonds.cat.affection, 29); assert.equal(result.state.legacyPetFriendships.pairs[pair].affection, 20);
});

test('care, coins, personal names and selected belongings survive a backup', () => {
  const f = home(50), store = f.open();
  store.renamePet('cat', 'Maple'); store.feedPet('cat', 'crunch'); store.petRitual('cat', 'play'); store.choosePetFabric('cat', 'sage');
  const restored = readBackup(createBackup(store.state, 1_800_000_000_000)).state;
  assert.deepEqual(restored.petBonds.cat, store.state.petBonds.cat);
  assert.equal(restored.house.coins, 30);
});

test('feeding uses fresh selection-independent ownership and newly completed focus coins', () => {
  const f = home(0), a = f.open(), b = f.open();
  a.setRunning(true); b.update(draft => { draft.pet = 'dog'; }); f.advance(25 * 60_000);
  const result = a.feedPet('cat', 'supper');
  assert.equal(result.state.pet, 'dog'); assert.equal(result.meal.ok, true); assert.equal(result.state.house.coins, 20);
  assert.equal(result.state.petBonds.cat.affection, 6); assert.equal(result.state.petBonds.dog.affection, 0);
  assert.equal(b.update().completion, null);
});
