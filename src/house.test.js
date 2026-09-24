import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStateStore, restoreState, freshState } from './state.js';
import { createLayout } from './layout.js';
import { createSession } from './session.js';
import { activeHouseRoom, nextExpansion, houseConnections } from './house.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createHouseModel } from './house-model.js';

function fixture(initial) {
  let raw = initial ? JSON.stringify(initial) : null, now = 1000;
  const storage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  const store = createStateStore(storage, () => now);
  return { store, storage, advance: ms => { now += ms; }, reopen: () => createStateStore(storage, () => now) };
}
function finish(f, minutes = 25) {
  f.store.update(s => { s.session = createSession(minutes); });
  f.store.setRunning(true); f.advance(minutes * 60_000); return f.store.update();
}

test('a new home starts furnished, with one room and no coins', () => {
  const { store } = fixture();
  assert.deepEqual(activeHouseRoom(store.state.house).layout, createLayout());
  assert.equal(store.state.house.rooms.length, 1);
  assert.equal(store.state.house.coins, 0);
  assert.equal(nextExpansion(store.state.house).id, 'garden');
});

test('old rooms, their saved designs and completed focus history migrate once', () => {
  const old = freshState(); delete old.house;
  old.layout = createLayout('sakura-studio'); old.layout.items = old.layout.items.filter(i => i.type !== 'bookcase');
  old.rooms = { 'cloud-loft': createLayout('cloud-loft') };
  old.history = [{ date: '2026-09-21', minutes: 25 }, { date: '2026-09-22', minutes: 50 }];
  const f = fixture(old);
  assert.deepEqual(activeHouseRoom(f.store.state.house).layout, old.layout);
  assert.deepEqual(f.store.state.rooms['cloud-loft'], old.rooms['cloud-loft']);
  assert.equal(f.store.state.house.coins, 75);
  assert.equal(f.store.buildRoom('garden', 'cloud-loft').built, true);
  assert.equal(f.reopen().state.house.coins, 50, 'migration must not refill spent coins');
});

test('focus earns coins once across expiry, reload and a second tab; paused/reset time earns none', () => {
  const f = fixture(), second = f.reopen();
  f.store.setRunning(true); f.advance(60_000); f.store.setRunning(false);
  assert.equal(f.store.state.house.coins, 0);
  f.store.update(s => { s.session = createSession(); });
  assert.equal(f.store.state.house.coins, 0);
  const result = finish(f, 50);
  assert.equal(result.earned, 50); assert.equal(result.state.house.coins, 50);
  assert.equal(second.update().earned, 0); assert.equal(f.reopen().update().earned, 0);
  assert.equal(f.reopen().state.house.coins, 50);
});

test('building enforces the next site, valid design, price and one purchase', () => {
  const f = fixture();
  assert.equal(f.store.buildRoom('garden', 'cloud-loft').built, false);
  finish(f);
  assert.equal(f.store.buildRoom('loft', 'cloud-loft').built, false);
  assert.equal(f.store.buildRoom('garden', 'unknown').built, false);
  assert.equal(f.store.state.house.coins, 25);
  const stale = f.reopen();
  assert.equal(f.store.buildRoom('garden', 'moonlit-greenhouse').built, true);
  assert.equal(stale.buildRoom('garden', 'cloud-loft').built, false);
  assert.equal(stale.state.house.coins, 0);
  assert.equal(stale.state.house.rooms.length, 2);
  finish(f, 90);
  assert.equal(f.store.buildRoom('loft', 'sakura-studio').built, true);
  assert.equal(f.store.state.house.coins, 15);
  assert.equal(nextExpansion(f.store.state.house), null);
  assert.equal(f.store.buildRoom('extra', 'cloud-loft').built, false);
});

test('a session that expires at purchase is awarded before checking affordability', () => {
  const f = fixture(); f.store.setRunning(true); f.advance(25 * 60_000);
  const result = f.store.buildRoom('garden', 'cloud-loft');
  assert.equal(result.completed, true); assert.equal(result.built, true); assert.equal(result.state.house.coins, 0);
});

test('two rooms with the same design keep independent furniture, colors and names', () => {
  const f = fixture(); finish(f); f.store.buildRoom('garden', 'ember-library');
  f.store.renameRoom('studio', 'My quiet corner');
  f.store.update(s => { s.layout.items = s.layout.items.filter(i => i.type !== 'bookcase'); s.layout.walls = 'blue'; });
  const studio = structuredClone(f.store.state.layout);
  f.store.setRunning(true); const timer = structuredClone(f.store.state.session);
  f.store.enterHouseRoom('garden');
  assert.deepEqual(f.store.state.layout, createLayout('ember-library'));
  f.store.update(s => { s.layout.floor = 'walnut'; });
  const garden = structuredClone(f.store.state.layout);
  f.store.enterHouseRoom('studio');
  assert.deepEqual(f.store.state.layout, studio); assert.deepEqual(f.store.state.session, timer);
  assert.equal(activeHouseRoom(f.store.state.house).name, 'My quiet corner');
  const reopened = f.reopen(); reopened.enterHouseRoom('garden');
  assert.deepEqual(reopened.state.layout, garden);
  reopened.useRoom('sakura-studio'); reopened.enterHouseRoom('studio');
  assert.deepEqual(reopened.state.layout, studio, 'changing one room style leaves the other room intact');
});

test('invalid house data is bounded and cannot strand the active room', () => {
  const saved = freshState();
  saved.house = { coins: -5, activeId: 'missing', name: '  ', rooms: [{ id: 'loft', layout: createLayout() }, null] };
  const restored = restoreState(JSON.stringify(saved));
  assert.equal(restored.house.coins, 0); assert.equal(restored.house.activeId, 'studio'); assert.equal(restored.house.rooms.length, 1);
  const f = fixture(); f.store.renameHouse('x'.repeat(100)); assert.equal(f.store.state.house.name.length, 40);
  const before = structuredClone(f.store.state.layout); f.store.enterHouseRoom('loft'); assert.deepEqual(f.store.state.layout, before);
});

test('a stale decorating callback saves its own room after another tab changes rooms', () => {
  const f = fixture(); finish(f); f.store.buildRoom('garden', 'cloud-loft');
  const stale = f.reopen(), oldLayout = structuredClone(stale.state.layout);
  oldLayout.walls = 'blue'; f.store.enterHouseRoom('garden');
  stale.saveLayout(oldLayout, 'studio');
  assert.equal(stale.state.house.activeId, 'garden');
  assert.equal(stale.state.layout.presetId, 'cloud-loft');
  stale.enterHouseRoom('studio'); assert.equal(stale.state.layout.walls, 'blue');
});

test('door destinations follow the active room and the next affordable expansion', () => {
  const f = fixture();
  assert.deepEqual(houseConnections(f.store.state.house).map(link => [link.id, link.built, link.next, link.ready]), [['garden', false, true, false], ['loft', false, false, false]]);
  finish(f); assert.equal(houseConnections(f.store.state.house)[0].ready, true);
  f.store.buildRoom('garden', 'cloud-loft'); f.store.enterHouseRoom('garden');
  assert.deepEqual(houseConnections(f.store.state.house).map(link => [link.id, link.built, link.next]), [['studio', true, false], ['loft', false, true]]);
});

test('house uses real furniture and architecture, batches static paint and releases its models', () => {
  const previousDocument = globalThis.document;
  const context = new Proxy({}, { get: (_, key) => String(key).includes('Gradient') ? () => ({ addColorStop() {} }) : key === 'measureText' ? () => ({ width: 20 }) : () => {} });
  globalThis.document = { addEventListener() {}, removeEventListener() {}, createElement: () => ({ width: 256, height: 256, getContext: () => context }) };
  const engine = new NullEngine(), scene = new Scene(engine), f = fixture();
  const shadows = new ShadowGenerator(64, new DirectionalLight('house-test-sun', new Vector3(0, -1, 0), scene));
  try {
    for (let count = 1; count <= 3; count++) {
      const model = createHouseModel(scene, f.store.state.house, 'studio');
      assert.ok(model.meshes.length <= 4);
      const vertices = model.meshes.reduce((total, mesh) => total + mesh.getTotalVertices(), 0);
      assert.ok(vertices > 10_000 && vertices < 1_000_000);
      for (const mesh of model.meshes) assert.ok(mesh.getVerticesData('position').every(Number.isFinite));
      assert.ok(model.meshes.some(m => m.metadata.houseSlot === 'studio'));
      if (count < 3) assert.ok(model.meshes.some(m => m.metadata.houseSlot === nextExpansion(f.store.state.house).id));
      assert.equal(model.live.length, 1, 'only the occupied desk has a live companion');
      if (count === 3) assert.ok(scene.getMeshByName('cloud-window-view'), 'the real Cloud loft architecture is retained');
      const originalMeshes = [...model.meshes];
      // Exercise Babylon's automatic caster removal without letting a shrinking
      // render list skip an old room when the design preview changes.
      shadows.getShadowMap().renderList = model.meshes;
      model.dispose(); assert.ok(originalMeshes.every(mesh => mesh.isDisposed()));
      assert.ok(model.live.every(root => root.isDisposed()));
      if (count < 3) { finish(f, 90); f.store.buildRoom(nextExpansion(f.store.state.house).id, count === 1 ? 'moonlit-greenhouse' : 'cloud-loft'); }
    }
  } finally { scene.dispose(); engine.dispose(); globalThis.document = previousDocument; }
});
