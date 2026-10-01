import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt } from '../../core/world-terrain.js';
import { terrainRing } from './terrain-mesh.js';

const RINGS = [{ radius: 16, step: 2 }, { radius: 64, step: 8 }];

test('a fine ring meets the coarse ring around it without cracks', () => {
  const { positions } = terrainRing(0, RINGS);
  let edges = 0;
  for (let v = 0; v < positions.length; v += 3) {
    const [x, y, z] = positions.subarray(v, v + 3);
    if (Math.abs(x) !== 16 && Math.abs(z) !== 16) { assert.equal(y, Math.fround(heightAt(x, z))); continue; }
    const along = Math.abs(x) === 16 ? z : x, low = Math.floor(along / 8) * 8, t = (along - low) / 8;
    const at = value => Math.abs(x) === 16 ? heightAt(x, value) : heightAt(value, z);
    assert.ok(Math.abs(y - (at(low) * (1 - t) + at(low + 8) * t)) < 1e-3, `edge vertex ${x},${z}`);
    edges++;
  }
  assert.equal(edges, 64);
});

test('a coarse ring leaves a hole where the finer ring sits', () => {
  const { positions, indices } = terrainRing(1, RINGS);
  for (let i = 0; i < indices.length; i += 3) {
    const xs = [0, 1, 2].map(k => positions[indices[i + k] * 3]), zs = [0, 1, 2].map(k => positions[indices[i + k] * 3 + 2]);
    assert.ok(!(xs.every(x => Math.abs(x) <= 16) && zs.every(z => Math.abs(z) <= 16)), 'no triangle inside the inner ring');
  }
  assert.equal(indices.length / 3, 16 * 16 * 2 - 4 * 4 * 2);
});
