import test from 'node:test';
import assert from 'node:assert/strict';
import { sprayPuffs, SPRAY_PER_FALL, cloudCollar, COLLAR_PUFFS } from './house-water.js';
import { onLandmass } from './island-landform.js';
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

test('a collar of cloud rings the island and its forest below the rim and gathers beneath the keel', () => {
  const puffs = cloudCollar();
  assert.equal(puffs.length, COLLAR_PUFFS);
  const ring = puffs.slice(0, COLLAR_PUFFS), under = ring.filter((_, i) => i % 3 === 0);
  assert.equal(under.length, 12);
  for (const { x, y, z } of under) assert.ok(onLandmass(x, z) && y < -6.3, `${x}, ${y}, ${z} is not under the island`);
  for (const { x, y, z } of ring.filter((_, i) => i % 3)) assert.ok(!onLandmass(x, z, 1.5) && onLandmass(x, z, -3) && y < -3.5 && y > -4.8, `${x}, ${y}, ${z} is not at the rim`);
  assert.ok(ring.some(({ x, z }) => !onIsland(x, z, -2.5)), 'the ring follows the forest out past the lawn');
  const sectors = new Set(ring.map(({ x, z }) => Math.floor((Math.atan2(z, x) + Math.PI) / (Math.PI / 4))));
  assert.equal(sectors.size, 8);
});
