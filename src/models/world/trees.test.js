import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWorldTrees, plantTrees, NEAR_TREES, HERO_TREES, WINDOW_EYE, VISTA } from './trees.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { WORLD, riverDistance } from '../../core/world-terrain.js';
import { TERRAIN_RINGS, terrainRing, ringAt } from './terrain-mesh.js';

function flatRing(radius, step, at) {
  const n = Math.round(radius * 2 / step) + 1, positions = new Float32Array(n * n * 3), normals = new Float32Array(n * n * 3), colors = new Float32Array(n * n * 4);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = -radius + i * step, z = -radius + j * step, v = i * n + j, { y, up, cover, wet } = at(x, z);
    positions.set([x, y, z], v * 3); normals.set([0, up, Math.sqrt(1 - up * up)], v * 3); colors.set([cover, wet, 0, 1], v * 4);
  }
  return { positions, normals, colors };
}

const halfForest = () => [flatRing(600, 20, x => ({ y: 10, up: 1, cover: x > 0 ? 1 : 0, wet: 0 }))];

const conifers = trees => trees.kind.reduce((sum, kind) => sum + kind, 0);

test('forests fill canopy ground while meadows get only a few lone broadleaf trees', () => {
  const trees = plantTrees(halfForest());
  assert.equal(trees.count, 1847);
  let meadow = 0, meadowConifers = 0;
  for (let i = 0; i < trees.count; i++) {
    const d = Math.hypot(trees.x[i], trees.z[i]);
    assert.ok(d >= 25, `tree ${i} sits ${d} m from the house`);
    assert.ok(riverDistance(trees.x[i], trees.z[i]) >= WORLD.river.width * 1.4, `tree ${i} stands in the river`);
    assert.ok(Math.abs(trees.x[i]) < 600 && Math.abs(trees.z[i]) < 600, `tree ${i} is off the terrain`);
    if (trees.x[i] < -20) { meadow++; meadowConifers += trees.kind[i]; }
  }
  assert.equal(meadow, 67);
  assert.equal(meadowConifers, 0);
  assert.ok(Math.abs(trees.y[0] - (10 - 0.5 * trees.width[0])) < 1e-5);
});

test('lowland forest is broadleaf and conifers only take the high ground', () => {
  const forestAt = y => plantTrees([flatRing(600, 20, () => ({ y, up: 1, cover: 1, wet: 0 }))]);
  assert.equal(conifers(forestAt(-40)), 0);
  assert.equal(conifers(forestAt(200)), 898);
});

test('far hills hold a few wide grove clumps instead of a carpet of single trees', () => {
  const trees = plantTrees([flatRing(3400, 100, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]);
  let far = 0, clumped = 0;
  for (let i = HERO_TREES.length; i < trees.count; i++) {
    if (Math.hypot(trees.x[i], trees.z[i]) < 450) continue;
    far++;
    if (trees.width[i] / trees.height[i] > 1.5) clumped++;
  }
  assert.equal(far, 2253);
  assert.ok(clumped / far > 0.95, `${clumped} of ${far} far trees are clumps`);
});

test('valley canopy sizes range from about 0.6 to 1.6 so groves are not one stamped carpet', () => {
  const trees = plantTrees([flatRing(600, 20, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]);
  let smallest = Infinity, largest = 0;
  for (let i = HERO_TREES.length; i < trees.count; i++) {
    if (Math.hypot(trees.x[i], trees.z[i]) >= 450) continue;
    smallest = Math.min(smallest, trees.width[i]); largest = Math.max(largest, trees.width[i]);
  }
  assert.ok(smallest < 0.65 && largest > 1.55, `valley tree widths run ${smallest} to ${largest}`);
});

test('no trees grow on steep rock or wet river banks except the window hero trees', () => {
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0 }))]).count, 134);
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 0.5, cover: 0, wet: 0 }))]).count, HERO_TREES.length);
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0.3 }))]).count, HERO_TREES.length);
});

test('hero trees frame the window vista below the far ridge and leave its clearing open', () => {
  const trees = plantTrees([flatRing(600, 20, () => ({ y: -10, up: 1, cover: 1, wet: 0 }))]);
  HERO_TREES.forEach((hero, i) => {
    assert.ok(Math.abs(trees.x[i] - hero.x) < 1e-3 && Math.abs(trees.z[i] - hero.z) < 1e-3);
    assert.equal(trees.kind[i], 0);
    const crown = trees.y[i] + trees.height[i] * 10.6, sight = WINDOW_EYE.y - hero.distance * VISTA.dip;
    assert.ok(crown <= sight + 1e-3, `hero ${i} crown ${crown} rises over the ridge line ${sight}`);
  });
  for (let i = HERO_TREES.length; i < trees.count; i++) {
    const dx = trees.x[i] - WINDOW_EYE.x, dz = WINDOW_EYE.z - trees.z[i];
    const inCone = dz > 0 && Math.abs(Math.atan2(dx, dz) - VISTA.bearing) < VISTA.halfAngle;
    assert.ok(!(inCone && Math.hypot(dx, dz) < VISTA.clearing), `tree ${i} blocks the window vista`);
  }
});

function drawnSurface(meshes) {
  return (x, z) => {
    const ring = ringAt(x, z), { positions } = meshes[TERRAIN_RINGS.indexOf(ring)], nz = Math.round((ring.maxZ - ring.minZ) / ring.step) + 1;
    const u = (x - ring.minX) / ring.step, w = (z - ring.minZ) / ring.step, i = Math.floor(u), j = Math.floor(w), fu = u - i, fw = w - j;
    const y = (di, dj) => positions[((i + di) * nz + j + dj) * 3 + 1];
    return fu + fw <= 1 ? y(0, 0) + (y(1, 0) - y(0, 0)) * fu + (y(0, 1) - y(0, 0)) * fw : y(1, 1) + (y(0, 1) - y(1, 1)) * (1 - fu) + (y(1, 0) - y(1, 1)) * (1 - fw);
  };
}

test('every tree stands on the terrain the rings draw, in every ring that holds trees', () => {
  const meshes = TERRAIN_RINGS.map((_, index) => terrainRing(index)), surface = drawnSurface(meshes), trees = plantTrees(meshes), holding = new Set(), floating = [];
  for (let i = 0; i < trees.count; i++) {
    holding.add(TERRAIN_RINGS.indexOf(ringAt(trees.x[i], trees.z[i])));
    const above = trees.y[i] - surface(trees.x[i], trees.z[i]);
    if (above > 0.01) floating.push(`${Math.round(trees.x[i])},${Math.round(trees.z[i])} +${above.toFixed(1)} m`);
  }
  assert.deepEqual({ rings: [...holding].sort(), floating: floating.slice(0, 5) }, { rings: [0, 1, 2, 3], floating: [] });
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

test('every near broadleaf clump hides a darker solid leaf mass under its leaf cards', () => {
  const { scene, trees } = forestScene(true);
  const colors = trees.meshes[0].getVerticesData('color'), mass = [], cards = [];
  for (let v = 0; v < colors.length; v += 4) {
    if (Math.abs(colors[v + 2] - 0.16) < 1e-4) mass.push(colors[v]);
    else if (Math.abs(colors[v + 2] - 0.25) < 1e-4) cards.push(colors[v]);
  }
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  assert.equal(mass.length, 6 * 12);
  assert.equal(trees.meshes[0].getIndices().length, cards.length / 4 * 6 + 6 * 20 * 3 + 6 * 5 * 6 + 7 * 6);
  assert.ok(mean(mass) < mean(cards) - 0.1, `inner mass ${mean(mass)} is not darker than the cards ${mean(cards)}`);
  scene.dispose();
});

test('dusk swaps in its own foliage and a still world never advances the wind', () => {
  const { scene, trees } = forestScene(true);
  trees.setTheme(WORLD_ATMOSPHERES.dusk);
  const color = key => trees.paint._colors3[key].toHexString().toLowerCase();
  assert.equal(color('leafCrown'), '#b0a24c');
  assert.equal(color('leafBack'), '#ffcf6a');
  assert.equal(color('leafUnder'), WORLD_ATMOSPHERES.dusk.leafUnder);
  assert.equal(color('sunColor'), WORLD_ATMOSPHERES.dusk.sunColor);
  assert.equal(trees.paint._floats.sunStrength, WORLD_ATMOSPHERES.dusk.sunStrength);
  trees.setTheme({ ...WORLD_ATMOSPHERES.rain, leafCrown: '#123456' });
  assert.equal(color('leafCrown'), '#123456');
  scene.render(); scene.render();
  assert.equal(trees.paint._floats.time, 0);
  scene.dispose();
});
