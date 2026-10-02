import test from 'node:test';
import assert from 'node:assert/strict';
import { POND, POND_EXIT, POND_PATH, LAKE_DEPTH, LAKE_GRASS, LAKE_POSTS, createLakeBank, lakeBlades, lakeCliff, lakeFrame, lakeGrassy, lakeWater, meadowTone, onPlot, plotReach, pondRim } from './lake-ground.js';

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

test('the pond sits on a bounded plot with a flat meadow, a rounded bank and a green lip that hangs over the edge', () => {
  const { positions, indices, normals, colors } = createLakeBank(palette);
  assert.equal(colors.length, positions.length / 3 * 4);
  assert.equal(normals.length, positions.length);
  const points = Array.from({ length: positions.length / 3 }, (_, i) => positions.slice(i * 3, i * 3 + 3));
  assert.ok(points.flat().every(Number.isFinite));
  for (const [x, , z] of points) assert.ok(onPlot(x, z, -.05), 'nothing reaches past the plot edge');
  const heights = points.map(([, y]) => y);
  assert.ok(Math.abs(Math.max(...heights) - .15) < 1e-9);
  assert.ok(onPlot(0, 6.2) && !onPlot(0, 9.5) && !onPlot(16, -4));
  const lip = points.map((point, i) => [point, colors.slice(i * 4, i * 4 + 3)]).filter(([[x, y, z]]) => y < 0 && !onPlot(x, z, .05));
  assert.equal(lip.length, 160);
  const drops = lip.map(([[, y]]) => y);
  assert.ok(Math.max(...drops) <= -.17 + 1e-9 && Math.min(...drops) > -.35 && new Set(drops.map(y => y.toFixed(2))).size > 4, 'the lip hangs in uneven tongues');
  for (const [, [r, g, b]] of lip) assert.ok(g > r && g > b, 'the lip is turf, not clay');
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

test('a banded rock cliff hangs under the whole plot, steep enough to show from above, with spires below', () => {
  const [body, ...spires] = lakeCliff(), segments = 144;
  assert.ok(spires.length >= 5);
  for (const { positions, colors, indices } of [body, ...spires]) {
    assert.ok([...positions, ...colors].every(Number.isFinite));
    assert.equal(colors.length, positions.length / 3 * 4);
    assert.ok(indices.every(n => n >= 0 && n < positions.length / 3));
  }
  const ring = row => Array.from({ length: segments }, (_, j) => body.positions.slice((row * segments + j) * 3, (row * segments + j) * 3 + 3));
  const rows = body.positions.length / 3 / segments, reachOf = ([x, , z]) => Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
  for (const [x, y, z] of ring(0)) { assert.ok(Math.abs(y + .2) < .01); assert.ok(reachOf([x, y, z]) > 1.5 && onPlot(x, z, -.1), 'the cliff starts under the lip'); }
  const half = ring(Math.floor(rows / 2)), halfY = half.reduce((sum, [, y]) => sum + y, 0) / segments;
  assert.ok(halfY < LAKE_DEPTH * .3 && half.every(point => reachOf(point) > 1.6 * .7), 'the wall is still wide halfway down');
  const bands = new Set(Array.from({ length: rows - 1 }, (_, row) => body.colors.slice(row * segments * 4, row * segments * 4 + 3).map(v => v.toFixed(1)).join()));
  assert.ok(bands.size >= 4, 'the rock is banded');
  const lowest = body.positions.filter((_, i) => i % 3 === 1).reduce((a, b) => Math.min(a, b));
  assert.equal(lowest, LAKE_DEPTH);
  for (const { positions } of spires) {
    const ys = positions.filter((_, i) => i % 3 === 1);
    assert.ok(Math.max(...ys) < -3 && Math.min(...ys) < LAKE_DEPTH + 1);
    for (let i = 0; i < positions.length; i += 3) assert.ok(onPlot(positions[i], positions[i + 2], .05), 'spires hang under the plot');
  }
  const tone = theme => { const { colors } = lakeCliff(theme)[0]; let r = 0, b = 0; for (let i = 0; i < colors.length; i += 4) { r += colors[i]; b += colors[i + 2]; } return [r, b]; };
  const [dayRed, dayBlue] = tone('day'), [duskRed, duskBlue] = tone('dusk');
  assert.ok(duskRed < dayRed * .7 && duskBlue / duskRed > dayBlue / dayRed * 1.3, 'the cliff is not daylit at dusk');
  const frame = lakeFrame();
  for (let i = 0; i < frame.length; i += 3) assert.ok(onPlot(frame[i], frame[i + 2], .2) && frame[i + 1] < -3 && frame[i + 1] > LAKE_DEPTH, 'the camera frames the upper cliff, not the keel');
});

test('one unbroken stepping-stone path runs from the exit arch, along the bank, to the foot of the dock', () => {
  const [first, last] = [POND_PATH[0], POND_PATH.at(-1)];
  assert.ok(Math.hypot(first[0] - POND_EXIT.x, first[1] - POND_EXIT.z) < .5, 'the path starts under the arch');
  assert.ok(Math.abs(last[0]) < .5 && last[1] > 5.4 && last[1] < 6, 'the path ends at the foot of the dock');
  POND_PATH.slice(1).forEach(([x, z], i) => {
    const gap = Math.hypot(x - POND_PATH[i][0], z - POND_PATH[i][1]);
    assert.ok(gap > .5 && gap < .85, 'stones sit one stride apart');
    assert.ok(onPlot(x, z, .1) && Math.hypot(x / POND.rx, (z - POND.z) / POND.rz) > 1.2, 'the path stays on the meadow, clear of the water');
  });
  assert.ok(onPlot(POND_EXIT.x, POND_EXIT.z, .1), 'the arch stands on the plot edge');
  assert.ok(Math.sin(POND_EXIT.yaw) * (POND.x - POND_EXIT.x) + Math.cos(POND_EXIT.yaw) * (POND.z - POND_EXIT.z) > 0, 'the arch opens toward the pond');
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

test('a dense meadow of blades covers the plot and leaves the water, dock, exit arch and stepping stones clear', () => {
  const blades = lakeBlades(), rooted = blades.filter(blade => !blade.drop), fringe = blades.filter(blade => blade.drop);
  assert.ok(rooted.length > 18000 && blades.length < 30000, `${blades.length} blades`);
  assert.deepEqual(blades, lakeBlades());
  for (const { x, z, ground, height } of rooted) {
    assert.ok(lakeGrassy(x, z));
    assert.ok(Math.hypot(x / POND.rx, (z - POND.z) / POND.rz) > 1.13 && onPlot(x, z));
    assert.ok(!(Math.abs(x) < 1 && z > .5 && z < 6.4));
    assert.ok(POND_PATH.every(([px, pz]) => Math.hypot(x - px, z - pz) > .36) && Math.hypot(x - POND_EXIT.x, z - POND_EXIT.z) > 1.2);
    assert.ok(ground === LAKE_GRASS.ground && height > .08 && height < .36);
  }
  assert.ok(!lakeGrassy(0, 3) && !lakeGrassy(POND.x, POND.z) && !lakeGrassy(POND_EXIT.x, POND_EXIT.z) && !lakeGrassy(20, 0) && lakeGrassy(10.5, 2));
  assert.equal(fringe.length, LAKE_GRASS.rim);
  for (const { x, z, drop } of fringe) {
    assert.ok(drop[1] < 0 && onPlot(x, z, -.02) && !onPlot(x, z, .1), 'the fringe roots on the rim and hangs down');
    assert.ok(!onPlot(x + drop[0] * 4, z + drop[2] * 4), 'the fringe leans outward');
  }
});

test('the lamp posts that light the grass stand on the dock and beside the arch path', () => {
  assert.equal(LAKE_POSTS.length, 5);
  for (const [x, z] of LAKE_POSTS) assert.ok(onPlot(x, z, .2));
  assert.deepEqual(LAKE_POSTS[3], pondRim(1.45, 1.16));
  assert.ok(plotReach(0) > 1.5);
});
