import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWildsWorld, wildsAtmosphere, WILDS_GRASS } from './world.js';
import { WILDS_WORLD } from '../../core/wilds/world-definition.js';
import { createMovementState, stepMovement } from '../../core/wilds/movement.js';

const settled = async world => {
  for (let i = 0; i < 100 && world.diagnostics().pending; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(world.diagnostics().pending, false);
};

test('woodland branches retain their authored elevation when the nearby terrain streams', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  try {
    const branch = world.obstacles.find(obstacle => obstacle.id === 'grove-branch-0-0');
    assert.ok(branch);
    assert.equal(branch.climbable, false);
    assert.ok(Math.abs(branch.x + 15.022544710809017) < .000001);
    assert.ok(Math.abs(branch.z - 10.70538858994844) < .000001);
    assert.ok(Math.abs(branch.radius - 1.3399782741443385) < .000001);
    assert.ok(Math.abs(branch.height - 2.092896) < .000001);
    assert.ok(Math.abs(branch.baseY - world.surfaceAt(-15, 10).height - 4.803272) < .000001);
    world.update({ position: { x: -15, z: -65 } });
    await settled(world);
    world.update({ position: { x: -15, z: 10 } });
    await settled(world);
    const refreshed = world.obstacles.find(obstacle => obstacle.id === 'grove-branch-0-0');
    assert.equal(refreshed, branch);
    assert.ok(Math.abs(refreshed.baseY - world.surfaceAt(-15, 10).height - 4.803272) < .000001);
    world.refreshObstacles({ x: 800, z: 800 });
    assert.equal(world.obstacles.some(obstacle => obstacle.id.startsWith('grove-branch-')), false);
  } finally { world.dispose(); scene.dispose(); }
});

test('the fen water adapter follows streamed triangles and the controller walks across its bed without submerging', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  try {
    assert.equal(world.waterAt(25, -317), null);
    const initial = world.waterAt(25, -410);
    assert.equal(initial.height, -10);
    assert.equal(initial.depth, -10 - world.surfaceAt(25, -410).height);
    world.update({ position: { x: 25, z: -410 } }); await settled(world);
    assert.equal(world.waterAt(25, -410).depth, -10 - world.surfaceAt(25, -410).height);
    let player = createMovementState({ position: { x: 25, y: world.surfaceAt(25, -317).height, z: -317 } }), wetSteps = 0, maximumDepth = 0;
    for (let step = 1; step <= 360; step++) {
      player = stepMovement(player, { forward: 1, cameraYaw: 0 }, world, 100, step * 100).state;
      assert.equal(player.grounded, true);
      assert.ok(Math.abs(player.position.y - world.surfaceAt(player.position.x, player.position.z).height) < 1e-6);
      const water = world.waterAt(player.position.x, player.position.z);
      if (water) { wetSteps++; maximumDepth = Math.max(maximumDepth, water.height - player.position.y); }
    }
    assert.ok(Math.abs(player.position.z + 489.8) < 1e-6);
    assert.ok(wetSteps > 200);
    assert.ok(maximumDepth > .2 && maximumDepth <= .30001);
    assert.equal(world.waterAt(player.position.x, player.position.z), null);
  } finally { world.dispose(); scene.dispose(); }
});

test('the forest slice loads shared layers, a clear route, a climbable rock and distinct weather', async () => {
  const scene = new Scene(new NullEngine()), camera = new FreeCamera('test-camera', new Vector3(0, 2, 5), scene);
  const world = await createWildsWorld(scene, { workers: false, still: true });
  assert.deepEqual(world.spawn, { x: 0, z: 0, yaw: 0, y: 0 });
  assert.equal(world.diagnostics().terrainTriangles, 172032);
  assert.equal(world.diagnostics().grassBlades, 40000);
  assert.deepEqual(WILDS_GRASS.map(layer => [layer.blades, layer.tuft]), [[6000, true], [12000, true], [22000, true]]);
  assert.equal(world.landmarks.length, 8);
  assert.ok(world.diagnostics().trees > 2000);
  assert.ok(world.obstacles.filter(obstacle => !obstacle.id.startsWith('grove-branch-')).length < 450);
  assert.ok(world.obstacles.length < 1000);
  const climbable = world.obstacles.find(obstacle => obstacle.id === 'trail-rock-0');
  assert.equal(climbable.climbable, true);
  assert.equal(climbable.radius, .76);
  assert.equal(climbable.height, 1.1132);
  assert.equal(climbable.radiusProfile[0].height, -.1);
  assert.ok(Math.max(...climbable.radiusProfile.map(point => point.radius)) > 1.5);
  const outcrop = world.obstacles.find(obstacle => obstacle.id === 'old-root-outcrop');
  assert.equal(outcrop.radius, 2.5);
  assert.equal(outcrop.cameraRadius, 2.6);
  world.refreshObstacles({ x: 0, z: -160 });
  assert.equal(world.obstacles.some(obstacle => obstacle.id === 'old-root-outcrop'), false);
  assert.equal(world.obstacles.some(obstacle => obstacle.id === 'bellroot-root-1'), true);
  assert.deepEqual(world.diagnostics().center, { x: 0, z: 0 });
  assert.equal(world.diagnostics().pending, false);
  world.refreshObstacles(WILDS_WORLD.spawn);
  assert.equal(scene.meshes.length, 16);
  for (const theme of ['day', 'dusk', 'rain']) {
    world.setTheme(theme); scene.render();
    assert.equal(world.atmosphere.theme, theme);
    assert.equal(scene.getMeshByName('world-terrain-0').material._colors3.grass.toHexString().toLowerCase(), wildsAtmosphere(theme).grass);
    assert.equal(scene.getMeshByName('world-grass').material._floats.time, 0);
  }
  assert.notEqual(wildsAtmosphere('day').fogNear, wildsAtmosphere('rain').fogNear);
  world.update({ position: { x: 0, y: 0, z: 0 } });
  const paint = scene.getMeshByName('world-terrain-0').material;
  assert.deepEqual(paint._vectors4.contactShadow.asArray(), [0, 0, 0.58, 0.29]);
  world.update({ position: { x: 0, y: 2, z: 0 } });
  assert.ok(paint._vectors4.contactShadow.z > 0.58 && paint._vectors4.contactShadow.w < 0.29);
  assert.deepEqual(scene.getMeshByName('world-grass').material._vectors4.contactShadow.asArray(), paint._vectors4.contactShadow.asArray());
  assert.equal(world.surfaceAt(2000, 2000), null);
  world.dispose(); world.dispose(); camera.dispose();
  assert.equal(scene.meshes.length, 0); assert.equal(scene.materials.length, 0);
  assert.equal(world.diagnostics().disposed, true);
  scene.dispose();
});

test('streaming swaps complete stitched rings on a shared grid without moving the player surface', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  const rock = world.obstacles.find(obstacle => obstacle.id === 'trail-rock-0'), before = world.surfaceAt(2, -61);
  world.update({ position: { x: 2, z: -61 } });
  assert.equal(world.diagnostics().pending, true);
  assert.deepEqual(world.surfaceAt(2, -61), before);
  await settled(world);
  assert.deepEqual(world.diagnostics().center, { x: 0, z: -64 });
  assert.equal(world.diagnostics().builds, 2);
  assert.equal(world.surfaceAt(2, -61).height, before.height);
  assert.equal(world.obstacles.find(obstacle => obstacle.id === 'trail-rock-0'), rock);
  assert.equal(rock.baseY, world.surfaceAt(rock.x, rock.z).height);
  const positions = scene.getMeshByName('world-terrain-0').getVerticesData('position');
  assert.equal(positions[2], -192);
  world.update({ position: { x: -2, z: -145 } }); await settled(world);
  assert.equal(world.diagnostics().failures, 0);
  assert.ok(world.surfaceAt(-2, -145).height > 12);
  assert.equal(world.diagnostics().builds, 3);
  assert.equal(world.bounds, WILDS_WORLD.bounds);
  world.dispose(); scene.dispose();
});

test('disposing during terrain generation cancels the pending swap and keeps the scene empty', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  world.update({ position: { x: 0, z: -90 } }); world.dispose();
  await settled(world);
  assert.equal(world.diagnostics().builds, 1);
  assert.equal(world.diagnostics().failures, 0);
  assert.equal(scene.meshes.length, 0);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(createWildsWorld(scene, { workers: false, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(scene.meshes.length, 0);
  scene.dispose();
});

test('contact shadows use the highest prop summit below the feet and still fade during a jump', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  const outcrop = world.obstacles.find(obstacle => obstacle.id === 'old-root-outcrop'), top = outcrop.baseY + outcrop.height;
  const shadow = () => scene.getMeshByName('world-terrain-0').material._vectors4.contactShadow.asArray();
  const position = { x: outcrop.x, y: top, z: outcrop.z };
  world.update({ position });
  assert.deepEqual(shadow(), [-9, -42, 0.58, 0.29]);
  world.obstacles.push({ ...outcrop, id: 'lower-support', height: outcrop.height - 1 });
  world.update({ position });
  assert.deepEqual(shadow(), [-9, -42, 0.58, 0.29]);
  world.update({ position: { ...position, y: top + 2 } });
  assert.equal(Math.round(shadow()[2] * 100), 94);
  assert.equal(Math.round(shadow()[3] * 100000), 11154);
  world.update({ position: { ...position, y: outcrop.baseY } });
  assert.deepEqual(shadow(), [-9, -42, 0.58, 0.29]);
  const outside = { x: outcrop.x + outcrop.radius + 0.01, y: top, z: outcrop.z };
  world.update({ position: outside });
  assert.ok(shadow()[2] > 1.2 && shadow()[3] < 0.1);
  world.dispose(); scene.dispose();
});

test('Wilds keeps foliage clearance centred on the moving body above terrain and prop summits', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  const paint = scene.getMeshByName('world-trees-broadleaf-near').material;
  assert.equal(paint._vectors4.viewTarget.w, 0);
  world.update({ position: { x: -9, z: -36 } });
  assert.deepEqual(paint._vectors4.viewTarget.asArray(), [-9, world.surfaceAt(-9, -36).height + 1, -36, 1.35]);
  const outcrop = world.obstacles.find(obstacle => obstacle.id === 'old-root-outcrop'), top = outcrop.baseY + outcrop.height;
  world.update({ position: { x: -9, y: top + 2, z: -42 } });
  assert.deepEqual(paint._vectors4.viewTarget.asArray(), [-9, top + 3, -42, 1.35]);
  assert.equal(scene.meshes.length, 16);
  world.dispose(); scene.dispose();
});

test('Wilds palettes lift dusk ground and carry cool rain water, cloud and mist colors', () => {
  const day = wildsAtmosphere('day'), dusk = wildsAtmosphere('dusk'), rain = wildsAtmosphere('rain');
  assert.deepEqual([day.grass, day.grassLight, day.grassFar], ['#647b52', '#82976c', '#849675']);
  assert.deepEqual([dusk.shadowLift, dusk.groundAmbient, dusk.forestFloor, dusk.grassTip], [0.58, '#7d8060', '#6b7754', '#c8c698']);
  assert.deepEqual([rain.water, rain.waterShallow, rain.cloudLit, rain.cloudShade, rain.mist, rain.mistStrength], ['#739398', '#658176', '#99adb1', '#738b94', '#9cafb2', 0.3]);
});

test('Wilds creates one shared grove field for terrain, grass, and props while legacy lighting stays opt-in', async () => {
  const scene = new Scene(new NullEngine()), world = await createWildsWorld(scene, { workers: false, still: true });
  try {
    const terrain = scene.getMeshByName('world-terrain-0').material, texture = terrain._textures.groveField;
    assert.ok(texture, 'terrain receives the completed grove field');
    assert.equal(texture.name, 'world-grove-light');
    for (const name of ['world-grass', 'world-rocks', 'world-landmarks']) assert.equal(scene.getMeshByName(name).material._textures.groveField, texture, name);
    assert.deepEqual(terrain._vectors4.groveBounds.asArray(), [-96, -96, 192, 1]);
    assert.deepEqual(world.diagnostics().lighting, { center: { x: 0, z: 0 }, pending: false, painted: 1, texels: 512, span: 192 });
    world.update({ position: { x: 41, z: 0 } });
    assert.equal(world.diagnostics().lighting.pending, true);
    world.dispose();
    assert.equal(scene.textures.includes(texture), false);
    assert.equal(world.diagnostics().lighting.pending, false);
  } finally { world.dispose(); scene.dispose(); }
  const legacyScene = new Scene(new NullEngine()), legacy = await createWildsWorld(legacyScene, { workers: false, still: true, lighting: 'legacy' });
  try {
    assert.equal(legacy.diagnostics().lighting, null);
    assert.equal(legacyScene.getMeshByName('world-terrain-0').material._textures.groveField, undefined);
    assert.equal(legacyScene.textures.some(texture => texture.name === 'world-grove-light'), false);
  } finally { legacy.dispose(); legacyScene.dispose(); }
});
