import test from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, createStateStore, storageKey } from '../state.js';
import { createBackup, readBackup } from '../../features/backup/backup.js';

const victory = { version: 1, totalXp: 260, discoveries: [], materials: { heartwood: 1 }, bossVictories: { 'mossback-warden': 1 }, trophies: ['mossback-warden'] };

test('Wilds progress survives reload and the existing home backup without changing coins or friendship', () => {
  const saved = freshState();
  saved.house.coins = 83;
  saved.wilds = structuredClone(victory);
  const bonds = structuredClone(saved.petBonds);
  const restored = restoreState(JSON.stringify(saved));
  assert.deepEqual(restored.wilds, victory);
  assert.equal(restored.house.coins, 83);
  assert.deepEqual(restored.petBonds, bonds);
  const backup = readBackup(createBackup(restored, 1800000000000));
  assert.equal(backup.ok, true);
  assert.deepEqual(backup.state.wilds, victory);
  assert.equal(backup.state.house.coins, 83);
  assert.deepEqual(backup.state.petBonds, bonds);
});

test('a legacy save and backup keep their original fields without creating Wilds progress', () => {
  const legacy = freshState();
  legacy.house.coins = 42;
  legacy.task = 'Read one chapter';
  legacy.rooms[legacy.layout.presetId] = structuredClone(legacy.layout);
  const restored = restoreState(JSON.stringify(legacy));
  assert.deepEqual(restored, legacy);
  assert.equal(Object.hasOwn(restored, 'wilds'), false);
  assert.deepEqual(readBackup(createBackup(legacy, 1800000000000)).state, legacy);
});

test('normal home store updates preserve earned Wilds progress', () => {
  const saved = freshState();
  saved.wilds = structuredClone(victory);
  let raw = JSON.stringify(saved);
  const storage = { getItem: key => key === storageKey ? raw : null, setItem: (_, value) => { raw = value; } };
  const store = createStateStore(storage, () => 1800000000000);
  store.update(draft => { draft.task = 'After the forest'; });
  assert.equal(JSON.parse(raw).task, 'After the forest');
  assert.deepEqual(JSON.parse(raw).wilds, victory);
});
