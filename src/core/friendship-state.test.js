import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshState, restoreState, createStateStore, storageKey } from './state.js';
import { createSession, sessionStarted } from './session.js';
import { petEntity, friendshipBetween, FRIENDSHIP_LEVELS } from './friendships.js';
import { createBackup, readBackup } from '../features/backup/backup.js';

const MINUTE = 60_000, START = Date.parse('2026-09-27T10:00:00Z');
const cat = petEntity('cat'), dog = petEntity('dog'), fox = petEntity('fox');
const catDog = [cat, dog];
const threePets = () => restoreState(JSON.stringify({ ...freshState(), pets: ['cat', 'dog', 'fox'] }));

function fixture(state = freshState()) {
  let time = START;
  const values = new Map([[storageKey, JSON.stringify(state)]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  return { store: createStateStore(storage, () => time), open: () => createStateStore(storage, () => time), advance: ms => { time += ms; }, now: () => time };
}

test('legacy saves acquire an empty friendship graph without inventing time or memories', () => {
  const legacy = freshState();
  delete legacy.friendships;
  legacy.petBonds.cat.affection = 24;
  legacy.petBonds.cat.minutes = 120;
  legacy.history = [{ date: '2026-09-26', minutes: 25 }];
  const restored = restoreState(JSON.stringify(legacy));
  assert.deepEqual(restored.friendships, { pairs: {}, focusBuddies: {} });
  assert.equal(restored.petBonds.cat.affection, 24);
  assert.equal(restored.petBonds.cat.minutes, 120);
  assert.equal(restored.history.length, 1);
});

test('buddy preferences validate both owned endpoints and do not create friendship progress', () => {
  const f = fixture();
  f.store.setFocusBuddy(cat, dog);
  f.store.setFocusBuddy(dog, cat);
  const expected = { pairs: {}, focusBuddies: { [cat]: dog, [dog]: cat } };
  assert.deepEqual(f.store.state.friendships, expected);
  for (const [owner, buddy] of [[cat, cat], [cat, fox], [fox, dog], [cat, 'person:sam'], ['person:alex', dog]]) {
    f.store.setFocusBuddy(owner, buddy);
    assert.deepEqual(f.store.state.friendships, expected);
  }
  f.store.setFocusBuddy(cat, null);
  assert.deepEqual(f.store.state.friendships.focusBuddies, { [dog]: cat });
  assert.deepEqual(f.open().state.friendships, f.store.state.friendships);
});

test('shared moment transactions reward reversed pairs once across stores and reloads', () => {
  const f = fixture(), other = f.open();
  f.store.shareFriendshipMoment(cat, dog, 'play');
  other.shareFriendshipMoment(dog, cat, 'play');
  assert.equal(friendshipBetween(other.state.friendships, cat, dog).affection, 1);
  f.store.shareFriendshipMoment(cat, dog, 'snack');
  const reloaded = f.open();
  reloaded.shareFriendshipMoment(dog, cat, 'snack');
  const progress = friendshipBetween(reloaded.state.friendships, dog, cat);
  assert.equal(progress.affection, 2);
  assert.equal(progress.memories.length, 2);
  assert.equal(Object.keys(reloaded.state.friendships.pairs).length, 1);
  const before = structuredClone(reloaded.state.friendships);
  reloaded.shareFriendshipMoment(cat, fox, 'quiet');
  reloaded.shareFriendshipMoment(cat, dog, '__proto__');
  assert.deepEqual(reloaded.state.friendships, before);
  assert.equal(reloaded.state.house.coins, 0);
  assert.equal(reloaded.state.petBonds.cat.affection, 0);
  assert.equal(reloaded.state.petBonds.dog.affection, 0);
  f.advance(30 * 86400_000);
  reloaded.shareFriendshipMoment(dog, cat, 'play');
  const afterNewDay = structuredClone(reloaded.state.friendships);
  f.advance(-86400_000);
  reloaded.shareFriendshipMoment(cat, dog, 'quiet');
  assert.deepEqual(reloaded.state.friendships, afterNewDay);
});

test('focus captures its pair once through pause, pet changes, buddy changes, and another tab', () => {
  const f = fixture(threePets());
  f.store.setFocusBuddy(cat, dog);
  f.store.setRunning(true);
  assert.deepEqual(f.store.state.session.friendPair, catDog);
  f.advance(MINUTE);
  f.store.setRunning(false);
  const other = f.open();
  other.setFocusBuddy(cat, fox);
  other.setFocusBuddy(fox, dog);
  other.update(draft => { draft.pet = 'fox'; });
  const reloaded = f.open();
  reloaded.setRunning(true);
  reloaded.setRunning(true);
  assert.equal(reloaded.state.session.petId, 'cat');
  assert.deepEqual(reloaded.state.session.friendPair, catDog);
  f.advance(24 * MINUTE);
  const completed = reloaded.update();
  assert.deepEqual(completed.completion.friendship.members, catDog);
  assert.deepEqual(completed.completion.friendship.names, ['Miso', 'Mochi']);
  assert.equal(completed.completion.friendship.hearts, 5);
  const pair = friendshipBetween(completed.state.friendships, dog, cat);
  assert.deepEqual([pair.affection, pair.minutes, pair.sessions], [5, 25, 1]);
  assert.equal(pair.memories.filter(memory => memory.kind === 'focus').length, 1);
  assert.equal(friendshipBetween(completed.state.friendships, cat, fox).affection, 0);
  assert.equal(friendshipBetween(completed.state.friendships, dog, fox).affection, 0);
  assert.deepEqual([completed.state.petBonds.cat.affection, completed.state.petBonds.cat.minutes, completed.state.petBonds.cat.sessions], [5, 25, 1]);
  assert.equal(completed.state.petBonds.dog.affection, 0);
  assert.equal(completed.state.petBonds.fox.affection, 0);
  assert.equal(completed.state.house.coins, 25);
  assert.equal(completed.state.history.length, 1);
  assert.equal(f.store.update().completion, null);
  assert.equal(friendshipBetween(f.store.state.friendships, cat, dog).sessions, 1);
});

test('an explicitly solo session stays solo when a buddy is chosen before resume', () => {
  const f = fixture();
  f.store.setRunning(true);
  assert.equal(f.store.state.session.friendPair, null);
  f.advance(MINUTE);
  f.store.setRunning(false);
  f.store.setFocusBuddy(cat, dog);
  const reloaded = f.open();
  assert.equal(reloaded.state.session.friendPair, null);
  reloaded.setRunning(true);
  assert.equal(reloaded.state.session.friendPair, null);
  f.advance(24 * MINUTE);
  const result = reloaded.update();
  assert.equal(result.completion.friendship, null);
  assert.deepEqual(result.state.friendships.pairs, {});
  assert.equal(result.state.petBonds.cat.affection, 5);
  reloaded.setRunning(true);
  assert.deepEqual(reloaded.state.session.friendPair, catDog);
});

test('legacy partial and running sessions do not acquire a newly available focus pair', () => {
  for (const running of [false, true]) {
    const legacy = freshState();
    legacy.friendships = { pairs: {}, focusBuddies: { [cat]: dog } };
    legacy.session = { ...createSession(), petId: 'cat', remaining: 24 * MINUTE, running, endsAt: running ? START + 24 * MINUTE : null };
    const f = fixture(legacy);
    assert.equal(f.store.state.session.friendPair, null);
    f.store.setRunning(true);
    assert.equal(f.store.state.session.friendPair, null);
    f.advance(24 * MINUTE);
    assert.equal(f.store.update().completion.friendship, null);
    assert.deepEqual(f.store.state.friendships.pairs, {});
  }
});

test('deadline reset and replacement preserve completed pair facts before further mutations', () => {
  for (const replacementMinutes of [25, 50]) {
    const f = fixture(threePets());
    f.store.shareFriendshipMoment(cat, dog, 'play');
    f.store.setFocusBuddy(cat, dog);
    f.store.setRunning(true);
    f.advance(25 * MINUTE);
    const result = f.store.update(draft => {
      draft.pet = 'fox';
      draft.session = createSession(replacementMinutes);
      draft.petBonds.cat.name = 'Maple';
      draft.petBonds.dog.name = 'Waffles';
      draft.friendships.focusBuddies[cat] = fox;
    });
    assert.deepEqual(result.completion, {
      at: START + 25 * MINUTE, minutes: 25, coins: 25,
      pet: { id: 'cat', name: 'Miso', hearts: 5, bondTitle: 'Getting to know you' },
      friendship: { members: catDog, names: ['Miso', 'Mochi'], hearts: 5, bondTitle: FRIENDSHIP_LEVELS[1].title },
    });
    assert.equal(result.state.session.duration, replacementMinutes * MINUTE);
    assert.equal(result.state.pet, 'fox');
    assert.equal(result.state.petBonds.cat.name, 'Maple');
    assert.equal(friendshipBetween(result.state.friendships, cat, dog).affection, 6);
    assert.equal(f.store.update().completion, null);
    assert.equal(f.open().state.house.coins, 25);
  }
});

test('running backups preserve the captured pair when imported paused and resumed', () => {
  const f = fixture(threePets());
  f.store.shareFriendshipMoment(cat, dog, 'snack');
  f.store.setFocusBuddy(cat, dog);
  f.store.setRunning(true);
  f.advance(MINUTE);
  f.store.setFocusBuddy(cat, fox);
  const backup = readBackup(createBackup(f.store.state, f.now()));
  assert.equal(backup.ok, true);
  assert.equal(backup.state.session.running, false);
  assert.equal(backup.state.session.remaining, 24 * MINUTE);
  assert.deepEqual(backup.state.session.friendPair, catDog);
  assert.deepEqual(backup.state.friendships, f.store.state.friendships);
  const imported = fixture(backup.state);
  imported.store.setRunning(true);
  assert.deepEqual(imported.store.state.session.friendPair, catDog);
  imported.advance(24 * MINUTE);
  const result = imported.store.update();
  assert.deepEqual(result.completion.friendship.members, catDog);
  assert.equal(friendshipBetween(result.state.friendships, cat, dog).affection, 6);
  assert.equal(friendshipBetween(result.state.friendships, cat, fox).affection, 0);
});

test('restored focus pairs must be valid owned pairs containing the captured primary pet', () => {
  for (const friendPair of [[dog, fox], [cat, cat], [cat, 'pet:panda'], [cat, 'person:sam'], [cat, dog, fox], 'cat,dog']) {
    const state = threePets();
    state.session = { ...createSession(), petId: 'cat', remaining: 24 * MINUTE, friendPair };
    const restored = restoreState(JSON.stringify(state));
    assert.equal(restored.session.friendPair, null);
  }
  const valid = threePets();
  valid.session = { ...createSession(), petId: 'cat', remaining: 24 * MINUTE, friendPair: [dog, cat] };
  assert.deepEqual(restoreState(JSON.stringify(valid)).session.friendPair, catDog);
  delete valid.session.petId;
  assert.equal(restoreState(JSON.stringify(valid)).session.friendPair, null);
});

test('short sessions and pair moments do not create extra personal rewards or coins', () => {
  const f = fixture();
  f.store.shareFriendshipMoment(cat, dog, 'quiet');
  f.store.setFocusBuddy(cat, dog);
  f.store.update(draft => { draft.session = createSession(1); });
  f.store.setRunning(true);
  f.advance(MINUTE);
  const result = f.store.update();
  assert.equal(result.completion.friendship, null);
  assert.equal(friendshipBetween(result.state.friendships, cat, dog).affection, 1);
  assert.equal(friendshipBetween(result.state.friendships, cat, dog).sessions, 0);
  assert.equal(result.state.petBonds.cat.affection, 0);
  assert.equal(result.state.petBonds.dog.affection, 0);
  assert.equal(result.state.house.coins, 0);
});

test('stale controls target their explicit primary and pair after another tab changes selection', () => {
  const f = fixture(threePets()), other = f.open();
  other.update(draft => { draft.pet = 'fox'; });
  f.store.setFocusBuddy(cat, dog);
  f.store.shareFriendshipMoment(cat, dog, 'play');
  assert.equal(f.store.state.pet, 'fox');
  assert.deepEqual(f.store.state.friendships.focusBuddies, { [cat]: dog });
  assert.equal(friendshipBetween(f.store.state.friendships, cat, dog).affection, 1);
  assert.equal(friendshipBetween(f.store.state.friendships, dog, fox).affection, 0);
  assert.equal(friendshipBetween(f.store.state.friendships, cat, fox).affection, 0);
  assert.equal(f.store.state.petBonds.fox.affection, 0);
});

test('zero elapsed and backward-clock pauses retain captured company through reload', () => {
  for (const elapsed of [0, -MINUTE]) {
    const f = fixture(threePets());
    f.store.setFocusBuddy(cat, dog);
    f.store.setRunning(true);
    f.advance(elapsed);
    f.store.setRunning(false);
    assert.equal(f.store.state.session.remaining, f.store.state.session.duration);
    assert.equal(sessionStarted(f.store.state.session), true);
    f.store.update(draft => { draft.pet = 'fox'; });
    f.store.setFocusBuddy(cat, fox);
    f.store.setFocusBuddy(fox, dog);
    const reloaded = f.open();
    assert.equal(sessionStarted(reloaded.state.session), true);
    reloaded.setRunning(true);
    assert.equal(reloaded.state.session.petId, 'cat');
    assert.deepEqual(reloaded.state.session.friendPair, catDog);
    f.advance(25 * MINUTE);
    const result = reloaded.update();
    assert.deepEqual(result.completion.friendship.members, catDog);
    assert.equal(result.completion.pet.id, 'cat');
    assert.equal(result.state.petBonds.fox.affection, 0);
  }
});

test('explicit reset and duration replacement release captured company for the next start', () => {
  for (const minutes of [25, 50]) {
    const f = fixture(threePets());
    f.store.setFocusBuddy(cat, dog);
    f.store.setRunning(true);
    f.store.setRunning(false);
    f.store.update(draft => { draft.pet = 'fox'; draft.session = createSession(minutes); });
    f.store.setFocusBuddy(fox, dog);
    const reloaded = f.open();
    assert.equal(sessionStarted(reloaded.state.session), false);
    reloaded.setRunning(true);
    assert.equal(reloaded.state.session.petId, 'fox');
    assert.deepEqual(reloaded.state.session.friendPair, [dog, fox]);
    assert.equal(reloaded.state.session.duration, minutes * MINUTE);
  }
});

test('zero elapsed backup resume retains company while expired backup restarts release it', () => {
  const f = fixture(threePets());
  f.store.setFocusBuddy(cat, dog);
  f.store.setRunning(true);
  f.store.update(draft => { draft.pet = 'fox'; });
  f.store.setFocusBuddy(fox, dog);
  const immediate = readBackup(createBackup(f.store.state, f.now()));
  assert.equal(immediate.state.session.remaining, 25 * MINUTE);
  assert.equal(sessionStarted(immediate.state.session), true);
  const resumed = fixture(immediate.state);
  resumed.store.setRunning(true);
  assert.equal(resumed.store.state.session.petId, 'cat');
  assert.deepEqual(resumed.store.state.session.friendPair, catDog);
  const expired = readBackup(createBackup(f.store.state, f.now() + 26 * MINUTE));
  assert.equal(expired.state.session.remaining, 25 * MINUTE);
  assert.equal(sessionStarted(expired.state.session), false);
  const restarted = fixture(expired.state);
  restarted.store.setRunning(true);
  assert.equal(restarted.store.state.session.petId, 'fox');
  assert.deepEqual(restarted.store.state.session.friendPair, [dog, fox]);
});
