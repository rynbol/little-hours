import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollAdventure, recordAdventure, normalizeBuddy, emptyBuddy, waitingFind, adventureStory, buddyStage, nextBuddyStage, tierWeights, FINDS, PLACES } from './buddy.js';

const sequence = values => { let i = 0; return () => values[i++ % values.length]; };
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('every place has finds of every tier it can roll', () => {
  for (const place of PLACES) for (const tier of ['common', 'uncommon', 'rare']) assert.ok(FINDS.some(find => find.place === place.id && find.tier === tier), `${place.id} ${tier}`);
});

test('a session shorter than five minutes has no adventure', () => {
  assert.equal(rollAdventure(4, sequence([0])), null);
  const buddy = emptyBuddy();
  assert.equal(recordAdventure(buddy, 3, 10, sequence([0])), null);
  assert.equal(buddy.minutes, 3);
  assert.deepEqual(buddy.log, []);
});

test('short sessions stay in the garden and long ones can reach the clouds', () => {
  assert.deepEqual(rollAdventure(10, sequence([.99, .99, 0])), { place: 'garden', find: 'clover' });
  assert.deepEqual(rollAdventure(120, sequence([.99, .99, 0])), { place: 'clouds', find: 'cloud-puff' });
  assert.deepEqual(rollAdventure(120, sequence([.99, 0, 0])), { place: 'clouds', find: 'comet-ribbon' });
});

test('longer sessions find rare things more often', () => {
  assert.ok(tierWeights(90).rare > tierWeights(25).rare);
  const rareShare = minutes => { const random = seeded(3); let rare = 0; for (let i = 0; i < 4000; i++) { const { find } = rollAdventure(minutes, random); if (FINDS.find(f => f.id === find).tier === 'rare') rare++; } return rare / 4000; };
  const short = rareShare(25), long = rareShare(120);
  assert.ok(short > .04 && short < .12, `25 min rare share ${short}`);
  assert.ok(long > .18 && long < .3, `120 min rare share ${long}`);
});

test('recording an adventure fills the collection and waits to be opened', () => {
  const buddy = emptyBuddy();
  const first = recordAdventure(buddy, 25, 100, sequence([0, .9, 0]));
  assert.deepEqual(first, { place: 'garden', find: 'clover', isNew: true });
  const again = recordAdventure(buddy, 25, 200, sequence([0, .9, 0]));
  assert.equal(again.isNew, false);
  assert.deepEqual(buddy.finds.clover, { count: 2, first: 100 });
  assert.equal(buddy.minutes, 50);
  assert.equal(waitingFind(buddy).at, 200);
  buddy.log.at(-1).opened = true;
  assert.equal(waitingFind(buddy).at, 100);
});

test('the story names the buddy, the place and the find', () => {
  assert.equal(adventureStory('Pip', { place: 'woods', find: 'acorn' }), 'Pip wandered to the pine woods and found an acorn cap under the oldest pine.');
  assert.equal(adventureStory('Bean', { place: 'pond', find: 'sea-glass' }), 'Bean wandered to the pond shore and found a sea glass glinting under the dock.');
});

test('the buddy grows with total focus time', () => {
  assert.equal(buddyStage(0).id, 'seed');
  assert.equal(buddyStage(59).id, 'seed');
  assert.equal(buddyStage(60).id, 'sprout');
  assert.equal(buddyStage(5000).id, 'blooming');
  assert.equal(nextBuddyStage(100).id, 'leafy');
  assert.equal(nextBuddyStage(5000), null);
});

test('a broken or hand-edited save keeps only valid buddy data', () => {
  assert.deepEqual(normalizeBuddy(null), emptyBuddy());
  const buddy = normalizeBuddy({ name: '  Bean  ', color: 'mint', minutes: 90, finds: { clover: { count: 2, first: 5 }, dragon: { count: 1, first: 1 }, acorn: { count: 0, first: 1 } }, log: [{ find: 'clover', place: 'garden', minutes: 25, at: 5, opened: true }, { find: 'clover', place: 'clouds', minutes: 25, at: 6 }, { find: 'pebble', place: 'pond', minutes: 30, at: 7 }] });
  assert.deepEqual(buddy, { name: 'Bean', color: 'mint', minutes: 90, finds: { clover: { count: 2, first: 5 } }, log: [{ find: 'clover', place: 'garden', minutes: 25, at: 5, opened: true }, { find: 'pebble', place: 'pond', minutes: 30, at: 7, opened: false }] });
  assert.equal(normalizeBuddy({ color: 'plaid' }).color, 'peach');
});

test('a finished session sends the buddy on an adventure that waits in the save', async () => {
  const { createStateStore, restoreState, freshState } = await import('./state.js');
  const memory = {}, storage = { getItem: key => memory[key] ?? null, setItem: (key, value) => { memory[key] = value; } };
  let now = 1_000;
  const store = createStateStore(storage, () => now);
  store.setRunning(true);
  now += 25 * 60_000;
  const { completion } = store.update();
  assert.equal(completion.buddy.place && typeof completion.buddy.find, 'string');
  assert.equal(store.state.buddy.minutes, 25);
  assert.equal(store.state.buddy.log.length, 1);
  assert.equal(restoreState(memory['little-hours-v1']).buddy.log[0].opened, false);
  const { opened } = store.openBuddyFind();
  assert.equal(opened.find, completion.buddy.find);
  assert.equal(store.openBuddyFind().opened, null);
  store.renameBuddy('  Bean '); store.setBuddyColor('lilac'); store.setBuddyColor('plaid');
  assert.deepEqual([store.state.buddy.name, store.state.buddy.color], ['Bean', 'lilac']);
  const old = freshState(); delete old.buddy; old.history = [{ date: '2026-09-01', minutes: 50 }, { date: '2026-09-02', minutes: 25 }];
  assert.equal(restoreState(JSON.stringify(old)).buddy.minutes, 75);
});
