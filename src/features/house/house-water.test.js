import test from 'node:test';
import assert from 'node:assert/strict';
import { sprayPuffs, SPRAY_PER_FALL, cloudCollar, COLLAR_PUFFS } from './house-water.js';
import { onForest } from './island-forest.js';
import { waterfalls, onIsland } from './house-island.js';

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

test('a collar of cloud rings the island below its rim and gathers beneath the keel and the forest', () => {
  const puffs = cloudCollar();
  assert.equal(puffs.length, COLLAR_PUFFS + 6);
  const ring = puffs.slice(0, COLLAR_PUFFS), under = ring.filter((_, i) => i % 3 === 0);
  assert.equal(under.length, 12);
  for (const { x, y, z } of under) assert.ok(onIsland(x, z) && y < -6.3, `${x}, ${y}, ${z} is not under the island`);
  for (const { x, y, z } of ring.filter((_, i) => i % 3)) assert.ok(!onIsland(x, z, 1.5) && onIsland(x, z, -3) && y < -3.5 && y > -4.8, `${x}, ${y}, ${z} is not at the rim`);
  for (const { x, z } of puffs.slice(COLLAR_PUFFS)) assert.ok(onForest(x, z), `${x}, ${z} is not under the forest`);
  const sectors = new Set(ring.map(({ x, z }) => Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 4))));
  assert.equal(sectors.size, 8);
});
