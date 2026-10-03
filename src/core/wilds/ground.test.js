import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGround } from './ground.js';
import { heightAt } from '../world-terrain.js';

test('the feel box ground follows the valley slope closely where you play and reaches the horizon', () => {
  const ground = createGround(heightAt, { centre: [0, -14] });
  assert.equal(ground.at(0, 0), 0);
  let worst = 0;
  for (let x = -30; x <= 30; x += 0.37) for (let z = -44; z <= 16; z += 0.41) worst = Math.max(worst, Math.abs(ground.at(x, z) - heightAt(x, z)));
  assert.ok(worst < 0.06, `off by ${worst.toFixed(3)} m`);
  assert.ok(ground.xs.at(-1) > 800 && ground.zs[0] < -800);
  assert.equal(Math.round(ground.at(0, -30) * 10) / 10, Math.round(heightAt(0, -30) * 10) / 10);
});

test('the ground sampler matches the two triangles of each grid cell', () => {
  const ground = createGround((x, z) => (x > 0.5 ? 1 : 0) + (z > 0.5 ? 2 : 0), { half: 1, step: 1, far: 4, rings: 1 });
  assert.equal(ground.at(0.75, 0.25), 0.75 + 0.25 * 2);
  assert.equal(ground.at(0.25, 0.75), 0.75 * 2 + 0.25);
});
