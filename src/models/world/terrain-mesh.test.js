import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, normalAt } from '../../core/world-terrain.js';
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

test('far mountain normals are averaged wider than the grid so slopes shade smoothly instead of in facets', () => {
  const ring = { radius: 6400, step: 64 }, n = Math.round(ring.radius * 2 / ring.step) + 1, { normals } = terrainRing(0, [ring]);
  const coordinate = i => -ring.radius + i * ring.step;
  const neighbourAgreement = normalOf => {
    let sum = 0, count = 0;
    for (let i = 0; i < n - 1; i++) for (let j = 0; j < n; j++) {
      if (Math.hypot(coordinate(i), coordinate(j)) < 2000) continue;
      const a = normalOf(i, j), b = normalOf(i + 1, j);
      sum += a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; count++;
    }
    return sum / count;
  };
  const meshed = neighbourAgreement((i, j) => normals.subarray((i * n + j) * 3, (i * n + j) * 3 + 3));
  const perStep = neighbourAgreement((i, j) => normalAt(coordinate(i), coordinate(j), ring.step * 0.75));
  assert.equal(Math.round(meshed * 1000) / 1000, 0.981);
  assert.ok(1 - meshed < (1 - perStep) * 0.5, `${meshed} vs ${perStep}`);
});

test('terrain vertices carry no rock moss and count as open ground, so the shared paint leaves them unchanged', () => {
  const { colors } = terrainRing(0, [{ radius: 64, step: 8 }]);
  for (let v = 0; v < colors.length / 4; v++) assert.deepEqual([colors[v * 4 + 2], colors[v * 4 + 3]], [0, 1]);
});
