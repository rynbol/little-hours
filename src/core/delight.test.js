import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celebrationWeight } from './delight.js';

test('celebration eases in, holds for the gesture, settles and respects reduced motion', () => {
  assert.equal(celebrationWeight(0), 0);
  assert.ok(celebrationWeight(.2) > 0 && celebrationWeight(.2) < 1);
  assert.equal(celebrationWeight(1.5), 1);
  assert.ok(celebrationWeight(3) < 1);
  assert.equal(celebrationWeight(3.2), 0);
  assert.equal(celebrationWeight(Infinity), 0);
  assert.equal(celebrationWeight(1, true), 0);
});
