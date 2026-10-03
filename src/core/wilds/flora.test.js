import assert from 'node:assert/strict';
import test from 'node:test';
import { createGround } from './ground.js';
import { VALLEY, trailDistance, valleyHeight, waterAt } from './valley.js';
import { HERO_TREES, plantValley, trunkSolids } from './flora.js';

const grid = createGround(valleyHeight, VALLEY.grid), ground = (x, z) => grid.at(x, z);
const trees = plantValley(ground);
const reach = tree => Math.hypot((tree.x - VALLEY.bounds.x) / VALLEY.bounds.rx, (tree.z - VALLEY.bounds.z) / VALLEY.bounds.rz);

test('the valley plants the same forest every time, off the trails, out of the water and out of the clearings', () => {
  assert.deepEqual(plantValley(ground), trees);
  const wild = trees.filter(tree => !tree.hero);
  assert.ok(wild.every(tree => trailDistance(tree.x, tree.z) >= 4.5));
  assert.ok(wild.every(tree => waterAt(tree.x, tree.z) < tree.y));
  for (const [x, z, clear] of [[VALLEY.camp.x, VALLEY.camp.z, 15], [VALLEY.ring.x, VALLEY.ring.z, 27], [VALLEY.oak.x, VALLEY.oak.z, 17], [VALLEY.merchant.x, VALLEY.merchant.z, 6]])
    assert.ok(wild.every(tree => Math.hypot(tree.x - x, tree.z - z) >= clear));
});

test('the camp sits in a ring of hero trees and the valley rim is dense forest', () => {
  const camp = HERO_TREES.filter(tree => Math.hypot(tree.x - VALLEY.camp.x, tree.z - VALLEY.camp.z) < 25);
  assert.ok(camp.length >= 6);
  const sides = new Set(camp.map(tree => Math.round(Math.atan2(tree.x - VALLEY.camp.x, tree.z - VALLEY.camp.z) / (Math.PI / 2))));
  assert.ok(sides.size >= 3);
  const rim = trees.filter(tree => reach(tree) > 0.95 && reach(tree) < 1.15).length;
  const meadow = trees.filter(tree => tree.z < -40 && tree.z > -110 && Math.abs(tree.x) < 40).length;
  assert.ok(rim > 600, `rim ${rim}`);
  assert.ok(meadow < 40, `meadow ${meadow}`);
});

test('trunks inside the valley block movement and trunks far outside it cost nothing', () => {
  const solids = trunkSolids(trees);
  assert.ok(solids.length > 500);
  assert.ok(solids.every(solid => solid.radius > 0.15 && solid.radius < 0.7 && solid.top > solid.bottom + 5));
  assert.ok(trees.filter(tree => reach(tree) > 1.2).length > 1000);
  assert.ok(solids.every(solid => reach(solid) < 1.05));
});
