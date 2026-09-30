import test from 'node:test';
import assert from 'node:assert/strict';
import { grassBlades, grassy } from './house-grass.js';
import { HOUSE_POSITIONS } from './house-model.js';
import { inPond, POND } from './house-pond.js';
import { pathDistance, PATH_WIDTH, PATHS } from './house-paths.js';
import { onIsland } from './house-island.js';

test('the meadow is dense but stays inside one draw budget', () => {
  const count = grassBlades().length;
  assert.ok(count > 15000, `only ${count} blades`);
  assert.ok(count < 40000, `${count} blades is over budget`);
});

test('no blade grows inside a room, the pond, a path or off the island', () => {
  for (const { x, z } of grassBlades()) {
    assert.ok(onIsland(x, z), `${x}, ${z} is off the island`);
    assert.equal(inPond(x, z), false, `${x}, ${z} is in the pond`);
    assert.ok(pathDistance(x, z) > PATH_WIDTH / 2, `${x}, ${z} is on a path`);
    for (const [hx, , hz] of Object.values(HOUSE_POSITIONS)) assert.ok(!(Math.abs(x - hx) < 2.55 && Math.abs(z - hz) < 2.2), `${x}, ${z} is inside a room`);
  }
});

test('the lawn beside the house is grassy and the pond and path are not', () => {
  assert.equal(grassy(-6.5, -1), true);
  assert.equal(grassy(POND.x, POND.z), false);
  assert.equal(grassy(...PATHS[0][2]), false);
  assert.equal(grassy(0, 0), false);
});
