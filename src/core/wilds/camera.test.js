import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIG, createRig, moveFrom, orbit, stepRig, zoomRig } from './camera.js';
import { heightAt } from '../world-terrain.js';

const settle = (rig, scene, seconds = 2) => { for (let t = 0; t < seconds; t += 1 / 60) stepRig(rig, 1 / 60, scene); return rig; };
const player = (x = 0, z = 0, ground = () => 0) => ({ x, y: ground(x, z), z, grounded: true });

test('W walks away from the camera and D to the right of the screen', () => {
  const rig = createRig({ yaw: Math.PI });
  assert.deepEqual(moveFrom(rig, 1, 0).map(v => Math.round(v * 100) / 100 + 0), [0, -1]);
  assert.deepEqual(moveFrom(rig, 0, 1).map(v => Math.round(v * 100) / 100 + 0), [1, 0]);
  const diagonal = moveFrom(rig, 1, 1);
  assert.equal(Math.round(Math.hypot(...diagonal) * 100) / 100, 1);
});

test('the camera never sits inside a post, whichever way it is turned', () => {
  const post = { x: 0, z: -1.2, radius: 0.17, bottom: 0, top: 1.35 }, world = { ground: () => 0, solids: [post] };
  for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 24) {
    const rig = createRig({ yaw });
    settle(rig, { player: player(), world });
    for (let t = 0; t < 0.5; t += 1 / 60) {
      orbit(rig, 0.03, 0);
      stepRig(rig, 1 / 60, { player: player(), world });
      const gap = Math.hypot(rig.eye[0] - post.x, rig.eye[2] - post.z);
      assert.ok(gap > post.radius + 0.2 || rig.eye[1] > post.top + 0.2, `inside the post at yaw ${rig.yaw.toFixed(2)}: ${gap.toFixed(2)}`);
    }
  }
});

test('looking up from the slope pulls the camera in rather than under the grass', () => {
  for (const [x, z] of [[0, -14], [6, -30], [-9, -24]]) {
    for (const pitch of [RIG.pitch[0], -0.2, 0, 0.6, RIG.pitch[1]]) for (let yaw = 0; yaw < Math.PI * 2; yaw += Math.PI / 8) {
      const rig = createRig({ yaw, pitch, at: [x, heightAt(x, z), z] });
      zoomRig(rig, 2);
      settle(rig, { player: player(x, z, heightAt), world: { ground: heightAt, solids: [] } }, 1);
      assert.ok(rig.eye[1] > heightAt(rig.eye[0], rig.eye[2]) + 0.2, `under the ground at ${x},${z} pitch ${pitch}`);
    }
  }
});

test('lock-on swings the camera behind the player so both the player and the dummy stay on screen', () => {
  const dummy = { x: 4, z: -6, radius: 0.3, bottom: 0, top: 1.65 }, world = { ground: () => 0, solids: [dummy] };
  const rig = settle(createRig({ yaw: 0 }), { player: player(), lock: dummy, world });
  const forward = [rig.look[0] - rig.eye[0], rig.look[1] - rig.eye[1], rig.look[2] - rig.eye[2]], length = Math.hypot(...forward);
  const angle = point => { const d = [point[0] - rig.eye[0], point[1] - rig.eye[1], point[2] - rig.eye[2]]; return Math.acos((d[0] * forward[0] + d[1] * forward[1] + d[2] * forward[2]) / Math.hypot(...d) / length) * 180 / Math.PI; };
  assert.ok(angle([0, 1, 0]) < RIG.fov / 2 && angle([dummy.x, 1, dummy.z]) < RIG.fov / 2);
  assert.ok(Math.hypot(rig.eye[0] - dummy.x, rig.eye[2] - dummy.z) > Math.hypot(dummy.x, dummy.z), 'the camera is on the far side of the player');
});

test('zoom stays between close and far', () => {
  const rig = createRig();
  zoomRig(rig, 9); assert.equal(rig.zoom, RIG.far);
  zoomRig(rig, -9); assert.equal(rig.zoom, RIG.near);
});

test('the hero stands left of the screen centre, the camera looking past the right shoulder', () => {
  const rig = settle(createRig({ yaw: Math.PI }), { player: player(), world: { ground: () => 0, solids: [] } });
  const fx = rig.look[0] - rig.eye[0], fz = rig.look[2] - rig.eye[2], length = Math.hypot(fx, fz), rx = -fz / length, rz = fx / length;
  const side = (0 - rig.eye[0]) * rx + (0 - rig.eye[2]) * rz;
  assert.equal(Math.round(side * 100) / 100, -0.55);
});

test('locked on at any range, the camera stays behind the hero and sees the dummy past it, not through it', () => {
  for (const reach of [1.2, 1.8, 3, 8, 15]) {
    const dummy = { x: 0, z: -reach, radius: 0.3, bottom: 0, top: 1.65 }, world = { ground: () => 0, solids: [dummy] };
    const rig = settle(createRig({ yaw: Math.PI }), { player: player(), lock: dummy, world });
    assert.ok(rig.eye[2] > 1, `the camera is not behind the hero at ${reach} m: eye z ${rig.eye[2].toFixed(2)}`);
    const middle = [dummy.x, (dummy.bottom + dummy.top) / 2, dummy.z];
    let nearest = Infinity;
    for (let t = 0; t <= 1; t += 1 / 200) {
      const q = rig.eye.map((value, i) => value + (middle[i] - value) * t);
      nearest = Math.min(nearest, Math.hypot(q[0], q[1] - Math.min(1.2, Math.max(0.3, q[1])), q[2]));
    }
    assert.ok(nearest > 0.4, `the hero hides the dummy at ${reach} m: the sight line passes ${nearest.toFixed(2)} m from its spine`);
  }
});
