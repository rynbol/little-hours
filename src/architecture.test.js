import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createFurniture, disposeFurnitureAssets } from './furniture.js';
import { styleFurniture } from './architecture.js';

test('design palettes change furniture without recoloring avatars or shared original templates', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const colors = root => root.getChildMeshes().map(mesh => Array.from(mesh.getVerticesData('color') || []));
  try {
    for (const type of ['study-desk', 'bookcase', 'daybed']) {
      const original = createFurniture(type, scene), baseline = colors(original);
      for (const style of ['sakura', 'cloud', 'metro']) {
        const themed = createFurniture(type, scene), avatar = themed.metadata.avatar, beforeAvatar = avatar && colors(avatar);
        const meshCount = scene.meshes.length, materialCount = scene.materials.length;
        styleFurniture(themed, style);
        assert.notDeepEqual(colors(themed), baseline, `${style} changes the ${type} palette`);
        assert.deepEqual(colors(original), baseline, 'other instances keep their original colors');
        if (avatar) assert.deepEqual(colors(avatar), beforeAvatar, 'the companion keeps its identity');
        assert.equal(scene.meshes.length, meshCount); assert.equal(scene.materials.length, materialCount);
        themed.dispose(false, false);
      }
      const next = createFurniture(type, scene); assert.deepEqual(colors(next), baseline, 'the reusable source stays untouched');
      original.dispose(false, false); next.dispose(false, false);
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
