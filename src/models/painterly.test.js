import test from 'node:test';
import assert from 'node:assert/strict';
import { PAINTERLY_LOOKS } from './painterly.js';
import { ISLAND_ATMOSPHERES, ISLAND_SUN } from '../features/house/island-atmosphere.js';
import { ROOM_LIGHTS } from '../features/room/room-lighting.js';

test('outdoor faces turned from the sun fall below the painterly terminator', () => {
  for (const theme of ['day', 'dusk', 'rain']) {
    const [start, end] = PAINTERLY_LOOKS[theme].band;
    assert.ok(start > ISLAND_ATMOSPHERES[theme].fill, `${theme} fill light alone reads as sunlit`);
    assert.ok(end < ISLAND_ATMOSPHERES[theme].fill + ISLAND_ATMOSPHERES[theme].key, `${theme} sun never fully lights a face`);
  }
});

test('cast shadows fall below the terminator and the cottage front stays sunlit', () => {
  const [x, y, z] = ISLAND_SUN.direction, frontFacing = -z / Math.hypot(x, y, z);
  for (const theme of ['day', 'dusk']) {
    const { fill, key } = ISLAND_ATMOSPHERES[theme], [start, end] = PAINTERLY_LOOKS[theme].band;
    assert.ok(fill + key * ISLAND_SUN.darkness < start, `${theme} shadows read as sunlit`);
    assert.ok(fill + key * frontFacing > end, `${theme} front wall sits on the terminator`);
  }
  assert.ok(ISLAND_ATMOSPHERES.rain.fill + ISLAND_ATMOSPHERES.rain.key * ISLAND_SUN.darkness < PAINTERLY_LOOKS.rain.band[0], 'rain shadows read as sunlit');
});

test('in the room, ambient light alone reads as shade and window sun reads as lit', () => {
  const brightest = hex => Math.max(...[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255));
  for (const [theme, { ambient, sky, sun, darkness }] of Object.entries(ROOM_LIGHTS)) {
    const [start, end] = PAINTERLY_LOOKS[`room-${theme}`].band, shade = ambient * brightest(sky);
    assert.ok(shade + sun * darkness < start, `${theme} room shade reads as sunlit`);
    assert.ok(shade + sun * .5 > end, `${theme} room sunlight never reads as lit`);
  }
});
