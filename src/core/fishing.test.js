import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollCatch, baitRange, startFight, stepFight, SPECIES, TIERS, BAIT_RANGES, BAIT_LIMIT, stockBait } from './fishing.js';
import { createStateStore, restoreState, freshState } from './state.js';

const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const tierOfCatch = c => SPECIES.find(s => s.id === c.species).tier;

test('bait falls in a range by session length, and short sessions give none', () => {
  assert.deepEqual([1, 4, 5, 14, 15, 29, 30, 49, 50, 89, 90, 120].map(m => baitRange(m)?.id ?? null),
    [null, null, 'crumb', 'crumb', 'worm', 'worm', 'cricket', 'cricket', 'firefly', 'firefly', 'star', 'star']);
});

test('longer sessions reach rarer tiers, and a crumb never hooks a legend', () => {
  assert.equal(tierOfCatch(rollCatch(10, seq(.999, 0, .5))), 'uncommon');
  assert.equal(tierOfCatch(rollCatch(10, seq(.1, 0, .5))), 'common');
  assert.equal(tierOfCatch(rollCatch(120, seq(.999, 0, .5))), 'legendary');
  assert.equal(tierOfCatch(rollCatch(60, seq(.5, 0, .5))), 'rare');
  let random = 1; const lcg = () => (random = (random * 16807) % 2147483647) / 2147483647;
  const counts = minutes => { const c = Object.fromEntries(TIERS.map(t => [t.id, 0])); for (let i = 0; i < 4000; i++) c[tierOfCatch(rollCatch(minutes, lcg))]++; return c; };
  const short = counts(10), long = counts(120);
  assert.deepEqual([short.rare, short.epic, short.legendary], [0, 0, 0]);
  assert.ok(long.legendary > 300 && long.legendary < 660, `about 12% legends from a 2 hour session, got ${long.legendary}`);
  assert.ok(long.common < short.common / 5);
});

test('the same fish comes out bigger from a longer session', () => {
  const small = rollCatch(15, seq(.1, 0, .5)), big = rollCatch(120, seq(.02, 0, .5));
  assert.deepEqual([small.species, big.species], ['minnow', 'minnow']);
  assert.equal(small.size, 6.9);
  assert.equal(big.size, 8);
});

test('every range has a catchable species and weights that sum to 100', () => {
  for (const range of BAIT_RANGES) assert.equal(range.weights.reduce((a, b) => a + b, 0), 100, range.id);
  for (const tier of TIERS) assert.ok(SPECIES.some(s => s.tier === tier.id), tier.id);
});

function fixture(initial) {
  let raw = initial ? JSON.stringify(initial) : null, clock = 1000;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const now = () => clock;
  return { store: createStateStore(storage, now), tick: ms => { clock += ms; }, reopen: () => createStateStore(storage, now) };
}

test('a finished focus session leaves bait at the pond, and a short one does not', () => {
  const f = fixture();
  assert.deepEqual(f.store.state.pond.bait, [{ minutes: 10, at: 0 }], 'a starter crumb for a new pond');
  f.store.update(d => { d.session = { duration: 45 * 60_000, remaining: 45 * 60_000, running: false, endsAt: null }; });
  f.store.setRunning(true); f.tick(45 * 60_000); f.store.update();
  assert.deepEqual(f.store.state.pond.bait.map(b => b.minutes), [10, 45]);
  f.store.update(d => { d.session = { duration: 3 * 60_000, remaining: 3 * 60_000, running: false, endsAt: null }; });
  f.store.setRunning(true); f.tick(3 * 60_000); f.store.update();
  assert.deepEqual(f.reopen().state.pond.bait.map(b => b.minutes), [10, 45]);
});

test('landing a fish spends the bait and fills the journal, repeats count up', () => {
  const state = freshState(); state.pond.bait = [{ minutes: 20, at: 5 }, { minutes: 20, at: 6 }, { minutes: 20, at: 7 }];
  const f = fixture(state);
  const first = f.store.landFish(0).caught;
  assert.equal(first.isNew, true);
  assert.equal(f.store.state.pond.bait.length, 2);
  const again = [f.store.landFish(0).caught, f.store.landFish(0).caught];
  assert.equal(f.store.landFish(0).caught, null, 'no bait, no fish');
  const all = [first, ...again], mine = f.reopen().state.pond;
  const total = Object.values(mine.journal).reduce((sum, e) => sum + e.count, 0);
  assert.equal(total, 3);
  assert.equal(mine.log.length, 3);
  for (const c of all) assert.equal(mine.journal[c.species].best, Math.max(...all.filter(o => o.species === c.species).map(o => o.size)));
});

test('a broken saved pond is cleaned up', () => {
  const pond = restoreState(JSON.stringify({ pond: { bait: [{ minutes: 3, at: 1 }, { minutes: 30, at: 2 }, 'x'], journal: { koi: { count: 2, best: 44, first: 9 }, dragon: { count: 1, best: 1, first: 1 }, perch: { count: -1 } }, log: [{ species: 'nope' }] } })).pond;
  assert.deepEqual(pond, { bait: [{ minutes: 30, at: 2 }], journal: { koi: { count: 2, best: 44, first: 9 } }, log: [] });
  assert.deepEqual(restoreState('{}').pond.bait, [{ minutes: 10, at: 0 }]);
});

const lcg = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function play(tier, seed, holds, { frame = 1 / 60, react = 1 / 60 } = {}) {
  const fight = startFight(tier), random = lcg(seed);
  let seconds = 0, next = 0, holding = false;
  while (!fight.outcome && seconds < 90) {
    if (seconds >= next - 1e-9) { holding = holds(fight); next += react; }
    stepFight(fight, frame, holding, random); seconds += frame;
  }
  return { outcome: fight.outcome, seconds, time: fight.time, runs: fight.runs };
}
const outcomes = (tier, holds, options) => Array.from({ length: 40 }, (_, i) => play(tier, i * 7919 + 1, holds, options).outcome);
const follow = fight => fight.tension < fight.zone.at;

test('keeping the float on the fish lands every tier, bigger fish taking longer', () => {
  for (const tier of TIERS) assert.deepEqual([...new Set(outcomes(tier.id, follow))], ['landed'], tier.id);
  const common = play('common', 11, follow).seconds, legend = play('legendary', 11, follow).seconds;
  assert.ok(common > 4 && common < legend && legend < 20, `${common} then ${legend}`);
});

test('a quarter second of reaction lands every tier, and a sluggish hand loses the legends first', () => {
  for (const tier of TIERS) assert.deepEqual([...new Set(outcomes(tier.id, follow, { frame: 1 / 4, react: 1 / 4 }))], ['landed'], tier.id);
  const landed = tier => outcomes(tier, follow, { frame: 1 / 2, react: 1 / 2 }).filter(o => o === 'landed').length;
  assert.ok(landed('common') >= 36 && landed('legendary') <= 8, `${landed('common')} commons, ${landed('legendary')} legends`);
});

test('holding the reel down the whole time snaps the line, even on a minnow', () => {
  for (const tier of TIERS) assert.deepEqual([...new Set(outcomes(tier.id, () => true))], ['snapped'], tier.id);
});

test('a fish left on a slack line throws the hook', () => {
  const { outcome, seconds } = play('rare', 3, () => false);
  assert.equal(outcome, 'escaped');
  assert.ok(seconds > 2 && seconds < 6, seconds);
});

test('the fight runs on game time, so a slow machine plays the same fish as a fast one', () => {
  const pulse = fight => Math.floor(fight.time / .5) % 3 !== 0;
  const fast = play('epic', 5, pulse, { frame: 1 / 60, react: 1 / 4 }), slow = play('epic', 5, pulse, { frame: 1 / 4, react: 1 / 4 });
  assert.equal(slow.outcome, fast.outcome);
  assert.equal(slow.runs, fast.runs);
  assert.ok(Math.abs(slow.time - fast.time) < 1 / 30, `${fast.time} vs ${slow.time}`);
});

test('undiscovered fish are twice as likely within their tier', () => {
  const journal = { minnow: { count: 1 }, perch: { count: 1 }, bluegill: { count: 1 } };
  const picks = [0, .3, .5, .6, .7, .9].map(draw => rollCatch(10, seq(.1, draw, .5), journal).species);
  assert.deepEqual(picks, ['minnow', 'perch', 'bluegill', 'carp', 'carp', 'carp']);
  assert.equal(rollCatch(10, seq(.1, .9, .5)).species, 'carp');
  assert.equal(rollCatch(10, seq(.1, .6, .5)).species, 'bluegill');
});

test('landing a fish keeps the catch rolled when it was hooked', () => {
  const state = freshState(); state.pond.bait = [{ minutes: 20, at: 5 }];
  const f = fixture(state), caught = f.store.landFish(0, { species: 'koi', size: 41.5 }).caught;
  assert.deepEqual([caught.species, caught.size, caught.isNew], ['koi', 41.5, true]);
  const saved = f.reopen().state.pond;
  assert.deepEqual([saved.journal.koi.count, saved.journal.koi.best, saved.bait.length], [1, 41.5, 0]);
});

test('stocking tops every bait up to the count and keeps the bait already there', () => {
  const pond = { bait: [{ minutes: 20, at: 1 }, { minutes: 25, at: 2 }, { minutes: 40, at: 3 }, { minutes: 41, at: 4 }, { minutes: 42, at: 5 }, { minutes: 43, at: 6 }] };
  stockBait(pond, 3, 9);
  const counts = pond.bait.reduce((all, { minutes }) => ({ ...all, [minutes]: (all[minutes] || 0) + 1 }), {});
  assert.deepEqual(counts, { 5: 3, 15: 1, 20: 1, 25: 1, 40: 1, 41: 1, 42: 1, 43: 1, 50: 3, 90: 3 });
});


test('development stocking never displaces earned bait from a full or nearly full inventory', () => {
  for (const count of [BAIT_LIMIT, BAIT_LIMIT - 1, BAIT_LIMIT - 6]) {
    const state = freshState();
    state.pond.bait = Array.from({ length: count }, (_, at) => ({ minutes: 10, at }));
    const earned = structuredClone(state.pond.bait);
    stockBait(state.pond, 3, 1000);
    assert.equal(state.pond.bait.length, BAIT_LIMIT);
    assert.deepEqual(state.pond.bait.slice(0, count), earned);
    assert.deepEqual(restoreState(JSON.stringify(state)).pond.bait, state.pond.bait);
  }
});
