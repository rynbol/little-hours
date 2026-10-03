import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRig, frameRig, orbitRig, zoomRig, RIG } from './camera-rig.js';

const flat = (extra = {}) => ({ ground: () => 0, blockers: () => [], ...extra });
const settle = (rig, options, world, seconds = 2) => { let out; for (let t = 0; t < seconds; t += 1 / 60) { out = frameRig(rig, options, world, 1 / 60); rig = out.rig; } return out; };
const player = { x: 0, y: 0, z: 0 };

test('the camera rests behind and above the player, over the right shoulder', () => {
  const { eye, look } = settle(createRig(0), { at: player }, flat());
  assert.ok(eye.z < -3.5 && eye.z > -5, `eye z ${eye.z}`);
  assert.ok(eye.x > .2 && eye.x < .8, `eye x ${eye.x}`);
  assert.ok(eye.y > RIG.pivot + .5);
  assert.ok(look.z > 0, 'it looks past the player');
});

test('a trunk behind the player pulls the camera in front of it', () => {
  const trunk = { x: .3, z: -2.4, r: .5, bottom: -1, top: 12 };
  const world = flat({ blockers: (x, z) => (Math.hypot(x - trunk.x, z - trunk.z) < 3 ? [trunk] : []) });
  const { eye } = settle(createRig(0), { at: player }, world);
  assert.ok(eye.z > trunk.z + trunk.r, `eye z ${eye.z}`);
});

test('a steep bank behind the player never swallows the camera', () => {
  const bank = flat({ ground: (_, z) => (z < -1 ? (-1 - z) * 2.5 : 0) });
  const { eye } = settle(orbitRig(createRig(0), 0, -.4), { at: player }, bank);
  assert.ok(eye.y >= bank.ground(eye.x, eye.z) + RIG.clearance - 1e-9, `eye ${eye.y} ground ${bank.ground(eye.x, eye.z)}`);
});

test('locking on swings round to face the target and keeps both in view', () => {
  const stag = { x: 12, y: 0, z: 2, height: 4.5 };
  const { eye, look, fov, rig } = settle(createRig(0), { at: player, target: stag }, flat());
  const view = { x: look.x - eye.x, y: look.y - eye.y, z: look.z - eye.z }, length = Math.hypot(view.x, view.y, view.z);
  for (const point of [{ x: 0, y: 1, z: 0 }, { x: stag.x, y: 2.5, z: stag.z }]) {
    const to = { x: point.x - eye.x, y: point.y - eye.y, z: point.z - eye.z }, d = Math.hypot(to.x, to.y, to.z);
    const angle = Math.acos((to.x * view.x + to.y * view.y + to.z * view.z) / (d * length));
    assert.ok(angle < fov / 2, `angle ${angle} for ${JSON.stringify(point)}`);
  }
  assert.ok(Math.abs(rig.yaw - Math.atan2(12, 2)) < .1);
});

test('scrolling zooms within limits', () => {
  assert.equal(zoomRig(createRig(), -40).distance, RIG.distance.min);
  assert.equal(zoomRig(createRig(), 40).distance, RIG.distance.max);
});
