import test from 'node:test';
import assert from 'node:assert/strict';
import { FOREST_PATH, forestFloor, onForest, lanternSpots } from './island-forest.js';
import { onLandmass, landmassEdge, FOREST_REACH } from './island-landform.js';
import { bladeColors, grassBlades, grassy, rimBlades, woodlandBlades, lanternLights, GRASS_TONES, RIM_BLADES, LANTERN_SPILL } from './house-grass.js';
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
    assert.ok(onLandmass(x, z) && !onLandmass(x, z, .3), `${x}, ${z} is not at the edge`);
    assert.ok(drop[1] < 0, 'fringe blades hang down');
    assert.ok(!onLandmass(x + drop[0], z + drop[2]), 'fringe tips reach past the edge');
    for (const course of STREAMS) assert.ok(Math.hypot(x - course.at(-1)[0], z - course.at(-1)[1]) >= .5, 'no grass over a waterfall');
  }
});

test('each blade is darker at the root than at its sunlit tip', () => {
  const blades = grassBlades().slice(0, 400), colors = bladeColors(blades, GRASS_TONES.day);
  assert.equal(colors.length, blades.length * 12);
  const light = at => colors[at] + colors[at + 1] + colors[at + 2];
  blades.forEach((_, i) => assert.ok(light(i * 12) < light(i * 12 + 8), `blade ${i} root is as bright as its tip`));
});

test('no blade grows on the forest path', () => {
  const onLawn = FOREST_PATH.filter(([x, z]) => onIsland(x, z, .22));
  assert.ok(onLawn.length > 5);
  for (const [x, z] of onLawn) assert.equal(grassy(x, z), false, `${x}, ${z}`);
});

test('the grass fringe runs on around the forest shore instead of stopping at the old lawn outline', () => {
  const { from, to } = FOREST_REACH, [fx, fz] = landmassEdge((from + to) / 2);
  const onForestShore = rimBlades().filter(({ x, z }) => !onIsland(x, z, -.5));
  assert.ok(onForestShore.length > 300, `only ${onForestShore.length} fringe blades on the forest shore`);
  assert.ok(onForestShore.some(({ x, z }) => Math.hypot(x - fx, z - fz) < .4), 'no fringe at the far shore of the forest');
});

test('woodland grass stands on the forest floor, thinner under the crowns and clear of the trail', () => {
  const blades = woodlandBlades();
  assert.ok(blades.length > 1800 && blades.length < 5000, `${blades.length} woodland blades`);
  for (const { x, z, ground } of blades) {
    assert.ok(onForest(x, z), `${x}, ${z} is off the forest`);
    assert.equal(ground, forestFloor(x, z));
  }
  assert.ok(grassBlades().length + blades.length + rimBlades().length < 40000);
});

test('at dusk the grass beside a lantern is warmer than the same grass by day, and far grass is untouched', () => {
  const [{ x, z }] = lanternSpots(), blades = [{ x: x + .2, z, tone: .5, patch: 0 }, { x: x + 9, z: z + 9, tone: .5, patch: 0 }];
  assert.ok(lanternLights().some(([lx, lz]) => lx === x && lz === z));
  const plain = bladeColors(blades, GRASS_TONES.dusk), lit = bladeColors(blades, GRASS_TONES.dusk, LANTERN_SPILL.dusk);
  assert.ok(lit[8] > plain[8] * 1.6 && lit[9] > plain[9] && lit[10] < plain[10], 'the near blade is not warmed');
  assert.deepEqual([...lit.slice(12)], [...plain.slice(12)]);
  assert.equal(LANTERN_SPILL.day, 0);
});
