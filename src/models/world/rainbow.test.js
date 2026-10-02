import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createLightning, LIGHTNING_RAINBOW_GAP } from '../../core/lightning.js';
import { RAINBOW, RAINBOW_SUN, bowShape, createRainbow, createSunBreak, createWorldRainbow } from './rainbow.js';

const DEGREE = Math.PI / 180, FRAME = 1 / 30;
const sequence = values => { let i = 0; return () => values[i++ % values.length]; };
const near = (actual, expected, within, what) => assert.ok(Math.abs(actual - expected) <= within, `${what}: ${actual} against ${expected}`);

test('the bow lights from a sun behind the room, 24 degrees up, so its antisolar point is out the window and below the land', () => {
  const [x, y, z] = RAINBOW_SUN;
  near(Math.atan2(x, -z) / DEGREE, 180, 1e-6, 'sun heading');
  near(Math.asin(y) / DEGREE, 24.06, 0.01, 'sun elevation');
});

test('the bow is a ring 36 to 56 degrees round the antisolar point, its crown straight out the window', () => {
  const { positions, uvs, indices } = bowShape(RAINBOW_SUN), [sx, sy, sz] = RAINBOW_SUN;
  const across = RAINBOW.segments + 1, count = positions.length / 3;
  assert.equal(count, (RAINBOW.rings + 1) * across);
  assert.equal(indices.length, RAINBOW.rings * RAINBOW.segments * 6);
  for (let v = 0; v < count; v++) {
    const [x, y, z] = positions.slice(v * 3, v * 3 + 3), length = Math.hypot(x, y, z);
    near(length, RAINBOW.distance, 1e-6, 'distance');
    near(Math.acos(-(x * sx + y * sy + z * sz) / length) / DEGREE, uvs[v * 2], 1e-6, `vertex ${v} radius`);
  }
  const crown = (ring) => { const v = ring * across + RAINBOW.segments / 2, [x, y, z] = positions.slice(v * 3, v * 3 + 3); return { heading: Math.atan2(x, -z) / DEGREE, elevation: Math.asin(y / RAINBOW.distance) / DEGREE }; };
  near(crown(0).heading, 0, 1e-6, 'crown heading');
  near(crown(0).elevation, 36 - 24.06, 0.01, 'inner edge crown elevation');
  near(crown(RAINBOW.rings).elevation, 56 - 24.06, 0.01, 'outer edge crown elevation');
  const ends = [0, RAINBOW.segments].map(step => positions[(RAINBOW.rings * across + step) * 3 + 1] / RAINBOW.distance);
  assert.ok(ends.every(y => y < -0.05), `both legs end under the land: ${ends.map(y => y.toFixed(2))}`);
});

test('a sun break comes now and then in the rain, rises over 14 s, holds, fades over 18 s and waits before the next', () => {
  const sunBreak = createSunBreak({ random: sequence([0.5]) }), firstAt = 75, hold = 47.5, nextGap = 235;
  const at = t => sunBreak.update(t, true, false, null);
  for (let t = 0; t < firstAt; t += FRAME) assert.equal(at(t), 0, `clear sky at ${t}`);
  at(firstAt);
  near(at(firstAt + 7), 0.5, 1e-9, 'half risen');
  assert.equal(at(firstAt + 14), 1);
  assert.equal(at(firstAt + 14 + hold - 0.01), 1);
  near(at(firstAt + 14 + hold + 9), 0.5, 1e-9, 'half faded');
  const over = firstAt + 14 + hold + 18;
  assert.equal(at(over), 0);
  assert.equal(sunBreak.nextAt, over + nextGap);
  assert.equal(at(over + nextGap - 1), 0);
  at(over + nextGap);
  assert.ok(at(over + nextGap + 14) === 1, 'the next break comes');
});

test('no sun break while dry, under reduced motion, during a flash or within the gap after one', () => {
  const dry = createSunBreak({ random: sequence([0]) });
  for (let t = 0; t < 400; t += 1) assert.equal(dry.update(t, false, false, null), 0);
  const still = createSunBreak({ random: sequence([0]) });
  still.show();
  for (let t = 0; t < 400; t += 1) assert.equal(still.update(t, true, true, null), 0);
  const flashing = createSunBreak({ random: sequence([0]) });
  for (let t = 0; t < 400; t += 1) assert.equal(flashing.update(t, true, false, { active: true, idleSince: -Infinity }), 0);
  const after = createSunBreak({ random: sequence([0]) }), lightning = { active: false, idleSince: 50 };
  const first = RAINBOW.firstAfter[0];
  for (let t = 0; t <= 50 + LIGHTNING_RAINBOW_GAP - 0.5; t += 0.5) assert.equal(after.update(t, true, false, lightning), 0, `still waiting at ${t}`);
  assert.ok(first < 50 + LIGHTNING_RAINBOW_GAP);
  after.update(50 + LIGHTNING_RAINBOW_GAP, true, false, lightning);
  assert.ok(after.update(50 + LIGHTNING_RAINBOW_GAP + 7, true, false, lightning) > 0.4, 'begins once the gap has passed');
});

test('wired as the room wires them, lightning never strikes while the bow is up', () => {
  const rainbow = createRainbow(null, { random: sequence([0.5]) }), lightning = createLightning({ random: sequence([0.1, 0.5, 0.9]) });
  const strikes = [];
  rainbow.show(30);
  for (let t = 0; t < 70; t += FRAME) {
    lightning.strike();
    const presence = rainbow.update(t, true, false, lightning);
    if (lightning.update(t, presence === 0, false) > 0 && presence > 0) strikes.push(t);
  }
  assert.deepEqual(strikes, []);
  assert.equal(rainbow.presence, 0);
});

test('the bow is one blended draw that shows only while the sun breaks, at the break strength', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  const sky = createWorldRainbow(scene), drawn = () => scene.meshes.filter(mesh => mesh.isEnabled(false)).map(mesh => mesh.name);
  try {
    assert.deepEqual(drawn(), []);
    sky.show(0.6);
    assert.deepEqual(drawn(), ['world-rainbow']);
    assert.equal(sky.paint._floats.presence, 0.6);
    assert.ok(sky.paint.needAlphaBlending() && sky.paint.disableDepthWrite, 'blended over the view without writing depth');
    sky.show(0);
    assert.deepEqual(drawn(), []);
  } finally { scene.dispose(); engine.dispose(); }
});
