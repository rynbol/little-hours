import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, createStateStore, storageKey } from './state.js';
import { createSession } from './session.js';
import { focusOutlook } from './focus-outlook.js';

function home() {
  let raw = JSON.stringify(freshState()), at = 1_800_000_000_000;
  const storage = { getItem: key => key === storageKey ? raw : null, setItem: (_, value) => { raw = value; } };
  return { store: createStateStore(storage, () => at), advance: minutes => { at += minutes * 60_000; } };
}

test('the preview matches earned coins, pet hearts and flower growth without changing the save', () => {
  const { store, advance } = home(); store.plantSeed('cosmos', 0);
  const before = structuredClone(store.state), preview = focusOutlook(store.state);
  assert.deepEqual(store.state, before);
  assert.equal(preview.coins, 25); assert.equal(preview.hearts, 5);
  assert.deepEqual(preview.pet, { id: 'cat', name: 'Miso' });
  assert.deepEqual(preview.goal, { kind: 'room', id: 'garden', name: 'Greenhouse', price: 25, saved: 0, after: 25, ready: false, reachable: true });
  store.setRunning(true); advance(25);
  const { completion } = store.update();
  assert.equal(completion.coins, preview.coins); assert.equal(completion.pet.hearts, preview.hearts);
  assert.equal(completion.garden.after, preview.plant.after); assert.equal(preview.plant.blooms, false);
  assert.equal(focusOutlook(store.state).goal.ready, true);
  assert.equal(focusOutlook(store.state).plant.blooms, true);
});

test('paused sessions preview their captured pet and flower even after the selection changes', () => {
  const { store } = home(); store.plantSeed('cosmos', 0); store.setRunning(true); store.setRunning(false);
  store.update(draft => { draft.pet = 'dog'; draft.house.coins = 10; }); store.plantSeed('lavender', 1);
  const preview = focusOutlook(store.state);
  assert.equal(preview.pet.id, 'cat'); assert.equal(preview.plant.id, 'plant-1'); assert.equal(preview.plant.after, 25);
  store.update(draft => { draft.session = createSession(); });
  assert.equal(focusOutlook(store.state).pet.id, 'dog'); assert.equal(focusOutlook(store.state).plant.id, 'plant-2');
});

test('a short session promises neither currency, hearts nor flower growth', () => {
  const { store } = home(); store.plantSeed('cosmos', 0); store.update(draft => { draft.session = createSession(3); });
  const preview = focusOutlook(store.state);
  assert.equal(preview.coins, 0); assert.equal(preview.hearts, 0); assert.equal(preview.plant.after, 0); assert.equal(preview.goal.reachable, false);
});

test('a pet wish takes precedence, and the preview caps growth at the bloom', () => {
  const { store } = home(); store.plantSeed('cosmos', 0);
  store.update(draft => { draft.petWish = 'bunny'; draft.house.coins = 15; draft.garden.plants[0].minutes = 40; });
  const preview = focusOutlook(store.state);
  assert.deepEqual(preview.goal, { kind: 'pet', id: 'bunny', name: 'Dango', price: 40, saved: 15, after: 40, ready: false, reachable: true });
  assert.equal(preview.plant.after, 50); assert.equal(preview.plant.blooms, true);
  store.update(draft => { draft.house.coins = 41; });
  assert.equal(focusOutlook(store.state).goal.after, 40); assert.equal(focusOutlook(store.state).goal.ready, true);
});

test('a completed house needs no purchase goal, and a captured empty bed stays empty', () => {
  const { store } = home(); store.setRunning(true); store.setRunning(false); store.plantSeed('cosmos', 0);
  assert.equal(focusOutlook(store.state).plant, null);
  const state = freshState(); state.house.rooms.push({}, {});
  assert.equal(focusOutlook(state).goal, null);
  state.petWish = 'cat'; assert.equal(focusOutlook(state).goal, null);
});
