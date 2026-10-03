import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWilds, kindleFire, levelFor, normalizeWilds, recordVictory, wildsStats } from './progress.js';
import { freshState, restoreState } from '../state.js';
import { collectionFor } from '../catalog.js';

test('beating the stag the first time gives XP, heartwood, the antler trophy and the wolf, and a rematch only XP', () => {
  const wilds = emptyWilds();
  assert.deepEqual(recordVictory(wilds, 'stag'), { boss: 'stag', first: true, xp: 240, heartwood: 3, trophy: 'stag-antler', companion: 'wolf', level: 2, levelsGained: 1 });
  assert.deepEqual(recordVictory(wilds, 'stag'), { boss: 'stag', first: false, xp: 40, heartwood: 0, trophy: null, companion: null, level: 3, levelsGained: 1 });
  assert.deepEqual(wilds, { xp: 280, heartwood: 3, trophies: ['stag-antler'], companions: ['wolf'], lit: [], beaten: ['stag'] });
});

test('each level raises health, stamina and attack', () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, span: 100, next: 100 });
  assert.deepEqual(levelFor(260), { level: 3, into: 10, span: 200, next: 450 });
  assert.equal(levelFor(99_999).next, null);
  assert.deepEqual(wildsStats({ ...emptyWilds(), xp: 0 }), { health: 100, stamina: 100, attack: 1 });
  assert.deepEqual(wildsStats({ ...emptyWilds(), xp: 260 }), { health: 124, stamina: 116, attack: 1.16 });
});

test('a campfire is lit once and remembered', () => {
  const wilds = emptyWilds();
  assert.equal(kindleFire(wilds, 'stones'), true);
  assert.equal(kindleFire(wilds, 'stones'), false);
  assert.equal(kindleFire(wilds, 'nowhere'), false);
  assert.deepEqual(wilds.lit, ['stones']);
});

test('a save keeps only Wilds progress it understands', () => {
  assert.deepEqual(normalizeWilds(null), emptyWilds());
  assert.deepEqual(normalizeWilds({ xp: 120.5, heartwood: -3, trophies: ['stag-antler', 'stag-antler', 'crown'], companions: ['wolf', 'dragon'], lit: ['camp', 'moon'], beaten: ['stag', 'stag'] }),
    { xp: 0, heartwood: 0, trophies: ['stag-antler'], companions: ['wolf'], lit: ['camp'], beaten: ['stag'] });
});

test('a saved game keeps its Wilds progress and a fresh one starts empty', () => {
  assert.deepEqual(freshState().wilds, emptyWilds());
  const saved = freshState();
  saved.wilds = { xp: 340, heartwood: 3, trophies: ['stag-antler', 'nonsense'], companions: ['wolf'], lit: ['camp', 'stones'], beaten: ['stag'] };
  assert.deepEqual(restoreState(JSON.stringify(saved)).wilds, { xp: 340, heartwood: 3, trophies: ['stag-antler'], companions: ['wolf'], lit: ['camp', 'stones'], beaten: ['stag'] });
});

test('the glowing antler joins the furniture collection only once the stag is beaten', () => {
  const state = freshState(), antler = () => collectionFor(state).some(item => item.id === 'antler-trophy');
  assert.equal(antler(), false);
  recordVictory(state.wilds, 'stag');
  assert.equal(antler(), true);
});
