import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WOLF, createWolf, stepWolf } from './wolf.js';

const DT = 1 / 120, flat = () => 0;

function run(wolf, player, seconds) {
  const seen = [];
  for (let t = 0; t < seconds; t += DT) for (const event of stepWolf(wolf, { player, ground: flat }, DT).splice(0)) seen.push(event.type);
  return seen;
}

test('a waiting wolf watches from the cliff until you come near, bows to you and then follows', () => {
  const player = { x: -WOLF.sight, z: 0, facing: 0, vx: 0, vz: 0 };
  const wolf = createWolf({ x: 20, z: -10, ground: flat, waiting: true });
  assert.deepEqual(run(wolf, player, WOLF.notice + 3), []);
  assert.equal(wolf.state, 'watch');
  player.x = 0;
  assert.deepEqual(run(wolf, player, WOLF.bow + 0.1), ['wolf-bow', 'wolf-follow']);
  assert.ok(Math.hypot(wolf.x - 20, wolf.z + 10) < 0.3);
  run(wolf, player, 6);
  assert.ok(Math.hypot(wolf.x - player.x, wolf.z - player.z) < 3, `${wolf.x}, ${wolf.z}`);
});

test('a following wolf keeps to your other side and catches up when you run far ahead', () => {
  const player = { x: 0, z: 0, facing: 0, vx: 0, vz: 0 };
  const wolf = createWolf({ x: 0, z: 0, ground: flat });
  run(wolf, player, 4);
  assert.ok(wolf.x > 0.8 && wolf.z < -1, `${wolf.x}, ${wolf.z}`);
  player.x = 80;
  run(wolf, player, 1);
  assert.ok(Math.hypot(wolf.x - player.x, wolf.z - player.z) < 4);
});
