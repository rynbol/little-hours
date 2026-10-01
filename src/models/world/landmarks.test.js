import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt } from '../../core/world-terrain.js';
import { LANDMARKS, PLUME, createWorldLandmarks, landmarkGeometry } from './landmarks.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const fromWindow = ({ x, z }) => Math.hypot(x + 2, z + 2.4);

test('the castle, volcano and towers stand at their distances from the window', () => {
  assert.ok(fromWindow(LANDMARKS.castle) >= 2000 && fromWindow(LANDMARKS.castle) <= 4000);
  assert.ok(fromWindow(LANDMARKS.volcano) >= 5000 && fromWindow(LANDMARKS.volcano) <= 9000);
  assert.equal(LANDMARKS.towers.length, 2);
  for (const tower of LANDMARKS.towers) assert.ok(fromWindow(tower) >= 1000 && fromWindow(tower) <= 2000, `tower ${fromWindow(tower).toFixed(0)} m out`);
  assert.ok(LANDMARKS.volcano.x < 0 && LANDMARKS.volcano.summit === 2150);
});

test('every landmark is rooted below the ground it stands on', () => {
  const { positions } = landmarkGeometry();
  const lowest = ({ x, z }, reach) => {
    let low = Infinity;
    for (let i = 0; i < positions.length; i += 3) if (Math.hypot(positions[i] - x, positions[i + 2] - z) < reach) low = Math.min(low, positions[i + 1]);
    return low;
  };
  for (const site of [LANDMARKS.castle, ...LANDMARKS.towers]) assert.ok(lowest(site, 40) <= heightAt(site.x, site.z), `${site.x}, ${site.z}`);
  assert.ok(lowest(LANDMARKS.volcano, LANDMARKS.volcano.radius) <= heightAt(LANDMARKS.volcano.x + LANDMARKS.volcano.radius * 0.6, LANDMARKS.volcano.z));
  assert.ok(positions.length / 3 < 12000);
});

test('the landmarks are two draws that take the theme and a plume that rises unless still', async () => {
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-2, 60, -2.4), scene);
  const moving = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: false });
  const resting = createWorldLandmarks(scene, { root: new TransformNode('rest', scene), still: true });
  assert.deepEqual(moving.meshes.map(mesh => mesh.name), ['world-landmarks', 'world-volcano-plume']);
  assert.equal(moving.meshes[1].getTotalIndices(), PLUME.puffs * 6);
  moving.setTheme(WORLD_ATMOSPHERES.dusk);
  const [solid, plume] = moving.meshes.map(mesh => mesh.material);
  assert.equal(solid._colors3.sunColor.toHexString().toLowerCase(), '#ffb46a');
  assert.equal(plume._colors3.sunColor.toHexString().toLowerCase(), '#ffb46a');
  assert.ok(Math.abs(solid._floats.glowGain - 1.28) < 0.01);
  scene.render(); await wait(20); scene.render();
  assert.ok(plume._floats.time > 0);
  assert.equal(resting.meshes[1].material._floats.time, 0);
  assert.equal(resting.meshes[1].material._vectors3.eye.y, 60);
  scene.dispose();
});
