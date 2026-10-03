import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bladeGeometry, GRASS_TIERS } from './grass.js';

test('every blade grows from inside its tile up to a single tip', () => {
  for (const tier of GRASS_TIERS) {
    const { positions, shape, indices } = bladeGeometry(tier), perBlade = tier.segments * 2 + 1;
    assert.equal(positions.length / 3, tier.blades * perBlade);
    for (let b = 0; b < tier.blades; b++) {
      const root = b * perBlade, tip = root + perBlade - 1;
      assert.equal(positions[root * 3 + 1], 0);
      assert.equal(positions[tip * 3 + 1], 1);
      assert.equal(shape[tip * 4], 0, 'the tip sits on the spine');
      const x = positions[root * 3], z = positions[root * 3 + 2];
      assert.ok(x >= 0 && x < tier.size && z >= 0 && z < tier.size, `blade ${b} at ${x}, ${z}`);
    }
    assert.equal(indices.length, tier.blades * (tier.segments * 6 - 3));
    assert.ok(indices.every(index => index < positions.length / 3));
  }
});

test('blades grow in tufts rather than evenly', () => {
  const tier = GRASS_TIERS[0], { positions } = bladeGeometry(tier), perBlade = tier.segments * 2 + 1;
  let tufted = 0;
  for (let b = 1; b < 400; b++) {
    const here = b * perBlade * 3, before = (b - 1) * perBlade * 3;
    if (Math.hypot(positions[here] - positions[before], positions[here + 2] - positions[before + 2]) < .45) tufted++;
  }
  assert.ok(tufted > 300, `${tufted} of 399 blades sit beside the one before`);
});
