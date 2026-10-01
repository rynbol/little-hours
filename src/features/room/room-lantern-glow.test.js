import test from 'node:test';
import assert from 'node:assert/strict';
import { lanternGlowShape, ROOM_WALLS, LANTERN_GLOW_RADIUS, deskPoolShape, DESK_POOL } from './room-lantern-glow.js';
import { ROOM_LIGHTS, lampPool } from './room-lighting.js';

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

test('the desk lamp pool lies just above the desk top, centred under the lamp and clipped to the boards', () => {
  for (const halfWidth of [1.48, 1.23]) {
    const { positions, uvs, indices } = deskPoolShape(halfWidth), corners = [0, 1, 2, 3].map(k => positions.slice(k * 3, k * 3 + 3));
    assert.equal(indices.length, 6);
    for (const [x, y, z] of corners) {
      assert.ok(y > 1.25 && y < 1.26, `pool height ${y}`);
      assert.ok(Math.abs(x) <= halfWidth && z >= -1.02 && z <= 0.08, `corner ${x}, ${z} hangs off a ${halfWidth * 2} desk`);
    }
    corners.forEach(([x, , z], k) => {
      assert.ok(Math.abs(uvs[k * 2] - (x - DESK_POOL.at[0]) / DESK_POOL.radius) < 1e-9 && Math.abs(uvs[k * 2 + 1] - (z - DESK_POOL.at[1]) / DESK_POOL.radius) < 1e-9, 'the glow is brightest under the lamp');
    });
  }
});

test('the lamp pool strengthens as you sit and after dark, and stays faint in daylight', () => {
  for (const theme of ['day', 'dusk', 'rain']) assert.ok(lampPool(theme, 1) >= lampPool(theme, 0) * 2, `${theme} pool ${lampPool(theme, 0)} → ${lampPool(theme, 1)}`);
  assert.ok(lampPool('dusk', 1) > lampPool('rain', 1) && lampPool('rain', 1) > lampPool('day', 1));
  assert.ok(lampPool('day', 1) <= 0.25 && lampPool('dusk', 0) < 0.4);
});
