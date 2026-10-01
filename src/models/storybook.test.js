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
import { createStorybook, StorybookPlugin, SURFACE_KIND, STORYBOOK, STORYBOOK_FRAGMENT } from './storybook.js';

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

test('the Focus look shades smoothly, without bands, and lifts dim corners with a warm floor that fades as light rises', () => {
  const [r, g, b] = STORYBOOK.floor;
  assert.ok(r > g && g > b, 'the floor is warm');
  assert.ok(b > 0.4, 'dark wood in a dim corner stays readable');
  assert.ok(r * 1.5 / STORYBOOK.lift < 1, 'brighter light never shades darker');
  const light = STORYBOOK_FRAGMENT.slice(STORYBOOK_FRAGMENT.indexOf('vec3 storyLight'));
  assert.equal(light.match(/smoothstep/g).length, 3, 'one floor fade, one shade tint and one rim, no stepped bands');
  const [sr, sg, sb] = STORYBOOK.shadow;
  assert.ok(Math.min(sr, sg, sb) > 0.85, 'shade keeps its colour instead of turning purple');
});

test('the Focus look fills the room air with amber haze from arm\'s length, as BotW interiors do, but leaves the valley outside the window clear', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  new FreeCamera('eye', new Vector3(0, 1, -4), scene); new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  createStorybook(scene);
  const room = MeshBuilder.CreateBox('room', { size: 1 }, scene); room.material = new StandardMaterial('wall-paint', scene);
  const valley = MeshBuilder.CreateBox('valley', { size: 1 }, scene); valley.material = new StandardMaterial('seat-world-shell', scene);
  scene.render();
  const keys = Object.keys(engine._compiledEffects);
  assert.equal(keys.filter(key => key.includes('#define STORYHAZE')).length, 1);
  const [r, g, b] = STORYBOOK.haze.color;
  const { amount, near } = STORYBOOK.haze;
  assert.ok(r > g && g > b, 'the haze is amber');
  assert.ok(amount >= 0.4 && amount <= 0.5 && near <= 0.5, `the haze veils the room at ${amount} from ${near} m without becoming fog`);
  engine.dispose();
});
