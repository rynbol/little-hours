import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outerGeometry } from './terrain-outer.js';

test('every far-ground triangle faces the sky, so the distant land is drawn from above', () => {
  const { positions, indices } = outerGeometry({ around: 24, rings: 6 });
  const point = v => [positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]];
  let downward = 0;
  for (let k = 0; k < indices.length; k += 3) {
    const [a, b, c] = [indices[k], indices[k + 1], indices[k + 2]].map(point);
    const u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    if (u[2] * w[0] - u[0] * w[2] <= 0) downward++;
  }
  assert.equal(downward, 0);
});
