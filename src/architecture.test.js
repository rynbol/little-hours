import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createFurniture, disposeFurnitureAssets } from './furniture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { styleFurniture, designPaint } from './architecture.js';
import { getFurniture } from './catalog.js';
import { TINTS } from './tints.js';

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

test('a chosen color repaints its own piece the same way in every room design', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const hexes = root => new Set(root.getChildMeshes().filter(mesh => !mesh.metadata?.effect && !mesh.metadata?.dynamic).flatMap(mesh => {
    const colors = mesh.getVerticesData('color') || [], found = [];
    for (let i = 0; i < colors.length; i += 4) found.push(new Color3(colors[i], colors[i + 1], colors[i + 2]).toHexString().toLowerCase());
    return found;
  }));
  try {
    for (const [type, tints] of Object.entries(TINTS)) {
      assert.ok(getFurniture(type) && getFurniture(type).mount !== 'wall', `${type} is floor furniture`);
      assert.equal(new Set(tints.map(tint => tint.id)).size, tints.length, `${type} has unique color ids`);
      const other = createFurniture(type, scene), modelColors = hexes(other);
      for (const tint of tints) {
        assert.match(tint.swatch, /^#[0-9a-f]{6}$/);
        for (const hex of Object.keys(tint.paint)) assert.ok(modelColors.has(hex), `${type} ${tint.id}: the model uses ${hex}`);
        for (const style of ['retreat', 'sakura', 'cloud', 'metro']) {
          const piece = createFurniture(type, scene); styleFurniture(piece, style, tint.paint);
          const colors = hexes(piece), room = new Map(designPaint(style));
          for (const [from, to] of Object.entries(tint.paint)) assert.ok(colors.has(to), `${type} ${tint.id} in ${style} wears ${to} for ${from}`);
          // The piece's other colors still follow the room.
          for (const hex of modelColors) if (!tint.paint[hex]) assert.ok(colors.has(room.get(hex) || hex), `${type} ${tint.id} in ${style} keeps the room's ${room.get(hex) || hex}`);
          piece.dispose(false, false);
        }
      }
      assert.deepEqual(hexes(other), modelColors, 'other pieces keep the model colors');
      other.dispose(false, false);
      const next = createFurniture(type, scene); assert.deepEqual(hexes(next), modelColors, 'the reusable source stays untouched'); next.dispose(false, false);
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
