import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, createStateStore, storageKey } from './state.js';
import { emptyGarden, normalizeGarden, gardenGrowth, gardenStage } from './garden-plants.js';
import { createSession } from './session.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

function home(coins = 25) {
  const state = freshState(); state.house.coins = coins;
  let raw = JSON.stringify(state), at = 1_800_000_000_000;
  const storage = { getItem: key => key === storageKey ? raw : null, setItem: (_, value) => { raw = value; } };
  return { open: () => createStateStore(storage, () => at), advance: value => { at += value; }, now: () => at };
}
const minutes = n => n * 60_000;

test('a repeated seed purchase for a stale spot cannot spend twice', () => {
  const f = home(), a = f.open(), b = f.open();
  assert.equal(a.plantSeed('cosmos', 0, null).planted.ok, true);
  assert.equal(b.plantSeed('cosmos', 0, null).planted.ok, false);
  assert.equal(b.state.house.coins, 25); assert.equal(b.state.garden.plants.length, 1);
});

test('first seeds are free, later seeds spend coins and keep replaced plants', () => {
  const f = home(10), a = f.open(), stale = f.open();
  assert.deepEqual(a.plantSeed('cosmos', 0).planted, { ok: true, id: 'plant-1', price: 0 });
  assert.equal(stale.plantSeed('lavender', 0).planted.price, 10);
  assert.equal(stale.state.house.coins, 0);
  assert.deepEqual(stale.state.garden.plants.map(p => [p.id, p.slot]), [['plant-1', null], ['plant-2', 0]]);
  for (const [species, slot] of [['moonflower', 1], ['unknown', 0], ['cosmos', -1], ['cosmos', 6]]) assert.equal(a.plantSeed(species, slot).planted.ok, false);
  assert.equal(a.state.garden.plants.length, 2); assert.equal(a.state.house.coins, 0);
});

test('completed focus grows the plant across sessions, blooms once and keeps other rewards', () => {
  const f = home(0), a = f.open(); a.plantSeed('cosmos', 0);
  for (let i = 0; i < 2; i++) {
    a.setRunning(true); f.advance(minutes(25)); const result = a.update();
    assert.equal(result.completion.garden.after, (i + 1) * 25);
    assert.equal(result.completion.garden.bloomed, i === 1);
    assert.equal(result.completion.coins, 25); assert.equal(result.completion.pet.hearts, 5);
    assert.equal(f.open().update().completion, null);
  }
  const plant = f.open().state.garden.plants[0];
  assert.equal(gardenGrowth(plant), 1); assert.equal(gardenStage(plant), 'In bloom');
  assert.equal(a.state.garden.activeId, null); assert.equal(a.state.house.coins, 50);
  a.setRunning(true); f.advance(minutes(25)); assert.equal(a.update().completion.garden, null);
  f.advance(minutes(365 * 24 * 60)); assert.equal(f.open().state.garden.plants[0].minutes, 50);
});

test('a running and immediately paused session keeps its original plant across tabs', () => {
  const f = home(), a = f.open(), b = f.open(); a.plantSeed('cosmos', 0); a.setRunning(true); a.setRunning(false);
  b.plantSeed('lavender', 1); a.setRunning(true); f.advance(minutes(25));
  const result = b.update();
  assert.equal(result.completion.garden.id, 'plant-1');
  assert.deepEqual(result.state.garden.plants.map(p => p.minutes), [25, 0]);
  assert.equal(result.state.garden.activeId, 'plant-2');
  b.setRunning(true); f.advance(minutes(25)); assert.equal(b.update().completion.garden.id, 'plant-2');
});

test('planting during a session does not redirect a captured empty target', () => {
  const f = home(), a = f.open(); a.setRunning(true); a.setRunning(false); a.plantSeed('cosmos', 0);
  assert.equal(a.state.session.plantId, null); a.setRunning(true); f.advance(minutes(25));
  assert.equal(a.update().completion.garden, null); assert.equal(a.state.garden.plants[0].minutes, 0);
});

test('short, paused and reset sessions do not grant garden growth', () => {
  const f = home(), a = f.open(); a.plantSeed('cosmos', 0);
  a.update(draft => { draft.session = createSession(1); }); a.setRunning(true); f.advance(minutes(1));
  assert.equal(a.update().completion.garden, null);
  a.update(draft => { draft.session = createSession(25); }); a.setRunning(true); f.advance(minutes(10)); a.setRunning(false);
  f.advance(minutes(100)); assert.equal(a.update().completion, null);
  a.update(draft => { draft.session = createSession(25); }); assert.equal(a.state.garden.plants[0].minutes, 0);
});

test('normalization preserves legacy saves and rejects malformed ownership and overlapping plots', () => {
  assert.deepEqual(restoreState('{}').garden, emptyGarden());
  const garden = normalizeGarden({ activeId: 'plant-8', plants: [
    { id: 'plant-8', species: 'cosmos', slot: 2, minutes: 900, name: '  Maple  ' },
    { id: 'plant-8', species: 'lavender', slot: 3 }, { id: 'bad', species: 'cosmos' },
    { id: 'plant-9', species: 'unknown' }, { id: 'plant-10', species: 'lavender', slot: 2, minutes: -5 },
  ] });
  assert.equal(garden.activeId, null); assert.equal(garden.nextId, 11);
  assert.deepEqual(garden.plants.map(p => [p.name, p.minutes, p.slot]), [['Maple', 50, 2], ['', 0, null]]);
  assert.deepEqual(normalizeGarden(garden), garden);
});

test('names, growth and placements survive swaps, reload and backup restore with undo', () => {
  const f = home(), a = f.open(); a.plantSeed('cosmos', 0); a.plantSeed('lavender', 1);
  a.renamePlant('plant-1', '  Sunday <3  '); a.placePlant('plant-1', 1);
  assert.deepEqual(a.state.garden.plants.map(p => p.slot), [1, 0]);
  a.setRunning(true); f.advance(minutes(10));
  const backup = readBackup(createBackup(a.state, f.now()));
  assert.equal(backup.state.session.plantId, 'plant-2'); assert.equal(backup.state.session.running, false);
  assert.equal(backup.state.session.remaining, minutes(15));
  a.setRunning(false); a.tendPlant('plant-1'); const previous = structuredClone(a.state);
  a.restore(backup.state); assert.deepEqual(a.state.garden, backup.state.garden);
  assert.equal(f.open().state.garden.plants[0].name, 'Sunday <3');
  a.restore(previous); assert.deepEqual(a.state.garden, previous.garden);
  a.setRunning(true); f.advance(minutes(15)); assert.equal(a.update().completion.garden.id, 'plant-2');
});
