import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { buildGroveField, createGroveLight } from './grove-light.js';
import { createTerrainPaint } from './terrain-paint.js';
import { createWorldGrass, grassBlades } from './grass.js';
import { WILDS_WORLD } from '../../core/wilds/world-definition.js';
import { wildsAtmosphere } from '../wilds/world.js';

const trees = { count: 1, x: [0], z: [0], y: [-.5], width: [1], height: [1], kind: [0], turn: [0] };
const definition = { ...WILDS_WORLD, trees: { ...WILDS_WORLD.trees, canopyShade: 0 }, rocks: [], landmarks: [] };
const flat = () => ({ height: 0 });
const pixel = (field, x, z) => {
  const i = Math.floor((x - field.minX) / field.span * field.texels), j = Math.floor((z - field.minZ) / field.span * field.texels);
  return Array.from(field.data.slice((j * field.texels + i) * 4, (j * field.texels + i) * 4 + 4));
};
const settled = async grove => {
  for (let i = 0; i < 200 && grove.diagnostics().pending; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(grove.diagnostics().pending, false);
};

test('the planted tree casts shade away from the sun while root contact stays at its actual base', () => {
  const options = { trees, definition, atmosphere: { sun: [.6, .8, 0], theme: 'day' }, surface: flat, texels: 128, span: 32 };
  const eastSun = buildGroveField(options), westSun = buildGroveField({ ...options, atmosphere: { sun: [-.6, .8, 0], theme: 'day' } });
  assert.deepEqual(pixel(eastSun, 0, 0), [255, 51, 186, 0]);
  assert.deepEqual(pixel(eastSun, -5, 0), [83, 255, 255, 0]);
  assert.deepEqual(pixel(eastSun, 5, 0), [255, 255, 255, 0]);
  assert.deepEqual(pixel(westSun, -5, 0), [255, 255, 255, 0]);
  assert.deepEqual(pixel(westSun, 5, 0), [83, 255, 255, 0]);
  assert.deepEqual(pixel(westSun, 0, 0).slice(1, 3), [51, 186]);
  assert.deepEqual(pixel(eastSun, 12, 12), [255, 255, 255, 146]);
});

test('removing the tree removes its shadows without changing the forest-region albedo map', () => {
  const options = { definition, atmosphere: { sun: [.6, .8, 0], theme: 'day' }, surface: flat, texels: 128, span: 32 };
  const planted = buildGroveField({ ...options, trees }), empty = buildGroveField({ ...options, trees: { count: 0 } });
  assert.deepEqual(pixel(planted, -5, 0), [83, 255, 255, 0]);
  assert.deepEqual(pixel(empty, -5, 0), [255, 255, 255, 0]);
  assert.deepEqual(pixel(empty, 0, 0), [255, 255, 255, 0]);
  for (let i = 3; i < planted.data.length; i += 4) assert.equal(planted.data[i], empty.data[i]);
});

test('terrain, grass, and rocks share one field and a camera-boundary refresh swaps every receiver together', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), root = new TransformNode('world', scene), atmosphere = wildsAtmosphere('day');
  const grove = createGroveLight(scene, { definition, atmosphere, surface: flat });
  try {
    const terrain = createTerrainPaint(scene, { definition, grove, still: true });
    const grass = createWorldGrass(scene, { root, atmosphere, definition, grove, surface: flat, still: true, blades: grassBlades([{ period: 16, blades: 3, tuft: true }]) });
    for (const step of grove.setTrees(trees)) void step;
    const receivers = [terrain.paint, grass.mesh.material, grass.rocks.material];
    const texture = terrain.paint._textures.groveField;
    assert.equal(texture.name, 'world-grove-light');
    assert.equal(receivers.every(paint => paint._textures.groveField === texture), true);
    assert.equal(scene.textures.filter(item => item.name === 'world-grove-light').length, 1);
    assert.deepEqual(terrain.paint._vectors4.groveBounds.asArray(), [-96, -96, 192, 1]);
    grove.follow(39, 0);
    assert.deepEqual(grove.diagnostics(), { center: { x: 0, z: 0 }, pending: false, painted: 1, texels: 512, span: 192 });
    grove.follow(41, 0);
    assert.equal(grove.diagnostics().pending, true);
    assert.deepEqual(terrain.paint._vectors4.groveBounds.asArray(), [-96, -96, 192, 1]);
    await settled(grove);
    assert.deepEqual(grove.diagnostics().center, { x: 48, z: 0 });
    for (const paint of receivers) {
      assert.equal(paint._textures.groveField, texture);
      assert.deepEqual(paint._vectors4.groveBounds.asArray(), [-48, -96, 192, 1]);
    }
    const painted = grove.diagnostics().painted;
    grove.setTheme(wildsAtmosphere('dusk'));
    assert.equal(grove.diagnostics().pending, true);
    await settled(grove);
    assert.equal(grove.diagnostics().painted, painted + 1);
    grove.follow(100, 0);
    assert.equal(grove.diagnostics().pending, true);
    const beforeDispose = grove.diagnostics().painted;
    grove.dispose();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(grove.diagnostics().pending, false);
    assert.equal(grove.diagnostics().painted, beforeDispose);
    assert.equal(scene.textures.includes(texture), false);
  } finally { grove.dispose(); scene.dispose(); engine.dispose(); }
});


test('canopy shelter connects shaded ground beneath a tree while open ground retains direct light', () => {
  const sheltered = { ...definition, trees: { ...definition.trees, canopyShade: .32 } };
  const options = { trees, definition: sheltered, atmosphere: { sun: [.6, .8, 0], theme: 'day' }, surface: flat, texels: 128, span: 32 };
  const day = buildGroveField(options), rain = buildGroveField({ ...options, atmosphere: { sun: [.6, .8, 0], theme: 'rain' } });
  assert.deepEqual(pixel(day, 2, 0), [173, 255, 105, 0]);
  assert.deepEqual(pixel(rain, 2, 0), [206, 255, 105, 0]);
  assert.deepEqual(pixel(day, 12, 12), [255, 255, 255, 146]);
  assert.deepEqual(pixel(rain, 12, 12), [255, 255, 255, 146]);
});
