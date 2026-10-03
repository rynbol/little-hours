import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera, Vector3 } from 'three';
import { heightAt } from '../../core/world-terrain.js';
import { createWildsCamera } from './camera.js';
import { STONES } from '../../core/wilds/encounter.js';

test('camera stays in front of a post when the player touches its padded volume', () => {
  const camera = new PerspectiveCamera(), rig = createWildsCamera(camera);
  const player = { x: -3.2, y: heightAt(-3.2, -4), z: -4 };
  rig.orbit(-Math.PI / 2 / .006, 0);
  rig.update(player, false, 1);
  assert.equal(rig.diagnostics().clipped, true);
  assert.ok(camera.position.x > -3.35);
});

test('camera orbit and zoom keep the near plane above the terrain', () => {
  const camera = new PerspectiveCamera(), rig = createWildsCamera(camera);
  for (const [x, z] of [[0, 2], [25, -32], [-36, 1]]) {
    const player = { x, z, y: heightAt(x, z) };
    rig.zoom(50); rig.orbit(210, -400); rig.update(player, false, 1);
    assert.ok(camera.position.y >= heightAt(camera.position.x, camera.position.z) + .34);
    assert.equal(rig.diagnostics().distance, 11);
  }
});

test('lock follows the live moving boss and releases its focus when unlocked', () => {
  const camera = new PerspectiveCamera();
  const boss = { x: 6, z: -24, height: 4.5 };
  const player = { x: 0, z: -20, y: heightAt(0, -20) };
  const rig = createWildsCamera(camera, { target: () => boss, obstacles: [] });
  rig.update(player, true, 1);
  const right = rig.diagnostics();
  assert.ok(right.yaw > 0.8);
  assert.ok(right.target[0] > 1.5);
  assert.ok(right.target[1] > player.y + 1.4);
  boss.x = -6; boss.z = -22;
  rig.update(player, true, 1);
  const left = rig.diagnostics();
  assert.ok(left.yaw < -1);
  assert.ok(left.target[0] < -1.5);
  assert.ok(left.target[2] > right.target[2] + 0.5);
  assert.ok(camera.position.distanceTo({ x: right.position[0], y: right.position[1], z: right.position[2] }) > 3);
  const lockedYaw = left.yaw;
  boss.x = 30; boss.z = -40;
  rig.update(player, false, 1);
  const unlocked = rig.diagnostics();
  assert.equal(unlocked.yaw, lockedYaw);
  assert.ok(Math.abs(unlocked.target[0] - player.x) < 1e-6);
  assert.ok(Math.abs(unlocked.target[2] - player.z) < 1e-6);
  assert.ok(Math.abs(unlocked.target[1] - player.y - 1.05) < 1e-6);
});

test('standing stones shorten the camera boom before its padded volume while an open view stays wide', () => {
  const stone = STONES[0];
  const player = { x: stone.x, z: stone.z - 2, y: heightAt(stone.x, stone.z - 2) };
  const camera = new PerspectiveCamera(), openCamera = new PerspectiveCamera();
  const rig = createWildsCamera(camera, { obstacles: STONES });
  const openRig = createWildsCamera(openCamera, { obstacles: [] });
  rig.update(player, false, 1);
  openRig.update(player, false, 1);
  assert.equal(rig.diagnostics().clipped, true);
  assert.equal(openRig.diagnostics().clipped, false);
  assert.ok(camera.position.z < stone.z - stone.radius - 0.38);
  assert.ok(openCamera.position.z > stone.z + stone.radius);
  assert.ok(camera.position.distanceTo(openCamera.position) > 3);
  assert.ok(camera.position.y >= heightAt(camera.position.x, camera.position.z) + 0.34);
});

test('melee lock frames the entire tall boss and player feet on sloped terrain through charge and sweep', () => {
  for (const [x, z] of [[0, -24], [25, -32], [-36, 1]]) {
    const camera = new PerspectiveCamera(58, 16 / 9, 0.15, 130);
    const player = { x, z: z + 2.2, y: heightAt(x, z + 2.2) };
    const boss = { x, z, height: 4.65 };
    const rig = createWildsCamera(camera, { target: () => boss, obstacles: [] });
    const visible = () => {
      camera.updateMatrixWorld();
      for (const point of [new Vector3(boss.x, heightAt(boss.x, boss.z) + boss.height, boss.z), new Vector3(player.x, player.y, player.z)]) {
        point.project(camera);
        assert.ok(Math.abs(point.y) < 0.88, `vertical clip at ${x},${z}: ${point.y}`);
        assert.ok(Math.abs(point.x) < 0.88, `horizontal clip at ${x},${z}: ${point.x}`);
        assert.ok(point.z > -1 && point.z < 1);
      }
    };
    rig.update(player, true, 1);
    visible();
    for (let frame = 0; frame < 60; frame++) {
      boss.z = z + Math.sin(frame / 60 * Math.PI) * 0.6;
      boss.x = x + Math.sin(frame / 60 * Math.PI * 2) * 1.5;
      rig.update(player, true, 1 / 60);
      visible();
    }
  }
});

test('lock reads a live target elevation and height while preserving its collision obstruction', () => {
  const camera = new PerspectiveCamera(58, 16 / 9, 0.15, 130);
  const boss = { x: 0, z: -24, y: heightAt(0, -24), height: 4.65 };
  const player = { x: 0, z: -21.8, y: heightAt(0, -21.8) };
  const rig = createWildsCamera(camera, { target: () => boss, obstacles: [] });
  rig.update(player, true, 1);
  const low = rig.diagnostics().target[1];
  boss.y += 2;
  rig.update(player, true, 1);
  assert.ok(rig.diagnostics().target[1] > low + 0.9);
  camera.updateMatrixWorld();
  const apex = new Vector3(boss.x, boss.y + boss.height, boss.z).project(camera);
  const feet = new Vector3(player.x, player.y, player.z).project(camera);
  assert.ok(apex.y < 0.88);
  assert.ok(feet.y > -0.88);
  const stone = STONES[0];
  const blockedPlayer = { x: stone.x, z: stone.z - 2, y: heightAt(stone.x, stone.z - 2) };
  const blockedRig = createWildsCamera(new PerspectiveCamera(58, 16 / 9), { target: () => ({ ...boss, x: stone.x, z: stone.z - 4, y: heightAt(stone.x, stone.z - 4) }), obstacles: STONES });
  blockedRig.update(blockedPlayer, true, 1);
  assert.equal(blockedRig.diagnostics().clipped, false);
  assert.ok(Math.abs(blockedRig.diagnostics().orbitOffset) > 0 || blockedRig.diagnostics().elevatedPitch > 0);
});

test('near a standing stone locked camera finds a clear orbit instead of cropping either fighter', () => {
  const stone = STONES[0];
  const camera = new PerspectiveCamera(58, 920 / 640, 0.15, 130);
  const boss = { x: stone.x, z: stone.z - 4, y: heightAt(stone.x, stone.z - 4), height: 4.65, radius: 1.3 };
  const player = { x: stone.x, z: stone.z - 2, y: heightAt(stone.x, stone.z - 2) };
  const rig = createWildsCamera(camera, { target: () => boss, obstacles: STONES });
  for (let frame = 0; frame < 30; frame++) {
    boss.x = stone.x + Math.sin(frame / 30 * Math.PI) * 0.7;
    boss.y = heightAt(boss.x, boss.z);
    rig.update(player, true, frame ? 1 / 60 : 1);
    camera.updateMatrixWorld();
    const apex = new Vector3(boss.x, boss.y + boss.height, boss.z).project(camera);
    const feet = new Vector3(player.x, player.y, player.z).project(camera);
    assert.ok(Math.abs(apex.y) < .9 && Math.abs(apex.x) < .9);
    assert.ok(Math.abs(feet.y) < .9 && Math.abs(feet.x) < .9);
    assert.equal(rig.diagnostics().clipped, false);
    const [, lookY] = rig.diagnostics().target;
    for (const obstacle of STONES) {
      const dx = camera.position.x - obstacle.x, dz = camera.position.z - obstacle.z;
      if (camera.position.y < heightAt(obstacle.x, obstacle.z) + obstacle.height + .3) assert.ok(Math.hypot(dx, dz) >= obstacle.radius + .38);
    }
    const [lookX, , lookZ] = rig.diagnostics().target;
    const actualYaw = Math.atan2(lookX - camera.position.x, camera.position.z - lookZ);
    assert.ok(Math.abs(Math.atan2(Math.sin(rig.yaw - actualYaw), Math.cos(rig.yaw - actualYaw))) < 1e-6);
    assert.ok(camera.position.y > lookY);
  }
});

test('lock keeps both fighters visible around every standing stone and unlock exposes the resolved heading', () => {
  for (const stone of STONES) {
    const nx = stone.x / 9, nz = (stone.z + 24) / 9;
    const player = { x: stone.x - nx * 2, z: stone.z - nz * 2 };
    player.y = heightAt(player.x, player.z);
    const boss = { x: stone.x - nx * 4, z: stone.z - nz * 4, height: 4.65, radius: 1.3 };
    boss.y = heightAt(boss.x, boss.z);
    const camera = new PerspectiveCamera(58, 920 / 640, .15, 130);
    const rig = createWildsCamera(camera, { target: () => boss, obstacles: STONES });
    rig.update(player, true, 1);
    camera.updateMatrixWorld();
    for (const point of [new Vector3(player.x, player.y, player.z), new Vector3(boss.x, boss.y + boss.height, boss.z)]) {
      point.project(camera);
      assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9, `stone ${stone.index} clips ${point.toArray()}`);
    }
    assert.equal(rig.diagnostics().clipped, false);
    rig.update(player, false, 1 / 60);
    const [lookX, , lookZ] = rig.diagnostics().target;
    const actualYaw = Math.atan2(lookX - camera.position.x, camera.position.z - lookZ);
    assert.ok(Math.abs(Math.atan2(Math.sin(rig.yaw - actualYaw), Math.cos(rig.yaw - actualYaw))) < 1e-6);
    assert.equal(rig.diagnostics().clipped, false);
  }
});

test('victory unlock beside a stone preserves safe elevation and keeps the player visible outside their body', () => {
  const player = { x: -6.0545229989852904, y: -2.5020894810131264, z: -18.038008848177068 };
  const boss = { x: -4.600381080189449, y: -2.6407434880569123, z: -18.74452711867287, height: 4.5, radius: 1.3 };
  let focus = boss;
  const camera = new PerspectiveCamera(58, 920 / 640, .15, 130);
  const rig = createWildsCamera(camera, { target: () => focus, obstacles: STONES });
  rig.update(player, true, 1);
  assert.ok(rig.diagnostics().elevatedPitch > 0 || Math.abs(rig.diagnostics().orbitOffset) > 0);
  focus = { x: 0, z: -5, height: 1.8, radius: .55 };
  for (let frame = 0; frame < 60; frame++) {
    rig.update(player, false, 1 / 60);
    camera.updateMatrixWorld();
    for (const point of [new Vector3(player.x, player.y, player.z), new Vector3(player.x, player.y + 1.65, player.z)]) {
      point.project(camera);
      assert.ok(Math.abs(point.x) < .9 && Math.abs(point.y) < .9, `unlock frame ${frame} hides player: ${point.toArray()}`);
    }
    assert.equal(rig.diagnostics().clipped, false);
    assert.ok(camera.position.distanceTo(new Vector3(player.x, player.y + .8, player.z)) > 2.5);
    const [x, , z] = rig.diagnostics().target;
    const actualYaw = Math.atan2(x - camera.position.x, camera.position.z - z);
    assert.ok(Math.abs(Math.atan2(Math.sin(rig.yaw - actualYaw), Math.cos(rig.yaw - actualYaw))) < 1e-6);
  }
});

test('reset discards arena tracking and snaps the next update to camp with the default orbit', () => {
  const boss = { x: -4.6, z: -18.7, height: 4.5 };
  const camera = new PerspectiveCamera(58, 920 / 640, .15, 130);
  const rig = createWildsCamera(camera, { target: () => boss, obstacles: STONES });
  const player = { x: -6.05, z: -18.03, y: heightAt(-6.05, -18.03) };
  rig.orbit(120, 50); rig.zoom(3); rig.update(player, true, 1);
  rig.reset();
  const camp = { x: 0, y: heightAt(0, 2), z: 2 };
  rig.update(camp, false, 1 / 60);
  const cleanCamera = new PerspectiveCamera(58, 920 / 640, .15, 130);
  const clean = createWildsCamera(cleanCamera, { target: () => boss, obstacles: STONES });
  clean.update(camp, false, 1 / 60);
  assert.deepEqual(rig.diagnostics(), clean.diagnostics());
  assert.equal(rig.yaw, 0);
  assert.equal(rig.diagnostics().pitch, .3);
  assert.equal(rig.diagnostics().distance, 6.6);
  assert.deepEqual(rig.diagnostics().target, [0, 1.05, 2]);
});
