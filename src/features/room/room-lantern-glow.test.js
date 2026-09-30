import test from 'node:test';
import assert from 'node:assert/strict';
import { lanternGlowShape, ROOM_WALLS, LANTERN_GLOW_RADIUS } from './room-lantern-glow.js';
import { ROOM_LIGHTS } from './room-lighting.js';

test('each lantern paints its glow onto the wall it hangs beside', () => {
  const { positions, indices } = lanternGlowShape([[-5.33, 4.48, 2.86], [1.64, 4.51, -4.05]]);
  assert.equal(indices.length, 12);
  const corner = k => positions.slice(k * 3, k * 3 + 3);
  for (const k of [0, 1, 2, 3]) assert.ok(Math.abs(corner(k)[0] - ROOM_WALLS.side) < .01, 'side-wall lantern glows on the side wall');
  for (const k of [4, 5, 6, 7]) assert.ok(Math.abs(corner(k)[2] - ROOM_WALLS.back) < .01, 'back-wall lantern glows on the back wall');
  assert.equal(corner(0)[1], 4.48 - LANTERN_GLOW_RADIUS);
  assert.equal(corner(2)[1], ROOM_WALLS.top, 'glow stops at the top of the wall');
});

test('lantern glow shows at dusk and in rain, not in daylight', () => {
  assert.equal(ROOM_LIGHTS.day.glow, 0);
  assert.ok(ROOM_LIGHTS.dusk.glow > ROOM_LIGHTS.rain.glow && ROOM_LIGHTS.rain.glow > 0);
});
