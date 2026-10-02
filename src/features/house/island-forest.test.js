import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { onIsland } from './house-island.js';
import { ISLAND_SUN } from './island-atmosphere.js';
import { TREE_FORMS } from '../../models/world/trees.js';
import {
  FOREST_PATH, FOREST_PATH_WIDTH, FOREST_TRAILHEAD, buildForestEdge, createIslandForest, forestAtmosphere, forestPathDistance, groveMatrices, grove, onForest, groveBounds,
} from './island-forest.js';

test('the grove grows on the new forest lobe, off the lawn and clear of the path', () => {
  const trees = grove();
  assert.equal(trees.length, 34);
  for (const { x, z } of trees) {
    assert.ok(onForest(x, z, .4), `${x}, ${z} is off the forest`);
    assert.equal(onIsland(x, z, -.25), false, `${x}, ${z} stands on the lawn`);
    assert.ok(forestPathDistance(x, z) > FOREST_PATH_WIDTH / 2, `${x}, ${z} blocks the path`);
  }
  assert.deepEqual(Object.values(TREE_FORMS).map(form => trees.filter(tree => tree.form === form).length), [12, 13, 9]);
});

test('the canopy steps up from low spreading trees at the lawn to tall conifers at the back', () => {
  const depth = form => { const trees = grove().filter(tree => tree.form === form); return trees.reduce((sum, { z }) => sum - z, 0) / trees.length; };
  assert.ok(depth(TREE_FORMS.spreading) < depth(TREE_FORMS.broadleaf) && depth(TREE_FORMS.broadleaf) < depth(TREE_FORMS.conifer));
  const size = form => Math.max(...grove().filter(tree => tree.form === form).map(tree => tree.size));
  assert.ok(size(TREE_FORMS.conifer) > size(TREE_FORMS.spreading));
});

test('the trailhead stands at the end of the path, inside the forest edge, facing into the trees', () => {
  const { position: [x, y, z], facing: [fx, fy, fz] } = FOREST_TRAILHEAD;
  assert.deepEqual([x, z], FOREST_PATH.at(-1));
  assert.ok(onForest(x, z, .4));
  assert.equal(onIsland(x, z), false);
  assert.ok(y > -.2 && y < .1);
  assert.equal(fy, 0);
  assert.ok(Math.abs(Math.hypot(fx, fz) - 1) < 1e-9);
  assert.ok(onForest(x + fx * 1.5, z + fz * 1.5, .4), 'the trail continues into the woods');
  assert.ok(grove().every(tree => Math.hypot(tree.x - x - fx * .8, tree.z - z - fz * .8) > .5), 'the way through the threshold is open');
});

test('from the home view no tree crown stands between the camera and the trailhead', () => {
  const { position: [x, , z] } = FOREST_TRAILHEAD, view = [Math.cos(Math.PI / 2.8), Math.sin(Math.PI / 2.8)];
  for (const tree of grove()) {
    const dx = tree.x - x, dz = tree.z - z, along = dx * view[0] + dz * view[1], side = Math.abs(dx * view[1] - dz * view[0]);
    assert.ok(along < 0 || along > 4 || side > tree.crown * .8 + FOREST_PATH_WIDTH / 2, `tree at ${tree.x}, ${tree.z} hides the trailhead`);
  }
});

test('the forest path leaves the cottage grounds and ends inside the trees', () => {
  assert.ok(onIsland(...FOREST_PATH[0], .3));
  assert.equal(onForest(...FOREST_PATH[0]), false);
  assert.ok(onForest(...FOREST_PATH.at(-1), .4));
  assert.equal(onIsland(...FOREST_PATH.at(-1)), false);
  for (const [x, z] of FOREST_PATH) assert.ok(onIsland(x, z, .2) || onForest(x, z, .2), `the path leaves the ground at ${x}, ${z}`);
  assert.ok(FOREST_PATH.some(([x, z]) => onIsland(x, z) && onForest(x, z)), 'the forest lobe overlaps the lawn');
});

test('each tree form gets one placed matrix per tree, standing on the forest floor', () => {
  for (const form of Object.values(TREE_FORMS)) {
    const trees = grove().filter(tree => tree.form === form), matrices = groveMatrices(form);
    assert.equal(matrices.length, trees.length * 16);
    trees.forEach((tree, i) => assert.deepEqual([matrices[i * 16 + 12], matrices[i * 16 + 14]].map(v => +v.toFixed(3)), [tree.x, tree.z].map(v => +v.toFixed(3))));
  }
  assert.equal(groveBounds().length, grove().length * 12);
});

test('the grove is lit by the island sun, not the valley sun', () => {
  const [x, y, z] = ISLAND_SUN.direction, l = Math.hypot(x, y, z);
  for (const theme of ['day', 'dusk', 'rain']) {
    const air = forestAtmosphere(theme);
    assert.deepEqual(air.sun.map(v => +v.toFixed(4)), [-x / l, -y / l, -z / l].map(v => +v.toFixed(4)));
    assert.equal(air.fogDensity, 0);
  }
  assert.notEqual(forestAtmosphere('dusk').leafTop, forestAtmosphere('day').leafTop);
});

test('the grove draws as one thin-instanced mesh per tree form and hides on demand', () => {
  const engine = new NullEngine(), scene = new Scene(engine), forest = createIslandForest(scene, 'dusk');
  assert.deepEqual(forest.meshes.map(mesh => mesh.thinInstanceCount), [12, 13, 9]);
  assert.equal(new Set(forest.meshes.map(mesh => mesh.material)).size, 1);
  forest.animate(3);
  forest.setTheme('rain');
  forest.setEnabled(false);
  assert.ok(forest.meshes.every(mesh => !mesh.isEnabled()));
  forest.dispose();
  assert.ok(forest.meshes.every(mesh => mesh.isDisposed()));
  engine.dispose();
});

test('every face of the forest floor and trail turns up toward the sky', () => {
  const shapes = [];
  buildForestEdge({ box() {}, ball() {}, cylinder() {}, shape: (positions, colors, normals, indices) => shapes.push({ positions, indices }) });
  const [floor, , , trail] = shapes;
  for (const { positions, indices = positions.map((_, i) => i).slice(0, positions.length / 3) } of [floor, trail]) {
    let up = 0, down = 0;
    for (let t = 0; t < indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map(k => indices[t + k] * 3);
      const ux = positions[b] - positions[a], uz = positions[b + 2] - positions[a + 2], vx = positions[c] - positions[a], vz = positions[c + 2] - positions[a + 2];
      const facing = uz * vx - ux * vz;
      if (facing < -1e-9) up++; else if (facing > 1e-9) down++;
    }
    assert.ok(up > 100 && down === 0, `${up} up, ${down} down`);
  }
});
