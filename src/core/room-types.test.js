import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, createLayout, validatePlacement } from './layout.js';
import { fitRoomType, plantPhase, plantCap } from './room-types.js';

test('every design gets exactly one valid seed bed or telescope, and keeps all its own pieces', () => {
  for (const preset of PRESETS) for (const [type, piece] of [['greenhouse', 'seed-bed'], ['attic', 'telescope']]) {
    const base = createLayout(preset.id), fitted = fitRoomType(base, type), placed = fitted.items.filter(item => item.type === piece);
    assert.equal(placed.length, 1, `${preset.id} ${type}`);
    assert.ok(validatePlacement(fitted.items.filter(item => item !== placed[0]), placed[0], preset.style).valid, `${preset.id} ${piece} fits`);
    assert.deepEqual(base.items.map(item => item.id).sort(), fitted.items.filter(item => item.type !== piece).map(item => item.id).sort(), `${preset.id} ${type} keeps its pieces`);
    assert.equal(fitRoomType(fitted, type), fitted, `${preset.id} ${type} is stable`);
  }
});

test('the seed bed stands against the back wall in the cloud loft instead of in front of the aquarium', () => {
  const bed = fitRoomType(createLayout('cloud-loft'), 'greenhouse').items.find(item => item.type === 'seed-bed');
  assert.equal(bed.z, -3.75);
});

test('the plant grows through a session and caps at budding under five minutes', () => {
  const at = (minutes, done) => plantPhase(minutes * 60_000, minutes * 60_000 * (1 - done));
  assert.deepEqual([0, 0.25, 0.5, 0.75, 0.99, 1].map(done => at(25, done)), [0, 1, 2, 3, 3, 4]);
  assert.equal(at(3, 1), 3); assert.equal(plantCap(4), 3); assert.equal(plantCap(5), 4);
});
