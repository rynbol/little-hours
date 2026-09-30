import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE_SPOT, POND, POND_PATH, createLakeBank, createLakeGrass, lakeGrassSpots, lakeWater, meadowTone, onPlot, underHouse } from './lake-ground.js';

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

test('the pond sits on a closed, bounded plot with a flat meadow and a rounded bank', () => {
  const { positions, indices, normals, colors } = createLakeBank(palette);
  assert.equal(colors.length, positions.length / 3 * 4);
  assert.equal(normals.length, positions.length);
  const points = Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3));
  assert.ok(points.flat().every(Number.isFinite));
  for (const [x, , z] of points) assert.ok(onPlot(x, z, -.05), 'nothing reaches past the plot edge');
  const heights = points.map(([, y]) => y);
  assert.ok(Math.abs(Math.max(...heights) - .15) < 1e-9);
  assert.ok(Math.min(...heights) < -2 && Math.min(...heights) > -2.5, 'the plot has a visible underside');
  assert.ok(onPlot(0, 6.2) && onPlot(HOUSE_SPOT.x, HOUSE_SPOT.z - 2.6) && !onPlot(0, 9.5) && !onPlot(16, -4));
  const c = Math.cos(HOUSE_SPOT.yaw), s = Math.sin(HOUSE_SPOT.yaw);
  for (const u of [-6, 6]) for (const v of [-2.6, 2.6]) {
    const x = HOUSE_SPOT.x + u * c + v * s, z = HOUSE_SPOT.z - u * s + v * c;
    assert.ok(underHouse(x, z, .01) && onPlot(x, z, .05), 'the whole house footprint stands on the plot');
  }
  const edges = new Map();
  for (let i = 0; i < indices.length; i += 3) for (let j = 0; j < 3; j++) {
    const a = indices[i + j], b = indices[i + (j + 1) % 3], key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) || 0) + 1);
  }
  assert.ok([...edges.values()].every(count => count === 2), 'the plot is closed, with no holes to see through');
  points.forEach(([x, y, z], i) => { if (Math.abs(y - .15) < 1e-9 && onPlot(x, z, .1)) assert.ok(normals[i * 3 + 1] > .99, 'the meadow faces up'); });
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = indices.slice(i, i + 3).map(n => points[n]);
    if (!triangle.every(([, y]) => y > .12)) continue;
    for (let j = 0; j < 3; j++) {
      const a = triangle[j], b = triangle[(j + 1) % 3];
      assert.ok(Math.hypot(...a.map((v, k) => v - b[k])) < 1.55, 'meadow edges stay short enough to avoid radial color streaks');
    }
  }
});

test('the water fills the pond and tucks under the bank', () => {
  const { positions, indices } = lakeWater();
  assert.ok(indices.length / 3 > 2000 && indices.length / 3 < 3000);
  let widest = 0;
  for (let i = 0; i < positions.length; i += 3) widest = Math.max(widest, Math.hypot((positions[i] - POND.x) / POND.rx, (positions[i + 2] - POND.z) / POND.rz));
  assert.ok(Math.abs(widest - 1.07) < 1e-9);
  const ground = createLakeBank(palette).positions;
  for (let i = 0; i < ground.length; i += 3) if (Math.abs(Math.hypot(ground[i] / POND.rx, (ground[i + 2] - POND.z) / POND.rz) - 1.1) < .03 && ground[i + 1] > -.5) assert.ok(ground[i + 1] > .05, 'the bank is above the swell where the water ends');
});

test('grass remains rooted on the plot and leaves the dock, house and stepping stones clear', () => {
  const spots = lakeGrassSpots();
  assert.ok(spots.length > 120 && spots.length < 400);
  assert.deepEqual(spots, lakeGrassSpots());
  for (const { x, z } of spots) {
    assert.ok(Math.hypot(x / POND.rx, (z - POND.z) / POND.rz) >= 1.13);
    assert.ok(onPlot(x, z, .1) && !underHouse(x, z));
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
