import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, riverCenter, canopyAt, scatter, normalAt, padDistance, pathCenter, pathDistance, createTerrainField } from './world-terrain.js';

test('an optional shallow basin bounds its depth, raises a dry bank and blends back to the original terrain', () => {
  const water = { x: 0, z: 0, radiusX: 20, radiusZ: 16, level: 2, basin: { depth: .3, bank: .8, blend: 12 } };
  const definition = { seed: 1, terrain: { base: -20, noise: [], hills: [] }, path: { waves: [] }, clearings: [], water: [water] };
  const field = createTerrainField(definition);
  assert.ok(Math.abs(field.heightAt(0, 0) - 1.745) < 1e-10);
  for (let x = -20; x <= 20; x++) for (let z = -16; z <= 16; z++) {
    if (Math.hypot(x / 20, z / 16) <= 1) assert.ok(field.heightAt(x, z) >= 1.7 - 1e-10);
  }
  for (let angle = 0; angle < 360; angle += 5) assert.ok(field.heightAt(Math.cos(angle * Math.PI / 180) * 20, Math.sin(angle * Math.PI / 180) * 16) > 2.7);
  assert.equal(field.heightAt(40, 0), -20);
  const unshaped = createTerrainField({ ...definition, water: [{ ...water, basin: undefined }] });
  assert.equal(unshaped.heightAt(0, 0), -20);
  assert.equal(unshaped.heightAt(20, 0), -20);
});

test('the house stands on a flat pad and the land rolls away from its edge into the valley', () => {
  for (const [x, z] of [[0, 0], [7.4, -6.2], [-7.4, 6.2], [6, 0], [0, -6.2]]) assert.equal(heightAt(x, z), 0);
  assert.equal(padDistance(10.4, -10.2), 5);
  assert.ok(heightAt(0, -11.2) < -0.8 && heightAt(0, -26.2) < -3.5, 'the brow falls away just past the house');
  assert.ok(heightAt(0, -100) < -14 && heightAt(0, -200) < -30, 'valley drops below the house');
  const eye = [-2, 2.24, -2.41], dip = s => { const x = eye[0] - 0.3 * s, z = -6.2 - 0.95 * s; return Math.atan2(eye[1] - heightAt(x, z), Math.hypot(x - eye[0], z - eye[2])); };
  for (const [near, far] of [[6, 20], [20, 80], [80, 300], [300, 800]]) assert.ok(dip(near) > dip(far), `the window sees the slope from ${near} m to ${far} m`);
  assert.deepEqual(normalAt(0, 0).map(value => Math.round(value) + 0), [0, 1, 0]);
});

test('a path leaves the front of the house and winds down the slope to the left of the window', () => {
  assert.equal(pathDistance(0, 3), Infinity);
  assert.equal(pathDistance(pathCenter(40), -40), 0);
  assert.equal(pathDistance(pathCenter(40) + 1.5, -40), 1.5);
  assert.equal(pathDistance(pathCenter(300), -300), 0);
  assert.deepEqual([5, 40, 140].map(ahead => Math.round(pathCenter(ahead) * 10) / 10), [-2.3, -26.6, -91.4]);
  const heights = [10, 40, 80, 140].map(ahead => heightAt(pathCenter(ahead), -ahead));
  assert.ok(heights.every((h, i) => i === 0 || h < heights[i - 1]), `path descends: ${heights}`);
});

test('the river runs below its banks and grows no forest', () => {
  for (const x of [-600, 0, 300, 900]) {
    const z = riverCenter(x);
    assert.ok(heightAt(x, z) < heightAt(x, z + 120) - 5 && heightAt(x, z) < heightAt(x, z - 120) - 5, `river bed at x=${x}`);
    assert.equal(canopyAt(x, z), 0);
  }
});

const CHAIR = [-2, 2.24, -2.41];
const skyline = bearing => {
  const a = bearing * Math.PI / 180, layers = [];
  let best = -90;
  for (let r = 60; r < 9000; r += 20) {
    const angle = Math.atan2(heightAt(CHAIR[0] + Math.sin(a) * r, CHAIR[2] - Math.cos(a) * r) - CHAIR[1], r) * 180 / Math.PI;
    if (angle > best + 0.25) { if (layers.length && r - layers.at(-1)[0] < 300) layers[layers.length - 1] = [r, angle]; else layers.push([r, angle]); }
    best = Math.max(best, angle);
  }
  return layers.filter(([r]) => r > 400).map(([r, angle]) => `${(r / 1000).toFixed(1)} km ${angle.toFixed(1)}°`);
};

test('from the chair the ranges stack behind each other, each crest further away and higher', () => {
  assert.deepEqual(skyline(0), ['0.6 km -5.2°', '1.1 km 1.8°', '1.8 km 4.4°', '3.3 km 8.3°', '5.1 km 10.8°']);
  assert.deepEqual(skyline(10), ['0.6 km -5.3°', '1.0 km 1.9°', '1.8 km 5.0°', '3.1 km 8.9°', '5.1 km 10.0°', '6.1 km 11.3°']);
});

test('the ranges sink to a low saddle in front of the snow massif so it stands alone', () => {
  assert.deepEqual(skyline(-30), ['0.5 km -5.1°', '1.3 km 1.4°']);
  assert.deepEqual(skyline(-40), ['1.0 km -3.4°', '1.5 km 1.3°']);
});

test('the near meadow rolls in hummocks rather than one smooth fall', () => {
  const hummock = z => {
    const h = Array.from({ length: 121 }, (_, i) => heightAt(i - 60, z));
    return Math.round(Math.max(...h.slice(10, 111).map((v, k) => Math.abs(v - (h[k] + h[k + 20]) / 2))) * 10) / 10;
  };
  assert.deepEqual([-30, -60, -100].map(hummock), [0.6, 0.5, 0.5]);
});

test('scatter is repeatable and keeps only what the density allows', () => {
  const bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
  assert.deepEqual(scatter(bounds, 10, () => 0.5), scatter(bounds, 10, () => 0.5));
  assert.equal(scatter(bounds, 10, () => 0).length, 0);
  assert.equal(scatter(bounds, 10, () => 1).length, 100);
  for (const point of scatter(bounds, 10, () => 1)) assert.equal(point.y, heightAt(point.x, point.z));
});

test('the Wilds fen waterline forms coves while the outer bank remains dry', async () => {
  const { WILDS_WORLD } = await import('./wilds/world-definition.js');
  const field = createTerrainField(WILDS_WORLD), body = WILDS_WORLD.water[0], crossings = [];
  for (let turn = 0; turn < 48; turn++) {
    const angle = turn / 48 * Math.PI * 2;
    let low = .65, high = 1;
    for (let n = 0; n < 20; n++) {
      const radius = (low + high) / 2;
      if (field.heightAt(body.x + Math.cos(angle) * body.radiusX * radius, body.z + Math.sin(angle) * body.radiusZ * radius) < body.level) low = radius;
      else high = radius;
    }
    crossings.push((low + high) / 2);
    assert.ok(field.heightAt(body.x + Math.cos(angle) * body.radiusX, body.z + Math.sin(angle) * body.radiusZ) > body.level);
  }
  const variation = Math.max(...crossings) - Math.min(...crossings);
  assert.ok(variation > .09, `shoreline radius varies only ${variation.toFixed(3)}`);
});

test('a finite world trail rounds its endpoints without discontinuous vegetation masks', async () => {
  const { WILDS_WORLD } = await import('./wilds/world-definition.js');
  const definition = { ...WILDS_WORLD, path: { start: 0, end: 10, offset: 0, drift: 0, width: 1.4, waves: [] } };
  const field = createTerrainField(definition);
  assert.deepEqual([[0, 0], [0, -10], [3, -5], [3, 4], [3, -14]].map(([x, z]) => field.pathDistance(x, z)), [0, 0, 3, 5, 5]);
  const before = field.pathDistance(2, 0.001), inside = field.pathDistance(2, -0.001);
  assert.ok(Math.abs(before - inside) < 0.000001);
  assert.equal(createTerrainField().pathDistance(0, 3), Infinity);
});
