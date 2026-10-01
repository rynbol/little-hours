import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { createFurniture, disposeFurnitureAssets, leafClump, LEAF_OUTLINE, MOON_CANOPY } from './furniture.js';
import { FURNITURE } from '../core/catalog.js';
import { ROOM_LIGHTS } from '../features/room/room-lighting.js';

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

test('the desk tea steam is a short soft wisp that fades out at its sides instead of a tall hard ribbon', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const desk = createFurniture('study-desk', scene), cupTop = 1.465, heights = [], hardSides = [];
    for (const seconds of [0.4, 1.3, 2.9]) {
      desk.metadata.animate(seconds, false, false, 0);
      const steam = desk.getChildMeshes(false).find(mesh => mesh.name === 'curling-tea-steam');
      const positions = steam.getVerticesData('position'), colors = steam.getVerticesData('color'), indices = steam.getIndices(), edges = new Map();
      for (let i = 0; i < positions.length / 3; i++) if (colors[i * 4 + 3] > 0.02) heights.push(positions[i * 3 + 1] - cupTop);
      for (let t = 0; t < indices.length; t += 3) for (let k = 0; k < 3; k++) { const [a, b] = [indices[t + k], indices[t + (k + 1) % 3]].sort((x, y) => x - y), key = `${a}:${b}`; edges.set(key, (edges.get(key) ?? 0) + 1); }
      for (const [key, uses] of edges) if (uses === 1) for (const vertex of key.split(':').map(Number)) if (colors[vertex * 4 + 3] > 0.01) hardSides.push(colors[vertex * 4 + 3]);
    }
    const tallest = Math.max(...heights);
    assert.ok(tallest > 0.18 && tallest < 0.36, `the visible steam rises ${tallest.toFixed(2)} m above the cup`);
    assert.deepEqual(hardSides, [], 'every vertex on the outline of the steam is fully transparent');
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('the moon tree grows pads of clearly different sizes and flatness instead of one repeated ball', () => {
  const engine = new NullEngine(), scene = new Scene(engine), pads = [], addMesh = scene.addMesh.bind(scene);
  scene.addMesh = (mesh, recursive) => {
    if (mesh.name === 'moonleaf-clump') mesh.onDisposeObservable.add(() => { const { x, y } = mesh.getBoundingInfo().boundingBox.extendSize; pads.push({ width: x, flatness: y / x }); });
    return addMesh(mesh, recursive);
  };
  try {
    createFurniture('moon-tree', scene);
    const widths = pads.map(pad => pad.width), flatness = pads.map(pad => pad.flatness);
    assert.ok(pads.length >= 20, `the canopy batches ${pads.length} pads`);
    assert.ok(Math.max(...widths) / Math.min(...widths) > 2.5, `the widest pad is ${(Math.max(...widths) / Math.min(...widths)).toFixed(2)}x the narrowest`);
    assert.ok(Math.max(...flatness) - Math.min(...flatness) > 0.2, `pad flatness runs ${Math.min(...flatness).toFixed(2)}-${Math.max(...flatness).toFixed(2)}`);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('the moon tree canopy dims and softens in the dusk and rain light but stays a green that leans to its cool shade instead of khaki, and gets its sunlit green back by day', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const tree = createFurniture('moon-tree', scene), canopy = tree.getChildMeshes(false).find(mesh => mesh.name === 'swaying-leaf-canopy'), day = Array.from(canopy.getVerticesData('color'));
    const median = values => values.sort((a, b) => a - b)[values.length >> 1];
    const look = colors => { const hsv = []; for (let i = 0; i < colors.length; i += 4) hsv.push(new Color3(colors[i], colors[i + 1], colors[i + 2]).toHSV().asArray()); return { hue: median(hsv.map(([h]) => h)), saturation: median(hsv.map(([, s]) => s)) }; };
    const fresh = look(day);
    tree.metadata.lightLeaves(ROOM_LIGHTS.dusk.leaves);
    const dusk = look(Array.from(canopy.getVerticesData('color')));
    assert.ok(fresh.hue > 85 && dusk.hue >= fresh.hue, `the canopy hue goes from ${fresh.hue.toFixed(0)} by day to ${dusk.hue.toFixed(0)} at dusk, so the warm lamps and haze land on a green, not khaki`);
    assert.ok(dusk.saturation < fresh.saturation * 0.75, `the dusk canopy saturation is ${dusk.saturation.toFixed(2)}, against ${fresh.saturation.toFixed(2)} by day`);
    tree.metadata.lightLeaves(ROOM_LIGHTS.rain.leaves);
    const rain = look(Array.from(canopy.getVerticesData('color')));
    assert.ok(rain.hue >= fresh.hue && rain.saturation < fresh.saturation, `the rain canopy hue is ${rain.hue.toFixed(0)} at saturation ${rain.saturation.toFixed(2)}`);
    tree.metadata.lightLeaves(ROOM_LIGHTS.day.leaves);
    assert.deepEqual(Array.from(canopy.getVerticesData('color')), day, 'the day canopy is exactly its own colours');
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('a moon tree in the back-left corner is lit on the side that faces the window and shaded on the side that faces the wall', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const tree = createFurniture('moon-tree', scene), canopy = tree.getChildMeshes(false).find(mesh => mesh.name === 'swaying-leaf-canopy');
    const colors = canopy.getVerticesData('color'), normals = canopy.getVerticesData('normal'), toWindow = [0.77, 0.34, -0.53], lit = [], shade = [];
    for (let v = 0; v < normals.length / 3; v++) {
      const facing = normals[v * 3] * toWindow[0] + normals[v * 3 + 1] * toWindow[1] + normals[v * 3 + 2] * toWindow[2];
      const luma = 0.2126 * colors[v * 4] + 0.7152 * colors[v * 4 + 1] + 0.0722 * colors[v * 4 + 2];
      if (facing > 0.5) lit.push(luma); else if (facing < -0.5) shade.push(luma);
    }
    const median = values => values.sort((a, b) => a - b)[values.length >> 1];
    assert.ok(median(lit) > median(shade) * 1.6, `the window side is ${(median(lit) / median(shade)).toFixed(2)}x the wall side`);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('the moon tree pads shrink from broad low pads to small crown pads, and not every pad has a twin', () => {
  const engine = new NullEngine(), scene = new Scene(engine), pads = [], addMesh = scene.addMesh.bind(scene);
  scene.addMesh = (mesh, recursive) => {
    if (mesh.name === 'moonleaf-clump') mesh.onDisposeObservable.add(() => { const { extendSize, center } = mesh.getBoundingInfo().boundingBox; pads.push({ width: extendSize.x, y: center.y }); });
    return addMesh(mesh, recursive);
  };
  try {
    createFurniture('moon-tree', scene);
    const sorted = [...pads].sort((a, b) => a.y - b.y), third = Math.floor(sorted.length / 3), mean = list => list.reduce((sum, pad) => sum + pad.width, 0) / list.length;
    assert.ok(pads.length < 26, `${pads.length} pads, so some branches end in one pad`);
    assert.ok(mean(sorted.slice(0, third)) > mean(sorted.slice(-third)) * 1.4, `low pads ${mean(sorted.slice(0, third)).toFixed(3)} against crown pads ${mean(sorted.slice(-third)).toFixed(3)}`);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
