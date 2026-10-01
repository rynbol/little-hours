import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createFurniture, disposeFurnitureAssets, leafClump, LEAF_OUTLINE, MOON_CANOPY } from './furniture.js';
import { FURNITURE } from '../core/catalog.js';

test('moon tree clumps are soft rounded leaf cards, lit fresh green on top and cool beneath, without speckled tones', () => {
  const engine = new NullEngine(), scene = new Scene(engine), leaves = 120;
  const clump = leafClump(new TransformNode('tree', scene), [0, 2, 0], [0.25, 0.18, 0.25], 3, leaves);
  const colors = clump.getVerticesData('color'), normals = clump.getVerticesData('normal'), cardStart = colors.length / 4 - leaves * LEAF_OUTLINE.length;
  assert.ok(LEAF_OUTLINE.length >= 6, 'a leaf card has a rounded outline, not a diamond');
  const neighbours = [];
  for (let a = 0; a < leaves; a++) for (let b = a + 1; b < leaves; b++) {
    const [va, vb] = [a, b].map(card => cardStart + card * LEAF_OUTLINE.length);
    const facing = [0, 1, 2].reduce((sum, i) => sum + normals[va * 3 + i] * normals[vb * 3 + i], 0);
    if (facing > 0.995) neighbours.push(Math.max(...[0, 1, 2].map(i => Math.abs(colors[va * 4 + i] - colors[vb * 4 + i]))));
  }
  assert.ok(neighbours.length > 0 && Math.max(...neighbours) < 0.03, `neighbouring cards differ by up to ${Math.max(...neighbours).toFixed(3)}`);
  const hue = hex => Color3.FromHexString(hex).toHSV().r;
  const value = hex => Color3.FromHexString(hex).toHSV().b;
  assert.ok(hue(MOON_CANOPY.top) > 80 && hue(MOON_CANOPY.top) < 110 && hue(MOON_CANOPY.rim) < hue(MOON_CANOPY.top), 'the lit top is a fresh leaf green with warmer sunlit tips');
  assert.ok(value(MOON_CANOPY.top) > 0.85, 'the lit top is bright enough to read as sunlit from the chair');
  assert.ok(hue(MOON_CANOPY.under) > 160, 'the underside is a cool blue-green');
  assert.ok(value(MOON_CANOPY.under) / value(MOON_CANOPY.top) < 0.5, 'the underside sits well below the lit top');
  engine.dispose();
});

test('moon tree leaf tips curl back into the clump, so its outline is a soft mound instead of a burst of points', () => {
  const engine = new NullEngine(), scene = new Scene(engine), leaves = 110, center = [0, 2, 0], radii = [0.25, 0.18, 0.25];
  const clump = leafClump(new TransformNode('tree', scene), center, radii, 3, leaves);
  const positions = clump.getVerticesData('position'), count = positions.length / 3, cardStart = count - leaves * LEAF_OUTLINE.length, tip = LEAF_OUTLINE.findIndex(([u]) => u === 1);
  const reach = [];
  for (let card = 0; card < leaves; card++) {
    const v = cardStart + card * LEAF_OUTLINE.length + tip;
    reach.push(Math.hypot(...[0, 1, 2].map(i => (positions[v * 3 + i] - center[i]) / radii[i])));
  }
  reach.sort((a, b) => a - b);
  assert.ok(reach[Math.floor(reach.length * 0.9)] < 1.05, `leaf tips reach ${reach[Math.floor(reach.length * 0.9)].toFixed(3)} of the clump radius`);
  engine.dispose();
});

test('moon tree leaf cards shade by where each corner sits on the clump, so touching cards blend into one soft mass', () => {
  const engine = new NullEngine(), scene = new Scene(engine), leaves = 110;
  const clump = leafClump(new TransformNode('tree', scene), [0, 2, 0], [0.25, 0.18, 0.25], 3, leaves);
  const positions = clump.getVerticesData('position'), colors = clump.getVerticesData('color'), count = colors.length / 4, cardStart = count - leaves * LEAF_OUTLINE.length;
  const card = v => Math.floor((v - cardStart) / LEAF_OUTLINE.length), seams = [];
  for (let a = cardStart; a < count; a++) for (let b = a + 1; b < count; b++) {
    if (card(a) === card(b) || Math.hypot(...[0, 1, 2].map(i => positions[a * 3 + i] - positions[b * 3 + i])) > 0.012) continue;
    seams.push(Math.max(...[0, 1, 2].map(i => Math.abs(colors[a * 4 + i] - colors[b * 4 + i]))));
  }
  seams.sort((x, y) => x - y);
  assert.ok(seams.length > 20, `${seams.length} touching corners`);
  assert.ok(seams[Math.floor(seams.length * 0.95)] < 0.04, `touching cards differ by up to ${seams[Math.floor(seams.length * 0.95)].toFixed(3)} at the 95th percentile`);
  engine.dispose();
});

test('animated furniture streams its moving vertices without making any material rebuild its shader setup each frame', () => {
  const engine = new NullEngine(), scene = new Scene(engine), rebuilt = [], moved = [];
  try {
    for (const { id } of FURNITURE) {
      const item = createFurniture(id, scene);
      if (!item.metadata?.animate) { item.dispose(); continue; }
      item.metadata.animate(1, false, false, 0);
      const meshes = item.getChildMeshes(false).filter(mesh => mesh.subMeshes?.length && mesh.material);
      for (const mesh of meshes) for (const subMesh of mesh.subMeshes) subMesh.getMaterial()?.isReadyForSubMesh(mesh, subMesh);
      const before = meshes.map(mesh => Array.from(mesh.getVerticesData('position') ?? []));
      item.metadata.animate(1.7, false, false, 0); item.metadata.animate(2.3, false, false, 0);
      meshes.forEach((mesh, i) => {
        if (mesh.subMeshes.some(subMesh => subMesh.materialDefines?.isDirty)) rebuilt.push(`${id}/${mesh.name}`);
        if (before[i].some((value, k) => value !== mesh.getVerticesData('position')[k])) moved.push(`${id}/${mesh.name}`);
      });
      item.dispose();
    }
    assert.ok(moved.length >= 3, `animated pieces moved: ${moved.join(', ')}`);
    assert.deepEqual(rebuilt, []);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
