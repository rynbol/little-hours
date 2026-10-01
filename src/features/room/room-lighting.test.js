import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_LIGHTS, ambientAt } from './room-lighting.js';

test('seated at dusk or in rain, the room ambient dims so the lamp and candles lead', () => {
  assert.equal(ambientAt('day', 1), ROOM_LIGHTS.day.ambient);
  assert.equal(ambientAt('dusk', 0), ROOM_LIGHTS.dusk.ambient);
  assert.ok(ambientAt('dusk', 1) <= ROOM_LIGHTS.dusk.ambient * 0.55);
  assert.ok(ambientAt('rain', 1) <= ROOM_LIGHTS.rain.ambient * 0.7);
  assert.ok(ambientAt('dusk', 0.5) < ambientAt('dusk', 0) && ambientAt('dusk', 0.5) > ambientAt('dusk', 1));
});
