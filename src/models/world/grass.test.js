import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { createWorldGrass, createGroundGrid, grassBlades, surfaceAt } from './grass.js';
import { MEADOW_ROCKS, rockClearings } from './rocks.js';
import { heightAt } from '../../core/world-terrain.js';
import { WORLD_ATMOSPHERES } from './atmosphere.js';

const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);

test('grass roots sit on the rendered terrain triangles, not the analytic height', () => {
  close(surfaceAt(40, -40), heightAt(40, -40), 'grid vertex');
  close(surfaceAt(41, -39.5), -9.439169868, 'lower triangle');
  const corner = heightAt(40, -40);
  close(surfaceAt(41, -39.5), corner + (heightAt(42, -40) - corner) * 0.5 + (heightAt(40, -38) - corner) * 0.25, 'lower triangle plane');
  assert.ok(Math.abs(surfaceAt(41, -39.5) - heightAt(41, -39.5)) > 1e-4);
  close(surfaceAt(41.5, -38.5), -9.371802868, 'upper triangle');
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
  assert.deepEqual(Array.from(fresh.data.slice(0, 4), value => Math.round(value * 1e3) / 1e3), [0.04, 0.995, -0.088, -10.925]);
});

test('three blade layers tile their own periods with five vertices and three triangles each', () => {
  const { positions, blade, indices } = grassBlades();
  assert.equal(positions.length / 3, 360000);
  assert.equal(indices.length, 648000);
  const reach = [0, 0, 0];
  for (let v = 0; v < positions.length / 3; v++) {
    const layer = blade[v * 4 + 3];
    reach[layer] = Math.max(reach[layer], positions[v * 3], positions[v * 3 + 2]);
  }
  assert.deepEqual(reach.map(Math.ceil), [16, 48, 128]);
  assert.deepEqual(Array.from(positions.slice(1, 15).filter((_, i) => i % 3 === 0)), [0, 0, 0.5, 0.5, 1]);
});

test('world grass follows the camera in steps, takes the theme and stays still when asked', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene), camera = new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const grass = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true });
  assert.equal(grass.mesh.getTotalVertices(), 360000);
  assert.deepEqual(grass.origin, [-68, -68]);
  assert.equal(grass.follow(7, -7), false);
  assert.equal(grass.follow(9, 0), true);
  assert.deepEqual(grass.origin, [-58, -68]);
  const paint = grass.mesh.material;
  assert.equal(paint._floats.gusts, 0);
  grass.setTheme(WORLD_ATMOSPHERES.dusk);
  for (const key of ['grassLight', 'flowerWhite', 'flowerYellow', 'flowerLilac']) assert.equal(paint._colors3[key].toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk[key], key);
  assert.equal(grass.rocks.material._colors3.rock.toHexString().toLowerCase(), WORLD_ATMOSPHERES.dusk.rock);
  camera.position.set(60, 2, -60);
  scene.render();
  assert.deepEqual(grass.origin, [-8, -128]);
  grass.mesh.dispose();
  camera.position.set(200, 2, -60);
  scene.render();
  assert.deepEqual(grass.origin, [-8, -128]);
});

test('grass leaves a bare ring round each meadow rock', () => {
  const scene = new Scene(new NullEngine()), root = new TransformNode('world', scene);
  new FreeCamera('eye', new Vector3(0, 2, 0), scene);
  const paint = createWorldGrass(scene, { root, atmosphere: WORLD_ATMOSPHERES.day, still: true }).mesh.material;
  assert.equal(paint._vectors4Arrays.stones.length, MEADOW_ROCKS.length * 4);
  assert.deepEqual(paint._vectors4Arrays.stones, rockClearings());
  assert.deepEqual(rockClearings().filter((_, i) => i % 4 === 2).map(radius => Math.round(radius * 100) / 100), [1.2, 0.5, 0.55, 0.69, 0.94, 0.49, 1.11]);
});
