import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIFE, createHerd, createLeaves, lifeAt, stepHerd, stepLeaves } from './life.js';

const DT = 1 / 60;
const seeded = (seed = 3) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('the valley wakes and sleeps on the clock: motes and butterflies by day, fireflies and mist after dark', () => {
  const noon = lifeAt(13), dusk = lifeAt(22.5), dawn = lifeAt(5.8), shower = lifeAt(16.7);
  assert.ok(noon.motes > 0.95 && noon.butterflies > 0.95 && noon.birds > 0.95, JSON.stringify(noon));
  assert.equal(noon.fireflies, 0); assert.equal(noon.mist, 0);
  assert.ok(dusk.fireflies > 0.95 && dusk.motes === 0 && dusk.butterflies === 0 && dusk.mist > 0.2, JSON.stringify(dusk));
  assert.ok(dawn.mist > 0.95 && dawn.fireflies < 0.2, JSON.stringify(dawn));
  assert.ok(shower.butterflies < 0.05 && shower.motes < 0.05 && shower.birds < 0.2 && shower.mist > 0.25, JSON.stringify(shower));
  assert.ok(Math.abs(lifeAt(23.99).mist - lifeAt(0.01).mist) < 0.01);
});

test('grazing deer stay home until the player comes near, then bolt straight away from them', () => {
  const herd = createHerd(LIFE.deer.herd, seeded()), far = { x: 0, z: -200 };
  const heads = new Set();
  for (let i = 0; i < 900; i++) { stepHerd(herd, far, DT, { random: seeded() }); for (const deer of herd) heads.add(deer.head > 0.9 ? 'down' : deer.head < 0.1 ? 'up' : 'moving'); }
  for (const deer of herd) assert.deepEqual([deer.x, deer.z], deer.home);
  assert.deepEqual([...heads].sort(), ['down', 'moving', 'up']);
  assert.ok(herd.every(deer => ['graze', 'look'].includes(deer.state)));
  const [x, z] = LIFE.deer.herd[1], player = { x, z: z + 12 };
  stepHerd(herd, player, DT, { random: seeded() });
  assert.deepEqual(herd.map(deer => deer.state === 'bolt'), herd.map(deer => Math.hypot(deer.x - player.x, deer.z - player.z) < LIFE.deer.startle));
  const deer = herd[1], before = Math.hypot(deer.x - player.x, deer.z - player.z);
  for (let t = 0; t < LIFE.deer.bolt; t += DT) stepHerd(herd, player, DT, { random: seeded() });
  const after = Math.hypot(deer.x - player.x, deer.z - player.z);
  assert.ok(after - before > LIFE.deer.run * LIFE.deer.bolt * 0.7, `fled ${after - before} m`);
  assert.equal(deer.state, 'wary');
});

test('a startled deer turns aside from blocked ground and walks home once the player has gone', () => {
  const herd = createHerd([[0, 0, 0]], seeded()), deer = herd[0], blocked = (x, z) => z < -3;
  stepHerd(herd, { x: 0, z: 5 }, DT, { random: () => 0.5, blocked });
  for (let t = 0; t < LIFE.deer.bolt; t += DT) stepHerd(herd, { x: 0, z: 5 }, DT, { random: () => 0.5, blocked });
  assert.ok(deer.z >= -3 && Math.hypot(deer.x, deer.z) > 10, `at ${deer.x}, ${deer.z}`);
  const gone = { x: 500, z: 500 };
  for (let t = 0; t < LIFE.deer.calm + 40; t += DT) stepHerd(herd, gone, DT, { random: () => 0.5, blocked });
  assert.ok(['graze', 'look'].includes(deer.state), deer.state);
  assert.deepEqual([deer.x, deer.z], [0, 0]);
});

test('leaves tumble from a tree, settle on the ground or float on water, then fade and fall again', () => {
  const sources = [{ x: 0, y: 8, z: 0, radius: 3 }], leaves = createLeaves(6), random = seeded(9);
  const world = { sources, random, floor: () => 0, water: x => (x > 0 ? 0.4 : -Infinity), flow: () => [1, 0] };
  const seen = new Set(), landed = [];
  for (let t = 0; t < 40; t += DT) {
    const before = leaves.map(leaf => leaf.state);
    stepLeaves(leaves, DT, world);
    leaves.forEach((leaf, i) => { seen.add(leaf.state); if (before[i] === 'fall' && leaf.state === 'rest') landed.push({ y: leaf.y, afloat: leaf.afloat, x: leaf.x }); });
  }
  assert.deepEqual([...seen].sort(), ['fade', 'fall', 'rest', 'wait']);
  assert.ok(landed.length >= 6);
  for (const spot of landed) assert.equal(spot.y, spot.afloat ? 0.4 : 0);
  assert.ok(landed.some(spot => spot.afloat) && landed.some(spot => !spot.afloat));
  const floating = createLeaves(1);
  Object.assign(floating[0], { state: 'rest', x: 1, y: 0.4, z: 0, afloat: true, rest: 5, phase: Math.PI / 2 });
  stepLeaves(floating, 1, world);
  assert.ok(floating[0].x > 1.3, 'floating leaves drift with the stream');
});
