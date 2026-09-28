import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStateStore, freshState, storageKey } from './state.js';
import { createSession } from './session.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

function savedHome(initial = freshState()) {
  const values = new Map([[storageKey, JSON.stringify(initial)]]);
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('room building, wardrobe, fishing and pet care survive backup restore and undo together', () => {
  const initial = freshState();
  initial.house.coins = 300;
  initial.friendships = { pairs: { '["pet:cat","pet:dog"]': { affection: 12, minutes: 25, sessions: 1 } } };
  const storage = savedHome(initial), store = createStateStore(storage, () => 10_000);
  store.buildRoom('garden', 'sakura-studio', 'Fern room');
  store.buildRoom('loft', 'cloud-loft', 'Moon room');
  store.renameRoom('studio', 'Our library');
  store.adoptPet('fox', 'Juniper');
  store.feedPet('fox', 'supper');
  store.choosePetFabric('fox', 'rose');
  store.update(draft => {
    Object.assign(draft.avatar, { style: 'waves', outfit: 'hoodie', bottomStyle: 'shorts', accessory: 'moon-clips' });
    draft.petBonds.fox.minutes = 75;
  });
  store.selectPetGift('fox', 'star');
  store.landFish(0, { species: 'koi', size: 41.5 });
  store.enterHouseRoom('garden');
  const original = structuredClone(store.state);
  const imported = readBackup(createBackup(original, 10_000));
  assert.equal(imported.ok, true);
  store.update(draft => { draft.house.name = 'Temporary home'; draft.house.coins = 1; });
  assert.equal(store.restore(imported.state).restored, true);
  const restored = createStateStore(storage, () => 10_000).state;
  assert.deepEqual(restored, original);
  assert.equal(restored.house.coins, 90);
  assert.deepEqual(restored.house.rooms.map(room => [room.name, room.type]), [['Our library', 'studio'], ['Fern room', 'greenhouse'], ['Moon room', 'attic']]);
  assert.equal(restored.house.rooms[1].layout.items.filter(item => item.type === 'seed-bed').length, 1);
  assert.equal(restored.house.rooms[2].layout.items.filter(item => item.type === 'telescope').length, 1);
  assert.equal(restored.petBonds.fox.care.meals, 1);
  assert.equal(restored.petBonds.fox.care.fabric, 'rose');
  assert.equal(restored.petBonds.fox.gift, 'star');
  assert.equal(restored.pond.journal.koi.best, 41.5);
  assert.equal(restored.legacyPetFriendships.pairs['["pet:cat","pet:dog"]'].affection, 12);
  assert.equal(store.undoRestore().restored, true);
  assert.equal(store.state.house.name, 'Temporary home');
  assert.equal(store.state.house.coins, 1);
  assert.equal(store.state.petBonds.fox.gift, 'star');
});

test('a resumed session rewards its original pet, the current room and the pond once across stale tabs', () => {
  let now = 1000;
  const storage = savedHome(), first = createStateStore(storage, () => now);
  first.update(draft => { draft.house.coins = 100; draft.session = createSession(50); });
  first.buildRoom('garden', 'sakura-studio', 'Fern room');
  first.buildRoom('loft', 'cloud-loft', 'Moon room');
  first.enterHouseRoom('garden');
  first.renamePet('cat', 'Maple');
  first.setRunning(true);
  const second = createStateStore(storage, () => now);
  now += 10 * 60_000;
  first.setRunning(false);
  second.enterHouseRoom('loft');
  second.update(draft => { draft.pet = 'dog'; draft.avatar.accessory = 'glasses'; });
  first.setRunning(true);
  assert.equal(first.state.session.petId, 'cat');
  now += 40 * 60_000;
  const result = second.update();
  assert.equal(result.completion.pet.id, 'cat');
  assert.equal(result.completion.pet.name, 'Maple');
  assert.deepEqual(result.completion.pet.gifts.map(gift => gift.id), ['daisy']);
  assert.equal(first.update().completion, null);
  const reopened = createStateStore(storage, () => now);
  assert.equal(reopened.update().completion, null);
  const state = reopened.state;
  assert.equal(state.house.coins, 50);
  assert.equal(state.petBonds.cat.minutes, 50);
  assert.equal(state.petBonds.cat.affection, 10);
  assert.equal(state.petBonds.dog.minutes, 0);
  assert.equal(state.petBonds.cat.gift, 'daisy');
  assert.deepEqual(state.house.sessions, [{ at: now, minutes: 50, roomId: 'loft' }]);
  assert.deepEqual(state.pond.bait.map(bait => bait.minutes), [10, 50]);
  assert.equal(state.history.length, 1);
  assert.equal(state.avatar.accessory, 'glasses');
});
