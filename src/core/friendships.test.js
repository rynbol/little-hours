import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FRIENDSHIP_LEVELS, petEntity, pairMembers, normalizeFriendships, friendshipBetween, shareFriendshipMoment, recordFriendshipFocus } from './friendships.js';

const cat = petEntity('cat'), dog = petEntity('dog'), fox = petEntity('fox');
const allowed = new Set([cat, dog, fox]);
const pairKey = (a, b) => JSON.stringify([a, b].sort());
const fresh = entities => normalizeFriendships(null, entities || allowed);
const moment = (state, kind = 'play', day = '2026-09-27') => shareFriendshipMoment(state, cat, dog, kind, day, 1000, allowed);

test('friendship identities are undirected and constrained by the allowed entity boundary', () => {
  assert.deepEqual(pairMembers(dog, cat, allowed), [cat, dog]);
  assert.equal(pairMembers(cat, cat, allowed), null);
  assert.equal(pairMembers(cat, 'pet:panda', allowed), null);
  assert.equal(pairMembers(null, cat, allowed), null);
  const state = fresh();
  const before = structuredClone(state);
  for (const [a, b, kind] of [[cat, cat, 'play'], [cat, 'pet:panda', 'play'], [cat, dog, '__proto__']]) {
    assert.equal(shareFriendshipMoment(state, a, b, kind, '2026-09-27', 1000, allowed).ok, false);
  }
  assert.deepEqual(state, before);
});

test('reading untouched friendships gives a zero view without creating saved records', () => {
  const state = fresh();
  const view = friendshipBetween(state, dog, cat);
  assert.deepEqual(view.members, [cat, dog]);
  assert.equal(view.affection, 0);
  assert.equal(view.level.index, 0);
  assert.equal(view.level.next.at, 6);
  assert.equal(view.level.progress, 0);
  view.memories.push({ kind: 'focus', at: 0, value: 25 });
  assert.deepEqual(state, { pairs: {}, focusBuddies: {} });
  assert.equal(friendshipBetween(state, cat, dog).memories.length, 0);
});

test('daily moments reward each kind once per pair, preserve memories, and cannot rewind the day', () => {
  let state = fresh();
  assert.equal(moment(state).earned, 1);
  assert.equal(shareFriendshipMoment(state, dog, cat, 'play', '2026-09-27', 1001, allowed).earned, 0);
  assert.equal(moment(state, 'snack').earned, 1);
  assert.equal(moment(state, 'quiet').earned, 1);
  assert.equal(friendshipBetween(state, cat, dog).memories.length, 3);
  assert.equal(Object.keys(state.pairs).length, 1);
  state = normalizeFriendships(JSON.parse(JSON.stringify(state)), allowed);
  assert.equal(moment(state, 'quiet').earned, 0);
  assert.equal(moment(state, 'play', '2026-09-28').earned, 1);
  const snapshot = structuredClone(state);
  assert.equal(moment(state, 'snack', '2026-09-27').earned, 0);
  assert.deepEqual(state, snapshot);
  assert.equal(shareFriendshipMoment(state, cat, fox, 'play', '2026-09-28', 1000, allowed).earned, 1);
  assert.equal(friendshipBetween(state, cat, dog).affection, 4);
});

test('focus milestones record shared time without touching daily moment claims', () => {
  const state = fresh();
  assert.equal(recordFriendshipFocus(state, [cat, dog], 4, 1000, allowed), null);
  assert.deepEqual(state.pairs, {});
  moment(state);
  const reward = recordFriendshipFocus(state, [dog, cat], 25, 2000, allowed);
  assert.deepEqual(reward, { ok: true, members: [cat, dog], earned: 5, unlocked: true, level: 1 });
  const view = friendshipBetween(state, cat, dog);
  assert.deepEqual([view.affection, view.minutes, view.sessions], [6, 25, 1]);
  assert.deepEqual(view.rewardedMoments, ['play']);
  assert.deepEqual(view.memories.slice(-2), [{ kind: 'focus', at: 2000, value: 25 }, { kind: 'level', at: 2000, value: 1 }]);
  assert.equal(view.level.progress, 0);
  assert.equal(view.level.next.at, 20);
  assert.equal(recordFriendshipFocus(state, [cat, dog], 220, 3000, allowed).level, 3);
  assert.equal(friendshipBetween(state, dog, cat).level.progress, 1);
  assert.equal(friendshipBetween(state, dog, cat).level.next, undefined);
  assert.deepEqual(FRIENDSHIP_LEVELS.map(level => level.at), [0, 6, 20, 50]);
});

test('the relationship domain supports allowed people without importing pet rules', () => {
  const entities = new Set(['person:alex', 'person:sam', cat]);
  const state = fresh(entities);
  assert.equal(shareFriendshipMoment(state, 'person:sam', 'person:alex', 'quiet', '2026-09-27', 1000, entities).earned, 1);
  assert.equal(recordFriendshipFocus(state, ['person:alex', 'person:sam'], 25, 2000, entities).earned, 5);
  const restored = normalizeFriendships({ ...state, focusBuddies: { 'person:alex': 'person:sam' } }, entities);
  assert.deepEqual(friendshipBetween(restored, 'person:sam', 'person:alex').members, ['person:alex', 'person:sam']);
  assert.equal(restored.focusBuddies['person:alex'], 'person:sam');
  assert.deepEqual(normalizeFriendships(restored, allowed), fresh());
});

test('malformed saves are bounded and duplicate directions deterministically keep one record', () => {
  const canonical = pairKey(cat, dog), reversed = JSON.stringify([dog, cat]);
  const record = { affection: 1e12, minutes: -1, sessions: 2.5, rewardDay: '2026-02-30', rewardedMoments: ['play'], memories: [
    { kind: 'play', at: 0, value: 1 }, { kind: 'focus', at: -1, value: 25 }, { kind: 'level', at: 1000, value: 999 }, { kind: 'unknown', at: 1000, value: 25 },
  ] };
  const pairs = { [reversed]: { affection: 40 }, [canonical]: record, 'not json': record, '["pet:cat"]': record, [pairKey(cat, 'person:alex')]: record, '["pet:cat","pet:cat"]': record };
  const normalized = normalizeFriendships({ pairs, focusBuddies: { [cat]: dog, [dog]: dog, [fox]: 'pet:panda' } }, allowed);
  assert.deepEqual(Object.keys(normalized.pairs), [canonical]);
  assert.deepEqual(normalized.pairs[canonical], { affection: 1_000_000_000, minutes: 0, sessions: 0, rewardDay: '', rewardedMoments: [], memories: [{ kind: 'play', at: 0, value: 1 }, { kind: 'level', at: 1000, value: 3 }] });
  assert.deepEqual(normalized.focusBuddies, { [cat]: dog });
  assert.deepEqual(normalizeFriendships({ pairs: Object.fromEntries(Object.entries(pairs).reverse()), focusBuddies: { [cat]: dog } }, allowed), normalized);
  assert.equal(normalizeFriendships({ pairs: { [reversed]: { affection: 7 } } }, allowed).pairs[canonical].affection, 7);
});

test('invalid action data never creates progress and valid leap days retain daily claims', () => {
  const state = fresh();
  for (const day of ['bad', '2026-02-29', '2026-04-31', '2026-13-01']) assert.equal(moment(state, 'play', day).ok, false);
  assert.equal(shareFriendshipMoment(state, cat, dog, 'play', '2026-09-27', Infinity, allowed).ok, false);
  for (const [pair, minutes, at] of [[null, 25, 1000], [[cat, cat], 25, 1000], [[cat, 'pet:panda'], 25, 1000], [[cat, dog], 5.5, 1000], [[cat, dog], Infinity, 1000], [[cat, dog], 25, -1]]) {
    assert.equal(recordFriendshipFocus(state, pair, minutes, at, allowed), null);
  }
  assert.deepEqual(state.pairs, {});
  assert.equal(moment(state, 'quiet', '2028-02-29').earned, 1);
  const restored = normalizeFriendships(state, allowed);
  assert.equal(moment(restored, 'quiet', '2028-02-29').earned, 0);
});

test('long friendships retain twelve memories and keep counters at safe bounds', () => {
  const state = fresh();
  for (let i = 0; i < 30; i++) recordFriendshipFocus(state, [cat, dog], 5, i, allowed);
  assert.equal(friendshipBetween(state, cat, dog).memories.length, 12);
  const key = pairKey(cat, dog);
  const capped = normalizeFriendships({ pairs: { [key]: { affection: 999_999_999, minutes: 999_999_999, sessions: 1_000_000_000, memories: state.pairs[key].memories } } }, allowed);
  assert.equal(recordFriendshipFocus(capped, [cat, dog], 25, 5000, allowed).earned, 1);
  assert.deepEqual([capped.pairs[key].affection, capped.pairs[key].minutes, capped.pairs[key].sessions], [1_000_000_000, 1_000_000_000, 1_000_000_000]);
  assert.equal(moment(capped).earned, 0);
  assert.equal(capped.pairs[key].memories.length, 12);
});
