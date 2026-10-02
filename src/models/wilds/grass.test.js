import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WILDS_GRASS, wildsBlades, createGroundField } from './grass.js';
import { wildsAtmosphere } from './atmosphere.js';
import { worldAtmosphere } from '../world/atmosphere.js';

test('grass roots cover every ring evenly at its density and stay inside its tile', () => {
  const { roots, count } = wildsBlades();
  assert.equal(roots.length, count * 4);
  let blade = 0;
  WILDS_GRASS.rings.forEach(({ period, density, reach }, ring) => {
    const side = Math.round(period * Math.sqrt(density)), cell = period / side, filled = new Uint8Array(side * side);
    assert.ok(period >= reach * 2);
    assert.ok(Math.abs(side * side / (period * period) - density) / density < .02);
    for (let i = 0; i < side * side; i++, blade++) {
      const [x, z, seed, tag] = roots.subarray(blade * 4, blade * 4 + 4);
      assert.ok(x >= 0 && x < period + 1e-4 && z >= 0 && z < period + 1e-4);
      assert.ok(seed >= 0 && seed < 1);
      assert.equal(Math.floor(tag), ring);
      filled[Math.min(side - 1, Math.floor(z / cell)) * side + Math.min(side - 1, Math.floor(x / cell))] = 1;
    }
    assert.ok(filled.reduce((sum, value) => sum + value, 0) > side * side * .999);
  });
  assert.equal(blade, count);
  assert.deepEqual(wildsBlades().roots, roots);
});

test('the ground field reaches past the farthest ring and carries slope, canopy and height', () => {
  const { texels, step, recentre } = WILDS_GRASS.field;
  assert.ok((texels - 1) / 2 * step >= WILDS_GRASS.rings.at(-1).reach + recentre);
  let samples = 0;
  const field = createGroundField({ texels: 5, step: 2, sample: (x, z) => { samples++; return x > 100 ? null : { height: x * .5 + 3, cover: z > 0 ? 1 : 0 }; } });
  assert.equal(field.centre(10, 20), true);
  assert.deepEqual(field.origin, [6, 16]);
  assert.equal(samples, 25);
  const centre = (2 * 5 + 2) * 4, slope = Math.hypot(2, 4);
  assert.deepEqual([...field.data.subarray(centre, centre + 4)].map(value => Number(value.toFixed(5))), [Number((-2 / slope).toFixed(5)), 0, 1, 8]);
  assert.equal(field.centre(10.4, 20.4), false);
  assert.equal(field.centre(12, 20), true);
  assert.equal(samples, 30);
  assert.deepEqual(field.origin, [8, 16]);
  assert.equal(field.data[centre + 3], 9);
  field.centre(110, 0, true);
  assert.equal(field.data[4 * 4 + 3], -10000);
});

test('the Wilds palette changes only ground colours and keeps the Forest sky and light', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const wilds = wildsAtmosphere(theme), forest = worldAtmosphere(theme);
    const changed = Object.keys(forest).filter(key => wilds[key] !== forest[key]);
    assert.deepEqual(changed.sort(), ['dirt', 'forestFloor', 'grass', 'grassFar', 'grassLight', 'grassTip', 'grassWarm', 'sand'].filter(key => wilds[key] !== forest[key]));
    assert.ok(changed.includes('grass') && changed.includes('grassFar'));
    assert.deepEqual(Object.keys(wilds), Object.keys(forest));
  }
  assert.equal(wildsAtmosphere('unknown'), wildsAtmosphere('day'));
});
