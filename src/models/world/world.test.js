import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createOutdoorWorld } from './world.js';
import { WORLD_ATMOSPHERES, worldAtmosphere } from './atmosphere.js';

test('every world theme sets the same lighting and palette with the sun above the horizon', () => {
  const keys = Object.keys(WORLD_ATMOSPHERES.day).sort();
  for (const [name, theme] of Object.entries(WORLD_ATMOSPHERES)) {
    assert.deepEqual(Object.keys(theme).sort(), keys, name);
    assert.ok(Math.abs(Math.hypot(...theme.sun) - 1) < 1e-9 && theme.sun[1] > 0, `${name} sun`);
  }
  assert.equal(worldAtmosphere('unknown'), WORLD_ATMOSPHERES.day);
});

test('the outdoor world builds terrain rings and a sky that switch theme together', () => {
  const scene = new Scene(new NullEngine()), world = createOutdoorWorld(scene, { theme: 'day' });
  assert.deepEqual(world.terrain.map(mesh => mesh.name), ['world-terrain-0', 'world-terrain-1', 'world-terrain-2', 'world-terrain-3']);
  assert.ok(world.terrain.every(mesh => mesh.getTotalVertices() > 20000));
  assert.equal(world.sky.infiniteDistance, true);
  const terrainPaint = world.terrain[0].material, skyPaint = world.sky.material;
  world.setTheme('dusk');
  assert.equal(world.atmosphere, WORLD_ATMOSPHERES.dusk);
  assert.equal(terrainPaint._colors3.grass.toHexString().toLowerCase(), '#6a8a3a');
  assert.equal(skyPaint._colors3.horizon.toHexString().toLowerCase(), '#f0b67c');
  assert.equal(skyPaint._vectors3.sun.y, WORLD_ATMOSPHERES.dusk.sun[1]);
  world.dispose();
  assert.equal(scene.meshes.length, 0);
});
