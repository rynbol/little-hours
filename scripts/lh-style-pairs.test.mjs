import test from 'node:test';
import assert from 'node:assert/strict';
import { blindOrder, STYLE_CASES } from './lh/style-pairs.mjs';

test('blind comparisons cover matching scenery themes and every style character', () => {
  assert.deepEqual(STYLE_CASES.scenery.map(sample => sample.theme), ['day', 'day', 'dusk', 'dusk', 'rain', 'rain']);
  assert.deepEqual(STYLE_CASES.characters.map(sample => sample.subject), ['avatar', 'avatar', 'avatar', 'cat', 'cat', 'warden']);
  assert.deepEqual(STYLE_CASES.characters.map(sample => sample.reference), ['avatar', 'avatar', 'avatar', 'cat', 'cat', 'dog']);
});

test('blind order preserves every case while randomizing sequence and picture side', () => {
  const samples = ['front', 'side', 'back'];
  const choices = [0, 0, 1, 0, 1];
  assert.deepEqual(blindOrder(samples, () => choices.shift()), [
    { sample: 'side', sourceIndex: 1, pair: 1, wilds: 'B' },
    { sample: 'back', sourceIndex: 2, pair: 2, wilds: 'A' },
    { sample: 'front', sourceIndex: 0, pair: 3, wilds: 'B' },
  ]);
  assert.deepEqual(samples, ['front', 'side', 'back']);
});
