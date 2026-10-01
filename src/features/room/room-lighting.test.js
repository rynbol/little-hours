import test from 'node:test';
import assert from 'node:assert/strict';
import { seatedDim } from './room-lighting.js';

test('seated at dusk or in rain, the room ambient and key light dim so the lamp and candles lead', () => {
  assert.equal(seatedDim('day', 1), 1);
  assert.equal(seatedDim('dusk', 0), 1);
  assert.ok(seatedDim('dusk', 1) <= 0.55);
  assert.ok(seatedDim('rain', 1) <= 0.7);
  assert.ok(seatedDim('dusk', 0.5) < 1 && seatedDim('dusk', 0.5) > seatedDim('dusk', 1));
});
