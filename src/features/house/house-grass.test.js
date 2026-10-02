import test from 'node:test';
import assert from 'node:assert/strict';
import { FOREST_PATH } from './island-forest.js';
import { bladeColors, grassBlades, grassy, rimBlades, GRASS_TONES, RIM_BLADES } from './house-grass.js';
import { HOUSE_POSITIONS } from './house-model.js';
import { inPond, POND } from './house-pond.js';
import { pathDistance, PATH_WIDTH, PATHS } from './house-paths.js';
import { onIsland, STREAMS } from './house-island.js';

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

test('a fringe of grass hangs over the island edge, clear of the waterfalls', () => {
  const fringe = rimBlades();
  assert.ok(fringe.length > RIM_BLADES * .9, `only ${fringe.length} fringe blades`);
  for (const { x, z, drop } of fringe) {
    assert.ok(onIsland(x, z) && !onIsland(x, z, .1), `${x}, ${z} is not at the edge`);
    assert.ok(drop[1] < 0, 'fringe blades hang down');
    assert.ok(!onIsland(x + drop[0], z + drop[2]), 'fringe tips reach past the edge');
    for (const course of STREAMS) assert.ok(Math.hypot(x - course.at(-1)[0], z - course.at(-1)[1]) >= .5, 'no grass over a waterfall');
  }
});

test('each blade is darker at the root than at its sunlit tip', () => {
  const blades = grassBlades().slice(0, 400), colors = bladeColors(blades, GRASS_TONES.day);
  assert.equal(colors.length, blades.length * 12);
  const light = at => colors[at] + colors[at + 1] + colors[at + 2];
  blades.forEach((_, i) => assert.ok(light(i * 12) < light(i * 12 + 8), `blade ${i} root is as bright as its tip`));
});

test('no blade grows on the forest path or under the grove', () => {
  for (const [x, z] of FOREST_PATH.filter(([x, z]) => onIsland(x, z, .22))) assert.equal(grassy(x, z), false, `${x}, ${z}`);
  for (const [x, z] of [[4.5, -4.9], [7.4, -4.6]]) assert.equal(grassy(x, z), false, `${x}, ${z} is under the grove`);
});
