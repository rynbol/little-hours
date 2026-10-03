import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VALLEY, valleyHeight, createHeightGrid } from '../../core/wilds/valley.js';
import { CHUNK, LOD_STEPS, chunkGeometry, surveyGround } from './terrain-data.js';

function survey(minX, minZ, columns, rows) {
  const heights = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) heights[r * columns + c] = valleyHeight(minX + c, minZ + r);
  const grid = createHeightGrid(heights, { minX, minZ, step: 1, columns, rows });
  const { colors, mask, tint } = surveyGround(grid);
  const at = (x, z) => {
    const i = ((z - minZ) * columns + (x - minX)) * 4;
    return { ground: [...colors.slice(i, i + 3)], cover: mask[i] / 255, tall: mask[i + 1] / 255, grass: [...tint.slice(i, i + 3)] };
  };
  return at;
}

test('the worn trail is bare, its edges are short grass and the meadow beside it is full', () => {
  const at = survey(-18, -152, 20, 5);
  const trail = at(-4, -150), edge = at(-2, -150), meadow = at(-14, -150);
  assert.equal(trail.cover, 0);
  assert.ok(trail.ground[0] > trail.ground[1], 'the trail is painted as dirt');
  assert.ok(edge.cover > .5, `edge cover ${edge.cover}`);
  assert.ok(meadow.cover > .95, `meadow cover ${meadow.cover}`);
  assert.ok(edge.tall < meadow.tall - .15, `edge ${edge.tall} meadow ${meadow.tall}`);
});

test('grass is green even where the ground under it is dirt', () => {
  const at = survey(-18, -152, 20, 5);
  for (const spot of [at(-4, -150), at(-14, -150)]) {
    const [r, g, b] = spot.grass;
    assert.ok(g > r && r > b, `grass ${spot.grass}`);
  }
});

test('no grass grows in the lake', () => {
  const at = survey(-32, 68, 4, 4);
  assert.equal(at(-30, 70).cover, 0);
});

test('chunks of any detail meet at the waterfall cliff without a crack', () => {
  const { minX, minZ } = VALLEY.core, { ledge } = VALLEY.waterfall;
  const seam = minX + CHUNK * Math.round((ledge.x - minX) / CHUNK), south = minZ + CHUNK * Math.floor((ledge.z - minZ) / CHUNK);
  const columns = CHUNK * 2 + 1, rows = CHUNK + 1, heights = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) for (let c = 0; c < columns; c++) heights[r * columns + c] = valleyHeight(seam - CHUNK + c, south + r);
  const grid = createHeightGrid(heights, { minX: seam - CHUNK, minZ: south, step: 1, columns, rows }), colors = new Uint8Array(columns * rows * 4);
  const profile = (originX, step) => {
    const { positions } = chunkGeometry(grid, colors, originX, south, step), count = Math.round(CHUNK / step) + 1, top = [], bottom = [];
    for (let v = 0; v < positions.length / 3; v++) if (positions[v * 3] === seam) (v < count * count ? top : bottom).push([positions[v * 3 + 2], positions[v * 3 + 1]]);
    const along = points => {
      points.sort((a, b) => a[0] - b[0]);
      return z => {
        const i = Math.max(1, points.findIndex(p => p[0] >= z)), [[z0, y0], [z1, y1]] = [points[i - 1], points[i]];
        return y0 + (y1 - y0) * (z - z0) / (z1 - z0);
      };
    };
    return { surface: along(top), floor: along(bottom) };
  };
  const worst = [];
  for (const west of LOD_STEPS) for (const east of LOD_STEPS) {
    const a = profile(seam - CHUNK, west), b = profile(seam, east);
    for (let z = south; z <= south + CHUNK; z += .25) {
      const [high, low] = a.surface(z) >= b.surface(z) ? [a, b] : [b, a];
      const open = high.floor(z) - low.surface(z);
      if (open > 1e-3) worst.push({ west, east, z, open: +open.toFixed(2) });
    }
  }
  assert.deepEqual(worst.slice(0, 3), []);
});
