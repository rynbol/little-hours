import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimSecret, emptyWilds, keepPipFind, kindleFire, levelFor, normalizeWilds, recordVictory, wildsStats } from './progress.js';
import { drinkPotion, purchase, shelf, wearGear } from './gear.js';
import { freshState, restoreState } from '../state.js';
import { collectionFor } from '../catalog.js';

test('beating the stag the first time gives XP, heartwood, the antler trophy and the wolf, and a rematch only XP', () => {
  const wilds = emptyWilds();
  assert.deepEqual(recordVictory(wilds, 'stag'), { boss: 'stag', first: true, xp: 240, heartwood: 3, trophy: 'stag-antler', companion: 'wolf', level: 2, levelsGained: 1 });
  assert.deepEqual(recordVictory(wilds, 'stag'), { boss: 'stag', first: false, xp: 40, heartwood: 0, trophy: null, companion: null, level: 3, levelsGained: 1 });
  assert.deepEqual(wilds, { ...emptyWilds(), xp: 280, heartwood: 3, trophies: ['stag-antler'], companions: ['wolf'], beaten: ['stag'] });
});

test('each level raises health, stamina and attack', () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, span: 100, next: 100 });
  assert.deepEqual(levelFor(260), { level: 3, into: 10, span: 200, next: 450 });
  assert.equal(levelFor(99_999).next, null);
  const plain = { power: 1, guard: 0, glide: 1, sink: 1, swim: 1 };
  assert.deepEqual(wildsStats({ ...emptyWilds(), xp: 0 }), { level: 1, health: 100, stamina: 100, attack: 1, traits: plain });
  assert.deepEqual(wildsStats({ ...emptyWilds(), xp: 260 }), { level: 3, health: 124, stamina: 116, attack: 1.16, traits: { ...plain, power: 1.16 } });
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
    { ...emptyWilds(), trophies: ['stag-antler'], companions: ['wolf'], lit: ['camp'], beaten: ['stag'] });
  assert.deepEqual(normalizeWilds({ secrets: ['heart-seed', 'gold-mine'], owned: ['steel-sword', 'lake-pearl', 'laser'], wear: { sword: 'steel-sword', cape: 'steel-sword', armour: 'leather-jerkin' }, potions: 9 }),
    { ...emptyWilds(), secrets: ['heart-seed'], owned: ['steel-sword', 'lake-pearl'], wear: { sword: 'steel-sword', cape: null, armour: null }, potions: 5 });
});

test('a saved game keeps its Wilds progress and a fresh one starts empty', () => {
  assert.deepEqual(freshState().wilds, emptyWilds());
  const saved = freshState();
  saved.wilds = { xp: 340, heartwood: 3, trophies: ['stag-antler', 'nonsense'], companions: ['wolf'], lit: ['camp', 'stones'], beaten: ['stag'], secrets: ['root-sword'], owned: ['rootwood-sword'], wear: { sword: 'rootwood-sword' }, potions: 2 };
  assert.deepEqual(restoreState(JSON.stringify(saved)).wilds, { xp: 340, heartwood: 3, trophies: ['stag-antler'], companions: ['wolf'], lit: ['camp', 'stones'], beaten: ['stag'], secrets: ['root-sword'], owned: ['rootwood-sword'], wear: { sword: 'rootwood-sword', cape: null, armour: null }, potions: 2 });
});

test('the glowing antler joins the furniture collection only once the stag is beaten', () => {
  const state = freshState(), antler = () => collectionFor(state).some(item => item.id === 'antler-trophy');
  assert.equal(antler(), false);
  recordVictory(state.wilds, 'stag');
  assert.equal(antler(), true);
});

test('each secret is claimed once for XP and its reward, and seeds and gear make you stronger', () => {
  const wilds = emptyWilds();
  assert.deepEqual(claimSecret(wilds, 'root-sword'), { id: 'root-sword', xp: 40, gear: 'rootwood-sword', level: 1, levelsGained: 0 });
  assert.equal(claimSecret(wilds, 'root-sword'), null);
  assert.equal(claimSecret(wilds, 'made-up'), null);
  assert.equal(wilds.wear.sword, 'rootwood-sword');
  assert.deepEqual(claimSecret(wilds, 'heart-seed'), { id: 'heart-seed', xp: 50, health: 15, level: 1, levelsGained: 0 });
  assert.deepEqual(claimSecret(wilds, 'stamina-seed'), { id: 'stamina-seed', xp: 50, stamina: 12, level: 2, levelsGained: 1 });
  claimSecret(wilds, 'glide-chest'); claimSecret(wilds, 'kestrel-feather'); claimSecret(wilds, 'lake-pearl'); claimSecret(wilds, 'spyglass');
  assert.deepEqual(wildsStats(wilds), { level: 3, health: 100 + 24 + 15, stamina: 100 + 16 + 12, attack: 1.16, traits: { power: 1.334, guard: 0, glide: 0.7, sink: 0.85 * 0.88, swim: 0.6 } });
  assert.ok(wilds.trophies.includes('spyglass'));
});

test('the merchant sells for study gold, gates the best gear by level, and never sells the same piece twice', () => {
  const wilds = emptyWilds(), house = { coins: 100 };
  assert.deepEqual(shelf(wilds, house.coins, 1).map(row => [row.id, row.reason]), [['steel-sword', null], ['sturdy-cape', null], ['leather-jerkin', 'level'], ['moonsteel-sword', 'level'], ['potion', null]]);
  assert.deepEqual(purchase(wilds, house, 'steel-sword', 1), { ok: true, price: 60 });
  assert.equal(house.coins, 40);
  assert.equal(wilds.wear.sword, 'steel-sword');
  assert.deepEqual(purchase(wilds, house, 'steel-sword', 1), { ok: false, reason: 'owned' });
  assert.deepEqual(purchase(wilds, house, 'leather-jerkin', 1), { ok: false, reason: 'level' });
  assert.deepEqual(purchase(wilds, { coins: 500 }, 'leather-jerkin', 2), { ok: true, price: 150 });
  assert.deepEqual(purchase(wilds, house, 'potion', 1), { ok: true, price: 15 });
  assert.deepEqual(purchase(wilds, house, 'potion', 1), { ok: true, price: 15 });
  assert.deepEqual(purchase(wilds, house, 'potion', 1), { ok: false, reason: 'coins' });
  assert.equal(house.coins, 10);
  assert.equal(wilds.potions, 2);
  assert.equal(drinkPotion(wilds), true);
  assert.equal(wilds.potions, 1);
  claimSecret(wilds, 'root-sword');
  assert.equal(wilds.wear.sword, 'steel-sword', 'a weaker sword found later is kept, not worn');
  assert.equal(wearGear(wilds, 'rootwood-sword'), true);
  assert.equal(wilds.wear.sword, 'rootwood-sword');
  assert.equal(wearGear(wilds, 'moonsteel-sword'), false);
  const full = { ...emptyWilds(), potions: 5 };
  assert.deepEqual(purchase(full, { coins: 99 }, 'potion', 1), { ok: false, reason: 'full' });
});

test('the find your pet digs up joins the finds Pip keeps, counted once more each time', () => {
  const buddy = { finds: {} };
  assert.equal(keepPipFind(buddy, 'brass-key', 1000), true);
  assert.equal(keepPipFind(buddy, 'brass-key', 2000), false);
  assert.deepEqual(buddy.finds['brass-key'], { count: 2, first: 1000 });
});
