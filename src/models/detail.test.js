import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createDetail, disposeDetails, hasDetail, isDetailLoaded, loadDetails, DETAIL_SOURCES } from './detail.js';
import { SURFACE_KIND } from './storybook.js';
import { getFurniture } from '../core/catalog.js';

const extent = mesh => { mesh.computeWorldMatrix(true); const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox; return { min: minimumWorld.asArray(), max: maximumWorld.asArray() }; };

test('every detailed model belongs to a piece of furniture in the catalogue', () => {
  for (const type of Object.keys(DETAIL_SOURCES)) assert.ok(getFurniture(type), type);
  assert.equal(hasDetail('study-desk'), true);
  assert.equal(hasDetail('not-a-piece'), false);
});

test('a detailed model builds once it has loaded, in paint, metal and glow layers', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk', 'study-desk', 'not-a-piece']);
  assert.equal(isDetailLoaded('study-desk'), true);
  const desk = createDetail('study-desk', scene);
  const layers = Object.fromEntries(desk.getChildMeshes().map(mesh => [mesh.material.name, mesh]));
  assert.deepEqual(Object.keys(layers).sort(), ['detail-glow', 'detail-metal', 'detail-paint']);
  assert.equal(desk.isEnabled(false), false);
  const paint = layers['detail-paint'];
  assert.equal(paint.getVerticesData(SURFACE_KIND).length, paint.getTotalVertices());
  assert.ok(paint.getVerticesData(SURFACE_KIND).includes(9));
  assert.equal(layers['detail-glow'].metadata.castShadow, false);
  const { min, max } = extent(paint);
  assert.ok(max[0] - min[0] > 2.9 && max[0] - min[0] < 3.2, `desk is ${max[0] - min[0]} wide`);
  assert.ok(min[1] > -0.01 && min[1] < 0.05, `legs reach ${min[1]}`);
  disposeDetails(scene); engine.dispose();
});

test('a room design repaints only the parts cut from the colour it replaces', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const plain = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const painted = createDetail('study-desk', scene, [{ from: '#83968a', to: '#b98770' }]).getChildMeshes().find(mesh => mesh.material.name === 'detail-paint');
  const { slots, palette } = plain.metadata, sage = palette.indexOf('#83968a'), wood = palette.indexOf('#aa7954');
  const before = plain.getVerticesData('color'), after = painted.getVerticesData('color');
  const cushion = slots.indexOf(sage), top = slots.indexOf(wood);
  assert.ok(after[cushion * 4] > before[cushion * 4] * 1.2, 'the sage cushion turns rose');
  assert.deepEqual([...after.slice(top * 4, top * 4 + 4)], [...before.slice(top * 4, top * 4 + 4)]);
  assert.notEqual(plain.geometry, painted.geometry);
  disposeDetails(scene); engine.dispose();
});

test('nothing is built for a model that has not loaded', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  assert.equal(createDetail('bookcase', scene), null);
  engine.dispose();
});
