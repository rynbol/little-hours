import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, riverCenter, canopyAt, scatter, normalAt } from './world-terrain.js';

test('the house stands on a flat plateau and the land falls into a valley in front of it', () => {
  for (const [x, z] of [[0, 0], [6, -8], [-10, 12], [12, 0]]) assert.equal(heightAt(x, z), 0);
  assert.ok(heightAt(0, -100) < -8 && heightAt(0, -200) < -30, 'valley drops below the house');
  assert.deepEqual(normalAt(0, 0).map(value => Math.round(value) + 0), [0, 1, 0]);
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
