import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, createStateStore, storageKey } from './state.js';
import { createSession } from './session.js';
import { bondLevel, normalizePetBonds, focusPetId } from './pet-bonds.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

function fixture(state = freshState()) {
  let time = new Date('2026-09-27T10:00:00').getTime(), raw = JSON.stringify(state);
  const storage = { getItem: key => key === storageKey ? raw : null, setItem: (_, value) => { raw = value; } };
  return { store: createStateStore(storage, () => time), open: () => createStateStore(storage, () => time), advance: ms => { time += ms; } };
}

test('legacy saves gain named bonds without inventing shared history', () => {
  const state = restoreState(JSON.stringify({ pet: 'fox', pets: ['fox'], history: [{ date: '2026-09-01', minutes: 25 }] }));
  assert.deepEqual(Object.keys(state.petBonds), ['cat', 'dog', 'fox']);
  assert.equal(state.petBonds.fox.name, 'Hoshi');
  assert.equal(state.petBonds.fox.minutes, 0);
  assert.equal(state.petBonds.fox.affection, 0);
});

test('rituals reward once per day, favorites twice, and affection never decays', () => {
  const f = fixture();
  assert.equal(f.store.petRitual('cat', 'cuddle').ritual.earned, 2);
  assert.equal(f.store.petRitual('cat', 'cuddle').ritual.earned, 0);
  assert.equal(f.store.petRitual('cat', 'play').ritual.earned, 1);
  assert.equal(f.store.petRitual('cat', 'treat').ritual.earned, 1);
  assert.equal(f.store.petRitual('cat', '__proto__').ritual.ok, false);
  f.advance(86400000 * 30);
  assert.equal(f.open().state.petBonds.cat.affection, 4);
  assert.equal(f.store.petRitual('cat', 'cuddle').ritual.earned, 2);
  f.advance(-86400000);
  assert.equal(f.store.petRitual('cat', 'play').ritual.earned, 0, 'moving the clock backward cannot replay an earlier reward day');
});

test('focus credits the starting pet once across pause, switching pets and tabs', () => {
  const f = fixture(); f.store.setRunning(true); f.advance(60000);
  f.store.setRunning(false); f.store.update(draft => { draft.pet = 'dog'; });
  const next = f.open(); next.setRunning(true); f.advance(24 * 60000);
  assert.equal(Boolean(next.update().completion), true);
  assert.equal(Boolean(f.store.update().completion), false);
  const cat = f.store.state.petBonds.cat;
  assert.deepEqual([cat.minutes, cat.sessions, cat.affection], [25, 1, 5]);
  assert.equal(f.store.state.petBonds.dog.minutes, 0);
  assert.equal(cat.memories.filter(m => m.kind === 'focus').length, 1);
});

test('short timers cannot farm hearts and a milestone unlocks a wearable ribbon', () => {
  const f = fixture();
  f.store.update(draft => { draft.session = createSession(1); }); f.store.setRunning(true); f.advance(60000); f.store.update();
  assert.equal(f.store.state.petBonds.cat.affection, 0);
  f.store.update(draft => { draft.session = createSession(40); }); f.store.setRunning(true); f.advance(40 * 60000); f.store.update();
  assert.equal(bondLevel(f.store.state.petBonds.cat).title, 'Little friends');
  assert.equal(f.store.state.petBonds.cat.ribbon, 1);
  f.store.setPetRibbon('cat', 3); assert.equal(f.store.state.petBonds.cat.ribbon, 1);
  f.store.setPetRibbon('cat', 0); assert.equal(f.store.state.petBonds.cat.ribbon, 0);
});

test('adoption creates a personal welcome memory and fulfills only that wish', () => {
  const state = freshState(); state.house.coins = 100; state.petWish = 'fox';
  const f = fixture(state); assert.equal(f.store.adoptPet('fox', '  Juniper  ').adopted, true);
  assert.equal(f.store.state.petBonds.fox.name, 'Juniper');
  assert.equal(f.store.state.petBonds.fox.memories[0].kind, 'welcome');
  assert.equal(f.store.state.petWish, null);
  assert.equal(f.store.adoptPet('fox', 'Overwrite').adopted, false);
  assert.equal(f.store.state.petBonds.fox.name, 'Juniper');
  f.store.renamePet('fox', '  '); assert.equal(f.store.state.petBonds.fox.name, 'Juniper');
});

test('bonds normalize malformed saves and survive home backup', () => {
  const state = freshState();
  state.petBonds.cat = { name: 'A'.repeat(100), minutes: -1, sessions: Infinity, affection: 9, ribbon: 99, ritualDay: 'bad', rituals: ['cuddle', 'cuddle', 'unknown'], memories: [{ kind: 'focus', at: 1000, value: 25 }, { kind: 'x', at: 1000 }] };
  state.petWish = 'dragon'; state.petFamily = 'Dylan & Sam';
  const result = readBackup(createBackup(state, 1000)).state;
  assert.deepEqual(result.petBonds.cat, normalizePetBonds(state.petBonds, state.pets).cat);
  assert.equal(result.petBonds.cat.name.length, 24);
  assert.equal(result.petBonds.cat.ribbon, 1);
  assert.equal(result.petBonds.cat.memories.length, 1);
  assert.equal(result.petWish, null); assert.equal(result.petFamily, 'Dylan & Sam');
});

test('reasserting a running timer and restoring a running backup retain its pet', () => {
  const f = fixture(); f.store.setRunning(true); f.advance(60000);
  f.store.update(draft => { draft.pet = 'dog'; }); f.store.setRunning(true);
  assert.equal(f.store.state.session.petId, 'cat');
  const backup = readBackup(createBackup(f.store.state, f.store.state.session.endsAt - 60000));
  assert.equal(backup.state.session.petId, 'cat');
  assert.equal(backup.state.session.running, false);
});

test('completion preserves its pet and minutes through a replacement transaction', () => {
  const f = fixture(); f.store.setRunning(true); f.advance(25 * 60000);
  const result = f.store.update(draft => { draft.pet = 'dog'; draft.session = createSession(50); draft.petBonds.cat.name = 'Maple'; });
  assert.deepEqual(result.completion, { at: new Date('2026-09-27T10:25:00').getTime(), minutes: 25, coins: 25, pet: { id: 'cat', name: 'Miso', hearts: 5, bondTitle: 'Getting to know you' } });
  assert.equal(result.state.petBonds.cat.affection, 5);
  assert.equal(result.state.petBonds.dog.affection, 0);
  assert.equal(result.state.session.duration, 50 * 60000);
  assert.equal(f.store.update().completion, null);
});

test('pet commands retain their rendered identity when another tab changes selection', () => {
  const f = fixture(), other = f.open(); other.update(draft => { draft.pet = 'dog'; });
  f.store.renamePet('cat', 'Maple');
  f.store.petRitual('cat', 'cuddle');
  f.store.update(draft => { draft.petBonds.cat.affection = 8; });
  f.store.setPetRibbon('cat', 1);
  assert.equal(f.store.state.pet, 'dog');
  assert.equal(f.store.state.petBonds.cat.name, 'Maple');
  assert.equal(f.store.state.petBonds.cat.ribbon, 1);
  assert.equal(f.store.state.petBonds.dog.name, 'Mochi');
  assert.equal(f.store.state.petBonds.dog.affection, 0);
  f.store.renamePet('fox', 'Unavailable');
  assert.equal(f.store.state.petBonds.fox, undefined);
});

test('the next focus preview and command choose the same pet after completion', () => {
  const f = fixture(); f.store.setRunning(true); f.advance(60000);
  f.store.setRunning(false); f.store.update(draft => { draft.pet = 'dog'; });
  assert.equal(focusPetId(f.store.state), 'cat');
  f.store.setRunning(true); f.advance(24 * 60000); f.store.update();
  assert.equal(focusPetId(f.store.state), 'dog');
  f.store.setRunning(true);
  assert.equal(f.store.state.session.petId, 'dog');
});
