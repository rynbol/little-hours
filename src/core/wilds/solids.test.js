import assert from 'node:assert/strict';
import test from 'node:test';
import { createStatics } from './solids.js';

test('a static grid finds every solid that could touch a body, across cell edges', () => {
  const list = [{ x: 7.9, z: 0, radius: 0.3 }, { x: 8.1, z: 0, radius: 0.3 }, { x: 30, z: 30, radius: 0.3 }, { x: -20, z: 5, radius: 6 }];
  const statics = createStatics(list, 8);
  const ids = (x, z, reach) => statics.near(x, z, reach).map(solid => list.indexOf(solid)).sort();
  assert.deepEqual(ids(8, 0, 0.5), [0, 1]);
  assert.deepEqual(ids(-13.5, 5, 0.6), [3]);
  assert.deepEqual(ids(30, 29, 0.5), [2]);
  for (let i = 0; i < 400; i++) {
    const x = -40 + (i * 7.31) % 80, z = -40 + (i * 3.77) % 80;
    const touching = list.filter(solid => Math.hypot(solid.x - x, solid.z - z) < solid.radius + 0.5);
    for (const solid of touching) assert.ok(statics.near(x, z, 0.5).includes(solid));
  }
});
