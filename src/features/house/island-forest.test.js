import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { onIsland } from './house-island.js';
import { onLandmass } from './island-landform.js';
import { ISLAND_SUN } from './island-atmosphere.js';
import { TREE_FORMS, CROWN_TOPS } from '../../models/world/trees.js';
import {
  FOREST_PATH, FOREST_PATH_WIDTH, FOREST_TRAILHEAD, FOREST_CLEARING, buildForestEdge, createIslandForest, forestAtmosphere, forestPathDistance, groveMatrices, grove, onForest, groveBounds,
} from './island-forest.js';

test('the grove grows on the new forest lobe, off the lawn and clear of the path', () => {
  const trees = grove();
  assert.equal(trees.length, 70);
  for (const { x, z } of trees) {
    assert.ok(onForest(x, z, .3), `${x}, ${z} is off the forest`);
    assert.equal(onIsland(x, z, -.25), false, `${x}, ${z} stands on the lawn`);
    assert.ok(forestPathDistance(x, z) > FOREST_PATH_WIDTH / 2, `${x}, ${z} blocks the path`);
  }
  assert.deepEqual(Object.values(TREE_FORMS).map(form => trees.filter(tree => tree.form === form).length), [19, 33, 18]);
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
  for (const [x, z] of FOREST_PATH) assert.ok(onLandmass(x, z, .3), `the path leaves the ground at ${x}, ${z}`);
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
  assert.deepEqual(forest.meshes.map(mesh => mesh.thinInstanceCount), [19, 33, 18]);
  assert.equal(new Set(forest.meshes.map(mesh => mesh.material)).size, 1);
  forest.animate(3);
  forest.setTheme('rain');
  forest.setEnabled(false);
  assert.ok(forest.meshes.every(mesh => !mesh.isEnabled()));
  forest.dispose();
  assert.ok(forest.meshes.every(mesh => mesh.isDisposed()));
  engine.dispose();
});

test('the grove shades its leaves from a distant eye so the island view takes the cheap leaf path', () => {
  const engine = new NullEngine(), scene = new Scene(engine), target = new Vector3(0, 1.3, 0);
  scene.activeCamera = new ArcRotateCamera('island', Math.PI / 2.8, 1.02, 32, target, scene);
  const forest = createIslandForest(scene, 'day'), material = forest.meshes[0].material;
  scene.onBeforeRenderObservable.notifyObservers(scene);
  const eye = material._vectors3.eye, toEye = eye.subtract(target), toCamera = scene.activeCamera.globalPosition.subtract(target);
  for (const { x, z } of grove()) assert.ok(Vector3.Distance(eye, new Vector3(x, 0, z)) > 110);
  assert.ok(Vector3.Dot(toEye.normalize(), toCamera.normalize()) > .999);
  forest.dispose(); engine.dispose();
});

test('every face of the forest floor and trail turns up toward the sky', () => {
  const shapes = [];
  buildForestEdge({ box() {}, ball() {}, cylinder() {}, shape: (positions, colors, normals, indices) => shapes.push({ positions, indices }) });
  const [floor, trail] = shapes;
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

test('the forest reaches well to the right of the arch, and the trail turns across the home view inside it', () => {
  const { position: [x, , z] } = FOREST_TRAILHEAD;
  assert.ok(Math.max(...grove().map(tree => tree.x)) > x + 3);
  assert.ok(grove().filter(tree => tree.x > x + 1).length >= 4);
  assert.ok(FOREST_CLEARING[0] > x + .8 && FOREST_CLEARING[1] < z - 1 && onForest(...FOREST_CLEARING, .4));
});

test('the dusk grove stays a readable green and no lantern paints a glow disc on the ground', () => {
  const green = hex => parseInt(hex.slice(3, 5), 16);
  assert.ok(green(forestAtmosphere('dusk').leafTop) > 140 && green(forestAtmosphere('dusk').needleTop) > 105);
  assert.ok(forestAtmosphere('dusk').sunStrength > .75);
  for (const theme of ['day', 'dusk', 'rain']) {
    const discs = [];
    buildForestEdge({ box() {}, ball() {}, shape() {}, cylinder: (x, y, z, top, bottom, height) => discs.push({ top, height }) }, theme);
    assert.ok(discs.length > 0 && discs.every(({ top, height }) => top < .45 && height > .01), theme);
  }
});

test('the back of the forest is a dense wall of conifers and no tree near the camera towers over the cottage', () => {
  const top = tree => CROWN_TOPS[tree.form] * .3 * tree.size * tree.height, trees = grove(), conifers = trees.filter(tree => tree.form === TREE_FORMS.conifer);
  assert.ok(conifers.filter(tree => tree.z < -8).length >= 22, 'the back row is thin');
  assert.ok(Math.max(...trees.map(top)) < 4.8, 'a tree stands taller than the cottage ridge');
  const { position: [x] } = FOREST_TRAILHEAD;
  for (const tree of trees.filter(tree => tree.x > x + 2 && tree.z > -7.5)) assert.ok(top(tree) < 2.8, `the tree at ${tree.x}, ${tree.z} towers over the right shore`);
});

test('the trail lanterns and the arch lamps burn brighter and larger at dusk than by day', () => {
  const glass = theme => {
    const lit = [];
    buildForestEdge({ box() {}, cylinder() {}, shape() {}, ball: (x, y, z, w, h, d, hex, strength = 1) => { if (strength > 1.04) lit.push({ w, strength }); } }, theme);
    return lit.filter(({ w }) => w >= .15);
  };
  assert.equal(glass('dusk').length, 7);
  assert.ok(glass('dusk').every(({ strength }) => strength > 3) && glass('day').every(({ strength }) => strength < 1.2));
});
