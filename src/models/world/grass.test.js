import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWorldGrass, createGroundGrid, grassBlades, surfaceAt } from './grass.js';
import { heightAt } from '../../core/world-terrain.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);

test('grass roots sit on the rendered terrain triangles, not the analytic height', () => {
  close(surfaceAt(40, -40), heightAt(40, -40), 'grid vertex');
  close(surfaceAt(41, -39.5), -21.509562509, 'lower triangle');
  close(surfaceAt(41.5, -38.5), -21.421684834, 'upper triangle');
  assert.equal(surfaceAt(0, 0), 0);
});

test('the ground grid recentres on the camera and reuses texels it already holds', () => {
  const moved = createGroundGrid({ texels: 5, step: 2 });
  assert.equal(moved.centre(0, 0), true);
  assert.deepEqual(moved.origin, [-4, -4]);
  assert.equal(moved.centre(0.9, 0.9), false);
  assert.equal(moved.centre(30, -52), true);
  assert.deepEqual(moved.origin, [26, -56]);
  assert.equal(moved.centre(33, -52), true);
  const fresh = createGroundGrid({ texels: 5, step: 2 });
  fresh.centre(33, -52);
  assert.deepEqual(moved.origin, fresh.origin);
  assert.deepEqual(moved.data, fresh.data);
  assert.deepEqual(Array.from(fresh.data.slice(0, 4), value => Math.round(value * 1e3) / 1e3), [0.06, 0.992, -0.113, -23.303]);
});

test('two blade layers tile their own periods with five vertices and three triangles each', () => {
  const { positions, blade, indices } = grassBlades();
  assert.equal(positions.length / 3, 160000);
  assert.equal(indices.length, 288000);
  const reach = [0, 0];
  for (let v = 0; v < positions.length / 3; v++) {
    const layer = blade[v * 4 + 3];
    reach[layer] = Math.max(reach[layer], positions[v * 3], positions[v * 3 + 2]);
  }
  assert.deepEqual(reach.map(Math.ceil), [16, 48]);
  assert.deepEqual(Array.from(positions.slice(1, 15).filter((_, i) => i % 3 === 0)), [0, 0, 0.550000011920929, 0.550000011920929, 1]);
});

test('world grass follows the camera in steps, takes the theme and stays still when asked', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene), camera = new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true });
  assert.equal(grass.mesh.getTotalVertices(), 160000);
  assert.deepEqual(grass.origin, [-40, -40]);
  assert.equal(grass.follow(7, -7), false);
  assert.equal(grass.follow(9, 0), true);
  assert.deepEqual(grass.origin, [-30, -40]);
  const paint = grass.mesh.material;
  assert.equal(paint._floats.gusts, 0);
  grass.setTheme(WORLD_ATMOSPHERES.dusk);
  assert.equal(paint._colors3.grassLight.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.grassLight);
  camera.position.set(60, 2, -60);
  scene.render();
  assert.deepEqual(grass.origin, [20, -100]);
  grass.mesh.dispose();
  camera.position.set(200, 2, -60);
  scene.render();
  assert.deepEqual(grass.origin, [20, -100]);
});
