import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOREST_TRAILHEAD } from './island-forest.js';
import { strollAt } from './house-stroll.js';
import { onIsland } from './house-island.js';
import { inPond, DOCK } from './house-pond.js';
import { pathDistance, PATH_WIDTH } from './house-paths.js';

test('the garden stroll keeps to the paths and the dock, stays dry, and loops', () => {
  const onDock = p => Math.abs(p.x - DOCK.x) < DOCK.width / 2 && p.z > DOCK.to - .05 && p.z < DOCK.from;
  let docked = 0, resting = 0;
  for (let s = 0; s < 120; s += .25) {
    const p = strollAt(s);
    assert.ok(onIsland(p.x, p.z, .3), `on the island at ${s}s: ${p.x}, ${p.z}`);
    assert.ok(!inPond(p.x, p.z) || onDock(p), `dry at ${s}s: ${p.x}, ${p.z}`);
    assert.ok(onDock(p) || pathDistance(p.x, p.z) < PATH_WIDTH / 2, `on a path at ${s}s: ${p.x}, ${p.z}`);
    if (onDock(p)) { docked++; assert.equal(p.y, -.04); }
    if (!p.moving) resting++;
  }
  assert.ok(docked > 10 && resting > 20, `goes out on the dock (${docked}) and stops to rest (${resting})`);
  const start = strollAt(0);
  assert.deepEqual([start.x, start.z, start.moving], [5.6, 3.3, false]);
});

test('the retreat walk keeps the avatar and following pet outside flower beds and furniture', () => {
  const beds = [[-2.35, -1.95], [2.35, -1.95], [-3, .2], [3, .2], [-2.25, 2.35], [2.25, 2.35]];
  let moving = 0, resting = 0;
  for (let seconds = 0; seconds < 200; seconds += .2) {
    for (const pet of [false, true]) {
      const pose = strollAt(seconds - (pet ? 1.2 : 0), 'garden');
      const x = pose.x - (pet ? .19 : 0), z = pose.z + (pet ? .19 : 0);
      assert.ok(x > -.6 && x < 1.1 && z > -3.3 && z < 3.3);
      assert.equal(pose.y, .035);
      assert.equal(pose.sit, 0);
      for (const [bx, bz] of beds) assert.ok(Math.hypot((x - bx) / 1.15, (z - bz) / 1) > 1, `clear of bed at ${seconds}s`);
      assert.ok(Math.hypot(x, z + 2.35) > .48, `clear of birdbath at ${seconds}s`);
      assert.ok(Math.hypot(x - 1.04, z - 1.1) > .65, `clear of watering can at ${seconds}s`);
      if (pose.moving) moving++; else resting++;
    }
  }
  assert.ok(moving > 500 && resting > 100);
  const arrival = strollAt(0, 'garden');
  assert.deepEqual([arrival.x, arrival.z, arrival.yaw], [0, 2.1, Math.PI + .25]);
});

test('focused garden visits seat the avatar on the arbour cushion', () => {
  const pose = strollAt(48, 'garden-rest');
  assert.deepEqual([pose.x, pose.z, pose.yaw, pose.sit, pose.moving], [-.55, -3.55, Math.PI, 1, false]);
  assert.ok(Math.abs(pose.y + pose.seatHeight * .76 - .715) < 1e-9);
  assert.deepEqual(strollAt(0, 'garden-rest'), pose);
});

test('leaving the Wilds restores the island stroll at its trailhead', () => {
  const pose = strollAt(0, 'forest-return');
  assert.deepEqual([pose.x, pose.y, pose.z], FOREST_TRAILHEAD.position);
  assert.equal(pose.yaw, Math.atan2(-FOREST_TRAILHEAD.facing[0], -FOREST_TRAILHEAD.facing[2]));
  assert.equal(pose.moving, false);
  assert.deepEqual(strollAt(120, 'forest-return'), pose);
});
