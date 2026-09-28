import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archivePetFriendships } from './pet-legacy.js';

const cat = 'pet:cat', dog = 'pet:dog', fox = 'pet:fox';
const allowed = new Set([cat, dog, fox]);
const pairKey = (a, b) => JSON.stringify([a, b].sort());

test('malformed saves are bounded and duplicate directions deterministically keep one record', () => {
  const canonical = pairKey(cat, dog), reversed = JSON.stringify([dog, cat]);
  const record = { affection: 1e12, minutes: -1, sessions: 2.5, rewardDay: '2026-02-30', rewardedMoments: ['play'], memories: [
    { kind: 'play', at: 0, value: 1 }, { kind: 'focus', at: -1, value: 25 }, { kind: 'level', at: 1000, value: 999 }, { kind: 'unknown', at: 1000, value: 25 },
  ] };
  const pairs = { [reversed]: { affection: 40 }, [canonical]: record, 'not json': record, '["pet:cat"]': record, [pairKey(cat, 'person:alex')]: record, '["pet:cat","pet:cat"]': record };
  const normalized = archivePetFriendships({ pairs, focusBuddies: { [cat]: dog, [dog]: dog, [fox]: 'pet:panda' } }, allowed);
  assert.deepEqual(Object.keys(normalized.pairs), [canonical]);
  assert.deepEqual(normalized.pairs[canonical], { affection: 1_000_000_000, minutes: 0, sessions: 0, rewardDay: '', rewardedMoments: [], memories: [{ kind: 'play', at: 0, value: 1 }, { kind: 'level', at: 1000, value: 3 }] });
  assert.deepEqual(normalized.focusBuddies, { [cat]: dog });
  assert.deepEqual(archivePetFriendships({ pairs: Object.fromEntries(Object.entries(pairs).reverse()), focusBuddies: { [cat]: dog } }, allowed), normalized);
  assert.equal(archivePetFriendships({ pairs: { [reversed]: { affection: 7 } } }, allowed).pairs[canonical].affection, 7);
});
