import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWorldTrees, createTreePaint, treeModel, plantTrees, NEAR_TREES, HERO_TREES, WINDOW_EYE, VISTA, TREE_FORMS, CROWN_TOPS } from './trees.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';
import { WORLD, riverDistance, pathDistance } from '../../core/world-terrain.js';
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

const conifers = trees => trees.kind.filter(kind => kind === TREE_FORMS.conifer).length;

test('forests fill canopy ground while meadows get only a few lone broadleaf trees', () => {
  const trees = plantTrees(halfForest());
  assert.equal(trees.count, 893);
  let meadow = 0, meadowConifers = 0;
  for (let i = 0; i < trees.count; i++) {
    const d = Math.hypot(trees.x[i], trees.z[i]);
    assert.ok(d >= 25, `tree ${i} sits ${d} m from the house`);
    assert.ok(riverDistance(trees.x[i], trees.z[i]) >= WORLD.river.width * 1.4, `tree ${i} stands in the river`);
    assert.ok(Math.abs(trees.x[i]) < 600 && Math.abs(trees.z[i]) < 600, `tree ${i} is off the terrain`);
    if (trees.x[i] < -20) { meadow++; meadowConifers += trees.kind[i] === TREE_FORMS.conifer ? 1 : 0; }
  }
  assert.equal(meadow, 53);
  assert.equal(meadowConifers, 0);
  assert.ok(Math.abs(trees.y[0] - (10 - 0.5 * trees.width[0])) < 1e-5);
});

test('lowland forest is broadleaf and conifers only take the high ground', () => {
  const forestAt = y => plantTrees([flatRing(600, 20, () => ({ y, up: 1, cover: 1, wet: 0 }))]);
  assert.equal(conifers(forestAt(-40)), 0);
  assert.equal(conifers(forestAt(200)), 464);
});

test('far hills hold a few wide grove clumps instead of a carpet of single trees', () => {
  const trees = plantTrees([flatRing(3400, 100, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]);
  let far = 0, clumped = 0;
  for (let i = HERO_TREES.length; i < trees.count; i++) {
    if (Math.hypot(trees.x[i], trees.z[i]) < 450) continue;
    far++;
    if (trees.width[i] / trees.height[i] > 1.5) clumped++;
  }
  assert.equal(far, 2892);
  assert.ok(clumped / far > 0.95, `${clumped} of ${far} far trees are clumps`);
});

test('past the valley an open meadow holds no lone trees dotted across it', () => {
  const trees = plantTrees([flatRing(3400, 100, () => ({ y: -40, up: 1, cover: 0, wet: 0 }))]);
  const dotted = Array.from(trees.x).filter((x, i) => i >= HERO_TREES.length && Math.hypot(x, trees.z[i]) >= 450).length;
  assert.equal(dotted, 0);
});

test('far hills gather their groves into clumps of mixed heights instead of an even spread of matching tops', () => {
  const trees = plantTrees([flatRing(3400, 100, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]);
  const all = Array.from({ length: trees.count - HERO_TREES.length }, (_, k) => k + HERO_TREES.length);
  const ring = (from, to) => {
    const inside = all.filter(i => trees.z[i] < 0 && Math.hypot(trees.x[i], trees.z[i]) > from && Math.hypot(trees.x[i], trees.z[i]) < to);
    const nearest = inside.map(i => all.reduce((best, j) => j === i ? best : Math.min(best, Math.hypot(trees.x[i] - trees.x[j], trees.z[i] - trees.z[j])), Infinity));
    const spread = 0.5 / Math.sqrt(inside.length / (Math.PI * (to * to - from * from) / 2)), heights = inside.map(i => trees.height[i]), mean = heights.reduce((a, b) => a + b, 0) / heights.length;
    return {
      clumping: Number((nearest.reduce((a, b) => a + b, 0) / nearest.length / spread).toFixed(2)),
      heights: Number((Math.sqrt(heights.reduce((a, b) => a + (b - mean) ** 2, 0) / heights.length) / mean).toFixed(2)),
    };
  };
  for (const [from, to] of [[600, 1200], [1500, 3200]]) {
    const { clumping, heights } = ring(from, to);
    assert.ok(clumping < 0.78, `groves ${from}-${to} m have nearest-neighbour ratio ${clumping}, an even spread`);
    assert.ok(heights > 0.24, `grove heights ${from}-${to} m vary only ${heights}, so their tops line up`);
  }
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

test('valley groves mix round and spreading crowns, meadows favour lone spreading trees, and far hills keep their grove clumps', () => {
  const tally = (trees, keep) => {
    const forms = [0, 0, 0];
    for (let i = HERO_TREES.length; i < trees.count; i++) if (keep(Math.hypot(trees.x[i], trees.z[i]))) forms[trees.kind[i]]++;
    return forms;
  };
  const forest = plantTrees([flatRing(600, 20, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]), meadow = plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0 }))]);
  assert.deepEqual({
    valley: tally(forest, d => d < 450),
    pastValley: tally(forest, d => d >= 450)[TREE_FORMS.spreading],
    meadow: tally(meadow, () => true),
  }, { valley: [1018, 0, 551], pastValley: 0, meadow: [35, 0, 71] });
});

test('a spreading tree holds a wide flat canopy lower than a round crown, and its far card is wider still', () => {
  const { scene, trees } = forestScene(true);
  const extent = (mesh, leavesOnly) => {
    const p = mesh.getVerticesData('position'), color = mesh.getVerticesData('color'), box = { width: 0, height: 0, top: -Infinity };
    let left = Infinity, right = -Infinity, low = Infinity;
    for (let v = 0; v < p.length / 3; v++) {
      if (leavesOnly && color[v * 4 + 2] < 0.1) continue;
      left = Math.min(left, p[v * 3]); right = Math.max(right, p[v * 3]); low = Math.min(low, p[v * 3 + 1]); box.top = Math.max(box.top, p[v * 3 + 1]);
    }
    return { width: Number((right - left).toFixed(1)), height: Number((box.top - low).toFixed(1)), top: Number(box.top.toFixed(1)) };
  };
  const [round, roundFar, , , spreading, spreadingFar] = trees.meshes;
  assert.deepEqual(
    { round: extent(round, true), spreading: extent(spreading, true), roundFar: extent(roundFar, false), spreadingFar: extent(spreadingFar, false) },
    { round: { width: 11.3, height: 7.5, top: 10.4 }, spreading: { width: 14.4, height: 5.9, top: 9.3 }, roundFar: { width: 11.6, height: 11.6, top: 10.8 }, spreadingFar: { width: 16.4, height: 9.8, top: 9 } },
  );
  assert.ok(extent(spreading, true).top <= CROWN_TOPS[TREE_FORMS.spreading]);
  scene.dispose();
});

test('near trees keep a green shade, teal shade starts past every near tree and hero oak, and the far shade settles to haze green', () => {
  const hue = hex => {
    const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255), max = Math.max(r, g, b), d = max - Math.min(r, g, b);
    return Math.round(60 * (max === g ? (b - r) / d + 2 : max === r ? ((g - b) / d + 6) % 6 : (r - g) / d + 4));
  };
  const { day } = WORLD_ATMOSPHERES;
  assert.deepEqual({ near: hue(day.leafUnder), mid: hue(day.leafMid), top: hue(day.leafTop), haze: day.leafHaze }, { near: 116, mid: 158, top: 80, haze: '#2f5a2e' });
  const { scene, trees } = forestScene(true);
  scene.render();
  const fragment = trees.paint.getEffect()._fragmentSourceCode;
  const ramps = fragment.match(/leafShade = mix\(mix\(leafUnder, leafMid, smoothstep\(([\d.]+), ([\d.]+), dist\)\), leafHaze, smoothstep\(([\d.]+), ([\d.]+), dist\)\);/)?.slice(1).map(Number);
  const farthestNear = Math.max(NEAR_TREES, ...HERO_TREES.map(hero => hero.distance));
  assert.ok(ramps && ramps[0] > farthestNear, `teal shade starts at ${ramps?.[0]} m, inside the ${farthestNear} m near band`);
  assert.ok(ramps[1] < ramps[2], `teal shade never reaches full strength before the haze takes over: ${ramps}`);
  assert.match(fragment, /vec3 field = mix\(mix\(leafHaze, needleUnder, needle\)/);
  scene.dispose();
});

test('near leaf cards drop out edge-on and take their dusk glow from the clump silhouette, not from each card', () => {
  const { scene, trees } = forestScene(true);
  scene.render();
  const fragment = trees.paint.getEffect()._fragmentSourceCode, foliage = fragment.match(/vec3 foliage\([^)]*\) \{\n([\s\S]*?)\n\}/)[1];
  assert.match(fragment, /facing = abs\(dot\(normalize\(cross\(dFdx\(vWorld\), dFdy\(vWorld\)\)\), v\)\);\n\s*if \(facing < \.18\) discard;/);
  assert.match(foliage, /top = mix\(top, leafBack, goldenHour \*.*\* mix\(1\., silhouette, card\)\);/);
  assert.match(foliage, /float silhouette = max\(pow\(1\. - abs\(dot\(v, n\)\), 1\.2\), smoothstep\(\.3, \.9, n\.y\)\);/);
  assert.equal(foliage.match(/\* facing/g)?.length, 3);
  assert.match(fragment, /foliage\(normalize\(vNormal\), v, vPart\.r, needle, vSeed, leaf, facing, step\(\.2, part\) \* \(1\. - needle\)\);/);
  scene.dispose();
});

test('dusk trunks take a pale bark so the backlit shade does not crush them to black', () => {
  const luma = hex => [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) / 255).reduce((sum, c, k) => sum + c * [0.2126, 0.7152, 0.0722][k], 0);
  assert.equal(Number(luma(WORLD_ATMOSPHERES.dusk.bark).toFixed(2)), 0.72);
});

test('no trees grow on steep rock or wet river banks except the window hero trees', () => {
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0 }))]).count, 109);
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 0.5, cover: 0, wet: 0 }))]).count, HERO_TREES.length);
  assert.equal(plantTrees([flatRing(600, 20, () => ({ y: 0, up: 1, cover: 0, wet: 0.3 }))]).count, HERO_TREES.length);
});

test('hero trees frame the window vista below the far ridge and leave its clearing open', () => {
  const trees = plantTrees([flatRing(600, 20, () => ({ y: -10, up: 1, cover: 1, wet: 0 }))]);
  HERO_TREES.forEach((hero, i) => {
    assert.ok(Math.abs(trees.x[i] - hero.x) < 1e-3 && Math.abs(trees.z[i] - hero.z) < 1e-3);
    assert.equal(trees.kind[i], TREE_FORMS.spreading);
    const crown = trees.y[i] + trees.height[i] * CROWN_TOPS[TREE_FORMS.spreading], sight = WINDOW_EYE.y - hero.distance * VISTA.dip;
    assert.ok(crown <= sight + 1e-3, `hero ${i} crown ${crown} rises over the ridge line ${sight}`);
  });
  for (let i = HERO_TREES.length; i < trees.count; i++) {
    const dx = trees.x[i] - WINDOW_EYE.x, dz = WINDOW_EYE.z - trees.z[i];
    const inCone = dz > 0 && Math.abs(Math.atan2(dx, dz) - VISTA.bearing) < VISTA.halfAngle;
    assert.ok(!(inCone && Math.hypot(dx, dz) < VISTA.clearing), `tree ${i} blocks the window vista`);
  }
});

test('a valley forest gathers in thickets of mixed sizes with clearings between, not an orchard grid', () => {
  const trees = plantTrees([flatRing(600, 20, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]), stand = [];
  for (let i = HERO_TREES.length; i < trees.count; i++) if (trees.x[i] > -250 && trees.x[i] < -50 && trees.z[i] > -250 && trees.z[i] < -50) stand.push(i);
  const nearest = stand.map(i => Math.min(...stand.filter(j => j !== i).map(j => Math.hypot(trees.x[i] - trees.x[j], trees.z[i] - trees.z[j]))));
  const spread = 0.5 / Math.sqrt(stand.length / (200 * 200)), clumping = nearest.reduce((a, b) => a + b, 0) / nearest.length / spread;
  const widths = stand.map(i => trees.width[i]), mean = widths.reduce((a, b) => a + b, 0) / widths.length;
  const variation = Math.sqrt(widths.reduce((a, b) => a + (b - mean) ** 2, 0) / widths.length) / mean;
  assert.ok(clumping < 0.7, `nearest-neighbour ratio ${clumping.toFixed(2)} reads as evenly planted rows`);
  assert.ok(variation > 0.25, `crown widths vary only ${variation.toFixed(2)}`);
});

test('the winding path runs clear of tree crowns all the way down the valley', () => {
  const trees = plantTrees([flatRing(600, 20, () => ({ y: -40, up: 1, cover: 1, wet: 0 }))]), blocking = [];
  for (let i = HERO_TREES.length; i < trees.count; i++) if (pathDistance(trees.x[i], trees.z[i]) < 2 + 5 * trees.width[i]) blocking.push(`${Math.round(trees.x[i])},${Math.round(trees.z[i])}`);
  assert.deepEqual(blocking, []);
});

test('trees stand along the crest of a terrace and fray out of its forest edge instead of stopping on a line', () => {
  const rise = z => Math.min(1, Math.max(0, (-z - 860) / 40));
  const terrace = flatRing(1300, 25, (x, z) => ({ y: 40 * rise(z), up: rise(z) > 0 && rise(z) < 1 ? 0.7 : 1, cover: 0, wet: 0 }));
  const trees = plantTrees([terrace]), count = (near, far) => Array.from(trees.z).filter((z, i) => -z > near && -z < far && Math.abs(trees.x[i]) < 800).length;
  assert.ok(count(900, 950) > 2.5 * count(1100, 1150) + 2, `${count(900, 950)} trees on the crest against ${count(1100, 1150)} on the open terrace`);
  const edge = plantTrees([flatRing(1300, 25, x => ({ y: 0, up: 1, cover: x > 0 ? 1 : 0, wet: 0 }))]), strip = (low, high) => Array.from(edge.x).filter((x, i) => x > low && x < high && Math.hypot(x, edge.z[i]) > 500).length;
  const open = strip(-400, -150) / 5;
  assert.ok(strip(-50, 0) > 2.5 * open + 2, `${strip(-50, 0)} trees fray out of the forest edge against ${open} per strip in the open`);
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

test('connected tree clearing is opt-in and follows the current render eye without changing tree draws', () => {
  const { scene, camera, trees } = forestScene(true), draws = trees.meshes.length, instances = trees.meshes.map(mesh => mesh.thinInstanceCount);
  assert.deepEqual(trees.paint._vectors4.viewTarget.asArray(), [0, 0, 0, 0]);
  trees.setViewTarget(-9, 7, -36, 1.35);
  camera.position.set(-9, 8, -30); scene.render();
  assert.match(trees.paint.getEffect()._fragmentSourceCode, /if \(vTreeClearance > \.5\) discard;/);
  assert.deepEqual(trees.paint._vectors4.viewTarget.asArray(), [-9, 7, -36, 1.35]);
  assert.deepEqual(trees.paint._vectors3.eye.asArray(), [-9, 8, -30]);
  trees.setTheme(WORLD_ATMOSPHERES.rain);
  assert.deepEqual(trees.paint._vectors4.viewTarget.asArray(), [-9, 7, -36, 1.35]);
  assert.equal(trees.meshes.length, draws);
  assert.equal(trees.meshes.reduce((total, mesh) => total + mesh.thinInstanceCount, 0), instances.reduce((a, b) => a + b));
  trees.setViewTarget(0, 0, 0, 0);
  assert.equal(trees.paint._vectors4.viewTarget.w, 0);
  scene.dispose();
});

test('connected tree clearing preserves background, peripheral trees and the default room view', async () => {
  const { treeClearance } = await import('./trees.js');
  const eye = { x: 0, y: 2, z: 8 }, target = { x: 0, y: 2, z: 0, w: 1.35 }, trunk = { x: 0, y: 2, z: 4, radius: .5, height: 2 };
  assert.equal(treeClearance([trunk], eye, target), true);
  assert.equal(treeClearance([{ ...trunk, x: 4 }], eye, target), false);
  assert.equal(treeClearance([{ ...trunk, z: -4 }], eye, target), false);
  assert.equal(treeClearance([{ ...trunk, z: 12 }], eye, target), false);
  assert.equal(treeClearance([trunk], eye, { ...target, w: 0 }), false);
  assert.equal(treeClearance([trunk], target, target), false);
  assert.equal(treeClearance([{ ...trunk, x: 4, z: 0 }], { x: 8, y: 2, z: 0 }, target), true);
});

test('a crown crossing the view clears its supporting tree even when the trunk misses', async () => {
  const { treeClearance } = await import('./trees.js');
  const eye = { x: 0, y: 5, z: 8 }, target = { x: 0, y: 5, z: 0, w: 1.35 }, trunk = { x: 4, y: 1.5, z: 4, radius: .5, height: 2 }, crown = { x: 4, y: 6, z: 4, radius: 5, height: 3 };
  assert.equal(treeClearance([trunk], eye, target), false);
  assert.equal(treeClearance([trunk, crown], eye, target), true);
  assert.equal(treeClearance([{ ...trunk, x: 20 }, { ...crown, x: 20 }], eye, target), false);
});

test('trunk, every branch, solid crown and leaf cards share the same connected visibility bounds', () => {
  const { scene, trees } = forestScene(true);
  for (const mesh of trees.meshes) {
    const colors = mesh.getVerticesData('color');
    for (const name of ['treeTrunk', 'treeCrown']) {
      const bounds = mesh.getVerticesData(name);
      assert.ok(bounds, `${mesh.name} needs connected ${name} bounds`);
      assert.equal(bounds.length, colors.length);
      assert.ok(bounds[1] > 0 && bounds[2] > 0);
      for (let i = 4; i < bounds.length; i += 4) assert.deepEqual(bounds.slice(i, i + 4), bounds.slice(0, 4));
    }
  }
  scene.dispose();
});

test('connected tree bounds enclose all actual wood and crown vertices without changing their geometry', () => {
  for (const style of [undefined, 'woodland']) for (const form of Object.values(TREE_FORMS)) {
    const model = treeModel(form, style), bounds = [model.treeTrunk, model.treeCrown];
    assert.ok(bounds.every(Boolean));
    for (let i = 0; i < model.positions.length; i += 3) {
      const [x, y, z] = model.positions.slice(i, i + 3);
      assert.ok(bounds.some(bound => (x * x + z * z) / bound[1] ** 2 + (y - bound[0]) ** 2 / bound[2] ** 2 < 1.000001), `${style ?? 'room'} form ${form}, vertex ${i / 3} escaped its bounds`);
    }
  }
});

test('six thin-instanced meshes split every tree between near models and far impostors', () => {
  const { scene, camera, trees } = forestScene(true);
  assert.deepEqual(trees.meshes.map(mesh => mesh.name), ['world-trees-broadleaf-near', 'world-trees-broadleaf-far', 'world-trees-conifer-near', 'world-trees-conifer-far', 'world-trees-spreading-near', 'world-trees-spreading-far']);
  const counts = () => trees.meshes.map(mesh => mesh.thinInstanceCount);
  const nearCount = (x, z) => Array.from(trees.planted.x).filter((tx, i) => (tx - x) ** 2 + (trees.planted.z[i] - z) ** 2 < NEAR_TREES * NEAR_TREES).length;
  assert.equal(counts().reduce((a, b) => a + b), trees.planted.count);
  assert.equal(counts()[0] + counts()[2] + counts()[4], nearCount(0, 0));
  assert.ok(trees.meshes.every(mesh => mesh.alwaysSelectAsActiveMesh && !mesh.isPickable));
  camera.position.set(300, 2, 0);
  scene.render();
  assert.equal(counts()[0] + counts()[2] + counts()[4], nearCount(300, 0));
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

test('a far grove pixel pays for clump noise only inside a clump reach, and for leaf mottle only nearer than 1100 m', () => {
  const { scene, trees } = forestScene(true);
  scene.render();
  const fragment = trees.paint.getEffect()._fragmentSourceCode, clump = fragment.match(/void clump\([^)]*\) \{\n([\s\S]*?)\n\}/)[1].split('\n');
  const noiseAt = clump.findIndex(line => line.includes('worldNoise(')), guards = clump.slice(0, noiseAt).filter(line => /^\s*if \(.*reach.*\) return;$/.test(line));
  assert.deepEqual({
    noiseCalls: clump.filter(line => line.includes('worldNoise(')).length,
    guardsBeforeNoise: guards.length,
    mottle: fragment.match(/float mottle = (.*?) \?/)?.[1],
  }, { noiseCalls: 1, guardsBeforeNoise: 2, mottle: 'dist < 1100.' });
  scene.dispose();
});

test('far broadleaf cards mirror and resize their lobes per tree so neighbouring groves are not stamped clones', () => {
  const { scene, trees } = forestScene(true);
  scene.render();
  const fragment = trees.paint.getEffect()._fragmentSourceCode, lobes = fragment.match(/clump\((?!vec2 c)[^;]*\);/g);
  assert.equal(lobes.length, 18);
  assert.ok(lobes.every(lobe => /^clump\([mf], vec2\([^)]*\), [\d.]+ \* \([^)]*fract\(seed \* [\d.]+\)\), seed, best\);$/.test(lobe)), lobes.join('\n'));
  assert.match(fragment, /vec2 m = vec2\(c\.x \* flip, c\.y\)/);
  scene.dispose();
});

test('dusk swaps in its own foliage and a still world never advances the wind', () => {
  const { scene, trees } = forestScene(true);
  trees.setTheme(WORLD_ATMOSPHERES.dusk);
  const color = key => trees.paint._colors3[key].toHexString().toLowerCase();
  assert.equal(color('leafCrown'), '#84a450');
  assert.equal(trees.paint._floats.goldenHour, 1);
  assert.equal(color('leafBack'), '#f4d27a');
  assert.equal(color('leafUnder'), WORLD_ATMOSPHERES.dusk.leafUnder);
  assert.equal(color('sunColor'), WORLD_ATMOSPHERES.dusk.sunColor);
  assert.equal(trees.paint._floats.sunStrength, WORLD_ATMOSPHERES.dusk.sunStrength);
  trees.setTheme({ ...WORLD_ATMOSPHERES.rain, leafCrown: '#123456' });
  assert.equal(color('leafCrown'), '#123456');
  scene.render(); scene.render();
  assert.equal(trees.paint._floats.time, 0);
  scene.dispose();
});

test('a tree paint takes its foliage colours and light from the atmosphere it is given', () => {
  const engine = new NullEngine(), scene = new Scene(engine), { paint, setTheme } = createTreePaint(scene, { name: 'grove-paint', still: true });
  assert.equal(paint.name, 'grove-paint');
  assert.deepEqual(paint.options.attributes, ['position', 'normal', 'color', 'uv']);
  assert.deepEqual(paint._vectors4.viewTarget.asArray(), [0, 0, 0, 0]);
  setTheme({ ...WORLD_ATMOSPHERES.day, leafTop: '#ff0000', sunStrength: .4 });
  assert.deepEqual(paint._colors3.leafTop.asArray(), [1, 0, 0]);
  assert.equal(paint._floats.sunStrength, .4);
  engine.dispose();
});

test('each tree form has a near model with one colour per vertex', () => {
  for (const form of Object.values(TREE_FORMS)) {
    const { positions, colors, indices } = treeModel(form);
    assert.equal(colors.length / 4, positions.length / 3);
    assert.ok(indices.length > 300, `form ${form} has ${indices.length} indices`);
  }
});

test('woodland models are opt-in, retain crown clearance, and fit the near-tree geometry budget', () => {
  for (const form of [TREE_FORMS.broadleaf, TREE_FORMS.spreading]) {
    const original = treeModel(form), woodland = treeModel(form, 'woodland');
    assert.ok(woodland.positions.length !== original.positions.length || woodland.positions.some((value, index) => value !== original.positions[index]), 'woodland must have its own geometry');
    assert.deepEqual(treeModel(form, 'room').positions, original.positions);
    assert.deepEqual(treeModel(form, 'woodland').positions, woodland.positions);
    assert.equal(woodland.colors.length / 4, woodland.positions.length / 3);
    assert.ok(woodland.indices.length / 3 <= 4000);
    for (let i = 1; i < woodland.positions.length; i += 3) assert.ok(woodland.positions[i] <= CROWN_TOPS[form], `form ${form} exceeds its crown clearance`);
  }
  assert.deepEqual(treeModel(TREE_FORMS.conifer, 'woodland').positions, treeModel(TREE_FORMS.conifer).positions);
});

test('woodland bough colliders cover reachable wood while leaving the ground below branches open', async () => {
  const { treeBranchColliders } = await import('./trees.js');
  assert.equal(typeof treeBranchColliders, 'function');
  for (const form of Object.values(TREE_FORMS)) assert.deepEqual(treeBranchColliders(form), []);
  assert.deepEqual(treeBranchColliders(TREE_FORMS.conifer, 'woodland'), []);
  for (const form of [TREE_FORMS.broadleaf, TREE_FORMS.spreading]) {
    const model = treeModel(form, 'woodland'), colliders = treeBranchColliders(form, 'woodland');
    assert.ok(colliders.length > 0 && colliders.length <= 16);
    for (const collider of colliders) {
      assert.ok(Object.values(collider).every(Number.isFinite));
      assert.ok(collider.baseY > 2.5, 'bough colliders must not close off the ground below');
      assert.ok(collider.radius > 0 && collider.radius < .7, 'use short cylinders along the bough, not a solid crown collider');
      assert.ok(collider.height > 0 && collider.height < 1.5);
    }
    let reachable = 0;
    const check = ([x, y, z]) => {
      if (y < .5 || y > 5.5 || Math.hypot(x, z) <= .48) return;
      reachable++;
      assert.ok(colliders.some(c => y >= c.baseY - 1e-5 && y <= c.baseY + c.height + 1e-5 && Math.hypot(x - c.x, z - c.z) <= c.radius + 1e-5), `form ${form}: wood at ${[x, y, z]} escaped its collision shape`);
    };
    for (let i = 0; i < model.indices.length; i += 3) {
      const ids = [...model.indices.slice(i, i + 3)];
      if (ids.some(v => model.colors[v * 4 + 2] >= .1)) continue;
      const vertices = ids.map(v => [...model.positions.slice(v * 3, v * 3 + 3)]);
      vertices.forEach(check);
      for (let edge = 0; edge < 3; edge++) check(vertices[edge].map((value, axis) => (value + vertices[(edge + 1) % 3][axis]) / 2));
    }
    assert.ok(reachable > 20, 'the woodland needs real lower boughs, not only a bare trunk');
  }
});

test('tree paint binds shared grove lighting only when its world supplies that field', () => {
  const engine = new NullEngine(), scene = new Scene(engine), bound = [];
  const plain = createTreePaint(scene, { still: true }).paint;
  const lit = createTreePaint(scene, { still: true, grove: { bind: paint => bound.push(paint) } }).paint;
  assert.deepEqual(bound, [lit]);
  assert.ok(lit.options.samplers.includes('groveField'));
  assert.ok(!plain.options.samplers.includes('groveField'));
  assert.match(lit.shaderPath.vertexSource, /vRootY = base\.y/);
  assert.match(lit.shaderPath.fragmentSource, /groveLight\(bark, n, field\)/);
  assert.doesNotMatch(plain.shaderPath.fragmentSource, /groveLight\(bark/);
  engine.dispose();
});

test('woodland distance trees keep a three-dimensional crown and supported trunk within the reduced geometry budget', async () => {
  const { farTreeModel } = await import('./trees.js');
  assert.equal(typeof farTreeModel, 'function');
  for (const form of [TREE_FORMS.broadleaf, TREE_FORMS.spreading]) {
    const distant = farTreeModel(form, 'woodland'), original = farTreeModel(form);
    assert.equal(original.indices.length / 3, 2);
    assert.ok(distant.indices.length / 3 < 1100);
    const depth = [], height = [], wood = [];
    for (let i = 0; i < distant.positions.length / 3; i++) {
      depth.push(distant.positions[i * 3 + 2]); height.push(distant.positions[i * 3 + 1]);
      if (distant.colors[i * 4 + 2] < .1) wood.push(distant.positions[i * 3 + 1]);
      const [x, y, z] = distant.positions.slice(i * 3, i * 3 + 3);
      assert.ok([distant.treeTrunk, distant.treeCrown].some(bound => (x * x + z * z) / bound[1] ** 2 + (y - bound[0]) ** 2 / bound[2] ** 2 <= 1.000001));
    }
    assert.ok(Math.max(...depth) - Math.min(...depth) > 7);
    assert.ok(Math.min(...height) < -.7 && Math.max(...height) > 8);
    assert.ok(Math.min(...wood) < -.7 && Math.max(...wood) > 6);
  }
});

test('a defined forest keeps the clearing, walking path, landmarks and climbable formation open', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const { createTerrainField } = await import('../../core/world-terrain.js');
  const { plantDefinitionTrees } = await import('./trees.js');
  const ring = terrainRing(0, [{ minX: -128, maxX: 128, minZ: -128, maxZ: 128, step: 2 }], WILDS_WORLD), trees = plantDefinitionTrees([ring], WILDS_WORLD), field = createTerrainField(WILDS_WORLD);
  assert.ok(trees.count > 200);
  assert.equal(trees.x[0], -15); assert.equal(trees.z[0], 10);
  for (let i = 0; i < trees.count; i++) {
    assert.ok(Math.hypot(trees.x[i], trees.z[i]) > 16);
    assert.ok(field.pathDistance(trees.x[i], trees.z[i]) >= WILDS_WORLD.path.width + trees.width[i] * 3.29);
    assert.ok(Math.hypot(trees.x[i] + 9, trees.z[i] + 42) > 5);
  }
});


test('authored clearing groups replace scattered opening trees and retain varied crown heights', async () => {
  const { WILDS_WORLD } = await import('../../core/wilds/world-definition.js');
  const { plantDefinitionTrees } = await import('./trees.js');
  const rings = [terrainRing(0, [{ minX: -128, maxX: 128, minZ: -128, maxZ: 128, step: 4 }], WILDS_WORLD)];
  const trees = plantDefinitionTrees(rings, WILDS_WORLD), outside = plantDefinitionTrees(rings, { ...WILDS_WORLD, trees: { ...WILDS_WORLD.trees, opening: undefined } });
  const opening = Array.from({ length: trees.count }, (_, i) => i).filter(i => trees.x[i] > -29 && trees.x[i] < 29 && trees.z[i] > -62 && trees.z[i] < 28);
  assert.equal(opening.length, 11);
  assert.ok(trees.count < outside.count);
  assert.deepEqual(plantDefinitionTrees(rings, WILDS_WORLD), trees);
  assert.ok(Math.abs(trees.height[0] - 2.064) < 1e-6);
  assert.ok(Math.abs(trees.height[1] - 1.368) < 1e-6);
  assert.ok(trees.width[0] > trees.width[6]);
  const unshaped = plantDefinitionTrees(rings, { ...WILDS_WORLD, trees: { ...WILDS_WORLD.trees, heroes: [{ x: -18, z: -15, size: 1.6, kind: 2, turn: .6 }] } });
  assert.ok(Math.abs(unshaped.height[0] - 1.6) < 1e-6);
});
