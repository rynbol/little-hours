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
  assert.equal(Math.round(meshed * 1000) / 1000, 0.99);
  assert.ok(1 - meshed < (1 - perStep) * 0.5, `${meshed} vs ${perStep}`);
});

test('neighbouring far crag vertices never face apart sharply, so adjacent faces of a peak share one light', () => {
  const ring = square(6400, 64), n = Math.round(ring.maxX * 2 / ring.step) + 1, { normals } = terrainRing(0, [ring]);
  let bent = 0, count = 0, widest = 1;
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    if (Math.hypot(ring.minX + i * ring.step, ring.minZ + j * ring.step) < 2000) continue;
    const a = (i * n + j) * 3;
    for (const b of [a + n * 3, a + 3]) {
      const dot = normals[a] * normals[b] + normals[a + 1] * normals[b + 1] + normals[a + 2] * normals[b + 2];
      count++; if (dot < Math.cos(Math.PI * 25 / 180)) bent++; widest = Math.min(widest, dot);
    }
  }
  assert.ok(bent / count < 0.03, `${bent / count} of neighbours bend over 25 degrees`);
  assert.ok(widest > 0.2, `two neighbours meet at ${widest}`);
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

const CHAIR_VIEW = Object.freeze({ eye: [-2, 2.236, -2.41], forward: [-0.1884, -0.2349, -0.9536], fov: 1.22, width: 1440, height: 1000 });

function skylineFromChair(ringIndices) {
  const { eye, forward, fov, width, height } = CHAIR_VIEW, unit = v => v.map(c => c / Math.hypot(...v));
  const ahead = unit(forward), right = unit([-ahead[2], 0, ahead[0]]), up = [right[1] * ahead[2] - right[2] * ahead[1], right[2] * ahead[0] - right[0] * ahead[2], right[0] * ahead[1] - right[1] * ahead[0]];
  const focal = height / 2 / Math.tan(fov / 2), top = new Float64Array(width).fill(height);
  const project = (positions, v) => {
    const dx = positions[v * 3] - eye[0], dy = positions[v * 3 + 1] - eye[1], dz = positions[v * 3 + 2] - eye[2], depth = dx * ahead[0] + dy * ahead[1] + dz * ahead[2];
    return depth < 1 ? null : [width / 2 + focal * (dx * right[0] + dz * right[2]) / depth, height / 2 - focal * (dx * up[0] + dy * up[1] + dz * up[2]) / depth];
  };
  for (const index of ringIndices) {
    const { positions, indices } = terrainRing(index);
    for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) {
      const a = project(positions, indices[t + k]), b = project(positions, indices[t + (k + 1) % 3]);
      if (!a || !b) continue;
      const [left, end] = a[0] < b[0] ? [a, b] : [b, a];
      for (let column = Math.max(0, Math.ceil(left[0] - 0.5)); column < Math.min(width, end[0] - 0.5); column++) {
        const y = left[1] + (end[1] - left[1]) * (column + 0.5 - left[0]) / (end[0] - left[0]);
        if (y < top[column]) top[column] = y;
      }
    }
  }
  return top;
}

function ridgeline(top, from, to) {
  const y = Array.from(top.subarray(from, to)), turn = i => Math.abs(Math.atan2(y[i + 3] - y[i], 3) - Math.atan2(y[i] - y[i - 3], 3)) * 180 / Math.PI;
  let corners = 0, spikes = 0;
  for (let i = 3; i < y.length - 3; i++) if (turn(i) > 30) corners++;
  for (let i = 1; i < y.length - 1; i++) {
    if (!(y[i] <= y[i - 1] && y[i] < y[i + 1])) continue;
    let left = y[i], right = y[i];
    for (let j = i - 1; j >= 0 && y[j] >= y[i]; j--) left = Math.max(left, y[j]);
    for (let j = i + 1; j < y.length && y[j] >= y[i]; j++) right = Math.max(right, y[j]);
    if (Math.min(left, right) - y[i] >= 6) spikes++;
  }
  return { corners: Math.round(corners / (y.length - 6) * 100) / 100, spikes };
}

test('from the chair the far ranges meet the sky in one or two broad masses with smooth ridgelines, not a train of spikes and hard corners', () => {
  const top = skylineFromChair([3, 4]);
  const regions = { behindObservatory: ridgeline(top, 790, 1070), right: ridgeline(top, 1200, 1400) };
  for (const [name, { corners, spikes }] of Object.entries(regions)) {
    assert.ok(corners <= 0.1, `${name}: ${corners} of the ridgeline turns over 30 degrees within 3 px`);
    assert.ok(spikes <= 2, `${name}: ${spikes} peaks stand 6 px clear of their neighbours`);
  }
  assert.ok(regions.behindObservatory.spikes >= 1, 'the range behind the observatory still parts into two masses');
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
