import '@babylonjs/core/Culling/ray.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { createWildsCamera } from './camera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWildsWorld } from '../../models/wilds/world.js';
import { createMovementState, stepMovement, obstacleRadiusBetween } from '../../core/wilds/movement.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .000001, `${actual} should equal ${expected}`);
const player = { position: { x: 0, y: 0, z: 0 }, yaw: 0 };

function fixture(options = {}) {
  const engine = new NullEngine(), scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  const world = { surfaceAt: () => ({ height: 0, normal: { x: 0, y: 1, z: 0 } }), obstacles: [], ...options.world };
  const controller = createWildsCamera(scene, {}, { world, still: options.still });
  return { engine, scene, world, controller, dispose() { controller.dispose(); scene.dispose(); engine.dispose(); } };
}

test('the default camera follows at six and a half metres with a 2.2 metre shoulder', () => {
  const f = fixture();
  try {
    f.controller.update(player, {}, 16);
    const camera = f.controller.camera, d = f.controller.diagnostics();
    close(camera.position.x, 0);
    close(camera.position.y, 2.2);
    close(camera.position.z, 6.430202174115522);
    close(d.distance, 6.5);
    assert.deepEqual(d.target, { x: 0, y: 1.25, z: 0 });
    assert.equal(d.occluded, false);
    f.controller.update({ position: { x: 20, y: 3, z: -10 }, yaw: 0 }, {}, 16);
    close(camera.position.x, 20);
    close(camera.position.y, 5.2);
    close(camera.position.z, -3.569797825884478);
  } finally { f.dispose(); }
});

test('mouse turning has the same yaw convention as movement and pitch stays usable', () => {
  const f = fixture();
  try {
    const orbit = f.controller.update(player, { lookX: 100, lookY: 40 }, 16);
    close(orbit.cameraYaw, -.3);
    close(orbit.cameraPitch, .2466792459127238);
    assert.ok(f.controller.camera.position.x < -1.8);
    f.controller.update(player, { lookY: 100000 }, 16);
    close(f.controller.pitch, 1.1);
    f.controller.update(player, { lookY: -100000 }, 16);
    close(f.controller.pitch, -.15);
    assert.ok(f.controller.camera.position.y >= .24);
  } finally { f.dispose(); }
});

test('nearby props reroute the view without moving inside the avatar or changing held movement yaw', () => {
  const f = fixture();
  try {
    f.controller.update(player, {}, 16);
    f.world.obstacles.push({ x: 0, z: 3, radius: .6, baseY: 0, height: 5 });
    const orbit = f.controller.update(player, {}, 16), blocked = f.controller.diagnostics();
    assert.equal(blocked.occluded, true);
    assert.ok(blocked.distance >= 3);
    assert.ok(Math.abs(blocked.resolvedYaw) > .1 || blocked.resolvedPitch > .8);
    assert.equal(orbit.cameraYaw, 0);

    assertView(f.controller, f.world, player);
    f.world.obstacles.length = 0;
    f.controller.update(player, {}, 16);
    assert.ok(Math.abs(f.controller.diagnostics().resolvedYaw) < Math.abs(blocked.resolvedYaw));
    f.controller.update(player, {}, 2000);
    close(f.controller.diagnostics().distance, 6.5);
    close(f.controller.diagnostics().resolvedPitch, .1466792459127238);
  } finally { f.dispose(); }
});

test('elevated branches leave the view below them clear and obstruct it at branch height', () => {
  const f = fixture({ still: true, world: { obstacles: [{ x: 0, z: 3, radius: .6, baseY: 3, height: .6 }] } });
  try {
    f.controller.update(player, {}, 16);
    assert.equal(f.controller.diagnostics().occluded, false);
    close(f.controller.camera.position.x, 0);
    close(f.controller.camera.position.y, 2.2);
    close(f.controller.camera.position.z, 6.430202174115522);
    f.controller.update({ position: { x: 0, y: 1.5, z: 0 }, yaw: 0 }, {}, 16);
    assert.equal(f.controller.diagnostics().occluded, true);
    assert.ok(f.controller.diagnostics().distance >= 3);
  } finally { f.dispose(); }
});

test('terrain and unavailable triangles lift the camera while retaining body and ground framing', () => {
  const f = fixture({ world: { surfaceAt: (x, z) => z > 4 ? null : { height: z > 2 ? 4 : 0, normal: { x: 0, y: 1, z: 0 } } } });
  try {
    f.controller.update(player, {}, 16);
    assert.equal(f.controller.diagnostics().occluded, true);
    assertView(f.controller, f.world, player);
    f.world.surfaceAt = (x, z) => z > 4 ? null : { height: 0, normal: { x: 0, y: 1, z: 0 } };
    f.controller.update(player, {}, 2000);
    assertView(f.controller, f.world, player);
  } finally { f.dispose(); }
});

test('a low-pitch camera stays above shallow water while the player remains grounded on its bed', () => {
  const f = fixture({ still: true, world: { surfaceAt: () => ({ height: -.3, normal: { x: 0, y: 1, z: 0 } }), waterAt: () => ({ height: 0, depth: .3 }) } });
  try {
    const wading = { position: { x: 0, y: -.3, z: 0 }, yaw: 0 };
    f.controller.setPose({ pitch: -.085, distance: 9 });
    f.controller.update(wading, {}, 16);
    assert.ok(f.controller.camera.position.y >= .24);
    assert.equal(f.controller.diagnostics().occluded, true);
    assert.equal(wading.position.y, -.3);
    f.world.waterAt = () => null;
    f.controller.update(wading, {}, 16);
    assert.ok(f.controller.camera.position.y < .24);
    assert.ok(f.controller.camera.position.y >= -.06);
  } finally { f.dispose(); }
});

test('reduced motion restores the camera directly and explicit captures clamp and reset the pose', () => {
  const f = fixture({ still: true, world: { obstacles: [{ x: 0, z: 3, radius: .6, baseY: 0, height: 5 }] } });
  try {
    f.controller.update(player, {}, 16);
    assert.ok(f.controller.diagnostics().distance >= 3);
    assertView(f.controller, f.world, player);
    f.world.obstacles.length = 0;
    f.controller.update(player, {}, 16);
    close(f.controller.diagnostics().distance, 6.5);
    f.controller.setPose({ yaw: Math.PI, pitch: .4, distance: 3 });
    f.controller.update(player, {}, 0);
    close(f.controller.yaw, Math.PI);
    close(f.controller.diagnostics().distance, 3);
    assert.ok(f.controller.camera.position.z < -2.7);
    f.controller.setPose({ pitch: 10, distance: 100 });
    f.controller.update(player, {}, 0);
    close(f.controller.pitch, 1.1);
    close(f.controller.diagnostics().distance, 9);
    f.controller.setPose({ distance: -100 });
    f.controller.update(player, {}, 0);
    close(f.controller.diagnostics().distance, 3);
  } finally { f.dispose(); }
});

test('a fully blocked camera keeps a finite view and dispose removes the Babylon camera once', () => {
  const f = fixture({ world: { obstacles: [{ x: 0, z: 0, radius: 2, baseY: 0, height: 5 }] } });
  try {
    f.controller.setPose({ yaw: 1, pitch: .3 });
    f.controller.update({ ...player, yaw: 2 }, {}, 16);
    close(f.controller.yaw, 1);
    assert.ok(f.controller.diagnostics().distance >= 3);
    assert.equal(f.controller.diagnostics().recovering, true);
    assert.ok(f.controller.camera.position.y > 5.24);
    for (const value of f.controller.camera.getViewMatrix().m) assert.equal(Number.isFinite(value), true);
    assert.equal(f.scene.cameras.length, 1);
    f.controller.dispose();
    f.controller.dispose();
    assert.equal(f.scene.cameras.length, 0);
    assert.equal(f.controller.diagnostics().disposed, true);
    close(f.controller.update(player, { lookX: 100 }, 16).cameraYaw, 1);
  } finally { f.dispose(); }
});

function nearbyObstacles(world, position, reach = 12) {
  return world.obstacles.filter(obstacle => {
    const radius = obstacle.cameraRadius ?? obstacle.radiusProfile?.reduce((maximum, point) => Math.max(maximum, point.radius), 0) ?? obstacle.radius;
    return Math.hypot(obstacle.x - position.x, obstacle.z - position.z) <= reach + radius + .24;
  });
}

function assertView(controller, world, player) {
  const position = controller.camera.position, target = new Vector3(player.position.x, player.position.y + 1.25, player.position.z), distance = Vector3.Distance(position, target);
  assert.ok(distance >= 3 - 1e-6, `view distance ${distance}`);
  const obstacles = nearbyObstacles(world, target);
  for (const height of [.12, 1.25]) {
    const origin = new Vector3(player.position.x, player.position.y + height, player.position.z);
    for (let i = 1; i <= 80; i++) {
      const p = Vector3.Lerp(origin, position, i / 80), padding = .02 + .22 * i / 80, surface = world.surfaceAt(p.x, p.z);
      assert.ok(surface && p.y >= surface.height + padding / Math.max(.2, surface.normal.y) - 1e-6, `terrain at ${JSON.stringify(p)}`);
      for (const obstacle of obstacles) {
        if (p.y - padding > obstacle.baseY + obstacle.height || p.y + padding < obstacle.baseY) continue;
        const radius = obstacle.cameraRadius ?? obstacleRadiusBetween(obstacle, p.y - padding, p.y + padding);
        assert.ok(Math.hypot(p.x - obstacle.x, p.z - obstacle.z) >= radius + padding - 1e-6, `view blocked by ${obstacle.id} at ${JSON.stringify(p)}`);
      }
    }
  }
  for (const [height, side, front] of [[1.1, -.3, 0], [1.1, .3, 0], [1.1, 0, -.17], [1.1, 0, .17], [1.5, -.25, 0], [1.5, .25, 0], [1.5, 0, -.21], [1.5, 0, .21]]) {
    const origin = new Vector3(player.position.x + Math.cos(player.yaw || 0) * side + Math.sin(player.yaw || 0) * front, player.position.y + height, player.position.z - Math.sin(player.yaw || 0) * side + Math.cos(player.yaw || 0) * front);
    for (let i = 1; i <= 80; i++) {
      const p = Vector3.Lerp(origin, position, i / 80);
      for (const obstacle of obstacles) {
        if (p.y > obstacle.baseY + obstacle.height || p.y < obstacle.baseY) continue;
        const radius = obstacle.cameraRadius ?? obstacleRadiusBetween(obstacle, p.y);
        assert.ok(Math.hypot(p.x - obstacle.x, p.z - obstacle.z) >= radius - 1e-6, `body side ${height}/${side}/${front} blocked by ${obstacle.id} at ${JSON.stringify(p)}`);
      }
    }
  }
  for (const height of [0, 1.9]) {
    const projected = Vector3.TransformCoordinates(new Vector3(player.position.x, player.position.y + height, player.position.z), controller.camera.getViewMatrix());
    assert.ok(Math.abs(projected.y / projected.z) < Math.tan(.44) * .95, `body outside vertical view ${JSON.stringify(projected)}`);
  }
}

function assertTravel(world, from, to) {
  const obstacles = nearbyObstacles(world, from, Vector3.Distance(from, to));
  for (let i = 1; i <= 30; i++) {
    const p = Vector3.Lerp(from, to, i / 30), surface = world.surfaceAt(p.x, p.z);
    assert.ok(surface && p.y >= surface.height + .24 / Math.max(.2, surface.normal.y) - 1e-6, 'camera crossed terrain');
    for (const obstacle of obstacles) {
      if (p.y - .24 > obstacle.baseY + obstacle.height || p.y + .24 < obstacle.baseY) continue;
      const radius = obstacle.cameraRadius ?? obstacleRadiusBetween(obstacle, p.y - .24, p.y + .24);
      assert.ok(Math.hypot(p.x - obstacle.x, p.z - obstacle.z) >= radius + .24 - 1e-6, `camera crossed ${obstacle.id}: from ${JSON.stringify(from)} to ${JSON.stringify(to)}, at ${JSON.stringify(p)}`);
    }
  }
}

test('the literal stopped-wall pose retains a full-body view', () => {
  const stopped = { position: { x: -9, y: 8.419350166320722, z: -39.16 }, yaw: 0 };
  const f = fixture({ world: {
    surfaceAt: () => ({ height: 8.419350166320722, normal: { x: 0, y: 1, z: 0 } }),
    obstacles: [{ id: 'old-root-outcrop', x: -9, z: -42, radius: 2.5, cameraRadius: 2.6, baseY: 9.729777336120605, height: 5.5 }],
  } });
  try {
    f.controller.setPose({ yaw: Math.PI, pitch: .14, distance: 6.5 });
    f.controller.update(stopped, {}, 16);
    assert.ok(f.controller.diagnostics().distance >= 3, `camera distance ${f.controller.diagnostics().distance}`);
    assertView(f.controller, f.world, stopped);
    assert.equal(f.controller.yaw, Math.PI);
  } finally { f.dispose(); }
});

test('manual zero-time renders leave an avoided view unchanged and a mouse drag starts from that view', () => {
  const f = fixture({ world: { obstacles: [{ x: 0, z: 1.3, radius: .7, baseY: 0, height: 20 }] } });
  try {
    f.controller.update(player, {}, 16);
    const before = f.controller.camera.position.asArray(), resolved = f.controller.diagnostics().resolvedYaw, resolvedPitch = f.controller.diagnostics().resolvedPitch;
    assert.notEqual(resolved, 0);
    assert.equal(f.controller.yaw, 0);
    for (let frame = 0; frame < 10; frame++) f.controller.update(player, {}, 0);
    assert.deepEqual(f.controller.camera.position.asArray(), before);
    const orbit = f.controller.update(player, { lookX: 10, lookY: 20 }, 16);
    close(orbit.cameraYaw, resolved - .03);
    close(orbit.cameraPitch, Math.min(1.1, resolvedPitch + .05));
    f.controller.update(player, { forward: 1 }, 16);
    close(f.controller.yaw, resolved - .03);
  } finally { f.dispose(); }
});

test('the recorded outcrop approach and jump descent retain a clear full-body view through real movement', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), world = await createWildsWorld(scene, { workers: false, still: true });
  scene.useRightHandedSystem = true;
  try {
    for (const fps of [60, 30]) for (const take of ['approach', 'descent']) {
      const controller = createWildsCamera(scene, {}, { world });
      const position = take === 'approach' ? { x: -9, z: -31, y: world.surfaceAt(-9, -31).height } : { x: -9, z: -41.5, y: 15.24478 };
      let player = createMovementState({ position, yaw: 0 }), previous, maximumStep = 0, maximumYaw = 0;
      controller.setPose({ yaw: take === 'approach' ? Math.PI : 0, pitch: take === 'approach' ? .14 : .1, distance: 6.5 });
      for (let frame = 0; frame <= Math.round((take === 'approach' ? 5.6 : 4.5) * fps); frame++) {
        const time = frame * 1000 / fps;
        const input = take === 'approach' ? { forward: time >= 800 && time < 2500 ? -1 : time >= 3650 && time < 4400 ? 1 : 0, lookX: frame === Math.round(3.1 * fps) ? 110 : frame === Math.round(3.2 * fps) ? 120 : 0, lookY: frame === Math.round(3.1 * fps) ? 10 : frame === Math.round(3.2 * fps) ? -5 : 0 } : { forward: time >= 620 && time < 1400 ? 1 : 0, jump: time >= 600 && time < 780 };
        world.refreshObstacles(player.position);
        player = stepMovement(player, { ...input, cameraYaw: controller.yaw }, world, frame ? 1000 / fps : 0, time).state;
        controller.update(player, input, frame ? 1000 / fps : 0);
        try {
          assert.notEqual(controller.diagnostics().recovering, true);
          if (take === 'approach' && frame === 2.5 * fps) close(player.position.z, -39.16);
          assertView(controller, world, player);
          if (previous) { assertTravel(world, previous, controller.camera.position); maximumStep = Math.max(maximumStep, Vector3.Distance(previous, controller.camera.position)); }
          maximumYaw = Math.max(maximumYaw, Math.abs(Math.atan2(Math.sin(controller.diagnostics().resolvedYaw - controller.yaw), Math.cos(controller.diagnostics().resolvedYaw - controller.yaw))));
        } catch (error) { throw new Error(`${take} ${fps}fps frame ${frame}, player ${JSON.stringify(player.position)}, camera ${JSON.stringify(controller.diagnostics())}: ${error.message}`, { cause: error }); }
        previous = controller.camera.position.clone();
      }
      assert.ok(maximumStep < .95 * 60 / fps, `${take} camera moved ${maximumStep}m in one frame`);
      assert.ok(maximumYaw < 1.45, `${take} avoidance yaw ${maximumYaw}`);
      if (take === 'descent') {
        assert.equal(player.grounded, true);
        close(player.position.y, world.surfaceAt(player.position.x, player.position.z).height);
      }
      controller.dispose();
    }
  } finally { world.dispose(); scene.dispose(); engine.dispose(); }
});

test('the recorded close side climb keeps a continuous view through the summit transfer', async () => {
  const engine = new NullEngine(), scene = new Scene(engine), world = await createWildsWorld(scene, { workers: false, still: true });
  scene.useRightHandedSystem = true;
  try {
    for (const fps of [60, 30]) {
      const controller = createWildsCamera(scene, {}, { world });
      let player = createMovementState({ position: { x: -9, z: -38.98, y: world.surfaceAt(-9, -38.98).height }, yaw: 0 });
      controller.setPose({ yaw: Math.PI / 2, pitch: .12, distance: 3 });
      let previous, maximumStep = 0;
      for (let frame = 0; frame <= Math.round(5.6 * fps); frame++) {
        const time = frame * 1000 / fps, held = time >= 700 && time < 4300;
        const input = { strafe: held ? 1 : 0, climb: held, jump: held, cameraYaw: controller.yaw };
        world.refreshObstacles(player.position);
        player = stepMovement(player, input, world, frame ? 1000 / fps : 0, time).state;
        controller.update(player, {}, frame ? 1000 / fps : 0);
        assert.notEqual(controller.diagnostics().recovering, true, `recovery at frame ${frame}`);
        assertView(controller, world, player);
        if (previous) {
          assertTravel(world, previous, controller.camera.position);
          maximumStep = Math.max(maximumStep, Vector3.Distance(previous, controller.camera.position));
        }
        previous = controller.camera.position.clone();
      }
      assert.ok(maximumStep < .95 * 60 / fps, `climb camera moved ${maximumStep}m in one frame`);
      assert.equal(player.grounded, true);
      controller.dispose();
    }
  } finally { world.dispose(); scene.dispose(); engine.dispose(); }
});

test('locking the Warden frames both combatants and unlock restores the exploration target', () => {
  const f = fixture({ still: true });
  try {
    const boss = { position: { x: 8, y: 0, z: -6 } };
    f.controller.update(player, {}, 16, boss);
    const locked = f.controller.diagnostics();
    close(locked.target.x, 2.8);
    close(locked.target.z, -2.1);
    close(locked.distance, 11);
    close(locked.yaw, Math.atan2(-8, 6));
    assert.equal(locked.recovering, false);
    const camera = f.controller.camera;
    for (const point of [new Vector3(0, 1.25, 0), new Vector3(8, 1.8, -6)]) {
      const direction = point.subtract(camera.position).normalize();
      assert.ok(Vector3.Dot(direction, camera.getForwardRay().direction) > Math.cos(camera.fov / 2));
    }
    f.controller.update(player, {}, 16);
    assert.deepEqual(f.controller.diagnostics().target, { x: 0, y: 1.25, z: 0 });
    close(f.controller.diagnostics().distance, 6.5);
  } finally { f.dispose(); }
});

test('the locked combat camera still reroutes around scenery and stays above the ground', () => {
  const f = fixture({ still: true, world: { obstacles: [{ x: 0, z: 4, radius: 1.1, baseY: 0, height: 7 }] } });
  try {
    f.controller.update(player, {}, 16, { position: { x: 0, y: 0, z: -8 } });
    assert.equal(f.controller.diagnostics().occluded, true);
    assert.equal(f.controller.diagnostics().recovering, false);
    assertView(f.controller, f.world, player);
  } finally { f.dispose(); }
});

test('lock acquisition and release move smoothly while a frozen clock holds the same view', () => {
  const f = fixture();
  try {
    f.controller.update(player, {}, 16);
    let previous = f.controller.camera.position.clone();
    for (let frame = 0; frame < 80; frame++) {
      f.controller.update(player, {}, 16, frame < 40 ? { position: { x: 7, y: 0, z: -8 } } : null);
      assert.ok(Vector3.Distance(previous, f.controller.camera.position) < 1, `Camera stepped ${Vector3.Distance(previous, f.controller.camera.position)} metres`);
      previous = f.controller.camera.position.clone();
      f.controller.update(player, {}, 0, frame < 40 ? { position: { x: 7, y: 0, z: -8 } } : null);
      assert.deepEqual(f.controller.camera.position.asArray(), previous.asArray());
    }
  } finally { f.dispose(); }
});
