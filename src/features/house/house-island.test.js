import test from 'node:test';
import assert from 'node:assert/strict';
import { onIsland, edgePoint, islandCliff, ISLAND, ISLAND_DEPTH, STREAMS, waterfalls } from './house-island.js';
import { strataSteps, hangingRoots } from './island-landform.js';
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

test('the layered cliff meets the lawn all around its curved rim and narrows to a keel below', () => {
  const [{ positions }] = islandCliff();
  const occupied = new Set();
  let lowest = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const [x, y, z] = positions.slice(i, i + 3);
    lowest = Math.min(lowest, y);
    if (y < -.5) continue;
    const angle = Math.atan2(z - ISLAND.cz, x - ISLAND.cx);
    const [ex, ez] = edgePoint(angle);
    assert.ok(Math.abs(Math.hypot(x - ISLAND.cx, z - ISLAND.cz) - Math.hypot(ex - ISLAND.cx, ez - ISLAND.cz)) < .3, `cliff rim at ${x}, ${z} must follow the lawn`);
    occupied.add(Math.floor((angle + Math.PI) / (Math.PI * 2) * 24) % 24);
  }
  assert.equal(occupied.size, 24, 'the cliff supports every part of the shore');
  assert.equal(lowest, ISLAND_DEPTH);
});

test('the rock face steps down in ledges, each band a different stone', () => {
  const steps = strataSteps(-.45, ISLAND_DEPTH);
  assert.ok(steps.every((step, i) => !i || step.y < steps[i - 1].y && step.scale <= steps[i - 1].scale), 'each layer sits lower and tucks in');
  assert.ok(new Set(steps.map(step => step.color)).size >= 10, 'the strata read as separate bands');
  const ledges = steps.filter((step, i) => i && steps[i - 1].y - step.y < .15 * Math.abs(ISLAND_DEPTH) * .2);
  assert.ok(ledges.length >= 4, `only ${ledges.length} ledges`);
});

test('roots and moss hang from the rim of the lawn, not from inside it', () => {
  const hung = [], api = { box: (x, y, z, w, h) => hung.push({ x, y, z, h }), ball: (x, y, z, w, h) => hung.push({ x, y, z, h }), cylinder() {}, shape() {} };
  hangingRoots(api, { edge: a => edgePoint(a, .998), top: -.43, count: 110 });
  assert.ok(hung.length > 50 && hung.length < 90, `${hung.length} roots`);
  for (const { x, y, z } of hung) {
    assert.ok(y < -.43, 'every root hangs below the rim');
    assert.equal(onIsland(x, z, .1), false, `${x}, ${z} hangs inside the lawn`);
  }
  const outside = [];
  hangingRoots({ box: (x, y, z) => outside.push([x, z]), ball: (x, y, z) => outside.push([x, z]) }, { edge: a => edgePoint(a), top: 0, count: 110, open: x => x > ISLAND.cx });
  assert.ok(outside.length > 0 && outside.every(([x]) => x > ISLAND.cx));
});
