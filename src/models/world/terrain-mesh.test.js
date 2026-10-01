import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heightAt, normalAt } from '../../core/world-terrain.js';
import { terrainRing, ringAt, TERRAIN_RINGS } from './terrain-mesh.js';

const square = (radius, step) => ({ minX: -radius, maxX: radius, minZ: -radius, maxZ: radius, step });
const RINGS = [square(16, 2), square(64, 8)];

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
  const ring = square(6400, 64), n = Math.round(ring.maxX * 2 / ring.step) + 1, { normals } = terrainRing(0, [ring]);
  const coordinate = i => ring.minX + i * ring.step;
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
  assert.equal(Math.round(meshed * 1000) / 1000, 0.973);
  assert.ok(1 - meshed < (1 - perStep) * 0.5, `${meshed} vs ${perStep}`);
});

test('terrain vertices carry no rock moss and count as open ground, so the shared paint leaves them unchanged', () => {
  const { colors } = terrainRing(0, [square(64, 8)]);
  for (let v = 0; v < colors.length / 4; v++) assert.deepEqual([colors[v * 4 + 2], colors[v * 4 + 3]], [0, 1]);
});

test('the far ridges ahead of the window are meshed at 64 m out to 9 km, for fewer triangles than square rings spent', () => {
  const coarseAhead = [];
  for (let bearing = -55; bearing <= 35; bearing += 5) for (let reach = 2600; reach <= 8900; reach += 100) {
    const a = bearing * Math.PI / 180, x = Math.sin(a) * reach, z = -Math.cos(a) * reach;
    if (ringAt(x, z).step > 64) coarseAhead.push(`${bearing}° ${reach} m`);
  }
  assert.deepEqual(coarseAhead, []);
  const triangles = TERRAIN_RINGS.reduce((sum, _, index) => sum + terrainRing(index).indices.length / 3, 0);
  assert.equal(triangles, 224900);
  assert.ok(triangles < 229400, `${triangles} triangles against 229400 for the square rings`);
});

test('a forward ring meets the rings around it without cracks on every side', () => {
  const rings = [square(16, 2), { minX: -64, maxX: 64, minZ: -96, maxZ: 32, step: 8 }, square(256, 32)];
  for (const index of [0, 1]) {
    const ring = rings[index], coarse = rings[index + 1].step, { positions } = terrainRing(index, rings);
    for (let v = 0; v < positions.length; v += 3) {
      const [x, y, z] = positions.subarray(v, v + 3), onX = x === ring.minX || x === ring.maxX, onZ = z === ring.minZ || z === ring.maxZ;
      if (!onX && !onZ) continue;
      const along = onX ? z : x, low = Math.floor(along / coarse) * coarse, t = (along - low) / coarse;
      const at = value => onX ? heightAt(x, value) : heightAt(value, z);
      assert.ok(Math.abs(y - (at(low) * (1 - t) + at(low + coarse) * t)) < 1e-3, `ring ${index} edge vertex ${x},${z}`);
    }
  }
  const { positions, indices } = terrainRing(2, rings);
  for (let i = 0; i < indices.length; i += 3) {
    const xs = [0, 1, 2].map(k => positions[indices[i + k] * 3]), zs = [0, 1, 2].map(k => positions[indices[i + k] * 3 + 2]);
    assert.ok(!(xs.every(x => x >= -64 && x <= 64) && zs.every(z => z >= -96 && z <= 32)), 'no triangle inside the forward ring');
  }
});
