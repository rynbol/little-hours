import assert from 'node:assert/strict';
import test from 'node:test';
import { PerspectiveCamera } from 'three';
import { heightAt } from '../../core/world-terrain.js';
import { createWildsCamera } from './camera.js';

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
