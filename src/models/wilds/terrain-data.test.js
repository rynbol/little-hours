import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valleyHeight, createHeightGrid } from '../../core/wilds/valley.js';
import { surveyGround } from './terrain-data.js';

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
