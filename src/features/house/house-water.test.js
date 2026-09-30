import test from 'node:test';
import assert from 'node:assert/strict';
import { sprayPuffs, SPRAY_PER_FALL } from './house-water.js';
import { waterfalls } from './house-island.js';

test('each waterfall ends in a cluster of spray at its foot', () => {
  const falls = waterfalls(), puffs = sprayPuffs();
  assert.equal(puffs.length, falls.length * SPRAY_PER_FALL);
  falls.forEach(({ points }, f) => {
    const [x, y, z] = points.at(-1);
    for (const puff of puffs.slice(f * SPRAY_PER_FALL, (f + 1) * SPRAY_PER_FALL)) {
      assert.ok(Math.hypot(puff.x - x, puff.z - z) < .7, 'spray stays at the foot of its fall');
      assert.ok(Math.abs(puff.y - y) < .5);
      assert.ok(puff.seed >= 0 && puff.seed < 1);
    }
  });
});
