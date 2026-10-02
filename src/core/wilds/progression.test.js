import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWilds, wildsStats } from './progression.js';

test('old saves receive an independent empty Wilds slice without changing their contents', () => {
  const old = { house: { coins: 55 }, petBonds: { cat: { affection: 24 } } }, before = structuredClone(old);
  const progress = normalizeWilds(old.wilds);
  assert.deepEqual(progress, { version: 1, totalXp: 0, discoveries: [], materials: {}, bossVictories: {}, trophies: [] });
  progress.materials.heartwood = 1;
  assert.deepEqual(normalizeWilds().materials, {});
  assert.deepEqual(old, before);
});

test('save normalization keeps valid progress and rejects malformed, unsafe, and duplicate data', () => {
  const raw = { version: 99, totalXp: 260, discoveries: ['vista', 'vista', null, '__proto__', 2], materials: { heartwood: 2, ore: -1, stone: 1.5 }, bossVictories: { 'mossback-warden': 1, bad: Infinity }, trophies: ['mossback-warden', 'mossback-warden'], gold: 500 };
  const before = structuredClone(raw);
  assert.deepEqual(normalizeWilds(raw), { version: 1, totalXp: 260, discoveries: ['vista'], materials: { heartwood: 2 }, bossVictories: { 'mossback-warden': 1 }, trophies: ['mossback-warden'] });
  assert.deepEqual(raw, before);
  assert.equal(normalizeWilds({ totalXp: NaN }).totalXp, 0);
  assert.equal(normalizeWilds({ totalXp: Number.MAX_SAFE_INTEGER }).totalXp, 1_000_000_000);
});

test('cumulative experience crosses exact level boundaries and first Warden victory reaches level three', () => {
  assert.deepEqual(wildsStats(99), { level: 1, maxHealth: 100, maxStamina: 100, attack: 10, levelXp: 99, nextLevelXp: 100, totalXp: 99 });
  assert.deepEqual(wildsStats(100), { level: 2, maxHealth: 112, maxStamina: 104, attack: 12, levelXp: 0, nextLevelXp: 140, totalXp: 100 });
  assert.deepEqual(wildsStats(260), { level: 3, maxHealth: 124, maxStamina: 108, attack: 14, levelXp: 20, nextLevelXp: 180, totalXp: 260 });
  assert.deepEqual(wildsStats(1_000_000_000), { level: 20, maxHealth: 328, maxStamina: 176, attack: 48, levelXp: 0, nextLevelXp: null, totalXp: 1_000_000_000 });
});
