import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createDetail, disposeDetails, hasDetail, isDetailLoaded, loadDetails, DETAIL_SOURCES } from './detail.js';
import { SURFACE_KIND } from './storybook.js';
import { getFurniture } from '../core/catalog.js';
import { createFurniture } from './furniture.js';

const bounds = node => { const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity]; for (const mesh of node.getChildMeshes()) { mesh.computeWorldMatrix(true); const { minimumWorld, maximumWorld } = mesh.getBoundingInfo().boundingBox; minimumWorld.asArray().forEach((v, i) => { low[i] = Math.min(low[i], v); }); maximumWorld.asArray().forEach((v, i) => { high[i] = Math.max(high[i], v); }); } return [...low, ...high]; };
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

test('every detailed model keeps the size and place of the dollhouse piece it stands in for', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), types = Object.keys(DETAIL_SOURCES);
  await loadDetails(types);
  for (const type of types) {
    const piece = createFurniture(type, scene), detail = createDetail(type, scene); detail.parent = piece;
    const body = bounds(piece.metadata.body), model = bounds(detail);
    model.forEach((value, i) => assert.ok(Math.abs(value - body[i]) < 0.15, `${type} ${['left', 'bottom', 'back', 'right', 'top', 'front'][i]} is ${value.toFixed(2)}, the dollhouse piece ${body[i].toFixed(2)}`));
  }
  disposeDetails(scene); engine.dispose();
});

test('the study laptop is warm champagne with a sepia screen, in both the detailed and the dollhouse desk', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const warm = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return r > g && g > b; };
  const { palette } = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-metal').metadata;
  assert.ok(palette.includes('#b3a189') && warm('#b3a189') && !palette.includes('#777f72'), 'detailed laptop shell');
  const glow = createDetail('study-desk', scene).getChildMeshes().find(mesh => mesh.material.name === 'detail-glow');
  const colors = glow.getVerticesData('color'), tints = new Set();
  for (let i = 0; i < colors.length; i += 4) tints.add(colors[i] >= colors[i + 2] ? 'warm' : 'cool');
  assert.deepEqual([...tints], ['warm'], 'every lit part of the desk glows warm');
  const near = (colors, i) => Math.abs(colors[i] - 0xb3 / 255) + Math.abs(colors[i + 1] - 0xa1 / 255) + Math.abs(colors[i + 2] - 0x89 / 255) < 0.02;
  const shell = createFurniture('study-desk', scene).getChildMeshes().some(mesh => { const colors = mesh.getVerticesData('color'); if (colors) { for (let i = 0; i < colors.length; i += 4) if (near(colors, i)) return true; } const paint = mesh.material?.diffuseColor; return paint && near([paint.r, paint.g, paint.b], 0); });
  assert.ok(shell, 'the dollhouse laptop shares the champagne shell');
  disposeDetails(scene); engine.dispose();
});

test('the desk lamp shade glows evenly from within instead of being lit across its pleats', async () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  await loadDetails(['study-desk']);
  const layers = Object.fromEntries(createDetail('study-desk', scene).getChildMeshes().map(mesh => [mesh.material.name, mesh.metadata.palette]));
  assert.ok(layers['detail-glow'].includes('#ffd08a'), 'the shade glows');
  assert.ok(!layers['detail-paint'].includes('#d6a766'), 'no lit cloth shade is left to catch the bulb light across its pleats');
  disposeDetails(scene); engine.dispose();
});
