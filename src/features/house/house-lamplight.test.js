import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { glowOf, lampAt, lamplight, warmRoom } from './house-lamplight.js';
import { houseFurniture } from './house-furniture.js';

const floor = () => ({ positions: [0, 0, 0, .5, 0, 0, 6, 0, 0], colors: new Float32Array([.5, .5, .5, 1, .5, .5, .5, 1, .5, .5, .5, 1]) });

test('only a material that really glows counts as a lamp', () => {
  assert.equal(glowOf({ emissiveColor: { r: .08, g: .08, b: .08 } }), null);
  assert.equal(glowOf(null), null);
  assert.deepEqual(glowOf({ emissiveColor: { r: .38, g: .28, b: .14 } }), [.38, .28, .14]);
});

test('a lamp sits at the middle of its glowing part and keeps a warm tint', () => {
  const lamp = lampAt([0, 1, 0, 2, 3, 4], [.4, .3, .1]);
  assert.deepEqual(lamp.at, [1, 2, 2]);
  assert.ok(lamp.tint[0] > lamp.tint[1] && lamp.tint[1] > lamp.tint[2]);
  assert.ok(lamp.power > 0 && lamp.power <= 1);
});

test('at dusk a lamp warms the floor beside it and leaves the far floor to the hearth light alone', () => {
  const lamp = lampAt([0, .4, 0, 0, .6, 0], [.4, .3, .15]), lit = floor(), bare = floor(), day = floor();
  warmRoom([lit], [lamp], 'dusk');
  warmRoom([bare], [], 'dusk');
  warmRoom([day], [lamp], 'day');
  assert.deepEqual([...day.colors], [...floor().colors]);
  assert.ok(lit.colors[0] > bare.colors[0] * 1.3, 'the floor under the lamp is not brighter');
  assert.ok(lit.colors[0] > lit.colors[1] && lit.colors[1] > lit.colors[2], 'the lamp light is not warm');
  assert.ok(lit.colors[0] > lit.colors[4], 'the pool does not fade with distance');
  assert.ok(bare.colors[0] > .5 && bare.colors[2] < .5, 'the room has no warm hearth light at dusk');
  assert.deepEqual([...lit.colors.slice(8)], [...floor().colors.slice(8)]);
  assert.ok(lamplight('rain').pool < lamplight('dusk').pool && lamplight('nowhere') === lamplight('day'));
});

test('a floor lamp baked into the house keeps its glowing shade and reports where it shines', () => {
  const context = new Proxy({}, { get: (_, key) => String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 20 }) : () => {} });
  globalThis.document ??= { addEventListener() {}, removeEventListener() {}, createElement: () => ({ width: 256, height: 256, getContext: () => context }) };
  const engine = new NullEngine(), scene = new Scene(engine), item = { id: 'lamp', type: 'floor-lamp', x: 1, z: 1, rotation: 0 };
  const brightest = parts => Math.max(...parts.flatMap(part => Array.from({ length: part.colors.length / 4 }, (_, i) => part.colors[i * 4])));
  const dusk = houseFurniture(scene, item, { style: 'retreat', origin: [0, 0, 0], theme: 'dusk' }), day = houseFurniture(scene, item, { style: 'retreat', origin: [0, 0, 0], theme: 'day' });
  assert.equal(dusk.lamps.length, 1);
  assert.ok(dusk.lamps[0].at[1] > .5 && Math.abs(dusk.lamps[0].at[0] - .43) < .2, JSON.stringify(dusk.lamps[0].at));
  assert.ok(brightest(dusk.parts) > 1.6 && brightest(dusk.parts) > brightest(day.parts) * 1.4, `${brightest(dusk.parts)} against ${brightest(day.parts)}`);
  scene.dispose(); engine.dispose();
});
