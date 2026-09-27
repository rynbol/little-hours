import test from 'node:test';
import assert from 'node:assert/strict';
import { onIsland, STREAM } from './house-island.js';
import { HOUSE_POSITIONS } from './house-model.js';
import { GARDEN_CENTER } from './house-garden.js';

test('every room, the stair and the whole garden stand on the island', () => {
  const corners = [];
  for (const [x, , z] of Object.values(HOUSE_POSITIONS)) for (const dx of [-2.5, 2.5]) for (const dz of [-2.1, 2.9]) corners.push([x + dx, z + dz]);
  for (const dx of [-2.75, 2.75]) for (const dz of [-3.2, 3.2]) corners.push([GARDEN_CENTER[0] + dx, dz]);
  corners.push([-5.7, 1.9], [-5.7, -1.2]);
  for (const [x, z] of corners) assert.ok(onIsland(x, z, .15), `${x}, ${z} is off the island`);
});

test('the stream runs from the lawn to the very edge', () => {
  assert.ok(STREAM.slice(0, -1).every(([x, z]) => onIsland(x, z, .3)));
  assert.equal(onIsland(...STREAM.at(-1), .1), false);
});
