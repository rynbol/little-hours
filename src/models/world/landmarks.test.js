import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { heightAt } from '../../core/world-terrain.js';
import { LANDMARKS, PLUME, MIST, SAIL_TURN, createWorldLandmarks, landmarkGeometry } from './landmarks.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const fromWindow = ({ x, z }) => Math.hypot(x + 2, z + 2.4);
const geometry = landmarkGeometry();
const near = ({ x, z }, reach) => {
  const found = [];
  for (let i = 0; i < geometry.positions.length / 3; i++) if (Math.hypot(geometry.positions[i * 3] - x, geometry.positions[i * 3 + 2] - z) < reach) found.push(i);
  return found;
};
const heights = vertices => vertices.map(i => geometry.positions[i * 3 + 1]);

test('an observatory, a snow peak, a waterfall and windmills stand at their distances from the window', () => {
  assert.deepEqual(Object.keys(LANDMARKS), ['observatory', 'peak', 'falls', 'windmills']);
  assert.ok(fromWindow(LANDMARKS.observatory) >= 3000 && fromWindow(LANDMARKS.observatory) <= 4000);
  assert.ok(fromWindow(LANDMARKS.peak) >= 5000 && fromWindow(LANDMARKS.peak) <= 9000);
  assert.ok(fromWindow(LANDMARKS.falls) >= 500 && fromWindow(LANDMARKS.falls) <= 1200);
  assert.ok(LANDMARKS.windmills.length >= 2 && LANDMARKS.windmills.length <= 3);
  for (const windmill of LANDMARKS.windmills) assert.ok(fromWindow(windmill) >= 800 && fromWindow(windmill) <= 1800, `windmill ${fromWindow(windmill).toFixed(0)} m out`);
  assert.equal(PLUME.rise, 160);
});

test('the observatory, waterfall butte and windmills are rooted in the ground and rise above it', () => {
  const { observatory, falls } = LANDMARKS;
  for (const [site, reach, tall] of [[observatory, observatory.drum * 1.6, observatory.drum], [falls, falls.width + 40, falls.height * 0.8], ...LANDMARKS.windmills.map(windmill => [windmill, 6, windmill.height * 0.9])]) {
    const ys = heights(near(site, reach)), ground = heightAt(site.x, site.z);
    assert.ok(Math.min(...ys) <= ground, `${site.x}, ${site.z} floats above the ground`);
    assert.ok(Math.max(...ys) >= ground + tall, `${site.x}, ${site.z} only reaches ${(Math.max(...ys) - ground).toFixed(0)} m`);
  }
  assert.ok(Math.abs(Math.max(...heights(near(LANDMARKS.peak, 400))) - LANDMARKS.peak.summit) < 60);
  assert.ok(geometry.positions.length / 3 < 16000);
});

test('the peak is one smooth sheet with shared vertices, not faceted panels', () => {
  const peak = new Set(near(LANDMARKS.peak, LANDMARKS.peak.radius * 0.9));
  let corners = 0;
  for (const index of geometry.indices) if (peak.has(index)) corners++;
  assert.ok(peak.size > 4000);
  assert.ok(corners / peak.size > 5.5, `${(corners / peak.size).toFixed(2)} triangle corners per vertex`);
});

test('only the windmill sails carry a spin, one hub per windmill', () => {
  const hubs = new Map();
  for (let i = 0; i < geometry.spins.length; i += 4) {
    const rate = geometry.spins[i + 3];
    if (rate === 0) { assert.deepEqual([...geometry.spins.slice(i, i + 3)], [0, 0, 0]); continue; }
    assert.equal(rate, Math.fround(SAIL_TURN));
    hubs.set(geometry.spins.slice(i, i + 3).join(), [geometry.spins[i], geometry.spins[i + 2]]);
  }
  assert.equal(hubs.size, LANDMARKS.windmills.length);
  for (const windmill of LANDMARKS.windmills) assert.ok([...hubs.values()].some(([x, z]) => Math.hypot(x - windmill.x, z - windmill.z) < 6));
});

test('the landmarks are two draws that take the theme and stand still under reduced motion', async () => {
  const scene = new Scene(new NullEngine()); new FreeCamera('eye', new Vector3(-2, 60, -2.4), scene);
  const moving = createWorldLandmarks(scene, { root: new TransformNode('root', scene), still: false });
  const resting = createWorldLandmarks(scene, { root: new TransformNode('rest', scene), still: true });
  assert.deepEqual(moving.meshes.map(mesh => mesh.name), ['world-landmarks', 'world-landmark-veils']);
  assert.equal(moving.meshes[1].getTotalIndices(), (PLUME.puffs + MIST.puffs) * 6 + 12 * 6);
  const [solid, veil] = moving.meshes.map(mesh => mesh.material);
  moving.setTheme(WORLD_ATMOSPHERES.day);
  const dayGlow = solid._floats.lampGain;
  moving.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(solid._colors3.sunColor.toHexString().toLowerCase(), '#ffb46a');
  assert.equal(veil._colors3.sunColor.toHexString().toLowerCase(), '#ffb46a');
  assert.equal(solid._colors3.snow.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.snow);
  assert.ok(solid._floats.lampGain > dayGlow * 3);
  scene.render(); await wait(20); scene.render();
  assert.ok(solid._floats.time > 0 && veil._floats.time > 0);
  for (const mesh of resting.meshes) assert.equal(mesh.material._floats.time, 0);
  assert.equal(resting.meshes[0].material._vectors3.eye.y, 60);
  scene.dispose();
});
