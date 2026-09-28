import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createPetGift } from './pet-gift-model.js';

test('earned gifts have bounded physical geometry and switch without adding render objects', () => {
  const engine = new NullEngine(), scene = new Scene(engine), gift = createPetGift(scene), shapes = new Set();
  for (const id of ['daisy', 'star', 'moon', 'daisy']) {
    gift.select(id); assert.equal(gift.selected, id); assert.equal(gift.mesh.isEnabled(), true);
    assert.equal(scene.meshes.length, 1); assert.equal(scene.materials.length, 1);
    const positions = gift.mesh.getVerticesData('position'), normals = gift.mesh.getVerticesData('normal');
    assert.ok(positions.length > 30 && positions.every(Number.isFinite)); assert.ok(normals.every(Number.isFinite));
    assert.equal(positions.length, normals.length); assert.ok(gift.mesh.getIndices().every(i => i < positions.length / 3));
    for (let i = 0; i < positions.length; i += 3) { assert.ok(Math.abs(positions[i]) < .3 && Math.abs(positions[i + 2]) < .3); assert.ok(positions[i + 1] >= -.001 && positions[i + 1] < .7); }
    shapes.add(positions.length);
  }
  assert.equal(shapes.size, 3); gift.select(null); assert.equal(gift.mesh.isEnabled(), false);
  gift.dispose(); assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0); scene.dispose(); engine.dispose();
});
