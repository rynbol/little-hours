import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { rainShape, createIslandRain, RAIN_STREAKS } from './house-rain.js';

test('rain is one mesh of thin streaks spread across the whole view, near and far', () => {
  const { positions, uvs, indices } = rainShape();
  assert.equal(positions.length, RAIN_STREAKS * 12);
  assert.equal(indices.length, RAIN_STREAKS * 6);
  const across = [], near = [];
  for (let i = 0; i < positions.length; i += 12) { across.push(positions[i]); near.push(positions[i + 1]); }
  for (let tenth = 0; tenth < 10; tenth++) assert.ok(across.some(x => x >= tenth / 10 && x < (tenth + 1) / 10), `no rain falls in tenth ${tenth} of the view`);
  assert.ok(Math.min(...near) < .05 && Math.max(...near) > .8, 'every streak is the same distance away');
  assert.deepEqual(uvs.slice(0, 8), [-1, 0, 1, 0, 1, 1, -1, 1]);
});

test('rain falls only in the rain theme and never joins the shadow pass', () => {
  const scene = new Scene(new NullEngine()), rain = createIslandRain(scene, 'day');
  assert.equal(rain.mesh.isEnabled(), false);
  rain.setTheme('rain'); assert.equal(rain.mesh.isEnabled(), true);
  rain.setTheme('dusk'); assert.equal(rain.mesh.isEnabled(), false);
  assert.equal(rain.mesh.metadata.castShadow, false);
  assert.equal(scene.meshes.length, 1);
  rain.dispose();
  assert.equal(scene.meshes.length, 0);
});
