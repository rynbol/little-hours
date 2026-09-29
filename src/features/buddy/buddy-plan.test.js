import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planActivity, SPOT_TYPES } from './buddy-plan.js';

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const kinds = (context, rolls = 600) => { const random = lcg(7), seen = new Map(); for (let i = 0; i < rolls; i++) { const kind = planActivity(context, random).kind; seen.set(kind, (seen.get(kind) || 0) + 1); } return seen; };
const fire = { type: 'fireplace', itemId: 'f', off: false, point: { x: 1, y: 2, z: 3 }, front: { x: 1, y: 0.8, z: 2 } };
const lamp = { type: 'floor-lamp', itemId: 'l', off: false, point: { x: 4, y: 2, z: 1 }, front: { x: 4, y: 0.8, z: 0 } };
const coldFire = { ...fire, off: true };
const record = { type: 'low-cabinet', itemId: 'r', off: true, point: { x: 0, y: 1, z: 0 } };

test('with the pet awake and a lit fire, Pip does all of its room things', () => {
  const seen = kinds({ spots: [fire], pet: { state: 'sitting', moving: false, held: false }, avatar: { moving: false } });
  assert.deepEqual([...seen.keys()].sort(), ['boop', 'chat', 'loop', 'orbit', 'peekaboo', 'perch', 'shoulder', 'spot', 'twirl', 'wander']);
});

test('Pip never naps, and leaves a sleeping pet alone', () => {
  const seen = kinds({ spots: [], pet: { state: 'sleeping', moving: false, held: false }, avatar: { moving: false } });
  assert.equal(seen.get('nap'), undefined);
  assert.equal(seen.get('boop'), undefined);
});

test('most of the time Pip plays around the avatar', () => {
  const seen = kinds({ spots: [fire, lamp], pet: { state: 'sitting', moving: false, held: false }, avatar: { moving: false } }, 2000);
  const around = ['shoulder', 'orbit', 'wander', 'peekaboo', 'loop', 'twirl', 'chat', 'perch'].reduce((sum, kind) => sum + (seen.get(kind) || 0), 0);
  assert.ok(around / 2000 > 0.7, `${around} of 2000`);
});

test('a wander hops between a few spots beside the avatar, never over its face', () => {
  const random = lcg(9);
  let wander;
  for (let i = 0; i < 200 && !wander; i++) { const plan = planActivity({ spots: [], pet: null, avatar: { moving: false } }, random); if (plan.kind === 'wander') wander = plan; }
  assert.equal(wander.target, 'head');
  assert.ok(wander.motion.points.length >= 4 && wander.motion.points.every(([right, up, depth]) => Math.abs(right) >= .3 && Math.abs(right) <= .6 && up >= -.05 && up <= .35 && Math.abs(depth) <= .3));
});

test('a cold fireplace and a silent record player are skipped', () => {
  assert.equal(kinds({ spots: [coldFire, record], pet: null, avatar: { moving: false } }).get('spot'), undefined);
});

test('a spot visit uses its pose: warm in front of the fire, perched on top of a lamp', () => {
  const random = lcg(3), visits = {};
  for (let i = 0; i < 400; i++) { const plan = planActivity({ spots: [fire, lamp], pet: null, avatar: { moving: false } }, random); if (plan.kind === 'spot') visits[plan.spot] = plan; }
  assert.equal(visits.fireplace.pose, 'warm');
  assert.deepEqual(visits.fireplace.target, { x: 1, y: 0.8, z: 2 });
  assert.equal(visits['floor-lamp'].pose, 'perch');
  assert.deepEqual(visits['floor-lamp'].target, { x: 4, y: 2, z: 1 });
});

test('while the avatar walks Pip rides along at the shoulder or circles it', () => {
  assert.deepEqual([...kinds({ spots: [fire], pet: { state: 'sitting', moving: false, held: false }, avatar: { moving: true } }).keys()].sort(), ['orbit', 'shoulder']);
});

test('holding a find keeps Pip beside the avatar', () => {
  assert.deepEqual([...kinds({ spots: [fire], pet: { state: 'sitting', moving: false, held: false }, avatar: { moving: false }, holding: true }).keys()].sort(), ['chat', 'loop', 'orbit', 'peekaboo', 'perch', 'shoulder', 'twirl', 'wander']);
});

test('the same outing never repeats back to back, except resting at the shoulder', () => {
  const random = lcg(11);
  let last = null;
  for (let i = 0; i < 300; i++) {
    const plan = planActivity({ spots: [fire], pet: { state: 'sitting', moving: false, held: false }, avatar: { moving: false }, last }, random);
    if (plan.kind !== 'shoulder') assert.notEqual(plan.kind, last);
    last = plan.kind;
  }
});

test('a chat has a line for Pip and a reply for the avatar', () => {
  const random = lcg(5);
  let chat;
  for (let i = 0; i < 200 && !chat; i++) { const plan = planActivity({ spots: [], pet: null, avatar: { moving: false } }, random); if (plan.kind === 'chat') chat = plan; }
  assert.equal(typeof chat.line, 'string');
  assert.equal(typeof chat.reply, 'string');
  assert.ok(SPOT_TYPES.has('room-window'));
});
