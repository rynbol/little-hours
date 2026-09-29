import test from 'node:test';
import assert from 'node:assert/strict';
import { POND, POND_PATH, createLakeBank, createLakeGrass, lakeGrassSpots, meadowTone } from './lake-ground.js';

const palette = { grass: '#a3c27f', meadow: '#93b572', sand: '#e0cba3' };

test('the meadow color field changes continuously in world space', () => {
  let low = 1, high = 0;
  for (let x = -18; x < 18; x += .3) for (let z = -19; z < 13; z += .3) {
    const tone = meadowTone(x, z); low = Math.min(low, tone); high = Math.max(high, tone);
    assert.ok(tone >= 0 && tone <= 1);
    assert.ok(Math.abs(tone - meadowTone(x + .01, z)) < .003);
    assert.ok(Math.abs(tone - meadowTone(x, z + .01)) < .003);
  }
  assert.ok(high - low > .5, 'the continuous field still has varied patches');
});

test('the bank overlaps the water, slopes upward and has no stretched foreground triangles', () => {
  const { positions, indices, normals, colors } = createLakeBank(palette);
  assert.equal(colors.length, positions.length / 3 * 4);
  assert.equal(normals.length, positions.length);
  const points = Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3));
  const shore = points.filter(([, y]) => y < 0);
  assert.ok(shore.length >= 120);
  for (const [x, , z] of shore) assert.ok(Math.abs(x) < POND.rx * 1.2 && Math.abs(z - POND.z) < POND.rz * 1.2);
  for (let i = 0; i < normals.length; i += 3) assert.ok(normals[i + 1] > .9, 'all ground normals face up');
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map(n => points[n]);
    assert.ok(triangle.flat().every(Number.isFinite));
    if (!triangle.every(([x, , z]) => Math.hypot(x / POND.rx, (z - POND.z) / POND.rz) < 3)) continue;
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      assert.ok(Math.hypot(...a.map((v, k) => v - b[k])) < 1.55, 'foreground edges stay short enough to avoid radial color streaks');
    }
  }
});

test('grass remains rooted on dry land and leaves the dock and stepping stones clear', () => {
  const spots = lakeGrassSpots();
  assert.ok(spots.length > 150 && spots.length < 400);
  assert.deepEqual(spots, lakeGrassSpots());
  for (const { x, z } of spots) {
    assert.ok(Math.hypot(x / POND.rx, (z - POND.z) / POND.rz) >= 1.13);
    assert.ok(!(Math.abs(x) < 1.25 && z > .5 && z < 6.8));
    assert.ok(POND_PATH.every(([px, pz]) => Math.hypot(x - px, z - pz) >= .72));
  }
  const grass = createLakeGrass(palette);
  assert.ok(grass.indices.length / 3 < 7200, 'tufts fit in the static scenery budget');
  for (let i = 0; i < grass.positions.length; i += 3) {
    assert.ok(grass.positions[i + 1] >= .148 && grass.positions[i + 1] < .4);
    assert.ok(grass.normals[i + 1] > .95, 'both sides receive soft meadow light instead of black undersides');
  }
  const rainy = createLakeGrass({ grass: '#7f9a74', meadow: '#728d69', sand: '#b9ab94' });
  assert.deepEqual(grass.positions, rainy.positions);
  assert.notDeepEqual(grass.colors, rainy.colors);
});
