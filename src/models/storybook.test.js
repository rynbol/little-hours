import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { ShaderStore } from '@babylonjs/core/Engines/shaderStore.js';
import '@babylonjs/core/Shaders/default.fragment.js';
import { createStorybook, StorybookPlugin, SURFACE_KIND } from './storybook.js';

test('the storybook light hook finds every place the standard shader mixes its diffuse light', () => {
  const source = ShaderStore.ShadersStore.defaultPixelShader;
  const code = new StorybookPlugin(new StandardMaterial('probe', new Scene(new NullEngine())), { amount: 0 }).getCustomCode('fragment');
  const hook = Object.keys(code).find(key => key.startsWith('!'));
  assert.equal(source.match(new RegExp(hook.slice(1), 'g')).length, 3);
});

test('every lit room material wears the storybook look, which stays off until the chair asks for it', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const before = new StandardMaterial('before', scene);
  const storybook = createStorybook(scene);
  const after = new StandardMaterial('after', scene);
  assert.ok(before.pluginManager.getPlugin('Storybook'));
  assert.ok(after.pluginManager.getPlugin('Storybook'));
  assert.equal(storybook.amount, 0);
  storybook.amount = 3; assert.equal(storybook.amount, 1);
  storybook.amount = -1; assert.equal(storybook.amount, 0);
  storybook.dispose();
  assert.equal(new StandardMaterial('later', scene).pluginManager?.getPlugin('Storybook') ?? null, null);
  engine.dispose();
});

test('only meshes that carry surface codes compile the surface variant', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  new FreeCamera('eye', new Vector3(0, 1, -4), scene); new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  createStorybook(scene);
  const paint = new StandardMaterial('paint', scene);
  const plain = MeshBuilder.CreateBox('plain', { size: 1 }, scene); plain.material = paint;
  const carved = MeshBuilder.CreateBox('carved', { size: 1 }, scene); carved.material = paint;
  carved.setVerticesData(SURFACE_KIND, new Float32Array(carved.getTotalVertices()).fill(9), false, 1);
  scene.render();
  const keys = Object.keys(engine._compiledEffects);
  assert.equal(keys.filter(key => key.includes('#define STORYSURFACE')).length, 1);
  assert.equal(keys.filter(key => !key.includes('#define STORYSURFACE')).length, 1);
  engine.dispose();
});
