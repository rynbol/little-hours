import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AMBIENT_ROOTS, STAG, STAG_ATTACKS, createStag, hurtStag, stepStag, wakeStag } from './stag.js';

const DT = 1 / 120;
const flat = () => 0;
const arena = { x: 0, z: 0, radius: 13.5, facing: 0, ground: flat };

function seeded(seed = 7) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function awake(rng = seeded()) {
  const stag = createStag(arena);
  wakeStag(stag);
  for (let t = 0; t < STAG.wake + DT; t += DT) stepStag(stag, { prey: { x: 0, z: 5 }, bodies: [], arena, stones: [], rng }, DT);
  stag.events.length = 0;
  return stag;
}

function run(stag, seconds, { prey, bodies = [prey], stones = [], rng = seeded() }) {
  const events = [];
  for (let t = 0; t < seconds; t += DT) {
    stepStag(stag, { prey, bodies, arena, stones, rng }, DT);
    for (const event of stag.events) events.push({ ...event, at: t });
    stag.events.length = 0;
  }
  return events;
}

test('every stag attack and root warning gives at least 0.6 s of telegraph', () => {
  for (const attack of Object.values(STAG_ATTACKS)) assert.ok(attack.telegraph >= 0.6);
  assert.ok(STAG_ATTACKS.roots.warn >= 0.6 && AMBIENT_ROOTS.warn >= 0.6);
});

test('no stag blow lands sooner than 0.6 s after its telegraph starts, at any range', () => {
  const seen = new Set();
  for (const distance of [2.2, 4, 6, 9]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const stag = awake(seeded(seed));
      stag.phase = 2;
      const prey = { id: 'player', x: 0, z: distance, radius: 0.32, airborne: 0 };
      let started = null;
      for (const event of run(stag, 9, { prey, rng: seeded(seed) })) {
        if (event.type === 'telegraph') { started = event.at; seen.add(event.attack); }
        if (event.type === 'contact' && event.attack !== 'thicket') { assert.ok(event.at - started >= 0.6 - 1e-9, `${event.attack} at ${distance} m landed ${event.at - started} s after its telegraph`); started = null; }
      }
    }
  }
  assert.deepEqual([...seen].sort(), ['charge', 'roots', 'stomp', 'sweep']);
});

test('the antler sweep catches a body in front and misses one behind', () => {
  const front = awake(), behind = awake();
  for (const [stag, z] of [[front, 2.5], [behind, -2.5]]) {
    stag.attack = 'sweep'; stag.state = 'telegraph'; stag.time = 0; stag.facing = 0;
    const body = { id: 'player', x: 0, z, radius: 0.32, airborne: 0 };
    const hits = run(stag, 1, { prey: { x: 0, z: 2.5 }, bodies: [body] }).filter(event => event.type === 'contact');
    assert.equal(hits.length, z > 0 ? 1 : 0);
  }
});

test('jumping over the stomp shockwave clears it, standing in it does not', () => {
  for (const airborne of [0, 0.6]) {
    const stag = awake();
    stag.attack = 'stomp'; stag.state = 'telegraph'; stag.time = 0;
    const body = { id: 'player', x: 0, z: 6, radius: 0.32, airborne };
    const hits = run(stag, 2, { prey: { x: 0, z: 6 }, bodies: [body] }).filter(event => event.type === 'contact');
    assert.deepEqual(hits.map(event => event.damage), airborne ? [] : [STAG_ATTACKS.stomp.damage]);
  }
});

test('a charge into a standing stone stuns the stag with its heart open, then it rises', () => {
  const stag = awake();
  const stone = { id: 'stone-0', x: 0, z: 10.5, radius: 0.78 };
  stag.attack = 'charge'; stag.state = 'telegraph'; stag.time = 0;
  const events = run(stag, 2, { prey: { x: 0, z: 9 }, bodies: [], stones: [stone] });
  const stun = events.find(event => event.type === 'stun');
  assert.equal(stun.stone, 'stone-0');
  assert.ok(stag.heartOpen && stag.state === 'stun');
  assert.ok(Math.hypot(stag.x - stone.x, stag.z - stone.z) > stone.radius + STAG.radius * 0.9);
  run(stag, STAG.stun, { prey: { x: 0, z: 9 }, bodies: [] });
  assert.ok(!stag.heartOpen && stag.state !== 'stun');
});

test('a charge that meets no stone skids to a stop inside the ring and leaves the heart shut', () => {
  const stag = awake();
  stag.attack = 'charge'; stag.state = 'telegraph'; stag.time = 0;
  const events = run(stag, 3, { prey: { x: 0, z: 9 }, bodies: [] });
  assert.ok(events.some(event => event.type === 'skid'));
  assert.ok(!stag.heartOpen && Math.hypot(stag.x, stag.z) <= arena.radius - STAG.edge + 1e-6);
});

test('at half health the stag shifts phase, and then root lines erupt across the ring', () => {
  const stag = awake();
  hurtStag(stag, STAG.health / 2 - 1);
  assert.equal(stag.phase, 1);
  stag.events.length = 0;
  hurtStag(stag, 1);
  assert.equal(stag.phase, 2);
  assert.deepEqual(stag.events.map(event => event.type), ['phase']);
  assert.equal(hurtStag(stag, 50), 0);
  let thickets = 0, roots = [];
  for (let t = 0; t < STAG.shift + 4; t += DT) {
    stepStag(stag, { prey: { x: 30, z: 30 }, bodies: [], arena, stones: [], rng: seeded() }, DT);
    thickets += stag.events.filter(event => event.type === 'thicket').length;
    stag.events.length = 0;
    if (stag.roots.length > roots.length) roots = [...stag.roots];
  }
  assert.ok(thickets >= 1);
  assert.ok(roots.length > 8);
  const ends = roots.map(root => [root.x, root.z]), [first, last] = [ends[0], ends.at(-1)];
  assert.ok(Math.hypot(first[0] - last[0], first[1] - last[1]) > arena.radius);
});

test('enough poise damage staggers the stag and a killing blow sends it to its knees then away', () => {
  const stag = awake();
  hurtStag(stag, STAG.poise / 2); hurtStag(stag, STAG.poise / 2);
  assert.equal(stag.state, 'stagger');
  hurtStag(stag, STAG.health);
  hurtStag(stag, STAG.health);
  assert.equal(stag.state, 'defeat');
  const events = run(stag, STAG.defeat + 0.1, { prey: { x: 0, z: 4 }, bodies: [] });
  assert.equal(stag.state, 'gone');
  assert.ok(events.some(event => event.type === 'gone'));
});

test('after three blows up close the stag bounds back out of reach and then charges', () => {
  const stag = awake(), prey = { x: 0, z: 2.6 }, rng = seeded();
  let gap = 0;
  const events = [];
  for (let t = 0; t < 20; t += DT) {
    stepStag(stag, { prey, bodies: [], arena, stones: [], rng }, DT);
    for (const event of stag.events.splice(0)) events.push(event);
    if (stag.state === 'retreat') gap = Math.max(gap, Math.hypot(prey.x - stag.x, prey.z - stag.z));
  }
  const kinds = events.filter(event => event.type === 'telegraph' || event.type === 'retreat').map(event => event.attack ?? event.type);
  assert.equal(kinds.indexOf('retreat'), STAG.retreat.every);
  assert.ok(kinds.slice(0, STAG.retreat.every).every(id => id === 'sweep' || id === 'stomp'), kinds.join());
  assert.equal(kinds[STAG.retreat.every + 1], 'charge');
  assert.ok(gap > 7, `${gap}`);
});

test('the stag shrugs off scattered blows, but a quick flurry staggers it and it bounds back to charge', () => {
  const stag = awake(), prey = { x: 0, z: 2.6 };
  hurtStag(stag, STAG.poise * 0.55);
  run(stag, 3, { prey, bodies: [] });
  hurtStag(stag, STAG.poise * 0.55);
  assert.notEqual(stag.state, 'stagger');
  hurtStag(stag, STAG.poise * 0.55);
  assert.equal(stag.state, 'stagger');
  const events = run(stag, STAG.stagger + 0.05, { prey, bodies: [] });
  assert.ok(events.some(event => event.type === 'retreat'));
  assert.equal(stag.prefer, 'charge');
});
