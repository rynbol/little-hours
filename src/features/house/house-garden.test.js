import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGarden, edgeFlowers, treeSpot, LANTERNS, BEDS_FENCE, ARCH } from './house-garden.js';
import { buildPaths, pathStones, pathDistance, PATH_WIDTH } from './house-paths.js';
import { PLANT_SPOTS } from './garden-model.js';
import { inPond } from './house-pond.js';
import { onIsland } from './house-island.js';
import { STROLL } from './house-stroll.js';

const counting = () => {
  const calls = { shape: 0, vertices: 0, meshes: 0 };
  const api = new Proxy({}, { get: (_, name) => (...args) => {
    if (name === 'shape') { calls.shape++; calls.vertices += args[0].length / 3; } else calls.meshes++;
  } });
  return { calls, api };
};

test('lanterns stand at the path edge, dry and on the island', () => {
  for (const [x, z] of LANTERNS) {
    const distance = pathDistance(x, z);
    assert.ok(distance > PATH_WIDTH / 2 + .05 && distance < .8, `lantern at ${x}, ${z} is ${distance} from the path`);
    assert.ok(onIsland(x, z, .3) && !inPond(x, z, .2));
  }
});

test('the arbour straddles the path so the walk passes under it', () => {
  const [x, z] = ARCH;
  assert.ok(pathDistance(x, z) < .1);
  for (const side of [-.56, .56]) assert.ok(pathDistance(x, z + side) > PATH_WIDTH / 2, 'an arbour post blocks the path');
  assert.ok(STROLL.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > .35), 'a stroll stop stands inside the arbour, hidden by its posts');
});

test('wildflowers line the paths without growing on them, in the pond or off the edge', () => {
  const flowers = edgeFlowers();
  assert.ok(flowers.length >= 10, `only ${flowers.length} flower tufts`);
  for (const [x, z] of flowers) {
    assert.ok(pathDistance(x, z) > PATH_WIDTH / 2 + .15 && pathDistance(x, z) < PATH_WIDTH / 2 + .55, `${x}, ${z} is not at a path edge`);
    assert.ok(onIsland(x, z, .3) && !inPond(x, z, .2), `${x}, ${z} is wet or off the island`);
  }
});

test('the bed fence rings the plots, leaves a gate and keeps clear of beds and trees', () => {
  const posts = BEDS_FENCE.filter(Boolean);
  assert.equal(BEDS_FENCE.filter(post => post === null).length, 1, 'one gate');
  for (const [x, z] of posts) {
    const nearest = Math.min(...PLANT_SPOTS.map(([px, pz]) => Math.hypot(x - px, z - pz)));
    assert.ok(nearest > .62, `post ${x}, ${z} cuts into a bed`);
    for (let i = 0; i < 24; i++) assert.ok(Math.hypot(x - treeSpot(i)[0], z - treeSpot(i)[1]) > .3, `post ${x}, ${z} stands in tree ${i}`);
  }
  const xs = posts.map(([x]) => x), zs = posts.map(([, z]) => z);
  for (const [px, pz] of PLANT_SPOTS) assert.ok(px > Math.min(...xs) && px < Math.max(...xs) && pz > Math.min(...zs) && pz < Math.max(...zs));
});

test('path stones are set inside the path', () => {
  const stones = pathStones();
  assert.ok(stones.length > 60, `only ${stones.length} stones`);
  for (const { x, z, size } of stones) assert.ok(pathDistance(x, z) + size * .5 < PATH_WIDTH / 2, `a stone at ${x}, ${z} spills off the path`);
});

test('the grounds and paths each bake into one shape with few separate meshes', () => {
  const garden = counting(), paths = counting();
  buildGarden(garden.api, [], 'dusk', []);
  buildPaths(paths.api);
  assert.equal(paths.calls.shape, 1); assert.equal(paths.calls.meshes, 0);
  assert.ok(paths.calls.vertices < 20000, `${paths.calls.vertices} path vertices`);
  assert.ok(garden.calls.shape <= 2, `${garden.calls.shape} garden shapes`);
  assert.ok(garden.calls.meshes < 120, `${garden.calls.meshes} separate parts in the garden`);
  assert.ok(garden.calls.vertices < 40000, `${garden.calls.vertices} garden vertices`);
});
