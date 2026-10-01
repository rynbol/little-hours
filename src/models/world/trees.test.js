import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWorldTrees, plantTrees, NEAR_TREES } from './trees.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { WORLD, riverDistance } from '../../core/world-terrain.js';

function flatRing(radius, step, at) {
  const n = Math.round(radius * 2 / step) + 1, positions = new Float32Array(n * n * 3), normals = new Float32Array(n * n * 3), colors = new Float32Array(n * n * 4);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -radius + i * step, z = -radius + j * step, v = i * n + j, { y, up, cover, wet } = at(x, z);
    positions.set([x, y, z], v * 3); normals.set([0, up, Math.sqrt(1 - up * up)], v * 3); colors.set([cover, wet, 0, 1], v * 4);
  }
  return { positions, normals, colors };
}

const halfForest = () => [flatRing(600, 20, x => ({ y: 10, up: 1, cover: x > 0 ? 1 : 0, wet: 0 }))];

test('forests fill canopy ground while meadows get only a few lone broadleaf trees', () => {
  const trees = plantTrees(halfForest());
  assert.equal(trees.count, 6128);
  let meadow = 0, meadowConifers = 0;
  for (let i = 0; i < trees.count; i++) {
    const d = Math.hypot(trees.x[i], trees.z[i]);
    assert.ok(d >= 25, `tree ${i} sits ${d} m from the house`);
    assert.ok(riverDistance(trees.x[i], trees.z[i]) >= WORLD.river.width * 1.4, `tree ${i} stands in the river`);
    assert.ok(Math.abs(trees.x[i]) < 600 && Math.abs(trees.z[i]) < 600, `tree ${i} is off the terrain`);
    if (trees.x[i] < -20) { meadow++; meadowConifers += trees.kind[i]; }
  }
  assert.equal(meadow, 100);
  assert.equal(meadowConifers, 0);
  assert.ok(Math.abs(trees.y[0] - (10 - 0.5 * trees.width[0])) < 1e-5);
});

test('no trees grow on steep rock or wet river banks', () => {
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0 }))]).count, 188);
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 0.5, cover: 0, wet: 0 }))]).count, 0);
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0.3 }))]).count, 0);
});

function forestScene(still) {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  const camera = new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const trees = createWorldTrees(scene, { root, still, rings: halfForest() });
  trees.setTheme(WORLD_ATMOSPHERES.day);
  return { scene, camera, trees };
}

test('four thin-instanced meshes split every tree between near models and far impostors', () => {
  const { scene, camera, trees } = forestScene(true);
  assert.deepEqual(trees.meshes.map(mesh => mesh.name), ['world-trees-broadleaf-near', 'world-trees-broadleaf-far', 'world-trees-conifer-near', 'world-trees-conifer-far']);
  const counts = () => trees.meshes.map(mesh => mesh.thinInstanceCount);
  const nearCount = (x, z) => Array.from(trees.planted.x).filter((tx, i) => (tx - x) ** 2 + (trees.planted.z[i] - z) ** 2 < NEAR_TREES * NEAR_TREES).length;
  assert.equal(counts().reduce((a, b) => a + b), trees.planted.count);
  assert.equal(counts()[0] + counts()[2], nearCount(0, 0));
  assert.ok(trees.meshes.every(mesh => mesh.alwaysSelectAsActiveMesh && !mesh.isPickable));
  camera.position.set(300, 2, 0);
  scene.render();
  assert.equal(counts()[0] + counts()[2], nearCount(300, 0));
  assert.equal(counts().reduce((a, b) => a + b), trees.planted.count);
  scene.dispose();
});

test('dusk swaps in its own foliage and a still world never advances the wind', () => {
  const { scene, trees } = forestScene(true);
  trees.setTheme(WORLD_ATMOSPHERES.dusk);
  const color = key => trees.paint._colors3[key].toHexString().toLowerCase();
  assert.equal(color('leafTop'), '#8fa04a');
  assert.equal(color('leafBack'), '#e8a050');
  assert.equal(color('sunColor'), WORLD_ATMOSPHERES.dusk.sunColor);
  assert.equal(trees.paint._floats.sunStrength, WORLD_ATMOSPHERES.dusk.sunStrength);
  trees.setTheme({ ...WORLD_ATMOSPHERES.rain });
  assert.equal(color('leafTop'), '#92c840');
  scene.render(); scene.render();
  assert.equal(trees.paint._floats.time, 0);
  scene.dispose();
});
