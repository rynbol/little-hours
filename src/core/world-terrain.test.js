import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, riverCenter, canopyAt, scatter, normalAt, padDistance, pathCenter, pathDistance } from './world-terrain.js';

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
  assert.deepEqual(skyline(0), ['0.6 km -5.2°', '1.1 km 1.8°', '1.8 km 4.4°', '3.3 km 8.3°', '5.3 km 12.2°']);
  assert.deepEqual(skyline(10), ['0.6 km -5.3°', '1.0 km 1.9°', '1.8 km 5.0°', '3.1 km 8.9°', '5.1 km 10.1°', '6.2 km 12.0°']);
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
