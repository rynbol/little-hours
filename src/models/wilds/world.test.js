import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWildsWorld } from './world.js';
import { buildTerrainRings, sampleTerrainSurface } from '../world/terrain-mesh.js';
import { plantTrees } from '../world/trees.js';
import { worldAtmosphere } from '../world/atmosphere.js';
import { createMovementState, stepMovement } from '../../core/wilds/movement.js';
import { FOREST_WALK } from '../../features/forest/forest-walk.js';

test('Wilds renders the Forest terrain, trees, grass and atmosphere without a separate world definition', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), camera = new FreeCamera('test-camera', new Vector3(-106.5, -25, -180), scene);
  const world = await createWildsWorld(scene, { workers: false, still: true });
  try {
    const rings = await buildTerrainRings({ workers: false });
    assert.deepEqual([world.spawn.x, world.spawn.z, world.spawn.yaw], [-106.5, -180, .6]);
    assert.deepEqual([world.spawn.x, world.spawn.z, world.spawn.yaw], [FOREST_WALK.start.x, FOREST_WALK.start.z, -FOREST_WALK.start.yaw]);
    assert.equal(world.diagnostics().trees, 2434);
    assert.equal(world.diagnostics().grassBlades, 88000);
    for (const [index, ring] of rings.entries()) {
      const mesh = scene.getMeshByName(`world-terrain-${index}`);
      assert.deepEqual(mesh.getVerticesData('position'), ring.positions);
      assert.deepEqual(mesh.getIndices(), ring.indices);
    }
    for (const [x, z] of [[-106.5, -180], [-132, -215], [-144, -232], [-160, -160], [1000, -1000]]) assert.deepEqual(world.surfaceAt(x, z), sampleTerrainSurface(rings, x, z));
    assert.equal(world.spawn.y, world.surfaceAt(-106.5, -180).height);
    for (const theme of ['day', 'dusk', 'rain']) {
      world.setTheme(theme); scene.render();
      assert.deepEqual(world.atmosphere, worldAtmosphere(theme));
      assert.equal(scene.getMeshByName('world-terrain-0').material._colors3.grass.toHexString().toLowerCase(), worldAtmosphere(theme).grass);
      assert.equal(scene.getMeshByName('world-grass').material._floats.time, 0);
    }
    assert.equal(world.surfaceAt(13000, 13000), null);
  } finally { world.dispose(); camera.dispose(); scene.dispose(); engine.dispose(); }
});

test('Forest tree colliders match rendered trunks and nearby refresh keeps stable objects', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), world = await createWildsWorld(scene, { workers: false, still: true });
  try {
    const trees = plantTrees(await buildTerrainRings({ workers: false }));
    const obstacle = world.obstacles[0], index = Number(obstacle.id.split('-').at(-1));
    assert.equal(obstacle.x, trees.x[index]);
    assert.equal(obstacle.z, trees.z[index]);
    assert.equal(obstacle.radius, trees.width[index] * .5);
    assert.equal(obstacle.radius, trees.width[index] * FOREST_WALK.trunk);
    assert.equal(obstacle.baseY, world.surfaceAt(obstacle.x, obstacle.z).height);
    world.refreshObstacles({ x: 1200, z: -1200 });
    assert.equal(world.obstacles.includes(obstacle), false);
    world.refreshObstacles(world.spawn);
    assert.equal(world.obstacles.includes(obstacle), true);
    const stone = world.obstacles.find(candidate => candidate.id === 'warden-stone-0');
    assert.deepEqual([stone.x, stone.z, stone.radius, stone.height], [-140, -223, 1.1, 3.8]);
    assert.equal(stone.baseY, world.surfaceAt(-140, -223).height);
    let player = createMovementState({ position: { x: obstacle.x, y: obstacle.baseY, z: obstacle.z + obstacle.radius + .45 } });
    for (let step = 1; step <= 30; step++) player = stepMovement(player, { forward: 1, cameraYaw: 0 }, world, 100, step * 100).state;
    assert.ok(Math.hypot(player.position.x - obstacle.x, player.position.z - obstacle.z) >= obstacle.radius + .3);
  } finally { world.dispose(); scene.dispose(); engine.dispose(); }
});

test('the existing path stays grounded through the arena and never streams replacement terrain', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), world = await createWildsWorld(scene, { workers: false, still: true });
  try {
    const terrain = scene.getMeshByName('world-terrain-1'), geometry = terrain.geometry;
    let player = createMovementState({ position: world.spawn, yaw: world.spawn.yaw });
    for (let step = 1; step <= 90; step++) {
      player = stepMovement(player, { forward: 1, cameraYaw: .6 }, world, 100, step * 100).state;
      world.update(player);
      assert.equal(player.grounded, true);
      assert.ok(Math.abs(player.position.y - world.surfaceAt(player.position.x, player.position.z).height) < 1e-6);
    }
    assert.ok(Math.hypot(player.position.x + 132, player.position.z + 215) < 2);
    assert.equal(terrain.geometry, geometry);
    assert.equal(world.diagnostics().pending, false);
    const shadow = scene.getMeshByName('world-terrain-0').material._vectors4.contactShadow;
    assert.equal(shadow.z, .58); assert.equal(shadow.w, .29);
    world.update({ position: { ...player.position, y: player.position.y + 2 } });
    assert.ok(shadow.z > .58 && shadow.w < .29);
  } finally { world.dispose(); scene.dispose(); engine.dispose(); }
});

test('Forest adapter cancels creation and disposes shared layers exactly once', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), world = await createWildsWorld(scene, { workers: false, still: true });
  world.dispose(); world.dispose();
  assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0);
  assert.equal(world.diagnostics().disposed, true);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createWildsWorld(scene, { workers: false, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(scene.meshes.length, 0);
  scene.dispose(); engine.dispose();
});
