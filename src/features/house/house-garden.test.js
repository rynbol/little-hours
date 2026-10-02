import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGarden, edgeFlowers, treeSpot, LANTERNS, ARCH } from './house-garden.js';
import { buildPaths, pathStones, pathDistance, PATH_WIDTH } from './house-paths.js';
import { PLANT_SPOTS, buildGardenPlants } from './garden-model.js';
import { forestPathDistance, FOREST_PATH_WIDTH } from './island-forest.js';
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
const shapes = build => { const out = []; build(new Proxy({}, { get: (_, name) => (...args) => { if (name === 'shape') out.push({ positions: args[0], colors: args[1], normals: args[2] }); } })); return out; };
const RESTS = [[5.6, 3.3], [9.55, 1.6], [7.85, 1.75], [6.35, 3.2]];

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
  for (const rest of RESTS) assert.ok(STROLL.some(([sx, sz]) => sx === rest[0] && sz === rest[1]), `${rest} is no longer a stroll stop`);
  assert.ok(RESTS.every(([sx, sz]) => Math.hypot(sx - x, sz - z) > 1.2), 'the avatar rests beside the arbour, hidden by its posts');
  for (const [i] of Array.from({ length: 24 }).entries()) assert.ok(Math.hypot(treeSpot(i)[0] - x, treeSpot(i)[1] - z) > 1.2, `tree ${i} grows into the arbour`);
});

test('wildflowers line the paths without growing on them, in the pond or off the edge', () => {
  const flowers = edgeFlowers();
  assert.ok(flowers.length >= 10, `only ${flowers.length} flower tufts`);
  for (const [x, z] of flowers) {
    assert.ok(pathDistance(x, z) > PATH_WIDTH / 2 + .15 && pathDistance(x, z) < PATH_WIDTH / 2 + .55, `${x}, ${z} is not at a path edge`);
    assert.ok(onIsland(x, z, .3) && !inPond(x, z, .2), `${x}, ${z} is wet or off the island`);
  }
});

test('the walk into the forest stays open past the garden fence and grounds', () => {
  const pieces = [...shapes(api => buildGardenPlants(api, [])), ...shapes(api => buildGarden(api, [], 'day', []))];
  assert.ok(pieces.length >= 2);
  for (const { positions } of pieces) for (let i = 0; i < positions.length; i += 3) {
    assert.ok(forestPathDistance(positions[i], positions[i + 2]) > FOREST_PATH_WIDTH / 2 + .15, `${positions[i]}, ${positions[i + 2]} stands on the forest trail`);
  }
});

test('lanterns and string lights glow amber at dusk and softly in rain, lit evenly from every side', () => {
  const glowing = theme => {
    const [{ colors, normals }] = shapes(api => buildGarden(api, [], theme, [])), lit = [];
    for (let i = 0; i < colors.length; i += 4) if (colors[i] > 1.1) lit.push([colors[i], colors[i + 1], colors[i + 2], normals[i / 4 * 3 + 1]]);
    return lit;
  };
  const dusk = glowing('dusk'), rain = glowing('rain');
  assert.ok(dusk.length > 300, `${dusk.length} glowing vertices at dusk`);
  for (const [r, g, b, up] of dusk) { assert.ok(g / r < .55 && b / r < .25, `a dusk light reads ${r}, ${g}, ${b}`); assert.equal(up, 1); }
  assert.ok(rain.length > 300 && rain.every(([r, g, b]) => r < 1.3 && g / r > .6 && g / r < .8 && b / r < .5), 'rain lights are soft and warm');
  assert.equal(glowing('day').length, 0);
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
