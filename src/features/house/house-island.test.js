import test from 'node:test';
import assert from 'node:assert/strict';
import { onIsland, STREAMS, waterfalls } from './house-island.js';
import { HOUSE_POSITIONS } from './house-model.js';
import { GARDEN_CENTER } from './house-garden.js';

test('every room, the stair and the whole garden stand on the island', () => {
  const corners = [];
  for (const [x, , z] of Object.values(HOUSE_POSITIONS)) for (const dx of [-2.5, 2.5]) for (const dz of [-2.1, 2.9]) corners.push([x + dx, z + dz]);
  for (const dx of [-2.75, 2.75]) for (const dz of [-3.2, 3.2]) corners.push([GARDEN_CENTER[0] + dx, dz]);
  corners.push([-5.7, 1.9], [-5.7, -1.2]);
  for (const [x, z] of corners) assert.ok(onIsland(x, z, .15), `${x}, ${z} is off the island`);
});

test('each stream runs from the lawn over the edge and falls clear of the island', () => {
  assert.equal(STREAMS.length, 3);
  for (const course of STREAMS) {
    assert.ok(course.slice(0, -1).every(([x, z]) => onIsland(x, z, .3)), JSON.stringify(course));
    assert.equal(onIsland(...course.at(-1), .1), false);
  }
  for (const { points, rim } of waterfalls()) {
    const [, top] = points[rim], [x, bottom, z] = points.at(-1);
    assert.ok(top > -.2 && bottom < -3.4 && !onIsland(x, z), `falls from ${top} to ${bottom}`);
  }
});
