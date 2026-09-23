import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Vector3, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { FURNITURE, getFurniture } from './catalog.js';
import { ROOM_BOUNDS, MAX_ITEMS, PRESETS, PET_HOME, createLayout, validatePlacement, normalizeLayout, findFreePosition, nearestValidPlacement, rugsOverlap, pieceCount, petBed, rugStack, rugTouches, groundAt, standHeight, footprintBounds, FLOOR_Y, RUG_STEP, FLAT_RUG } from './layout.js';
import { createFurniture, disposeFurnitureAssets } from './furniture.js';
import { cutRect, subtractRect, openings, OPENING_INSET } from './walls.js';
import { SURFACES } from './surfaces.js';

const placement = (type, x, z, rotation = 0, id = 'test-item') => ({ id, type, x, z, rotation });

test('catalog contains coherent unique furniture definitions and two usable study stations', () => {
  assert.equal(new Set(FURNITURE.map(item => item.id)).size, FURNITURE.length);
  assert.equal(FURNITURE.filter(item => item.category === 'Study').length, 2);
  assert.equal(getFurniture('unknown'), undefined);
  for (const item of FURNITURE) {
    if (item.mount === 'wall') assert.ok(item.size.every(value => value > 0) && item.depth > 0 && !item.blocking && !item.footprint, `${item.id} is a wall piece`);
    else assert.ok(item.footprint.every(value => Number.isFinite(value) && value > 0));
    assert.equal(getFurniture(item.id), item);
    assert.match(item.color, /^#[\da-f]{6}$/i);
  }
});

test('every preset fits the room, clears the cat and other furniture, and has a usable desk', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id);
    assert.ok(layout.items.length <= MAX_ITEMS);
    assert.equal(getFurniture(layout.items.find(item => item.id === layout.activeDeskId)?.type)?.category, 'Study');
    for (const item of layout.items) assert.deepEqual(validatePlacement(layout.items, item, preset.style || 'retreat'), { valid: true, reason: '' }, `${preset.id}: ${item.id}`);
    assert.deepEqual(normalizeLayout(layout), layout);
    layout.items[0].x = 999;
    assert.notEqual(createLayout(preset.id).items[0].x, 999, 'templates are not mutated through a layout');
  }
});

test('quarter turns swap footprint axes before checking room bounds', () => {
  assert.equal(validatePlacement([], placement('bookcase', 5, 0, 1)).valid, true);
  assert.equal(validatePlacement([], placement('bookcase', 5, 0, 0)).valid, false);
  assert.equal(validatePlacement([], placement('bookcase', 0, 0, 4)).valid, false);
  assert.equal(validatePlacement([], placement('plant', NaN, 0)).valid, false);
  assert.equal(validatePlacement([], placement('plant', 0.17, 0)).valid, false);
  assert.equal(validatePlacement([], placement('missing', 0, 0)).valid, false);
});

test('solids cannot overlap, existing objects can move, and rugs can sit under furniture', () => {
  const desk = placement('study-desk', -1.5, -1.5, 0, 'desk');
  assert.equal(validatePlacement([desk], desk).valid, true);
  assert.equal(validatePlacement([desk], placement('plant', -1.5, -1.5)).valid, false);
  assert.equal(validatePlacement([desk], placement('rug', -1.5, -1.5)).valid, true);
  const plant = placement('plant', 2.5, -2.25, 0, 'plant');
  assert.equal(validatePlacement([desk, plant], { ...plant, x: -1.5, z: -1.5 }).valid, false);
});

test('the pet bed keeps its floor space, rugs lie under it, and it moves like any piece', () => {
  const bed = placement('pet-bed', PET_HOME.x, PET_HOME.z, 0, 'bed');
  const result = validatePlacement([bed], placement('plant', 0.75, 1.5));
  assert.equal(result.valid, false); assert.match(result.reason, /pet bed/);
  assert.equal(validatePlacement([bed], placement('rug', 0.25, 1.25)).valid, true);
  assert.equal(validatePlacement([], placement('plant', 0.75, 1.5)).valid, true, 'the old fixed cat spot is ordinary floor once the bed moves');
  assert.equal(validatePlacement([bed], { ...bed, x: -3, z: 2, rotation: 1 }).valid, true);
});

test('every room has exactly one pet bed, and older rooms gain it at the old cat spot', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id), beds = layout.items.filter(item => item.type === 'pet-bed');
    assert.equal(beds.length, 1, preset.id); assert.deepEqual([beds[0].x, beds[0].z], [PET_HOME.x, PET_HOME.z]);
  }
  // A save from before the bed: the cat's reserved spot is still clear.
  const old = normalizeLayout({ presetId: 'ember-library', activeDeskId: 'desk', items: [placement('study-desk', -2, -3, 0, 'desk'), placement('rug', 0, 1.5, 0, 'rug')] });
  assert.deepEqual(petBed(old), { id: 'pet-bed', type: 'pet-bed', x: PET_HOME.x, z: PET_HOME.z, rotation: 0 });
  // When a piece already stands there, the bed takes the first free spot.
  const crowded = normalizeLayout({ activeDeskId: 'desk', items: [placement('study-desk', -2, -3, 0, 'desk'), placement('plant', 0.75, 1.5, 0, 'plant')] });
  assert.equal(validatePlacement(crowded.items, petBed(crowded)).valid, true); assert.equal(crowded.items.length, 3);
  // A second bed is dropped, and a moved bed keeps its place and turn.
  const doubled = normalizeLayout({ activeDeskId: 'desk', items: [placement('study-desk', -2, -3, 0, 'desk'), placement('pet-bed', -3, 2, 1, 'mine'), placement('pet-bed', 3, 2, 0, 'extra')] });
  assert.deepEqual(doubled.items.filter(item => item.type === 'pet-bed').map(item => [item.id, item.x, item.z, item.rotation]), [['mine', -3, 2, 1]]);
  // The bed never uses up the room's piece budget.
  const full = [...Array.from({ length: MAX_ITEMS }, (_, index) => placement('rug', 0, 0, 0, `rug-${index}`))];
  assert.equal(validatePlacement(full, placement('pet-bed', 3, 2)).valid, true);
  assert.equal(pieceCount([...full, placement('pet-bed', 3, 2)]), MAX_ITEMS);
  assert.equal(normalizeLayout({ activeDeskId: 'desk', items: [placement('study-desk', -2, -3, 0, 'desk'), ...full.slice(1)] }).items.length, MAX_ITEMS + 1);
});

test('the item budget blocks additions while allowing existing items to move', () => {
  const items = Array.from({ length: MAX_ITEMS }, (_, index) => placement('rug', 0, 0, 0, `rug-${index}`));
  assert.equal(validatePlacement(items, placement('rug', 0, 0)).valid, false);
  assert.equal(validatePlacement(items, { ...items[0], x: 0.25 }).valid, true);
  assert.equal(findFreePosition(items, 'rug'), null);
});

test('restore sanitizes positions and IDs, drops broken or overlapping objects, and repairs active desk', () => {
  const restored = normalizeLayout({
    presetId: 'invented-preset', activeDeskId: 'plant',
    items: [
      placement('study-desk', -1.48, -1.49, 0, 'desk'),
      placement('plant', 2.5, -2.25, 0, 'desk'),
      placement('plant', -1.5, -1.5, 0, 'overlap'),
      placement('missing', 0, 0), null, placement('plant', Infinity, 0),
      placement('bookcase', 3.25, 0.5, 1, 'books'),
    ],
  });
  assert.equal(restored.presetId, null);
  assert.equal(restored.activeDeskId, 'desk');
  assert.equal(restored.items.length, 4);
  assert.equal(restored.items.at(-1).type, 'pet-bed', 'a room without a bed gains one');
  assert.deepEqual([restored.items[0].x, restored.items[0].z], [-1.5, -1.5]);
  assert.equal(new Set(restored.items.map(item => item.id)).size, restored.items.length);
  restored.items.forEach(item => assert.equal(validatePlacement(restored.items, item).valid, true));
});

test('empty, malformed, or deskless restored rooms recover a usable preset', () => {
  for (const invalid of [null, undefined, {}, { items: [] }, { items: [placement('plant', 2.5, -2.25)] }, { items: [placement('unknown', 0, 0)] }]) {
    assert.deepEqual(normalizeLayout(invalid), createLayout());
  }
  assert.deepEqual(normalizeLayout({ presetId: 'moonlit-greenhouse', items: [] }), createLayout('moonlit-greenhouse'));
  assert.deepEqual(createLayout('unknown'), createLayout());
});

test('free placement search returns valid snapped spots for every catalog item and rotation', () => {
  for (const definition of FURNITURE.filter(entry => entry.mount !== 'wall')) for (let rotation = 0; rotation < 4; rotation++) {
    const point = findFreePosition([], definition.id, rotation);
    assert.ok(point, `${definition.id} rotation ${rotation}`);
    assert.equal(validatePlacement([], { ...point, type: definition.id, rotation }).valid, true);
    assert.equal(point.x % 0.25, 0); assert.equal(Math.abs(point.z % 0.25), 0);
  }
  assert.equal(findFreePosition([], 'missing'), null);
  assert.equal(findFreePosition([], 'plant', 4), null);
  assert.ok(ROOM_BOUNDS.maxX > ROOM_BOUNDS.minX);
});

test('native Babylon furniture meshes fit declared footprints and the room height in every rotation', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const definition of FURNITURE) {
      const furniture = createFurniture(definition.id, scene);
      assert.ok(furniture.getChildMeshes().length <= 9, `${definition.id} stays within its draw budget`);
      if (definition.mount === 'wall') {
        // A wall piece fills its rectangle on the wall and stands out no further
        // than its depth; a window's view hangs behind the wall, in its opening.
        furniture.position.y = 0; furniture.getChildMeshes().forEach(part => part.computeWorldMatrix(true));
        const view = furniture.metadata.view;
        assert.equal(Boolean(view), Boolean(definition.opening), `${definition.id} has a view only if it is a window`);
        if (view) assert.ok(view.position.z < -0.25 && view.metadata.castShadow === false, `${definition.id} shows its view behind the wall and casts no shadow`);
        const { min, max } = furniture.getHierarchyBoundingVectors(true, mesh => mesh !== view), [width, height] = definition.size, epsilon = 0.003;
        assert.ok(min.x >= -width / 2 - epsilon && max.x <= width / 2 + epsilon && min.y >= -height / 2 - epsilon && max.y <= height / 2 + epsilon, `${definition.id} fits its wall rectangle`);
        assert.ok(min.z >= -epsilon && max.z <= definition.depth + epsilon, `${definition.id} stands out ${definition.depth} or less`);
        furniture.dispose(); continue;
      }
      for (let rotation = 0; rotation < 4; rotation++) {
        furniture.rotation.y = rotation * Math.PI / 2;
        furniture.getChildMeshes().forEach(part => part.computeWorldMatrix(true));
        const bounds = furniture.getHierarchyBoundingVectors();
        const [width, depth] = rotation % 2 ? [...definition.footprint].reverse() : definition.footprint;
        const epsilon = 0.00001;
        assert.ok(bounds.min.x >= -width / 2 - epsilon && bounds.max.x <= width / 2 + epsilon, `${definition.id} width at ${rotation}`);
        assert.ok(bounds.min.z >= -depth / 2 - epsilon && bounds.max.z <= depth / 2 + epsilon, `${definition.id} depth at ${rotation}`);
        assert.ok(bounds.min.y >= 0.22 - epsilon, `${definition.id} rests on the floor`);
        assert.ok(bounds.max.y < 5.3, `${definition.id} fits below the walls`);
        const model = furniture.getHierarchyBoundingVectors(true, mesh => !['tea-steam', 'hearth-embers'].includes(mesh.metadata?.effect));
        assert.ok(Math.abs(model.max.y - 0.22 - definition.height) < 0.011, `${definition.id} height matches its model`);
      }
      furniture.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('furniture instances share static geometry, retain independent avatars, and honor reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const first = createFurniture('study-desk', scene), second = createFurniture('study-desk', scene);
    assert.equal(first.getChildMeshes()[0].geometry, second.getChildMeshes()[0].geometry);
    assert.notEqual(first.metadata.avatar, second.metadata.avatar);
    assert.equal(first.metadata.study, true);
    first.metadata.animate(1.3, true, false);
    const hands = first.metadata.avatar.getChildren().filter(child => child.name === 'typing-hand');
    assert.equal(hands.length, 2);
    assert.notEqual(hands[0].position.y, 1.37);
    first.metadata.animate(2.2, true, true);
    hands.forEach(hand => assert.equal(hand.position.y, 1.37));
    first.dispose();
    assert.equal(second.getChildMeshes()[0].geometry.isDisposed(), false);
    second.dispose();
    disposeFurnitureAssets(scene);
    const fresh = createFurniture('plant', scene);
    assert.equal(fresh.getChildMeshes().length, 2);
    fresh.dispose();
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('fire flickers independently without moving the mantel or changing shared materials', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const first = createFurniture('fireplace', scene), second = createFurniture('fireplace', scene);
    const flames = item => item.getChildMeshes().find(mesh => mesh.metadata?.effect === 'hearth-flames');
    const firstFlames = flames(first), secondFlames = flames(second);
    const neutral = Array.from(firstFlames.getVerticesData('position'));
    const otherNeutral = Array.from(secondFlames.getVerticesData('position'));
    const stone = first.getChildMeshes().find(mesh => !mesh.metadata?.dynamic);
    const stonePositions = Array.from(stone.getVerticesData('position'));
    const glow = firstFlames.material.emissiveColor.asArray();
    assert.equal(first.getChildMeshes().length, 4, 'flames and embers each use one batched draw call');
    assert.equal(firstFlames.isEnabled(), true);
    assert.notEqual(firstFlames.geometry, secondFlames.geometry, 'animated buffers belong to each instance');
    assert.equal(firstFlames.material, secondFlames.material, 'unchanging material stays shared');
    first.metadata.animate(1.7, false, false);
    assert.notDeepEqual(Array.from(firstFlames.getVerticesData('position')), neutral);
    assert.deepEqual(Array.from(secondFlames.getVerticesData('position')), otherNeutral);
    assert.deepEqual(Array.from(stone.getVerticesData('position')), stonePositions);
    assert.deepEqual(firstFlames.material.emissiveColor.asArray(), glow);
    first.metadata.animate(22, false, true);
    assert.deepEqual(Array.from(firstFlames.getVerticesData('position')), neutral);
    first.metadata.animate(123, false, true);
    assert.deepEqual(Array.from(firstFlames.getVerticesData('position')), neutral);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('tea curls and fades in one small mesh, stays inside its furniture footprint, and resets exactly', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const type of ['study-desk', 'writing-desk', 'side-table']) {
      const furniture = createFurniture(type, scene);
      const steam = furniture.getChildMeshes().find(mesh => mesh.metadata?.effect === 'tea-steam');
      const neutralPositions = Array.from(steam.getVerticesData('position'));
      const neutralColors = Array.from(steam.getVerticesData('color'));
      assert.equal(steam.getTotalIndices() / 3, 56);
      assert.equal(steam.isPickable, false);
      const [width, depth] = getFurniture(type).footprint;
      for (const seconds of [0.4, 1.7, 3.2, 7.8]) {
        furniture.metadata.animate(seconds, true, false);
        const positions = steam.getVerticesData('position');
        for (let index = 0; index < positions.length; index += 3) {
          assert.ok(Math.abs(positions[index]) <= width / 2);
          assert.ok(Math.abs(positions[index + 2]) <= depth / 2);
          assert.ok(positions[index + 1] > 0 && positions[index + 1] < 5.3);
        }
      }
      assert.notDeepEqual(Array.from(steam.getVerticesData('position')), neutralPositions);
      assert.notDeepEqual(Array.from(steam.getVerticesData('color')), neutralColors);
      furniture.metadata.animate(28, true, true);
      assert.deepEqual(Array.from(steam.getVerticesData('position')), neutralPositions);
      assert.deepEqual(Array.from(steam.getVerticesData('color')), neutralColors);
      furniture.metadata.animate(83, true, true);
      assert.deepEqual(Array.from(steam.getVerticesData('position')), neutralPositions);
      furniture.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('the avatar types at its laptop, writes at its journal, and rests its hands when focus is paused', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const type of ['study-desk', 'writing-desk']) {
      const furniture = createFurniture(type, scene);
      const avatar = furniture.metadata.avatar;
      const hands = avatar.getChildren().filter(node => node.name === 'typing-hand');
      const head = avatar.getChildren().find(node => node.name === 'headphones');
      furniture.metadata.animate(1.7, true, false);
      assert.notEqual(hands[1].position.y, 1.37);
      assert.notEqual(head.rotation.x, 0);
      if (type === 'writing-desk') assert.notEqual(hands[1].position.x, 0.21);
      furniture.metadata.animate(2.4, false, false);
      assert.deepEqual(hands.map(hand => hand.position.asArray()), [[-0.21, 1.37, -0.94], [0.21, 1.37, -0.94]]);
      furniture.metadata.animate(9.8, true, true);
      assert.deepEqual(head.position.asArray(), [0, 1.80, -0.17]);
      assert.deepEqual(head.rotation.asArray(), [0, 0, 0]);
      hands.forEach(hand => assert.deepEqual(hand.rotation.asArray(), [0, 0, 0]));
      // Starting at what used to be the global clock's thinking phase must
      // still produce visible work promptly, including after a pause.
      furniture.metadata.animate(18.2, true, false);
      furniture.metadata.animate(18.7, true, false);
      assert.ok(head.position.z < -0.28, 'a new session settles visibly toward the desk');
      furniture.metadata.animate(19, false, false);
      furniture.metadata.animate(28.7, true, false);
      furniture.metadata.animate(29.2, true, false);
      assert.ok(head.position.z < -0.28, 'resuming starts work instead of a clock-dependent pause');
      if (type === 'study-desk') {
        furniture.metadata.animate(33.65, true, false);
        assert.ok(Math.abs(hands[1].position.x - 0.025) < 1e-5 && Math.abs(hands[1].position.z + 0.76) < 1e-5, 'the right hand reaches the actual trackpad');
      }
      furniture.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('plant canopies sway while paused, keep their trunks planted, and reset their independent buffers', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const type of ['plant', 'moon-tree']) {
      const first = createFurniture(type, scene), second = createFurniture(type, scene);
      const leafMesh = furniture => furniture.getChildMeshes().find(mesh => mesh.metadata?.effect === 'leaf-sway');
      const canopy = leafMesh(first), otherCanopy = leafMesh(second);
      const neutral = Array.from(canopy.getVerticesData('position'));
      const otherNeutral = Array.from(otherCanopy.getVerticesData('position'));
      const staticParts = first.getChildMeshes().filter(mesh => !mesh.metadata?.dynamic);
      const staticPositions = staticParts.map(mesh => Array.from(mesh.getVerticesData('position')));
      assert.equal(first.getChildMeshes().length, type === 'plant' ? 2 : 3);
      assert.equal(canopy.material, otherCanopy.material);
      assert.notEqual(canopy.geometry, otherCanopy.geometry);
      assert.equal(canopy.isEnabled(), true);
      const [width, depth] = getFurniture(type).footprint;
      let travel = 0;
      for (let sample = 0; sample < 40; sample++) {
        first.metadata.animate(sample * 0.55, false, false);
        const positions = canopy.getVerticesData('position');
        for (let index = 0; index < positions.length; index += 3) {
          assert.ok(Math.abs(positions[index]) <= width / 2);
          assert.ok(Math.abs(positions[index + 2]) <= depth / 2);
          assert.ok(positions[index + 1] > 0 && positions[index + 1] < 5.3);
          travel = Math.max(travel, Math.abs(positions[index] - neutral[index]));
        }
      }
      assert.ok(travel >= (type === 'plant' ? 0.055 : 0.085), `${type} has visible leaf-tip travel`);
      assert.deepEqual(staticParts.map(mesh => Array.from(mesh.getVerticesData('position'))), staticPositions);
      assert.deepEqual(Array.from(otherCanopy.getVerticesData('position')), otherNeutral);
      first.metadata.animate(44, false, true);
      assert.deepEqual(Array.from(canopy.getVerticesData('position')), neutral);
      first.metadata.animate(123, true, true);
      assert.deepEqual(Array.from(canopy.getVerticesData('position')), neutral);
      first.dispose(); second.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('the record spins with shared geometry while its cabinet and tonearm remain still', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const first = createFurniture('low-cabinet', scene), second = createFurniture('low-cabinet', scene);
    const recordNode = furniture => furniture.getChildren().find(node => node.metadata?.effect === 'record-spin');
    const record = recordNode(first), otherRecord = recordNode(second);
    const disc = record.getChildMeshes()[0], otherDisc = otherRecord.getChildMeshes()[0];
    const cabinet = first.getChildMeshes().find(mesh => !mesh.metadata?.dynamic);
    const cabinetPositions = Array.from(cabinet.getVerticesData('position'));
    const discPositions = Array.from(disc.getVerticesData('position'));
    assert.equal(first.getChildMeshes().length, 2, 'the disc adds exactly one draw call');
    assert.equal(disc.geometry, otherDisc.geometry);
    assert.equal(disc.material, otherDisc.material);
    const [width, depth] = getFurniture('low-cabinet').footprint;
    for (let sample = 0; sample < 20; sample++) {
      first.metadata.animate(sample * 0.6, false, false);
      first.getChildMeshes().forEach(mesh => mesh.computeWorldMatrix(true));
      const bounds = first.getHierarchyBoundingVectors();
      assert.ok(bounds.min.x >= -width / 2 && bounds.max.x <= width / 2);
      assert.ok(bounds.min.z >= -depth / 2 && bounds.max.z <= depth / 2);
    }
    assert.notEqual(record.rotation.y, 0);
    assert.equal(otherRecord.rotation.y, 0);
    assert.deepEqual(record.position.asArray(), [-0.33, 1.006, -0.01]);
    assert.deepEqual(Array.from(cabinet.getVerticesData('position')), cabinetPositions);
    assert.deepEqual(Array.from(disc.getVerticesData('position')), discPositions);
    first.metadata.animate(92, false, true);
    assert.equal(record.rotation.y, 0);
    first.metadata.animate(123, false, true);
    assert.equal(record.rotation.y, 0);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('hearth embers rise and fade inside their footprint, with no particles in reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const fireplace = createFurniture('fireplace', scene);
    const embers = fireplace.getChildMeshes().find(mesh => mesh.metadata?.effect === 'hearth-embers');
    const neutralPositions = Array.from(embers.getVerticesData('position'));
    const neutralColors = Array.from(embers.getVerticesData('color'));
    assert.equal(embers.getTotalIndices() / 3, 64);
    assert.equal(embers.isPickable, false);
    assert.equal(embers.receiveShadows, false);
    assert.equal(embers.metadata.castShadow, false);
    fireplace.metadata.animate(1, false, false);
    assert.ok(embers.getVerticesData('position')[1] > neutralPositions[1], 'particles travel upwards');
    assert.notDeepEqual(Array.from(embers.getVerticesData('color')), neutralColors);
    const [width, depth] = getFurniture('fireplace').footprint;
    for (let sample = 0; sample < 100; sample++) {
      fireplace.metadata.animate(sample * 0.37, false, false);
      const positions = embers.getVerticesData('position'), colors = embers.getVerticesData('color');
      for (let index = 0; index < positions.length; index += 3) {
        assert.ok(Math.abs(positions[index]) < width / 2);
        assert.ok(Math.abs(positions[index + 2]) < depth / 2);
        assert.ok(positions[index + 1] > 0 && positions[index + 1] < 5.3);
      }
      for (let index = 3; index < colors.length; index += 4) assert.ok(colors[index] >= 0 && colors[index] <= 1);
    }
    fireplace.metadata.animate(50, false, true);
    assert.equal(embers.isEnabled(), false);
    assert.deepEqual(Array.from(embers.getVerticesData('position')), neutralPositions);
    assert.deepEqual(Array.from(embers.getVerticesData('color')), neutralColors);
    fireplace.metadata.animate(99, false, true);
    assert.deepEqual(Array.from(embers.getVerticesData('position')), neutralPositions);
    fireplace.metadata.animate(100, false, false);
    assert.equal(embers.isEnabled(), true);
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('typing and thinking move the upper body with connected wrists, grounded legs, and a still hidden avatar', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const type of ['study-desk', 'writing-desk']) {
      const furniture = createFurniture(type, scene), avatar = furniture.metadata.avatar;
      const upper = avatar.getChildMeshes().find(mesh => mesh.metadata?.part === 'avatar-upper-body');
      const legs = avatar.getChildren().find(node => node.name === 'grounded-trousers-and-shoes');
      const legPositions = Array.from(legs.getChildMeshes()[0].getVerticesData('position'));
      const neutralUpper = Array.from(upper.getVerticesData('position'));
      const head = avatar.getChildren().find(node => node.name === 'headphones');
      const hands = avatar.getChildren().filter(node => node.name === 'typing-hand');
      const steam = furniture.getChildMeshes().find(mesh => mesh.metadata?.effect === 'tea-steam');
      assert.equal(upper.isEnabled(), true);
      const wristIndices = [-1, 1].map(side => {
        let closest = -1, distance = Infinity;
        for (let index = 0; index < neutralUpper.length; index += 3) {
          const squared = (neutralUpper[index] - side * 0.21) ** 2 + (neutralUpper[index + 1] - 1.37) ** 2 + (neutralUpper[index + 2] + 0.87) ** 2;
          if (squared < distance) { closest = index; distance = squared; }
        }
        assert.ok(distance < 1e-10, 'forearm has an exact wrist attachment'); return closest;
      });
      for (const seconds of [1.7, 3.6, 6.3, 8.2, 12.1]) {
        furniture.metadata.animate(seconds, true, false);
        const positions = upper.getVerticesData('position');
        for (let side = 0; side < 2; side++) {
          const index = wristIndices[side], hand = hands[side].position;
          assert.ok(Math.abs(positions[index] - hand.x) < 1e-5);
          assert.ok(Math.abs(positions[index + 1] - hand.y) < 1e-5);
          assert.ok(Math.abs(positions[index + 2] - (hand.z + 0.07)) < 1e-5);
        }
      }
      furniture.metadata.animate(2.7, true, false); const workingHeadZ = head.position.z;
      furniture.metadata.animate(8.5, true, false);
      assert.ok(head.position.z - workingHeadZ > 0.14, 'a thinking pause changes the seated lean visibly at room scale');
      assert.deepEqual(hands.map(hand => hand.position.asArray()), [[-0.21, 1.37, -0.94], [0.21, 1.37, -0.94]]);
      assert.deepEqual(Array.from(legs.getChildMeshes()[0].getVerticesData('position')), legPositions);
      assert.deepEqual(legs.position.asArray(), [0, 0, 0]); assert.deepEqual(legs.rotation.asArray(), [0, 0, 0]);
      const beforeHidden = Array.from(upper.getVerticesData('position')), beforeSteam = Array.from(steam.getVerticesData('position'));
      avatar.setEnabled(false); furniture.metadata.animate(13, true, false);
      assert.deepEqual(Array.from(upper.getVerticesData('position')), beforeHidden);
      assert.notDeepEqual(Array.from(steam.getVerticesData('position')), beforeSteam);
      avatar.setEnabled(true); furniture.metadata.animate(22, true, true);
      assert.deepEqual(Array.from(upper.getVerticesData('position')), neutralUpper);
      assert.deepEqual(head.position.asArray(), [0, 1.80, -0.17]);
      furniture.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('sleeves stay joined at both elbows and above the tabletop throughout typing, trackpad use, and writing', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const type of ['study-desk', 'writing-desk']) {
      const furniture = createFurniture(type, scene), avatar = furniture.metadata.avatar;
      const upper = avatar.getChildMeshes().find(mesh => mesh.metadata?.part === 'avatar-upper-body');
      const neutral = Array.from(upper.getVerticesData('position')), neutralNormals = Array.from(upper.getVerticesData('normal'));
      const { ranges, joints } = upper.metadata.rig;
      const armRanges = ranges.filter(range => range.arm);
      const capCenters = armRanges.map(range => [range.a, range.b].map(point => {
        let closest = -1, distance = Infinity;
        for (let vertex = range.start; vertex < range.end; vertex++) {
          const index = vertex * 3;
          const squared = point.reduce((sum, value, axis) => sum + (neutral[index + axis] - value) ** 2, 0);
          if (squared < distance) { closest = index; distance = squared; }
        }
        assert.ok(distance < 1e-10); return closest;
      }));
      furniture.metadata.animate(0, true, false);
      for (let sample = 0; sample < 660; sample++) {
        furniture.metadata.animate(sample / 60, true, false);
        const positions = upper.getVerticesData('position'), normals = upper.getVerticesData('normal');
        for (let arm = 0; arm < armRanges.length; arm++) {
          const range = armRanges[arm], joint = joints[range.side < 0 ? 0 : 1];
          const anchors = range.forearm ? [joint.elbow, joint.wrist] : [joint.shoulder, joint.elbow];
          for (let end = 0; end < 2; end++) {
            const index = capCenters[arm][end], target = anchors[end].asArray();
            for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(positions[index + axis] - target[axis]) < 1e-5, 'both segments meet the same rounded joint');
          }
          for (let vertex = range.start; vertex < range.end; vertex++) {
            const index = vertex * 3, x = positions[index], y = positions[index + 1], z = positions[index + 2];
            if (z <= -0.44) assert.ok(y >= 1.25, `${type} sleeve clears the tabletop`);
            if (Math.abs(x) <= 0.485 && z <= -0.64 && z >= -1.26) assert.ok(y >= 1.312, `${type} sleeve clears the laptop base`);
            assert.ok(Math.abs(Math.hypot(normals[index], normals[index + 1], normals[index + 2]) - 1) < 1e-5, 'deformed lighting normals remain normalized');
          }
        }
      }
      assert.notDeepEqual(Array.from(upper.getVerticesData('normal')), neutralNormals, 'lighting follows the posed sleeves');
      furniture.metadata.animate(12, true, true);
      assert.deepEqual(Array.from(upper.getVerticesData('position')), neutral);
      assert.deepEqual(Array.from(upper.getVerticesData('normal')), neutralNormals);
      furniture.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('crossed ember faces remain visible in every fireplace orientation and across the camera orbit', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const fireplace = createFurniture('fireplace', scene);
    const embers = fireplace.getChildMeshes().find(mesh => mesh.metadata?.effect === 'hearth-embers');
    assert.equal(fireplace.getChildMeshes().filter(mesh => mesh.metadata?.effect === 'hearth-embers').length, 1);
    for (const seconds of [1.2, 4.8]) {
      fireplace.metadata.animate(seconds, false, false);
      const positions = embers.getVerticesData('position');
      for (let rotation = 0; rotation < 4; rotation++) {
        fireplace.rotation.y = rotation * Math.PI / 2; embers.computeWorldMatrix(true);
        const world = embers.getWorldMatrix();
        for (const azimuth of [Math.PI / 18, 0.55, Math.PI / 4, Math.atan2(12.4, 10.5), 1.22, Math.PI * 4 / 9]) {
          const screenRight = new Vector3(-Math.sin(azimuth), 0, Math.cos(azimuth));
          for (let particle = 0; particle < 16; particle++) {
            let bestProjection = 0;
            for (let plane = 0; plane < 2; plane++) {
              const left = (particle * 8 + plane * 4) * 3, right = left + 6;
              const edge = new Vector3(positions[right] - positions[left], positions[right + 1] - positions[left + 1], positions[right + 2] - positions[left + 2]);
              const direction = Vector3.TransformNormal(edge, world).normalize();
              bestProjection = Math.max(bestProjection, Math.abs(Vector3.Dot(direction, screenRight)));
            }
            assert.ok(bestProjection >= Math.SQRT1_2 - 1e-5, `particle ${particle}, turn ${rotation}, azimuth ${azimuth} retains visible width`);
          }
        }
      }
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('a blocked spot resolves to the closest free spot nearby, and only nearby', () => {
  const desk = placement('study-desk', -1.5, -1.5, 0, 'desk');
  // A plant dropped on the desk edge slides just clear of it.
  const edge = nearestValidPlacement([desk], placement('plant', 0, -1.5));
  assert.deepEqual(edge, { x: 0.5, z: -1.5 });
  assert.equal(validatePlacement([desk], { ...placement('plant', 0, -1.5), ...edge }).valid, true);
  // Deep inside the desk, nothing free lies within reach, so the drop fails.
  assert.equal(nearestValidPlacement([desk], placement('plant', -1.5, -1.5)), null);
  // A sofa pushed past the wall comes back inside the room.
  const wall = nearestValidPlacement([], placement('daybed', 4.5, 0));
  assert.deepEqual(wall, { x: 3.75, z: 0 });
  // The piece being moved never blocks itself.
  assert.deepEqual(nearestValidPlacement([desk], { ...desk, x: -1.25 }), { x: -1.25, z: -1.5 });
  assert.equal(nearestValidPlacement([], placement('missing', 0, 0)), null);
});

test('rugs overlap by their woven outline: rectangles, and a circle for the round rug', () => {
  const rug = (x, z, rotation = 0, type = 'rug') => ({ id: `${type}-${x}-${z}`, type, x, z, rotation });
  assert.equal(rugsOverlap(rug(0, 0), rug(3.25, 0)), true);
  assert.equal(rugsOverlap(rug(0, 0), rug(3.5, 0)), false, 'touching edges do not count');
  assert.equal(rugsOverlap(rug(0, 0), rug(0, 0, 1)), true);
  assert.equal(rugsOverlap(rug(0, 0, 0, 'moon-rug'), rug(3.5, 0, 0, 'moon-rug')), true);
  // The corner of the round rug's square footprint is bare floor.
  assert.equal(rugsOverlap(rug(0, 0, 0, 'moon-rug'), rug(3, 2.75)), false);
  assert.equal(rugsOverlap(rug(0, 0, 0, 'moon-rug'), rug(2.5, 0)), true);
  const ember = createLayout('ember-library').items;
  assert.equal(rugsOverlap(ember.find(item => item.id === 'ember-moon-rug'), ember.find(item => item.id === 'ember-cat-rug')), true);
});

test('pieces stand on the woven layers that the rug models build, in every quarter turn', () => {
  // A ray straight down finds each model's top. Away from the rounded layer
  // edges, a piece never floats over the weave and sinks at most into a thin
  // motif: the diamonds of the woven rug or the stars of the moon rug.
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    for (const [type, sink, edges] of [['rug', 0.0046, [[1.62, 1.10], [1.54, 1.015], [1.415, 0.885], [1.35, 0.82]]], ['moon-rug', 0.0125, [[1.67], [1.59], [1.48], [1.36], [0.47, -0.09, -0.10], [0.42, 0.09, -0.16]]]]) {
      const model = createFurniture(type, scene), parts = new Set(model.getChildMeshes());
      for (let rotation = 0; rotation < 4; rotation++) {
        const item = { id: type, type, x: 0.5, z: -0.25, rotation }, stack = rugStack([item]), angle = rotation * Math.PI / 2;
        model.position.set(item.x, FLOOR_Y, item.z); model.rotation.y = angle; model.getChildMeshes().forEach(part => part.computeWorldMatrix(true));
        let checked = 0;
        for (let u = -1.6; u <= 1.6; u += 0.1) for (let v = -1.6; v <= 1.6; v += 0.1) {
          // The rug's own space, then the room.
          const nearEdge = edges.some(([a, b, c]) => type === 'moon-rug' ? Math.abs(Math.hypot(u - (b ?? 0), v - (c ?? 0)) - a) < 0.07 : Math.abs(Math.abs(u) - a) < 0.07 && Math.abs(v) < b + 0.07 || Math.abs(Math.abs(v) - b) < 0.07 && Math.abs(u) < a + 0.07);
          const inside = type === 'moon-rug' ? Math.hypot(u, v) < 1.6 : Math.abs(u) < 1.55 && Math.abs(v) < 1.03;
          if (nearEdge || !inside) continue;
          const x = item.x + u * Math.cos(angle) + v * Math.sin(angle), z = item.z - u * Math.sin(angle) + v * Math.cos(angle);
          const hit = scene.pickWithRay(new Ray(new Vector3(x, 1, z), new Vector3(0, -1, 0), 2), mesh => parts.has(mesh));
          assert.ok(hit.hit, `${type} ${rotation}: the model is under ${u.toFixed(2)},${v.toFixed(2)}`);
          const ground = groundAt(stack, x, z), top = hit.pickedPoint.y;
          assert.ok(ground <= top + 0.001 && top - ground <= sink, `${type} ${rotation} at ${u.toFixed(2)},${v.toFixed(2)}: stands at ${ground.toFixed(4)}, the weave is at ${top.toFixed(4)}`);
          checked++;
        }
        assert.ok(checked > 300, `${type}: ${checked} points`);
      }
      model.dispose();
    }
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('rugs stack in layout order, a covered rug lies flat, and a floor piece stands on the rug under most of it', () => {
  const rug = (id, x, z, rotation = 0, type = 'rug') => ({ id, type, x, z, rotation }), piece = (type, x, z, rotation = 0) => ({ id: type, type, x, z, rotation });
  const near = (value, goal, label) => assert.ok(Math.abs(value - goal) < 1e-9, `${label}: ${value}, not ${goal}`);
  const field = FLOOR_Y + 0.0515, moonField = FLOOR_Y + 0.0675;
  // One rug: its field, its border layers, then bare floor.
  let stack = rugStack([rug('a', 0, 0)]);
  assert.deepEqual(stack.map(({ y, flat }) => [y, flat]), [[FLOOR_Y, false]]);
  near(groundAt(stack, 0, 0), field, 'the middle');
  near(groundAt(stack, 1.5, 0), FLOOR_Y + 0.040, 'the border');
  near(groundAt(stack, 1.7, 0), FLOOR_Y, 'past the woven base, the fringe is floor');
  near(groundAt(stack, 3, 3), FLOOR_Y, 'away from the rug');
  near(groundAt([], 0, 0, 0.2275), 0.2275, 'a raised floor counts when no rug is there');
  // A quarter turn swaps the long and the short side.
  stack = rugStack([rug('a', 0, 0, 1)]);
  near(groundAt(stack, 0, 1.3), field, 'along the long side of the turned rug');
  near(groundAt(stack, 1.3, 0), FLOOR_Y, 'past its short side');
  // The round rug: the moon motif, the field, and bare floor in the corners of its square.
  stack = rugStack([rug('m', 0, 0, 0, 'moon-rug')]);
  near(groundAt(stack, 0.09, -0.16), FLOOR_Y + 0.08, 'on the moon');
  near(groundAt(stack, 0.9, 0.5), moonField, 'on the field');
  near(groundAt(stack, 1.7, 1.7), FLOOR_Y, 'in a corner of its square');
  assert.equal(rugTouches(stack[0], footprintBounds(piece('plant', 1.9, 1.9))), false, 'a pot in the corner is off the round rug');
  assert.equal(rugTouches(stack[0], footprintBounds(piece('plant', 1.5, 0))), true, 'a pot at its edge touches it');
  // A later rug lies on top; the one it covers lies flat.
  stack = rugStack([rug('a', 0, 0), rug('b', 1.5, 0), rug('c', 6, 0), piece('side-table', 0, 0)]);
  assert.deepEqual(stack.map(({ item, flat }) => [item.id, flat]), [['a', true], ['b', false], ['c', false]], 'only rugs stack');
  near(stack[1].y, FLOOR_Y + RUG_STEP, 'the second rug'); near(stack[0].top, FLOOR_Y + FLAT_RUG, 'the flat rug');
  near(groundAt(stack, -1, 0), FLOOR_Y + 0.0515 * FLAT_RUG / 0.056, 'the flat rug keeps a thin field');
  near(groundAt(stack, 1.5, 0), FLOOR_Y + RUG_STEP + 0.0515, 'the rug on top');
  // Pieces: on the field, mostly off, half on, on the upper rug, and pieces that never rise.
  stack = rugStack([rug('a', 0, 0)]);
  near(standHeight(piece('side-table', 0, 0), stack), field, 'a table on the rug');
  near(standHeight(piece('plant', 1.6, 1.0), stack), FLOOR_Y, 'a pot over one corner of the rug');
  near(standHeight(piece('ottoman', 1.4, 0), stack), FLOOR_Y + 0.046, 'an ottoman over the edge stands on the layer under 3 of its 5 points');
  near(standHeight(piece('floor-lamp', 0.9, 0.5, 1), stack), field, 'turned pieces too');
  near(standHeight(piece('rug', 0, 0), stack), FLOOR_Y, 'a rug is not lifted by the rug under it');
  near(standHeight(piece('cottage-window', 0, 0), stack), FLOOR_Y, 'nor a wall piece');
  near(standHeight(piece('side-table', 5, 0), []), FLOOR_Y, 'no rugs, the floor');
});

test('on the sakura tatami the rugs lie on its stripes, and a covered rug stays above them', () => {
  // architecture.js: the tatami stripes stand at 0.2275, above a flat rug's weave on FLOOR_Y.
  const tatami = 0.2275, rug = (id, type, x) => ({ id, type, x, z: 0, rotation: 0 });
  const stack = rugStack([rug('a', 'rug', 0), rug('b', 'moon-rug', 1.2), rug('c', 'rug', 2.4)], tatami);
  assert.deepEqual(stack.map(({ item, flat }) => [item.id, flat]), [['a', true], ['b', true], ['c', false]]);
  stack.forEach((layer, index) => {
    assert.ok(Math.abs(layer.y - (tatami + index * RUG_STEP)) < 1e-9, `${layer.item.id} lies at ${layer.y}`);
    const lowest = layer.y + Math.min(...layer.weave.map(weave => weave[4])) * layer.scale;
    assert.ok(lowest > tatami + 0.002, `${layer.item.id}: its lowest weave at ${lowest.toFixed(4)} clears the stripes`);
    if (layer.flat) assert.ok(layer.top < stack[index + 1].y, `${layer.item.id} lies flat under the next rug`);
  });
  assert.ok(Math.abs(groundAt(stack, 3, 0) - (tatami + 2 * RUG_STEP + 0.0515)) < 1e-9, 'a piece on the top rug stands on its field');
});

test('switched-off lamps, fires and record players stay off after a reload; other pieces never save it', () => {
  const layout = createLayout('ember-library');
  layout.items.find(item => item.id === 'ember-lamp').off = true;
  layout.items.find(item => item.id === 'ember-plant').off = true;
  const restored = normalizeLayout(JSON.parse(JSON.stringify(layout)));
  assert.equal(restored.items.find(item => item.id === 'ember-lamp').off, true);
  assert.equal('off' in restored.items.find(item => item.id === 'ember-plant'), false);
  assert.equal('off' in restored.items.find(item => item.id === 'ember-hearth'), false);
  for (const definition of FURNITURE) if (definition.use) assert.ok(['lamp', 'candles', 'fire', 'record'].includes(definition.use.toggle) || ['rustle', 'book', 'squish', 'steam', 'spin'].includes(definition.use.react), definition.id);
});

test('a chosen color stays after a reload; unknown colors and colors for other pieces never save', () => {
  const layout = createLayout('ember-library'), find = (items, id) => items.find(item => item.id === id);
  find(layout.items, 'ember-lamp').tint = 'navy';
  find(layout.items, 'ember-plant').tint = 'turquoise';
  find(layout.items, 'ember-hearth').tint = 'navy';
  const restored = normalizeLayout(JSON.parse(JSON.stringify(layout)));
  assert.equal(find(restored.items, 'ember-lamp').tint, 'navy');
  assert.equal('tint' in find(restored.items, 'ember-plant'), false);
  assert.equal('tint' in find(restored.items, 'ember-hearth'), false);
  for (const tint of [42, null, {}, ['navy'], '']) {
    find(layout.items, 'ember-lamp').tint = tint;
    assert.equal('tint' in find(normalizeLayout(JSON.parse(JSON.stringify(layout))).items, 'ember-lamp'), false, JSON.stringify(tint));
  }
});

test('wall pieces hang inside their wall, clear of fixtures, each other and tall furniture', () => {
  const frame = (u, v, wall = 'back', id = 'frame') => ({ id, type: 'small-frame', wall, u, v, art: 'hills' });
  assert.deepEqual(validatePlacement([], frame(2.5, 3)), { valid: true, reason: '' });
  assert.match(validatePlacement([], frame(-2.7, 3)).reason, /window/, 'windows stay clear');
  assert.match(validatePlacement([], frame(-0.18, 3)).reason, /post/);
  assert.match(validatePlacement([], frame(1.64, 4.3)).reason, /lantern/);
  assert.match(validatePlacement([], frame(2.5, 5.4)).reason, /wall/, 'the whole piece stays on the wall');
  assert.equal(validatePlacement([], frame(2.8, 4.4)).valid, true, 'a flat picture may hang behind the fairy lights');
  assert.match(validatePlacement([], { id: 'shelf', type: 'wall-shelf', wall: 'back', u: 2.8, v: 4.5 }).reason, /fairy lights/, 'a deep shelf may not');
  assert.match(validatePlacement([frame(2.5, 3, 'back', 'other')], frame(2.8, 3.2)).reason, /overlaps/);
  // The corner: a deep shelf on each wall meets in 3D.
  const shelf = (wall, u, id) => ({ id, type: 'apothecary-shelf', wall, u, v: 3, });
  assert.match(validatePlacement([shelf('side', -3.55, 'side-shelf')], { id: 'plant', type: 'hanging-plant', wall: 'back', u: -5.25, v: 3 }, 'cloud').reason, /overlaps the potion shelf/);
  // A tall bookcase against the wall keeps a picture off its patch of wall, both ways round.
  const books = { id: 'books', type: 'bookcase', x: 2.5, z: -3.75, rotation: 0 };
  assert.match(validatePlacement([books], frame(2.5, 3)).reason, /in front/);
  assert.match(validatePlacement([frame(2.5, 3)], books).reason, /in front of the honey picture frame/);
  assert.equal(validatePlacement([frame(2.5, 4.2)], books).valid, true, 'a picture above the bookcase is fine');
  assert.equal(validatePlacement([frame(2.5, 3)], { ...books, z: -3 }).valid, true, 'away from the wall is fine');
  assert.equal(validatePlacement([frame(2.5, 3)], { id: 'rug', type: 'rug', x: 2.5, z: -3, rotation: 0 }).valid, true, 'rugs never block');
  // Each shell has its own fixtures: the cloud loft's pink lamp hangs clear of a shallow shelf.
  assert.equal(validatePlacement([], { id: 'cloud', type: 'small-cloud-shelf', wall: 'back', u: 4.2, v: 4.55 }, 'cloud').valid, true);
  assert.match(validatePlacement([], { id: 'deep', type: 'apothecary-shelf', wall: 'back', u: 3.35, v: 4.3 }, 'cloud').reason, /lamp/, 'a deeper shelf would reach the lamp');
  // A blocked wall spot resolves to the closest free one on the same wall.
  const spot = nearestValidPlacement([frame(2.5, 3, 'back', 'other')], frame(2.8, 3.2));
  assert.ok(spot && validatePlacement([frame(2.5, 3, 'back', 'other')], frame(spot.u, spot.v)).valid);
  assert.ok(Math.hypot(spot.u - 2.8, spot.v - 3.2) <= 0.75 + 1e-9);
  const free = findFreePosition([], 'tall-frame');
  assert.equal(free.wall, 'back'); assert.equal(validatePlacement([], { id: 'new', type: 'tall-frame', ...free }).valid, true);
});

test('saved rooms keep their furniture and gain their wall pieces once', () => {
  const ember = createLayout('ember-library'), furniture = ember.items.filter(item => !item.wall);
  // A room saved before wall pieces existed gains the design's pieces.
  const legacy = normalizeLayout({ presetId: 'ember-library', items: furniture, activeDeskId: 'ember-desk' });
  assert.deepEqual(legacy, ember);
  // After that, a piece that was put away stays away.
  const tidied = { ...ember, items: ember.items.filter(item => item.id !== 'ember-clock') };
  assert.deepEqual(normalizeLayout(tidied), tidied);
  // Furniture never gives way to a picture: the picture moves or stays out.
  const crowded = normalizeLayout({ presetId: 'ember-library', items: [...furniture, { id: 'books-under-frame', type: 'bookcase', x: 4.5, z: -3.75, rotation: 0 }].filter(item => !['ember-lanterns', 'ember-hearth'].includes(item.id)), activeDeskId: 'ember-desk' });
  assert.ok(crowded.items.some(item => item.id === 'books-under-frame'), 'the saved bookcase stays');
  for (const piece of crowded.items.filter(item => item.wall)) assert.equal(validatePlacement(crowded.items, piece).valid, true, `${piece.id} hangs somewhere valid`);
  // Wall pieces are sanitized like furniture.
  const odd = normalizeLayout({ ...ember, items: [...ember.items, { id: 'x', type: 'tall-frame', wall: 'ceiling', u: 0, v: 3 }, { id: 'y', type: 'small-frame', wall: 'side', u: 3.5, v: 3.2, art: 'made-up' }, { id: 'z', type: 'wide-frame', wall: 'back', u: Infinity, v: 3 }] });
  assert.equal(odd.items.some(item => ['x', 'z'].includes(item.id)), false);
  assert.equal(odd.items.find(item => item.id === 'y').art, 'herbarium', 'an unknown picture falls back to the first one');
  assert.equal(normalizeLayout({ ...ember, items: ember.items.map(item => item.type === 'record-sleeve' ? { ...item, art: 'lilac' } : item) }).v, ember.v);
  // A room saved before the wall clock gains its design's clock once, and
  // nothing else: a piece put away before stays away.
  const cloud = createLayout('cloud-loft'), older = { ...cloud, v: 2, items: cloud.items.filter(item => item.type !== 'wall-clock' && item.id !== 'cloud-rainbow') };
  const updated = normalizeLayout(older);
  assert.ok(updated.items.some(item => item.type === 'wall-clock'), 'an older Cloud loft gains its clock');
  assert.ok(!updated.items.some(item => item.id === 'cloud-rainbow'), 'but not the rainbow that was put away');
  assert.ok(!normalizeLayout({ ...updated, items: updated.items.filter(item => item.type !== 'wall-clock') }).items.some(item => item.type === 'wall-clock'), 'a clock put away later stays away');
});

test('the wall clock shows the real local time, and its second hand rests with reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const clock = createFurniture('wall-clock', scene), nodes = clock.getChildTransformNodes(false), hand = name => nodes.find(node => node.name === `wall-clock-${name}-hand`);
    const before = new Date(); clock.metadata.animate(0, false, false); const after = new Date();
    // Clockwise from twelve, as the wall clock faces the room.
    const angle = node => ((-node.rotation.z) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const near = (value, targets) => targets.some(target => Math.abs(Math.atan2(Math.sin(value - target), Math.cos(value - target))) < 1e-6);
    const minuteAngles = [before, after].map(date => date.getMinutes() / 60 * Math.PI * 2), hourAngles = [before, after].map(date => (date.getHours() % 12 * 60 + date.getMinutes()) / 720 * Math.PI * 2);
    assert.ok(near(angle(hand('minute')), minuteAngles), 'the minute hand shows the minute');
    assert.ok(near(angle(hand('hour')), hourAngles), 'the hour hand shows the hour');
    assert.equal(hand('second').isEnabled(), true);
    clock.metadata.animate(1, false, true);
    assert.equal(hand('second').isEnabled(), false, 'with reduced motion the second hand is away');
    assert.ok(getFurniture('wall-clock').clock && getFurniture('moon-clock').clock, 'both clocks wake a still room once a minute');
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('windows cut exact openings in their wall and follow the wall-piece rules', () => {
  const area = parts => parts.reduce((sum, part) => sum + (part.maxU - part.minU) * (part.maxV - part.minV), 0);
  const meet = (a, b) => a.minU < b.maxU - 1e-9 && a.maxU > b.minU + 1e-9 && a.minV < b.maxV - 1e-9 && a.maxV > b.minV + 1e-9;
  const wall = { minU: -6, maxU: 6, minV: 0.2, maxV: 5.8 }, holes = [{ minU: 1, maxU: 2.4, minV: 2, maxV: 3.6 }, { minU: 3, maxU: 4, minV: 1, maxV: 6 }];
  const parts = cutRect(wall, holes);
  assert.ok(Math.abs(area(parts) - (area([wall]) - 1.4 * 1.6 - 1 * 4.8)) < 1e-9, 'the wall keeps exactly its area less the openings');
  assert.ok(!parts.some(part => holes.some(hole => meet(part, hole))) && !parts.some((part, i) => parts.some((other, j) => i !== j && meet(part, other))), 'no part covers an opening or another part');
  assert.deepEqual(cutRect({ minU: 0, maxU: 1, minV: 0, maxV: 1 }, [{ minU: -1, maxU: 2, minV: -1, maxV: 2 }]), [], 'a fully open part disappears');
  assert.deepEqual(subtractRect({ minU: 0, maxU: 1, minV: 0, maxV: 1 }, { minU: 2, maxU: 3, minV: 0, maxV: 1 }), [{ minU: 0, maxU: 1, minV: 0, maxV: 1 }]);
  // Only windows cut openings: inset inside the frame, and skipped while dragged.
  const window = { id: 'win', type: 'cottage-window', wall: 'side', u: 2, v: 3 }, frame = { id: 'frame', type: 'small-frame', wall: 'back', u: 2, v: 3, art: 'hills' };
  assert.deepEqual(openings([window, frame]), [{ wall: 'side', minU: 2 - 0.75 + OPENING_INSET, maxU: 2 + 0.75 - OPENING_INSET, minV: 3 - 0.85 + OPENING_INSET, maxV: 3 + 0.85 - OPENING_INSET }]);
  assert.deepEqual(openings([window, frame], 'win'), []);
  // Windows hang like any wall piece: clear of fixtures, behind fairy lights.
  for (const type of ['cottage-window', 'arched-window', 'round-window']) {
    assert.equal(getFurniture(type).opening, true);
    assert.match(validatePlacement([], { id: type, type, wall: 'back', u: -2.7, v: 3.3 }).reason, /window/, `${type} keeps clear of the main window`);
    assert.match(validatePlacement([], { id: type, type, wall: 'back', u: -0.18, v: 3.3 }).reason, /post|curtain|vine/, `${type} keeps clear of the post`);
  }
  assert.equal(validatePlacement([], { id: 'win', type: 'cottage-window', wall: 'back', u: 2.8, v: 4.1 }).valid, true, 'a window may reach up behind the fairy lights');
  assert.match(validatePlacement([], { id: 'win', type: 'cottage-window', wall: 'back', u: 2.8, v: 4.15 }).reason, /vine/, 'but not into the vine');
  assert.match(validatePlacement([{ id: 'books', type: 'bookcase', x: 2.75, z: -3.75, rotation: 0 }], { id: 'win', type: 'cottage-window', wall: 'back', u: 2.8, v: 3.2 }).reason, /in front/, 'a bookcase keeps a window clear');
  assert.equal(validatePlacement([], { id: 'win', type: 'round-window', wall: 'side', u: 2, v: 3 }, 'sakura').valid, true, 'the sakura shoji can take a window');
});

test('every design offers its own walls and floor and three more of each; a room keeps only its own', () => {
  const hex = /^#[0-9a-f]{6}$/;
  assert.deepEqual(Object.keys(SURFACES).sort(), ['cloud', 'metro', 'retreat', 'sakura']);
  for (const [style, kinds] of Object.entries(SURFACES)) for (const kind of ['walls', 'floor']) {
    const choices = kinds[kind];
    assert.equal(choices.length, 4, `${style} ${kind}`);
    assert.equal(choices[0].id, ''); assert.deepEqual(choices[0].paint, {}, `${style} ${kind} starts as designed`);
    assert.equal(new Set(choices.map(entry => entry.id)).size, 4, `${style} ${kind} ids are unique`);
    for (const entry of choices) {
      assert.ok(entry.name && entry.swatch.length === 2 && entry.swatch.every(color => hex.test(color)), `${style} ${entry.id}`);
      if (entry.id) assert.ok(Object.keys(entry.paint).length && Object.entries(entry.paint).every(([from, to]) => hex.test(from) && hex.test(to) && from !== to), `${style} ${kind} ${entry.id} repaints`);
    }
    // Every choice of a kind repaints the same design colors.
    const keys = JSON.stringify(Object.keys(choices[1].paint).sort());
    for (const entry of choices.slice(2)) assert.equal(JSON.stringify(Object.keys(entry.paint).sort()), keys, `${style} ${kind} ${entry.id}`);
  }
  const retreat = createLayout('ember-library'), sakura = createLayout('sakura-studio');
  assert.ok(!('walls' in retreat) && !('floor' in retreat), 'a new room is as designed');
  const keep = (layout, walls, floor) => normalizeLayout(JSON.parse(JSON.stringify({ ...layout, walls, floor })));
  const kept = keep(retreat, 'rose', 'walnut');
  assert.equal(kept.walls, 'rose'); assert.equal(kept.floor, 'walnut');
  const other = keep(sakura, 'rose', 'fresh');
  assert.ok(!('walls' in other), 'Sakura has no rose walls'); assert.equal(other.floor, 'fresh');
  for (const value of ['', 'teal', 42, null, {}, ['rose']]) {
    const dropped = keep(retreat, value, value);
    assert.ok(!('walls' in dropped) && !('floor' in dropped), JSON.stringify(value));
  }
});

test('aquarium fish swim to and fro inside the water and turn around; with reduced motion they keep still', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const tank = createFurniture('fish-tank', scene), part = name => tank.getChildMeshes().find(mesh => mesh.name === name);
    const fish = part('aquarium-fish'), bubbles = part('aquarium-bubble');
    // Babylon keeps the matrices it first returns, so read the live buffer.
    const matrices = mesh => Array.from({ length: mesh.thinInstanceCount }, (_, i) => Matrix.FromArray(mesh._thinInstanceDataStorage.matrixData, i * 16));
    const spots = mesh => matrices(mesh).map(matrix => matrix.getTranslation());
    const rest = spots(fish);
    assert.equal(rest.length, 3); assert.equal(spots(bubbles).length, 6);
    assert.equal(fish.metadata.castShadow, false); assert.equal(fish.isPickable, false);
    tank.metadata.animate(2.4, false, true);
    assert.deepEqual(spots(fish), rest, 'reduced motion keeps the fish still'); assert.equal(bubbles.isEnabled(), false, 'and hides the bubbles');
    const headings = new Set();
    for (let seconds = 0.2; seconds < 30; seconds += 0.37) {
      tank.metadata.animate(seconds, false, false);
      for (const at of [...spots(fish), ...spots(bubbles)]) assert.ok(Math.abs(at.x) <= 0.7 && at.y >= 0.88 && at.y <= 1.48 && Math.abs(at.z) <= 0.24, `inside the water at ${seconds}`);
      matrices(fish).forEach((matrix, i) => headings.add(`${i}:${Math.sign(matrix.m[0])}`));
    }
    assert.ok(bubbles.isEnabled(), 'bubbles rise with motion');
    for (let i = 0; i < 3; i++) assert.ok(headings.has(`${i}:1`) && headings.has(`${i}:-1`), `fish ${i} turns around`);
    assert.notDeepEqual(spots(fish), rest, 'the fish swim');
    tank.metadata.animate(31, false, true);
    assert.deepEqual(spots(fish), rest, 'reduced motion returns them to rest');
    tank.dispose();
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});

test('the easel keeps its chosen picture after a reload, and a new easel starts with the first', () => {
  const layout = createLayout('ember-library');
  for (const [id, art] of [['test-easel', 'sea'], ['test-easel-2', 'nonsense']]) layout.items.push({ id, type: 'easel', ...findFreePosition(layout.items, 'easel'), art });
  const restored = normalizeLayout(JSON.parse(JSON.stringify(layout))), easels = restored.items.filter(item => item.type === 'easel');
  assert.deepEqual(easels.map(item => item.art), ['sea', getFurniture('easel').arts[0]]);
  assert.ok(restored.items.filter(item => item.type !== 'easel' && !getFurniture(item.type).arts).every(item => !('art' in item)), 'other floor pieces never save a picture');
});
