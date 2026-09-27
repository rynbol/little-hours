import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strollAt } from './house-stroll.js';
import { onIsland } from './house-island.js';
import { inPond, DOCK } from './house-pond.js';

test('the garden stroll stays on the island, keeps out of the pond except on the dock, and loops', () => {
  const onDock = p => Math.abs(p.x - DOCK.x) < DOCK.width / 2 && p.z > DOCK.to - .05 && p.z < DOCK.from;
  let docked = 0, resting = 0;
  for (let s = 0; s < 120; s += .25) {
    const p = strollAt(s);
    assert.ok(onIsland(p.x, p.z, .3), `on the island at ${s}s: ${p.x}, ${p.z}`);
    assert.ok(!inPond(p.x, p.z) || onDock(p), `dry at ${s}s: ${p.x}, ${p.z}`);
    if (onDock(p)) { docked++; assert.equal(p.y, -.04); }
    if (!p.moving) resting++;
  }
  assert.ok(docked > 10 && resting > 20, `goes out on the dock (${docked}) and stops to rest (${resting})`);
  const start = strollAt(0);
  assert.deepEqual([start.x, start.z, start.moving], [5.6, 3.3, false]);
});
