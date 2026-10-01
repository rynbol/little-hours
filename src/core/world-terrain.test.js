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

test('mountains rise hundreds of metres a few kilometres out', () => {
  for (const [x, z] of [[0, -4000], [4000, 0], [-3000, 3000]]) assert.ok(heightAt(x, z) > 250, `mountain at ${x},${z}`);
});

test('scatter is repeatable and keeps only what the density allows', () => {
  const bounds = { minX: 0, maxX: 100, minZ: 0, maxZ: 100 };
  assert.deepEqual(scatter(bounds, 10, () => 0.5), scatter(bounds, 10, () => 0.5));
  assert.equal(scatter(bounds, 10, () => 0).length, 0);
  assert.equal(scatter(bounds, 10, () => 1).length, 100);
  for (const point of scatter(bounds, 10, () => 1)) assert.equal(point.y, heightAt(point.x, point.z));
});
