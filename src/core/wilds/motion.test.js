import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBody, stepBody, MOTION, invulnerable } from './motion.js';

const flat = (extra = {}) => ({ ground: () => 0, water: () => null, blockers: () => [], ...extra });
const run = (body, input, world, seconds, dt = 1 / 60) => { for (let t = 0; t < seconds - 1e-9; t += dt) body = stepBody(body, input, world, dt); return body; };
const north = { x: 0, z: 1 };

test('holding forward jogs north at jog speed and the body faces where it goes', () => {
  const body = run(createBody({ x: 0, z: 0, y: 0, yaw: Math.PI }), north, flat(), 2);
  assert.ok(Math.abs(body.speed - MOTION.jog) < .05, `speed ${body.speed}`);
  assert.ok(body.z > 7 && body.z < 9, `z ${body.z}`);
  assert.ok(Math.abs(body.x) < .2);
  assert.ok(Math.abs(body.yaw) < .05);
  assert.equal(body.gait, 'jog');
});

test('sprinting burns stamina until it runs out, then the body jogs until it has recovered', () => {
  let body = run(createBody({ x: 0, z: 0, y: 0 }), { ...north, sprint: true }, flat(), 1);
  assert.equal(body.gait, 'sprint');
  assert.ok(body.stamina < MOTION.stamina.max - 10);
  body = run(body, { ...north, sprint: true }, flat(), 6);
  assert.equal(body.exhausted, true);
  assert.equal(body.gait, 'jog');
  body = run(body, { x: 0, z: 0 }, flat(), 4);
  assert.equal(body.stamina, MOTION.stamina.max);
  assert.equal(body.exhausted, false);
});

test('a dodge roll covers its distance, costs stamina and is untouchable only in its middle', () => {
  let body = createBody({ x: 0, z: 0, y: 0 });
  body = stepBody(body, { x: 1, z: 0, dodge: true }, flat(), 1 / 60);
  assert.ok(body.roll);
  assert.equal(body.stamina, MOTION.stamina.max - MOTION.roll.cost);
  let wasSafe = false;
  for (let i = 0; i < 40; i++) { body = stepBody(body, { x: 1, z: 0 }, flat(), 1 / 60); if (invulnerable(body)) wasSafe = true; if (!body.roll) break; }
  assert.ok(wasSafe);
  assert.equal(body.roll, null);
  assert.ok(Math.abs(body.x - MOTION.roll.distance) < .9, `rolled ${body.x}`);
});

test('a jump arcs about a metre high and lands back on the ground once', () => {
  let body = createBody({ x: 0, z: 0, y: 0 }), peak = 0;
  body = stepBody(body, { x: 0, z: 0, jump: true }, flat(), 1 / 60);
  for (let i = 0; i < 90; i++) { body = stepBody(body, { x: 0, z: 0 }, flat(), 1 / 60); peak = Math.max(peak, body.y); }
  assert.ok(peak > .8 && peak < 1.1, `peak ${peak}`);
  assert.equal(body.grounded, true);
  assert.equal(body.y, 0);
});

test('tree trunks and standing stones push the body round them', () => {
  const world = flat({ blockers: () => [{ x: 0, z: 3, r: .6, bottom: 0, top: 8 }] });
  const body = run(createBody({ x: 0, z: 0, y: 0 }), north, world, 1.5);
  assert.ok(Math.hypot(body.x, body.z - 3) >= .6 + MOTION.radius - 1e-6);
});

test('the body wades slowly through shallows and cannot walk into deep water', () => {
  const lake = { ground: (_, z) => (z > 4 ? -3 : z > 2 ? -.4 : .2), water: (_, z) => (z > 2 ? { height: 0 } : null), blockers: () => [] };
  const body = run(createBody({ x: 0, z: 0, y: .2 }), north, lake, 4);
  assert.ok(body.z > 2 && body.z < 4.2, `stopped at ${body.z}`);
  assert.ok(body.wading > MOTION.shallow);
  assert.ok(body.speed < MOTION.jog * MOTION.wade + .1);
});

test('a sheer cliff stops the body, but a gentle slope does not', () => {
  const cliff = flat({ ground: (_, z) => (z > 3 ? 12 : 0) }), ramp = flat({ ground: (_, z) => Math.max(0, z) * .3 });
  assert.ok(run(createBody({ x: 0, z: 0, y: 0 }), north, cliff, 2).z < 3.1);
  const climbed = run(createBody({ x: 0, z: 0, y: 0 }), north, ramp, 2);
  assert.ok(climbed.z > 6 && Math.abs(climbed.y - climbed.z * .3) < .05);
});

test('a bridge deck carries the body over a stream bed', () => {
  const world = flat({ ground: (_, z) => (z > 2 && z < 6 ? -1.5 : 0), decks: (_, z) => (z > 1 && z < 7 ? [0] : []), water: (_, z) => (z > 2 && z < 6 ? { height: -.4 } : null) });
  let lowest = 0, body = createBody({ x: 0, z: 0, y: 0 });
  for (let i = 0; i < 150; i++) { body = stepBody(body, north, world, 1 / 60); lowest = Math.min(lowest, body.y); }
  assert.ok(body.z > 8);
  assert.equal(lowest, 0);
});

test('a low roof stops a jump before the head goes through it', () => {
  const world = flat({ ceiling: () => 2 });
  let body = stepBody(createBody({ x: 0, z: 0, y: 0 }), { x: 0, z: 0, jump: true }, world, 1 / 60), peak = 0;
  for (let i = 0; i < 60; i++) { body = stepBody(body, { x: 0, z: 0 }, world, 1 / 60); peak = Math.max(peak, body.y); }
  assert.ok(peak <= 2 - MOTION.height + 1e-9, `peak ${peak}`);
  assert.equal(body.grounded, true);
});
