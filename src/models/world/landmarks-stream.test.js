import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker as ThreadWorker } from 'node:worker_threads';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { WILDS_RINGS, WILDS_WORLD } from '../../core/wilds/world-definition.js';
import { buildTerrainRings, sampleTerrainSurface } from './terrain-mesh.js';
import { createWorldLandmarks, landmarkGeometry } from './landmarks.js';
import { createWildsWorld } from '../wilds/world.js';

const workerHost = new URL(`data:text/javascript,${encodeURIComponent(`
  import { parentPort, workerData } from 'node:worker_threads';
  globalThis.self = { postMessage: (value, transfer) => parentPort.postMessage(value, transfer) };
  await import(workerData.url);
  parentPort.on('message', data => self.onmessage({ data }));
`)}`);

function browserWorkers(t, { holdLandmarks = false } = {}) {
  const previous = globalThis.Worker, active = [], held = [];
  globalThis.Worker = class {
    constructor(url) {
      this.url = url;
      this.thread = new ThreadWorker(workerHost, { workerData: { url: url.href } });
      this.thread.on('message', data => this.onmessage?.({ data }));
      this.thread.on('error', error => this.onerror?.(error));
      active.push(this);
    }
    postMessage(data) {
      if (holdLandmarks && this.url.pathname.endsWith('/landmark-worker.js')) held.push(() => this.thread.postMessage(data));
      else this.thread.postMessage(data);
    }
    terminate() { return this.thread.terminate(); }
  };
  t.after(async () => { globalThis.Worker = previous; await Promise.all(active.map(worker => worker.terminate())); });
  return held;
}

function sameBytes(actual, expected, label) {
  assert.deepEqual(Buffer.from(actual.buffer, actual.byteOffset, actual.byteLength), Buffer.from(expected.buffer, expected.byteOffset, expected.byteLength), label);
}

const waitFor = async predicate => {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Streamed terrain did not reach the expected state');
};

test('worker-prepared landmarks match fresh geometry byte for byte and commit without sampling active terrain', async t => {
  browserWorkers(t);
  let active = await buildTerrainRings({ definition: WILDS_WORLD, rings: WILDS_RINGS, workers: false });
  let samples = 0;
  const scene = new Scene(new NullEngine()), surface = (x, z) => { samples++; return sampleTerrainSurface(active, x, z); };
  const layer = createWorldLandmarks(scene, { root: new TransformNode('root', scene), definition: WILDS_WORLD, surface, still: true });
  try {
    for (const z of [-64, -128]) {
      const rings = await buildTerrainRings({ definition: WILDS_WORLD, rings: WILDS_RINGS, center: { x: 0, z }, workers: false });
      const before = layer.meshes[0].getVerticesData('position');
      samples = 0;
      const prepared = await layer.prepareTerrain(rings, { workers: true });
      assert.equal(samples, 0);
      assert.equal(layer.meshes[0].getVerticesData('position'), before);
      const fresh = landmarkGeometry({ definition: structuredClone(WILDS_WORLD), surface: (x, z) => sampleTerrainSurface(rings, x, z) });
      for (const key of ['positions', 'normals', 'colors', 'uvs', 'spins', 'indices']) sameBytes(prepared[key], fresh[key], `prepared ${key} at ${z}`);
      assert.equal(rings[0].positions.byteLength > 0, true);
      active = rings;
      layer.refresh(prepared);
      assert.equal(samples, 0);
      for (const [kind, key] of [['position', 'positions'], ['normal', 'normals'], ['color', 'colors'], ['uv', 'uvs'], ['spin', 'spins']]) sameBytes(layer.meshes[0].getVerticesData(kind), fresh[key], `committed ${kind} at ${z}`);
      sameBytes(layer.meshes[0].getIndices(), fresh.indices, `committed indices at ${z}`);
      layer.refresh();
      for (const [kind, key] of [['position', 'positions'], ['normal', 'normals'], ['color', 'colors'], ['uv', 'uvs'], ['spin', 'spins']]) sameBytes(layer.meshes[0].getVerticesData(kind), fresh[key], `cached ${kind} at ${z}`);
      sameBytes(layer.meshes[0].getIndices(), fresh.indices, `cached indices at ${z}`);
    }
  } finally { scene.dispose(); }
});

test('terrain, landmarks and collider bases remain on one revision until the landmark worker is ready', async t => {
  const held = browserWorkers(t, { holdLandmarks: true });
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: true, still: true, lighting: 'legacy' });
  try {
    const beforeSurface = world.surfaceAt(2, -61), terrain = scene.getMeshByName('world-terrain-0'), landmarks = scene.getMeshByName('world-landmarks').getVerticesData('position');
    const rock = world.obstacles.find(obstacle => obstacle.id === 'trail-rock-0'), beforeBase = rock.baseY;
    world.update({ position: { x: 2, z: -61 } });
    await waitFor(() => held.length === 1);
    assert.equal(world.diagnostics().pending, true);
    assert.equal(world.diagnostics().builds, 1);
    assert.deepEqual(world.diagnostics().center, { x: 0, z: 0 });
    assert.equal(scene.getMeshByName('world-terrain-0'), terrain);
    assert.equal(scene.getMeshByName('world-landmarks').getVerticesData('position'), landmarks);
    assert.deepEqual(world.surfaceAt(2, -61), beforeSurface);
    assert.equal(rock.baseY, beforeBase);
    held.shift()();
    await waitFor(() => !world.diagnostics().pending);
    assert.equal(world.diagnostics().failures, 0);
    assert.equal(world.diagnostics().builds, 2);
    assert.deepEqual(world.diagnostics().center, { x: 0, z: -64 });
    assert.notEqual(scene.getMeshByName('world-terrain-0'), terrain);
    assert.equal(scene.getMeshByName('world-terrain-0').getVerticesData('position')[2], -192);
    assert.equal(rock.baseY, world.surfaceAt(rock.x, rock.z).height);
    const fresh = landmarkGeometry({ definition: structuredClone(WILDS_WORLD), surface: world.surfaceAt });
    sameBytes(scene.getMeshByName('world-landmarks').getVerticesData('position'), fresh.positions, 'atomic landmark positions');
    world.update({ position: { x: 2, z: -130 } });
    await waitFor(() => held.length === 1);
    world.dispose();
    await waitFor(() => !world.diagnostics().pending);
    assert.equal(world.diagnostics().builds, 2);
    assert.equal(world.diagnostics().failures, 0);
    assert.equal(scene.meshes.length, 0);
  } finally { world.dispose(); scene.dispose(); }
});
