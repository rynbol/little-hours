import test from 'node:test';
import assert from 'node:assert/strict';
import { seatedDim, deskLamp, LAMP_AT } from './room-lighting.js';

test('seated at dusk or in rain, the room ambient and key light dim so the lamp and candles lead', () => {
  assert.equal(seatedDim('day', 1), 1);
  assert.equal(seatedDim('dusk', 0), 1);
  assert.ok(seatedDim('dusk', 1) <= 0.55);
  assert.ok(seatedDim('rain', 1) <= 0.7);
  assert.ok(seatedDim('dusk', 0.5) < 1 && seatedDim('dusk', 0.5) > seatedDim('dusk', 1));
});

test('seated, the desk lamp tucks under its shade and throws a tight warm pool at dusk and in rain', () => {
  assert.deepEqual(deskLamp('dusk', 0).offset, LAMP_AT.room);
  assert.deepEqual(deskLamp('rain', 1).offset, LAMP_AT.seated);
  for (const theme of ['dusk', 'rain']) {
    const room = deskLamp(theme, 0), seated = deskLamp(theme, 1);
    assert.ok(seated.range <= 2 && seated.range < room.range, `${theme} pool reaches ${seated.range} m`);
    assert.ok(seated.intensity >= 2, `${theme} lamp shines at ${seated.intensity}`);
  }
  assert.ok(deskLamp('day', 1).intensity < 0.5, 'the day lamp stays a gentle accent');
  assert.equal(deskLamp('dusk', 0).range, 3.4, 'the dollhouse keeps its lamplight');
});
