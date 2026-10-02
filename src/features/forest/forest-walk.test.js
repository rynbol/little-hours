import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOREST_WALK, createWalker, stepWalk, trunkGrid } from './forest-walk.js';

const flat = () => 0, home = { x: 0, z: 0, yaw: 0 };
const walk = (walker, input, seconds, options) => { for (let t = 0; t < seconds; t += 1 / 60) stepWalk(walker, input, 1 / 60, { height: flat, home, ...options }); return walker; };

test('walking forward heads where the walker faces and settles at walking pace', () => {
  const north = walk(createWalker(home, flat), { forward: 1 }, 3);
  assert.ok(Math.abs(north.x) < 1e-9 && north.z < -11 && north.z > -12.6, `${north.x}, ${north.z}`);
  assert.ok(Math.abs(Math.hypot(north.vx, north.vz) - FOREST_WALK.speed) < 0.01);
  const east = walk(createWalker({ x: 0, z: 0, yaw: Math.PI / 2 }, flat), { forward: 1 }, 3);
  assert.ok(east.x > 11 && Math.abs(east.z) < 1e-9, `${east.x}, ${east.z}`);
});

test('walking diagonally is no faster than walking straight, and letting go coasts to a stop', () => {
  const walker = walk(createWalker(home, flat), { forward: 1, strafe: 1 }, 2);
  assert.ok(Math.abs(Math.hypot(walker.vx, walker.vz) - FOREST_WALK.speed) < 0.01);
  assert.ok(walker.x > 0 && walker.z < 0);
  walk(walker, {}, 2);
  assert.equal(walker.vx, 0); assert.equal(walker.vz, 0);
});

test('looking turns freely and tilts only within a comfortable range', () => {
  const walker = createWalker(home, flat);
  stepWalk(walker, { turn: 7, look: 5 }, 1 / 60, { height: flat, home });
  assert.equal(walker.yaw, 7); assert.equal(walker.pitch, FOREST_WALK.pitch[1]);
  stepWalk(walker, { look: -9 }, 1 / 60, { height: flat, home });
  assert.equal(walker.pitch, FOREST_WALK.pitch[0]);
});

test('the eye rides the ground at standing height', () => {
  const slope = (x, z) => -z * 0.2, walker = walk(createWalker(home, slope), { forward: 1 }, 4, { height: slope });
  assert.ok(Math.abs(walker.y - (slope(walker.x, walker.z) + FOREST_WALK.eye)) < 0.12, `${walker.y}`);
});

test('a slope steeper than a scramble stops the walker instead of letting them float up it', () => {
  const cliff = (x, z) => z < -3 ? (-3 - z) * 3 : 0, walker = walk(createWalker(home, cliff), { forward: 1 }, 4, { height: cliff });
  assert.ok(walker.z > -3.2 && walker.z < -2.5, `${walker.z}`);
});

test('the walk slows to a halt at the edge of the grove and still lets the walker turn back', () => {
  const walker = walk(createWalker(home, flat), { forward: 1 }, 90), out = Math.hypot(walker.x, walker.z);
  assert.ok(out <= FOREST_WALK.reach + 1e-6 && out > FOREST_WALK.reach - 1, `${out}`);
  walker.yaw = Math.PI; walk(walker, { forward: 1 }, 2);
  assert.ok(Math.hypot(walker.x, walker.z) < out - 6);
});

test('trunks are solid: walking at one slides round it and never ends inside', () => {
  const trunks = trunkGrid({ count: 2, x: [0.1, 40], z: [-10, 40], width: [1.6, 1] }), radius = 1.6 * FOREST_WALK.trunk + FOREST_WALK.body;
  const walker = createWalker(home, flat);
  let nearest = Infinity;
  for (let i = 0; i < 360; i++) { stepWalk(walker, { forward: 1 }, 1 / 60, { height: flat, home, trunks }); nearest = Math.min(nearest, Math.hypot(walker.x - 0.1, walker.z + 10)); }
  assert.ok(nearest >= radius - 1e-6, `${nearest} < ${radius}`);
  assert.ok(walker.z < -12, `stuck at ${walker.z}`);
});
