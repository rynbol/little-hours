import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FURNITURE, getFurniture } from './catalog.js';
import { ROOM_BOUNDS, MAX_ITEMS, PRESETS, createLayout, validatePlacement, normalizeLayout, findFreePosition } from './layout.js';
import { createFurniture, disposeFurnitureAssets } from './furniture.js';

const placement = (type, x, z, rotation = 0, id = 'test-item') => ({ id, type, x, z, rotation });

test('catalog contains coherent unique furniture definitions and two usable study stations', () => {
  assert.equal(new Set(FURNITURE.map(item => item.id)).size, FURNITURE.length);
  assert.equal(FURNITURE.filter(item => item.category === 'Study').length, 2);
  assert.equal(getFurniture('unknown'), undefined);
  for (const item of FURNITURE) {
    assert.ok(item.footprint.every(value => Number.isFinite(value) && value > 0));
    assert.equal(getFurniture(item.id), item);
    assert.match(item.color, /^#[\da-f]{6}$/i);
  }
});

test('every preset fits the room, clears the cat and other furniture, and has a usable desk', () => {
  for (const preset of PRESETS) {
    const layout = createLayout(preset.id);
    assert.ok(layout.items.length <= MAX_ITEMS);
    assert.equal(getFurniture(layout.items.find(item => item.id === layout.activeDeskId)?.type)?.category, 'Study');
    for (const item of layout.items) assert.deepEqual(validatePlacement(layout.items, item), { valid: true, reason: '' }, `${preset.id}: ${item.id}`);
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

test('the sleeping cat retains floor space while rugs remain allowed underneath', () => {
  const result = validatePlacement([], placement('plant', 0.75, 1.5));
  assert.equal(result.valid, false); assert.match(result.reason, /cat/);
  assert.equal(validatePlacement([], placement('rug', 0.25, 1.25)).valid, true);
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
  assert.equal(restored.items.length, 3);
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
  for (const definition of FURNITURE) for (let rotation = 0; rotation < 4; rotation++) {
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
      assert.ok(furniture.getChildMeshes().length <= 7, `${definition.id} stays within its draw budget`);
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
    assert.equal(fresh.getChildMeshes().length, 1);
    fresh.dispose();
  } finally { disposeFurnitureAssets(scene); scene.dispose(); engine.dispose(); }
});
