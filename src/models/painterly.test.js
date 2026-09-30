import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINTERLY_LOOKS } from './painterly.js';
import { ISLAND_ATMOSPHERES } from '../features/house/island-atmosphere.js';

test('outdoor faces turned from the sun fall below the painterly terminator', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const [start, end] = PAINTERLY_LOOKS[theme].band;
    assert.ok(start > ISLAND_ATMOSPHERES[theme].fill, `${theme} fill light alone reads as sunlit`);
    assert.ok(end < ISLAND_ATMOSPHERES[theme].fill + ISLAND_ATMOSPHERES[theme].key, `${theme} sun never fully lights a face`);
  }
  assert.deepEqual(PAINTERLY_LOOKS.interior.band, [0.2, 0.46]);
});
