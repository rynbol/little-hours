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

test('a refined band adds finer grid lines so a narrow column keeps its sharp walls', () => {
  const pillar = (x, z) => Math.hypot(x - 10.3, z + 4.6) < 1.2 ? 9 : 0;
  const coarse = createGround(pillar, { half: [20, 12], step: 1, far: 60, rings: 3 });
  const fine = createGround(pillar, { half: [20, 12], step: 1, far: 60, rings: 3, refine: { x: [[8, 12.6, 0.25]], z: [[-7, -2.2, 0.25]] } });
  assert.equal(coarse.xs.length, 41 + 6);
  assert.equal(coarse.zs.length, 25 + 6);
  assert.equal(fine.xs.length, 41 + 6 + 19 - 5);
  assert.equal(fine.at(10.3, -4.6), 9);
  assert.equal(fine.at(10.3 + 1.5, -4.6), 0);
  assert.ok(coarse.at(10.3 + 0.9, -4.6) < 9);
  assert.ok([...fine.xs].every((v, i, all) => i === 0 || v > all[i - 1]));
});
