import assert from 'node:assert/strict';
import test from 'node:test';
import { ambience, createStride, stride, surfaceUnder } from './sound.js';
import { VALLEY, valleyHeight, waterAt } from './valley.js';

const world = { ground: valleyHeight, water: waterAt };
const standing = (x, z, lift = 0) => ({ x, z, y: valleyHeight(x, z) + lift });

test('footsteps sound like the ground underfoot: water when wading, stone on rocks, dirt on the trail, grass elsewhere', () => {
  assert.equal(surfaceUnder(standing(5, -200), world), 'water');
  assert.equal(surfaceUnder(standing(VALLEY.pillar.x, VALLEY.pillar.z, VALLEY.pillar.top + 1), world), 'stone');
  assert.equal(surfaceUnder(standing(3, 18), world), 'dirt');
  assert.equal(surfaceUnder(standing(-25, 10), world), 'grass');
});

test('a footfall lands once per stride, strides lengthen with speed, and none fall in the air', () => {
  const walk = createStride(), run = createStride();
  for (let i = 0; i < 100; i++) { stride(walk, 0.1, 2, true); stride(run, 0.1, 7, true); }
  assert.equal(walk.steps, 14);
  assert.equal(run.steps, 8);
  const air = createStride();
  for (let i = 0; i < 100; i++) stride(air, 0.1, 7, false);
  assert.equal(air.steps, 0);
});

test('birds sing by day, crickets by night, the shower is heard, and water grows louder as you near it', () => {
  const noon = ambience(13, 0, 36), night = ambience(23, 0, 36), shower = ambience(16.7, 0, 36);
  assert.ok(noon.birds > 0.95 && noon.crickets === 0, JSON.stringify(noon));
  assert.ok(night.crickets > 0.95 && night.birds === 0, JSON.stringify(night));
  assert.ok(shower.rain > 0.95 && shower.wind > noon.wind && shower.crickets === 0 && shower.birds < 0.2, JSON.stringify(shower));
  assert.equal(noon.rain, 0);
  assert.ok(ambience(13, -44, -124).stream > 0.9 && ambience(13, -44, -150).stream < 0.2 && noon.stream === 0);
  assert.ok(ambience(13, -70, -122).falls > 0.6 && noon.falls === 0);
});
