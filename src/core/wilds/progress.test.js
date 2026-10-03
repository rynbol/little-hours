import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWilds, wildsLevel, restAtFire, discover, stagVictory } from './progress.js';
import { restoreState, freshState } from '../state.js';

const fresh = { version: 2, xp: 0, heartwood: 0, victories: 0, trophies: [], companions: [], lit: ['camp'], campfire: 'camp', found: [] };

test('a missing or broken save starts at the forest camp with nothing earned', () => {
  assert.deepEqual(normalizeWilds(undefined), fresh);
  assert.deepEqual(normalizeWilds({ xp: -4, heartwood: 1.5, trophies: ['gold-crown'], campfire: 'moon', lit: 'all', found: ['nowhere'] }), fresh);
});

test('a campfire becomes the waking place only once it has been lit', () => {
  assert.equal(normalizeWilds({ campfire: 'shoulder', lit: ['camp'] }).campfire, 'camp');
  const rested = restAtFire(normalizeWilds({}), 'shoulder');
  assert.deepEqual(rested.lit, ['camp', 'shoulder']);
  assert.equal(rested.campfire, 'shoulder');
  assert.deepEqual(normalizeWilds(JSON.parse(JSON.stringify(rested))), rested);
  assert.equal(restAtFire(rested, 'volcano'), rested);
});

test('beating the Mossheart Stag pays experience, heartwood, the antler trophy and the wolf, never gold', () => {
  const won = stagVictory(normalizeWilds({}));
  assert.deepEqual(won, { ...fresh, xp: 240, heartwood: 3, victories: 1, trophies: ['mossheart-antler'], companions: ['wolf'] });
  const again = stagVictory(won);
  assert.equal(again.xp, 300);
  assert.equal(again.heartwood, 4);
  assert.deepEqual(again.trophies, ['mossheart-antler']);
  const state = restoreState(JSON.stringify({ ...freshState(), wilds: won }));
  assert.deepEqual(state.wilds, won);
  assert.equal(state.house.coins, freshState().house.coins);
});

test('levels need more experience each time', () => {
  assert.deepEqual(wildsLevel(0), { level: 1, into: 0, next: 120 });
  assert.deepEqual(wildsLevel(240), { level: 2, into: 120, next: 160 });
  assert.equal(wildsLevel(1e9).level, 20);
});

test('landmarks are remembered once, in a fixed order', () => {
  const seen = discover(discover(discover(normalizeWilds({}), 'ring'), 'vista'), 'ring');
  assert.deepEqual(seen.found, ['vista', 'ring']);
});
