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
import { Effect } from '@babylonjs/core/Materials/effect.js';
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

test('from the chair the room falls off away from the desk: arm\'s reach keeps its light, and far corners settle deeper and a little cooler instead of lifting to the haze', () => {
  const { falloff, haze } = STORYBOOK;
  const smooth = (from, to, x) => { const t = Math.min(1, Math.max(0, (x - from) / (to - from))); return t * t * (3 - 2 * t); };
  const seen = (wall, distance) => wall.map((channel, i) => { const fallen = channel * (1 + (falloff.color[i] - 1) * smooth(falloff.near, falloff.far, distance)); return fallen + (haze.color[i] - fallen) * haze.amount * smooth(haze.near, haze.far, distance); });
  const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b, warmth = ([r, , b]) => r / b;
  const plaster = [0.62, 0.5, 0.34], desk = seen(plaster, 1.0), corner = seen(plaster, 5.0);
  assert.ok(falloff.near >= 1.2, 'nothing within reach of the chair falls off');
  assert.ok(luma(desk) > luma(plaster) * 0.97, `the desk keeps ${luma(desk).toFixed(3)} of ${luma(plaster).toFixed(3)}`);
  assert.ok(luma(corner) < luma(plaster) * 0.85 && luma(corner) > luma(plaster) * 0.65, `far corners settle to ${(luma(corner) / luma(plaster)).toFixed(2)} of the wall, deeper but still lifted`);
  assert.ok(warmth(corner) < warmth(plaster) * 0.95, 'far corners cool a little');
  const [r, g, b] = falloff.color;
  assert.ok(b > g && g > r, 'the falloff leans cool');
  const code = new StorybookPlugin(new StandardMaterial('wall', new Scene(new NullEngine())), { amount: 1 }).getCustomCode('fragment').CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR;
  assert.ok(code.indexOf('color.rgb*=mix(vec3(1.0),') > 0 && code.indexOf('color.rgb*=mix(vec3(1.0),') < code.indexOf('color.rgb=mix(color.rgb,'), 'the falloff darkens before the haze veils');
});

test('from the chair, wood shows painted grain: long uneven fibres that follow the board over a slow figure, never evenly repeating rings, and stand upright on side faces', () => {
  const { along, across, depth, tone, waver } = STORYBOOK.grain;
  const wood = STORYBOOK_FRAGMENT.slice(STORYBOOK_FRAGMENT.indexOf('vec3 storyWood'), STORYBOOK_FRAGMENT.indexOf('vec3 storySurface'));
  assert.doesNotMatch(wood, /fract\(/, 'grain comes from noise, not a ring that repeats at a fixed pitch');
  assert.ok(across / along >= 15 && across >= 40, `fibres run ${(across / along).toFixed(0)} times longer along the board than across it`);
  assert.ok(depth >= 0.1 && depth <= 0.2 && tone > 0.08 && tone < 0.2, 'fibres are dark enough to read and the board drifts in tone without turning into stripes');
  assert.ok(waver > 0 && waver < 0.05, 'fibres waver a little');
  assert.match(wood, /abs\(n\.x\) > 0\.7 \? p\.yxz : p/, 'a face turned sideways runs its grain upright');
  assert.match(STORYBOOK_FRAGMENT, /if \(code > 8\.5\) return storyWood\(p, n\);/);
  const engine = new NullEngine(), scene = new Scene(engine), state = { amount: 1 };
  const code = new StorybookPlugin(new StandardMaterial('desk', scene), state).getCustomCode('fragment');
  assert.ok(Object.values(code).some(text => text.includes('storySurface(vStorySurface,vPositionW,normalW)')), 'the surface pattern sees each face\'s normal');
  engine.dispose();
});

test('the room air takes its colour and strength from the weather on a theme change, without compiling a new shader', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  new FreeCamera('eye', new Vector3(0, 1, -4), scene); new HemisphericLight('sky', new Vector3(0, 1, 0), scene);
  const storybook = createStorybook(scene);
  const wall = MeshBuilder.CreateBox('wall', { size: 1 }, scene); wall.material = new StandardMaterial('wall-paint', scene);
  const sent = [], send = Effect.prototype.setFloat4;
  Effect.prototype.setFloat4 = function (name, ...values) { if (name === 'storyHaze') sent.push(values.map(value => Number(value.toFixed(3)))); return send.call(this, name, ...values); };
  try {
    scene.render();
    const compiled = Object.keys(engine._compiledEffects).length;
    storybook.haze = { color: [0.2, 0.3, 0.4], amount: 0.6 };
    scene.render();
    assert.deepEqual(sent[0], [0.52, 0.45, 0.36, 0.42], 'the room starts in amber air');
    assert.deepEqual(sent.at(-1), [0.2, 0.3, 0.4, 0.6]);
    assert.equal(Object.keys(engine._compiledEffects).length, compiled);
  } finally { Effect.prototype.setFloat4 = send; engine.dispose(); }
});
