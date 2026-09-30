import test from 'node:test';
import assert from 'node:assert/strict';
import { smokeShape, SMOKE_PUFFS, SMOKE_TONES } from './house-smoke.js';

test('the plume is one mesh of camera-facing puffs spread evenly through their lives', () => {
  const { positions, uvs, uv2s, indices } = smokeShape();
  assert.equal(positions.length, SMOKE_PUFFS * 12);
  assert.equal(indices.length, SMOKE_PUFFS * 6);
  const seeds = [...new Set(uv2s.filter((_, i) => i % 2 === 0))].sort((a, b) => a - b);
  assert.equal(seeds.length, SMOKE_PUFFS);
  seeds.forEach((seed, i) => assert.ok(Math.abs(seed - i / SMOKE_PUFFS) < 1e-9, `puff ${i} starts at ${seed}`));
  assert.deepEqual(uvs.slice(0, 8), [-1, -1, 1, -1, 1, 1, -1, 1]);
});

test('smoke is lighter on its sunward side in every theme', () => {
  const light = hex => [1, 3, 5].reduce((sum, at) => sum + parseInt(hex.slice(at, at + 2), 16), 0);
  for (const [theme, { lit, shade }] of Object.entries(SMOKE_TONES)) assert.ok(light(lit) > light(shade), `${theme} smoke has no shaded side`);
});
