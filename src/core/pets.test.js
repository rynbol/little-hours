import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStateStore, restoreState, freshState } from './state.js';

function fixture(initial) {
  let raw = initial ? JSON.stringify(initial) : null;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  return { store: createStateStore(storage, () => 1000), saved: () => JSON.parse(raw), reopen: () => createStateStore(storage, () => 1000) };
}
const withCoins = coins => { const state = freshState(); state.house.coins = coins; return state; };

test('a new home has the cat and the puppy, and nobody else yet', () => {
  assert.deepEqual(freshState().pets, ['cat', 'dog']);
  assert.deepEqual(restoreState(JSON.stringify({ pets: ['fox', 'dragon'] })).pets, ['cat', 'dog', 'fox']);
  assert.deepEqual(restoreState(JSON.stringify({ pets: 'fox' })).pets, ['cat', 'dog']);
});

test('a saved pet that was never adopted comes back as the cat', () => {
  assert.equal(restoreState(JSON.stringify({ pet: 'panda' })).pet, 'cat');
  assert.equal(restoreState(JSON.stringify({ pet: 'panda', pets: ['panda'] })).pet, 'panda');
  assert.equal(restoreState(JSON.stringify({ pet: 'dog' })).pet, 'dog');
});

test('adopting spends the coins, keeps the pet and brings them into the room', () => {
  const f = fixture(withCoins(100));
  const result = f.store.adoptPet('fox');
  assert.equal(result.adopted, true);
  assert.equal(f.store.state.house.coins, 10);
  assert.deepEqual(f.store.state.pets, ['cat', 'dog', 'fox']);
  assert.equal(f.store.state.pet, 'fox');
  assert.equal(f.reopen().state.pet, 'fox', 'the new pet is still there after a reload');
});

test('adoption refuses without enough coins, twice, or for an unknown pet', () => {
  const f = fixture(withCoins(39));
  assert.deepEqual([f.store.adoptPet('bunny').adopted, f.store.adoptPet('bunny').reason], [false, '1 more coins to welcome Dango home.']);
  assert.equal(f.store.state.house.coins, 39);
  assert.equal(f.store.state.pet, 'cat');
  f.store.update(draft => { draft.house.coins = 40; });
  assert.equal(f.store.adoptPet('bunny').adopted, true);
  assert.deepEqual([f.store.adoptPet('bunny').adopted, f.store.state.house.coins], [false, 0]);
  assert.equal(f.store.adoptPet('dragon').adopted, false);
  assert.equal(f.store.adoptPet('cat').reason, 'Miso already lives with you.');
});
